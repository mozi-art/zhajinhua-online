// 工单 §3.2 + §3.3：穷举 C(52,3)=22100 手，逐类比对闭式期望与硬编码锚点。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { classify } from '../src/cards.ts';
import { presets, TIER_IDS } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import type { Card } from '../src/cards.ts';
import {
  canonicalClasses,
  comb,
  countSum,
  enumerateAll,
  expectedCounts,
  fmtCounts,
  handOf,
  TOTAL_HANDS,
} from './fixtures.ts';
import type { Counts, EnumResult } from './fixtures.ts';

const CACHE = new Map<string, EnumResult>();

function allOf(rules: Rules, key: string): EnumResult {
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;
  const made = enumerateAll(rules);
  CACHE.set(key, made);
  return made;
}

// 锚点表：工单 §3.3 的第二道保险，逐字抄自工单，不许由代码推导。
const ANCHORS: Record<'classic' | 'a23off', Counts> = {
  classic: { trips: 52, straightFlush: 48, flush: 1096, straight: 720, pair: 3744, highCard: 16440 },
  a23off: { trips: 52, straightFlush: 44, flush: 1100, straight: 660, pair: 3744, highCard: 16500 },
};

for (const name of ['classic', 'a23off'] as const) {
  test(`classify/${name} 穷举 22100 手 = 闭式期望`, () => {
    const rules = presets[name];
    const got = allOf(rules, name).counts;
    assert.deepEqual(got, expectedCounts(rules), `实际 ${fmtCounts(got)} vs 期望 ${fmtCounts(expectedCounts(rules))}`);
  });
  test(`classify/${name} 穷举 22100 手 = 锚点表`, () => {
    const got = allOf(presets[name], name).counts;
    assert.deepEqual(got, ANCHORS[name], `实际 ${fmtCounts(got)}`);
  });
  test(`classify/${name} 枚举手数与六类之和都等于 22100`, () => {
    const rules = presets[name];
    assert.equal(allOf(rules, name).visited, TOTAL_HANDS);
    assert.equal(countSum(allOf(rules, name).counts), TOTAL_HANDS);
    assert.equal(countSum(expectedCounts(rules)), TOTAL_HANDS);
    assert.equal(countSum(ANCHORS[name]), TOTAL_HANDS);
  });
}

test('classify/档位集合 六档键完全一致且无重复，计数均为非负整数', () => {
  const c = allOf(presets.classic, 'classic').counts;
  const a = allOf(presets.a23off, 'a23off').counts;
  assert.deepEqual(new Set(TIER_IDS).size, TIER_IDS.length);
  assert.deepEqual(Object.keys(c).sort(), [...TIER_IDS].sort());
  assert.deepEqual(Object.keys(a).sort(), [...TIER_IDS].sort());
  for (const t of TIER_IDS) {
    const cv = c[t];
    const av = a[t];
    assert.ok(Number.isInteger(cv) && cv >= 0, `classic ${t}=${String(cv)}`);
    assert.ok(Number.isInteger(av) && av >= 0, `a23off ${t}=${String(av)}`);
  }
});

test('classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动', () => {
  const ec = expectedCounts(presets.classic);
  const ea = expectedCounts(presets.a23off);
  assert.equal(ec.trips, ea.trips);
  assert.equal(ec.pair, ea.pair);
  assert.equal(ec.straightFlush - ea.straightFlush, 4, 'runs 差 1 ⇒ 同花顺差 4');
  assert.equal(ec.straight - ea.straight, 60, 'runs 差 1 ⇒ 顺子差 4^3-4');
  assert.equal(ea.flush - ec.flush, 4);
  assert.equal(ea.highCard - ec.highCard, 60);
  assert.equal(ec.trips, 13 * comb(4, 3));
  assert.equal(ec.pair, 13 * comb(4, 2) * 12 * 4);
});

test('classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）', () => {
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const classes = canonicalClasses();
  for (const rules of [presets.classic, presets.a23off]) {
    for (const cls of classes) {
      const base = classify(cls, rules);
      for (const p of perms) {
        const reordered: Card[] = [
          cls[p[0] as number] as Card,
          cls[p[1] as number] as Card,
          cls[p[2] as number] as Card,
        ];
        assert.deepEqual(classify(reordered, rules), base, JSON.stringify({ cls, p }));
      }
    }
  }
});

test('classify/A23 一族 64 手在两 preset 下的迁移符合公式', () => {
  const tally = (): Record<'straight' | 'straightFlush' | 'flush' | 'highCard', number> => ({
    straight: 0,
    straightFlush: 0,
    flush: 0,
    highCard: 0,
  });
  const got: Record<'classic' | 'a23off', ReturnType<typeof tally>> = {
    classic: tally(),
    a23off: tally(),
  };
  for (let s1 = 0; s1 < 4; s1 += 1) {
    for (let s2 = 0; s2 < 4; s2 += 1) {
      for (let s3 = 0; s3 < 4; s3 += 1) {
        const hand: Card[] = [
          { rank: 14, suit: s1 },
          { rank: 3, suit: s2 },
          { rank: 2, suit: s3 },
        ];
        for (const name of ['classic', 'a23off'] as const) {
          const t = classify(hand, presets[name]).tier;
          if (t !== 'straight' && t !== 'straightFlush' && t !== 'flush' && t !== 'highCard') {
            throw new Error(`A23 族被判成 ${t}`);
          }
          got[name][t] += 1;
        }
      }
    }
  }
  assert.deepEqual(got.classic, { straight: 60, straightFlush: 4, flush: 0, highCard: 0 });
  assert.deepEqual(got.a23off, { straight: 0, straightFlush: 0, flush: 4, highCard: 60 });
});

test('classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1', () => {
  const cases: [string, number][] = [
    ['AS 2S 3S', 3],
    ['AS 2D 3C', 3],
    ['2S 3D 4C', 4],
    ['JS QD KC', 13],
    ['QS KD AC', 14],
    ['QS KS AS', 14],
  ];
  for (const [text, high] of cases) {
    const h = classify(handOf(text), presets.classic);
    assert.ok(h.tier === 'straight' || h.tier === 'straightFlush', `${text} 应为顺子族，实际 ${h.tier}`);
    assert.deepEqual(h.ranks, [high], text);
  }
});

test('classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手', () => {
  let checked = 0;
  for (let pairRank = 2; pairRank <= 14; pairRank += 1) {
    for (let sa = 0; sa < 4; sa += 1) {
      for (let sb = sa + 1; sb < 4; sb += 1) {
        for (let kickerRank = 2; kickerRank <= 14; kickerRank += 1) {
          if (kickerRank === pairRank) continue;
          for (let sc = 0; sc < 4; sc += 1) {
            const hand: Card[] = [
              { rank: pairRank, suit: sa },
              { rank: pairRank, suit: sb },
              { rank: kickerRank, suit: sc },
            ];
            const h = classify(hand, presets.classic);
            assert.equal(h.tier, 'pair', JSON.stringify(hand));
            assert.deepEqual(h.ranks, [pairRank, kickerRank], JSON.stringify(hand));
            checked += 1;
          }
        }
      }
    }
  }
  assert.equal(checked, ANCHORS.classic.pair);
});

test('classify/归一化键 豹子 ranks=[r]，穷举 52 手', () => {
  let checked = 0;
  for (let r = 2; r <= 14; r += 1) {
    for (let sa = 0; sa < 4; sa += 1) {
      for (let sb = sa + 1; sb < 4; sb += 1) {
        for (let sc = sb + 1; sc < 4; sc += 1) {
          const hand: Card[] = [
            { rank: r, suit: sa },
            { rank: r, suit: sb },
            { rank: r, suit: sc },
          ];
          assert.deepEqual(classify(hand, presets.classic), { tier: 'trips', ranks: [r] });
          checked += 1;
        }
      }
    }
  }
  assert.equal(checked, 52);
});

test('classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算', () => {
  for (const name of ['classic', 'a23off'] as const) {
    const rules = presets[name];
    note(`ENUM ${name} actual   ${fmtCounts(allOf(rules, name).counts)}`);
    note(`ENUM ${name} closed   ${fmtCounts(expectedCounts(rules))}`);
    note(`ENUM ${name} anchor   ${fmtCounts(ANCHORS[name])}`);
  }
  assert.ok(true);
});
