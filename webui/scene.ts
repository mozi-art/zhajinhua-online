// M3 · 场景层：把 Snapshot 排成"图元指令 + 命中区"。纯函数 —— 无 DOM、无时钟、无随机。
// scene 只决定"画什么、画在哪"，paint 才决定"怎么画到 Canvas 上"；
// 于是整套布局（含翻牌动画的进度）都能在 Node 里逐条断言，不必开浏览器就能测 UI。
//
// 动画走纯函数路线：翻牌进度由调用方把时钟当入参传进来（只有 main.ts 读时钟），
// 这样"同一输入两次布局逐字节相同"这条可测性不会被时钟破坏。
//
// rev=7 观感修正（工单 §4）：牌面放大到 48×64、点数 20px（本人再大一档），座位环随之重排成
// 「本人在最下方 + 对手沿顶部横排 + 六人桌时两侧各让一枚」；竖向预算先满足牌桌，剩下的才给日志与按钮，
// 真装不下就走"窗口太小"提示路径 —— 绝不允许座位互相压住、压住按钮，或压住刚亮出来的牌。
import type { ButtonOption, SeatCell } from '../webmin/model.ts';
import type { Snapshot } from './bridge.ts';

export type Rect = { x: number; y: number; w: number; h: number };

// 渐变以"数据"进 scene（色标数组），paint 负责材质化 —— scene 保持纯函数可断言，
// paint 保持零写死颜色（ui3/29 扫描）。radial = 椭圆内径向；缺省 = 竖向线性。
export type Grad = { stops: [number, string][]; radial?: boolean };

export type Primitive =
  | { kind: 'rect'; rect: Rect; fill: string; stroke: string | null; radius: number; tilt?: number; grad?: Grad }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string | null; stroke: string | null; grad?: Grad }
  | { kind: 'text'; x: number; y: number; text: string; size: number; color: string; bold: boolean; align: 'left' | 'center' | 'right' }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string };

export type Hit = { id: string; rect: Rect; intent: ButtonOption['intent'] };

export type Scene = {
  width: number;
  height: number;
  font: string;
  primitives: Primitive[];
  hits: Hit[];
  // 座位板的落位矩形（布局元数据）：paint 不读它，但它才是"六家挤不挤得下"的可测口径
  plates: Rect[];
  // 底部条（日志 / 结算块）所在的矩形：座位板不许压上来，按钮条也不许
  strip: Rect | null;
};

export type Style = {
  bg: string;
  felt: string;
  feltEdge: string;
  rail: string;
  panel: string;
  panelSoft: string;
  fg: string;
  dim: string;
  accent: string;
  legal: string;
  illegal: string;
  btnText: string; // 主 CTA（金按钮）上的深色字：金底深字才像天天斗地主的行动钮
  warn: string;
  cardFace: string;
  cardBack: string;
  cardRed: string;
  font: string;
  pad: number;
  rowH: number;
};

// 牌桌字体：天天斗地主式圆润黑体。等宽换圆体只改观感，不改估算口径
//（CJK 记 1.0 字宽、其余记 0.62，宁可估大也别估小）⇒ fitSize/wrapLabel 的行为逐字节不动。
export const CARD_FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", "HarmonyOS Sans SC", sans-serif';

// 拟物牌桌：绿呢台面 + 木色边轨 + 环形座位 + 中央底池。
// rev=12 起默认主题按「天天斗地主」的视觉语言重调：饱和绿呢 + 斗地主金 accent + 金底深字的主行动钮。
// 只换色不换布局（ui3/35 钉住 pad/rowH/font 三主题一致）；ink/paper 保留各自的墨金/朱砂 accent。
export const TABLE_STYLE: Style = {
  bg: '#07120d',
  felt: '#1b6b45',
  feltEdge: '#11452d',
  rail: '#6b4423',
  panel: '#12241b',
  panelSoft: '#1e3b2b',
  fg: '#f3f8ef',
  dim: '#9db8a6',
  accent: '#ffc53d',
  legal: '#2f9e5f',
  illegal: '#243528',
  btnText: '#23180a',
  warn: '#e0533a',
  cardFace: '#fffdf4',
  cardBack: '#1f5fa8',
  cardRed: '#c62828',
  font: CARD_FONT,
  pad: 14,
  rowH: 18,
};

// 墨金：暗墨纸面 + 金 accent。只换色不换布局 —— Style 是布局之外的全部观感，
// 换主题 = 给 buildScene 换一个常量（main.ts 负责循环与持久化，scene 不碰存储）。
export const INK_STYLE: Style = {
  bg: '#0d0c0a',
  felt: '#26200f',
  feltEdge: '#171307',
  rail: '#4a3a20',
  panel: '#171410',
  panelSoft: '#211c14',
  fg: '#efe9dc',
  dim: '#a89f8d',
  accent: '#d9a441',
  legal: '#44603a',
  illegal: '#2a2620',
  btnText: '#241a08',
  warn: '#a04a3a',
  cardFace: '#f4efe4',
  cardBack: '#31415f',
  cardRed: '#c04a35',
  font: TABLE_STYLE.font,
  pad: 14,
  rowH: 18,
};

// 月白：浅色纸面 + 朱砂 accent。给亮环境与投屏演示用；对比度按 fg/dim 全部重调过。
export const PAPER_STYLE: Style = {
  bg: '#efe9dc',
  felt: '#e7ddc4',
  feltEdge: '#d3c5a2',
  rail: '#b09a6a',
  panel: '#f6f1e6',
  panelSoft: '#ece4d2',
  fg: '#2a2620',
  dim: '#6f6754',
  accent: '#b8432f',
  legal: '#5c7f5c',
  illegal: '#cfc6b2',
  btnText: '#2a0f08',
  warn: '#a04a3a',
  cardFace: '#fffdf6',
  cardBack: '#8a94a8',
  cardRed: '#b8432f',
  font: TABLE_STYLE.font,
  pad: 14,
  rowH: 18,
};

// 低于这个视口不做布局，只画一条提示 —— 与其把东西叠在一起装作"能玩"，不如明确说不行。
export const MIN_VIEWPORT = { w: 560, h: 560 };

// ── rev=7 尺寸表（工单下限：牌 ≥ 48×64、点数字号 ≥ 18；本人手牌再放大一档）──
// pitch < 牌宽 ⇒ 三张扇形叠放；点数画在**左上角**，被叠住的只是右下角，逐张照样读得出。
export const CARD = { w: 48, h: 64, pitch: 30, font: 20, suitFont: 18 };
export const OWN_CARD = { w: 56, h: 78, pitch: 60, font: 24, suitFont: 22 };

function redSuit(suit: string): boolean {
  return suit === '♥' || suit === '♦';
}

// —— 颜色混合助手（纯函数）：3D 拟物的明暗都从主题色推导，不引入新调色板 ——
function hexParts(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
// t > 0 向白靠，t < 0 向黑靠（t ∈ [-1,1]）
function shade(hex: string, t: number): string {
  const [r, g, b] = hexParts(hex);
  const to = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  const f = (v: number): number => Math.round(v + (to - v) * k);
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexParts(hex);
  return `rgba(${String(r)},${String(g)},${String(b)},${String(a)})`;
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const PAD = 8; // 座位板内边距
const AVATAR = 44; // 头像圆环直径（程序化：首字母 + 金圈双环，无外部素材）—— 斗地主式大头像
const OWN_LABELS = 168; // 本人板：说明文字占左侧一栏，牌放右边（省下的竖向高度是 6 人桌的救命钱）
const TOP_TEXT = 34; // 对手板：两行说明占顶部这条带，牌从这条带下面开始
const CAPTION = 12; // 对手板：牌下面那行（牌型 / ···）

export const OPP_PLATE = { w: CARD.pitch * 2 + CARD.w + PAD * 2, h: TOP_TEXT + CARD.h + CAPTION }; // 124 × 110（头像只上本人板：124 是 560 视口 6 家桌的活口）
export const OWN_PLATE = { w: OWN_LABELS + OWN_CARD.pitch * 2 + OWN_CARD.w + PAD, h: OWN_CARD.h + PAD * 2 }; // 352 × 94
const BAND_GAP = 4;
const TOP_BAR = 32;
const BTN_H = 28;
const MIN_BTN_W = 112;

// 翻牌动画：since = 该座位牌面首次可见的时刻（由调用方计时），duration = 一次翻牌用时。
// 发牌动画：deal.start = 本局发牌起始时刻；每张牌按"环座位 × 3 张"的确定次序错峰起飞，
// 落定后与不带 deal 的布局逐字节相同（ui3/28 钉住两端与中途的泄露面）。
// 筹码动画：chips = 某座位刚下注的 {seat, since, count}；新筹码从座位板弧线飞向桌前筹码堆，
// 飞行中额外画、落定后不画（堆里本来就有它们）⇒ 两端与不带 chips 逐字节一致（ui3/32）。
export type DealAnim = { start: number; duration: number; stagger: number };
export type ChipAnim = { seat: number; since: number; count: number };
export type Anim = { now: number; since: Record<number, number>; duration: number; deal?: DealAnim; chips?: ChipAnim };

export const IDLE_ANIM: Anim = { now: 0, since: {}, duration: 320 };

// 底部那一行台账数字的标签。它的口径就是 snap.total（单机 webmin/model.ts::tableTotal、
// 联机 webui/netplay.ts 同一条式子）：**本局在场**各家的筹码 + 池，离桌座位不计入 ——
// 那一份由房间台账继续欠着，等它拿 token 重连才会带回来，届时这个数会自己跳上去。
// 原先这里写的是「桌上总额」，那是一个比算法实际范围更宽的标签（rev=10 应修 7）：
// 玩家拿它判断"这局值不值得跟"，而它与重连后看到的账本对不上。
// 导出给用例钉"文案 ↔ departed 过滤"这一对：只改文案或只改过滤，nst/12 与 nui/22 会各红一条。
export const TOTAL_LABEL = '在场筹码+池';

// 桌前筹码堆：1 枚筹码 = 1 个当前注级（口径声明在 ui3/32）。
// committed 里混着底注与明牌加倍等成分，用"当前注级"折算是唯一的统一单位；
// 封顶 8 枚是视觉口径（超过部分不再堆高，数字仍以座位板「投入」为准）。
export const CHIP = { rx: 11, ry: 5.5, max: 8, gap: 4 };

export function chipStackCount(committed: number, stake: number): number {
  if (committed <= 0 || stake <= 0) return 0;
  return Math.max(1, Math.min(CHIP.max, Math.round(committed / stake)));
}

function text(x: number, y: number, t: string, st: Style, opt?: { size?: number; color?: string; bold?: boolean; align?: 'left' | 'center' | 'right' }): Primitive {
  return {
    kind: 'text',
    x,
    y,
    text: t,
    size: opt?.size ?? 14,
    color: opt?.color ?? st.fg,
    bold: opt?.bold ?? false,
    align: opt?.align ?? 'left',
  };
}

// 等宽字体下的保守估宽：CJK 记 1.0 个字宽，其余记 0.62（宁可估大也别估小，否则会画到画布外）
function textWidth(t: string): number {
  let units = 0;
  for (const ch of t) units += ch.charCodeAt(0) > 0x2e80 ? 1 : 0.62;
  return units;
}

// 一行文本放得下的最大字号（不超过 max，下限 10）—— 只用于状态行这种"不许截断"的整句。
function fitSize(t: string, avail: number, max: number): number {
  const units = Math.max(1, textWidth(t));
  return Math.max(10, Math.min(max, Math.floor(avail / units)));
}

// 一行放不下就折成两行（只在空格处断，断不出两行时按字宽对半）。
// 为什么必须折：按钮文案是模型算好的整句（含价格与注级），在这儿截断就等于把信息删掉。
function wrapLabel(t: string, avail: number, size: number): string[] {
  if (textWidth(t) * size <= avail) return [t];
  const half = textWidth(t) / 2;
  let best = -1;
  let bestDiff = Infinity;
  for (let i = 1; i < t.length; i += 1) {
    if (t[i] !== ' ' && t[i - 1] !== ' ') continue;
    const diff = Math.abs(textWidth(t.slice(0, i)) - half);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  if (best <= 0) best = Math.floor(t.length / 2);
  const first = t.slice(0, best).trimEnd();
  const second = t.slice(best).trimStart();
  return second === '' ? [first] : [first, second];
}

// 贪心折行：优先在空格处断；一行都塞不下的极端长串就硬断。返回 null 表示"这个字号放不下"。
function wrapMany(t: string, avail: number, size: number, maxLines: number): string[] | null {
  const words = t.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const cand = cur === '' ? word : `${cur} ${word}`;
    if (textWidth(cand) * size <= avail) {
      cur = cand;
      continue;
    }
    if (cur !== '') {
      lines.push(cur);
      cur = word;
    } else {
      lines.push(word.slice(0, Math.max(1, Math.floor(avail / size))));
      cur = word.slice(Math.max(1, Math.floor(avail / size)));
    }
    if (lines.length > maxLines) return null;
  }
  if (cur !== '') lines.push(cur);
  return lines.length <= maxLines ? lines : null;
}

function notice(width: number, height: number, st: Style, msg: string): Scene {
  return {
    width,
    height,
    font: st.font,
    primitives: [
      { kind: 'rect', rect: { x: 0, y: 0, w: width, h: height }, fill: st.bg, stroke: null, radius: 0 },
      text(width / 2, height / 2, msg, st, { size: 15, color: st.accent, align: 'center' }),
    ],
    hits: [],
    plates: [],
    strip: null,
  };
}

// 0 = 牌背，1 = 完全翻 open；未配动画时视为 1（直接是终态，可测且不会永远卡在翻一半）
function flipProgress(anim: Anim, seat: number): number {
  const since = anim.since[seat];
  if (since === undefined) return 1;
  if (anim.duration <= 0) return 1;
  const p = (anim.now - since) / anim.duration;
  return p <= 0 ? 0 : p >= 1 ? 1 : p;
}

// 座位环要多高：顶部一排 + 底部本人；五家以上顶部放不下，两侧各让一枚 ⇒ 多占一排。
export function ringNeed(seatCount: number): number {
  const n = Math.max(1, seatCount);
  const mid = n - 1 >= 4 ? OPP_PLATE.h + BAND_GAP : 0;
  return OPP_PLATE.h + mid + BAND_GAP + OWN_PLATE.h;
}

// 座位板落位：0 号位固定给真人（最下方）。对手按雀魂式角位：
// 1 位 = 正上；2 位（默认 3 人桌）= 左上 / 右上两角；3 位 = 左上 / 正上 / 右上；
// 4 位以上 = 顶排均分 + 两侧各一枚（既有算法）。ui3/19 在全部人数 × 四档视口守护不重叠。
function placePlates(seatCount: number, ring: Rect): Rect[] {
  const out: Rect[] = [{ x: ring.x + (ring.w - OWN_PLATE.w) / 2, y: ring.y + ring.h - OWN_PLATE.h, w: OWN_PLATE.w, h: OWN_PLATE.h }];
  const m = seatCount - 1;
  if (m <= 0) return out;
  const opp = (x: number): Rect => ({ x, y: ring.y, w: OPP_PLATE.w, h: OPP_PLATE.h });
  if (m === 1) {
    out.push(opp(ring.x + (ring.w - OPP_PLATE.w) / 2));
    return out;
  }
  if (m === 2) {
    out.push(opp(ring.x));
    out.push(opp(ring.x + ring.w - OPP_PLATE.w));
    return out;
  }
  if (m === 3) {
    out.push(opp(ring.x));
    out.push(opp(ring.x + (ring.w - OPP_PLATE.w) / 2));
    out.push(opp(ring.x + ring.w - OPP_PLATE.w));
    return out;
  }
  const sides = 2;
  const top = m - sides;
  for (let k = 0; k < top; k += 1) {
    const cx = ring.x + (ring.w * (k + 1)) / (top + 1);
    out.push({ x: cx - OPP_PLATE.w / 2, y: ring.y, w: OPP_PLATE.w, h: OPP_PLATE.h });
  }
  const midY = ring.y + OPP_PLATE.h + BAND_GAP;
  out.push({ x: ring.x, y: midY, w: OPP_PLATE.w, h: OPP_PLATE.h });
  out.push({ x: ring.x + ring.w - OPP_PLATE.w, y: midY, w: OPP_PLATE.w, h: OPP_PLATE.h });
  return out;
}

// 按钮条：列数尽量吃满宽度（每列至少 MIN_BTN_W），行数因此被压到最少 —— 省下来的竖向高度全给牌桌。
// 只有候选多到"每列 112px 还排不完"时行数才会涨上去。
function buttonGrid(count: number, w: number, st: Style): { cols: number; rows: number; btnW: number; barH: number } {
  const inner = w - st.pad * 2;
  const maxCols = Math.max(1, Math.floor((inner + st.pad) / (MIN_BTN_W + st.pad)));
  const cols = Math.max(1, Math.min(maxCols, count));
  const rows = Math.max(1, Math.ceil(count / cols));
  return { cols, rows, btnW: (inner - st.pad * (cols - 1)) / cols, barH: rows * (BTN_H + st.pad) };
}

// 悬停入参：坐标由调用方（main.ts 的 mousemove）给出，scene 只负责"在命中按钮上叠一块高亮"。
// 纯入参：不传（或 null）时输出与没有这个参数完全一致 —— 这条由 ui3/25 逐字节钉住。
export function buildScene(snap: Snapshot, width: number, height: number, st: Style = TABLE_STYLE, anim: Anim = IDLE_ANIM, hover?: { x: number; y: number } | null): Scene {
  const w = Math.max(240, Math.floor(width));
  const h = Math.max(240, Math.floor(height));
  if (w < MIN_VIEWPORT.w || h < MIN_VIEWPORT.h) {
    return notice(w, h, st, `窗口太小（需要至少 ${String(MIN_VIEWPORT.w)}×${String(MIN_VIEWPORT.h)}），当前 ${String(w)}×${String(h)}`);
  }
  const n = Math.max(1, snap.seats.length);
  const humanIndex = Math.max(0, snap.seats.findIndex((x) => x.role === 'human'));
  const need = ringNeed(n);
  if (w < OWN_PLATE.w + st.pad * 2) {
    return notice(w, h, st, `${String(n)} 人桌的放大的牌面需要至少 ${String(OWN_PLATE.w + st.pad * 2)} 宽，当前 ${String(w)}`);
  }

  // 竖向预算：顶栏 → 牌桌（硬需求）→ 底部条 → 按钮条。
  // 底部条：结算时给结算块（含结束原因与指纹），否则给行动日志；日志行数会为牌桌让位，最多减到 1 行。
  // 结算块为什么不放桌面中央：结算那一刻正是"牌刚亮出来"的时候，中央迟早压到刚翻开的牌 —— 那等于遮住验收④要读的东西。
  const settle = snap.settleSummary;
  const grid = buttonGrid(snap.buttons.length, w, st);
  const btnTop = h - grid.barH - st.pad;
  const stripTopFor = (lines: number) => btnTop - (lines * st.rowH + 22) - 4;
  const ringTop = TOP_BAR + st.pad;
  const roomForRing = (lines: number) => stripTopFor(lines) - BAND_GAP - ringTop;
  let logLines = Math.min(6, Math.max(1, snap.log.length));
  while (settle.length === 0 && logLines > 1 && roomForRing(logLines) < need) logLines -= 1;
  // 结算块多占一行放台账（在场筹码+池 + 各家筹码），免得与"结束原因"那行长句撞在一起
  const stripLines = settle.length > 0 ? settle.length + 1 : logLines;
  if (roomForRing(stripLines) < need) {
    const minH = ringTop + need + BAND_GAP * 2 + (stripLines * st.rowH + 22) + 4 + grid.barH + st.pad;
    return notice(w, h, st, `${String(n)} 人桌放不下放大后的牌面（需要至少 ${String(Math.max(MIN_VIEWPORT.w, OWN_PLATE.w + st.pad * 2))}×${String(minH)}），当前 ${String(w)}×${String(h)}`);
  }
  const stripTop = stripTopFor(stripLines);
  const ring: Rect = { x: st.pad, y: ringTop, w: w - st.pad * 2, h: Math.max(need, stripTop - BAND_GAP - ringTop) };
  const plates = placePlates(n, ring);

  const primitives: Primitive[] = [];
  const hits: Hit[] = [];
  primitives.push({ kind: 'rect', rect: { x: 0, y: 0, w, h }, fill: st.bg, stroke: null, radius: 0 });

  // 顶栏只放状态行 + 右侧三枚信息胶囊（斗地主式"金底深字"）。
  // 胶囊只在宽屏出现：窄窗口里这三项已被状态行整句覆盖，硬塞只会挤掉唯一的信息来源。
  // 图元压在状态行之前 ⇒ 状态行永远画在最上层；顶栏净空口径（ui3/21）也一字不动。
  const badgeH = 18;
  const badgeY = (TOP_BAR - badgeH) / 2;
  const badgeTexts = [`第 ${String(snap.handIndex)} 手`, `注级 ${String(snap.stake)}`, `底池 ${String(snap.pot)}`];
  const badgeGap = 6;
  const badgeWidths = badgeTexts.map((t) => textWidth(t) * 11 + 14);
  const badgeTotal = badgeWidths.reduce((a, b) => a + b, 0) + badgeGap * (badgeTexts.length - 1);
  const showBadges = w >= 860;
  const statusSize = fitSize(snap.status, w - st.pad * 2 - (showBadges ? badgeTotal + 10 : 0), 13);
  primitives.push({ kind: 'rect', rect: { x: 0, y: 0, w, h: TOP_BAR }, fill: st.panel, stroke: null, radius: 0 });
  // 顶栏下沿一道金线：天天斗地主的页头都是"深底 + 一道金色分隔"
  primitives.push({ kind: 'rect', rect: { x: 0, y: TOP_BAR - 1, w, h: 1 }, fill: withAlpha(st.accent, 0.55), stroke: null, radius: 0 });
  if (showBadges) {
    let bx = w - st.pad - badgeTotal;
    badgeTexts.forEach((t, i) => {
      const bw = badgeWidths[i] ?? 0;
      primitives.push({
        kind: 'rect',
        rect: { x: bx, y: badgeY, w: bw, h: badgeH },
        fill: shade(st.accent, -0.06),
        stroke: shade(st.accent, -0.38),
        radius: 9,
      });
      primitives.push(text(bx + bw / 2, badgeY + 13, t, st, { size: 11, bold: true, color: st.btnText, align: 'center' }));
      bx += bw + badgeGap;
    });
  }
  primitives.push(text(st.pad, 21, snap.status, st, { size: statusSize, bold: true }));

  // 牌桌：3D 拟物 —— 落影 → 木轨（竖向渐变受光）→ 呢面（径向渐变）→ 内圈亮线 → 中央光池。
  // 椭圆几何与旧版完全同参（只是填充从平色换成数据化渐变），顶栏净空约束（ui3/21）原样成立。
  // 但椭圆绝不能顶穿顶栏 —— 顶栏那行状态是模型拼好的整句，被木轨盖住就等于丢信息（rev=7 实测踩过）。
  const cx = w / 2;
  const cy = ring.y + (ring.h - OWN_PLATE.h) / 2;
  const RAIL = 18;
  const rxRaw = Math.min(Math.max(120, ring.w / 2 - OPP_PLATE.w / 2 + 30), cx - RAIL);
  const ry = Math.min(Math.max(60, (ring.h - OWN_PLATE.h) / 2 + 24), Math.max(40, cy - RAIL - TOP_BAR - 2), Math.max(40, stripTop - 2 - RAIL - cy));
  // 圆桌观感：横纵比封顶（宽屏下不再被拉成细长椭圆），座位板本来就在桌沿之外
  const rx = Math.min(rxRaw, Math.max(150, ry * 1.6));

  // 透视地板（雀魂式）：向心透视线 + 两圈罗盘环，全部低透明度、从主题底色推导。
  // 画在牌桌之前 ⇒ 中段被桌面盖住，露出的尾巴就是透视感；罗盘环几何受顶栏/底条净空约束（ui3/21）。
  const floorCol = withAlpha(shade(st.bg, 0.32), 0.55);
  const ringA = {
    rx: Math.min(rx + RAIL + 30, cx - 8),
    ry: Math.min(ry + RAIL + 30, cy - TOP_BAR - 2, stripTop - 2 - cy, h - cy - 8),
  };
  const ringB = {
    rx: Math.min(ringA.rx + 38, cx - 6),
    ry: Math.min(ringA.ry + 30, cy - TOP_BAR - 2, stripTop - 2 - cy, h - cy - 8),
  };
  primitives.push({ kind: 'ellipse', cx, cy, rx: ringA.rx, ry: ringA.ry, fill: 'transparent', stroke: floorCol });
  primitives.push({ kind: 'ellipse', cx, cy, rx: ringB.rx, ry: ringB.ry, fill: 'transparent', stroke: withAlpha(shade(st.bg, 0.26), 0.4) });
  for (const [fx, fy] of [[0, 0], [w, 0], [0, h], [w, h], [cx, 0], [cx, h], [0, cy], [w, cy]] as const) {
    primitives.push({ kind: 'line', x1: fx, y1: fy, x2: cx, y2: cy, color: floorCol });
  }

  primitives.push({ kind: 'ellipse', cx, cy: cy + 7, rx: rx + RAIL, ry: ry + RAIL, fill: 'rgba(0,0,0,0.32)', stroke: null });
  primitives.push({
    kind: 'ellipse', cx, cy, rx: rx + RAIL, ry: ry + RAIL, fill: null, stroke: withAlpha(shade(st.rail, 0.5), 0.35),
    grad: { stops: [[0, shade(st.rail, 0.3)], [0.55, st.rail], [1, shade(st.rail, -0.42)]] },
  });
  // 木轨内侧一道金滚边：斗地主经典场的桌沿都是"木色 + 金线"
  primitives.push({ kind: 'ellipse', cx, cy, rx: rx + RAIL - 2, ry: ry + RAIL - 2, fill: 'transparent', stroke: withAlpha(st.accent, 0.38) });
  primitives.push({
    kind: 'ellipse', cx, cy, rx, ry, fill: null, stroke: st.feltEdge,
    grad: { stops: [[0, shade(st.felt, 0.16)], [0.55, st.felt], [1, st.feltEdge]], radial: true },
  });
  primitives.push({ kind: 'ellipse', cx, cy, rx: rx - 1.5, ry: ry - 1.5, fill: 'transparent', stroke: withAlpha(shade(st.felt, 0.5), 0.4) });
  // 呢面里再压两道金色内框（双线滚边）：不抢牌面，但让空桌也有"场子"的仪式感
  primitives.push({ kind: 'ellipse', cx, cy, rx: rx - 6, ry: ry - 6, fill: 'transparent', stroke: withAlpha(st.accent, 0.42) });
  primitives.push({ kind: 'ellipse', cx, cy, rx: rx - 10, ry: ry - 10, fill: 'transparent', stroke: withAlpha(st.accent, 0.20) });
  primitives.push({
    kind: 'ellipse', cx, cy, rx: rx * 0.52, ry: ry * 0.52, fill: null, stroke: null,
    grad: { stops: [[0, withAlpha(shade(st.felt, 0.35), 0.4)], [1, withAlpha(shade(st.felt, 0.35), 0)]], radial: true },
  });
  // 中央台座（雀魂式计分台）：托住池/注级的深色圆角台，几何全部从 cx/cy/rx 推导
  const podW = Math.min(210, Math.max(120, rx * 0.92));
  const podH = 64;
  primitives.push({ kind: 'rect', rect: { x: cx - podW / 2 + 2, y: cy - podH / 2 + 5, w: podW, h: podH }, fill: 'rgba(0,0,0,0.30)', stroke: null, radius: 14 });
  primitives.push({ kind: 'rect', rect: { x: cx - podW / 2, y: cy - podH / 2, w: podW, h: podH }, fill: shade(st.panel, -0.25), stroke: withAlpha(st.accent, 0.35), radius: 14 });
  primitives.push({ kind: 'rect', rect: { x: cx - podW / 2 + 4, y: cy - podH / 2 + 4, w: podW - 8, h: podH - 8 }, fill: 'transparent', stroke: withAlpha(shade(st.panel, 0.3), 0.5), radius: 11 });
  // 台座顶沿一道金带：计分台读起来像一块金框记分牌（斗地主场中央的"奖牌"）
  primitives.push({ kind: 'rect', rect: { x: cx - podW / 2 + 14, y: cy - podH / 2 - 1, w: podW - 28, h: 3 }, fill: withAlpha(st.accent, 0.75), stroke: null, radius: 1 });
  primitives.push(text(cx, cy - 12, `池 ${String(snap.pot)}`, st, { size: 18, bold: true, color: st.accent, align: 'center' }));
  primitives.push(text(cx, cy + 8, `注级 ${String(snap.stake)}`, st, { size: 13, color: st.dim, align: 'center' }));
  // 池/注级下面一道金线：中央台座读出"计分台"的仪式感（斗地主式金牌）
  const goldW = Math.min(92, podW * 0.56);
  primitives.push({ kind: 'rect', rect: { x: cx - goldW / 2, y: cy + 14, w: goldW, h: 2 }, fill: withAlpha(st.accent, 0.5), stroke: null, radius: 1 });
  // 台座底沿一行手数：顶栏胶囊被窄窗口收起时，这里仍能读到"第几手"
  primitives.push(text(cx, cy + 27, `第 ${String(snap.handIndex)} 手`, st, { size: 10, color: st.dim, align: 'center' }));

  // 中央那一行"亮牌：…"是给机器读的正常文本行（理由见 webmin/model.ts 的 revealedHandsLine）。
  // 它只许待在座位环的空档里：横向避开两侧座位板，纵向压在本人板之上。
  if (snap.revealedLine !== '') {
    const hasSides = n - 1 >= 4;
    const bandX = ring.x + (hasSides ? OPP_PLATE.w + BAND_GAP : 0);
    const bandW = ring.w - (hasSides ? (OPP_PLATE.w + BAND_GAP) * 2 : 0);
    const bandTop = ring.y + OPP_PLATE.h + BAND_GAP;
    const bandBottom = ((plates[0] as Rect).y) - 6;
    const lead = 17;
    const maxLines = Math.max(1, Math.floor((bandBottom - bandTop) / lead));
    for (const size of [14, 13, 12]) {
      const lines = wrapMany(snap.revealedLine, bandW - 8, size, maxLines);
      if (lines === null) continue;
      lines.forEach((l, i) => {
        primitives.push(text(bandX + bandW / 2, bandBottom - (lines.length - 1 - i) * lead, l, st, { size, color: st.fg, align: 'center' }));
      });
      break;
    }
  }

  // 桌前筹码堆 + 飞行筹码（雀魂式"自己桌前"的筹码区）：堆位在座位板朝桌心一侧
  //（自己的那堆在板与桌面之间），枚数 = chipStackCount(投入, 注级)。
  // 飞行中的新筹码只在 0<t<1 画 —— 落定后堆里本来就有它们 ⇒ 两端与不带 chips 逐字节一致。
  for (let i = 0; i < snap.seats.length; i += 1) {
    const seat = snap.seats[i] as SeatCell;
    const slot = (i - humanIndex + n) % n;
    const own = slot === 0;
    const box = (plates[slot] ?? plates[0]) as Rect;
    const count = chipStackCount(seat.committed, snap.stake);
    const fly = anim.chips !== undefined && anim.chips.seat === seat.seat ? anim.chips : undefined;
    if (count === 0 && fly === undefined) continue;
    const dirX = cx - (box.x + box.w / 2);
    const dirY = cy - (box.y + box.h / 2);
    const dLen = Math.hypot(dirX, dirY) || 1;
    const ux = dirX / dLen;
    const uy = dirY / dLen;
    const tEdgeX = ux !== 0 ? box.w / 2 / Math.abs(ux) : Infinity;
    const tEdgeY = uy !== 0 ? box.h / 2 / Math.abs(uy) : Infinity;
    const tEdge = Math.min(tEdgeX, tEdgeY);
    const baseX = box.x + box.w / 2 + ux * (tEdge + 16);
    const baseY = box.y + box.h / 2 + uy * (tEdge + 16);
    for (let j = 0; j < count; j += 1) {
      const col = j % 2 === 0 ? st.accent : st.cardRed;
      const jx = (((j * 31) % 5) - 2) * 0.8;
      primitives.push({
        kind: 'ellipse',
        cx: baseX + jx,
        cy: baseY - j * CHIP.gap,
        rx: CHIP.rx,
        ry: CHIP.ry,
        fill: j % 2 === 0 ? shade(col, 0.15) : col,
        stroke: withAlpha(shade(col, -0.4), 0.9),
      });
      // 筹码内环：一道细边读出"筹码边缘的凹槽"（斗地主的筹码都是带边圈的）
      primitives.push({
        kind: 'ellipse',
        cx: baseX + jx,
        cy: baseY - j * CHIP.gap,
        rx: Math.max(2, CHIP.rx - 3.5),
        ry: Math.max(1, CHIP.ry - 1.8),
        fill: 'transparent',
        stroke: withAlpha(shade(col, -0.25), 0.75),
      });
    }
    if (fly !== undefined) {
      const toX = baseX;
      const toY = baseY - count * CHIP.gap;
      for (let f = 0; f < fly.count; f += 1) {
        const raw = (anim.now - fly.since - f * 60) / 420;
        if (raw <= 0 || raw >= 1) continue;
        const e = easeOutCubic(raw);
        primitives.push({
          kind: 'ellipse',
          cx: box.x + box.w / 2 + (toX - (box.x + box.w / 2)) * e,
          cy: box.y + box.h / 2 + (toY - (box.y + box.h / 2)) * e - Math.sin(e * Math.PI) * 16,
          rx: CHIP.rx,
          ry: CHIP.ry,
          fill: shade(st.accent, 0.15),
          stroke: withAlpha(shade(st.accent, -0.4), 0.9),
        });
      }
    }
  }

  // 结算块占底部条：行数 = 摘要 + 一行台账；与座位板、牌面、按钮永不共面
  const panel: Rect | null = settle.length > 0 ? { x: st.pad, y: stripTop, w: w - st.pad * 2, h: stripLines * st.rowH + 22 } : null;

  // 座位（环形）
  for (let i = 0; i < snap.seats.length; i += 1) {
    const seat = snap.seats[i] as SeatCell;
    const slot = (i - humanIndex + n) % n; // 真人固定拿 0 号位（最下方）
    const own = slot === 0;
    const box = (plates[slot] ?? plates[0]) as Rect;
    const c = own ? OWN_CARD : CARD;
    const isTurn = snap.turn === seat.seat && snap.phase === 'betting';
    const isDealer = snap.dealer === seat.seat;
    primitives.push({ kind: 'rect', rect: { x: box.x + 2, y: box.y + 3, w: box.w, h: box.h }, fill: 'rgba(0,0,0,0.22)', stroke: null, radius: 8 });
    primitives.push({ kind: 'rect', rect: box, fill: seat.departed ? st.panelSoft : st.panel, stroke: isTurn ? st.accent : st.dim, radius: 8 });
    // 轮到此家：座位板顶沿一道金条（斗地主的"该你了"——比整框描边更醒目，且不占额外几何）
    if (isTurn) primitives.push({ kind: 'rect', rect: { x: box.x + 7, y: box.y + 5, w: box.w - 14, h: 3 }, fill: st.accent, stroke: null, radius: 2 });
    // 赢家金框：结算那一刻，赢家的座位板内圈点亮（胜负信息来自 model 的 resultText，scene 只做描边）
    if (seat.resultText.startsWith('赢')) primitives.push({ kind: 'rect', rect: { x: box.x + 2, y: box.y + 2, w: box.w - 4, h: box.h - 4 }, fill: 'transparent', stroke: withAlpha(st.accent, 0.85), radius: 7 });

    const cardX = own ? box.x + OWN_LABELS : box.x + PAD;
    const cardY = own ? box.y + PAD : box.y + TOP_TEXT;
    const labelX = own ? box.x + PAD + AVATAR + 6 : box.x + PAD;
    // role 三档：human=本标签页的我、bot=单机占位机器人、remote=联机桌上别的真人。
    // 联机桌上把别人标成 bot 会印出"[电脑]"，那是错的（M5 加的就是这一档）。
    const who = seat.role === 'human' ? '[你]' : seat.role === 'bot' ? '[电脑]' : '[玩家]';
    const head = `${seat.marks}${seat.name}${who} ${seat.departed ? '离桌' : seat.looked ? '明' : '闷'}`;
    // 庄家金牌占右上角：先把它的宽度从文字栏里扣掉，名牌与金牌永不叠字
    const dealerRoom = isDealer ? 22 : 0;
    const labelRoom = (own ? OWN_LABELS - AVATAR - 6 : box.w) - PAD * 2 - 4 - dealerRoom;
    // 头像圆环只上本人板（对手板 124 宽是 6 人桌窄视口的活口，对手的身份感来自角位与名牌）。
    // 金圈 + 深底 + 大首字，读起来就是斗地主的"座位头像"；轮次时整圈点亮。
    // 首字母用 accent 色：ui3/24 以"居中+前景色"圈出亮牌行，头像字必须避开这条判定；
    // 首字母若恰好是牌面字符（联机玩家名不可控）则回退 '#'，不给防泄漏扫描（ui3/11）添假阳性。
    if (own) {
      const avCx = box.x + PAD + AVATAR / 2;
      const avCy = box.y + box.h / 2;
      const initial = seat.name.slice(0, 1);
      const glyph = /^[2-9TJQKA♠♥♣♦]$/.test(initial) ? '#' : initial;
      primitives.push({ kind: 'ellipse', cx: avCx, cy: avCy, rx: AVATAR / 2, ry: AVATAR / 2, fill: shade(st.panelSoft, 0.12), stroke: isTurn ? st.accent : withAlpha(st.accent, 0.72) });
      primitives.push({ kind: 'ellipse', cx: avCx, cy: avCy, rx: AVATAR / 2 - 3, ry: AVATAR / 2 - 3, fill: 'transparent', stroke: withAlpha(shade(st.panelSoft, 0.4), 0.5) });
      primitives.push(text(avCx, avCy + 6, glyph, st, { size: 18, bold: true, color: st.accent, align: 'center' }));
    }
    // 庄家金牌：金底深字的圆角小牌，位置在本人说明栏 / 对手板右上角（都避开牌面）
    if (isDealer) {
      const dw = 22;
      const dx = (own ? box.x + OWN_LABELS - 4 : box.x + box.w - 6) - dw;
      primitives.push({ kind: 'rect', rect: { x: dx, y: box.y + 5, w: dw, h: 15 }, fill: st.accent, stroke: shade(st.accent, -0.4), radius: 7 });
      primitives.push(text(dx + dw / 2, box.y + 16, '庄', st, { size: 10, bold: true, color: st.btnText, align: 'center' }));
    }
    primitives.push(text(labelX, box.y + (own ? 16 : 14), head, st, { size: fitSize(head, labelRoom, own ? 15 : 13), bold: true, color: seat.departed ? st.dim : st.fg }));
    const chipsLine = `筹码 ${String(seat.chips)} · 投入 ${String(seat.committed)}`;
    primitives.push(text(labelX, box.y + (own ? 34 : 28), chipsLine, st, { size: fitSize(chipsLine, labelRoom, own ? 13 : 11), color: st.dim }));
    if (own) primitives.push(text(labelX, box.y + 52, seat.status, st, { size: fitSize(seat.status, labelRoom, 13), color: st.dim }));

    // 三张牌位：翻牌进度 < 0.5 时只许画牌背，绝不提前露牌面。
    // 发牌飞行（anim.deal）：次序 = 环座位逐张（slot*1/轮 k*n+slot），从桌面中心（牌堆位）
    // easeOutCubic 飞向落位，途中带确定性倾斜；t≥1 时走完全相同的静态路径 ⇒ 两端逐字节一致。
    const open = flipProgress(anim, seat.seat) >= 0.5;
    const faceUp = !seat.hidden && open;
    for (let k = 0; k < 3; k += 1) {
      const finalX = cardX + k * c.pitch;
      let px = finalX;
      let py = cardY;
      let tilt: number | undefined;
      if (anim.deal !== undefined) {
        const idx = k * n + slot;
        const raw = (anim.now - anim.deal.start - idx * anim.deal.stagger) / anim.deal.duration;
        const t = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
        if (t < 1) {
          const e = easeOutCubic(t);
          const fx = finalX + c.w / 2;
          const fy = cardY + c.h / 2;
          const sx = ((idx * 53) % 9 - 4) * 1.4;
          const sy = ((idx * 29) % 7 - 3) * 1.1;
          const fromX = cx + sx;
          const fromY = cy + sy;
          px = fromX + (fx - fromX) * e - c.w / 2;
          py = fromY + (fy - fromY) * e - c.h / 2;
          tilt = ((idx % 2 === 0 ? 1 : -1) * (8 + ((idx * 7) % 10))) * (1 - e);
        }
      }
      // 牌影：每张牌右下 2/3px 的一块半透明矩形，读起来"浮在台面上"
      primitives.push({ kind: 'rect', rect: { x: px + 2, y: py + 3, w: c.w, h: c.h }, fill: 'rgba(0,0,0,0.16)', stroke: null, radius: 6 });
      primitives.push({
        kind: 'rect',
        rect: { x: px, y: py, w: c.w, h: c.h },
        fill: faceUp ? st.cardFace : st.cardBack,
        stroke: faceUp ? shade(st.cardFace, -0.3) : shade(st.cardBack, 0.28),
        radius: 6,
        ...(tilt !== undefined ? { tilt } : {}),
      });
      // 牌面内描边（斗地主牌的一道细框）：让牌在绿呢上"是一张牌"而不是一块白。
      // 只在亮牌时画（牌背有自己的花色肌理）；fill=transparent ⇒ 不进 ui3/20 的结算块筛选，
      // 也不是 cardFace ⇒ 不进 ui3/18/23 的牌面收集。
      // 外面再套一道金细线（经典场白牌的金边），两道线都在牌面内，不爬到邻牌脸上。
      if (faceUp) {
        primitives.push({
          kind: 'rect',
          rect: { x: px + 1.5, y: py + 1.5, w: c.w - 3, h: c.h - 3 },
          fill: 'transparent',
          stroke: withAlpha(st.accent, 0.38),
          radius: 5,
          ...(tilt !== undefined ? { tilt } : {}),
        });
        primitives.push({
          kind: 'rect',
          rect: { x: px + 3, y: py + 3, w: c.w - 6, h: c.h - 6 },
          fill: 'transparent',
          stroke: withAlpha(shade(st.cardFace, -0.4), 0.55),
          radius: 4,
          ...(tilt !== undefined ? { tilt } : {}),
        });
      } else {
        // 蓝金牌背：内描边 + 中央金菱（斗地主经典牌背的程式化花纹），随发牌飞行一起倾斜落位。
        // 不用 radius=4：那道口径留给牌面内框（ui3/39 只在牌面里查它）。
        primitives.push({
          kind: 'rect',
          rect: { x: px + 3, y: py + 3, w: c.w - 6, h: c.h - 6 },
          fill: 'transparent',
          stroke: withAlpha(shade(st.cardBack, 0.55), 0.85),
          radius: 5,
          ...(tilt !== undefined ? { tilt } : {}),
        });
        // 中央金菱用四条 line 画：行图元不经过 paint 的旋转路径，静态几何才能与 ui3/12 逐字对上
        const ex = px + c.w / 2;
        const ey = py + c.h / 2;
        const er = Math.min(6, c.w / 2 - 8);
        const ec = withAlpha(shade(st.accent, 0.1), 0.9);
        primitives.push({ kind: 'line', x1: ex, y1: ey - er, x2: ex + er, y2: ey, color: ec });
        primitives.push({ kind: 'line', x1: ex + er, y1: ey, x2: ex, y2: ey + er, color: ec });
        primitives.push({ kind: 'line', x1: ex, y1: ey + er, x2: ex - er, y2: ey, color: ec });
        primitives.push({ kind: 'line', x1: ex - er, y1: ey, x2: ex, y2: ey - er, color: ec });
      }
    }
    // 结果/牌型那行：本人放在左侧说明栏的第四行（牌下面会压到牌面），别家放在牌的正下方
    const captionX = own ? labelX : cardX;
    const captionY = own ? box.y + 70 : cardY + c.h + 8;
    const result = seat.resultText === '' ? '' : ` · ${seat.resultText}`;
    if (!faceUp) {
      primitives.push(text(captionX, captionY, `···${result}`, st, { size: own ? 14 : 11, color: st.dim }));
    } else {
      // 牌角按真实扑克那样分两行：点数一行、花色一行。
      // 为什么不能写成"T♥"一行：扇形叠放时每张露出的只有左边 pitch 那一条，
      // 一行两字符在 20px 下约 32px 宽，会爬到邻牌脸上去（OCR 会把两张牌读成一串）。
      seat.cardsText.split(' ').forEach((g, k) => {
        const x = cardX + k * c.pitch + 4;
        const rank = g.slice(0, -1);
        const suit = g.slice(-1);
        const color = redSuit(suit) ? st.cardRed : '#181419';
        primitives.push(text(x, cardY + c.font, rank, st, { size: c.font, bold: true, color, align: 'left' }));
        primitives.push(text(x, cardY + c.font + Math.round(c.suitFont * 1.15), suit, st, { size: c.suitFont, bold: true, color, align: 'left' }));
      });
      if (seat.tierText !== '' || result !== '') {
        primitives.push(text(captionX, captionY, `${seat.tierText}${result}`, st, { size: own ? 14 : 11, color: st.accent }));
      }
    }
  }

  // 底部条：结算时是结算块（结束原因 + 余数 + 指纹），否则是行动日志尾巴。
  // 每家的账目不在这儿 —— 它就地印在各家座位板上（SeatCell.resultText），这样结算块永远不会压到刚亮的牌。
  const ledgerLine = `${TOTAL_LABEL} ${String(snap.total)} · ${snap.ledgerLine}`;
  if (panel !== null) {
    primitives.push({ kind: 'rect', rect: panel, fill: st.panelSoft, stroke: st.accent, radius: 8 });
    // 结算块顶沿金线 + 左侧金签：结算这一刻也要有"开奖"的仪式感
    primitives.push({ kind: 'rect', rect: { x: panel.x + 10, y: panel.y + 5, w: panel.w - 20, h: 2 }, fill: withAlpha(st.accent, 0.6), stroke: null, radius: 1 });
    primitives.push({ kind: 'rect', rect: { x: panel.x + 1, y: panel.y + 8, w: 2, h: 10 }, fill: withAlpha(st.accent, 0.8), stroke: null, radius: 1 });
    settle.forEach((line, i) => {
      primitives.push(text(panel.x + 10, panel.y + 20 + i * st.rowH, line, st, { size: fitSize(line, panel.w - 20, 12), color: st.fg }));
    });
    primitives.push(text(panel.x + panel.w - 10, panel.y + 20 + settle.length * st.rowH, ledgerLine, st, { size: fitSize(ledgerLine, panel.w - 20, 12), color: st.dim, align: 'right' }));
  } else {
    // 行动日志底衬：一块半透明圆角面板 + 顶沿金线，把日志从"散字"收成一条信息栏
    primitives.push({ kind: 'rect', rect: { x: st.pad, y: stripTop, w: w - st.pad * 2, h: stripLines * st.rowH + 22 }, fill: withAlpha(st.panel, 0.62), stroke: withAlpha(st.dim, 0.18), radius: 8 });
    primitives.push({ kind: 'rect', rect: { x: st.pad + 10, y: stripTop, w: w - st.pad * 2 - 20, h: 2 }, fill: withAlpha(st.accent, 0.5), stroke: null, radius: 1 });
    // 表头行：左边是"行动日志"，有提示/收桌原因时就地顶掉它（同一条位置，不去挤右侧的台账）
    const header = snap.over ?? (snap.note !== null ? `提示：${snap.note}` : '行动日志');
    const headerColor = snap.over !== null ? st.accent : snap.note !== null ? st.warn : st.dim;
    primitives.push(text(st.pad, stripTop + 13, header, st, { size: 12, color: headerColor }));
    const ledgerRoom = w - st.pad * 2 - textWidth(header) * 12 - 20;
    primitives.push(text(w - st.pad, stripTop + 13, ledgerLine, st, { size: fitSize(ledgerLine, Math.max(80, ledgerRoom), 12), color: st.dim, align: 'right' }));
    snap.log.slice(-stripLines).forEach((line, i) => {
      const last = i === Math.min(stripLines, snap.log.length) - 1;
      primitives.push(text(st.pad, stripTop + 30 + i * st.rowH, line, st, { size: fitSize(line, w - st.pad * 2, 12), color: last ? st.fg : st.dim }));
    });
  }

  // 意图按钮：斗地主式行动钮 —— 可点 = 金色渐变胶囊 + 深色字；不可点 = 深灰绿 + 暗字（照样可点，验收③）。
  // 文案与价格全来自模型，这里只管排版（放不下就折两行）；几何（BTN_H / 网格 / 命中区）一律不动。
  snap.buttons.forEach((b, i) => {
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    const rect = { x: st.pad + c * (grid.btnW + st.pad), y: btnTop + r * (BTN_H + st.pad), w: grid.btnW, h: BTN_H };
    // 按钮落影：金钮"浮"在深色底栏上（斗地主行动钮都有实体厚度）
    primitives.push({ kind: 'rect', rect: { x: rect.x + 1, y: rect.y + 3, w: rect.w, h: rect.h }, fill: 'rgba(0,0,0,0.30)', stroke: null, radius: 14 });
    if (b.legal) {
      primitives.push({
        kind: 'rect',
        rect,
        fill: 'transparent',
        grad: { stops: [[0, shade(st.accent, 0.3)], [0.52, st.accent], [1, shade(st.accent, -0.2)]] },
        stroke: shade(st.accent, -0.45),
        radius: Math.min(14, BTN_H / 2),
      });
      // 内高光：金钮上沿一道亮线，读起来像打光的树脂键帽（填充透明 ⇒ 不碰任何牌面/面板筛选）
      primitives.push({
        kind: 'rect',
        rect: { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: rect.h - 5 },
        fill: 'transparent',
        stroke: withAlpha(shade(st.accent, 0.8), 0.5),
        radius: 11,
      });
    } else {
      primitives.push({ kind: 'rect', rect, fill: st.illegal, stroke: st.dim, radius: 5 });
    }
    const ink = b.legal ? st.btnText : st.dim;
    const avail = grid.btnW - 16;
    const lines = wrapLabel(b.text, avail, 13);
    const longest = lines.reduce((a, l) => (textWidth(l) > textWidth(a) ? l : a), '');
    const size = Math.max(10, Math.min(13, Math.floor(avail / Math.max(1, textWidth(longest)))));
    if (lines.length === 1) {
      primitives.push(text(rect.x + 8, rect.y + 19, lines[0] ?? '', st, { size, color: ink }));
    } else {
      primitives.push(text(rect.x + 8, rect.y + 12, lines[0] ?? '', st, { size, color: ink }));
      primitives.push(text(rect.x + 8, rect.y + 25, lines[1] ?? '', st, { size, color: ink }));
    }
    hits.push({ id: `btn:${String(i)}`, rect, intent: b.intent });
  });

  // —— hosted 结算暂停：居中结算面板 ——
  // 游戏已停在结算（牌在揭示那一刻已经看过），此刻盖住桌面中央是刻意的；但**不遮座位板、
  // 不遮按钮条、不出画布**（继续/等待的提示就住在按钮条里，遮了就点不着）。
  // 配色刻意独立：面板 = panel + legal 描边、文字 = accent/dim/legal/warn —— 避开 ui3/20 的
  // 「panelSoft+accent = 结算块」筛选与 ui3/24 的「fg 居中文本」收编（solo 恒不触发 hostPaused，
  // 既有 ui3 用例一个都碰不到这块）。legal 描边同时是"可以继续"的语义绿。
  if (snap.hostPaused) {
    const iAmHost = snap.buttons.some((b) => b.intent.kind === 'begin' && b.legal);
    const lines: string[] = ['本局结算', ...snap.settlement];
    lines.push(iAmHost ? '点「继续下一局」开下一手' : '等待房主继续…');
    const lineH = st.rowH;
    const pw = Math.min(Math.floor(w * 0.64), 520);
    const ph = Math.min(lines.length * lineH + st.pad * 3, Math.floor(h * 0.42));
    const px = Math.floor(w / 2 - pw / 2);
    const py = Math.floor(h * 0.3 + (h * 0.42 - ph) / 2);
    primitives.push({ kind: 'rect', rect: { x: px, y: py, w: pw, h: ph }, fill: st.panel, stroke: st.legal, radius: 10 });
    // 面板顶沿一道金线：联机结算面板与单机结算块同一套"金框"语言
    primitives.push({ kind: 'rect', rect: { x: px + 12, y: py + 5, w: pw - 24, h: 2 }, fill: withAlpha(st.accent, 0.6), stroke: null, radius: 1 });
    const visible = Math.max(1, Math.floor((ph - st.pad * 2) / lineH));
    lines.slice(0, visible).forEach((line, i) => {
      const isTitle = i === 0;
      const isHint = i === Math.min(lines.length, visible) - 1;
      const color = isTitle ? st.accent : isHint ? (iAmHost ? st.legal : st.warn) : st.dim;
      primitives.push(
        text(px + pw / 2, py + st.pad * 1.5 + i * lineH + 6, line, st, {
          size: isTitle ? 16 : 12,
          bold: isTitle,
          color,
          align: 'center',
        }),
      );
    });
  }

  // 悬停高亮：追加在全部按钮图元之后（画在最上层），几何与命中区完全同 rect。
  // 命中判定与 hitAt 同口径（边界算在区内），只是就地内联 —— scene 不自己 import 自己。
  if (hover !== undefined && hover !== null) {
    for (const hit of hits) {
      const r = hit.rect;
      if (hover.x >= r.x && hover.x <= r.x + r.w && hover.y >= r.y && hover.y <= r.y + r.h) {
        primitives.push({ kind: 'rect', rect: r, fill: 'transparent', stroke: st.accent, radius: 5 });
        break;
      }
    }
  }

  return {
    width: w,
    height: h,
    font: st.font,
    primitives,
    hits,
    plates,
    strip: { x: st.pad, y: stripTop, w: w - st.pad * 2, h: stripLines * st.rowH + 22 },
  };
}

// 命中测试：按注册序取第一个包含该点的按钮区（边界算在区内 —— 按钮贴边时也要点得着）
export function hitAt(scene: Scene, x: number, y: number): Hit | null {
  for (const hit of scene.hits) {
    const r = hit.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return hit;
  }
  return null;
}
