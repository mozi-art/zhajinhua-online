// 牌型判定 + 比较 + 洗牌 —— 工单 §2.7 契约。
// 纯函数、零运行时依赖（只用 `import type`，编译后不残留任何 import）、无 IO/时钟/随机全局态。
import type { Rules, TierId } from './rules.ts';

export type Card = { rank: number; suit: number };

export type Hand = { tier: TierId; ranks: number[] };

export type Rng = () => number;

const HAND_SIZE = 3;
const RANK_MIN = 2;
const RANK_MAX = 14;
const SUIT_MIN = 0;
const SUIT_MAX = 3;

function bad(msg: string): never {
  throw new TypeError(msg);
}

function readCard(value: unknown, index: number): Card {
  if (typeof value !== 'object' || value === null) {
    bad(`hand[${String(index)}]: card must be an object`);
  }
  const c = value as Partial<Card>;
  const rank = c.rank;
  const suit = c.suit;
  if (typeof rank !== 'number' || !Number.isInteger(rank)) {
    bad(`hand[${String(index)}]: rank must be an integer, got ${String(rank)}`);
  }
  if (rank < RANK_MIN || rank > RANK_MAX) {
    bad(`hand[${String(index)}]: rank out of range: ${String(rank)}`);
  }
  if (typeof suit !== 'number' || !Number.isInteger(suit)) {
    bad(`hand[${String(index)}]: suit must be an integer, got ${String(suit)}`);
  }
  if (suit < SUIT_MIN || suit > SUIT_MAX) {
    bad(`hand[${String(index)}]: suit out of range: ${String(suit)}`);
  }
  return { rank, suit };
}

// A23 是最小顺（高点记 3），QKA 是最大顺；KA2 之类的"绕 A"不成顺。
function straightHigh(hi: number, mid: number, lo: number, a23: boolean): number {
  if (hi - mid === 1 && mid - lo === 1) return hi;
  if (a23 && hi === 14 && mid === 3 && lo === 2) return 3;
  return 0;
}

export function classify(hand: Card[], rules: Rules): Hand {
  if (!Array.isArray(hand)) bad('hand must be an array of 3 cards');
  if (hand.length !== HAND_SIZE) {
    bad(`hand must contain exactly ${String(HAND_SIZE)} cards, got ${String(hand.length)}`);
  }
  const seen = new Set<number>();
  const ranks: number[] = [];
  let allSameSuit = true;
  let firstSuit = -1;
  for (let i = 0; i < HAND_SIZE; i += 1) {
    const c = readCard(hand[i], i);
    const id = c.suit * 100 + c.rank;
    if (seen.has(id)) bad(`hand[${String(i)}]: duplicate card rank=${String(c.rank)} suit=${String(c.suit)}`);
    seen.add(id);
    ranks.push(c.rank);
    if (i === 0) firstSuit = c.suit;
    else if (c.suit !== firstSuit) allSameSuit = false;
  }
  const sorted = ranks.slice().sort((a, b) => b - a);
  const hi = sorted[0] as number;
  const mid = sorted[1] as number;
  const lo = sorted[2] as number;

  if (hi === mid && mid === lo) return { tier: 'trips', ranks: [hi] };
  if (hi === mid) return { tier: 'pair', ranks: [hi, lo] };
  if (mid === lo) return { tier: 'pair', ranks: [mid, hi] };

  const high = straightHigh(hi, mid, lo, rules.handEval.a23);
  if (high !== 0) {
    return { tier: allSameSuit ? 'straightFlush' : 'straight', ranks: [high] };
  }
  if (allSameSuit) return { tier: 'flush', ranks: [hi, mid, lo] };
  return { tier: 'highCard', ranks: [hi, mid, lo] };
}

function tierIndex(order: TierId[], tier: TierId): number {
  const i = order.indexOf(tier);
  if (i < 0) bad(`rules.handEval.tierOrder does not list tier "${tier}"`);
  return i;
}

export function compare(a: Card[], b: Card[], rules: Rules): -1 | 0 | 1 {
  const ha = classify(a, rules);
  const hb = classify(b, rules);
  const ia = tierIndex(rules.handEval.tierOrder, ha.tier);
  const ib = tierIndex(rules.handEval.tierOrder, hb.tier);
  if (ia !== ib) return ia < ib ? 1 : -1;
  const n = Math.max(ha.ranks.length, hb.ranks.length);
  for (let i = 0; i < n; i += 1) {
    const x = ha.ranks[i] ?? 0;
    const y = hb.ranks[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// 牌堆初序固定：外层 suit 0→3，内层 rank 升序 ⇒ index = suit*13 + (rank-2)。
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (let suit = SUIT_MIN; suit <= SUIT_MAX; suit += 1) {
    for (let rank = RANK_MIN; rank <= RANK_MAX; rank += 1) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// mulberry32，但按 §2.7 的 `Rng = () => number`(uint32) 返回整数。
// 常见的浮点版 mulberry32 会在末位除以 4294967296 返回 [0,1)；把它直接喂给
// shuffle 的 `j = rng() % (i+1)` 会得到非整数的下标 j（0 与 1 之间的小数），
// 数组下标被截断后洗牌退化成固定的逆序交换 —— 所以这里取"浮点版的分子"。
// 对照断言见 test/deck.test.ts 的 deck/19（独立誊写的浮点版逐位比对）。
export function mulberry32(seed: number): Rng {
  if (typeof seed !== 'number' || !Number.isInteger(seed)) {
    bad(`seed must be an integer, got ${String(seed)}`);
  }
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// Fisher–Yates，从尾往前，j = rng() % (i+1)，原地交换并返回同一数组引用。
export function shuffle(deck: Card[], rng: Rng): Card[] {
  if (!Array.isArray(deck)) bad('deck must be an array');
  if (typeof rng !== 'function') bad('rng must be a function');
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const r = rng();
    if (typeof r !== 'number' || !Number.isInteger(r) || r < 0) {
      bad(`rng must return a non-negative uint32 integer, got ${String(r)}`);
    }
    const j = r % (i + 1);
    const tmp = deck[i] as Card;
    deck[i] = deck[j] as Card;
    deck[j] = tmp;
  }
  return deck;
}
