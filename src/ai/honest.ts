// M2 · 诚实 AI（工单 §4 M2：牌力档位 + 池赔率；§2.6：不许偷看）。
//
// 信息边界（这条是本模块存在的理由）：
//   唯一输入是 project() 产出的 View + 调用方递来的合法行动表。View 的座位里**没有 hand 字段**，
//   只有"已公开或自己看过"的 cards，未看牌时是 'unknown' —— 所以"直读 GameState.seats[].hand"
//   在本模块里连语法上都写不出来，而不是靠自觉。test/static.test.ts 的 static/13 把这条钉成机检。
//
// 因为看不到未看过的牌，AI 必须真做「看牌 / 保持闷」这个决策（§1 看牌行）：
//   闷着时它的牌力先验就是一副随机牌（期望分位 0.5），没有任何手牌信息可用。
//
// 纯函数、零依赖、无时钟无随机（同一输入必同一输出，回放与 fuzz 才能钉死）。
import { classify, mulberry32 } from '../cards.ts';
import type { ActionKind } from '../engine/state.ts';
import type { View } from '../engine/project.ts';
import type { Rules, TierId } from '../rules.ts';

// 调用方（webmin/model.ts）从引擎的 legalActions + actionCost 折算出来递进来：
// AI 因此从不自己判合法性，也就没机会绕过 validate 这个唯一入口。
export type AiOption = { kind: ActionKind; cost: number; target: number };

export type AiDecision = {
  kind: ActionKind;
  target: number;
  /** 只供测试与本地断点查看：它含自己的牌力，**绝不许进 action log 或任何渲染**（会漏牌）。 */
  reason: string;
};

// 手牌分布的事实：C(52,3)=22100 手全枚举出来的各档计数（preset classic）。
// 不是拍脑袋的先验 —— test/ai-honest.test.ts 会重新穷举一遍并逐档比对。
const TOTAL_HANDS = 22100;
const TIER_COUNTS: Record<TierId, number> = {
  trips: 52,
  straightFlush: 48,
  flush: 1096,
  straight: 720,
  pair: 3744,
  highCard: 16440,
};

// 决策常数（v1 占位级，故意粗）：
// CALL_MARGIN = 要求的超额胜率；RAISE_AT = 开始做价值加注的分位；BLIND_PRIOR = 闷着的先验分位。
const CALL_MARGIN = 0.05;
const RAISE_AT = 0.9;
// M3 附带需求（§4 M3）：AI 主动比牌。资格线 = 分位 ≥ 0.75（大约对子以上），
// 且本局还没发起过比牌，且比牌在合法集合里（首圈禁比已解除、付得起费 ⇒ 由调用方保证）。
const COMPARE_AT = 0.75;
// 触发率掷点由 view.seq 派生（确定性伪随机），**绝不引非确定性随机源** —— 回放与 fuzz 的确定性是 M1 立的规矩。
const COMPARE_TRIGGER = 150; // ‱ 制：v % 1000 < 150 ⇒ 约 15%
export const AI_COMPARE_TRIGGER = COMPARE_TRIGGER;

// 由 seq + 座位派生的确定性 0..999 掷点：同一局面重放必得同一结果。
export function compareRoll(seq: number, seat: number): number {
  const mix = mulberry32(((seq + 1) * 2654435761 + seat * 40503) >>> 0);
  return mix() % 1000;
}
export const BLIND_PRIOR = 0.5;

// 各档的两个分位：weaker = P(随机手牌严格弱于该档)，share = P(恰为该档)。
// tierOrder 是"从最强排到最弱"，所以走到某档时累计的是**该档或更强**的占比，
// weaker = 1 - 累计(含本档)；写成"累计(之前)/TOTAL"会把整张表倒过来（豹子变成最弱）。
export function tierPercentiles(rules: Rules): Record<TierId, { weaker: number; share: number }> {
  const out = {} as Record<TierId, { weaker: number; share: number }>;
  let atOrAbove = 0;
  for (const tier of rules.handEval.tierOrder) {
    const count = TIER_COUNTS[tier] ?? 0;
    atOrAbove += count;
    out[tier] = { weaker: 1 - atOrAbove / TOTAL_HANDS, share: count / TOTAL_HANDS };
  }
  return out;
}

function bandOf(bands: ReturnType<typeof tierPercentiles>, tier: TierId): { weaker: number; share: number } {
  return bands[tier] ?? { weaker: 0, share: 0 };
}

// 同一档内部再分高低：classify 给的 ranks 就是该牌型的归一化比较键，逐位取 (rank-2)/12 加权平均。
// 权重大→小递减，保证"同档比大小"单调（对子先看对子点再看踢脚，单张先看大牌）。
function withinTierValue(ranks: number[]): number {
  if (ranks.length === 0) return 0;
  const weights: number[] = [];
  let sum = 0;
  for (let i = 0; i < ranks.length; i += 1) {
    const w = Math.pow(2, -i);
    weights.push(w);
    sum += w;
  }
  let acc = 0;
  ranks.forEach((r, i) => {
    acc += ((r - 2) / 12) * ((weights[i] ?? 1) / sum);
  });
  return Math.max(0, Math.min(1, acc));
}

// 同一档内**可达**的加权位置区间。不归一化会在底端系统性偏高：最烂的一手会拿到十几个点的假胜率。
// 端点是解析推出来的（不是抄来的），推理只有三条：
//   · 三张同点的极值 = 2..14；两张同点的键是 [对子点, 踢脚] ⇒ 最小 22+3、最大 AA+K；
//   · 三张异点的键是 [大, 中, 小]，但**不能连成顺** ⇒ 最高是 A-K-J（A-K-Q 是顺子），
//     最低是 5-3-2（4-3-2 是顺子；这一条与 a23 无关，a23 只管 A-2-3 算不算顺）；
//   · 顺子与同花顺的键只有高点 ⇒ a23 合法时最低 3（A23），否则最低 4（234）。
// 这张表由 test/m2-fuzz.test.ts 用 22100 手全枚举反查校验（两个 preset 都校）——我第一版就把
// 高牌最小手写成 7-4-2、又误推 a23off 下变成 4-3-2，两次都是那条检查先炸的。
function proxyRange(rules: Rules): Record<TierId, { lo: number; hi: number }> {
  const lowestRunHigh = rules.handEval.a23 ? 3 : 4;
  const lowestTrip = [5, 3, 2];
  const highestTrip = [14, 13, 11];
  return {
    trips: { lo: withinTierValue([2]), hi: withinTierValue([14]) },
    straight: { lo: withinTierValue([lowestRunHigh]), hi: withinTierValue([14]) },
    straightFlush: { lo: withinTierValue([lowestRunHigh]), hi: withinTierValue([14]) },
    pair: { lo: withinTierValue([2, 3]), hi: withinTierValue([14, 13]) },
    flush: { lo: withinTierValue(lowestTrip), hi: withinTierValue(highestTrip) },
    highCard: { lo: withinTierValue(lowestTrip), hi: withinTierValue(highestTrip) },
  };
}

// 牌力分位 ∈ [0,1]：我这手牌能压过多大比例的随机手牌。看不到牌（闷）⇒ 随机牌先验。
export function handStrength(cards: unknown, rules: Rules): number {
  if (cards === 'unknown' || !Array.isArray(cards)) return BLIND_PRIOR;
  const hand = classify(cards as Parameters<typeof classify>[0], rules);
  const { weaker, share } = bandOf(tierPercentiles(rules), hand.tier);
  const span = proxyRange(rules)[hand.tier] ?? { lo: 0, hi: 1 };
  const width = span.hi - span.lo;
  const pos = width <= 0 ? 0 : (withinTierValue(hand.ranks) - span.lo) / width;
  return weaker + share * Math.max(0, Math.min(1, pos));
}

// 需要的胜率 = 本次投入 / (池 + 本次投入)。对手越多，同一副牌的有效胜率越低（各对手独立压过一遍）。
function equityOf(strength: number, opponents: number): number {
  const n = Math.max(1, opponents);
  return Math.pow(strength, n);
}

function pick(legal: AiOption[], kind: ActionKind): AiOption | null {
  return legal.find((o) => o.kind === kind) ?? null;
}

// 本局这一家是否已经发起过比牌 —— 不引入任何新状态：引擎日志就是事实来源（§4 M3「同局每家至多 1 次」）。
function alreadyCompared(view: View, seat: number): boolean {
  return view.log.some((e) => e.type === 'compare' && e.seat === seat);
}

// 从庄家下家起的环形序（§1 一贯的"最近"参照）
function ringOrder(view: View): number[] {
  const seats = view.seats.map((s) => s.seat).sort((a, b) => a - b);
  const idx = seats.indexOf(view.dealer);
  const out: number[] = [];
  for (let step = 1; step <= seats.length; step += 1) {
    const s = seats[(idx + step + seats.length) % seats.length];
    if (s !== undefined) out.push(s);
  }
  return out;
}

// 目标 = 活跃对手中"本局已投入"最高者（压得最狠的那个）；并列取距庄家下家最近的一个。
// 只从调用方给来的合法 compare 目标里挑 —— AI 永远没机会自己造一个 target。
function bestCompareTarget(view: View, seat: number, legal: AiOption[]): number | null {
  const allowed = legal.filter((o) => o.kind === 'compare').map((o) => o.target);
  if (allowed.length === 0) return null;
  const order = ringOrder(view);
  const candidates = view.seats.filter((s) => s.active && s.seat !== seat && allowed.includes(s.seat));
  let best = candidates[0];
  if (best === undefined) return null;
  for (const c of candidates) {
    if (c.committed > best.committed) best = c;
    else if (c.committed === best.committed && order.indexOf(c.seat) < order.indexOf(best.seat)) best = c;
  }
  return best.seat;
}

export function decideAi(view: View, seat: number, legal: AiOption[]): AiDecision {
  const fold = (): AiDecision => {
    const f = pick(legal, 'fold');
    if (f !== null) return { kind: 'fold', target: -1, reason: 'fold:no-affordable-play' };
    const first = legal[0];
    return first === undefined
      ? { kind: 'fold', target: -1, reason: 'fold:no-legal-option' }
      : { kind: first.kind, target: first.target, reason: 'fallback:first-legal' };
  };
  const me = view.seats.find((s) => s.seat === seat);
  if (me === undefined || view.phase !== 'betting') return fold();

  const rules = view.rules;
  const known = me.cards !== 'unknown';
  const strength = known ? handStrength(me.cards, rules) : BLIND_PRIOR;
  const opponents = view.seats.filter((s) => s.active && s.seat !== seat).length;

  // 闷着 ⇒ 没有任何手牌信息，先验就是随机牌。什么时候值得花"从此付明价"这个代价去买信息？
  //   · 注级已抬高 ⇒ 闷跟的便宜已经不够撑，先转明再按牌力决策；
  //   · 或者这一注级我还没行动过、池还很浅（没人往里压钱）⇒ 信息最便宜的时候买，之后才打得动。
  // 后一条不是可有可无：全员都只在注级抬高时才看牌的话，没人会先加注，注级永远停在最低，
  // 整桌退化成"每局都只走 §1③ stall 结束"（m2/03 实测抓到过这一点）。
  const firstInStake = me.actionsAtStake === 0;
  const shallow = view.pot <= 4 * rules.ante;
  if (!known && (view.stake > rules.stake.initial || (firstInStake && shallow))) {
    const look = pick(legal, 'look');
    if (look !== null) {
      return {
        kind: 'look',
        target: -1,
        reason: `dark:stake=${String(view.stake)} firstInStake=${String(firstInStake)} pot=${String(view.pot)}`,
      };
    }
    return fold();
  }

  const callOpt = pick(legal, 'call');
  const required = callOpt === null ? 1 : callOpt.cost / Math.max(1, view.pot + callOpt.cost);
  const equity = equityOf(strength, opponents);

  if (known) {
    // 主动比牌（§4 M3）：看过牌、牌力够硬、本局还没用过这张、且由 seq 派生的掷点落在触发带里。
    // 掷点与 seq 绑定 ⇒ 同一动作序列重放必然走同一条分支；每家每局至多一次的判定来自引擎日志。
    const target = bestCompareTarget(view, seat, legal);
    const roll = compareRoll(view.seq, seat);
    if (target !== null && strength >= COMPARE_AT && !alreadyCompared(view, seat) && roll < COMPARE_TRIGGER) {
      return { kind: 'compare', target, reason: `compare:strength=${strength.toFixed(3)} roll=${String(roll)}` };
    }
    const raiseOpt = pick(legal, 'raise');
    if (raiseOpt !== null && view.stake < rules.stake.max && strength >= RAISE_AT) {
      return { kind: 'raise', target: -1, reason: `raise:strength=${strength.toFixed(3)}` };
    }
  }
  if (callOpt !== null && equity >= required + CALL_MARGIN) {
    return { kind: 'call', target: -1, reason: `call:eq=${equity.toFixed(3)}>=req=${required.toFixed(3)}` };
  }
  return { ...fold(), reason: `fold:eq=${equity.toFixed(3)}<req=${required.toFixed(3)}` };
}
