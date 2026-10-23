// M1.5 · 页面侧的"会话模型"：把引擎的 GameState 包成一局接一局、跨局记筹码的会话。
// 本文件不碰 DOM、不碰时钟、不用 Math.random —— 因此可被 test/ 下的 Node 测试直接 import，
// 页面层（app.ts）只把这里给出的字符串与意图画到屏幕上；规则判定一律在 src/engine 里。
import { classify, mulberry32 } from '../src/cards.ts';
import { presets, validateRules } from '../src/rules.ts';
import type { DealerNextId, Rules, TierId } from '../src/rules.ts';

// 页面层只跟 model 打交道，不直接 import src/：类型也从这里转出去。
export type { DealerNextId } from '../src/rules.ts';
import { actionCost, startHand, stateHash } from '../src/engine/state.ts';
import type { Action, Event as EngineEvent, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { legalActions } from '../src/engine/validate.ts';
import { project } from '../src/engine/project.ts';
import type { View } from '../src/engine/project.ts';
import { decideAi } from '../src/ai/honest.ts';
import type { AiOption } from '../src/ai/honest.ts';

export type SeatRole = 'human' | 'bot' | 'remote';
// human = 本机这个标签页的玩家；bot = 单机占位机器人；remote = 联机模式下别的真人。
// 第三种是 M5 加的唯一新取值：联机桌上人人都是真人，把别人标成 'bot' 会在座位板上印出"[电脑]"。
export type SeatInfo = { seat: number; role: SeatRole; name: string };

// 页面上能被点的"意图"。nextHand / reset 是会话层动作，其余一比一映射到引擎 Action。
export type Intent =
  | { kind: 'look' }
  | { kind: 'fold' }
  | { kind: 'call' }
  | { kind: 'raise' }
  | { kind: 'compare'; target: number }
  | { kind: 'settle' }
  | { kind: 'nextHand' }
  | { kind: 'reset' };

export type IntentOption = { intent: Intent; label: string; cost: number; target: number };

export type Session = {
  rules: Rules;
  presetName: 'classic' | 'a23off';
  seats: SeatInfo[];
  humanSeat: number;
  buyIn: number;
  baseSeed: number;
  handIndex: number;
  dealer: number;
  state: GameState;
  note: string | null;
  over: string | null;
};

export type ActResult = { ok: true; session: Session } | { ok: false; session: Session; error: string };

const TIER_CN: Record<TierId, string> = {
  trips: '豹子',
  straightFlush: '同花顺',
  flush: '同花',
  straight: '顺子',
  pair: '对子',
  highCard: '单张',
};

const REASON_CN: Record<string, string> = {
  oneLeft: '其他人都不在了 → 不开牌通吃',
  stakeCap: '注级到顶 16 且各家又各完成 1 次行动 → 强制开牌',
  stall: '同一注级下各家各完成 3 次行动 → 强制开牌',
};

const SUIT_GLYPH = ['♠', '♥', '♣', '♦'];
const RANK_CHAR = '23456789TJQKA';

export function tierName(tier: TierId): string {
  return TIER_CN[tier];
}

export function cardText(card: { rank: number; suit: number }): string {
  return `${RANK_CHAR[card.rank - 2] ?? '?'}${SUIT_GLYPH[card.suit] ?? '?'}`;
}

export function handText(cards: { rank: number; suit: number }[]): string {
  return cards.map(cardText).join(' ');
}

// 每局的种子由 baseSeed 纯函数派生（不用时钟、不用 Math.random）：
// 同一 baseSeed 的连续 N 局在任何机器上都可复算，复审想重放就有得重放。
export function deriveSeed(baseSeed: number, handIndex: number): number {
  let h = (baseSeed >>> 0) ^ 0x811c9dc5;
  const text = `hand=${String(handIndex)}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const rng = mulberry32(h);
  return (rng() ^ rng()) >>> 0;
}

export function createSession(options: {
  bots: number;
  baseSeed: number;
  buyIn?: number;
  humanSeat?: number;
  presetName?: 'classic' | 'a23off';
  dealerNext?: DealerNextId;
}): Session {
  const presetName = options.presetName ?? 'classic';
  const dealerNext: DealerNextId = options.dealerNext ?? 'rotate';
  // 三档配置走 Rules（§1 庄家行：配置落 Rules.dealer.next），非法取值由 validateRules 拒
  const rules = validateRules({
    ...structuredClone(presetName === 'classic' ? presets.classic : presets.a23off),
    dealer: { next: dealerNext },
  });
  const humanSeat = options.humanSeat ?? 0;
  if (!Number.isInteger(humanSeat) || humanSeat < 0) throw new TypeError('humanSeat must be >= 0');
  const bots = options.bots;
  if (!Number.isInteger(bots) || bots < 0 || bots + 1 > rules.players.max) {
    throw new TypeError(`bots must be an integer in 0..${String(rules.players.max - 1)}, got ${String(bots)}`);
  }
  if (!Number.isInteger(options.baseSeed)) throw new TypeError('baseSeed must be an integer');
  const buyIn = options.buyIn ?? rules.stake.max * 16;
  if (!Number.isInteger(buyIn) || buyIn < rules.ante) throw new TypeError(`buyIn must be an integer >= ante, got ${String(buyIn)}`);

  const seats: SeatInfo[] = [];
  for (let i = 0; i <= bots; i += 1) {
    seats.push({ seat: i, role: i === humanSeat ? 'human' : 'bot', name: i === humanSeat ? '你' : `电脑${String(i)}` });
  }
  const state = startHand({
    rules,
    seed: deriveSeed(options.baseSeed, 1),
    dealer: humanSeat,
    seats: seats.map((s) => ({ seat: s.seat, chips: buyIn })),
  });
  return {
    rules,
    presetName,
    seats,
    humanSeat,
    buyIn,
    baseSeed: options.baseSeed,
    handIndex: 1,
    dealer: humanSeat,
    state,
    note: null,
    over: null,
  };
}

export function view(s: Session): View {
  return project(s.state, s.humanSeat);
}

// 台账：口袋里可支配的筹码（本局已投进池的部分不在这里，另由 pot 单独显示）。
// 结算完成时 pot=0，此时的 chips 就是这家在桌上的全部身家 —— beginNextHand 就按它结转。
export function ledger(s: Session): { seat: number; name: string; role: SeatRole; chips: number }[] {
  const table = new Set(s.seats.map((x) => x.seat));
  return s.state.seats
    .filter((x) => table.has(x.seat))
    .map((x) => {
      const info = s.seats.find((i) => i.seat === x.seat) as SeatInfo;
      return { seat: x.seat, name: info.name, role: info.role, chips: x.chips };
    });
}

export function tableTotal(s: Session): number {
  return ledger(s).reduce((acc, x) => acc + x.chips, 0) + s.state.pot;
}

export function currentLedgerTotal(s: Session): number {
  return s.state.seats.reduce((acc, x) => acc + x.chips, 0) + s.state.pot;
}

export function isBotsTurn(s: Session): boolean {
  const st = s.state;
  if (st.phase !== 'betting' || st.turn < 0) return false;
  return s.seats.find((x) => x.seat === st.turn)?.role === 'bot';
}

export function compareTargets(s: Session): number[] {
  const st = s.state;
  return st.seats.filter((x) => x.active && x.seat !== st.turn).map((x) => x.seat);
}

// 页面上"按钮全集"的唯一来源：合法项来自 intentOptions，其余候选一律补齐并标灰。
// 灰按钮是 §4 M1.5 验收③的必需品 —— 非法点击要能真的走到引擎的拒绝路径，而不是被 disabled 挡在门外。
// 这里没有任何规则判定：legal 完全由 intentOptions（其上游是引擎 legalActions）说了算。
const INTENT_LABELS: Record<string, string> = {
  look: '看牌',
  call: '跟注',
  raise: '加注',
  fold: '弃牌',
  compare: '比牌',
  settle: '结算本局',
  nextHand: '再来一局',
  reset: '整桌重来',
};

const CANDIDATE_INTENTS: Intent[] = [
  { kind: 'look' },
  { kind: 'call' },
  { kind: 'raise' },
  { kind: 'fold' },
  { kind: 'compare', target: -1 },
  { kind: 'settle' },
  { kind: 'nextHand' },
  { kind: 'reset' },
];

function sameIntent(a: Intent, b: Intent): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'compare' && b.kind === 'compare') return a.target === b.target;
  return true;
}

// cost = 这一次行动要花多少钱；null = 界面拿不到这个数（联机模式下 Q6 尚未裁定，见 webui/netplay.ts 的 buttonRow）。
// 之所以允许 null 而不是填 0：0 是"不花钱"这个**事实**，与"不知道"是两回事，混起来就会有人拿 0 当占位把价格算出来。
export type ButtonOption = { intent: Intent; text: string; cost: number | null; legal: boolean };

export function buttonOptions(s: Session | null): ButtonOption[] {
  const legal: ButtonOption[] = (s === null ? [] : intentOptions(s)).map((o) => ({
    intent: o.intent,
    text: o.cost > 0 ? `${o.label}（出 ${String(o.cost)}）` : o.label,
    cost: o.cost,
    legal: true,
  }));
  const out: ButtonOption[] = [...legal];
  for (const c of CANDIDATE_INTENTS) {
    if (legal.some((b) => sameIntent(b.intent, c))) continue;
    const label = INTENT_LABELS[c.kind] ?? c.kind;
    out.push({ intent: c, text: c.kind === 'compare' ? `${label}（无合法目标）` : label, cost: 0, legal: false });
  }
  return out;
}

// 按钮清单：可用性完全来自引擎的 legalActions，页面自己绝不判规则。
// 唯一例外是 reset —— 它是会话层意图（act 在任何时刻都放行，ui/07 就钉着这条），
// 所以这里也必须把它报成"合法"。否则页面上会出现一个灰着暗示"点了会被拒"、实际却会生效的按钮，
// 直接破坏验收③赖以成立的契约："灰按钮 = 必被引擎拒"。
const RESET_OPTION: IntentOption = { intent: { kind: 'reset' }, label: '整桌重来', cost: 0, target: -1 };

export function intentOptions(s: Session): IntentOption[] {
  const st = s.state;
  if (s.over !== null) return [{ intent: { kind: 'reset' }, label: '重新开始', cost: 0, target: -1 }];
  if (st.phase === 'awaitingSettle') return [{ intent: { kind: 'settle' }, label: '结算本局', cost: 0, target: -1 }, RESET_OPTION];
  if (st.phase === 'settled') return [{ intent: { kind: 'nextHand' }, label: '再来一局', cost: 0, target: -1 }, RESET_OPTION];
  if (st.turn !== s.humanSeat) return [RESET_OPTION];
  const seat = s.humanSeat;
  const out: IntentOption[] = [];
  for (const a of legalActions(st)) {
    if (!('seat' in a) || a.seat !== seat) continue;
    if (a.kind === 'timeout') continue;
    if (a.kind === 'compare') {
      out.push({
        intent: { kind: 'compare', target: a.target },
        label: `比牌 → ${nameOf(s, a.target)}`,
        cost: actionCost(st, seat, 'compare'),
        target: a.target,
      });
      continue;
    }
    const kind = a.kind;
    const cost = kind === 'look' || kind === 'fold' ? 0 : actionCost(st, seat, kind);
    const label =
      kind === 'look' ? '看自己的牌' : kind === 'fold' ? '弃牌' : kind === 'call' ? (cost === 0 ? '跟注（免费）' : `跟注 ${String(cost)}`) : `加注 ${String(cost)}（注级 → ${String(st.stake * 2)}）`;
    out.push({ intent: { kind } as Intent, label, cost, target: -1 });
  }
  out.push(RESET_OPTION);
  return out;
}

// 任意座位的合法意图（机器人决策与测试用；真人按钮走 intentOptions）。
export function intentsFor(s: Session, seat: number): Intent[] {
  if (s.state.phase !== 'betting') return [];
  const out: Intent[] = [];
  for (const a of legalActions(s.state)) {
    if (!('seat' in a) || a.seat !== seat) continue;
    if (a.kind === 'timeout') continue;
    if (a.kind === 'compare') out.push({ kind: 'compare', target: a.target });
    else out.push({ kind: a.kind } as Intent);
  }
  return out;
}

function nameOf(s: Session, seat: number): string {
  return s.seats.find((x) => x.seat === seat)?.name ?? `座位${String(seat)}`;
}

// 三档的中文名：面板下拉与状态行共用同一份，避免两处措辞分叉。
export const DEALER_NEXT_LABELS: Record<DealerNextId, string> = {
  rotate: '轮庄',
  winner: '赢家坐庄',
  loser: '输家坐庄',
};

export function statusLine(s: Session): string {
  const st = s.state;
  const phase =
    st.phase === 'betting'
      ? `轮到 ${st.turn >= 0 ? nameOf(s, st.turn) : '—'}`
      : st.phase === 'awaitingSettle'
        ? '本局已定，等结算'
        : '本局已结算';
  return `第 ${String(s.handIndex)} 局 · 庄家 ${nameOf(s, s.dealer)} · 注级 ${String(st.stake)} · 池 ${String(st.pot)} · ${phase} · 牌型判定 ${s.presetName === 'classic' ? 'A23=最小顺' : 'A23 不算顺'} · 庄位规则 ${DEALER_NEXT_LABELS[s.rules.dealer.next] ?? '?'}`;
}

// 座位的结构化视图：M1.5 的文本行与 M3 的 Canvas 都从这里出，避免两处各算一遍。
// 数据来源仍是 project() 的投影 —— 未看牌的真人自己在界面上也拿不到牌面。
export type SeatCell = {
  seat: number;
  name: string;
  role: SeatRole;
  marks: string;
  chips: number;
  committed: number;
  looked: boolean;
  active: boolean;
  status: string;
  cardsText: string;
  tierText: string;
  // 结算那一刻这家的结果（'赢 15' / '没赢' / '应赢 8' / '—'）；未结算时为空串。
  // 单独立一个字段，是为了让 M3 的座位板能就地显示结果 —— 结算块就不必把每家的账再列一遍、
  // 从而不必盖在刚亮出来的牌上面（工单 §4 rev=7 ④）。
  resultText: string;
  hidden: boolean;
  departed: boolean;
};

// 每家结算结果文案的唯一出处：settlementRows 的每行长句 = 短句 +「（现筹码 X）」，座位板只印短句。
function outcomeOf(s: Session, chips: number, shareIdx: number, settled: boolean): { long: string; short: string } {
  const share = s.state.terminal?.shares[shareIdx] ?? 0;
  if (!settled) return shareIdx >= 0 ? { long: `应赢 ${String(share)}`, short: `应赢 ${String(share)}` } : { long: '—', short: '' };
  return shareIdx >= 0
    ? { long: `赢 ${String(share)}（现筹码 ${String(chips)}）`, short: `赢 ${String(share)}` }
    : { long: `没赢（现筹码 ${String(chips)}）`, short: '没赢' };
}

export function seatCells(s: Session): SeatCell[] {
  const v = view(s);
  const st = s.state;
  return s.seats.map((info) => {
    const row = v.seats.find((x) => x.seat === info.seat);
    if (row === undefined) {
      return {
        seat: info.seat, name: info.name, role: info.role, marks: '', chips: 0, committed: 0,
        looked: false, active: false, status: '', cardsText: '', tierText: '', resultText: '', hidden: true, departed: true,
      };
    }
    const status = !row.active ? (row.out === 'folded' ? '弃牌' : '被淘汰') : st.turn === info.seat ? '行动中' : '局中';
    const marks = [info.seat === s.dealer ? '庄' : '', info.seat === st.turn ? '◀' : ''].filter(Boolean).join('');
    const hidden = row.cards === 'unknown';
    return {
      seat: info.seat,
      name: info.name,
      role: info.role,
      marks,
      chips: row.chips,
      committed: row.committed,
      looked: row.looked,
      active: row.active,
      status,
      cardsText: row.cards === 'unknown' ? '···' : handText(row.cards),
      tierText: row.cards === 'unknown' ? '' : tierName(classify(row.cards, s.rules).tier),
      resultText: st.terminal === null ? '' : outcomeOf(s, row.chips, st.terminal.winners.indexOf(info.seat), st.phase === 'settled').short,
      hidden,
      departed: false,
    };
  });
}

export function seatRows(s: Session): string[] {
  return seatCells(s).map((c) =>
    c.departed
      ? `${c.name} 已离桌`
      : [
          c.marks.padEnd(3, ' ') + `${c.name}${c.role === 'bot' ? '[电脑]' : '[你]'}`,
          `筹码 ${String(c.chips)}`,
          `本局已投入 ${String(c.committed)}`,
          c.looked ? '明' : '闷',
          c.status,
          `牌 ${c.cardsText}${c.tierText === '' ? '' : ` (${c.tierText})`}`,
        ].join(' | '),
  );
}

// 日志行的唯一格式。单机与联机**共用这一个函数** —— 联机侧不许再写一份"日志长什么样"，
// 否则两条路的日志会慢慢长得不一样，而"日志里带 timeout 字样"这条可归因性判据就只在一边成立。
export function logLineOf(nameOfSeat: (seat: number) => string, e: EngineEvent): string {
  const who = e.seat >= 0 ? nameOfSeat(e.seat) : '—';
  const tgt = e.target >= 0 ? ` → ${nameOfSeat(e.target)}` : '';
  const amt = e.amount > 0 ? ` 出 ${String(e.amount)}` : '';
  return `#${String(e.seq).padStart(3, '0')} ${e.type.padEnd(9, ' ')} ${who}${tgt}${amt} @注级${String(e.stake)}｜${e.note}`;
}

export function logRows(s: Session, cap = 40): string[] {
  return s.state.log.slice(-cap).map((e) => logLineOf((seat) => nameOf(s, seat), e));
}

// 结束原因的中文口径。单机与联机共用这一个出处（联机侧只 import 这几个纯文本函数，
// 不 import 会话级函数 —— 由 test/netx-netplay.test.ts 的 nui/02 机检钉住）。
export const REASON_LABELS: Record<string, string> = REASON_CN;
export function reasonLabel(reason: string): string {
  return REASON_CN[reason] ?? reason;
}

export function settlementRows(s: Session): string[] {
  const st = s.state;
  const t = st.terminal;
  if (t === null) return [];
  const v = view(s);
  const rows = [`结束原因：${REASON_CN[t.reason] ?? t.reason}`];
  s.seats.forEach((info) => {
    const row = v.seats.find((x) => x.seat === info.seat);
    if (row === undefined) return;
    const cards = row.cards === 'unknown' ? '未开牌' : handText(row.cards);
    const tier = row.cards === 'unknown' ? '' : tierName(classify(row.cards, s.rules).tier);
    const shareIdx = t.winners.indexOf(info.seat);
    const outcome = outcomeOf(s, row.chips, shareIdx, st.phase === 'settled').long;
    rows.push(`${info.name}${info.role === 'bot' ? '[电脑]' : '[你]'}｜${cards}${tier === '' ? '' : ` ${tier}`}｜${outcome}`);
  });
  if (t.remainderTo >= 0) rows.push(`余数 1 分给距庄家下家最近的赢家：${nameOf(s, t.remainderTo)}`);
  rows.push(`指纹 ${stateHash(st)}`);
  return rows;
}

// 结算块里"每家的账"那几行不在这里 —— 它们就地印在各座位板上（SeatCell.resultText），
// 因为 M3 的牌桌底部条放不下 8 行账，硬塞就会压到刚亮出来的牌（工单 §4 rev=7 ④）。
export function settlementSummary(s: Session): string[] {
  const t = s.state.terminal;
  if (t === null) return [];
  const rows = [`结束原因：${REASON_CN[t.reason] ?? t.reason}`];
  if (t.remainderTo >= 0) rows.push(`余数 1 分给距庄家下家最近的赢家：${nameOf(s, t.remainderTo)}`);
  rows.push(`指纹 ${stateHash(s.state)}`);
  return rows;
}

// 一行"谁亮了什么牌"的文本行，用扑克 ASCII 记法（7♣ → 7C，T♥ → TH）。
// 为什么单独要它，而且为什么是 ASCII：牌面上的大字是给**人眼**看的（工单 §4 rev=7 ①），
// 而本机唯一装了的 OCR 引擎是 Windows.Media.Ocr / zh-Hans-CN —— 实测它对花色字形（♠♥♦♣）
// 一个都读不出（44px 也读不出），但成行的拉丁字母 + 数字能读。验收④要"机器读得出每张已亮牌"，
// 所以给机器一行它真吃得下的文本；同一行给人看也是标准记法，不额外占地方。
const SUIT_ASCII: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };

export function handAscii(cards: { rank: number; suit: number }[]): string {
  return handText(cards)
    .split(' ')
    .map((g) => `${g.slice(0, -1)}${SUIT_ASCII[g.slice(-1)] ?? '?'}`)
    .join(' ');
}

export function revealedHandsLine(s: Session): string {
  const v = view(s);
  const cells = seatCells(s).filter((c) => !c.hidden && !c.departed);
  if (cells.length === 0) return '';
  const parts = cells.map((c) => {
    const row = v.seats.find((x) => x.seat === c.seat);
    const ascii = row !== undefined && row.cards !== 'unknown' ? handAscii(row.cards) : '';
    return `${c.name} ${ascii}${c.tierText === '' ? '' : ` ${c.tierText}`}`;
  });
  return `亮牌：${parts.join(' / ')}`;
}

// 真人点按钮的唯一入口：任何非法意图都被引擎拒在这里，并且**绝不抛**到页面层。
export function act(s: Session, intent: Intent): ActResult {
  if (s.over !== null && intent.kind !== 'reset') {
    return { ok: false, session: { ...s, note: '牌局已结束，只能点"重新开始"' }, error: 'session_over' };
  }
  if (intent.kind === 'reset') {
    return {
      ok: true,
      session: createSession({
        bots: s.seats.length - 1,
        baseSeed: s.baseSeed,
        buyIn: s.buyIn,
        humanSeat: s.humanSeat,
        presetName: s.presetName,
        dealerNext: s.rules.dealer.next,
      }),
    };
  }
  if (intent.kind === 'nextHand') {
    if (s.state.phase !== 'settled') {
      return { ok: false, session: { ...s, note: '本局还没结算，不能开下一局' }, error: 'not_settled' };
    }
    return { ok: true, session: beginNextHand(s) };
  }
  const seat = s.humanSeat;
  // 这里**不预先判**"轮到你没有"——那是引擎唯一入口的职权，页面层只负责把它的话转述给人。
  const action = toAction(intent, seat);
  if (action === null) {
    return { ok: false, session: { ...s, note: `不认识的意图 ${String(intent.kind)}` }, error: 'unknown_intent' };
  }
  return applyAction(s, action);
}

function applyAction(s: Session, action: Action): ActResult {
  const before = stateHash(s.state);
  try {
    return { ok: true, session: { ...s, state: apply(s.state, action), note: null } };
  } catch (err) {
    const e = err as { name?: string; message?: string; code?: string };
    const code = typeof e.code === 'string' ? e.code : String(e.name ?? 'Error');
    const untouched = stateHash(s.state) === before;
    return {
      ok: false,
      session: { ...s, note: `被引擎拒绝（${code}）${untouched ? '' : '，且状态被改动了！'}` },
      error: code,
    };
  }
}

function toAction(intent: Intent, seat: number): Action | null {
  switch (intent.kind) {
    case 'look':
      return { kind: 'look', seat };
    case 'fold':
      return { kind: 'fold', seat };
    case 'call':
      return { kind: 'call', seat };
    case 'raise':
      return { kind: 'raise', seat };
    case 'compare':
      return { kind: 'compare', seat, target: intent.target };
    case 'settle':
      return { kind: 'settle' };
    case 'nextHand':
    case 'reset':
      return null;
    default: {
      const exhausted: never = intent;
      return exhausted;
    }
  }
}

// 机器人的决策入口。M1.5 这里是固定阈值的占位策略；M2 起委托给 src/ai 的诚实 AI（工单 §4 M2）。
// 关键不在"策略换了"，而在喂给策略的东西：project(state, seat) —— 它连未看过的本手牌都拿不到。
// 于是"闷着不能按牌力行动"不再靠策略代码自觉，而是被信息边界本身挡住（§2.6 / static/13 机检）。
export function chooseBotIntent(s: Session, seat: number): Intent {
  const options: AiOption[] = [];
  for (const a of legalActions(s.state)) {
    if (a.kind === 'timeout') continue;
    options.push({
      kind: a.kind,
      cost: actionCost(s.state, seat, a.kind),
      target: a.kind === 'compare' ? a.target : -1,
    });
  }
  if (options.length === 0) return { kind: 'fold' };
  const d = decideAi(project(s.state, seat), seat, options);
  // 决策只给 kind/target 级别的选择；回到 Intent 仍要在合法集合里取一个，杜绝凭空造动作
  const back = intentsFor(s, seat).find((i) => i.kind === d.kind);
  return back ?? { kind: 'fold' };
}

// 让当前回合的机器人走一步（不是它的回合就是 no-op）。M2 的 AI 与测试都走这个口子。
export function botStep(s: Session): ActResult {
  if (!isBotsTurn(s)) return { ok: true, session: s };
  const seat = s.state.turn;
  const intent = chooseBotIntent(s, seat);
  const action = toAction(intent, seat);
  if (action === null) return { ok: false, session: s, error: 'bot_intent' };
  return applyAction(s, action);
}

export function stepBots(s: Session, limit = 200): ActResult {
  let cur = s;
  let guard = 0;
  while (isBotsTurn(cur)) {
    guard += 1;
    if (guard > limit) {
      return { ok: false, session: { ...cur, note: `机器人走了 ${String(limit)} 步还没让位，卡住了` }, error: 'bot_loop' };
    }
    const r = botStep(cur);
    if (!r.ok) return r;
    cur = r.session;
  }
  return { ok: true, session: cur };
}

// 上一局庄家的下家起、沿环形序往后排（§1：行动一律从庄家下家开始 ⇒ "距庄家下家最近"就是这条序）。
function ringAfter(seats: number[], dealer: number): number[] {
  const idx = seats.indexOf(dealer);
  const out: number[] = [];
  for (let step = 1; step <= seats.length; step += 1) {
    out.push(seats[(idx + step + seats.length) % seats.length] as number);
  }
  return out;
}

export type PrevHand = {
  dealer: number;
  seats: number[];
  winners: number[];
  remainderTo: number | null;
};

// §1 庄家行三档。纯函数：给定上一局的局面上结果 + 下一局仍在桌的座位，返回该坐庄的那家。
// 返回 null 只有一种可能：一个仍在桌的座位都没有（调用方在那之前就该收桌）。
export function nextDealerOf(mode: DealerNextId, prev: PrevHand, seated: number[]): number | null {
  const order = ringAfter(prev.seats, prev.dealer);
  const nearest = (pool: number[]): number | null => order.find((x) => pool.includes(x)) ?? null;
  switch (mode) {
    case 'rotate':
      return nearest(seated);
    case 'winner': {
      const winners = prev.winners.filter((x) => seated.includes(x));
      // 平局分池：拿到余数的那位赢家优先（§1 原文），没有余数才退回"距庄家下家最近"
      if (prev.remainderTo !== null && winners.includes(prev.remainderTo)) return prev.remainderTo;
      return nearest(winners);
    }
    case 'loser': {
      const losers = prev.seats.filter((x) => !prev.winners.includes(x) && seated.includes(x));
      const firstLoser = nearest(losers);
      // Q2 已裁定 A：桌上已无在桌输家（分池多赢家 + 其余人破产时才可达）⇒ 退回轮庄。
      return firstLoser ?? nearest(seated);
    }
    default: {
      const exhausted: never = mode;
      return exhausted;
    }
  }
}

function beginNextHand(s: Session): Session {
  const ante = s.rules.ante;
  const chips = new Map(ledger(s).map((x) => [x.seat, x.chips]));
  const seats = s.seats.filter((x) => (chips.get(x.seat) ?? 0) >= ante);
  if (seats.length < s.rules.players.min) {
    return { ...s, over: `只剩 ${String(seats.length)} 家还付得起底注（最少需要 ${String(s.rules.players.min)} 家），牌局结束` };
  }
  const seated = seats.map((x) => x.seat).sort((a, b) => a - b);
  const terminal = s.state.terminal;
  const prev: PrevHand = {
    dealer: s.dealer,
    seats: s.state.seats.map((x) => x.seat).sort((a, b) => a - b),
    winners: terminal?.winners ?? [],
    remainderTo: terminal !== null && terminal.remainderTo >= 0 ? terminal.remainderTo : null,
  };
  const dealer = nextDealerOf(s.rules.dealer.next, prev, seated) ?? (seated[0] as number);
  const state = startHand({
    rules: s.rules,
    seed: deriveSeed(s.baseSeed, s.handIndex + 1),
    dealer,
    seats: seats.map((x) => ({ seat: x.seat, chips: chips.get(x.seat) ?? 0 })),
  });
  // 座位名册**不**在这里裁剪：破产者只是这一局不再发牌（state.seats 里没有他），
  // 但"整桌重来"要能把最初那几个人请回来 —— 裁了 reset 就只能重建幸存者（实测少一家）。
  return { ...s, handIndex: s.handIndex + 1, dealer, state, note: null, over: null };
}
