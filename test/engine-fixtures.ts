// M1 测试夹具：固定种子的牌局构造 + 种子搜索（搜索顺序固定 ⇒ 结果确定）。
import { compare } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import { startHand } from '../src/engine/state.ts';
import type { Action, GameState, HandConfig } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';

export const CHIPS = 100;

export function config3(seed: number, dealer = 0, rules: Rules = presets.classic, chips = CHIPS): HandConfig {
  return { rules, seed, dealer, seats: [0, 1, 2].map((seat) => ({ seat, chips })) };
}

export function hand3(seed: number, dealer = 0, rules: Rules = presets.classic): GameState {
  return startHand(config3(seed, dealer, rules));
}

export function cardsOf(state: GameState, seat: number): Card[] {
  const s = state.seats.find((x) => x.seat === seat);
  if (s === undefined) throw new Error(`no seat ${String(seat)}`);
  return s.hand;
}

export function ties(state: GameState, a: number, b: number): boolean {
  return compare(cardsOf(state, a), cardsOf(state, b), state.rules) === 0;
}

// 按固定顺序扫描 seed，返回第一个满足条件的种子；找不到就抛（不要静默退回别的 seed）
export function findSeed(pred: (state: GameState) => boolean, from = 1, to = 20_000): number {
  for (let seed = from; seed <= to; seed += 1) {
    if (pred(hand3(seed))) return seed;
  }
  throw new Error(`no seed in [${String(from)}, ${String(to)}] satisfies the predicate`);
}

export function script(state: GameState, actions: Action[]): GameState {
  let s = state;
  for (const a of actions) s = apply(s, a);
  return s;
}

// 全员一直跟注直到终局（用于把 pot 堆到可预测的数额）
export function callUntilEnd(state: GameState, limit = 300): GameState {
  let s = state;
  let n = 0;
  while (s.phase === 'betting') {
    n += 1;
    if (n > limit) throw new Error('callUntilEnd did not terminate');
    const call: Action = { kind: 'call', seat: s.turn };
    s = apply(s, call);
  }
  return s;
}

const CACHE = new Map<string, number>();

export function seedWithTie(): number {
  return cachedSearch('tie', (s) => ties(s, 0, 1) || ties(s, 1, 2) || ties(s, 0, 2));
}

export function seedWithTie01(): number {
  return cachedSearch('tie01', (s) => ties(s, 0, 1));
}

function cachedSearch(key: string, pred: (s: GameState) => boolean): number {
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;
  const found = findSeed(pred);
  CACHE.set(key, found);
  return found;
}
