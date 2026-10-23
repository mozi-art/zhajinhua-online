// M1 引擎 · 状态与派生量（工单 §4 M1）。
// 全部纯函数：筹码/牌/计数都在 state 值里，不碰时钟、不碰 IO、不用随机全局态。
// 随机性只有一个来源：startHand 用注入的 seed 造 mulberry32 洗完一次牌堆。
import { makeDeck, mulberry32, shuffle } from '../cards.ts';
import type { Card } from '../cards.ts';
import type { Rules } from '../rules.ts';

export type Phase = 'betting' | 'awaitingSettle' | 'settled';

export type OutReason = 'folded' | 'eliminated';

export type TerminalReason = 'oneLeft' | 'stakeCap' | 'stall';

export type SeatState = {
  seat: number;
  chips: number;
  hand: Card[];
  active: boolean;
  out: OutReason | null;
  looked: boolean;
  actionsTotal: number;
  actionsAtStake: number;
  committed: number;
  revealed: boolean;
};

export type EventType =
  | 'deal'
  | 'look'
  | 'call'
  | 'raise'
  | 'fold'
  | 'compare'
  | 'eliminate'
  | 'terminal'
  | 'settle';

export type Event = {
  seq: number;
  type: EventType;
  seat: number;
  target: number;
  amount: number;
  stake: number;
  note: string;
};

export type Terminal = {
  reason: TerminalReason;
  winners: number[];
  shares: number[];
  remainderTo: number;
};

export type ActionKind = 'look' | 'fold' | 'call' | 'raise' | 'compare' | 'timeout' | 'settle';

export type Action =
  | { kind: 'look'; seat: number }
  | { kind: 'fold'; seat: number }
  | { kind: 'call'; seat: number }
  | { kind: 'raise'; seat: number }
  | { kind: 'compare'; seat: number; target: number }
  | { kind: 'timeout'; seat: number }
  | { kind: 'settle' };

export type GameState = {
  rules: Rules;
  seed: number;
  phase: Phase;
  dealer: number;
  turn: number;
  pot: number;
  stake: number;
  seats: SeatState[];
  seq: number;
  log: Event[];
  terminal: Terminal | null;
  settledSeq: number | null;
};

export type SeatConfig = { seat: number; chips: number };

export type HandConfig = {
  rules: Rules;
  seed: number;
  dealer: number;
  seats: SeatConfig[];
};

function cfg(msg: string): never {
  throw new TypeError(`bad hand config: ${msg}`);
}

export function seatAt(state: GameState, seat: number): SeatState {
  const found = state.seats.find((s) => s.seat === seat);
  if (found === undefined) cfg(`seat ${String(seat)} not in this hand`);
  return found;
}

export function activeSeats(state: GameState): SeatState[] {
  return state.seats.filter((s) => s.active);
}

export function isActive(state: GameState, seat: number): boolean {
  return seatAt(state, seat).active;
}

// 环形座位序：座位号升序，越过最大值回到最小值。"庄家下家"与"距庄家下家最近"都走这条序。
export function seatOrder(state: GameState): number[] {
  return state.seats.map((s) => s.seat).sort((a, b) => a - b);
}

export function nextSeat(state: GameState, from: number, predicate: (s: SeatState) => boolean): number {
  const order = seatOrder(state);
  if (order.length === 0) return -1;
  const start = order.findIndex((s) => s === from);
  for (let step = 1; step <= order.length; step += 1) {
    const candidate = order[(start + step + order.length) % order.length] as number;
    const seat = seatAt(state, candidate);
    if (predicate(seat)) return candidate;
  }
  return -1;
}

export function nextActiveSeat(state: GameState, from: number): number {
  return nextSeat(state, from, (s) => s.active);
}

// 唯一的价格算术（Q6 裁定 = A2，2026-09-28：金额口径只许在这一处定义）。
// 服务端走 actionCost → 这里；页面侧走 webui/netplay.ts 的按钮文案 → 还是这里。
// 入参全是投影里本来就下发了的原始量（stake / looked / rules），所以页面不必持有 GameState
// 也能算出显示用价格 —— 也正因如此，"UI 显示的钱"与"服务端随后真正记账的钱"是两个独立来源、
// 同一个函数，能拿来做端到端对账（见 ANSWERS.md 第六轮 (a)）。
// 口径出处：ANSWERS.md 第二轮 Q1（读法 B：加注=注级翻倍后按自身闷/明身份付新注级的跟价；
// 比牌 = 2 × 当前注级，不叠加跟价、与闷/明无关）。
export function priceOf(kind: ActionKind, stake: number, looked: boolean, rules: Rules): number {
  const callAt = (s: number): number => s * (looked ? rules.bet.seen : rules.bet.dark);
  switch (kind) {
    case 'call':
      return callAt(stake);
    case 'raise':
      return callAt(stake * 2);
    case 'compare':
      return stake * rules.compare.fee;
    case 'look':
    case 'fold':
    case 'timeout':
    case 'settle':
      return 0;
    default: {
      const exhausted: never = kind;
      return exhausted;
    }
  }
}

// 唯一出钱口（金额口径来自 ANSWERS.md 第二轮 Q1 的裁定；算术本身在 priceOf）。
export function actionCost(state: GameState, seat: number, kind: ActionKind): number {
  return priceOf(kind, state.stake, seatAt(state, seat).looked, state.rules);
}

export function callPrice(state: GameState, seat: number): number {
  return actionCost(state, seat, 'call');
}

// 付不起本手跟价 ⇒ 全押禁用，唯一合法行动是弃牌（§1 全押行）。
export function canAffordCall(state: GameState, seat: number): boolean {
  const s = seatAt(state, seat);
  return s.chips >= callPrice(state, seat);
}

export function totalChips(state: GameState): number {
  return state.seats.reduce((acc, s) => acc + s.chips, 0);
}

// 结算前后的资金守恒检查用：桌上的钱 = 各家筹码 + 池。
export function moneyTotal(state: GameState): number {
  return totalChips(state) + state.pot;
}

export function startHand(config: HandConfig): GameState {
  const { rules, seed, dealer } = config;
  if (!Number.isInteger(seed)) cfg(`seed must be an integer, got ${String(seed)}`);
  if (!Array.isArray(config.seats)) cfg('seats must be an array');
  const count = config.seats.length;
  if (count < rules.players.min || count > rules.players.max) {
    cfg(`seat count ${String(count)} out of rules.players range [${String(rules.players.min)}, ${String(rules.players.max)}]`);
  }
  const seen = new Set<number>();
  for (const s of config.seats) {
    if (!Number.isInteger(s.seat) || s.seat < 0) cfg(`bad seat id ${String(s.seat)}`);
    if (seen.has(s.seat)) cfg(`duplicate seat ${String(s.seat)}`);
    seen.add(s.seat);
    if (!Number.isInteger(s.chips) || s.chips < rules.ante) {
      cfg(`seat ${String(s.seat)} chips ${String(s.chips)} cannot cover ante ${String(rules.ante)}`);
    }
  }
  if (!seen.has(dealer)) cfg(`dealer ${String(dealer)} is not one of the seats`);

  const order = config.seats.map((s) => s.seat).sort((a, b) => a - b);
  if (order.length * 3 > 52) cfg('not enough cards for this many seats');

  const deck = shuffle(makeDeck(), mulberry32(seed));
  // 发牌序钉死：从庄家下家起、按环形座位序、每人连续 3 张。
  // M4 各端要能同一 seed 复算同一副牌，所以这条顺序本身是契约的一部分。
  const startIdx = order.indexOf(dealer);
  const dealOrder: number[] = [];
  for (let step = 1; step <= order.length; step += 1) {
    dealOrder.push(order[(startIdx + step) % order.length] as number);
  }

  const bySeat = new Map<number, SeatState>();
  for (const s of config.seats) {
    bySeat.set(s.seat, {
      seat: s.seat,
      chips: s.chips - rules.ante,
      hand: [],
      active: true,
      out: null,
      looked: false,
      actionsTotal: 0,
      actionsAtStake: 0,
      committed: rules.ante,
      revealed: false,
    });
  }
  let cursor = 0;
  for (const seat of dealOrder) {
    const s = bySeat.get(seat);
    if (s === undefined) cfg(`deal order references missing seat ${String(seat)}`);
    s.hand = [deck[cursor] as Card, deck[cursor + 1] as Card, deck[cursor + 2] as Card];
    cursor += 3;
  }

  const seats = order.map((seat) => bySeat.get(seat) as SeatState);
  const firstActor = order[(startIdx + 1) % order.length] as number;
  const pot = rules.ante * seats.length;

  const state: GameState = {
    rules,
    seed,
    phase: 'betting',
    dealer,
    turn: firstActor,
    pot,
    stake: rules.stake.initial,
    seats,
    seq: 1,
    log: [
      {
        seq: 1,
        type: 'deal',
        seat: dealer,
        target: firstActor,
        amount: pot,
        stake: rules.stake.initial,
        note: `ante=${String(rules.ante)} seats=${String(seats.length)} first=${String(firstActor)}`,
      },
    ],
    terminal: null,
    settledSeq: null,
  };
  return state;
}

export function withEvent(state: GameState, ev: Omit<Event, 'seq'>): GameState {
  const seq = state.seq + 1;
  return {
    ...state,
    seq,
    log: [...state.log, { ...ev, seq }],
  };
}

// —— 确定性哈希（回放指纹用；不是安全摘要，M4 另有 commit-reveal）——
// 只依赖 node 内置之外的纯计算：不引 crypto。
function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value) ?? String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(rec[k])}`).join(',')}}`;
  }
  return String(value);
}

function fnv1a(text: string, offset: number): string {
  let h = offset >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function stateHash(state: GameState): string {
  const text = canonical(state);
  // 两段不同 offset basis 拼成 64 bit，避免单段 32 bit 在回归脚本里撞车
  return `${fnv1a(text, 0x811c9dc5)}${fnv1a(text, 0x9dc9e7f3)}`;
}

export function logHash(state: GameState): string {
  const text = canonical(state.log.map((e) => [e.seq, e.type, e.seat, e.target, e.amount, e.stake, e.note]));
  return `${fnv1a(text, 0x811c9dc5)}${fnv1a(text, 0x9dc9e7f3)}`;
}
