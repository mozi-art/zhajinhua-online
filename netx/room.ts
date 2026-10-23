// M4 · 权威房间（服务端唯一写者）。
//
// 分工：src/engine 决定规则，本文件决定"谁在什么时候能说话"。客户端只能通过 netx/protocol.ts
// 的 5 条上行消息影响局面，且：
//   - 座位由连接绑定，上行里根本没有 seat 字段 ⇒ "替别人行动"在这套协议里无法表达；
//   - settle 与 timeout 两个 kind 不在上行 Move 里 ⇒ 只有服务端能结算、只有时钟能触发托管；
//   - 每一张下行投影都由 src/engine/project.ts 生成（别人的牌、未看牌前的自己的牌都是 unknown），
//     发出前再过一次 checkViewLeak；越界就整条不发并把房间标成 fault（宁可停桌也不漏牌）；
//   - 种子来自 netx/seed.ts 的多方 commit-reveal：先公布服务端份额的承诺，之后才收各家 nonce，
//     凑齐才合成 ⇒ 没有任何一方能在看到别人的选择之后再挑自己的值。
//
// 时钟与随机都从外面注入（工单 §2.5）：本文件不出现 Date / Math.random / setTimeout，
// 所以"超时托管""断线重连"在测试里是虚拟时钟驱动的字节级确定性断言。
import { presets } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import { startHand, logHash, stateHash } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { checkAction } from '../src/engine/validate.ts';
import { project } from '../src/engine/project.ts';
import type { Event } from '../src/engine/state.ts';
import type { View } from '../src/engine/project.ts';
import { nextDealerOf } from '../webmin/model.ts';
import type { PrevHand } from '../webmin/model.ts';
import { byCodepoint, commitOf, partyOfSeat, revealMatches, seedFromShares, SERVER_PARTY } from './seed.ts';
import type { Share } from './seed.ts';
import { checkUp, checkViewLeak, PROTOCOL_ID, toAction } from './protocol.ts';
import type { Down, NetRejectCode, Roster, Up } from './protocol.ts';
import { sha256Hex } from './sha256.ts';

// §1 全押行：最小买入 256×底注属房间层约束（引擎不管）。
export const MIN_BUY_IN_MULTIPLE = 256;

// 注入式时钟：房间层只排程、不读表 ⇒ 接口里只有 after()。
// rev=8 应修 4：原先带的 now() 在 netx/ 与 src/ 里没有任何调用点（只有测试夹具自己用），
// 留着只会让人怀疑这里在读真实时间。要核对到期时间请用 FakeClock.nextDue()。
export type Clock = {
  after(ms: number, fn: () => void): () => void;
};

export type RoomOptions = {
  rules?: Rules;
  seats: Roster[];
  firstDealer: number;
  clock: Clock;
  entropy: () => string;
  // §1 全押行把"最小买入 256×底注"划给房间层 ⇒ 这条门槛是可配置的旋钮，默认值就是 §1 的字面量。
  minBuyIn?: number | undefined;
  turnMs?: number | undefined;
  nonceMs?: number | undefined;
  settleMs?: number | undefined;
  handGapMs?: number | undefined;
};

export type HandPhase = 'collect' | 'betting' | 'awaitingSettle' | 'settled';

export type RoomInfo = {
  hand: number;
  phase: HandPhase | 'idle';
  seated: number[];
  missing: string[];
  seq: number;
  turn: number;
  dealer: number;
  pot: number;
  stake: number;
  chips: { seat: number; chips: number }[];
  connections: { id: string; seat: number | null }[];
  delivered: { seat: number; hand: number; seq: number }[];
  stateHash: string;
  logHash: string;
  fault: string | null;
  over: string | null;
};

type Conn = { id: string; seat: number | null; queue: Down[] };
type Mark = { hand: number; seq: number };

type Hand = {
  index: number;
  phase: HandPhase;
  dealer: number;
  seated: number[];
  serverShare: string;
  serverCommit: string;
  nonces: Map<string, string>;
  expected: string[];
  seed: number;
  state: GameState | null;
};

export function createRoom(options: RoomOptions) {
  const rules = options.rules ?? presets.classic;
  const clock = options.clock;
  const turnMs = options.turnMs ?? 30000;
  const nonceMs = options.nonceMs ?? 15000;
  const settleMs = options.settleMs ?? 4000;
  const handGapMs = options.handGapMs ?? 6000;
  const minBuyIn = options.minBuyIn ?? rules.ante * MIN_BUY_IN_MULTIPLE;
  const roster = [...options.seats].sort((a, b) => a.seat - b.seat);
  if (roster.length < rules.players.min || roster.length > rules.players.max) {
    throw new TypeError(`room needs ${String(rules.players.min)}..${String(rules.players.max)} seats, got ${String(roster.length)}`);
  }
  for (const r of roster) {
    if (!Number.isInteger(r.seat) || r.seat < 0) throw new TypeError(`bad seat ${String(r.seat)}`);
    if (r.name.length < 1 || r.name.length > 24) throw new TypeError(`bad name for seat ${String(r.seat)}`);
  }
  if (!roster.some((r) => r.seat === options.firstDealer)) {
    throw new TypeError(`firstDealer ${String(options.firstDealer)} is not a seat of this room`);
  }

  const conns = new Map<string, Conn>();
  const tokens = new Map<string, number>(); // token → seat
  const seatToken = new Map<number, string>();
  const joined = new Set<number>();
  const connected = new Set<number>();
  const chips = new Map<number, number>();
  const names = new Map<number, string>(roster.map((r) => [r.seat, r.name]));
  const delivered = new Map<number, Mark>();

  let hand: Hand | null = null;
  let prev: PrevHand | null = null;
  let nextHandIndex = 1;
  let fault: string | null = null;
  let over: string | null = null;
  let started = false;
  let disposed = false;
  let turnCancel: (() => void) | null = null;
  let nonceCancel: (() => void) | null = null;
  let settleCancel: (() => void) | null = null;
  let gapCancel: (() => void) | null = null;

  function drop(c: (() => void) | null): void {
    if (c !== null) c();
  }

  function queue(seat: number, msgs: Down[]): void {
    for (const c of conns.values()) {
      if (c.seat === seat) for (const m of msgs) c.queue.push(m);
    }
  }

  function eachConnected(fn: (seat: number) => void): void {
    for (const seat of [...connected].sort((a, b) => a - b)) fn(seat);
  }

  function broadcast(msgs: Down[]): void {
    eachConnected((seat) => queue(seat, msgs));
  }

  function note(text: string): void {
    broadcast([{ t: 'notice', text: text.slice(0, 600) }]);
  }

  function missingParties(h: Hand): string[] {
    return h.expected.filter((p) => !h.nonces.has(p)).sort(byCodepoint);
  }

  function shareSet(h: Hand): Share[] {
    const all: Share[] = [{ party: SERVER_PARTY, value: h.serverShare }];
    for (const p of [...h.nonces.keys()].sort(byCodepoint)) all.push({ party: p, value: h.nonces.get(p) as string });
    return all;
  }

  // —— 投影出口：先过防泄漏自检，越界就不发 ——
  function viewFor(seat: number, state: GameState, logSlice: Event[] | null): View | null {
    const base = project(state, seat);
    const view: View = logSlice === null ? base : { ...base, log: logSlice };
    const why = checkViewLeak(view, seat);
    if (why !== null) {
      fault = `egress blocked for seat ${String(seat)}: ${why}`;
      queue(seat, [{ t: 'error', code: 'leak_blocked', why }]);
      return null;
    }
    return view;
  }

  // 同一局内且 seq 追得上 ⇒ 只补增量（patch，view.log 里是 (since, seq] 这一段）；
  // 否则给整份快照（view，view.log 是本局全部）。两条路都有用例。
  function deliverView(seat: number, state: GameState): void {
    const h = hand;
    if (h === null) return;
    const mark = delivered.get(seat);
    const since = mark !== undefined && mark.hand === h.index && mark.seq <= state.seq ? mark.seq : null;
    const log = since === null ? state.log : state.log.filter((e) => e.seq > since);
    const view = viewFor(seat, state, log);
    if (view === null) return;
    if (since === null) queue(seat, [{ t: 'view', hand: h.index, seq: state.seq, view }]);
    else queue(seat, [{ t: 'patch', hand: h.index, since, seq: state.seq, view }]);
    delivered.set(seat, { hand: h.index, seq: state.seq });
  }

  function publish(state: GameState): void {
    eachConnected((seat) => deliverView(seat, state));
  }

  function rejectSeat(seat: number, handIndex: number, code: NetRejectCode, why: string): void {
    queue(seat, [{ t: 'reject', hand: handIndex, code, why: why.slice(0, 400) }]);
  }

  // 局外的拒绝（压根没有在进行的一局）不能用 reject 表达 —— reject 的 hand 必须是真的局号
  function errorTo(seat: number, code: string, why: string): void {
    queue(seat, [{ t: 'error', code, why }]);
  }

  function armTurnTimer(state: GameState): void {
    drop(turnCancel);
    turnCancel = null;
    if (hand === null || hand.phase !== 'betting') return;
    const seat = state.turn;
    turnCancel = clock.after(turnMs, () => {
      turnCancel = null;
      const h = hand;
      if (h === null || h.phase !== 'betting' || h.state === null) return;
      if (h.state.turn !== seat) return;
      step({ kind: 'timeout', seat });
    });
  }

  function sendCollect(h: Hand): void {
    broadcast([
      { t: 'commit', hand: h.index, party: SERVER_PARTY, commit: h.serverCommit },
      { t: 'collect', hand: h.index, committed: [...h.nonces.keys()].sort(byCodepoint), missing: missingParties(h) },
    ]);
  }

  function beginHand(): void {
    drop(gapCancel);
    gapCancel = null;
    if (disposed || fault !== null || over !== null) return;
    const eligible = roster
      .map((r) => r.seat)
      .filter((s) => joined.has(s) && (chips.get(s) ?? 0) >= rules.ante)
      .sort((a, b) => a - b);
    if (eligible.length < rules.players.min) {
      over = `只剩 ${String(eligible.length)} 家付得起底注 ${String(rules.ante)}（最少 ${String(rules.players.min)} 家），房间收桌`;
      note(over);
      return;
    }
    let dealer = options.firstDealer;
    if (prev !== null) dealer = nextDealerOf(rules.dealer.next, prev, eligible) ?? (eligible[0] as number);
    // 首选庄家不在席（第一手且 firstDealer 没入座 / 那一家付不起底注）⇒ 用同一条确定性规则挪位，
    // 与 onNonceDeadline 共用 dealerAmong，不在两处写两遍
    dealer = dealerAmong(eligible, dealer);
    const index = nextHandIndex;
    nextHandIndex += 1;
    const serverShare = options.entropy();
    const h: Hand = {
      index,
      phase: 'collect',
      dealer,
      seated: eligible,
      serverShare,
      serverCommit: commitOf(index, SERVER_PARTY, serverShare),
      nonces: new Map<string, string>(),
      expected: eligible.map((s) => partyOfSeat(s)).sort(byCodepoint),
      seed: 0,
      state: null,
    };
    hand = h;
    for (const seat of connected) delivered.delete(seat);
    sendCollect(h);
    drop(nonceCancel);
    nonceCancel = clock.after(nonceMs, () => onNonceDeadline(index));
  }

  // 庄家位必须落在"本局真的在桌"的那几家手里。
  // 起这个名字而不是就地写 if：beginHand 与 onNonceDeadline 两条路都要用它，两处写两遍就会漂移。
  // 规则是确定性的：preferred 在席就仍用它；否则取它之后（座位号更大）的第一家在席者，绕回最小的一家。
  // 必要性（M5 真浏览器实测抓到的崩溃）：份额到点没齐时 onNonceDeadline 会把缺席的那几家剔出本局，
  // 若被剔的正好是庄家，h.dealer 就成了一个不在 seats 里的号 ⇒ startHand 抛 TypeError ⇒
  // 抛出点在注入时钟的回调里，没人接，整个房间进程当场退出。挪一下庄家就开得了。
  function dealerAmong(seats: number[], preferred: number): number {
    if (seats.length === 0) return preferred;
    const forward = seats.filter((s) => s >= preferred);
    return (forward[0] ?? (seats[0] as number)) as number;
  }

  // 没交份额的这一家这局不参与（筹码原地不动）；凑不齐最低人数就继续等。
  function onNonceDeadline(index: number): void {
    const h = hand;
    if (h === null || h.index !== index || h.phase !== 'collect') return;
    const missing = missingParties(h);
    if (missing.length === 0) return;
    const left = h.seated.filter((s) => h.nonces.has(partyOfSeat(s)));
    note(`${missing.join('、')} 没在 ${String(nonceMs)}ms 内提交份额，这一局不带它`);
    if (left.length < rules.players.min) {
      hand = null;
      gapCancel = clock.after(handGapMs, beginHand);
      note(`能开局的人不够（${String(left.length)} < ${String(rules.players.min)}），房间继续等待`);
      return;
    }
    // 庄家可能正是被剔掉的那一座 ⇒ 必须在发牌之前挪到还在桌的那一家（见 dealerAmong）
    const moved = h.dealer;
    h.dealer = dealerAmong(left, h.dealer);
    if (moved !== h.dealer) note(`庄家座位 ${String(moved)} 没交份额，本局庄家挪到座位 ${String(h.dealer)}`);
    h.seated = left;
    // 这里直接发牌，不再"重新武装 nonce 定时器"（rev=8 必修 2 删的就是那两行）。
    // 口径按 rev=9 复审的 Z5 实测改准：那两行的**回调体**确实够不到（onNonceDeadline 开头的
    // `h.phase !== 'collect'` 守卫会直接 return），但"重武装"这个动作本身是可观测的 ——
    // 它会留下一只多余的定时器（room/25 ④ 的 pending()===1 就守着这个）。删掉它是消除泄漏，不是消除死分支。
    h.expected = left.map((s) => partyOfSeat(s)).sort(byCodepoint);
    sendCollect(h);
    drop(nonceCancel);
    nonceCancel = null;
    deal(h);
  }

  function deal(h: Hand): void {
    const shares = shareSet(h);
    const seed = seedFromShares(h.index, shares);
    const state = startHand({
      rules,
      seed,
      dealer: h.dealer,
      seats: h.seated.map((s) => ({ seat: s, chips: chips.get(s) ?? 0 })),
    });
    h.seed = seed;
    h.state = state;
    h.phase = 'betting';
    publish(state);
    armTurnTimer(state);
  }

  function revealMsg(h: Hand): Down | null {
    const shares = shareSet(h);
    // 只有服务端份额带承诺（各家 nonce 是明文交给服务端的，见 §4 M4 的流程），
    // 所以自检查 = "我的承诺打得开" + "全部份额合成出当时发牌用的那颗种子"。
    const why = revealMatches(h.index, [{ party: SERVER_PARTY, commit: h.serverCommit }], [
      { party: SERVER_PARTY, value: h.serverShare },
    ]);
    if (why !== null) {
      fault = `reveal self-check failed: ${why}`;
      return null;
    }
    if (seedFromShares(h.index, shares) !== h.seed) {
      fault = 'reveal self-check failed: revealed shares no longer synthesize the seed that was dealt';
      return null;
    }
    return { t: 'reveal', hand: h.index, seed: h.seed, shares };
  }

  function closeLedger(h: Hand, state: GameState): void {
    for (const s of state.seats) chips.set(s.seat, s.chips);
    const terminal = state.terminal;
    prev = {
      dealer: h.dealer,
      seats: [...h.seated].sort((a, b) => a - b),
      winners: terminal?.winners ?? [],
      remainderTo: terminal !== null && terminal.remainderTo >= 0 ? terminal.remainderTo : null,
    };
  }

  // 服务端专属推进：所有行动都走引擎的 checkAction，不允许绕过
  function step(action: Action): void {
    const h = hand;
    if (h === null || h.state === null) return;
    const verdict = checkAction(h.state, action);
    if (!verdict.ok) {
      fault = fault ?? `authoritative engine rejected its own action: ${verdict.code}`;
      return;
    }
    const next = apply(h.state, action);
    h.state = next;
    if (next.phase === 'awaitingSettle') {
      h.phase = 'awaitingSettle';
      drop(turnCancel);
      turnCancel = null;
      publish(next);
      drop(settleCancel);
      settleCancel = clock.after(settleMs, () => settleNow(h.index));
      return;
    }
    if (next.phase === 'settled') {
      h.phase = 'settled';
      closeLedger(h, next);
      publish(next);
      const msg = revealMsg(h);
      if (msg !== null) broadcast([msg]);
      drop(gapCancel);
      gapCancel = clock.after(handGapMs, beginHand);
      return;
    }
    publish(next);
    armTurnTimer(next);
  }

  function settleNow(index: number): void {
    const h = hand;
    if (h === null || h.index !== index || h.phase !== 'awaitingSettle') return;
    step({ kind: 'settle' });
  }

  function helloFor(seat: number): Down {
    const seats: Roster[] = roster
      .filter((r) => joined.has(r.seat))
      .sort((a, b) => a.seat - b.seat)
      .map((r) => ({ seat: r.seat, name: names.get(r.seat) ?? r.name }));
    return {
      t: 'hello',
      protocol: PROTOCOL_ID,
      token: seatToken.get(seat) ?? '',
      seat,
      name: names.get(seat) ?? '',
      rules,
      seats,
    };
  }

  // 落后太多的重连走快照，能对上 seq 的走增量 —— 两条路都有用例。
  // 无论哪条，都先把本局的承诺补上：中途才连上（或掉线期间开局）的那一家
  // 如果没拿到承诺，局末的揭示就无从核对。
  // 若这一局已经在它缺席时结算完了，连揭示也一并补发 —— 审计材料不能因为断线就丢掉。
  function catchup(seat: number): void {
    const h = hand;
    if (h === null) return;
    queue(seat, [
      { t: 'commit', hand: h.index, party: SERVER_PARTY, commit: h.serverCommit },
      { t: 'collect', hand: h.index, committed: [...h.nonces.keys()].sort(byCodepoint), missing: missingParties(h) },
    ]);
    if (h.state === null) return;
    deliverView(seat, h.state);
    if (h.phase === 'settled') {
      const msg = revealMsg(h);
      if (msg !== null) queue(seat, [msg]);
    }
  }

  // 名册变了就要让大家重新看见彼此：给每个在座连接重发它自己的那份 hello（含 seat/token/名册）。
  // `skip` 是刚收到过 hello 的那一位（入座的回答里已经带了一份，不重复发）。
  function refreshRosters(skip: number): void {
    eachConnected((seat) => {
      if (seat === skip) return;
      queue(seat, [helloFor(seat)]);
    });
  }

  function join(id: string, up: Extract<Up, { t: 'join' }>): void {
    const c = conns.get(id);
    if (c === undefined) return;
    if (c.seat !== null) {
      c.queue.push({ t: 'error', code: 'already_joined', why: 'this connection already holds a seat' });
      return;
    }
    if (up.buyIn < minBuyIn) {
      c.queue.push({
        t: 'error',
        code: 'buy_in_too_low',
        why: `room minimum buy-in is ${String(minBuyIn)}`,
      });
      return;
    }
    const taken = new Set<number>(joined);
    for (const other of conns.values()) if (other.seat !== null) taken.add(other.seat);
    const free = roster.map((r) => r.seat).find((s) => !taken.has(s));
    if (free === undefined) {
      c.queue.push({ t: 'error', code: 'room_full', why: 'no free seat' });
      return;
    }
    c.seat = free;
    joined.add(free);
    names.set(free, up.name);
    chips.set(free, up.buyIn);
    connected.add(free);
    const token = sha256Hex(`${options.entropy()}|seat=${String(free)}`).slice(0, 40);
    tokens.set(token, free);
    seatToken.set(free, token);
    queue(free, [helloFor(free)]);
    catchup(free);
    refreshRosters(free);
    note(`${up.name} 坐到 ${String(free)} 号位，带入 ${String(up.buyIn)}`);
    if (started && hand === null && joined.size >= rules.players.min) beginHand();
  }

  function resume(id: string, up: Extract<Up, { t: 'resume' }>): void {
    const c = conns.get(id);
    if (c === undefined) return;
    const seat = tokens.get(up.token);
    if (seat === undefined) {
      c.queue.push({ t: 'error', code: 'bad_token', why: 'unknown resume token' });
      return;
    }
    if (c.seat !== null && c.seat !== seat) {
      c.queue.push({ t: 'error', code: 'token_seat_mismatch', why: 'this connection already holds another seat' });
      return;
    }
    for (const other of conns.values()) {
      if (other !== c && other.seat === seat) {
        queue(seat, [{ t: 'error', code: 'replaced', why: 'another connection took over this seat' }]);
        other.seat = null;
      }
    }
    c.seat = seat;
    connected.add(seat);
    const h = hand;
    if (h !== null && h.state !== null && up.hand === h.index && up.since <= h.state.seq) {
      delivered.set(seat, { hand: up.hand, seq: up.since }); // 增量补发
    } else {
      delivered.delete(seat); // 说不清自己看到哪儿 ⇒ 快照
    }
    queue(seat, [helloFor(seat)]);
    catchup(seat);
    // 名字要让大家互相看得见：hello 里的 seats 是"当前已入座名册"，只在各自入座那一刻发过一次 ⇒
    // 后入座的那一位对先入座的人来说永远是"座位N"。M5 接 UI 之后这是显眼的缺陷（座位板上印不出队友的
    // 名字，日志里的"→ 座位1"也读不出是谁），所以每次有人入座/重连，给在场的每一家重发一次自己的 hello。
    // 语义不变（同一条消息、同一份 schema），客户端处理 hello 是幂等的：seat/token 自己那份原样回来。
    refreshRosters(seat);
    // 原来印的是「甲 号位重连」：有名字时座位号整个丢了（rev=10 复审应修 6 的 nit）。
    note(`${String(seat)} 号位（${names.get(seat) ?? '匿名'}）重连（hand=${String(up.hand)}, since=${String(up.since)}）`);
  }

  function handleNonce(seat: number, up: Extract<Up, { t: 'nonce' }>): void {
    const h = hand;
    if (h === null) {
      errorTo(seat, 'not_dealt', 'no hand in progress');
      return;
    }
    if (h.phase !== 'collect') {
      rejectSeat(seat, h.index, 'nonce_late', `no seed to contribute in phase ${h.phase}`);
      return;
    }
    if (up.hand !== h.index) {
      rejectSeat(seat, h.index, 'bad_hand', `current hand is ${String(h.index)}`);
      return;
    }
    const party = partyOfSeat(seat);
    if (!h.expected.includes(party)) {
      rejectSeat(seat, h.index, 'no_seat', `${party} is not dealt into this hand`);
      return;
    }
    if (h.nonces.has(party)) {
      rejectSeat(seat, h.index, 'bad_nonce', `${party} already contributed a share`);
      return;
    }
    h.nonces.set(party, up.value);
    sendCollect(h);
    if (missingParties(h).length === 0) {
      drop(nonceCancel);
      nonceCancel = null;
      deal(h);
    }
  }

  function handleAction(seat: number, up: Extract<Up, { t: 'action' }>): void {
    const h = hand;
    if (h === null) {
      errorTo(seat, 'not_dealt', 'no hand in progress');
      return;
    }
    if (up.hand !== h.index) {
      rejectSeat(seat, h.index, 'bad_hand', `current hand is ${String(h.index)}, message says ${String(up.hand)}`);
      return;
    }
    if (h.state === null || h.phase !== 'betting') {
      rejectSeat(seat, h.index, 'not_dealt', `hand ${String(h.index)} is in phase ${h.phase}`);
      return;
    }
    const action = toAction(up.move, seat); // 座位只来自连接绑定
    const verdict = checkAction(h.state, action);
    if (!verdict.ok) {
      queue(seat, [{ t: 'reject', hand: h.index, code: verdict.code, why: verdict.why }]);
      return;
    }
    step(action);
  }

  return {
    start(): void {
      started = true;
      if (hand === null && joined.size >= rules.players.min) beginHand();
    },
    open(id: string): void {
      if (conns.has(id)) throw new TypeError(`dup connection id ${id}`);
      conns.set(id, { id, seat: null, queue: [] });
    },
    close(id: string): void {
      const c = conns.get(id);
      if (c === undefined) return;
      if (c.seat !== null) connected.delete(c.seat);
      conns.delete(id);
    },
    receive(id: string, up: Up): void {
      const c = conns.get(id);
      if (c === undefined) return;
      if (up.t === 'join') {
        join(id, up);
        return;
      }
      if (up.t === 'resume') {
        resume(id, up);
        return;
      }
      if (c.seat === null) {
        c.queue.push({ t: 'error', code: 'no_seat', why: 'join or resume first' });
        return;
      }
      const seat = c.seat;
      if (up.t === 'ping') {
        c.queue.push({ t: 'pong', echo: up.echo });
        return;
      }
      if (up.t === 'nonce') {
        handleNonce(seat, up);
        return;
      }
      if (up.t === 'action') {
        handleAction(seat, up);
        return;
      }
      const exhausted: never = up;
      void exhausted;
    },
    // 收一串线上文本：协议错误按连接回一条 error 并丢弃（绝不部分生效）
    receiveText(id: string, text: string): void {
      let up: Up;
      try {
        up = checkUp(text);
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        const c = conns.get(id);
        if (c !== undefined) c.queue.push({ t: 'error', code: 'bad_message', why: why.slice(0, 400) });
        return;
      }
      this.receive(id, up);
    },
    pending(id: string): Down[] {
      const c = conns.get(id);
      if (c === undefined) return [];
      const out = c.queue;
      c.queue = [];
      return out;
    },
    // 关掉调度：真实服务端退出时若留着定时器，进程就永远收不了尾
    dispose(): void {
      disposed = true;
      drop(turnCancel);
      drop(nonceCancel);
      drop(settleCancel);
      drop(gapCancel);
      turnCancel = null;
      nonceCancel = null;
      settleCancel = null;
      gapCancel = null;
    },
    info(): RoomInfo {
      const state = hand?.state ?? null;
      return {
        hand: hand?.index ?? 0,
        phase: hand?.phase ?? 'idle',
        seated: hand === null ? [] : [...hand.seated].sort((a, b) => a - b),
        missing: hand === null ? [] : missingParties(hand),
        seq: state?.seq ?? 0,
        turn: state?.turn ?? -2,
        dealer: hand?.dealer ?? -1,
        pot: state?.pot ?? 0,
        stake: state?.stake ?? 0,
        chips: [...chips.entries()].sort((a, b) => a[0] - b[0]).map(([seat, n]) => ({ seat, chips: n })),
        connections: [...conns.values()]
          // 与 seed.ts 的定序同一把尺：码点序，不受 locale/ICU 影响（rev=8 应修 5）
          .sort((a, b) => byCodepoint(a.id, b.id))
          .map((c) => ({ id: c.id, seat: c.seat })),
        delivered: [...delivered.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([seat, m]) => ({ seat, hand: m.hand, seq: m.seq })),
        stateHash: state === null ? '' : stateHash(state),
        logHash: state === null ? '' : logHash(state),
        fault,
        over,
      };
    },
    // 只给测试：直接看某一座的投影（与出口同一道自检）
    peek(seat: number): View | null {
      const state = hand?.state ?? null;
      if (state === null) return null;
      return viewFor(seat, state, null);
    },
  };
}

export type Room = ReturnType<typeof createRoom>;
