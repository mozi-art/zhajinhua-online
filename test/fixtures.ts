// 测试夹具：牌面字面量、穷举枚举、闭式期望。只在 test/ 下使用。
import { classify, makeDeck } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import type { Rules, TierId } from '../src/rules.ts';
import { TIER_IDS } from '../src/rules.ts';

// 字面量用 ASCII 双字符：rank ∈ 23456789TJQKA，suit ∈ S♠ H♥ C♣ D♦（§2.7 的 0/1/2/3）。
const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'SHCD';
const SUIT_GLYPHS = ['♠', '♥', '♣', '♦'];

export function cardOf(text: string): Card {
  if (text.length !== 2) throw new Error(`bad card literal: ${text}`);
  const rank = RANK_CHARS.indexOf(text.slice(0, 1));
  const suit = SUIT_CHARS.indexOf(text.slice(1, 2));
  if (rank < 0 || suit < 0) throw new Error(`bad card literal: ${text}`);
  return { rank: rank + 2, suit };
}

export function handOf(text: string): Card[] {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 3) throw new Error(`bad hand literal: ${text}`);
  return parts.map((p) => cardOf(p));
}

export function glyphOf(card: Card): string {
  return `${RANK_CHARS[card.rank - 2] ?? '?'}${SUIT_GLYPHS[card.suit] ?? '?'}`;
}

export function glyphHand(hand: Card[]): string {
  return hand.map(glyphOf).join('');
}

export function comb(n: number, k: number): number {
  if (k < 0 || n < 0 || k > n) throw new Error(`bad comb args: ${String(n)} ${String(k)}`);
  let acc = 1;
  for (let i = 1; i <= k; i += 1) {
    acc = (acc * (n - k + i)) / i;
  }
  if (!Number.isInteger(acc)) throw new Error('non-integer comb');
  return acc;
}

export type Counts = Record<TierId, number>;

export function emptyCounts(): Counts {
  const out: Record<string, number> = {};
  for (const t of TIER_IDS) out[t] = 0;
  return out as Counts;
}

// 闭式期望：唯一输入 runs = 顺子序列个数，由 rules.handEval.a23 推导（工单 B5）。
// 六类各自独立成式；单张用 (C(13,3) − runs)·(4³−4)，不用"总数减其余"的残差法。
export function expectedCounts(rules: Rules): Counts {
  const runs = rules.handEval.a23 ? 12 : 11;
  const rankTriples = comb(13, 3);
  const nonFlushSuits = 4 ** 3 - 4;
  return {
    trips: 13 * comb(4, 3),
    straightFlush: runs * 4,
    flush: (rankTriples - runs) * 4,
    straight: runs * nonFlushSuits,
    pair: 13 * comb(4, 2) * 12 * 4,
    highCard: (rankTriples - runs) * nonFlushSuits,
  };
}

export const TOTAL_HANDS = comb(52, 3);

export function countSum(counts: Counts): number {
  let acc = 0;
  for (const t of TIER_IDS) acc += counts[t];
  return acc;
}

export function fmtCounts(counts: Counts): string {
  return TIER_IDS.map((t) => `${t}=${String(counts[t])}`).join(' ');
}

export type EnumResult = { counts: Counts; visited: number };

export function enumerateAll(rules: Rules): EnumResult {
  const deck = makeDeck();
  const counts = emptyCounts();
  const hand: [Card, Card, Card] = [deck[0] as Card, deck[1] as Card, deck[2] as Card];
  let visited = 0;
  for (let i = 0; i < 50; i += 1) {
    hand[0] = deck[i] as Card;
    for (let j = i + 1; j < 51; j += 1) {
      hand[1] = deck[j] as Card;
      for (let k = j + 1; k < 52; k += 1) {
        hand[2] = deck[k] as Card;
        const t = classify(hand, rules).tier;
        counts[t] += 1;
        visited += 1;
      }
    }
  }
  return { counts, visited };
}

// 花色无关的规范类：13 个点数的三元可重集 = C(15,3) = 455 个。
// v1 比较不看花色 ⇒ 455 类之间的穷举三元组覆盖传递性的全部可能性。
export function canonicalClasses(): Card[][] {
  const out: Card[][] = [];
  for (let a = 2; a <= 14; a += 1) {
    for (let b = a; b <= 14; b += 1) {
      for (let c = b; c <= 14; c += 1) {
        const used = new Map<number, number>();
        const hand: Card[] = [];
        for (const rank of [a, b, c]) {
          const n = used.get(rank) ?? 0;
          used.set(rank, n + 1);
          hand.push({ rank, suit: n });
        }
        out.push(hand);
      }
    }
  }
  return out;
}

export function expectTypeError(fn: () => unknown, pattern: RegExp | null, label: string): void {
  let caught: unknown = null;
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    caught = err;
  }
  if (!threw) throw new Error(`${label}: expected TypeError, but nothing was thrown`);
  if (!(caught instanceof TypeError)) {
    const e = caught as Error;
    throw new Error(`${label}: expected TypeError, got ${String(e.name)}: ${String(e.message)}`);
  }
  const msg = String((caught as Error).message);
  if (pattern !== null && !pattern.test(msg)) {
    throw new Error(`${label}: message does not match ${String(pattern)}, got: ${msg}`);
  }
}

export function cloneRules(rules: Rules): Rules {
  return structuredClone(rules) as Rules;
}
