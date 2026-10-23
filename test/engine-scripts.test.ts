// M1 · 六条验收脚本（工单 §4 M1）：3 人局跑完 §1 的四类终止条件 + 分池 + 挑战者输。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { compare } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import { moneyTotal, stateHash } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { cardsOf, findSeed, hand3, script, ties } from './engine-fixtures.ts';

const call = (seat: number): Action => ({ kind: 'call', seat });
const raise = (seat: number): Action => ({ kind: 'raise', seat });
const fold = (seat: number): Action => ({ kind: 'fold', seat });
const cmpAct = (seat: number, target: number): Action => ({ kind: 'compare', seat, target });
const look = (seat: number): Action => ({ kind: 'look', seat });

// 独立预言：用 M0 已穷举验证过的 compare 判胜负，而不是读引擎自己写的结论
function loserOf(state: GameState, a: number, b: number): number {
  const c = compare(cardsOf(state, a), cardsOf(state, b), state.rules);
  return c > 0 ? b : a; // §1 平局 = 挑战者输 ⇒ cmp<=0 时挑战者 a 输
}

function alive(state: GameState): number[] {
  return state.seats.filter((s) => s.active).map((s) => s.seat);
}

function run(s: GameState, actions: Action[]): GameState {
  const money = moneyTotal(s);
  const out = script(s, actions);
  assert.equal(moneyTotal(out), money, '脚本执行过程中资金不守恒');
  return out;
}

test('scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌', () => {
  const s = hand3(1, 0);
  // 行动序 1,2,0 ⇒ 1 弃、2 弃 ⇒ 只剩 0
  const actual = run(s, [fold(1), fold(2)]);
  assert.equal(actual.phase, 'awaitingSettle');
  assert.deepEqual(alive(actual), [0]);
  assert.deepEqual(actual.terminal?.winners, [0]);
  assert.equal(actual.terminal?.reason, 'oneLeft');
  assert.equal(
    actual.seats.every((x) => !x.revealed),
    true,
    '① 只剩一人 ⇒ 不开牌，谁的牌都不该亮',
  );
  const potBefore = actual.pot;
  const chips0 = actual.seats.find((x) => x.seat === 0)?.chips as number;
  const settled = apply(actual, { kind: 'settle' });
  assert.equal(settled.seats.find((x) => x.seat === 0)?.chips, chips0 + potBefore);
  assert.equal(settled.pot, 0);
  assert.equal(moneyTotal(settled), 300);
});

test('scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开', () => {
  const seed = findSeed((x) => !ties(x, 1, 2));
  const opened = run(hand3(seed, 0), [call(1), call(2), call(0)]);
  assert.equal(opened.turn, 1);
  const firstLoser = loserOf(opened, 1, 2);
  const afterFirst = run(opened, [cmpAct(1, 2)]);
  assert.equal(afterFirst.seats.find((x) => x.seat === firstLoser)?.out, 'eliminated');
  assert.equal(afterFirst.seats.find((x) => x.seat === firstLoser)?.revealed, false, '三家在场时比牌输家不亮牌');
  assert.equal(afterFirst.pot, opened.pot + opened.stake * presets.classic.compare.fee);
  assert.equal(afterFirst.seats.find((x) => x.seat === 1)?.actionsTotal, 2);
  assert.deepEqual(alive(afterFirst).length, 2);

  const nextActor = afterFirst.turn;
  const target = alive(afterFirst).find((x) => x !== nextActor) as number;
  const secondLoser = loserOf(afterFirst, nextActor, target);
  const afterSecond = run(afterFirst, [cmpAct(nextActor, target)]);
  assert.equal(afterSecond.phase, 'awaitingSettle');
  assert.equal(afterSecond.terminal?.reason, 'oneLeft');
  assert.deepEqual(afterSecond.terminal?.winners, [secondLoser === nextActor ? target : nextActor]);
  const settled = apply(afterSecond, { kind: 'settle' });
  assert.equal(moneyTotal(settled), 300);
  assert.equal(settled.pot, 0);
  note(`SCRIPT02 seed=${String(seed)} loser1=${String(firstLoser)} loser2=${String(secondLoser)}`);
});

test('scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌', () => {
  const s = hand3(2, 0);
  const toCap = run(s, [raise(1), raise(2), raise(0), raise(1)]);
  assert.equal(toCap.stake, presets.classic.stake.max);
  assert.equal(toCap.phase, 'betting', '刚加注到 16 时计数被清零，不该立即终局');
  assert.deepEqual(
    toCap.seats.filter((x) => x.active).map((x) => x.actionsAtStake),
    [0, 0, 0],
  );
  const afterOneEach = run(toCap, [call(2), call(0), call(1)]);
  assert.equal(afterOneEach.phase, 'awaitingSettle');
  assert.equal(afterOneEach.terminal?.reason, 'stakeCap');
  assert.equal(
    afterOneEach.seats.filter((x) => x.active).every((x) => x.revealed),
    true,
    '强制开牌 ⇒ 活跃玩家全部亮牌',
  );
  // 赢家必须是 M0 compare 判出的最大手
  const active = afterOneEach.seats.filter((x) => x.active);
  const best = active.reduce((a, b) => (compare(a.hand, b.hand, presets.classic) >= 0 ? a : b));
  assert.deepEqual(
    afterOneEach.terminal?.winners,
    active.filter((x) => compare(x.hand, best.hand, presets.classic) === 0).map((x) => x.seat),
  );
});

test('scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计', () => {
  const s = hand3(1, 0);
  const stalls = run(s, [
    call(1), call(2), call(0),
    call(1), call(2), call(0),
    call(1), call(2),
  ]);
  assert.equal(stalls.phase, 'betting', '只有 1 号 3 次、2 号 2 次时不该终局');
  const ended = run(stalls, [call(0)]);
  assert.equal(ended.terminal?.reason, 'stall');
  assert.equal(ended.pot, 3 + 9);
  assert.equal(ended.stake, 1);

  // 中途加注 ⇒ 计数清零，必须在新注级下重新数满 3 次
  const withRaise = run(s, [call(1), call(2), call(0), call(1), raise(2)]);
  assert.equal(withRaise.stake, 2);
  assert.equal(withRaise.phase, 'betting');
  // 加注者是 2 号 ⇒ 游标交给 0，之后按 0,1,2 轮转
  const eight = run(withRaise, [
    call(0), call(1), call(2),
    call(0), call(1), call(2),
    call(0), call(1),
  ]);
  assert.equal(eight.phase, 'betting', '2 号在新注级下只有 2 次行动，不该终局');
  const done = run(eight, [call(2)]);
  assert.equal(done.terminal?.reason, 'stall');
  assert.equal(done.stake, 2);
});

test('scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者', () => {
  const seed = findSeed((x) => ties(x, 1, 2) && compare(cardsOf(x, 1), cardsOf(x, 0), presets.classic) > 0);
  const s = hand3(seed, 0);
  const ended = run(s, [
    look(1), call(1), call(2), call(0),
    call(1), call(2), fold(0),
    call(1), call(2),
  ]);
  assert.equal(ended.terminal?.reason, 'stall');
  assert.equal(ended.pot, 13, '底注3 + 1号明跟3次(2×3) + 2号闷跟3次(1×3) + 0号1次');
  assert.deepEqual(ended.terminal?.winners, [1, 2]);
  assert.deepEqual(ended.terminal?.shares, [7, 6]);
  assert.equal(ended.terminal?.remainderTo, 1, '庄家 0 ⇒ 环形序 1,2,0，余数归 1 号');
  const before = new Map(ended.seats.map((x) => [x.seat, x.chips]));
  const settled = apply(ended, { kind: 'settle' });
  assert.equal(
    settled.seats.find((x) => x.seat === 1)?.chips,
    (ended.seats.find((x) => x.seat === 1)?.chips ?? 0) + 7,
  );
  assert.equal(
    settled.seats.find((x) => x.seat === 2)?.chips,
    (ended.seats.find((x) => x.seat === 2)?.chips ?? 0) + 6,
  );
  assert.equal(settled.seats.find((x) => x.seat === 0)?.chips, before.get(0), '弃牌者一分不得');
  assert.equal(moneyTotal(settled), 300);
  note(`SCRIPT05 seed=${String(seed)} pot=${String(ended.pot)} shares=${String(ended.terminal?.shares)}`);
});

test('scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）', () => {
  const seed = findSeed((x) => ties(x, 1, 2));
  const opened = run(hand3(seed, 0), [call(1), call(2), call(0)]);
  assert.equal(opened.turn, 1);
  assert.equal(compare(cardsOf(opened, 1), cardsOf(opened, 2), presets.classic), 0);
  const after = run(opened, [cmpAct(1, 2)]);
  assert.equal(after.seats.find((x) => x.seat === 1)?.active, false, '平局时挑战者必须出局');
  assert.equal(after.seats.find((x) => x.seat === 1)?.out, 'eliminated');
  assert.equal(after.seats.find((x) => x.seat === 2)?.active, true, '被挑战方留在局里且不用花钱');
  assert.equal(after.pot, opened.pot + presets.classic.compare.fee);
  assert.equal(
    after.seats.find((x) => x.seat === 1)?.revealed,
    false,
    '三家在场时输家的牌按 §1 不公开',
  );
  note(`SCRIPT06 seed=${String(seed)} tie hands: 1=${JSON.stringify(cardsOf(opened, 1))} 2=${JSON.stringify(cardsOf(opened, 2))}`);
});

test('scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）', () => {
  const seed = findSeed((x) => !ties(x, 0, 1));
  const opened = run(hand3(seed, 0), [call(1), fold(2), call(0)]);
  assert.deepEqual(alive(opened), [0, 1]);
  const loser = loserOf(opened, 1, 0);
  const ended = run(opened, [cmpAct(1, 0)]);
  assert.equal(ended.phase, 'awaitingSettle');
  assert.equal(ended.terminal?.reason, 'oneLeft');
  assert.deepEqual(ended.terminal?.winners, [loser === 1 ? 0 : 1]);
  assert.equal(ended.seats.find((x) => x.seat === 1)?.revealed, true, '剩两家比牌 = 开牌，输家也亮');
  assert.equal(ended.seats.find((x) => x.seat === 0)?.revealed, true);
  const settled = apply(ended, { kind: 'settle' });
  assert.equal(moneyTotal(settled), 300);
});

test('scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）', () => {
  const reasons = new Set<string>();
  reasons.add(String(run(hand3(1, 0), [fold(1), fold(2)]).terminal?.reason));
  reasons.add(String(run(hand3(2, 0), [raise(1), raise(2), raise(0), raise(1), call(2), call(0), call(1)]).terminal?.reason));
  reasons.add(String(run(hand3(1, 0), [call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0)]).terminal?.reason));
  assert.deepEqual([...reasons].sort(), ['oneLeft', 'stakeCap', 'stall']);
});

test('scripts/09 每个脚本重放得到同一状态指纹（回放确定性）', () => {
  const scripts: [string, Action[]][] = [
    ['foldout', [fold(1), fold(2)]],
    ['stall', [call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0)]],
    ['cap', [raise(1), raise(2), raise(0), raise(1), call(2), call(0), call(1)]],
  ];
  for (const [name, actions] of scripts) {
    for (const seed of [1, 2, 5]) {
      const a = stateHash(script(hand3(seed, 0), actions));
      const b = stateHash(script(hand3(seed, 0), actions));
      assert.equal(a, b, `${name}@${String(seed)} 重放不一致`);
      // 前缀指纹必须不同（否则说明最后一步行动被静默丢弃）
      if (actions.length > 1) {
        const prefix = stateHash(script(hand3(seed, 0), actions.slice(0, -1)));
        assert.notEqual(a, prefix, `${name}@${String(seed)} 最后一步没有改变任何状态`);
      }
      note(`REPLAY ${name} seed=${String(seed)} hash=${a}`);
    }
  }
});
