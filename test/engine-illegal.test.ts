// M1 · 非法行动必拒清单（工单 §4 M1/M2：非法行动必被 validate 拒绝）。
import assert from 'node:assert/strict';
import { test } from './harness.ts';
import { presets } from '../src/rules.ts';
import { startHand, stateHash } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { InvalidActionError, checkAction, legalActions } from '../src/engine/validate.ts';
import { apply } from '../src/engine/actions.ts';
import { config3, hand3, script } from './engine-fixtures.ts';

const call = (seat: number): Action => ({ kind: 'call', seat });
const raise = (seat: number): Action => ({ kind: 'raise', seat });
const look = (seat: number): Action => ({ kind: 'look', seat });
const cmp = (seat: number, target: number): Action => ({ kind: 'compare', seat, target });

function codeOf(state: GameState, action: Action): string {
  const v = checkAction(state, action);
  return v.ok ? 'OK' : v.code;
}

function expectReject(state: GameState, action: Action, code: string): void {
  const before = stateHash(state);
  assert.throws(
    () => apply(state, action),
    (err: unknown) => {
      assert.ok(err instanceof InvalidActionError, `不是 InvalidActionError: ${String((err as Error)?.name)}`);
      assert.equal(err.code, code, `错误码不符，动作 ${JSON.stringify(action)}`);
      return true;
    },
  );
  assert.equal(stateHash(state), before, '被拒的行动不该改动状态');
}

test('illegal/01 不轮到你 → not_current_turn（三种动作各一例）', () => {
  const s = hand3(1, 0);
  expectReject(s, call(0), 'not_current_turn');
  expectReject(s, call(2), 'not_current_turn');
  expectReject(s, look(2), 'not_current_turn');
  expectReject(s, raise(0), 'not_current_turn');
  expectReject(s, cmp(0, 1), 'not_current_turn');
});

test('illegal/02 座位不存在 → bad_seat', () => {
  const s = hand3(1, 0);
  expectReject(s, call(7), 'bad_seat');
  expectReject(s, call(-1), 'bad_seat');
  expectReject(s, { kind: 'call', seat: Number.NaN } as Action, 'bad_seat');
  expectReject(s, { kind: 'call', seat: 1.5 } as Action, 'bad_seat');
});

test('illegal/03 行动对象本身不合法 → unknown_action', () => {
  const s = hand3(1, 0);
  expectReject(s, { kind: 'allIn', seat: 1 } as unknown as Action, 'unknown_action');
  expectReject(s, {} as unknown as Action, 'unknown_action');
  expectReject(s, null as unknown as Action, 'unknown_action');
});

test('illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开', () => {
  const s = hand3(1, 0);
  expectReject(s, cmp(1, 2), 'compare_forbidden_before_first_actions');
  const afterOne = apply(s, call(1));
  expectReject(afterOne, cmp(2, 0), 'compare_forbidden_before_first_actions');
  const afterTwo = apply(afterOne, call(2));
  expectReject(afterTwo, cmp(0, 1), 'compare_forbidden_before_first_actions');
  const afterThree = apply(afterTwo, call(0));
  assert.equal(afterThree.turn, 1);
  // 三人都各完成一次行动 ⇒ 解禁
  assert.equal(codeOf(afterThree, cmp(1, 2)), 'OK');
  assert.equal(codeOf(afterThree, cmp(1, 0)), 'OK');
});

test('illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位', () => {
  const opened = script(hand3(1, 0), [call(1), call(2), call(0)]);
  expectReject(opened, cmp(1, 1), 'bad_target');
  expectReject(opened, cmp(1, 99), 'bad_target');
  assert.equal(opened.turn, 1);
  const oneFolded = apply(opened, { kind: 'fold', seat: 1 });
  assert.equal(oneFolded.turn, 2);
  expectReject(oneFolded, cmp(2, 1), 'bad_target');
});

test('illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标', () => {
  const s = hand3(1, 0);
  const looked = apply(s, look(1));
  assert.equal(looked.turn, 1, '看牌后应当还轮到自己');
  assert.equal(looked.seq, s.seq + 1);
  assert.equal(looked.seats.find((x) => x.seat === 1)?.actionsTotal, 0, '看牌不该计入行动数');
  assert.equal(looked.seats.find((x) => x.seat === 1)?.actionsAtStake, 0);
  expectReject(looked, look(1), 'already_looked');
  // 看了牌 ⇒ 跟价按明跟算（明 = 注级 × bet.seen）
  const before = looked.pot;
  const called = apply(looked, call(1));
  assert.equal(called.pot - before, presets.classic.stake.initial * presets.classic.bet.seen);
});

test('illegal/07 注级顶格不能再加注', () => {
  let s = script(hand3(2, 0), [raise(1), raise(2), raise(0), raise(1)]);
  assert.equal(s.stake, presets.classic.stake.max);
  assert.ok(s.phase === 'betting');
  expectReject(s, raise(s.turn), 'stake_at_max');
  // 但跟注/弃牌/比牌仍然可走
  assert.ok(legalActions(s).some((a) => a.kind === 'call'));
});

test('illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）', () => {
  // dealer=2 ⇒ 行动序 0,1,2；轮到 2 时它扣完底注已身无分文
  const reached = script(
    startHand({
      rules: presets.classic,
      seed: 5,
      dealer: 2,
      seats: [
        { seat: 0, chips: 100 },
        { seat: 1, chips: 100 },
        { seat: 2, chips: presets.classic.ante },
      ],
    }),
    [call(0), call(1)],
  );
  assert.equal(reached.turn, 2);
  assert.equal(reached.seats.find((s) => s.seat === 2)?.chips, 0);
  const acts = legalActions(reached);
  assert.deepEqual([...new Set(acts.map((a) => a.kind))].sort(), ['fold', 'look', 'timeout'], JSON.stringify(acts));
  expectReject(reached, call(2), 'cannot_afford');
  expectReject(reached, raise(2), 'cannot_afford');
  // 这一步比牌先撞上"首圈禁比"（座位 2 本局还没行动过），而不是钱不够
  expectReject(reached, cmp(2, 0), 'compare_forbidden_before_first_actions');
  // 弃牌是唯一出路，且弃得起（弃牌不花钱）
  const folded = apply(reached, { kind: 'fold', seat: 2 });
  assert.equal(folded.turn, 0);
  assert.equal(folded.seats.find((s) => s.seat === 2)?.out, 'folded');

  // 单独验证"比牌费付不起"这条臂：全员都已行动过 ⇒ 首圈禁比已解除，只剩钱的问题
  const allActed = script(hand3(1, 0), [call(1), call(2), call(0)]);
  assert.equal(codeOf(allActed, cmp(1, 0)), 'OK');
  const brokeChallenger: GameState = {
    ...allActed,
    seats: allActed.seats.map((s) => (s.seat === 1 ? { ...s, chips: 1 } : s)),
  };
  assert.equal(brokeChallenger.stake, 1);
  expectReject(brokeChallenger, cmp(1, 0), 'cannot_afford');
});

test('illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active', () => {
  const opened = script(hand3(1, 0), [call(1), call(2), call(0)]);
  const folded = apply(opened, { kind: 'fold', seat: opened.turn });
  assert.equal(folded.seats.find((s) => s.seat === opened.turn)?.active, false);
  assert.equal(folded.seats.find((s) => s.seat === opened.turn)?.out, 'folded');
  const tampered: GameState = { ...folded, turn: opened.turn };
  expectReject(tampered, call(opened.turn), 'seat_not_active');
});

test('illegal/10 终局后所有下注类行动被拒（phase_not_betting）', () => {
  const ended = script(hand3(1, 0), [
    call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0),
  ]);
  assert.equal(ended.phase, 'awaitingSettle');
  expectReject(ended, call(1), 'phase_not_betting');
  expectReject(ended, raise(1), 'phase_not_betting');
  expectReject(ended, look(1), 'phase_not_betting');
  expectReject(ended, { kind: 'fold', seat: 1 }, 'phase_not_betting');
  expectReject(ended, cmp(1, 2), 'phase_not_betting');
});

test('illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op', () => {
  const s = hand3(1, 0);
  expectReject(s, { kind: 'settle' }, 'nothing_to_settle');
  const ended = script(s, [
    call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0),
  ]);
  const settled = apply(ended, { kind: 'settle' });
  const once = stateHash(settled);
  for (let i = 0; i < 5; i += 1) {
    const again = apply(settled, { kind: 'settle' });
    assert.equal(stateHash(again), once, `第 ${String(i)} 次重放结算改变了状态`);
    assert.deepEqual(again.seats.map((x) => x.chips), settled.seats.map((x) => x.chips));
  }
});

test('illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）', () => {
  const cases: GameState[] = [
    hand3(1, 0),
    script(hand3(1, 0), [call(1)]),
    script(hand3(1, 0), [call(1), call(2), call(0)]),
    apply(script(hand3(1, 0), [call(1), call(2), call(0)]), { kind: 'fold', seat: 1 }),
    script(hand3(2, 0), [raise(1), raise(2), raise(0), raise(1)]),
    script(hand3(1, 0), [
      call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0),
    ]),
  ];
  const probes: (s: GameState) => Action[] = (s) => {
    const seat = s.turn >= 0 ? s.turn : 1;
    const others = s.seats.filter((x) => x.seat !== seat).map((x) => x.seat);
    return [
      look(seat),
      call(seat),
      raise(seat),
      { kind: 'fold', seat },
      { kind: 'timeout', seat },
      ...others.map((t) => cmp(seat, t)),
      { kind: 'settle' },
    ];
  };
  for (const s of cases) {
    const legal = legalActions(s);
    for (const p of probes(s)) {
      const accepted = legal.some((a) => JSON.stringify(a) === JSON.stringify(p));
      const verdict = checkAction(s, p);
      if (s.phase === 'awaitingSettle') {
        if (p.kind === 'settle') assert.ok(accepted, 'awaitingSettle 应当允许 settle');
        else assert.ok(!accepted, `awaitingSettle 不该给出下注类动作 ${JSON.stringify(p)}`);
        continue;
      }
      if (verdict.ok) {
        assert.ok(accepted, `checkAction 允许但 legalActions 未给出：${JSON.stringify(p)} seat=${String(s.turn)}`);
      } else {
        assert.ok(!accepted, `checkAction 拒绝但 legalActions 给了：${JSON.stringify(p)}`);
      }
    }
  }
});

test('illegal/13 timeout 是普通行动：买得起 ≡ 跟注、买不起 ≡ 弃牌，且都过同一道 validate', () => {
  const s = script(hand3(1, 0), [call(1), call(2), call(0)]);
  const folded = apply(s, { kind: 'fold', seat: s.turn });
  const called = apply(s, { kind: 'call', seat: s.turn });
  const timed = apply(s, { kind: 'timeout', seat: s.turn });
  // 三家扣完底注还剩 97 枚，跟价 1 ⇒ 走"自动跟注"这条臂
  assert.equal(timed.log.at(-1)?.type, 'call');
  assert.equal(timed.log.at(-1)?.note, 'timeout→call dark×stake');
  assert.deepEqual(
    { ...timed, seq: called.seq, log: [] },
    { ...called, seq: called.seq, log: [] },
    '付得起时 timeout 与 call 的局面无差别（只有 note 不同）',
  );
  assert.notDeepEqual(
    { ...timed, seq: folded.seq, log: [], seats: [] },
    { ...folded, seq: folded.seq, log: [], seats: [] },
    '和弃牌不再是同一件事：托管不再白白丢掉这一手',
  );
  // 越界的 timeout 照样被拒，且拒了就不产生任何局面
  const wrong = s.turn === 0 ? 1 : 0;
  const verdict = checkAction(s, { kind: 'timeout', seat: wrong });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.code, 'not_current_turn');
  assert.throws(() => apply(s, { kind: 'timeout', seat: wrong }), InvalidActionError);
});
