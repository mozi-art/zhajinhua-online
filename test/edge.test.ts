// 工单 §3.5：边界用例（正向陷阱牌 + 负向非法输入）。
import assert from 'node:assert/strict';
import { test } from './harness.ts';
import { classify, compare } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import type { Card } from '../src/cards.ts';
import { expectTypeError, handOf } from './fixtures.ts';

const C = presets.classic;
const A = presets.a23off;

// §3.5 逐条对号：名字里的花色即工单里的花色（S=♠ H=♥ C=♣ D=♦）。
test('edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）', () => {
  assert.equal(classify(handOf('AS 2D 3C'), C).tier, 'straight');
  assert.equal(compare(handOf('AS 2D 3C'), handOf('3S 4D 5C'), C), -1);
});

test('edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）', () => {
  assert.deepEqual(classify(handOf('AH 2H 3H'), C), { tier: 'straightFlush', ranks: [3] });
  assert.equal(compare(handOf('AH 2H 3H'), handOf('4C 5D 6C'), C), 1);
});

test('edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）', () => {
  assert.equal(classify(handOf('2D 2C 2H'), C).tier, 'trips');
  assert.equal(classify(handOf('AS KS QS'), C).tier, 'straightFlush');
  assert.equal(compare(handOf('2D 2C 2H'), handOf('AS KS QS'), C), 1);
});

test('edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）', () => {
  assert.deepEqual(classify(handOf('AD AC 3S'), C).ranks, [14, 3]);
  assert.deepEqual(classify(handOf('KD KC AS'), C).ranks, [13, 14]);
  assert.equal(compare(handOf('AD AC 3S'), handOf('KD KC AS'), C), 1);
});

test('edge/05 §3.5 同点同级 → 0（花色完全不参与）', () => {
  assert.equal(compare(handOf('9S 9D 2C'), handOf('9H 9C 2D'), C), 0);
  assert.equal(compare(handOf('AS KS QS'), handOf('AC KC QC'), C), 0);
  assert.equal(compare(handOf('5H 6H 7H'), handOf('5C 6C 7C'), C), 0);
});

test('edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子', () => {
  assert.deepEqual(classify(handOf('AS KD 2C'), C), { tier: 'highCard', ranks: [14, 13, 2] });
  assert.deepEqual(classify(handOf('AS KD 2C'), A), { tier: 'highCard', ranks: [14, 13, 2] });
  assert.equal(compare(handOf('AS KD 2C'), handOf('2S 3D 4C'), C), -1);
});

test('edge/07 最大豹子 > 最小豹子 > 任意同花顺', () => {
  assert.equal(compare(handOf('AS AH AD'), handOf('2S 2H 2D'), C), 1);
  assert.equal(compare(handOf('2S 2H 2D'), handOf('QD KD AD'), C), 1);
});

test('edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张', () => {
  assert.deepEqual(classify(handOf('AH 2H 3H'), A), { tier: 'flush', ranks: [14, 3, 2] });
  assert.deepEqual(classify(handOf('AS 2D 3C'), A), { tier: 'highCard', ranks: [14, 3, 2] });
  assert.equal(compare(handOf('AS 2D 3C'), handOf('3S 4D 5C'), A), -1);
  // 降档不等于降点：§1 牌型序里同花 > 顺子，所以 A♥2♥3♥ 在 a23off 下仍赢普通顺子
  assert.equal(compare(handOf('AH 2H 3H'), handOf('4C 5D 6C'), A), 1);
  // 但它输给点数更大的同花（同花按 [大,中,小] 逐位比）
  assert.equal(compare(handOf('AH 2H 3H'), handOf('AS KS 5S'), A), -1);
});

test('edge/09 A 在非顺子牌型里取 14', () => {
  assert.deepEqual(classify(handOf('AS 7D 4C'), C).ranks, [14, 7, 4]);
  // 参照手牌必须也是单张：KQJ 是顺子，会按档位直接赢下单张 A
  assert.deepEqual(classify(handOf('KC QD 5C'), C).tier, 'highCard');
  assert.equal(compare(handOf('AS 7D 4C'), handOf('KC QD 5C'), C), 1);
  assert.deepEqual(classify(handOf('AS AD 7C'), C).ranks, [14, 7]);
  assert.equal(compare(handOf('AS AD 7C'), handOf('KS KD AC'), C), 1);
});

test('edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位', () => {
  const want: [string, number][] = [
    ['2S 2D 2C', 1],
    ['AS 2S 3S', 1],
    ['5D 6C 7H', 1],
    ['9S 9D 2C', 2],
    ['4S 9S JS', 3],
    ['8D 6H 4S', 3],
  ];
  for (const [text, len] of want) {
    assert.equal(classify(handOf(text), C).ranks.length, len, text);
  }
});

test('edge/11 非法手牌：长度≠3 抛 TypeError', () => {
  const zero: Card[] = [];
  const one: Card[] = [{ rank: 5, suit: 0 }];
  const four: Card[] = [...handOf('AS 2D 3C'), { rank: 4, suit: 3 }];
  expectTypeError(() => classify(zero, C), /exactly 3/, '0 张');
  expectTypeError(() => classify(one, C), /exactly 3/, '1 张');
  expectTypeError(() => classify(four, C), /exactly 3/, '4 张');
});

test('edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError', () => {
  const dup: Card[] = [
    { rank: 7, suit: 1 },
    { rank: 7, suit: 1 },
    { rank: 2, suit: 3 },
  ];
  expectTypeError(() => classify(dup, C), /duplicate card/, '代码构造的重复牌');
  expectTypeError(() => classify(handOf('7S 7S 2C'), C), /duplicate card/, '字面量重复牌');
});

test('edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError', () => {
  const third: Card = { rank: 12, suit: 2 };
  const bad: [string, Card[]][] = [
    ['rank=15', [{ rank: 15, suit: 0 }, { rank: 7, suit: 1 }, third]],
    ['rank=1', [{ rank: 1, suit: 0 }, { rank: 7, suit: 1 }, third]],
    ['rank=2.5', [{ rank: 2.5, suit: 0 }, { rank: 7, suit: 1 }, third]],
    ['rank=NaN', [{ rank: Number.NaN, suit: 0 }, { rank: 7, suit: 1 }, third]],
    ['suit=4', [{ rank: 7, suit: 4 }, { rank: 3, suit: 1 }, third]],
    ['suit=-1', [{ rank: 7, suit: -1 }, { rank: 3, suit: 1 }, third]],
    ['suit=1.5', [{ rank: 7, suit: 1.5 }, { rank: 3, suit: 1 }, third]],
  ];
  for (const [label, hand] of bad) {
    expectTypeError(() => classify(hand, C), /out of range|must be an integer/, label);
  }
});

test('edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError', () => {
  expectTypeError(() => classify('AS 2D 3C' as unknown as Card[], C), /must be an array/, '字符串当手牌');
  expectTypeError(
    () => classify([null, { rank: 2, suit: 0 }, { rank: 3, suit: 0 }] as unknown as Card[], C),
    /card must be an object/,
    '元素为 null',
  );
  expectTypeError(
    () => classify([{ rank: 2 }, { rank: 3, suit: 0 }, { rank: 4, suit: 0 }] as unknown as Card[], C),
    /suit must be an integer/,
    '缺 suit 字段',
  );
  expectTypeError(
    () => classify([{ suit: 0 }, { rank: 3, suit: 0 }, { rank: 4, suit: 0 }] as unknown as Card[], C),
    /rank must be an integer/,
    '缺 rank 字段',
  );
});

test('edge/15 compare 两侧都继承 classify 的非法输入检查', () => {
  const good = handOf('AS 2D 3C');
  expectTypeError(() => compare(good, handOf('7S 7S 2C'), C), /duplicate card/, 'b 侧重复牌');
  expectTypeError(() => compare(handOf('7S 7S 2C'), good, C), /duplicate card/, 'a 侧重复牌');
  expectTypeError(() => compare(good, [], C), /exactly 3/, 'b 侧空手牌');
});

test('edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError', () => {
  const broken = { version: 1 } as unknown as Rules;
  expectTypeError(
    () => classify(handOf('AS 2D 3C'), broken),
    /Cannot read|handEval/,
    '缺 handEval 的 rules',
  );
});

test('edge/17 单张的型内比较只看归一化后的三点', () => {
  assert.equal(compare(handOf('AS KD 5C'), handOf('AH QD 7C'), C), 1);
  assert.equal(compare(handOf('3S 5D 7C'), handOf('2D 4C 6H'), C), 1);
  assert.equal(compare(handOf('3S 5D 7C'), handOf('4S 6D 8H'), C), -1);
  assert.equal(compare(handOf('9S 6D 3C'), handOf('9H 6C 3D'), C), 0);
});
