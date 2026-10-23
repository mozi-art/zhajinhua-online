// M1 · 钱：行动代价口径、池不变量、分池余数、幂等结算。
// 金额的唯一出处是 src/engine/state.ts 的 actionCost()（QUESTIONS.md Q1 已裁定为读法 B：加到多少付多少）。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { presets } from '../src/rules.ts';
import { actionCost, moneyTotal, startHand, totalChips } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { splitPot } from '../src/engine/settle.ts';
import { config3, hand3, script } from './engine-fixtures.ts';

const call = (seat: number): Action => ({ kind: 'call', seat });
const raise = (seat: number): Action => ({ kind: 'raise', seat });
const look = (seat: number): Action => ({ kind: 'look', seat });

function potOf(s: GameState): number {
  return s.pot;
}

function committedSum(s: GameState): number {
  return s.seats.reduce((a, x) => a + x.committed, 0);
}

test('money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份', () => {
  for (const n of [2, 3, 6]) {
    const s = startHand({
      rules: presets.classic,
      seed: 9,
      dealer: 0,
      seats: Array.from({ length: n }, (_, seat) => ({ seat, chips: 50 })),
    });
    assert.equal(s.pot, n * presets.classic.ante);
    assert.equal(committedSum(s), s.pot);
    assert.equal(totalChips(s), n * (50 - presets.classic.ante));
  }
});

test('money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）', () => {
  let s = hand3(1, 0);
  for (const level of [1, 2, 4]) {
    for (let guard = 0; s.stake < level; guard += 1) {
      assert.ok(guard < 8, `注级推不到 ${String(level)}（第 ${String(guard)} 次仍在原地，别死循环）`);
      s = apply(s, raise(s.turn));
    }
    assert.equal(s.stake, level);
    const seat = s.turn;
    assert.equal(actionCost(s, seat, 'call'), level * presets.classic.bet.dark, `stake=${String(level)} 闷跟价`);
    const before = potOf(s);
    const looked = apply(s, look(seat));
    assert.equal(potOf(looked), before, '看牌不入池');
    assert.equal(actionCost(looked, seat, 'call'), level * presets.classic.bet.seen, `stake=${String(level)} 明跟价`);
    const paid = apply(looked, call(seat));
    assert.equal(potOf(paid), before + level * presets.classic.bet.seen, '明跟实付额必须等于明跟价');
  }
});

test('money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零', () => {
  const s = hand3(1, 0);
  const seat = s.turn;
  const cost = actionCost(s, seat, 'raise');
  assert.equal(cost, presets.classic.bet.dark * s.stake * 2, '闷家在注级 1 上加注到 2 ⇒ 付 2');
  const after = apply(s, raise(seat));
  assert.equal(after.pot, s.pot + cost);
  assert.equal(after.stake, s.stake * 2);
  for (const x of after.seats.filter((y) => y.active)) {
    assert.equal(x.actionsAtStake, 0, `加注后座位 ${String(x.seat)} 的当前注级行动数应清零`);
  }
  // 加注者自己也在这次"全员"里：他的 actionsTotal 仍 +1，但 actionsAtStake = 0
  assert.equal(after.seats.find((x) => x.seat === seat)?.actionsTotal, 1);

  // 独立数值锚点（不复用 actionCost，否则读法 A/B 互换也测不出来）：
  // 读法 B ⇒ stake=1 闷加付出 2、stake=2 明加付出 8；读法 A 会是 1 和 4。
  const first = apply(hand3(1, 0), raise(1));
  assert.equal(first.stake, 2);
  assert.equal(first.pot, 3 * presets.classic.ante + 2, '第一次加注按新注级 2 的闷跟价付 2');
  const seat2 = first.turn;
  const looked = apply(first, look(seat2));
  const second = apply(looked, raise(seat2));
  assert.equal(second.stake, 4);
  assert.equal(second.pot - looked.pot, 8, '明牌玩家在注级 2 上加注到 4 ⇒ 付 4×bet.seen=8');
});

test('money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）', () => {
  const fee = presets.classic.compare.fee;
  assert.equal(fee, 2);
  for (const level of [1, 2, 4]) {
    let s = hand3(2, 0);
    for (let guard = 0; s.stake < level; guard += 1) {
      assert.ok(guard < 8, `注级推不到 ${String(level)}（第 ${String(guard)} 次仍在原地，别死循环）`);
      s = apply(s, raise(s.turn));
    }
    // 首圈禁比要先解除：让还没行动过的活跃家各走一次
    for (let guard = 0; guard < 8; guard += 1) {
      if (s.phase !== 'betting' || !s.seats.some((x) => x.active && x.actionsTotal === 0)) break;
      s = apply(s, call(s.turn));
    }
    assert.ok(
      s.phase !== 'betting' || s.seats.every((x) => !x.active || x.actionsTotal > 0),
      '首圈禁比未能解除',
    );
    assert.equal(s.stake, level, `应当停在注级 ${String(level)}`);
    assert.equal(s.phase, 'betting');
    const seat = s.turn;
    const target = s.seats.find((x) => x.active && x.seat !== seat)?.seat as number;
    // 单点断言必须在 stake>1 上做：stake=1 时"2×stake"与"常数 2"同值，测不出差别
    assert.equal(actionCost(s, seat, 'compare'), level * fee, `stake=${String(level)} 的比牌费应随注级线性增长`);
    const dark = apply(s, { kind: 'compare', seat, target });
    assert.equal(dark.pot - s.pot, level * fee, `stake=${String(level)} 比牌实际入池额`);
    const looked = apply(s, look(seat));
    const t2 = looked.seats.find((x) => x.active && x.seat !== seat)?.seat as number;
    const bright = apply(looked, { kind: 'compare', seat, target: t2 });
    assert.equal(bright.pot - s.pot, dark.pot - s.pot, '闷/明两种状态下比牌入池金额必须相同');
  }
});

test('money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost', () => {
  const seq: Action[] = [
    call(1),
    look(2),
    call(2),
    raise(0),
    { kind: 'compare', seat: 1, target: 2 },
    call(0),
    call(1),
  ];
  let s = hand3(3, 0);
  assert.equal(potOf(s), committedSum(s));
  let steps = 0;
  for (const a of seq) {
    if (s.phase !== 'betting') break;
    const cost = actionCost(s, 'seat' in a ? a.seat : s.turn, a.kind);
    const before = potOf(s);
    const chipsBefore = s.seats.find((x) => x.seat === ('seat' in a ? a.seat : -1))?.chips ?? 0;
    s = apply(s, a);
    steps += 1;
    assert.equal(potOf(s), before + cost, `第 ${String(steps)} 步 pot 增量不符`);
    if (cost > 0) {
      const seat = 'seat' in a ? a.seat : -1;
      assert.equal(s.seats.find((x) => x.seat === seat)?.chips, chipsBefore - cost);
    }
    assert.equal(potOf(s), committedSum(s), `第 ${String(steps)} 步后 pot ≠ Σcommitted`);
  }
  assert.ok(steps >= 4, `脚本只走了 ${String(steps)} 步就提前终局，覆盖面不够`);
});

test('money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）', () => {
  const opened = script(hand3(1, 0), [call(1), call(2), call(0)]);
  const seat = opened.turn;
  const before = opened.seats.find((x) => x.seat === seat);
  const after = apply(opened, { kind: 'fold', seat });
  assert.equal(after.pot, opened.pot);
  assert.deepEqual(
    after.seats.find((x) => x.seat === seat),
    {
      ...before,
      active: false,
      out: 'folded',
      actionsTotal: (before?.actionsTotal ?? 0) + 1,
      actionsAtStake: (before?.actionsAtStake ?? 0) + 1,
    },
    '弃牌只改 active/out/行动计数，钱一分不动',
  );
  assert.equal(
    after.seats.find((x) => x.seat === seat)?.committed,
    before?.committed,
    '弃牌者的已投入必须留在池中（不退款）',
  );
});

test('money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家', () => {
  const base = hand3(1, 0);
  const mk = (pot: number, dealer: number): GameState => ({ ...base, pot, dealer });
  // 整除
  let r = splitPot(mk(12, 0), [1, 2]);
  assert.deepEqual(r.shares, [6, 6]);
  assert.equal(r.remainderTo, -1);
  // 余数：庄家 0 ⇒ 下家序 1,2,0；赢家 {0,2} 中最近的是 2
  r = splitPot(mk(13, 0), [0, 2]);
  assert.deepEqual(r.shares, [6, 7]);
  assert.equal(r.remainderTo, 2);
  // 赢家 {0,1} ⇒ 环形序 1,2,0 里先是 1 ⇒ 余数归 1 号
  r = splitPot(mk(13, 0), [0, 1]);
  assert.deepEqual(r.shares, [6, 7]);
  assert.equal(r.remainderTo, 1);
  // 换庄家：dealer=2 ⇒ 下家序 0,1,2；赢家 {1,2} ⇒ 最近的是 1
  r = splitPot(mk(13, 2), [1, 2]);
  assert.deepEqual(r.shares, [7, 6]);
  assert.equal(r.remainderTo, 1);
  // 三家全平
  r = splitPot(mk(10, 0), [0, 1, 2]);
  assert.deepEqual(r.shares, [3, 4, 3]);
  assert.equal(r.shares.reduce((a, b) => a + b, 0), 10);
  for (const dealer of [0, 1, 2]) {
    for (const winners of [[0, 1], [1, 2], [0, 2], [0, 1, 2]]) {
      const x = splitPot(mk(7, dealer), winners);
      assert.equal(x.shares.reduce((a, b) => a + b, 0), 7, `份额之和必须等于池 dealer=${String(dealer)}`);
    }
  }
});

test('money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱', () => {
  const ended = script(hand3(1, 0), [
    call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0),
  ]);
  const totalBefore = moneyTotal(ended);
  const settled = apply(ended, { kind: 'settle' });
  const chipsAfterOnce = settled.seats.map((x) => x.chips).join(',');
  let again = settled;
  for (let i = 0; i < 7; i += 1) again = apply(again, { kind: 'settle' });
  assert.equal(again.seats.map((x) => x.chips).join(','), chipsAfterOnce, '重复结算改变了筹码');
  assert.equal(again.seq, settled.seq, '重复结算不该推进 seq');
  assert.equal(again.log.length, settled.log.length, '重复结算不该追加日志');
  assert.equal(moneyTotal(again), totalBefore);
  assert.equal(totalChips(again), totalBefore);
  assert.equal(again.pot, 0);
  note(`SETTLE seed1-stall chips=${chipsAfterOnce} pot0 total=${String(totalBefore)}`);
});

test('money/09 任何时刻都不出现负筹码（全押禁用的直接后果）', () => {
  let s = hand3(4, 0);
  const guard: Action[] = [call(1), raise(2), call(0), raise(1), call(2), call(0), raise(1), call(2), call(0), call(1), call(2)];
  for (const a of guard) {
    if (s.phase !== 'betting') break;
    s = apply(s, a.kind === 'raise' && actionCost(s, a.seat, 'raise') > s.seats.find((x) => x.seat === a.seat)!.chips
      ? call(a.seat)
      : a);
    for (const x of s.seats) assert.ok(x.chips >= 0, `座位 ${String(x.seat)} 筹码为负：${String(x.chips)}`);
  }
  if (s.phase === 'awaitingSettle') s = apply(s, { kind: 'settle' });
  for (const x of s.seats) assert.ok(x.chips >= 0);
});

test('money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot', () => {
  const ended = script(hand3(11, 0), [
    call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0),
  ]);
  const pot = ended.pot;
  const before = new Map(ended.seats.map((x) => [x.seat, x.chips]));
  const settled = apply(ended, { kind: 'settle' });
  const terminal = settled.terminal;
  assert.notEqual(terminal, null);
  const gain = settled.seats.reduce((a, x) => a + (x.chips - (before.get(x.seat) ?? 0)), 0);
  assert.equal(gain, pot);
  assert.equal(committedSum(ended), pot);
  for (const x of settled.seats) {
    const isWinner = (terminal?.winners ?? []).includes(x.seat);
    if (!isWinner) assert.equal(x.chips, before.get(x.seat), '非赢家不该收到钱');
  }
});
