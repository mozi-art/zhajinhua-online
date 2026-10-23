// M1 引擎 · 终局判定与幂等结算（工单 §4 M1：幂等结算 / stateSeq 重放不重复扣钱）。
// 全押禁用 ⇒ 赢家通吃，开牌平局才分池；不存在边池、退款、索赔（§2.2）。
import { compare } from '../cards.ts';
import { activeSeats, seatAt, seatOrder, withEvent } from './state.ts';
import type { GameState, SeatState, Terminal } from './state.ts';

export function maximalWinners(state: GameState, contenders: SeatState[]): number[] {
  if (contenders.length === 0) throw new TypeError('maximalWinners needs at least one contender');
  let best = contenders[0] as SeatState;
  for (const s of contenders) {
    if (compare(s.hand, best.hand, state.rules) > 0) best = s;
  }
  // v1 比较是全序（无 235 非传递环）⇒ 最大手集合良定义
  return contenders.filter((s) => compare(s.hand, best.hand, state.rules) === 0).map((s) => s.seat);
}

// 平分池：整份 base 给每个赢家；除不尽的余数给"距庄家下家最近"的赢家（§1 开牌平局）。
export function splitPot(state: GameState, winners: number[]): { shares: number[]; remainderTo: number } {
  if (winners.length === 0) throw new TypeError('splitPot needs at least one winner');
  const k = winners.length;
  const base = Math.floor(state.pot / k);
  const remainder = state.pot - base * k;
  const order = seatOrder(state);
  const start = order.indexOf(state.dealer);
  const cyclic: number[] = [];
  for (let step = 1; step <= order.length; step += 1) {
    cyclic.push(order[(start + step) % order.length] as number);
  }
  let remainderTo = -1;
  if (remainder > 0) {
    remainderTo = cyclic.find((s) => winners.includes(s)) ?? (winners[0] as number);
  }
  const shares = winners.map((w) => base + (w === remainderTo ? remainder : 0));
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum !== state.pot) throw new TypeError(`share split loses money: sum=${String(sum)} pot=${String(state.pot)}`);
  return { shares, remainderTo };
}

// §1 四类终止条件，全部按玩家计数判定，不看"圈"。
export function resolveTerminal(state: GameState): Terminal | null {
  const active = activeSeats(state);
  if (active.length === 0) throw new TypeError('no active seat left — invariant broken');
  const rules = state.rules;

  if (active.length === 1) {
    const only = active[0] as SeatState;
    const { shares, remainderTo } = splitPot(state, [only.seat]);
    return { reason: 'oneLeft', winners: [only.seat], shares, remainderTo };
  }

  const allReached = (n: number): boolean => active.every((s) => s.actionsAtStake >= n);
  const atStakeCap = state.stake >= rules.stake.max && allReached(rules.termination.maxStakeActions);
  const stalled = allReached(rules.termination.stallActions);
  if (!atStakeCap && !stalled) return null;

  const winners = maximalWinners(state, active);
  const { shares, remainderTo } = splitPot(state, winners);
  return { reason: atStakeCap ? 'stakeCap' : 'stall', winners, shares, remainderTo };
}

export function revealForTerminal(state: GameState, terminal: Terminal): SeatState[] {
  // ① 只剩一人 ⇒ 不开牌；②③ 强制开牌 ⇒ 活跃玩家全部亮牌。弃牌/被淘汰者永不亮牌。
  if (terminal.reason === 'oneLeft') return state.seats;
  return state.seats.map((s) => (s.active ? { ...s, revealed: true } : s));
}

// 幂等结算：只有 awaitingSettle → settled 会动筹码；对已结算状态再调一次是纯 no-op。
export function settle(state: GameState): GameState {
  if (state.phase === 'settled') return state;
  if (state.phase !== 'awaitingSettle') {
    throw new TypeError(`settle() called in phase ${state.phase}`);
  }
  const terminal = state.terminal;
  if (terminal === null) throw new TypeError('awaitingSettle without terminal outcome');
  const paid = new Map<number, number>();
  terminal.winners.forEach((w, i) => {
    paid.set(w, (paid.get(w) ?? 0) + (terminal.shares[i] ?? 0));
  });
  const seats = state.seats.map((s) => {
    const gain = paid.get(s.seat);
    return gain === undefined ? s : { ...s, chips: s.chips + gain };
  });
  const pot = state.pot;
  const next: GameState = {
    ...state,
    seats,
    pot: 0,
    phase: 'settled',
    settledSeq: state.seq + 1,
  };
  return withEvent(next, {
    type: 'settle',
    seat: -1,
    target: -1,
    amount: pot,
    stake: state.stake,
    note: `${terminal.reason}:${terminal.winners.join('|')}:remainder=${String(terminal.remainderTo)}`,
  });
}

export function chipsOf(state: GameState, seat: number): number {
  return seatAt(state, seat).chips;
}
