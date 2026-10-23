// M1 · 不变量骨架（M2 的正式 fuzz 建立在这之上）：随机合法行动跑满一批局，断言结构性不变量。
// 随机一律固定种子（工单 §3.4/§3.7），且随机性只来自 mulberry32，绝不碰时钟。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { mulberry32 } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import { moneyTotal, startHand, stateHash } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { InvalidActionError, legalActions } from '../src/engine/validate.ts';
import { hand3 } from './engine-fixtures.ts';

type PlayResult = {
  start: GameState;
  end: GameState;
  steps: number;
  actions: Action[];
};

// 三种选法：any = 均匀随机；patient = 偏向跟注（用来把局推到 §1③ stall）；
// aggressive = 偏向加注（用来把注级顶到 16 触发 §1②）。一律不许弃牌，除非只剩弃牌
// （允许弃牌时随机局几乎都以"弃到只剩一人"收场，覆盖不到另外两条路径 —— 见 fuzz/02）。
type Mode = 'any' | 'patient' | 'aggressive';

function pick(acts: Action[], rng: () => number, mode: Mode): Action {
  const of = (kind: string): Action[] => acts.filter((a) => a.kind === kind);
  if (mode === 'patient') {
    const calls = of('call');
    if (calls.length > 0 && rng() % 4 !== 0) return calls[rng() % calls.length] as Action;
  }
  if (mode === 'aggressive') {
    const raises = of('raise');
    if (raises.length > 0) return raises[0] as Action;
    const comps = of('compare');
    if (comps.length > 0 && rng() % 2 === 0) return comps[rng() % comps.length] as Action;
  }
  const noFold = acts.filter((a) => a.kind !== 'fold' && a.kind !== 'timeout');
  const usable = noFold.length > 0 ? noFold : acts;
  return usable[rng() % usable.length] as Action;
}

function play(handSeed: number, choiceSeed: number, players = 3, limit = 400, mode: Mode = 'any'): PlayResult {
  const seats = Array.from({ length: players }, (_, i) => ({ seat: i, chips: 100 }));
  const start = startHand({ rules: presets.classic, seed: handSeed, dealer: 0, seats });
  const rng = mulberry32(choiceSeed);
  const actions: Action[] = [];
  let s = start;
  const money = moneyTotal(start);
  while (s.phase === 'betting') {
    const acts = legalActions(s);
    assert.ok(acts.length > 0, `betting 阶段却没有合法行动（seed=${String(handSeed)} step=${String(actions.length)}）`);
    const a = pick(acts, rng, mode);
    s = apply(s, a);
    actions.push(a);
    assert.ok(actions.length <= limit, `未在 ${String(limit)} 步内终止：seed=${String(handSeed)}`);
    assert.equal(moneyTotal(s), money, '行动途中资金不守恒');
    for (const x of s.seats) {
      assert.ok(x.chips >= 0, `负筹码 seat=${String(x.seat)}`);
      assert.ok(Number.isInteger(x.chips) && Number.isInteger(s.pot), '出现非整数金额');
    }
    assert.equal(
      s.pot,
      s.seats.reduce((acc, x) => acc + x.committed, 0),
      'pot 与各家 committed 之和脱钩',
    );
  }
  return { start, end: s, steps: actions.length, actions };
}

test('fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码', () => {
  let maxSteps = 0;
  const reasons = new Map<string, number>();
  for (let i = 1; i <= 200; i += 1) {
    const r = play(i, 1_000_000 + i);
    maxSteps = Math.max(maxSteps, r.steps);
    const reason = String(r.end.terminal?.reason);
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    assert.ok(['oneLeft', 'stakeCap', 'stall'].includes(reason), `未知终止原因 ${reason}`);
    const settled = apply(r.end, { kind: 'settle' });
    assert.equal(settled.pot, 0);
    assert.equal(moneyTotal(settled), 300);
    assert.equal(
      settled.seats.reduce((a, x) => a + x.chips, 0),
      300,
      '结算后筹码之和必须等于买入总和',
    );
    const again = apply(settled, { kind: 'settle' });
    assert.equal(stateHash(again), stateHash(settled), '重复结算改变了状态');
    assert.ok(r.end.seats.some((x) => x.active), '终局后一个活跃玩家都没有');
  }
  note(`FUZZ200 maxSteps=${String(maxSteps)} reasons=${[...reasons.entries()].map(([k, v]) => `${k}=${String(v)}`).sort().join(' ')}`);
  assert.ok(maxSteps <= 120, `终止上界异常：${String(maxSteps)} 步`);
});

test('fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）', () => {
  const seen = new Set<string>();
  for (let i = 1; i <= 120; i += 1) seen.add(String(play(i, 2_000_000 + i, 3, 400, 'patient').end.terminal?.reason));
  for (let i = 1; i <= 120; i += 1) seen.add(String(play(i, 3_000_000 + i, 3, 400, 'aggressive').end.terminal?.reason));
  assert.deepEqual([...seen].sort(), ['oneLeft', 'stakeCap', 'stall'], seen.size >= 3 ? '' : '覆盖不足');
  note(`FUZZ-MODE reasons=${[...seen].sort().join(',')}`);
});

test('fuzz/03 2–6 人局全部跑通且守恒', () => {
  for (const players of [2, 3, 4, 5, 6]) {
    for (const seed of [7, 8]) {
      const r = play(seed, seed * 31 + players, players);
      const settled = apply(r.end, { kind: 'settle' });
      assert.equal(moneyTotal(settled), players * 100);
      assert.equal(settled.seats.length, players);
      for (const x of settled.seats) assert.ok(x.chips >= 0);
    }
  }
});

test('fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变', () => {
  const bad: (s: GameState) => Action[] = (s) => {
    const seat = s.turn;
    const other = s.seats.find((x) => x.seat !== seat)?.seat ?? 0;
    return [
      { kind: 'call', seat: other },
      { kind: 'fold', seat: other },
      { kind: 'raise', seat: other },
      { kind: 'look', seat: other },
      { kind: 'compare', seat, target: seat },
      { kind: 'compare', seat: other, target: seat },
      { kind: 'settle' },
      { kind: 'call', seat: 42 },
      { kind: 'raise', seat } as Action,
    ];
  };
  let checked = 0;
  let rejected = 0;
  for (let i = 1; i <= 60; i += 1) {
    let s = hand3(i, 0);
    const rng = mulberry32(5_000_000 + i);
    for (let step = 0; step < 12 && s.phase === 'betting'; step += 1) {
      for (const a of bad(s)) {
        const before = stateHash(s);
        const wasLegal = legalActions(s).some((x) => JSON.stringify(x) === JSON.stringify(a));
        checked += 1;
        if (wasLegal) continue;
        assert.throws(
          () => apply(s, a),
          (err: unknown) => {
            assert.ok(err instanceof InvalidActionError, `不是 InvalidActionError：${String((err as Error)?.name)}`);
            return true;
          },
        );
        rejected += 1;
        assert.equal(stateHash(s), before, '被拒的行动改动了状态');
      }
      const acts = legalActions(s);
      s = apply(s, acts[rng() % acts.length] as Action);
    }
  }
  assert.ok(rejected > 300, `非法注入样本太少：${String(rejected)}`);
  note(`FUZZ-ILLEGAL probes=${String(checked)} rejected=${String(rejected)}`);
});

test('fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）', () => {
  for (let i = 1; i <= 20; i += 1) {
    const a = play(i * 97, 9_000_000 + i);
    const b = play(i * 97, 9_000_000 + i);
    assert.equal(stateHash(a.end), stateHash(b.end));
    // 用记录下来的行动序列从同一初始局面重放，也必须落在同一指纹上
    let replayed = a.start;
    for (const act of a.actions) replayed = apply(replayed, act);
    assert.equal(stateHash(replayed), stateHash(a.end), '脚本重放与原始对局不一致');
    assert.equal(replayed.seq, a.end.seq);
  }
});

test('fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次', () => {
  for (let i = 1; i <= 40; i += 1) {
    const r = play(i, 11_000_000 + i);
    const once = apply(r.end, { kind: 'settle' });
    const hash = stateHash(once);
    let s = once;
    for (let k = 0; k < 3; k += 1) s = apply(s, { kind: 'settle' });
    assert.equal(stateHash(s), hash);
    assert.equal(
      s.seats.map((x) => x.chips).join(','),
      once.seats.map((x) => x.chips).join(','),
    );
    assert.equal(s.log.filter((e) => e.type === 'settle').length, 1, '结算日志被重复追加');
  }
});
