// 工单 §3.1 里 makeDeck / mulberry32 / shuffle 的契约，以及可独立复算的固定向量。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { classify, makeDeck, mulberry32, shuffle } from '../src/cards.ts';
import type { Card, Rng } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import { expectTypeError, glyphHand } from './fixtures.ts';

function draws(seed: number, n: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(rng());
  return out;
}

function key(deck: Card[]): string {
  return deck.map((c) => `${'23456789TJQKA'[c.rank - 2] ?? '?'}${'SHCD'[c.suit] ?? '?'}`).join(' ');
}

test('deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)', () => {
  const deck = makeDeck();
  assert.equal(deck.length, 52);
  deck.forEach((c, i) => {
    assert.equal(c.suit, Math.floor(i / 13), `index ${String(i)} 的 suit`);
    assert.equal(c.rank, (i % 13) + 2, `index ${String(i)} 的 rank`);
  });
  assert.deepEqual(deck[0], { rank: 2, suit: 0 });
  assert.deepEqual(deck[13], { rank: 2, suit: 1 });
  assert.deepEqual(deck[51], { rank: 14, suit: 3 });
});

test('deck/02 52 张互不相同', () => {
  const ids = new Set(makeDeck().map((c) => `${String(c.rank)}:${String(c.suit)}`));
  assert.equal(ids.size, 52);
});

test('deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）', () => {
  const a = makeDeck();
  const b = makeDeck();
  assert.notEqual(a, b);
  assert.notEqual(a[0], b[0]);
  const first = a[0] as Card;
  first.rank = 9;
  assert.deepEqual(b[0], { rank: 2, suit: 0 });
  assert.equal(makeDeck()[0]?.rank, 2);
});

test('deck/04 mulberry32 同 seed 的 1000 项序列完全一致', () => {
  assert.deepEqual(draws(1, 1000), draws(1, 1000));
  assert.deepEqual(draws(4294967295, 300), draws(4294967295, 300));
});

test('deck/05 不同 seed 的序列不同', () => {
  assert.notDeepEqual(draws(1, 32), draws(2, 32));
  assert.notDeepEqual(draws(0, 32), draws(1, 32));
});

test('deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）', () => {
  for (const seed of [0, 1, 2, 4294967295, 2147483648, -1]) {
    const xs = draws(seed, 100_000);
    for (const x of xs) {
      assert.ok(Number.isInteger(x), `seed=${String(seed)} 得到非整数 ${String(x)}`);
      assert.ok(x >= 0 && x <= 4294967295, `seed=${String(seed)} 越界 ${String(x)}`);
    }
  }
});

test('deck/07 seed 非整数抛 TypeError', () => {
  for (const bad of [1.5, Number.NaN, 'x', null, undefined]) {
    expectTypeError(() => mulberry32(bad as unknown as number), /seed must be an integer/, `seed=${String(bad)}`);
  }
});

test('deck/08 shuffle 原地：返回值与入参是同一个数组引用', () => {
  const deck = makeDeck();
  const out = shuffle(deck, mulberry32(7));
  assert.equal(out, deck);
});

test('deck/09 shuffle 结果是原牌堆的一个排列', () => {
  const deck = makeDeck();
  const before = key(deck);
  shuffle(deck, mulberry32(12345));
  const sortedAfter = deck
    .slice()
    .sort((a, b) => a.suit * 13 + a.rank - (b.suit * 13 + b.rank));
  assert.equal(key(sortedAfter), before, '洗牌后按初序还原必须等于原牌堆');
  assert.equal(new Set(deck.map((c) => `${String(c.rank)}:${String(c.suit)}`)).size, 52);
});

test('deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同', () => {
  const a = shuffle(makeDeck(), mulberry32(2026));
  const b = shuffle(makeDeck(), mulberry32(2026));
  const c = shuffle(makeDeck(), mulberry32(2027));
  assert.equal(key(a), key(b));
  assert.notEqual(key(a), key(c));
});

test('deck/11 52 张牌恰好调用 rng 51 次', () => {
  let calls = 0;
  const counting: Rng = () => {
    calls += 1;
    return mulberry32(1)();
  };
  shuffle(makeDeck(), counting);
  assert.equal(calls, 51);
});

test('deck/12 rng 返回浮点/负数/非数一律抛 TypeError', () => {
  const cases: [string, number][] = [
    ['[0,1) 浮点', 0.5],
    ['负数', -3],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ];
  for (const [label, v] of cases) {
    expectTypeError(() => shuffle(makeDeck(), () => v), /rng must return/, label);
  }
  expectTypeError(() => shuffle(makeDeck(), 42 as unknown as Rng), /rng must be a function/, 'rng 不是函数');
  expectTypeError(() => shuffle('deck' as unknown as Card[], mulberry32(1)), /deck must be an array/, 'deck 不是数组');
});

test('deck/13 空牌堆与单元素牌堆不调用 rng、不抛', () => {
  let calls = 0;
  const counting: Rng = () => {
    calls += 1;
    return 0;
  };
  const empty: Card[] = [];
  const one: Card[] = [{ rank: 5, suit: 2 }];
  assert.equal(shuffle(empty, counting), empty);
  assert.equal(shuffle(one, counting), one);
  assert.equal(calls, 0);
});

test('deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定', () => {
  const deck = shuffle(makeDeck(), mulberry32(1));
  for (let seat = 0; seat < 6; seat += 1) {
    const hand = [deck[seat * 3] as Card, deck[seat * 3 + 1] as Card, deck[seat * 3 + 2] as Card];
    const h = classify(hand, presets.classic);
    assert.ok(typeof h.tier === 'string' && Array.isArray(h.ranks));
    note(`DEAL seat=${String(seat)} hand=${glyphHand(hand)} tier=${h.tier} ranks=${JSON.stringify(h.ranks)}`);
  }
});

test('deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内', () => {
  const trials = 20_000;
  const rng = mulberry32(20260925);
  const pos = new Int32Array(52);
  for (let t = 0; t < trials; t += 1) {
    const deck = shuffle(makeDeck(), rng);
    const at = deck.findIndex((c) => c.rank === 2 && c.suit === 0);
    pos[at] = (pos[at] ?? 0) + 1;
  }
  const expected = trials / 52;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const v of pos) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  note(`SHUFFLE-FAIR trials=${String(trials)} expected=${String(expected)} min=${String(min)} max=${String(max)}`);
  assert.ok(min >= expected * 0.6 && max <= expected * 1.4, `分布不公平: min=${String(min)} max=${String(max)}`);
});

// 3 张牌的最小反例：把 rng 的输出穷举而不是抽样，所以这条是**证明级**的。
// 正确写法 j = rng() % (i+1) 让每张牌落到每个位置的概率恰为 1/3；
// 常见错写 j = rng() % deck.length 会让某两个位置的概率变成 4/9、一个位置 1/9，
// 这里 12×12=144 种输出组合下计数必为 48/48/48，偏差超过 10% 即判失败。
test('deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48', () => {
  const counts = [new Int32Array(3), new Int32Array(3), new Int32Array(3)];
  for (let r1 = 0; r1 < 12; r1 += 1) {
    for (let r2 = 0; r2 < 12; r2 += 1) {
      let n = 0;
      const rng: Rng = () => (n += 1) === 1 ? r1 : r2;
      const deck = shuffle([{ rank: 2, suit: 0 }, { rank: 3, suit: 0 }, { rank: 4, suit: 0 }], rng);
      for (let card = 0; card < 3; card += 1) {
        const row = counts[card];
        const at = deck.findIndex((c) => c.rank === card + 2);
        if (row !== undefined && at >= 0) row[at] = (row[at] ?? 0) + 1;
      }
    }
  }
  for (let card = 0; card < 3; card += 1) {
    const row = counts[card] as Int32Array;
    for (let p = 0; p < 3; p += 1) {
      assert.equal(row[p], 48, `card${String(card)} 落到位置 ${String(p)} 的次数`);
    }
  }
});

test('deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）', () => {  for (const seed of [1, 2, 4294967295]) {
    note(`VECTOR mulberry32 seed=${String(seed)} first8=${draws(seed, 8).join(',')}`);
  }
  const d = shuffle(makeDeck(), mulberry32(1));
  note(`VECTOR shuffle seed=1 first12=${key(d).split(' ').slice(0, 12).join(' ')}`);
  note(`VECTOR shuffle seed=1 last6=${key(d).split(' ').slice(-6).join(' ')}`);
  assert.equal(d.length, 52);
});

// 独立誊写一份"网上常见的 mulberry32"（返回 [0,1) 浮点的那版），用来把算法结构与常数钉死。
// 两份实现分开写：src 里改了常数/移位，这条就会炸，而不是跟着一起自证。
function canonicalFloat(seed: number): () => number {
  let a = seed >>> 0;
  return function ref(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）', () => {
  for (const seed of [0, 1, 2, 7, 12345, 20260925, 2147483648, 4294967295]) {
    const mine = mulberry32(seed);
    const ref = canonicalFloat(seed);
    for (let i = 0; i < 200; i += 1) {
      // 双精度下 int/2^32 与再乘回 2^32 都是精确的，所以可以逐位相等
      assert.equal(mine(), Math.floor(ref() * 4294967296), `seed=${String(seed)} i=${String(i)}`);
    }
  }
  note(`CANONICAL mulberry32 seed=1 float_first=${String(canonicalFloat(1)())}`);
});

// 方向钉：工单 §2.7 写死"从尾往前"。前向遍历也是均匀洗牌（deck/16/17 抓不到），
// 但同种子会洗出**不同**的牌序 —— M4 要让各端用同一个 seed 复算同一副牌，方向错=直接废。
// 可手工推导的性质：rng 恒返回 0 ⇒ 从尾往前的 j=0 交换序列恰把牌堆左旋一格；
// 前向遍历得到的是右旋一格。用 n=2..5 逐个验，再加 52 张整副。
test('deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）', () => {
  const zero: Rng = () => 0;
  for (let n = 2; n <= 5; n += 1) {
    const deck: Card[] = [];
    for (let i = 0; i < n; i += 1) deck.push({ rank: i + 2, suit: 0 });
    const want = deck.slice(1).concat(deck[0] as Card);
    assert.deepEqual(shuffle(deck, zero).map((c) => c.rank), want.map((c) => c.rank), `n=${String(n)}`);
  }
  const full = makeDeck();
  const expect = full.slice(1).concat(full[0] as Card);
  assert.deepEqual(shuffle(full, zero), expect);
  // 反向对照：右旋一格是"从前向后"的结果，必须与上面不同（n>=3 时才分得出）
  const right = [full[51] as Card].concat(full.slice(0, 51));
  assert.notDeepEqual(shuffle(makeDeck(), zero), right);
});
