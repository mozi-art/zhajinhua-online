// M2 · 正式 fuzz（工单 §4 M2）：固定种子 1000 局，两条臂 —— 随机合法行动 与 诚实 AI ——
// 各自断言同一组不变量：总筹码守恒 / 无负筹码 / 无重复结算 / 必在有限行动数内终止 / 非法行动必被 validate 拒。
// 输出只有计数，没有时间戳与耗时（§0.5 双跑一致的前提）。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { classify, compare, mulberry32 } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import { actionCost, moneyTotal, startHand, stateHash } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { InvalidActionError, checkAction, legalActions } from '../src/engine/validate.ts';
import { project } from '../src/engine/project.ts';
import { decideAi, handStrength, tierPercentiles } from '../src/ai/honest.ts';
import type { AiOption } from '../src/ai/honest.ts';
import type { RejectCode } from '../src/engine/validate.ts';

const HANDS = 1000;
const STEP_LIMIT = 400;
const CHIPS = 120;

function optionsFor(s: GameState, seat: number): AiOption[] {
  const out: AiOption[] = [];
  for (const a of legalActions(s)) {
    if (a.kind === 'timeout') continue;
    if ('seat' in a && a.seat !== seat) continue;
    out.push({ kind: a.kind, cost: actionCost(s, seat, a.kind), target: a.kind === 'compare' ? a.target : -1 });
  }
  return out;
}

type Outcome = {
  steps: number;
  money: number;
  reason: string;
  aiChoices: number;
  illegalAiPicks: number;
  darkRaises: number;
  compares: number;
  maxComparePerSeat: number;
  looks: number;
};

// arm = 'random' 均匀随机（偏向不弃牌，好覆盖 §1②③）；arm = 'ai' 由 src/ai 决策（它自己选弃/看/跟/加）
function oneHand(handSeed: number, choiceSeed: number, players: number, arm: 'random' | 'ai'): Outcome {
  const seats = Array.from({ length: players }, (_, i) => ({ seat: i, chips: CHIPS }));
  let s = startHand({ rules: presets.classic, seed: handSeed, dealer: 0, seats });
  const money = moneyTotal(s);
  const rng = mulberry32(choiceSeed);
  let steps = 0;
  let aiChoices = 0;
  let illegalAiPicks = 0;
  let darkRaises = 0;
  let compares = 0;
  let looks = 0;
  const compareBySeat = new Map<number, number>();
  while (s.phase === 'betting') {
    steps += 1;
    assert.ok(steps <= STEP_LIMIT, `未在 ${String(STEP_LIMIT)} 步内终止：arm=${arm} seed=${String(handSeed)}`);
    const legal = legalActions(s);
    assert.ok(legal.length > 0, `betting 却没有合法行动：seed=${String(handSeed)}`);
    const seat = s.turn;
    let action: Action;
    if (arm === 'ai') {
      const opts = optionsFor(s, seat);
      const d = decideAi(project(s, seat), seat, opts);
      aiChoices += 1;
      if (!opts.some((o) => o.kind === d.kind)) illegalAiPicks += 1;
      const looked = s.seats.find((x) => x.seat === seat)?.looked ?? false;
      if (!looked && d.kind === 'raise') darkRaises += 1;
      if (d.kind === 'compare') {
        compares += 1;
        compareBySeat.set(seat, (compareBySeat.get(seat) ?? 0) + 1);
      }
      if (d.kind === 'look') looks += 1;
      const chosen = opts.find((o) => o.kind === d.kind);
      // AI 越界就用兜底，让这一局继续跑完（越界本身已经被计数，断言在调用方）
      action = chosen === undefined
        ? (opts.find((o) => o.kind === 'fold') ?? opts[0]) as unknown as Action
        : chosen.kind === 'compare'
          ? { kind: 'compare', seat, target: chosen.target }
          : { kind: chosen.kind, seat } as Action;
    } else {
      const noFold = legal.filter((a) => a.kind !== 'fold' && a.kind !== 'timeout');
      const pool = noFold.length > 0 && rng() % 5 !== 0 ? noFold : legal;
      action = pool[rng() % pool.length] as Action;
    }
    s = apply(s, action);
    assert.equal(moneyTotal(s), money, `途中资金不守恒：arm=${arm} seed=${String(handSeed)}`);
    for (const x of s.seats) {
      assert.ok(x.chips >= 0, `负筹码：arm=${arm} seat=${String(x.seat)}`);
      assert.ok(x.chips <= money, `单家筹码超过全桌总额：arm=${arm}`);
      assert.ok(Number.isInteger(x.chips) && Number.isInteger(s.pot), '出现非整数金额');
    }
    assert.equal(s.pot, s.seats.reduce((a, x) => a + x.committed, 0), 'pot 与 committed 之和脱钩');
  }
  const terminal = s.terminal;
  assert.notEqual(terminal, null, `终局却没有 terminal：arm=${arm} seed=${String(handSeed)}`);
  const settled = apply(s, { kind: 'settle' });
  assert.equal(settled.pot, 0, '结算后池子没清空');
  assert.equal(moneyTotal(settled), money, '结算破坏守恒');
  assert.equal(
    settled.seats.reduce((a, x) => a + x.chips, 0),
    money,
    '结算后筹码之和不等于买入总和',
  );
  // 无重复结算：再 settle 一次必须是纯 no-op
  assert.equal(stateHash(apply(settled, { kind: 'settle' })), stateHash(settled), '重复结算改动了状态');
  assert.equal(apply(apply(settled, { kind: 'settle' }), { kind: 'settle' }).seats.reduce((a, x) => a + x.chips, 0), money);
  return {
    steps,
    money,
    reason: String(terminal?.reason),
    aiChoices,
    illegalAiPicks,
    darkRaises,
    compares,
    maxComparePerSeat: Math.max(0, ...compareBySeat.values()),
    looks,
  };
}

function sweep(arm: 'random' | 'ai'): void {
  const agg = { maxSteps: 0, aiChoices: 0, illegal: 0, darkRaise: 0, compare: 0, look: 0, maxComparePerSeat: 0, handsWithCompare: 0 };
  const reasons = new Map<string, number>();
  for (let i = 1; i <= HANDS; i += 1) {
    const players = 2 + (i % 5); // 2..6 全覆盖
    const r = oneHand(i * 7919, 4_000_000 + i, players, arm);
    agg.maxSteps = Math.max(agg.maxSteps, r.steps);
    agg.aiChoices += r.aiChoices;
    agg.illegal += r.illegalAiPicks;
    agg.darkRaise += r.darkRaises;
    agg.compare += r.compares;
    agg.maxComparePerSeat = Math.max(agg.maxComparePerSeat, r.maxComparePerSeat);
    if (r.compares > 0) agg.handsWithCompare += 1;
    agg.look += r.looks;
    reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
  }
  assert.equal(agg.illegal, 0, `${arm} 臂出现了合法集合之外的选择 ${String(agg.illegal)} 次`);
  assert.equal(agg.darkRaise, 0, `${arm} 臂闷着加注 ${String(agg.darkRaise)} 次`);
  // §4 M3：比牌断言从"0 次"翻成正向 —— 既不能是死分支，也不能突破"同局每家至多 1 次"
  // 这条上限是 **AI 的自我克制**（引擎并不禁止同局重复比牌，只校首圈/目标/钱），所以只在 AI 臂上有意义：
  // 随机臂里 maxComparePerSeat 恒为 0（那两个计数器只数 decideAi 的输出），拿它当断言等于空跑。
  if (arm === 'ai') {
    assert.equal(agg.maxComparePerSeat <= 1, true, `AI 臂有玩家在同一局里比了 ${String(agg.maxComparePerSeat)} 次牌`);
    assert.ok(agg.compare > 0, 'AI 臂 1000 局一次比牌都没发起 ⇒ 比牌分支是死代码');
    assert.ok(agg.handsWithCompare < HANDS, '每一局都触发比牌 ⇒ 触发率形同 100%');
  }
  const label = reasons.size > 0 ? [...reasons.entries()].map(([k, v]) => `${k}=${String(v)}`).sort().join(' ') : 'none';
  const aiOnly = arm === 'ai' ? '' : '（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"）';
  note(`FUZZ-${arm} hands=${String(HANDS)} maxSteps=${String(agg.maxSteps)} decisions=${String(agg.aiChoices)} look=${String(agg.look)} compare=${String(agg.compare)} 有比牌的局=${String(agg.handsWithCompare)}${aiOnly} reasons=${label}`);
  assert.ok(agg.maxSteps <= 160, `${arm} 臂终止上界异常：${String(agg.maxSteps)} 步`);
}

test('m2/01 随机合法行动 1000 局：守恒 / 无负筹码 / 无重复结算 / 有限步终止', () => {
  sweep('random');
});

test('m2/02 诚实 AI 1000 局：只出合法行动、闷着不加注、决策数非零且必然终止', () => {
  sweep('ai');
});

test('m2/03 AI 臂与随机臂都打到全部三类终止条件（覆盖不是单边运气）', () => {
  const of = (arm: 'random' | 'ai'): Set<string> => {
    const seen = new Set<string>();
    for (let i = 1; i <= 300; i += 1) seen.add(oneHand(i * 131, 6_000_000 + i, 4, arm).reason);
    return seen;
  };
  const r = of('random');
  const a = of('ai');
  for (const want of ['oneLeft', 'stakeCap', 'stall']) {
    assert.ok(r.has(want), `随机臂没覆盖 §1 终止条件 ${want}`);
    assert.ok(a.has(want), `AI 臂没覆盖 §1 终止条件 ${want}`);
  }
});

// §4 M2 点名的四类非法行动，逐类注入到真实对局的每一步上
test('m2/04 四类非法行动必被 validate 拒（不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌）', () => {
  let probes = 0;
  const hits: Record<string, number> = {
    not_current_turn: 0,
    cannot_afford: 0,
    bad_target: 0,
    compare_forbidden_before_first_actions: 0,
  };
  for (let i = 1; i <= 300; i += 1) {
    let s = startHand({
      rules: presets.classic,
      seed: i * 613,
      dealer: 0,
      seats: Array.from({ length: 4 }, (_, k) => ({ seat: k, chips: CHIPS })),
    });
    const rng = mulberry32(7_000_000 + i);
    for (let step = 0; step < 24 && s.phase === 'betting'; step += 1) {
      const seat = s.turn;
      const idle = s.seats.find((x) => x.seat !== seat) as GameState['seats'][number];
      const folded = s.seats.find((x) => !x.active);
      const broke: GameState = {
        ...s,
        seats: s.seats.map((x) => (x.seat === seat ? { ...x, chips: 0, looked: true } : x)),
      };
      const bad: [RejectCode, Action][] = [
        ['not_current_turn', { kind: 'call', seat: idle.seat }],
        ['not_current_turn', { kind: 'fold', seat: idle.seat }],
        ['bad_target', { kind: 'compare', seat, target: idle.seat }],
        ['compare_forbidden_before_first_actions', { kind: 'compare', seat, target: idle.seat }],
      ];
      if (folded !== undefined) bad.push(['bad_target', { kind: 'compare', seat, target: folded.seat }]);
      for (const [expectCode, action] of bad) {
        const legal = legalActions(s).some((x) => JSON.stringify(x) === JSON.stringify(action));
        probes += 1;
        if (legal) {
          // 同一动作在某些局面是合法的（比如目标确实活跃、或首圈已过）——那只要求它不被误拒
          assert.doesNotThrow(() => checkAction(s, action));
          continue;
        }
        const v = checkAction(s, action);
        assert.equal(v.ok, false, `本该被拒却放行：${expectCode}`);
        if (!v.ok) hits[v.code] = (hits[v.code] ?? 0) + 1;
        const before = stateHash(s);
        assert.throws(() => apply(s, action), InvalidActionError);
        assert.equal(stateHash(s), before, '被拒的行动改动了状态');
      }
      // 钱不够：把行动者抽干到付不起任何价，此时唯一合法行动必须是弃牌
      const legalNow = legalActions(broke);
      if (legalNow.length > 0 && !legalNow.some((a) => a.kind === 'call' || a.kind === 'raise')) {
        const v = checkAction(broke, { kind: 'call', seat });
        probes += 1;
        assert.equal(v.ok, false, '付不起却被放行');
        if (!v.ok) {
          assert.equal(v.code, 'cannot_afford', `钱不够却报了 ${v.code}`);
          hits['cannot_afford'] = (hits['cannot_afford'] ?? 0) + 1;
        }
      }
      const acts = legalActions(s);
      s = apply(s, acts[rng() % acts.length] as Action);
    }
  }
  for (const code of Object.keys(hits)) assert.ok((hits[code] ?? 0) > 0, `四类必拒里 ${code} 一次都没测到`);
  note(`FUZZ-ILLEGAL4 probes=${String(probes)} ${Object.entries(hits).map(([k, v]) => `${k}=${String(v)}`).join(' ')}`);
});

// 分位函数的标定：handStrength 是近似，拿它对拍"真实压过多少比例的手牌"（用 compare 全量算）。
// 两个 preset 都要过 —— 档内可达端点会随 a23 移动（高牌最小手 5-3-2 ⇄ 4-3-2、顺子最低高点 3 ⇄ 4），
// 所以这张端点表不能是抄下来的死数字。
test('m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）', () => {
  const deck = Array.from({ length: 52 }, (_, i) => ({ rank: (i % 13) + 2, suit: Math.floor(i / 13) }));
  const all: Card[][] = [];
  for (let i = 0; i < 52; i += 1) {
    for (let j = i + 1; j < 52; j += 1) {
      for (let k = j + 1; k < 52; k += 1) all.push([deck[i], deck[j], deck[k]] as Card[]);
    }
  }
  assert.equal(all.length, 22100);
  const keyOf = (ranks: number[]): number => ranks.reduce((a, r) => a * 100 + r, 0);
  const winRate = (h: Card[], rules: Rules): number => {
    let wins = 0;
    for (const o of all) if (compare(h, o, rules) > 0) wins += 1;
    return wins / all.length;
  };
  const lines: string[] = [];
  let worstError = 0;
  for (const rules of [presets.classic, presets.a23off]) {
    const name = rules.handEval.a23 ? 'classic' : 'a23off';
    const best = new Map<string, { hand: Card[]; key: number }>();
    const worst = new Map<string, { hand: Card[]; key: number }>();
    for (const h of all) {
      const c = classify(h, rules);
      const key = keyOf(c.ranks);
      const hi = best.get(c.tier);
      if (hi === undefined || key > hi.key) best.set(c.tier, { hand: h, key });
      const lo = worst.get(c.tier);
      if (lo === undefined || key < lo.key) worst.set(c.tier, { hand: h, key });
    }
    const lowTrip = worst.get('highCard');
    const lowRun = worst.get('straight');
    assert.ok(lowTrip !== undefined && lowRun !== undefined, `${name} 枚举里缺档`);
    if (lowTrip === undefined || lowRun === undefined) continue;
    assert.equal(keyOf(classify(lowTrip.hand, rules).ranks), 50302, `${name} 高牌最小手不符（4-3-2 是顺子，与 a23 无关）`);
    assert.equal(keyOf(classify(lowRun.hand, rules).ranks), rules.handEval.a23 ? 3 : 4, `${name} 顺子最低高点不符`);
    const bands = tierPercentiles(rules);
    for (const t of rules.handEval.tierOrder) {
      const b = bands[t] as { weaker: number; share: number };
      for (const [label, rec, edge] of [['max', best.get(t), b.weaker + b.share], ['min', worst.get(t), b.weaker]] as const) {
        if (rec === undefined) continue;
        const est = handStrength(rec.hand, rules);
        const win = winRate(rec.hand, rules);
        worstError = Math.max(worstError, Math.abs(est - win));
        lines.push(`${name}/${t}/${label} est=${est.toFixed(3)} true=${win.toFixed(3)}`);
        // 定义检查：本档最弱手要贴回 weaker 端、最强手要顶到 weaker+share 端。
        // 端点表推错（我第一版就把高牌最小手写成 7-4-2）这条会立刻炸。
        assert.ok(Math.abs(est - edge) < 0.005, `${name}/${t}/${label} 没贴住档端：est=${est.toFixed(4)} edge=${edge.toFixed(4)}`);
      }
    }
  }
  assert.ok(worstError < 0.02, `分位与真实胜率偏离过大：${lines.join(' | ')}`);
  note(`AI-CALIB max|est-true|=${(worstError * 100).toFixed(1)}pp over ${lines.length} anchors`);
});
