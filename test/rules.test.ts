// 工单 §3.1 API 契约 + §2.7 Rules schema 的验收。
import assert from 'node:assert/strict';
import { test } from './harness.ts';
import { presets, TIER_IDS, validateRules } from '../src/rules.ts';
import type { Rules, TierId } from '../src/rules.ts';
import { expectTypeError } from './fixtures.ts';

function cloneClassic(): Rules {
  return structuredClone(presets.classic);
}

function asRecord(rules: unknown): Record<string, unknown> {
  return rules as Record<string, unknown>;
}

test('rules/01 presets.classic 幂等通过 validateRules', () => {
  assert.deepEqual(validateRules(structuredClone(presets.classic)), presets.classic);
});

test('rules/02 presets.a23off 幂等通过 validateRules', () => {
  assert.deepEqual(validateRules(structuredClone(presets.a23off)), presets.a23off);
});

test('rules/03 两个 preset 仅在 handEval.a23 上不同', () => {
  const a = structuredClone(presets.classic);
  const b = structuredClone(presets.a23off);
  assert.notEqual(a.handEval.a23, b.handEval.a23);
  a.handEval.a23 = false;
  assert.deepEqual(a, b);
});

test('rules/04 classic 的每个数值逐项等于工单 §1 表格', () => {
  const c = presets.classic;
  assert.deepEqual([c.players.min, c.players.max], [2, 6]);
  assert.equal(c.ante, 1);
  assert.deepEqual([c.stake.initial, c.stake.max], [1, 16]);
  assert.deepEqual([c.bet.dark, c.bet.seen], [1, 2]);
  assert.deepEqual([c.compare.fee, c.compare.firstCycleForbidden, c.compare.tie], [2, true, 'challengerLoses']);
  assert.deepEqual([c.termination.maxStakeActions, c.termination.stallActions], [1, 3]);
  assert.deepEqual([c.showdown.tie, c.showdown.remainder], ['split', 'nearestAfterDealer']);
  assert.equal(c.allIn, 'forbidden');
  assert.equal(c.version, 1);
  assert.equal(c.dealer.next, 'rotate', '§1 庄家行：三档默认 = 轮庄');
  assert.deepEqual(c.handEval.tierOrder, [
    'trips',
    'straightFlush',
    'flush',
    'straight',
    'pair',
    'highCard',
  ]);
});

test('rules/05 未知顶层 key special235=true 抛 TypeError', () => {
  const r = cloneClassic();
  asRecord(r)['special235'] = true;
  expectTypeError(() => validateRules(r), /unknown key "special235"/, 'special235 true');
});

test('rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）', () => {
  const r = cloneClassic();
  asRecord(r)['suitTiebreak'] = false;
  expectTypeError(() => validateRules(r), /unknown key "suitTiebreak"/, 'suitTiebreak false');
});

test('rules/07 未知嵌套 key 抛（handEval / bet 内）', () => {
  const a = cloneClassic();
  asRecord(a.handEval)['wrapAround'] = true;
  expectTypeError(() => validateRules(a), /handEval.*unknown key "wrapAround"/, 'handEval.wrapAround');
  const b = cloneClassic();
  asRecord(b.bet)['seenExtra'] = 3;
  expectTypeError(() => validateRules(b), /bet.*unknown key "seenExtra"/, 'bet.seenExtra');
});

test('rules/08 缺 key 抛（顶层与嵌套各一例）', () => {
  const a = cloneClassic();
  delete asRecord(a)['ante'];
  expectTypeError(() => validateRules(a), /missing key "ante"/, '缺 ante');
  const b = cloneClassic();
  delete asRecord(b.handEval)['a23'];
  expectTypeError(() => validateRules(b), /handEval.*missing key "a23"/, '缺 handEval.a23');
});

test('rules/09 值类型错抛（字符串数字 / null / 非布尔）', () => {
  const cases: [string, (r: Rules) => void][] = [
    ['ante 字符串', (r) => { asRecord(r)['ante'] = '1'; }],
    ['players.min null', (r) => { r.players.min = null as unknown as number; }],
    ['a23 字符串', (r) => { r.handEval.a23 = 'yes' as unknown as boolean; }],
    ['fee 非整数', (r) => { r.compare.fee = 1.5; }],
    ['fee 负数', (r) => { r.compare.fee = -2; }],
  ];
  for (const [label, patch] of cases) {
    const r = cloneClassic();
    patch(r);
    expectTypeError(() => validateRules(r), null, label);
  }
});

test('rules/10 version 必须是字面量 1', () => {
  for (const bad of [2, 0, '1', true, null]) {
    const r = cloneClassic();
    asRecord(r)['version'] = bad;
    expectTypeError(() => validateRules(r), /version/, `version=${String(bad)}`);
  }
});

test('rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）', () => {
  const cases: [string, (r: Rules) => void][] = [
    ['allIn=allowed', (r) => { r.allIn = 'allowed' as unknown as 'forbidden'; }],
    ['compare.tie=defenderLoses', (r) => { r.compare.tie = 'defenderLoses' as unknown as 'challengerLoses'; }],
    ['showdown.tie=dealerWins', (r) => { r.showdown.tie = 'dealerWins' as unknown as 'split'; }],
    ['showdown.remainder=highest', (r) => { r.showdown.remainder = 'highest' as unknown as 'nearestAfterDealer'; }],
  ];
  for (const [label, patch] of cases) {
    const r = cloneClassic();
    patch(r);
    expectTypeError(() => validateRules(r), null, label);
  }
});

test('rules/12 tierOrder 必须是 6 档无重复排列', () => {
  const bad: [string, unknown][] = [
    ['缺档', TIER_IDS.slice(0, 5)],
    ['重复', ['trips', 'trips', 'flush', 'straight', 'pair', 'highCard']],
    ['未知 id', ['trips', 'straightFlush', 'flush', 'straight', 'pair', 'qqq']],
    ['非数组', 'trips'],
    ['空数组', []],
  ];
  for (const [label, order] of bad) {
    const r = cloneClassic();
    r.handEval.tierOrder = order as TierId[];
    expectTypeError(() => validateRules(r), /tierOrder/, `tierOrder ${label}`);
  }
  // 合法排列（哪怕与 §1 的牌型序相反）必须通过：档位序是配置不是常量。
  const r = cloneClassic();
  r.handEval.tierOrder = [...TIER_IDS].reverse();
  assert.doesNotThrow(() => validateRules(r));
});

test('rules/13 非对象输入一律抛', () => {
  for (const bad of [undefined, null, 42, 'classic', [], [1, 2, 3]]) {
    expectTypeError(() => validateRules(bad), null, `输入 ${JSON.stringify(bad) ?? String(bad)}`);
  }
});

test('rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）', () => {
  const v = validateRules(structuredClone(presets.classic));
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(v.players));
  assert.ok(Object.isFrozen(v.handEval.tierOrder));
  assert.throws(() => {
    v.ante = 99;
  }, TypeError);
  assert.throws(() => {
    v.handEval.tierOrder.push('trips');
  }, TypeError);
});

test('rules/15 validateRules 返回深拷贝，输入事后被改不影响副本', () => {
  const input = cloneClassic();
  const v = validateRules(input);
  input.ante = 77;
  input.handEval.tierOrder.reverse();
  assert.equal(v.ante, 1);
  assert.equal(v.handEval.tierOrder[0], 'trips');
});

test('rules/16 presets 本身深冻结', () => {
  assert.ok(Object.isFrozen(presets));
  assert.ok(Object.isFrozen(presets.classic));
  assert.throws(() => {
    presets.classic.ante = 5;
  }, TypeError);
});

test('rules/17 错误消息点名违规所在路径与 key', () => {
  const r = cloneClassic();
  asRecord(r)['mysteryFlag'] = 1;
  expectTypeError(() => validateRules(r), /at "<root>": unknown key "mysteryFlag"/, '路径+key 出现在消息里');
});

// §1 庄家行（M2）：三档配置落 Rules.dealer.next，默认 rotate；schema 补字段后未知 key 抛错行为不变。
test('rules/18 dealer.next 三档各自合法，且 preset 默认 = rotate', () => {
  for (const next of ['rotate', 'winner', 'loser'] as const) {
    const r = cloneClassic();
    r.dealer.next = next;
    const out = validateRules(r);
    assert.equal(out.dealer.next, next, `${next} 应当被原样保留`);
    assert.ok(Object.isFrozen(out.dealer), 'dealer 子对象也要深冻结');
    // 三档都不许顺手改掉别的字段
    assert.equal(out.handEval.a23, true);
    assert.equal(out.stake.max, 16);
  }
  assert.equal(presets.classic.dealer.next, 'rotate');
  assert.equal(presets.a23off.dealer.next, 'rotate', '两个 preset 只允许在 a23 上不同（见 rules/03）');
});

test('rules/19 dealer 的非法形态一律抛（枚举外值 / 缺字段 / 多余 key / 非对象 / 大小写）', () => {
  const bad = (): Record<string, unknown> => structuredClone(presets.classic) as unknown as Record<string, unknown>;
  const cases: [string, (r: Record<string, unknown>) => void][] = [
    ['枚举外值 skip', (r) => { r['dealer'] = { next: 'skip' }; }],
    ['大小写 Rotate', (r) => { r['dealer'] = { next: 'Rotate' }; }],
    ['空串', (r) => { r['dealer'] = { next: '' }; }],
    ['非字符串', (r) => { r['dealer'] = { next: 0 }; }],
    ['缺 next', (r) => { r['dealer'] = {}; }],
    ['dealer 整体缺失', (r) => { delete r['dealer']; }],
    ['dealer 非对象', (r) => { r['dealer'] = 'rotate'; }],
    ['dealer 多一个 key', (r) => { r['dealer'] = { next: 'rotate', sticky: true }; }],
  ];
  for (const [label, patch] of cases) {
    const r = bad();
    patch(r);
    expectTypeError(() => validateRules(r), null, label);
  }
  // 消息要能指到 dealer 这一层，不能只说"根对象不对"
  const r = bad();
  r['dealer'] = { next: 'skip' };
  expectTypeError(() => validateRules(r), /at "dealer\.next"/, '错误路径点名 dealer.next');
});

// rev=10 §5(d)：`validateRules` 的两条跨字段约束（src/rules.ts::crossField）此前零覆盖 ——
// 复审用独立探针证明它们经 validateRules 可达。两条 assert 的成本近乎零，就补在这里。
test('rules/20 跨字段约束：players.min≤max 与 stake.initial≤max 各自抛，等号边界放过', () => {
  const overMin = cloneClassic();
  overMin.players.min = overMin.players.max + 1;
  expectTypeError(
    () => validateRules(overMin),
    /players": min \(7\) must be <= max \(6\)/,
    'min>max 必抛（消息点名那一段与两个数）',
  );
  const overStake = cloneClassic();
  overStake.stake.initial = overStake.stake.max + 1;
  expectTypeError(
    () => validateRules(overStake),
    /stake": initial \(17\) must be <= max \(16\)/,
    'initial>max 必抛',
  );
  // 对照组一：等号是合法的（约束写的是 <=），不许把边界当违规
  const edge = cloneClassic();
  edge.players.min = edge.players.max;
  edge.stake.initial = edge.stake.max;
  const ok = validateRules(edge);
  assert.deepEqual([ok.players.min, ok.players.max], [6, 6], '等号边界不该抛');
  assert.deepEqual([ok.stake.initial, ok.stake.max], [16, 16], '等号边界不该抛');
  // 对照组二：两个 preset 自己都不该抛（否则上面两条的"抛"可能来自别处）
  for (const name of ['classic', 'a23off'] as const) {
    assert.doesNotThrow(() => validateRules(structuredClone(presets[name])), `${name} 自己不抛`);
  }
});
