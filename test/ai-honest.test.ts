// M2 · 诚实 AI 的验收（工单 §4 M2「牌力档位 + 池赔率」+ §2.6「不许偷看」）。
// 分两条腿：① 牌力先验表必须等于穷举事实（不是拍脑袋的常数）；② 决策行为必须真的只用得着的信息。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { classify } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { presets } from '../src/rules.ts';
import type { Rules, TierId } from '../src/rules.ts';
import { startHand } from '../src/engine/state.ts';
import type { GameState } from '../src/engine/state.ts';
import { project } from '../src/engine/project.ts';
import { AI_COMPARE_TRIGGER, compareRoll, handStrength, tierPercentiles, decideAi, BLIND_PRIOR } from '../src/ai/honest.ts';
import type { AiOption } from '../src/ai/honest.ts';

const TOTAL = 22100;
const mk = (rank: number, suit: number): Card => ({ rank, suit });

function allHands(): Card[][] {
  const deck: Card[] = [];
  for (let s = 0; s < 4; s += 1) for (let r = 2; r <= 14; r += 1) deck.push(mk(r, s));
  const out: Card[][] = [];
  for (let i = 0; i < 52; i += 1) {
    for (let j = i + 1; j < 52; j += 1) {
      for (let k = j + 1; k < 52; k += 1) out.push([deck[i] as Card, deck[j] as Card, deck[k] as Card]);
    }
  }
  return out;
}

const HANDS = allHands();

// ---- 一个可控的 View 工厂：只填 decideAi 真正会读的字段，其余给合法占位 ----
function viewOf(input: {
  seat: number;
  cards: Card[] | 'unknown';
  pot: number;
  stake: number;
  opponents: number;
  rules?: Rules;
  looked?: boolean;
  seats?: { seat: number; active: boolean; looked: boolean; cards: Card[] | 'unknown' }[];
  seq?: number;
}): ReturnType<typeof project> {
  const rules = input.rules ?? presets.classic;
  const others = Array.from({ length: input.opponents }, (_, i) => ({
    seat: input.seat + 1 + i,
    chips: 500,
    active: true,
    out: null,
    looked: false,
    actionsTotal: 1,
    actionsAtStake: 1,
    committed: 2,
    revealed: false,
    cards: 'unknown' as const,
  }));
  const mine = {
    seat: input.seat,
    chips: 500,
    active: true,
    out: null,
    looked: input.looked ?? (input.cards !== 'unknown'),
    actionsTotal: 1,
    actionsAtStake: 1,
    committed: 1,
    revealed: false,
    cards: input.cards,
  };
  return {
    viewer: input.seat,
    rules,
    phase: 'betting',
    pot: input.pot,
    stake: input.stake,
    turn: input.seat,
    dealer: others[others.length - 1]?.seat ?? input.seat,
    seq: input.seq ?? 5,
    settledSeq: null,
    terminal: null,
    log: [],
    seats: input.seats === undefined ? [mine, ...others] : [mine, ...input.seats.map((s) => ({ ...mine, ...s }))],
    deal: null,
  };
}

const OPTS = (list: Partial<AiOption>[]): AiOption[] =>
  list.map((o) => ({ kind: o.kind ?? 'fold', cost: o.cost ?? 0, target: o.target ?? -1 }));
// 标准的"闷/明都能拿到的一组合法项"：跟 2、弃、（可加注时）加 4、（可看牌时）看
const legalFor = (args: { callCost: number; raise?: boolean; look?: boolean }): AiOption[] =>
  OPTS([
    { kind: 'call', cost: args.callCost },
    ...(args.raise ? [{ kind: 'raise' as const, cost: args.callCost * 2 }] : []),
    ...(args.look ? [{ kind: 'look' as const, cost: 0 }] : []),
    { kind: 'fold' },
  ]);

test('ai/01 牌力先验表 = 22100 手全枚举的事实', () => {
  assert.equal(HANDS.length, TOTAL);
  // 表是按 classic 钉的（a23off 共用它，偏差上限由 ai/02 单独把关）
  const rules = presets.classic;
  const count = new Map<TierId, number>();
  for (const h of HANDS) {
    const t = classify(h, rules).tier;
    count.set(t, (count.get(t) ?? 0) + 1);
  }
  const bands = tierPercentiles(rules);
  let atOrAbove = 0;
  for (const tier of rules.handEval.tierOrder) {
    const b = bands[tier] as { weaker: number; share: number };
    const empirical = count.get(tier) ?? 0;
    atOrAbove += empirical;
    assert.ok(Math.abs(b.share * TOTAL - empirical) < 1e-9, `${tier} share 与穷举不符`);
    assert.ok(
      Math.abs(b.weaker * TOTAL - (TOTAL - atOrAbove)) < 1e-9,
      `${tier} weaker 应 = P(该档或更强)的补集：${String(b.weaker)} vs ${String((TOTAL - atOrAbove) / TOTAL)}`,
    );
  }
  assert.equal(atOrAbove, TOTAL, '各档之和必须正好铺满 22100');
  // 方向性钉子：豹子是最强档 ⇒ 几乎压过所有随机手；高牌最弱 ⇒ 先验接近 0
  assert.ok((bands['trips']?.weaker ?? 0) > 0.99, '豹子的分位被算反了');
  assert.ok((bands['highCard']?.weaker ?? 1) < 0.01, '高牌的分位被算反了');
});

test('ai/02 分位表按 classic 写死，但 a23off 下的偏差 < 2pp（所以表可以不分 preset）', () => {
  const of = (rules: Rules): Record<TierId, number> => {
    const count = new Map<TierId, number>();
    for (const h of HANDS) count.set(classify(h, rules).tier, (count.get(classify(h, rules).tier) ?? 0) + 1);
    const out = {} as Record<TierId, number>;
    let stronger = 0;
    for (const t of rules.handEval.tierOrder) {
      out[t] = stronger / TOTAL;
      stronger += count.get(t) ?? 0;
    }
    return out;
  };
  const a = of(presets.classic);
  const b = of(presets.a23off);
  let worst = 0;
  for (const t of presets.classic.handEval.tierOrder) {
    worst = Math.max(worst, Math.abs((a[t] ?? 0) - (b[t] ?? 0)));
  }
  assert.ok(worst < 0.02, `两 preset 的档位分位差到 ${(worst * 100).toFixed(2)}pp，表就不能共用`);
  note(`AI02 tier-percentile max diff=${(worst * 100).toFixed(2)}pp`);
});

test('ai/03 牌力分位单调，且跨档不倒挂（弱档最强手 <= 强档最弱手）', () => {
  const rules = presets.classic;
  const span = new Map<TierId, { lo: number; hi: number }>();
  for (const h of HANDS) {
    const t = classify(h, rules).tier;
    const v = handStrength(h, rules);
    assert.ok(v >= 0 && v <= 1, `分位越界：${String(v)}`);
    const cur = span.get(t) ?? { lo: 1, hi: 0 };
    span.set(t, { lo: Math.min(cur.lo, v), hi: Math.max(cur.hi, v) });
  }
  const order = rules.handEval.tierOrder;
  for (let i = 1; i < order.length; i += 1) {
    const stronger = order[i - 1] as TierId;
    const weaker = order[i] as TierId;
    assert.ok(
      (span.get(weaker)?.hi ?? 0) <= (span.get(stronger)?.lo ?? 1) + 1e-12,
      `${weaker} 的最强手压过了 ${stronger} 的最弱手 ⇒ 分位函数与牌型序不一致`,
    );
  }
  assert.equal(span.get('trips')?.hi, 1, 'AAAK 级别应到分位 1');
});

test('ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）', () => {
  const base: GameState = startHand({
    rules: presets.classic,
    seed: 7,
    dealer: 0,
    seats: [0, 1, 2].map((seat) => ({ seat, chips: 300 })),
  });
  // 把 1 号的手牌换成三种极端不同的牌，且它始终没点看牌
  const hands: Card[][] = [
    [mk(14, 0), mk(14, 1), mk(14, 2)],
    [mk(2, 0), mk(4, 1), mk(7, 2)],
    [mk(9, 2), mk(10, 2), mk(11, 2)],
  ];
  const picks: string[] = [];
  for (const h of hands) {
    const st: GameState = {
      ...base,
      stake: 4,
      seats: base.seats.map((s) => (s.seat === 1 ? { ...s, hand: h } : s)),
    };
    const v = project(st, 1);
    assert.equal(v.seats.find((s) => s.seat === 1)?.cards, 'unknown', '构造前提：1 号没看过牌');
    const d = decideAi(v, 1, legalFor({ callCost: 8, raise: true, look: true }));
    picks.push(`${d.kind}/${d.reason}`);
  }
  assert.equal(new Set(picks).size, 1, `闷着时决策被手牌影响了：${picks.join(' | ')}`);
  assert.equal(picks[0]?.split('/')[0], 'look', '注级已抬到 4 还闷着 ⇒ 唯一诚实的选择是先看牌');
});

test('ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃', () => {
  const v = (cards: Card[], pot: number, stake: number, opponents = 2) =>
    viewOf({ seat: 0, cards, pot, stake, opponents, looked: true });
  const trips = v([mk(9, 0), mk(9, 1), mk(9, 2)], 20, 2);
  assert.equal(decideAi(trips, 0, legalFor({ callCost: 4, raise: true })).kind, 'raise', '豹子该做价值加注');
  const pair = v([mk(13, 0), mk(13, 1), mk(4, 2)], 20, 2);
  assert.equal(decideAi(pair, 0, legalFor({ callCost: 4, raise: true })).kind, 'call', '大对子跟住即可');
  assert.equal(decideAi(pair, 0, legalFor({ callCost: 4 })).kind, 'call');
  const trash = v([mk(2, 0), mk(5, 1), mk(9, 3)], 4, 8);
  assert.equal(decideAi(trash, 0, legalFor({ callCost: 16, raise: true })).kind, 'fold', '烂牌遇到大池价的必弃');
});

test('ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃', () => {
  const hand = [mk(7, 0), mk(8, 1), mk(11, 2)];
  const cheap = viewOf({ seat: 0, cards: hand, pot: 200, stake: 2, opponents: 2, looked: true });
  const dear = viewOf({ seat: 0, cards: hand, pot: 4, stake: 8, opponents: 2, looked: true });
  const a = decideAi(cheap, 0, legalFor({ callCost: 2 }));
  const b = decideAi(dear, 0, legalFor({ callCost: 16 }));
  assert.equal(a.kind, 'call', '同样的牌，池赔率极好时该跟');
  assert.equal(b.kind, 'fold', '同样的牌，池赔率极差时该弃');
  // J 高牌：分位 = 0.7439 × 档内位置(0.63) ≈ 0.47 —— 正落在"光看牌力定不了、必须看赔率"的中间带
  const s = handStrength(hand, presets.classic);
  assert.ok(s > 0.4 && s < 0.6, `构造前提：这手牌要落在中间带，实际 ${s.toFixed(3)}`);
});

test('ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守', () => {
  const hand = [mk(7, 0), mk(8, 1), mk(11, 2)];
  const vs1 = viewOf({ seat: 0, cards: hand, pot: 10, stake: 2, opponents: 1, looked: true });
  const vs5 = viewOf({ seat: 0, cards: hand, pot: 10, stake: 2, opponents: 5, looked: true });
  const solo = decideAi(vs1, 0, legalFor({ callCost: 2 }));
  const crowd = decideAi(vs5, 0, legalFor({ callCost: 2 }));
  assert.equal(solo.kind, 'call', '单挑时 J 高牌的赔率够打');
  assert.equal(crowd.kind, 'fold', '同一副牌被五家围殴 ⇒ 有效胜率 0.47^5 撑不住这条赔率');
  assert.ok(Math.pow(handStrength(hand, presets.classic), 5) < 0.05, '构造前提：五家折价后确实要掉到 5% 以下');
});

test('ai/08 看牌/保持闷是真决策：最低注级闷着省钱，注级一抬就先转明', () => {
  const dark = viewOf({ seat: 0, cards: 'unknown', pot: 6, stake: 1, opponents: 2, looked: false });
  assert.equal(decideAi(dark, 0, legalFor({ callCost: 1, raise: true, look: true })).kind, 'call', '注级还在最低 ⇒ 闷跟便宜，不必转明');
  assert.equal(decideAi(dark, 0, legalFor({ callCost: 1, look: true })).kind, 'call');
  const raised = viewOf({ seat: 0, cards: 'unknown', pot: 12, stake: 2, opponents: 2, looked: false });
  assert.equal(decideAi(raised, 0, legalFor({ callCost: 2, raise: true, look: true })).kind, 'look');
  // 转不了明（比如这一局已经看过、或合法集合里就是没有 look）⇒ 绝不盲注硬跟到底
  assert.equal(decideAi(raised, 0, legalFor({ callCost: 2, raise: true })).kind, 'fold');
});

test('ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）', () => {
  let rng = 12345;
  const next = (): number => {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  };
  const kinds = ['call', 'raise', 'fold', 'look', 'compare'] as const;
  let checked = 0;
  let compares = 0;
  let eligible = 0;
  for (let i = 0; i < 200; i += 1) {
    const subset = kinds.filter(() => next() < 0.6);
    if (!subset.includes('fold')) subset.push('fold');
    const legal: AiOption[] = subset.map((k) => ({
      kind: k,
      cost: k === 'call' ? 1 + Math.floor(next() * 30) : k === 'raise' ? 2 + Math.floor(next() * 30) : 0,
      target: k === 'compare' ? 1 + Math.floor(next() * 3) : -1,
    }));
    const dark = next() < 0.5;
    const hand = HANDS[Math.floor(next() * TOTAL)] as Card[];
    const v = viewOf({
      seat: 0,
      cards: dark ? 'unknown' : hand,
      pot: 1 + Math.floor(next() * 60),
      stake: [1, 2, 4, 8, 16][Math.floor(next() * 5)] as number,
      opponents: 1 + Math.floor(next() * 4),
      looked: !dark,
      seq: i,
    });
    const d = decideAi(v, 0, legal);
    assert.ok(legal.some((o) => o.kind === d.kind), `选了合法集合外的 ${d.kind}（合法 ${legal.map((o) => o.kind).join('/')}）`);
    if (dark) {
      assert.notEqual(d.kind, 'raise', '闷着不加注：没有牌力信息就不该主动抬价');
      assert.notEqual(d.kind, 'compare', '闷着不比牌：连自己拿什么都不知道，比牌就是掷骰子花两倍注级');
    }
    if (!dark && handStrength(hand, presets.classic) >= 0.75 && legal.some((o) => o.kind === 'compare')) eligible += 1;
    if (d.kind === 'compare') {
      compares += 1;
      assert.ok(legal.some((o) => o.kind === 'compare' && o.target === d.target), '比牌目标必须是合法集合里给出的那个 target');
      assert.ok(!dark && handStrength(hand, presets.classic) >= 0.75, '比牌资格：必须已看牌且分位 ≥ 0.75');
    }
    checked += 1;
  }
  assert.equal(checked, 200);
  // 分支必须活着；精确触发率由 ai/12 在 1000 个 seq 上量（这里样本里"有资格比牌"的本就稀少）
  assert.ok(compares > 0, `200 组样本里 AI 一次比牌都没发起 ⇒ 比牌分支是死代码`);
  note(`AI09 compare=${String(compares)}/${String(checked)} 组（其中有资格比牌的才 ${String(eligible)} 组）`);
});

// §4 M3 说"约 15% 触发"。这话只能在**能精确数**的地方断言：固定一个肯定有资格的局面，
// 扫 1000 个 seq 看命中次数 —— 顺带钉住"由 seq 派生 ⇒ 可重放"与"不同座位互相独立"。
test('ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）', () => {
  let hits = 0;
  for (let seq = 0; seq < 1000; seq += 1) hits += compareRoll(seq, 3) < AI_COMPARE_TRIGGER ? 1 : 0;
  const pct = hits / 10;
  assert.ok(pct >= 8 && pct <= 25, `触发率偏离 15% 太多：${String(pct)}%`);
  // 同输入必同结果（回放确定性的最小样本）
  for (const [seq, seat] of [[7, 1], [7, 2], [999, 4]] as const) {
    assert.equal(compareRoll(seq, seat), compareRoll(seq, seat), `seq=${String(seq)} seat=${String(seat)} 掷点不可重放`);
  }
  // 同 seq 换座位应当换结果 —— 否则全桌会同一步齐步走
  assert.notEqual(compareRoll(42, 1), compareRoll(42, 2));
  note(`AI12 trigger=${String(pct)}% over 1000 seqs`);
});

test('ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）', () => {
  const v = viewOf({ seat: 0, cards: [mk(12, 0), mk(12, 1), mk(5, 2)], pot: 30, stake: 4, opponents: 2, looked: true });
  const legal = legalFor({ callCost: 4, raise: true });
  assert.deepEqual(decideAi(v, 0, legal), decideAi(v, 0, legal));
  assert.equal(BLIND_PRIOR, 0.5, '闷着的先验就是随机牌的期望分位');
});

test('ai/11 先验与 tierOrder 挂钩：把档位排列倒过来，分位表跟着倒', () => {
  const flipped: Rules = {
    ...structuredClone(presets.classic),
    handEval: { ...presets.classic.handEval, tierOrder: [...presets.classic.handEval.tierOrder].reverse() },
  };
  const bands = tierPercentiles(flipped);
  // 倒过来之后高牌成了"最强档"：严格弱于它的只剩排在它后面的那些 ⇒ 0.256 而非 0
  assert.ok(Math.abs((bands['highCard']?.weaker ?? -1) - (1 - 16440 / TOTAL)) < 1e-9, '高牌成了最强档的分位算错');
  assert.equal(bands['trips']?.weaker, 0, '豹子垫底 ⇒ 没有任何随机手比它更弱');
  // share 只跟本档计数有关，不随排列变（变的是 weaker）
  assert.ok(Math.abs((bands['trips']?.share ?? 0) - 52 / TOTAL) < 1e-12, 'share 不该随 tierOrder 变');
});

// §4 M3 的两条资格细则必须各自有断言，否则"目标选错""每局上限失效"是测不出来的盲区
test('ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比', () => {
  const strong: Card[] = [mk(14, 0), mk(14, 1), mk(13, 2)];
  const base = viewOf({ seat: 0, cards: strong, pot: 8, stake: 2, opponents: 3, looked: true });
  const thick = { ...base, seats: base.seats.map((s) => (s.seat === 0 ? s : s.seat === 3 ? { ...s, committed: 40 } : { ...s, committed: 6 })) };
  assert.ok(handStrength(strong, presets.classic) >= 0.75, '构造前提：这手牌要有比牌资格');
  const legal: AiOption[] = [
    { kind: 'call', cost: 4, target: -1 },
    { kind: 'compare', cost: 4, target: 1 },
    { kind: 'compare', cost: 4, target: 2 },
    { kind: 'compare', cost: 4, target: 3 },
    { kind: 'fold', cost: 0, target: -1 },
  ];
  let fired: number | null = null;
  for (let seq = 0; seq < 400; seq += 1) {
    const d = decideAi({ ...thick, seq }, 0, legal);
    if (d.kind === 'compare') {
      fired = seq;
      assert.equal(d.target, 3, '应挑投入最高的活跃对手');
      break;
    }
  }
  assert.notEqual(fired, null, '400 个 seq 都没触发 ⇒ 够格的局面下比牌分支是死代码');
  if (fired === null) return;
  const already = {
    ...thick,
    seq: fired,
    log: [{ type: 'compare' as const, seat: 0, target: 3, amount: 4, stake: 2, note: '开牌', seq: fired - 1 }],
  };
  assert.notEqual(decideAi(already, 0, legal).kind, 'compare', '本局已经比过牌，却又发起了一次比牌');
});

test('ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）', () => {
  const strong: Card[] = [mk(14, 0), mk(14, 1), mk(13, 2)];
  const base = viewOf({ seat: 0, cards: strong, pot: 8, stake: 2, opponents: 2, looked: true });
  // 故意把座位号撒开：本人在 0 号，两个对手在 3 号与 7 号，庄家在 7 号。
  // 庄家下家方向 ⇒ 环形序 7 → 0 → 3，所以并列时必须挑 3 号；座位号最大的 7 号恰恰是错答案。
  const numbered = base.seats.map((s, i) => ({ ...s, seat: [0, 3, 7][i] ?? s.seat, active: true, committed: [8, 10, 10][i] ?? s.committed }));
  const tie = { ...base, seats: numbered, dealer: 7 };
  assert.equal(numbered.length, 3);
  assert.equal(numbered[1]?.committed, numbered[2]?.committed, '构造前提：两个对手的已投入必须并列');
  assert.ok(handStrength(strong, presets.classic) >= 0.75, '构造前提：这手牌要有比牌资格');
  const legal: AiOption[] = [
    { kind: 'call', cost: 4, target: -1 },
    { kind: 'compare', cost: 4, target: 3 },
    { kind: 'compare', cost: 4, target: 7 },
    { kind: 'fold', cost: 0, target: -1 },
  ];
  let fired = 0;
  for (let seq = 0; seq < 400; seq += 1) {
    const d = decideAi({ ...tie, seq }, 0, legal);
    if (d.kind !== 'compare') continue;
    fired += 1;
    assert.equal(d.target, 3, `并列时选了座位号最大的 ${String(d.target)}，环形序应选庄家下家方向的 3 号`);
    if (fired >= 8) break;
  }
  assert.ok(fired > 0, '400 个 seq 都没触发比牌 ⇒ 这条并列断言是空跑的');
});

test('ai/14 掷点只由 seq+座位决定：同输入同结果、同 seq 换座位换结果', () => {
  assert.equal(compareRoll(4242, 1), compareRoll(4242, 1), '同一输入两次掷点不同 ⇒ 混进了外部状态');
  const spread = new Set([0, 1, 2, 3, 4].map((s) => compareRoll(4242, s)));
  assert.ok(spread.size >= 4, '同 seq 下各座位几乎全同 ⇒ 全桌会齐步走');
  const roll = compareRoll(4242, 1);
  assert.ok(roll >= 0 && roll < 1000);
});
