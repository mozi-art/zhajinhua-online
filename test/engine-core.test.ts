// M1 · 开局与状态基础：配置校验、发牌确定性、纯函数性、资金守恒、状态指纹。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { makeDeck, mulberry32, shuffle } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import { moneyTotal, startHand, stateHash, totalChips } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { config3, hand3, script } from './engine-fixtures.ts';

const call = (seat: number): Action => ({ kind: 'call', seat });
const raise = (seat: number): Action => ({ kind: 'raise', seat });

function deepFreeze(v: unknown): void {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const key of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[key]);
  }
}

test('core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零', () => {
  const s = hand3(1, 0);
  assert.equal(s.phase, 'betting');
  assert.equal(s.stake, presets.classic.stake.initial);
  assert.equal(s.pot, 3 * presets.classic.ante);
  assert.equal(s.turn, 1);
  assert.equal(s.seq, 1);
  assert.equal(s.log.length, 1);
  assert.equal(s.log[0]?.type, 'deal');
  assert.equal(s.terminal, null);
  assert.equal(s.settledSeq, null);
  for (const seat of s.seats) {
    assert.equal(seat.chips, 100 - presets.classic.ante);
    assert.equal(seat.committed, presets.classic.ante);
    assert.equal(seat.active, true);
    assert.equal(seat.out, null);
    assert.equal(seat.looked, false);
    assert.equal(seat.actionsTotal, 0);
    assert.equal(seat.actionsAtStake, 0);
    assert.equal(seat.revealed, false);
    assert.equal(seat.hand.length, 3);
  }
});

test('core/02 发牌互不重叠且都来自标准 52 张', () => {
  const s = hand3(77, 0);
  const ids = s.seats.flatMap((x) => x.hand.map((c) => `${String(c.rank)}:${String(c.suit)}`));
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
  for (const c of s.seats.flatMap((x) => x.hand)) {
    assert.ok(c.rank >= 2 && c.rank <= 14);
    assert.ok(c.suit >= 0 && c.suit <= 3);
  }
});

// 发牌序本身是契约（M4 各端要用同一 seed 复算同一副牌）：从庄家下家起、环形座位序、每人连续 3 张。
test('core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）', () => {
  for (const dealer of [0, 1, 2]) {
    const s = hand3(500, dealer);
    const deck = shuffle(makeDeck(), mulberry32(500));
    const order = [1, 2, 0].map((o) => (dealer + o) % 3);
    order.forEach((seat, i) => {
      const expect = [deck[i * 3] as object, deck[i * 3 + 1] as object, deck[i * 3 + 2] as object];
      assert.deepEqual(s.seats.find((x) => x.seat === seat)?.hand, expect, `dealer=${String(dealer)} seat=${String(seat)}`);
    });
    assert.equal(s.turn, order[0]);
  }
});

test('core/04 庄家必须在座位表里', () => {
  assert.throws(() => startHand({ ...config3(1), dealer: 5 }), TypeError);
  assert.throws(() => startHand({ ...config3(1), dealer: -1 }), TypeError);
});

test('core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）', () => {
  assert.throws(() => startHand({ rules: presets.classic, seed: 1, dealer: 0, seats: [{ seat: 0, chips: 100 }] }), /seat count/);
  assert.throws(
    () =>
      startHand({
        rules: presets.classic,
        seed: 1,
        dealer: 0,
        seats: [0, 1, 2, 3, 4, 5, 6].map((seat) => ({ seat, chips: 100 })),
      }),
    /seat count/,
  );
  assert.throws(() => startHand({ rules: presets.classic, seed: 1, dealer: 0, seats: [{ seat: 0, chips: 5 }, { seat: 0, chips: 5 }, { seat: 1, chips: 5 }] }), /duplicate seat/);
  assert.throws(() => startHand({ rules: presets.classic, seed: 1, dealer: 0, seats: [{ seat: 0, chips: 1 }, { seat: 1, chips: 1 }, { seat: 2, chips: 0 }] }), /cannot cover ante/);
  assert.throws(() => startHand({ ...config3(1.5) }), /seed must be an integer/);
  assert.throws(() => startHand({ ...config3(Number.NaN) }), /seed must be an integer/);
});

test('core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）', () => {
  const s = hand3(3, 0);
  const snap = stateHash(s);
  deepFreeze(s);
  const next = apply(s, call(1));
  assert.equal(stateHash(s), snap, '旧状态被改动了');
  assert.notEqual(next, s);
  assert.equal(next.seq, s.seq + 1);
});

test('core/07 stateHash 对状态变化敏感、对重放稳定', () => {
  const a = stateHash(script(hand3(11), [call(1), call(2), call(0)]));
  const b = stateHash(script(hand3(11), [call(1), call(2), call(0)]));
  const c = stateHash(script(hand3(12), [call(1), call(2), call(0)]));
  const d = stateHash(script(hand3(11), [call(1), call(2)]));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.match(a, /^[0-9a-f]{16}$/);
  note(`HASH seed11-3calls=${a}`);
});

test('core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值', () => {
  const s0 = hand3(1, 0);
  assert.equal(s0.phase, 'betting');
  const s1 = script(s0, [call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0)]);
  assert.equal(s1.phase, 'awaitingSettle');
  assert.notEqual(s1.terminal, null);
  const s2 = apply(s1, { kind: 'settle' });
  assert.equal(s2.phase, 'settled');
  assert.ok(['betting', 'awaitingSettle', 'settled'].includes(s2.phase));
});

test('core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额', () => {
  const s = hand3(31, 0);
  const total = moneyTotal(s);
  assert.equal(total, 300);
  assert.equal(totalChips(s), 297);
  const ended = script(s, [call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0)]);
  assert.equal(moneyTotal(ended), total);
  const settled = apply(ended, { kind: 'settle' });
  assert.equal(moneyTotal(settled), total);
  assert.equal(settled.pot, 0);
  assert.equal(totalChips(settled), 300);
});

test('core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）', () => {
  const a = startHand(config3(91));
  const b = startHand(config3(91));
  assert.deepEqual(a, b);
  assert.notEqual(a, b, '应当是两份独立对象');
  assert.equal(stateHash(a), stateHash(b));
});

test('core/11 日志单调：seq 逐条 +1，type 全部来自固定集合', () => {
  const s = script(hand3(1, 0), [
    { kind: 'look', seat: 1 },
    call(1),
    call(2),
    call(0),
    call(1),
    call(2),
    call(0),
    call(1),
    call(2),
    call(0),
  ]);
  const allowed = new Set(['deal', 'look', 'call', 'raise', 'fold', 'compare', 'eliminate', 'terminal', 'settle']);
  s.log.forEach((e, i) => {
    assert.equal(e.seq, i + 1, `第 ${String(i)} 条日志 seq 不连续`);
    assert.ok(allowed.has(e.type), `未知日志类型 ${e.type}`);
  });
  assert.ok(s.log.some((e) => e.type === 'look'));
  assert.ok(s.log.some((e) => e.type === 'terminal'));
  assert.equal(s.seats.find((x) => x.seat === 1)?.looked, true);
});

test('core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    const s = startHand({
      rules: presets.classic,
      seed: 100 + n,
      dealer: 0,
      seats: Array.from({ length: n }, (_, i) => ({ seat: i, chips: 50 })),
    });
    assert.equal(s.seats.length, n);
    assert.equal(s.pot, n * presets.classic.ante);
    assert.equal(s.turn, 1);
  }
});

// ②③ 的阈值精确性：注级没到顶时，"各家做过 1 次"绝不构成强制开牌；
// 满 3 次才 stall。这条同时卡住两类写错的终止判定。
test('core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall', () => {
  let s = hand3(1, 0);
  for (let guard = 0; guard < 6 && s.stake < 8; guard += 1) s = apply(s, raise(s.turn));
  assert.equal(s.stake, 8, '三次加注应当到注级 8');
  assert.equal(s.phase, 'betting');
  for (const seat of [1, 2, 0, 1, 2, 0]) {
    assert.equal(s.turn, seat, `期望轮到 ${String(seat)}，实际 ${String(s.turn)}`);
    s = apply(s, call(seat));
  }
  assert.equal(s.phase, 'betting', '注级未到顶就不该因为"各家做过 1 次"而强制开牌（②的前提是注级到顶）');
  assert.deepEqual(
    s.seats.filter((x) => x.active).map((x) => x.actionsAtStake),
    [2, 2, 2],
  );
  s = apply(s, call(s.turn));
  s = apply(s, call(s.turn));
  s = apply(s, call(s.turn));
  assert.equal(s.phase, 'awaitingSettle');
  assert.equal(s.terminal?.reason, 'stall', '满 3 次应当以 stall 终局');
});
