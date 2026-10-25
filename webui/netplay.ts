// M5 · 联机会话层：把 netx/client.ts 那个"不信任服务端"的会话翻译成 M3 渲染层要的 Snapshot。
//
// 这一层存在的唯一理由是：**浏览器侧的越界检查必须与测试里那道墙是同一份代码**。
// 所以本文件不实现任何协议细节 —— 下行一律交给 netx/client.ts 的 peer.inbound（里面是 checkDown 的
// schema 校验 + checkViewLeak 的投影自检 + 揭示三连核对），上行一律经 netx/protocol.ts 的 encodeUp
// 出口校验。这里只做"视图 → 文案"。第二份协议实现 = 第二套越界检查 = 必然漂移
// （工单 §4 M5 把这条按 §5 禁令同级处理），nui/02 把它钉成静态断言。
//
// 口径落点（工单 §4 M5）：
//   · UI 只渲染 + 发意图：不 import 引擎的 legalActions / actionCost / callPrice。按钮的"能不能点"
//     只看服务端给的两个字段（phase、turn），能不能真做成由服务端 reject 决定（nui/09 断言 cost 恒 null）。
//   · 信息来源只有投影：只读 peer.viewOf()/logOf()/info()，所以未看牌的本人牌与别家牌在这里天然是
//     'unknown'，序列化后不可能出现牌面（nui/04 负向断言）。
//   · violations 产品化：一旦被那道墙抓住，本层立刻把所有按钮换成"已停手"，且 act() 发不出东西
//     （停手本身由 client.ts 实现，这里只负责让它可见 —— nui/05）。
//   · 可移植层：零 node:、零 DOM、零时钟、零随机。socket 与"每标签页存储"都是注入进来的端口。
import { createPeer } from '../netx/client.ts';
import type { Peer } from '../netx/client.ts';
import { encodeUp, normalizeRoomCode, PROTOCOL_ID, ROOM_CODE_ALPHABET } from '../netx/protocol.ts';
import type { Move, Up } from '../netx/protocol.ts';
// 房间码的定义与校验出自 netx/protocol.ts（服务端路由用同一份）；在这里转口给本目录的
// lobby.ts 用 —— nst/04 钉着"页面侧只有本文件一个 netx 进口"，大厅不许自己再开一条。
export { normalizeRoomCode, ROOM_CODE_ALPHABET };
import { classify } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { priceOf } from '../src/engine/state.ts';
import type { ActionKind, Event } from '../src/engine/state.ts';
import type { Rules } from '../src/rules.ts';
import {
  DEALER_NEXT_LABELS,
  handAscii,
  handText,
  logLineOf,
  reasonLabel,
  tierName,
} from '../webmin/model.ts';
import type { ButtonOption, Intent, SeatCell } from '../webmin/model.ts';
import type { Snapshot } from './bridge.ts';

export type Link = 'idle' | 'open' | 'closed';

// 页面侧唯一允许知道的协议标识：由 netplay 转手，main.ts 不 import netx/protocol.ts
// （nst/04 把"webui 里只有 netplay.ts 一个 netx 进口"钉死了，多一条就是第二道墙的苗头）。
export const WIRE_SUBPROTOCOL = PROTOCOL_ID;

// —— 默认房间地址推导（M6）——
// 从"页面自己的位置 + ?room= 房间码"推默认 ws 地址。校验用 normalizeRoomCode：query 里的码
// 不合法就当没带（退回普通 / 地址），合法才拼 /r/CODE —— 页面侧与服务端路由是同一个定义，
// 不会出现"页面拼了个 /r/ab0e、服务端当非法路径拒掉"的缝。
// 端口兜底从 main.ts **传进来**而不是写死在这里：srv/05 钉着 main.ts 里必须有那个默认端口的
// 字面量（'8790'）—— 字面量留在入口文件、推导逻辑留在可测的这层，两边的钉子都不松。
// hostname 兜底只为 file:// 那种没有 hostname 的打开方式。
export function roomUrlFrom(base: { hostname: string; port: string }, query: string, fallbackPort: string): string {
  const host = base.hostname === '' ? '127.0.0.1' : base.hostname;
  const port = base.port === '' ? fallbackPort : base.port;
  const code = normalizeRoomCode((new URLSearchParams(query).get('room') ?? '').trim());
  return code === null ? `ws://${host}:${port}` : `ws://${host}:${port}/r/${code}`;
}

// 渲染层递回来的一个"意图"要能变成协议里的一个"动作"。单机那套 Intent 里还有 settle / nextHand /
// reset 三种是页面自己推进用的，联机模式下没有对应消息（结算权在服务器），所以这里收窄：
// 认不出来的一律返回 null，由上层把"这一击没发出去"显示出来，而不是悄悄当成 call。
export function toMove(intent: Intent): Move | null {
  switch (intent.kind) {
    case 'look':
    case 'call':
    case 'raise':
    case 'fold':
      return { kind: intent.kind };
    case 'compare':
      return { kind: 'compare', target: intent.target };
    default:
      return null;
  }
}

// 注入的"每标签页存储"端口。浏览器侧必须传 **sessionStorage**（每个标签页一份），
// 绝不能传 localStorage（全局键）：同一浏览器开两个标签页会互相顶掉 token，第二个 join 就把
// 第一个的凭据覆盖了 —— 工单 §4 M5 专门点了这条，nui/07 用"共享存储会串味"的对照把它钉住。
export type Store = {
  get(key: string): string | null;
  set(key: string, value: string): void;
  del(key: string): void;
};

export type NetOptions = {
  name: string;
  buyIn: number;
  entropy: () => string;
  store: Store;
  // 同一标签页里如果要开第二桌，换个前缀即可；默认同一页就一桌
  storeKey?: string | undefined;
};

export type Reject = { code: string; why: string };

export type NetInfo = {
  link: Link;
  seat: number;
  name: string;
  hand: number;
  seq: number;
  phase: string;
  untrusted: boolean;
  trustLines: string[];
  verifiedHand: number | null;
  lastReject: Reject | null;
  errors: Reject[];
  notices: string[];
  hasToken: boolean;
  // 服务端不认这份凭据（房间重启过、token 已过期、或座位已被别的连接占着）⇒ 上层应当改走 join。
  // 不在这里直接 join 是因为"发什么上行"归传输层（main.ts）决定，本层只负责把这件事说清楚。
  staleToken: boolean;
  // hosted 桌况（table 下行的直读；auto 房间 = 零值）
  hostSeat: number;
  readySeats: number[];
  waiting: boolean;
  // 桌务操作的最新一条回执（not_host/not_ready/begin_late/flow_off/begin_ignored）。
  // 这些拒绝在等待期走的是 error 而不是 reject，而提示行原本只吃 lastReject —— 不补这一路，
  // 玩家点「准备/开始」会"点了没反应"（复审点名的 UX 死点）。
  tableError: Reject | null;
};

type Saved = {
  token: string;
  seat: number;
  name: string;
  hand: number;
  share: string | null;
};

function savedKey(prefix: string): string {
  return `${prefix}:session`;
}

// Q7 裁定 = B（2026-10-01）：**停手是标签页级的，不是会话级的**。
// 成因不是服务端掐线（那条路复用同一个 peer，本来就洗不掉），而是玩家最自然的那两个点击：
// 「断开」→「连接」在 main.ts 里新建一个 peer，`violations` 随旧 peer 一起丢，警告就这么被抹掉，
// 而且复位时页面一句话都不说。工单那句承诺的主语是**页面**，玩家看见的是标签页 ⇒ 判定结果
// 必须活过断开重连 / 刷新 / 换房间 URL / 单机↔联机切换，**只有关闭本标签页才解除**。
// 走的是同一个 `Store` 端口（浏览器侧 = sessionStorage，nui/07 钉着不许 localStorage），
// 与凭据同一个 prefix 机制；**不按 ws URL 分键**（裁定明确不做 endpoint 级隔离：页面本身由同一
// origin 下发，"哪个 endpoint 是诚实的"在威胁模型里本身就不可信）。
function untrustedKey(prefix: string): string {
  return `${prefix}:untrusted`;
}

type Untrusted = {
  // 本标签页累计停手次数：同一会话内只记一次，新会话再被抓才递增
  count: number;
  // 首条越界原文 —— 递增时**不变**，玩家永远看得见"最初是哪一条判的"
  first: string;
  // 首次停手的手号
  hand: number;
};

function readUntrusted(store: Store, prefix: string): Untrusted | null {
  const raw = store.get(untrustedKey(prefix));
  if (raw === null || raw === '') return null;
  try {
    const v = JSON.parse(raw) as Partial<Untrusted>;
    // 读不出一个形状正确的记录就当作"没有"——与 readSaved 同一降级口径（坏存储不许凭空造出停手，
    // 也不许把整页搞崩）；反过来，只要读得出来，就**一律停手**，判据不掺猜测。
    if (typeof v.first !== 'string' || v.first === '') return null;
    if (typeof v.count !== 'number' || !Number.isInteger(v.count) || v.count < 1) return null;
    if (typeof v.hand !== 'number') return null;
    return { count: v.count, first: v.first, hand: v.hand };
  } catch {
    return null;
  }
}

function readSaved(store: Store, prefix: string): Saved | null {
  const raw = store.get(savedKey(prefix));
  if (raw === null || raw === '') return null;
  try {
    const v = JSON.parse(raw) as Partial<Saved>;
    if (typeof v.token !== 'string' || v.token === '') return null;
    if (typeof v.seat !== 'number' || typeof v.hand !== 'number') return null;
    return {
      token: v.token,
      seat: v.seat,
      name: typeof v.name === 'string' ? v.name : '',
      hand: v.hand,
      share: typeof v.share === 'string' ? v.share : null,
    };
  } catch {
    return null;
  }
}

export function createNet(options: NetOptions) {
  const prefix = options.storeKey ?? 'zjh-m5';
  const saved = readSaved(options.store, prefix);
  const peer: Peer = createPeer({
    // 刷新回来的这一页沿用它自己的旧身份，不重新取一个名字 —— 名字是 hello 里服务端给的
    name: saved !== null && saved.name !== '' ? saved.name : options.name,
    buyIn: options.buyIn,
    entropy: options.entropy,
    restore: saved === null ? undefined : { token: saved.token, seat: saved.seat, name: saved.name, hand: saved.hand, share: saved.share },
  });
  // 存储里有没有凭据不改变"这一页此刻还没连上"这个事实（rev=10 复审应修 6 的 nit：原来写的是
  // `saved !== null ? 'idle' : 'idle'` 这种两支相同的死条件）。真正的连接态由 markOpen/markClosed 推。
  let link: Link = 'idle';
  // **读取先于首帧**：粘性停手在 `createNet` 这一刻就成立，不等任何一条下行进来 ⇒
  // 断开重连后的第一帧还没到，页面已经是停手态（裁定要求的正是这个先后）。
  let sticky: Untrusted | null = readUntrusted(options.store, prefix);
  // 本会话是否已经把它记进过标签页账：**每一世都从 false 起算**，只有本世第一次被抓才计数。
  // 于是"继承来的停手但这一世没再被抓" ⇒ 账不变（幂等，重连一百次也不会自己涨）；
  // "这一世又被抓到" ⇒ count + 1，而 `first` 永远是当年那一条（裁定 ⑦）。
  let stickyRecorded = false;
  // 服务端承认漏牌 / 被顶号：这两类 error 要"可区分的可见反馈"（工单 §4 M5），所以单独记
  let leakBlocked: Reject | null = null;
  let replaced: Reject | null = null;
  // 凭据作废（房间重启后 token 不认识、或座位已被别的连接拿着）：真浏览器实测抓到的那条路 ——
  // 页面此前会停在"已连接但一条下行都没有"，既不回落成 join，也不说为什么。
  let staleToken: Reject | null = null;
  // 被服务端判死的那一份 token：只有拿到**另一份**凭据（新 hello）才算这件事翻篇
  let staleDeadToken = '';
  // "这一条下行之后必须补一次全新入桌"——只允许被同一条下行触发一次，否则 hello 没回来就会反复重入桌
  let stalePendingJoin = false;
  let staleAutoJoined = false;
  // 桌务回执：局外拒绝走 error（reject 的 hand 必须是真的局号），从 errors 流里挑这几个码
  const TABLE_ERROR_CODES = new Set(['not_host', 'not_ready', 'begin_late', 'flow_off', 'begin_ignored']);
  let tableError: Reject | null = null;

  function persist(): void {
    // 凭据刚被服务端判死 ⇒ 这一份不许再写回存储：onText 里先 del 后 persist，
    // 少这一道闸的话作废的 token 会被自己续上命，刷新一次就重蹈一次（nui/18 抓到）。
    if (staleToken !== null) return;
    const info = peer.info();
    if (info.token === '') return;
    const rec: Saved = {
      token: info.token,
      seat: info.seat,
      name: info.name,
      hand: info.hand,
      share: peer.shareOf(),
    };
    options.store.set(savedKey(prefix), JSON.stringify(rec));
  }

  function nameOfSeat(seat: number): string {
    const info = peer.info();
    if (seat < 0) return '—';
    if (seat === info.seat) return info.name === '' ? '你' : info.name;
    const row = peer.rosterOf().find((r) => r.seat === seat);
    return row !== undefined ? row.name : `座位${String(seat)}`;
  }

  function trustLines(): string[] {
    const info = peer.info();
    const out: string[] = [];
    if (info.violations.length > 0) {
      out.push(`⚠ 这一局不可信：${info.violations[0]}`);
      if (info.violations.length > 1) out.push(`（另有 ${String(info.violations.length - 1)} 条越界记录，全部见控制台）`);
      out.push('已停手：本页面不再向服务端发出任何行动');
    }
    // 粘性那一行**追加**在越界块之后，不插到最前面：`nui/05` 把"越界提示必须是日志区的第一行"
    // 钉成了断言（`snap.log[0]`），插队等于改既有期望。继承来的停手（本会话零 violation）时
    // 这一行就是 out[0] ⇒ 牌桌警告位（`note = trust[0]`）自然把解除方式说出来。
    if (sticky !== null) {
      out.push(
        `⚠ 本标签页曾判不可信 ${String(sticky.count)} 次（首条：${sticky.first}），已停手；只有关闭本标签页才能解除`,
      );
    }
    if (leakBlocked !== null) out.push(`⚠ 服务端承认自己漏了牌：${leakBlocked.why}`);
    if (replaced !== null) out.push(`提示：本座位已被另一个连接接管（${replaced.why}），本页面的凭据已作废`);
    if (staleToken !== null) out.push(`凭据已作废（${staleToken.code}：${staleToken.why}）⇒ 正在重新入桌`);
    return out;
  }

  function untrusted(): boolean {
    // 会话级（这一世被抓过）∪ 标签页级（这一世之前被抓过）⇒ 两条判据走同一个出口，
    // 按钮塌陷、act 拒发、日志区提示全都由这一个布尔值驱动，不新造第二套。
    return sticky !== null || peer.info().violations.length > 0;
  }

  // **写真源只许 `peer.info()`**：这里不解析任何下行帧、不自己判"这条算不算越界"，
  // 判据全在 netx/client.ts 那道墙里（rev=11 应修 2 的同一接缝纪律）。
  function recordUntrusted(): void {
    const v = peer.info().violations;
    if (v.length === 0) return;
    if (stickyRecorded) return; // 同一会话内只记一次（第 2、3 条 violation 不重复计数）
    stickyRecorded = true;
    sticky =
      sticky === null
        ? { count: 1, first: String(v[0]), hand: peer.info().hand }
        : { count: sticky.count + 1, first: sticky.first, hand: sticky.hand };
    options.store.set(untrustedKey(prefix), JSON.stringify(sticky));
  }

  return {
    // —— 传输端口：本层不碰 WebSocket，只产出该发出去的文本 ——
    joinWire(): string {
      // 新入桌只清**凭据**；`:untrusted` 一律不动 —— 换房间 URL、断开后重新入桌、单机↔联机来回切，
      // 按裁定都不构成解除（唯一解除路径是关闭本标签页 = sessionStorage 自己到期）。
      options.store.del(savedKey(prefix)); // 新入桌不许带着上一世的凭据
      peer.renew(); // 也不许带着上一世的**份额**：两桌的局号都从 1 开始，旧份额会让它从此不再交（nui/18）
      return encodeUp(peer.hello());
    },
    // 刷新 / 断线后凭 token 回来。没有凭据时返回 null，由上层决定是重新 join 还是提示。
    resumeWire(): string | null {
      const up = peer.resume();
      return up === null ? null : encodeUp(up);
    },
    // 显式离桌：把座位还回去（断开 ≠ 离桌，座位默认为重连保留）。与 joinWire 同一套清理：
    // 凭据作废 + 换新身份，下一次连接就是全新入座，不会拿着旧 token 找一个已经不存在的座位。
    // 消息本身不带字段 —— 服务端按连接认座（与 action 同一口径）。
    leaveWire(): string {
      options.store.del(savedKey(prefix));
      peer.renew();
      return encodeUp({ t: 'leave' });
    },
    // 桌务上行：准备（按当前桌况取反 = 准备/取消准备二合一）与房主的开局/续局（同一条 begin，
    // 语义由房间所处阶段决定）。不走 act()：它们不是行动，停手不拦 —— 但被拒的回执照常上提示行。
    ready(): string {
      const i = peer.info();
      const amReady = (i.table?.ready ?? []).includes(i.seat);
      return encodeUp({ t: 'ready', on: !amReady });
    },
    begin(): string {
      return encodeUp({ t: 'begin' });
    },
    // 改名：resume 不带名字（协议如此），所以"输入框改了名再重连"要补发这一条。
    // 座位与凭据都不动；服务端刷新名册后，自己那份 hello 会把新名带回来（peer.name 随之更新）。
    renameWire(name: string): string {
      return encodeUp({ t: 'rename', name });
    },
    // 服务端下行进来的一条文本：喂给那道墙，返回该回发上行的文本（份额、以及"该发什么"的决定）。
    onText(text: string): string[] {
      // 判据只认那道墙**通过 schema 校验之后**记进 `errors` 的东西。
      // 之前这里自己 `JSON.parse` 原文去嗅探 `code` ⇒ 一条连校验都过不了的报文就能清掉玩家凭据、
      // 并强制重入桌（rev=10 应修 2）。这一层的主题正是不信任服务端，判据更不能绕开它自己的墙。
      const errorsBefore = peer.info().errors.length;
      const tokenBefore = peer.info().token;
      const out: string[] = [];
      for (const up of peer.inbound(text)) out.push(encodeUp(up));
      // 落账就挂在这一帧之后：墙（`peer.info().violations`）第一次非空 ⇒ 写进标签页存储。
      // 放在 errors 嗅探之前，免得以后有人在那段里加 `return` 把记账跳过去。
      recordUntrusted();
      for (const e of peer.info().errors.slice(errorsBefore)) {
        if (e.code === 'leak_blocked') leakBlocked = e;
        else if (e.code === 'replaced') replaced = e;
        // 凭据作废的两条回执：房间重启后 token 不认识 / 这个 token 名下的座位已被别的连接拿着。
        else if (TABLE_ERROR_CODES.has(e.code)) tableError = e;
        else if (e.code === 'bad_token' || e.code === 'token_seat_mismatch') {
          staleToken = e;
          staleDeadToken = tokenBefore;
          stalePendingJoin = true;
          options.store.del(savedKey(prefix));
        }
      }
      // 服务端发来了**另一份**凭据 ⇒ 这座已经重新落在它名下，这条提示就该消掉（不许一直挂着）
      const tokenNow = peer.info().token;
      if (staleToken !== null && tokenNow !== '' && tokenNow !== staleDeadToken) staleToken = null;
      // 凭据被服务端判死 ⇒ 就地换一条全新的入桌上行。**决定放在这一层而不是 main.ts**：
      // main.ts 于是只是一根管道（把 onText 返回的东西写进 socket），这条路径才能被无头用例钉住
      //（写在传输层里就只剩文本形状的门，rev=10 的变异 E02 就是这么逃过一次）。
      if (stalePendingJoin) {
        stalePendingJoin = false;
        // 一次性闩锁：这一世只自动重入桌一次。服务端要是反复吐 bad_token（坏掉或敌意），
        // 不限次就会把页面变成 join 洪水 —— 同一主题，不能只防牌不防凭据。
        if (!staleAutoJoined && !untrusted()) {
          staleAutoJoined = true;
          peer.renew();
          out.push(encodeUp(peer.hello()));
        }
      }
      persist();
      return out;
    },
    markOpen(): void {
      link = 'open';
    },
    markClosed(): void {
      link = 'closed';
    },
    // 唯一的行动出口。停手不在这儿判：peer.act 在 violations 非空时自己就返回 up=null，
    // 这里只把"为什么发不出去"原样带上去给 UI 显示。
    // 多出来的只有"继承来的停手"这一支：本会话自己一条 violation 都没有（它是重连后的新 peer，
    // 那道墙是干净的），但**这个标签页**以前判过 ⇒ 仍然发不出去，且走的是同一个 `sent:false` 出口，
    // 不新造第二条按钮塌陷逻辑（按钮塌陷由 `untrusted()` 驱动，见 snapshot）。
    act(move: Move): { sent: boolean; why: string | null; wire: string | null } {
      if (sticky !== null && peer.info().violations.length === 0) {
        return { sent: false, why: '本标签页此前判定服务端不可信 ⇒ 已停手（只有关闭本标签页才能解除）', wire: null };
      }
      const r = peer.act(move);
      if (r.up === null) return { sent: false, why: r.why ?? '被客户端拒绝', wire: null };
      return { sent: true, why: null, wire: encodeUp(r.up) };
    },
    peer,
    // rev=11 删掉了一个 `linkState()` 助手：全仓零调用点，连接态本来就由 `info().link` 出去
    // （rev=9 必修 2 的同一判据：接口义务不留成死接口）。
    info(): NetInfo {
      const p = peer.info();
      return {
        link,
        seat: p.seat,
        name: p.name,
        hand: p.hand,
        seq: p.seq,
        phase: p.phase,
        untrusted: untrusted(),
        trustLines: trustLines(),
        verifiedHand: p.verifiedHand,
        lastReject: p.lastReject,
        errors: p.errors,
        notices: p.notices,
        hasToken: readSaved(options.store, prefix) !== null,
        staleToken: staleToken !== null,
        hostSeat: p.table?.host ?? -1,
        readySeats: p.table?.ready ?? [],
        waiting: p.table?.waiting ?? false,
        tableError,
      };
    },
    snapshot(): Snapshot {
      return netSnapshot(peer, link, nameOfSeat, trustLines(), untrusted(), tableError);
    },
  };
}

export type Net = ReturnType<typeof createNet>;

// ——————————————————————————— 视图 → Snapshot ———————————————————————————
// 字段与 bridge.snapshot()（单机）逐字一致 —— 由 nui/01 机检键集，两边共用同一个 scene/paint，
// 于是"2–6 家排得开、牌面读得清、命中区与绘制同步"这些 M3 硬指标在联机模式下自动同样成立。

function netSnapshot(
  peer: Peer,
  state: Link,
  nameOfSeat: (seat: number) => string,
  trust: string[],
  blocked: boolean,
  tableErr: Reject | null,
): Snapshot {
  const info = peer.info();
  const view = peer.viewOf();
  const rules = peer.rulesOf();
  // 服务端那些"可观测状态突变"的解释（谁入桌、谁没交份额所以这局不带他、庄家因此挪到谁）必须上日志区：
  // 玩家看得见结果、看不见原因，与"停手 + 为什么停手不许只活在测试里"是同一条口径（rev=10 应修 5）。
  // notices 是累积的 ⇒ 只取最近 6 条并去重，最后整段一起裁到 40 行，别把引擎日志挤掉。
  const notices = [...new Set(info.notices.slice(-6))];
  if (view === null || rules === null) {
    // 这一支正是房间还在 `collect`（等份额）的那段时间：局面还没有，可"为什么还没有"必须说得出。
    // 之前这里连 notices 都不给，页面在最需要解释的那一刻是完全静默的。
    // hosted 等待期（table.waiting，严格 = 服务端 hand === null）也走这支：同一份 return 换上
    // "座位板 + 准备/开始按钮 + 等待状态行"——不另开第三个 log 分支（nst/13 钉着恰好两条）。
    const table = info.table;
    const waiting = table !== null && table.waiting;
    const waitSeats: SeatCell[] = waiting
      ? peer.rosterOf().map((r) => ({
          seat: r.seat,
          name: r.name,
          role: (r.seat === info.seat ? 'human' : 'remote') as SeatCell['role'],
          marks: [r.seat === table.host ? '主' : '', table.ready.includes(r.seat) ? '✓' : ''].filter(Boolean).join(''),
          chips: 0,
          committed: 0,
          looked: false,
          active: false,
          status: table.ready.includes(r.seat) ? '已准备' : '未准备',
          cardsText: '',
          tierText: '',
          resultText: '',
          hidden: true,
          departed: false,
        }))
      : [];
    // 「等 N/M 准备」由前端按桌况现拼（服务端只发排好序的 ready 列表，不拼文案）；
    // N/M 只是展示口径，真正的门在服务端（not_ready 的回执会经 tableError 上屏）
    const inRoom = peer.rosterOf().length;
    const readyCount = table?.ready.length ?? 0;
    const iAmHost = table?.host === info.seat;
    const waitButtons: ButtonOption[] = waiting
      ? [
          {
            intent: { kind: 'ready' },
            text: (table?.ready ?? []).includes(info.seat) ? '取消准备' : '准备',
            cost: null,
            legal: true,
          },
          iAmHost
            ? {
                intent: { kind: 'begin' },
                text:
                  readyCount >= inRoom && inRoom >= 2
                    ? '开始游戏'
                    : `开始游戏（${String(readyCount)}/${String(inRoom)} 已准备）`,
                cost: null,
                legal: readyCount >= inRoom && inRoom >= 2,
              }
            : { intent: { kind: 'fold' }, text: '等待房主开始…', cost: null, legal: false },
        ]
      : [];
    const waitStatus = waiting
      ? `${connectionLine(state, info.name, null, info.seat)}｜等待中·${String(inRoom)} 人在座·${String(readyCount)} 已准备`
      : connectionLine(state, info.name, null, info.seat);
    return {
      started: false,
      status: waitStatus,
      handIndex: info.hand,
      pot: 0,
      stake: 0,
      phase: 'idle',
      turn: -1,
      dealer: -1,
      humanSeat: info.seat,
      seats: waitSeats,
      buttons: waitButtons,
      // 两条分支的日志上限必须同一条尺：主分支是 `.slice(-40)`，这里以前没有 ⇒ 一旦 notices 的
      // 窗口被抬高，collect 那一段就能突破上限（rev=11 应修 3，nst/13 把"两分支同上限 + notices ≤ 上限"钉成静态门）。
      log: [...trust, ...notices].slice(-40),
      settlement: [],
      settleSummary: [],
      revealedLine: '',
      ledgerLine: '',
      total: 0,
      over: null,
      note: bannerText(trust, tableErr, info.lastReject),
      dealerRule: '?',
      hostPaused: false,
    };
  }
  const mySeat = info.seat;
  const seatsInHand = new Set(view.seats.map((s) => s.seat));
  const terminal = view.terminal;
  const cells: SeatCell[] = peer
    .rosterOf()
    .map((r) => {
      const row = view.seats.find((x) => x.seat === r.seat);
      const role: SeatCell['role'] = r.seat === mySeat ? 'human' : 'remote';
      if (row === undefined) {
        // 在册但这一局不在桌（中途入座 / 已破产收桌）：占位显示，绝不编造数字
        return {
          seat: r.seat,
          name: r.name,
          role,
          marks: '',
          chips: 0,
          committed: 0,
          looked: false,
          active: false,
          status: seatsInHand.size === 0 ? '' : '本局不参与',
          cardsText: '',
          tierText: '',
          resultText: '',
          hidden: true,
          departed: true,
        };
      }
      const cards: Card[] | null = row.cards === 'unknown' ? null : row.cards;
      const shareIdx = terminal === null ? -1 : terminal.winners.indexOf(row.seat);
      return {
        seat: row.seat,
        name: nameOfSeat(row.seat),
        role,
        marks: [row.seat === view.dealer ? '庄' : '', view.phase === 'betting' && row.seat === view.turn ? '◀' : ''].filter(Boolean).join(''),
        chips: row.chips,
        committed: row.committed,
        looked: row.looked,
        active: row.active,
        status: !row.active
          ? row.out === 'folded'
            ? '弃牌'
            : '被淘汰'
          : view.phase !== 'betting'
            ? '局中'
            : view.turn === row.seat
              ? '行动中'
              : '局中',
        cardsText: cards === null ? '···' : handText(cards),
        tierText: cards === null ? '' : tierName(classify(cards, rules).tier),
        resultText:
          terminal === null
            ? ''
            : shareIdx >= 0
              ? view.phase === 'settled'
                ? `赢 ${String(terminal.shares[shareIdx] ?? 0)}`
                : `应赢 ${String(terminal.shares[shareIdx] ?? 0)}`
              : view.phase === 'settled'
                ? '没赢'
                : '',
        hidden: cards === null,
        departed: false,
      };
    })
    .concat(
      // 在局但不在名册（名册只列已入座的连接，理论上不出现；真出现了也不许悄悄丢掉一家）
      view.seats
        .filter((x) => !peer.rosterOf().some((r) => r.seat === x.seat))
        .map((row) => {
          const cards: Card[] | null = row.cards === 'unknown' ? null : row.cards;
          return {
            seat: row.seat,
            name: nameOfSeat(row.seat),
            role: row.seat === mySeat ? ('human' as const) : ('remote' as const),
            marks: row.seat === view.dealer ? '庄' : '',
            chips: row.chips,
            committed: row.committed,
            looked: row.looked,
            active: row.active,
            status: row.active ? '局中' : '弃牌',
            cardsText: cards === null ? '···' : handText(cards),
            tierText: cards === null ? '' : tierName(classify(cards, rules).tier),
            resultText: '',
            hidden: cards === null,
            departed: false,
          };
        }),
    );

  const settlement: string[] = [];
  const settleSummary: string[] = [];
  if (terminal !== null) {
    settlement.push(`结束原因：${reasonLabel(terminal.reason)}`);
    for (const cell of cells) {
      const row = view.seats.find((x) => x.seat === cell.seat);
      if (row === undefined) continue;
      const cards = row.cards === 'unknown' ? '未开牌' : handText(row.cards);
      const tier = row.cards === 'unknown' ? '' : tierName(classify(row.cards, rules).tier);
      const shareIdx = terminal.winners.indexOf(row.seat);
      const outcome =
        shareIdx >= 0
          ? `赢 ${String(terminal.shares[shareIdx] ?? 0)}（现筹码 ${String(row.chips)}）`
          : `没赢（现筹码 ${String(row.chips)}）`;
      settlement.push(`${cell.name}${cell.role === 'human' ? '[你]' : '[玩家]'}｜${cards}${tier === '' ? '' : ` ${tier}`}｜${outcome}`);
      settleSummary.push(`${cell.name} ${String(row.chips)}`);
    }
    if (terminal.remainderTo >= 0) {
      settlement.push(`余数 1 分给距庄家下家最近的赢家：${nameOfSeat(terminal.remainderTo)}`);
    }
    // 联机侧没有 GameState，只有服务端给的 seq ⇒ 指纹只能报 seq 而不是 stateHash（不猜、不另算一套）
    settlement.push(`本局序号 ${String(view.seq)}｜揭示核对 ${info.verifiedHand === info.hand ? '通过' : '未通过'}`);
  }
  const revealed = view.seats
    .filter((x) => x.cards !== 'unknown')
    .map((x) => `${nameOfSeat(x.seat)} ${handAscii(x.cards as Card[])}`);
  const log = peer.logOf();
  // 结算暂停（hosted 专属）：settle+揭示之后房间停在结算画面等房主「继续」。
  // auto 房间收不到 table ⇒ info.table 为 null ⇒ hostPaused 恒 false，行为一个字节不变。
  const hostPaused = view.phase === 'settled' && info.table !== null;
  const finalButtons: ButtonOption[] = blocked
    ? stoppedButtons()
    : hostPaused
      ? info.table?.host === mySeat
        ? [{ intent: { kind: 'begin' }, text: '继续下一局', cost: null, legal: true }]
        : [{ intent: { kind: 'fold' }, text: '等待房主继续…', cost: null, legal: false }]
      : buttonRow(view, mySeat, nameOfSeat);
  return {
    started: true,
    status: `${connectionLine(state, info.name, view.phase, mySeat)}｜第 ${String(info.hand)} 手·${viewWord(view.phase)}`,
    handIndex: info.hand,
    pot: view.pot,
    stake: view.stake,
    phase: view.phase,
    turn: view.turn,
    dealer: view.dealer,
    humanSeat: mySeat,
    seats: cells,
    buttons: finalButtons,
    // 越界提示也要出现在日志区：note 只有一行标题位，而"停手 + 为什么停手"不许只活在测试里（工单 §4 M5）。
    log: [...trust, ...notices, ...log.map((e: Event) => logLineOf(nameOfSeat, e))].slice(-40),
    settlement,
    settleSummary,
    revealedLine: revealed.length === 0 ? '' : `亮牌：${revealed.join(' / ')}`,
    ledgerLine: cells
      .filter((c) => !c.departed)
      .map((c) => `${c.name}=${String(c.chips)}`)
      .join(' '),
    // 与单机同一口径：tableTotal = 各家筹码 + 池（webmin/model.ts::tableTotal），两条路才能对同一个数
    total: cells.reduce((a, c) => a + (c.departed ? 0 : c.chips), 0) + view.pot,
    over: null,
    note: bannerText(trust, tableErr, info.lastReject),
    dealerRule: DEALER_NEXT_LABELS[rules.dealer.next] ?? '?',
    hostPaused,
  };
}

// 牌桌上那一条"警告位"（scene.ts 用 warn 色印在日志区标题上）。优先级：
// 越界/漏牌/顶号这类信任问题 > 服务端这一次 reject 的原文。reject 必须可见（Q6=A2 ③：
// 买不起之类后果由服务端送回来，UI 照实显示），但它是"这一下没成就完了"，不是整局不可信。
function bannerText(trust: string[], tableErr: Reject | null, reject: Reject | null): string | null {
  if (trust.length > 0) return trust[0] ?? null;
  // 桌务回执排在 lastReject 前面：等待期的拒绝走 error（reject 的 hand 必须是真的局号），
  // 不补这一路，玩家点「准备/开始」就是点了没反应（复审点名的 UX 死点）
  if (tableErr !== null) return `桌务被拒：${tableErr.why}`;
  if (reject !== null) return `服务端拒绝：${reject.why}`;
  return null;
}

function viewWord(phase: string): string {
  if (phase === 'betting') return '行动中';
  if (phase === 'awaitingSettle') return '待结算';
  if (phase === 'settled') return '已结算';
  return phase;
}

function connectionLine(state: Link, name: string, phase: string | null, mySeat: number): string {
  const who = name === '' ? (mySeat >= 0 ? `座位${String(mySeat)}` : '未入座') : name;
  if (state === 'idle') return `联机·未连接（${who}）`;
  if (state === 'closed') return `联机·连接已断，正在重连（${who}）`;
  return phase === null ? `联机·已连接（${who}）` : `联机·在线（${who}）`;
}

// 按钮清单：可用性只看服务端给的 phase / turn（"是不是我"、"在不在行动阶段"），
// 比牌目标只是把服务端投影里 active 的对手列成候选 —— 能不能真做成一律由服务端 reject 决定。
//
// 金额这一列按 Q6 裁定 = A2 落地（ANSWERS.md 第六轮）：
//   · 算术只有那一处：`src/engine/state.ts::priceOf`，服务端记账走的 actionCost 已经委托给它，
//     这里 import 的是同一个函数 ⇒ "页面显示的钱"与"服务端随后写进 log 的钱"是两个来源、一个定义。
//   · 入参只用投影里本来就下发的原始量（view.stake / 自己那格的 looked / view.rules），
//     不伪造 GameState、不 import actionCost / callPrice / canAffordCall（②③）。
//   · 只影响文案，不影响 legal：买不起也照样是可点的，代价由服务端 reject 送回来（③）。
export type ButtonView = {
  phase: string;
  turn: number;
  stake: number;
  rules: Rules;
  seats: { seat: number; active: boolean; looked: boolean }[];
};

export function buttonRow(view: ButtonView, mySeat: number, nameOfSeat: (seat: number) => string): ButtonOption[] {
  if (view.phase !== 'betting') return [];
  if (view.turn !== mySeat) {
    return [{ intent: { kind: 'fold' }, text: `等 ${nameOfSeat(view.turn)} 行动`, cost: null, legal: false }];
  }
  const me = view.seats.find((s) => s.seat === mySeat);
  const looked = me !== undefined && me.looked;
  // 显示用价格：全部来自那一个函数；look/fold 花 0 钱，所以沿用"不印金额"的口径
  const show = (kind: ActionKind): number => priceOf(kind, view.stake, looked, view.rules);
  const money = (label: string, cost: number): string => (cost > 0 ? `${label}（出 ${String(cost)}）` : label);
  const out: ButtonOption[] = [];
  if (me !== undefined && !looked) out.push({ intent: { kind: 'look' }, text: '看牌', cost: show('look'), legal: true });
  out.push({ intent: { kind: 'call' }, text: money('跟注', show('call')), cost: show('call'), legal: true });
  out.push({ intent: { kind: 'raise' }, text: money('加注', show('raise')), cost: show('raise'), legal: true });
  out.push({ intent: { kind: 'fold' }, text: '弃牌', cost: show('fold'), legal: true });
  for (const s of view.seats) {
    if (s.seat === mySeat || !s.active) continue;
    out.push({
      intent: { kind: 'compare', target: s.seat },
      text: money(`比牌 → ${nameOfSeat(s.seat)}`, show('compare')),
      cost: show('compare'),
      legal: true,
    });
  }
  return out;
}

function stoppedButtons(): ButtonOption[] {
  return [{ intent: { kind: 'fold' }, text: '已停手：这一局不可信', cost: null, legal: false }];
}

