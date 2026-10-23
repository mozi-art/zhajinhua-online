// 工单 §3.4：compare 的代数性质。传递性按"花色无关规范类"做穷举而不是抽样。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { classify, compare, makeDeck, mulberry32 } from '../src/cards.ts';
import { presets, TIER_IDS } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import type { Card } from '../src/cards.ts';
import { canonicalClasses, cloneRules, handOf } from './fixtures.ts';

const CLASS = canonicalClasses();
const N = CLASS.length;

function cmp(a: Card[], b: Card[], rules: Rules = presets.classic): number {
  return compare(a, b, rules);
}

let cachedMatrix: Int8Array | null = null;

// 关系矩阵：M[i*N+j] = 0 表示 class_i < class_j，1 表示相等，2 表示大于。
function matrix(): Int8Array {
  if (cachedMatrix !== null) return cachedMatrix;
  const m = new Int8Array(N * N);
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      m[i * N + j] = cmp(CLASS[i] as Card[], CLASS[j] as Card[]) + 1;
    }
  }
  cachedMatrix = m;
  return m;
}

// 独立参考实现：v1 无花色、无 235，所以"确实可以"打包成单个整数键。
// 与 compare 的实现路径不同（这里只做整数减法取符号），用来交叉验。
function refKey(hand: Card[], rules: Rules): number {
  const h = classify(hand, rules);
  const tierFromTop = TIER_IDS.length - 1 - rules.handEval.tierOrder.indexOf(h.tier);
  const r0 = h.ranks[0] ?? 0;
  const r1 = h.ranks[1] ?? 0;
  const r2 = h.ranks[2] ?? 0;
  return tierFromTop * 1_000_000 + r0 * 10_000 + r1 * 100 + r2;
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

test('compare/01 规范类数量 = C(15,3) = 455', () => {
  assert.equal(N, 455);
  assert.equal(new Set(CLASS.map((h) => JSON.stringify(h.map((c) => c.rank)))).size, 455);
});

test('compare/02 自反：每类与自身比较 = 0', () => {
  const m = matrix();
  for (let i = 0; i < N; i += 1) {
    assert.equal(m[i * N + i], 1, `class ${String(i)} 自反不等于 0`);
  }
});

test('compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)', () => {
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const ab = cmp(CLASS[i] as Card[], CLASS[j] as Card[]);
      const ba = cmp(CLASS[j] as Card[], CLASS[i] as Card[]);
      // === 而不是 strictEqual：后者按 Object.is 区分 0 与 -0
      assert.ok(ab === -ba, `反对称破坏: i=${String(i)} j=${String(j)}`);
      assert.ok(ab === -1 || ab === 0 || ab === 1, `返回值必须在 -1|0|1 内: ${String(ab)}`);
      assert.ok(!Object.is(ab, -0), '不许返回 -0');
    }
  }
});

test('compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组', () => {
  const m = matrix();
  let triples = 0;
  for (let i = 0; i < N; i += 1) {
    const rowI = i * N;
    for (let j = 0; j < N; j += 1) {
      if ((m[rowI + j] ?? 0) < 1) continue;
      const rowJ = j * N;
      for (let k = 0; k < N; k += 1) {
        triples += 1;
        if ((m[rowJ + k] ?? 0) < 1) continue;
        if ((m[rowI + k] ?? 0) < 1) {
          throw new Error(
            `非传递: i=${String(i)}(${JSON.stringify(CLASS[i])}) j=${String(j)}(${JSON.stringify(CLASS[j])}) k=${String(k)}(${JSON.stringify(CLASS[k])})`,
          );
        }
      }
    }
  }
  note(`TRANS full_triples=${String(N ** 3)} implied_triples=${String(triples)}`);
  assert.ok(triples > 1_000_000, '传递性检查覆盖的三元组过少');
});

test('compare/05 花色不参与：全体花色平移 +1 后仍判 0', () => {
  let ties = 0;
  for (const cls of CLASS) {
    const shifted: Card[] = cls.map((c) => ({ rank: c.rank, suit: (c.suit + 1) % 4 }));
    assert.equal(cmp(cls, shifted), 0, JSON.stringify({ cls, shifted }));
    ties += 1;
  }
  assert.equal(ties, N);
});

test('compare/06 与独立整数键参考实现交叉一致（455^2 全对）', () => {
  for (let i = 0; i < N; i += 1) {
    const ki = refKey(CLASS[i] as Card[], presets.classic);
    for (let j = 0; j < N; j += 1) {
      const kj = refKey(CLASS[j] as Card[], presets.classic);
      assert.equal(
        cmp(CLASS[i] as Card[], CLASS[j] as Card[]),
        sign(ki - kj),
        `i=${String(i)} j=${String(j)}`,
      );
    }
  }
});

test('compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变', () => {
  const rev = cloneRules(presets.classic);
  rev.handEval.tierOrder = [...TIER_IDS].reverse();
  let flipped = 0;
  let sameTier = 0;
  for (let i = 0; i < N; i += 1) {
    const ti = classify(CLASS[i] as Card[], presets.classic).tier;
    for (let j = 0; j < N; j += 1) {
      const tj = classify(CLASS[j] as Card[], presets.classic).tier;
      const base = cmp(CLASS[i] as Card[], CLASS[j] as Card[]);
      const now = cmp(CLASS[i] as Card[], CLASS[j] as Card[], rev);
      if (ti === tj) {
        sameTier += 1;
        assert.equal(now, base, `同档不该被 tierOrder 反转影响: i=${String(i)} j=${String(j)}`);
      } else {
        flipped += 1;
        assert.equal(now, -base, `跨档应翻转: i=${String(i)} j=${String(j)}`);
      }
    }
  }
  assert.ok(flipped > 0 && sameTier > 0);
});

test('compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）', () => {
  const trips = handOf('2S 2D 2C');
  const pair = handOf('9S 9D 4C');
  assert.equal(cmp(pair, trips), -1, 'classic 下豹子赢对子');
  const r = cloneRules(presets.classic);
  r.handEval.tierOrder = ['pair', 'trips', 'straightFlush', 'flush', 'straight', 'highCard'];
  assert.equal(cmp(pair, trips, r), 1, '改序后对子应赢豹子');
});

test('compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）', () => {
  const rng = mulberry32(20260925);
  const deck = makeDeck();
  const hands: Card[][] = [];
  for (let t = 0; t < 1000; t += 1) {
    const idx = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 51; i > 48; i -= 1) {
      const j = rng() % (i + 1);
      const tmp = idx[i] as number;
      idx[i] = idx[j] as number;
      idx[j] = tmp;
    }
    hands.push([deck[idx[49] as number] as Card, deck[idx[50] as number] as Card, deck[idx[51] as number] as Card]);
  }
  const sorted = hands.slice().sort((a, b) => cmp(b, a));
  let ties = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i; j < sorted.length; j += 1) {
      const s = cmp(sorted[i] as Card[], sorted[j] as Card[]);
      if (s === 0) ties += 1;
      assert.ok(s >= 0, `排序后 i=${String(i)} j=${String(j)} 出现逆序 ${String(s)}`);
    }
  }
  assert.ok(ties > 1000, `花色不参与应当产生大量平局，实际 ${String(ties)}`);
  note(`SORT1000 seed=20260925 ties=${String(ties)} first=${JSON.stringify(sorted[0])}`);
});

test('compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）', () => {
  const chain: [string, Card[]][] = [
    ['trips', handOf('2S 2D 2C')],
    ['straightFlush', handOf('AS 2S 3S')],
    ['flush', handOf('4S 9S JS')],
    ['straight', handOf('5D 4C 3H')],
    ['pair', handOf('7S 7D 2H')],
    ['highCard', handOf('8D 6H 4S')],
  ];
  for (let i = 0; i < chain.length; i += 1) {
    assert.equal(classify(chain[i]?.[1] as Card[], presets.classic).tier, chain[i]?.[0] ?? '?', chain[i]?.[0] ?? '?');
    for (let j = 0; j < chain.length; j += 1) {
      const want = sign(j - i);
      assert.equal(
        cmp(chain[i]?.[1] as Card[], chain[j]?.[1] as Card[]),
        want,
        `${String(i)} vs ${String(j)}: ${chain[i]?.[0]} vs ${chain[j]?.[0]}`,
      );
    }
  }
});

test('compare/11 tierOrder 缺档时 compare 抛错而不静默', () => {
  const broken = cloneRules(presets.classic);
  broken.handEval.tierOrder = ['trips', 'straightFlush', 'flush', 'straight', 'highCard'];
  // 两侧同档（trips 在表内）不会走到缺档分支，必须用跨档对触发
  assert.throws(
    () => compare(handOf('2S 2D 2C'), handOf('9S 9D 4C'), broken),
    (err: unknown) => err instanceof TypeError && /tierOrder does not list tier "pair"/.test(String((err as Error).message)),
  );
});

test('compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言', () => {
  const cases: [string, string, number][] = [
    ['AS 2S 3S', 'QD KC JS', 1],
    ['2S 3D 4C', 'AS KS QS', -1],
    ['4S 9S JS', 'AS 2S 3S', -1],
    ['2S 2D 9C', '3S 4D 5C', -1],
    ['9S 9D 2C', '9C 9S 2D', 0],
  ];
  for (const [x, y, want] of cases) {
    assert.equal(cmp(handOf(x), handOf(y)), want, `${x} vs ${y}`);
    note(`CMP ${x} vs ${y} = ${String(want)}`);
  }
});
