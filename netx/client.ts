// M4 · 客户端会话（纯逻辑，浏览器与 Node 测试同源）。
// 这个文件存在的理由不是"方便"，而是**对抗性**：它代表一个不信任服务端的我方玩家，
// 对每一条下行做三件事 ——
//   1) 协议校验（checkDown）：服务端多塞一个 key 也算越界；
//   2) 投影自检（checkViewLeak）：别人的牌、我没看牌时我自己的牌、结算前的种子，一律不许出现；
//   3) 揭示核对（reveal）：服务端的承诺必须打得开、我交上去的份额必须原样在场、
//      全部份额重新合成出的 seed 必须等于真正发牌用的 seed。
// 任何一条不过 ⇒ 记下 violation，并且 act() 从此拒绝再发任何行动。
import type { Rules } from '../src/rules.ts';
import type { Event } from '../src/engine/state.ts';
import type { View } from '../src/engine/project.ts';
import { checkDown, checkViewLeak } from './protocol.ts';
import type { Down, Move, Roster, Up } from './protocol.ts';
import { commitOf, partyOfSeat, seedFromShares, SERVER_PARTY } from './seed.ts';

export type PeerOptions = {
  name: string;
  buyIn: number;
  entropy: () => string;
  // M5 · 页面刷新后的重建凭据。全部来自"每标签页"存储（sessionStorage 一类），见 webui/netplay.ts。
  // 关键是 share：本局的份额明文只有我自己知道。丢了它，局末的"我的份额确实在场"那条核对
  // 就会把一个诚实的服务端误报成越界 —— 所以宁可存下来，也不能不存。
  // 注意这里没有 seq：刷新后的页面确实一条消息都没看过，恢复 seq 会让客户端自己的连续性对账先炸。
  restore?:
    | {
        token: string;
        seat: number;
        name: string;
        hand: number;
        share: string | null;
      }
    | undefined;
};

export type PeerInfo = {
  seat: number;
  name: string;
  token: string;
  hand: number;
  seq: number;
  phase: string;
  logLen: number;
  violations: string[];
  errors: { code: string; why: string }[];
  notices: string[];
  lastReject: { code: string; why: string } | null;
  // 只增不减的那一份：lastReject 会过期（提示行只陈述当前），审计要能查到历史的全部拒绝
  rejects: { code: string; why: string }[];
  committed: string[];
  verifiedHand: number | null;
  nonceSent: boolean;
  // hosted 流程的桌况（来自 table 下行；auto 房间没有这条消息 ⇒ 全部为零值）。
  // 这里只存放、不判定：等待/准备/房主的语义归 netplay 的视图层。
  table: { host: number; ready: number[]; waiting: boolean; playing: boolean } | null;
};

// 快照的 log 应当覆盖本局 1..seq；增量的 log 应当正好是 (since, seq] 这一段。
function logShape(log: Event[], first: number, lastSeq: number): string | null {
  if (log.length === 0) return lastSeq < first ? null : `log stops before seq ${String(lastSeq)}`;
  const head = log[0] as Event;
  if (head.seq !== first) return `log starts at seq ${String(head.seq)}, expected ${String(first)}`;
  for (let i = 1; i < log.length; i += 1) {
    const prev = log[i - 1] as Event;
    const cur = log[i] as Event;
    if (cur.seq !== prev.seq + 1) return `log has a seq gap at ${String(cur.seq)}`;
  }
  const tail = log[log.length - 1] as Event;
  if (tail.seq !== lastSeq) return `log ends at seq ${String(tail.seq)}, expected ${String(lastSeq)}`;
  return null;
}

export function createPeer(options: PeerOptions) {
  const restore = options.restore;
  let seat = restore?.seat ?? -1;
  let name = restore?.name ?? options.name;
  let token = restore?.token ?? '';
  let rules: Rules | null = null;
  let roster: Roster[] = [];
  let table: PeerInfo['table'] = null; // auto 房间收不到 table ⇒ 保持 null
  // 恢复时**故意不带 seq / log**：刷新后的这一页确实一条消息都没看到，声称看到 N 条会让
  // "增量必须接得上号"那道闸先炸（合并后条数 != seq）。报 hand 而不报 seq，服务端就会把整段日志
  // 作为 (0, seq] 的增量补回来，客户端的不变式从头到尾成立。
  let hand = restore?.hand ?? 0;
  let seq = 0;
  let view: View | null = null;
  let log: Event[] = [];
  let lastReject: { code: string; why: string } | null = null;
  // 两个面分开：`lastReject` 是"仍然描述当前处境的那条拒绝"（提示行用它，会过期），
  // `rejects` 是"服务端对这一家说过的所有拒绝"（审计与用例用它，只增不减）。
  // 混成一个字段就会两头都不对：要么提示行一直挂着旧账（rev=10 应修 4），要么历史被清掉。
  const rejects: { code: string; why: string }[] = [];
  let myShare: string | null = restore?.share ?? null;
  // 已经交过份额的那一局不许再交第二次：恢复时把"本局已交"一起接回来。
  // 不恢复这个 ⇒ 刷新后再交一份新份额 ⇒ 服务端回 bad_nonce，而揭示时在场的是**旧**那份，
  // 客户端"我的份额在场"那条核对就会把一个诚实的服务端误报成越界（M5 接 UI 时才暴露的路径）。
  let nonceForHand = myShare !== null ? hand : 0;
  let verifiedHand: number | null = null;
  const commitments = new Map<string, string>();
  const violations: string[] = [];
  const errors: { code: string; why: string }[] = [];
  const notices: string[] = [];

  function violate(why: string): void {
    if (!violations.includes(why)) violations.push(why);
  }

  function enterHand(h: number): void {
    if (h === hand) return;
    hand = h;
    seq = 0;
    log = [];
    view = null;
    commitments.clear();
    nonceForHand = 0;
    // 算术基准也挂在换手这一刻：下面那几条恒等式是"**同一手内**恒定"，跨手比必然假阳性
    // （上一手结算把筹码搬进了池，新一手的起点是各家余额之和 = 手内守恒值）。
    money = null;
  }

  // —— 纯客户端的算术核对（rev=11 必修 1）——
  // 一个坏掉或敌意的服务端可以在一条 schema 完全合法的 `patch` 上把 pot / 我的 chips / 我的 committed /
  // 别家的 chips 各改一个数，投影里没有任何牌面泄漏，`checkViewLeak` 一声不响 ⇒ 页面就把假数字渲染出去。
  // 但"客户端无法独立核对权威数字"这句话是**假的**（rev=11 的 nui/25 把它钉成了断言，被复审实测证伪）：
  // 同一手内有三条只靠投影自身就能算的恒等式 ——
  //   (a) pot === Σ 各家的 committed            —— 每一笔投入都当场进池
  //   (c) 我自己的 chips + committed 恒定        —— 我这一手的总承诺不会凭空变
  //   (d) 全桌 Σ(chips + committed) 恒定         —— 一手之内钱不会凭空多出或蒸发
  // 成立区间是**量出来的**（`.scratch/r12-invariants.ts`，6 手 × 3 家 = 232 帧，覆盖看牌/加注/比牌淘汰/
  // 弃牌/托管到点/结算）：`betting` 与 `awaitingSettle` 全程 0 处不符；只有 `settled` 那一帧合法地破 ——
  // 池分发完毕归零，而 `committed` 记的仍是本手投入、赢家余额同时进账，两个数天生就不该相等。
  // 弃牌与淘汰只改 `active` 标记、不动 chips/committed ⇒ 手内 (c)(d) 不受影响。
  // 与 `checkViewLeak` 同构：它是服务端 project() 那道墙的第二道客户端复检，这里则是权威数字的第二道算术复检；
  // 返回值非 null 由调用处走既有 `violate('snapshot unusable: …')` / `violate('patch unusable: …')` ⇒
  // 停手、提示行、按钮塌陷那一整套机制自动接上，不新开任何通道。
  let money: { hand: number; total: number; perSeat: Map<number, number> } | null = null;

  function checkMoney(v: View): string | null {
    // 唯一合法的豁免：`settled` 那一帧池已分发归零、`committed` 记的仍是本手投入，两数天生不等。
    // 这道守卫不是"为了让用例变绿"——它的依据是 232 帧实测（见上面那段），撤掉它 nui/28 立刻翻红。
    if (v.phase === 'settled') return null;
    // 守卫被撤掉 ⇒ 结算帧拿"池已分发"去比 Σcommitted，必然假阳性
    const sumCommitted = v.seats.reduce((s, r) => s + r.committed, 0);
    if (v.pot !== sumCommitted) return `pot ${String(v.pot)} != sum(committed) ${String(sumCommitted)}`;
    const total = v.seats.reduce((s, r) => s + r.chips + r.committed, 0);
    if (money === null || money.hand !== hand) {
      money = { hand, total, perSeat: new Map(v.seats.map((r) => [r.seat, r.chips + r.committed])) };
      return null;
    }
    // (c) 写成**逐座位**版本而不是只验我自己那一格：只验自己会漏掉"别家的 chips 被 +100"那一支。
    // 它同时把复审提醒的 (d) 名册守卫做掉了 —— 基准里有谁才算谁，谁家跳了就说得出是谁。
    for (const r of v.seats) {
      const base = money.perSeat.get(r.seat);
      if (base !== undefined && r.chips + r.committed !== base) {
        return `seat ${String(r.seat)} chips+committed ${String(r.chips + r.committed)} != ${String(base)} (同一手内应恒定)`;
      }
    }
    if (total !== money.total) return `table chips+committed ${String(total)} != ${String(money.total)} (同一手内应恒定)`;
    return null;
  }

  function checkView(v: View, firstLogSeq: number, envelopeSeq: number, totalSoFar: number): string | null {
    if (v.seq !== envelopeSeq) return `view.seq ${String(v.seq)} != envelope seq ${String(envelopeSeq)}`;
    const leak = checkViewLeak(v, seat);
    if (leak !== null) return leak;
    const shape = logShape(v.log, firstLogSeq, envelopeSeq);
    if (shape !== null) return shape;
    // 本局日志天然是 1..seq 一条一事件：合并之后条数必须正好等于 seq。
    // 这条防的是"服务端少给或跳过一段"——哪怕每一段自己看起来连续。
    if (totalSoFar + v.log.length !== envelopeSeq) {
      return `after merging I hold ${String(totalSoFar + v.log.length)} events but the hand is at seq ${String(envelopeSeq)}`;
    }
    // 算术核对放在**最后**一道：它会给"这一手"落一个基准，只允许对将被采纳的投影落笔。
    // 放在前面的话，一条只因 logShape 而被拒的投影也会顺手改掉基准 ⇒ 后面的帧拿着假基准比，
    // 误报会把"停手"这件事从"服务端确实越界"变成"我自己的状态机自己拧了"。
    return checkMoney(v);
  }

  function maybeSubmitNonce(h: number, missing: string[]): Up | null {
    if (seat < 0 || nonceForHand === h) return null;
    if (!missing.includes(partyOfSeat(seat))) return null;
    nonceForHand = h;
    myShare = options.entropy();
    return { t: 'nonce', hand: h, value: myShare };
  }

  return {
    hello(): Up {
      return { t: 'join', name, buyIn: options.buyIn };
    },
    // 断线重连：报上 token 与我看到的 hand/seq，由服务端决定补增量还是给快照。
    // 还没进过任何一手（hand=0）⇒ 没有可接续的局面，而且 hand=0 本身就是协议非法值：
    // 这时候必须返回 null，让上层去走一条全新的 join（webui/main.ts 的 resumeWire() ?? joinWire()）。
    resume(): Up | null {
      // hand=0 是"等待期重连"（hosted 流程还没开过局）：resume 的 hand 字段允许 0。
      // 不放行的话，等待期掉线只能重新 join ⇒ 旧座位变鬼影 + 多占一座（hosted 真机路径撞出来的）。
      return token === '' ? null : { t: 'resume', token, hand, since: seq };
    },
    // 换一桌重来（凭据被服务端判死之后重新入桌）：把"这一世的身份 + 本局份额"整份丢掉。
    // 不丢的话，恢复下来的 myShare 会顶着**上一桌**那份份额，对新的 collect 永远不再交份额
    // —— 两桌的局号都从 1 开始，于是房间一直卡在 collect（M5 真浏览器实测撞到的第二条路）。
    // 注意这里不清 violations：抓到服务端越界是审计事实，换桌不该把它抹掉（停手继续生效）。
    renew(): void {
      seat = -1;
      name = options.name;
      token = '';
      rules = null;
      roster = [];
      hand = 0;
      seq = 0;
      view = null;
      log = [];
      lastReject = null;
      myShare = null;
      nonceForHand = 0;
      verifiedHand = null;
      money = null; // 换一桌 ⇒ 算术基准跟着换手一起作废（同 enterHand）
      commitments.clear();
    },
    // rev=11 删掉了这里的一个 `ping(echo)` 助手：页面上行侧那条心跳从来没有任何调用点
    // （main.ts 不做保活调度，room/21 走的是"手工构造 {t:'ping'}"那条路）——
    // 留着它就是一个"看起来像能力"的死接口（rev=9 必修 2 同一判据）。协议里的 ping/pong 与房间的
    // 回显本身照旧：`protocol.ts` 的 UP_SPEC 仍声明 ping，room.ts 的回显路径由 room/21 钉着。
    // 唯一的行动入口：不轮到我、局面不明、或已经抓到服务端越界 ⇒ 一律不发
    act(move: Move): { up: Up | null; why: string | null } {
      if (violations.length > 0) return { up: null, why: `peer flagged the server: ${violations[0]}` };
      if (view === null) return { up: null, why: 'no view yet' };
      if (view.phase !== 'betting') return { up: null, why: `phase is ${view.phase}` };
      if (view.turn !== seat) return { up: null, why: `turn is seat ${String(view.turn)}, not ${String(seat)}` };
      if (move.kind === 'compare' && move.target === seat) return { up: null, why: 'cannot compare with self' };
      // 我这一下已经发出去了 ⇒ 上一条 reject 就成了历史：提示行只许陈述"当前"事实，
      // 否则第 1 手的 `stake_at_max` 会一直占着那一行到本世结束（rev=10 应修 4）。
      // 如果这一又会被拒，服务端会再送一条 reject 回来把它换上 —— 信息不丢，只是不再过期。
      lastReject = null;
      return { up: { t: 'action', hand, move }, why: null };
    },
    inbound(raw: string | Down): Up[] {
      let msg: Down;
      try {
        msg = typeof raw === 'string' ? checkDown(raw) : checkDown(JSON.stringify(raw));
      } catch (err) {
        violate(`server sent an unparseable message: ${err instanceof Error ? err.message : String(err)}`.slice(0, 400));
        return [];
      }
      const out: Up[] = [];
      switch (msg.t) {
        case 'hello': {
          seat = msg.seat;
          name = msg.name;
          token = msg.token;
          rules = msg.rules;
          roster = [...msg.seats].sort((a, b) => a.seat - b.seat);
          break;
        }
        case 'commit': {
          enterHand(msg.hand);
          if (msg.party !== SERVER_PARTY) violate(`a client party ${msg.party} appeared in a commit message`);
          else {
            // 承诺对每个 (hand, party) 只能写一次：收完份额之后再换一份承诺，
            // 就能配出一份自洽的假揭示 ⇒ "已核对"的记录被伪造（rev=8 复审必修 1）。
            // 同值重发要放过：断线补承诺是设计行为（room/17、ws/04 依赖它）。
            const seen = commitments.get(msg.party);
            if (seen === undefined) commitments.set(msg.party, msg.commit);
            else if (seen !== msg.commit) {
              violate(`server re-committed a different value for party ${msg.party} in hand ${String(msg.hand)}`);
            }
          }
          break;
        }
        case 'collect': {
          enterHand(msg.hand);
          // collect 里 committed/missing 说的是"谁交了份额"；服务端不在其中（它交的是承诺）。
          // 这里卡的是顺序：承诺没到手就不该交份额 —— 没有承诺，局末的揭示就无从核对。
          if (!commitments.has(SERVER_PARTY)) {
            violate('collect arrived before the server commitment');
            break;
          }
          const up = maybeSubmitNonce(msg.hand, msg.missing);
          if (up !== null) out.push(up);
          break;
        }
        case 'view': {
          enterHand(msg.hand);
          const why = checkView(msg.view, 1, msg.seq, 0);
          if (why !== null) violate(`snapshot unusable: ${why}`);
          else {
            view = msg.view;
            log = [...msg.view.log];
            seq = msg.seq;
          }
          break;
        }
        case 'patch': {
          if (msg.hand !== hand) violate(`patch for hand ${String(msg.hand)} while I am on ${String(hand)}`);
          else if (msg.since !== seq) violate(`patch claims I am at seq ${String(msg.since)}, I am at ${String(seq)}`);
          else {
            const why = checkView(msg.view, msg.since + 1, msg.seq, log.length);
            if (why !== null) violate(`patch unusable: ${why}`);
            else {
              view = msg.view;
              log = [...log, ...msg.view.log];
              seq = msg.seq;
            }
          }
          break;
        }
        case 'reveal': {
          if (msg.hand !== hand) violate(`reveal for hand ${String(msg.hand)}, not ${String(hand)}`);
          else {
            const iWasDealt = msg.shares.some((s) => s.party === partyOfSeat(seat));
            const iHoldTheCommit = commitments.has(SERVER_PARTY);
            if (!iWasDealt && !iHoldTheCommit) {
              // 中途才连上来的旁观者：这一局没参与、也没见过那一份承诺 ⇒ 无从核对，
              // 但这不是服务端越界（揭示的内容全是公开信息），所以只记账不报违规。
              break;
            }
            const serverCommit = commitments.get(SERVER_PARTY);
            const server = msg.shares.find((s) => s.party === SERVER_PARTY);
            const mine = msg.shares.find((s) => s.party === partyOfSeat(seat));
            const dealt = view !== null ? view.deal : null;
            let why: string | null = null;
            if (serverCommit === undefined) why = 'reveal arrived but the server never committed';
            else if (server === undefined) why = 'reveal is missing the server share';
            else if (commitOf(msg.hand, SERVER_PARTY, server.value) !== serverCommit) {
              why = 'server revealed a share that does not open its commitment';
            } else if (iWasDealt && (mine === undefined || mine.value !== myShare)) {
              why = 'my own share is not the one that was used';
            } else if (seedFromShares(msg.hand, msg.shares) !== msg.seed) {
              why = 'revealed shares do not synthesize the revealed seed';
            } else if (view !== null && view.phase !== 'settled') {
              why = `reveal arrived while the hand is still ${view.phase}`;
            } else if (view !== null && (dealt === null || dealt.seed !== msg.seed)) {
              why = 'revealed seed is not the seed the hand was dealt with';
            }
            if (why !== null) violate(`reveal check failed: ${why}`);
            else verifiedHand = msg.hand;
          }
          break;
        }
        case 'reject': {
          lastReject = { code: msg.code, why: msg.why };
          // 审计面只增不减：nui/20 钉的就是这两个面的分工
          rejects.push({ code: msg.code, why: msg.why });
          break;
        }
        case 'notice': {
          notices.push(msg.text);
          break;
        }
        case 'error': {
          errors.push({ code: msg.code, why: msg.why });
          // 服务端自己承认漏了牌 ⇒ 立刻停手；其它 error 是连接层的普通回执
          if (msg.code === 'leak_blocked') violate(`server blocked its own leak: ${msg.why}`);
          break;
        }
        case 'pong': {
          break;
        }
        case 'table': {
          // 纯状态面：无权威数字、无牌面 ⇒ 不进算术墙；schema 已在 checkDown 过了。
          // 覆盖式更新即可（table 每次都带全量桌况，不做增量合并）。
          table = { host: msg.host, ready: [...msg.ready], waiting: msg.waiting, playing: msg.playing };
          break;
        }
        default: {
          const exhausted: never = msg;
          violate(`unhandled downlink ${JSON.stringify(exhausted)}`);
        }
      }
      return out;
    },
    info(): PeerInfo {
      return {
        seat,
        name,
        token,
        hand,
        seq,
        phase: view === null ? 'none' : view.phase,
        logLen: log.length,
        violations: [...violations],
        errors: [...errors],
        notices: [...notices],
        lastReject,
        rejects: [...rejects],
        committed: [...commitments.keys()].sort(),
        verifiedHand,
        nonceSent: nonceForHand === hand && hand > 0,
        table,
      };
    },
    viewOf(): View | null {
      return view;
    },
    logOf(): Event[] {
      return [...log];
    },
    rulesOf(): Rules | null {
      return rules;
    },
    rosterOf(): Roster[] {
      return [...roster];
    },
    shareOf(): string | null {
      return myShare;
    },
  };
}

export type Peer = ReturnType<typeof createPeer>;
