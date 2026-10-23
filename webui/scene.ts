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

export type Primitive =
  | { kind: 'rect'; rect: Rect; fill: string; stroke: string | null; radius: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; stroke: string | null }
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
  warn: string;
  cardFace: string;
  cardBack: string;
  cardRed: string;
  font: string;
  pad: number;
  rowH: number;
};

// 拟物牌桌：绿呢台面 + 木色边轨 + 环形座位 + 中央底池。
export const TABLE_STYLE: Style = {
  bg: '#0d1116',
  felt: '#14563a',
  feltEdge: '#0c3524',
  rail: '#5b3a22',
  panel: '#18222c',
  panelSoft: '#21303c',
  fg: '#eef4ef',
  dim: '#93a8ab',
  accent: '#f0c674',
  legal: '#2f6f4f',
  illegal: '#2a3540',
  warn: '#9c4444',
  cardFace: '#f4f1e8',
  cardBack: '#2b4f8f',
  cardRed: '#b5372f',
  font: '"Cascadia Mono", "Consolas", "Noto Sans Mono CJK SC", monospace',
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

const PAD = 8; // 座位板内边距
const OWN_LABELS = 168; // 本人板：说明文字占左侧一栏，牌放右边（省下的竖向高度是 6 人桌的救命钱）
const TOP_TEXT = 34; // 对手板：两行说明占顶部这条带，牌从这条带下面开始
const CAPTION = 12; // 对手板：牌下面那行（牌型 / ···）

export const OPP_PLATE = { w: CARD.pitch * 2 + CARD.w + PAD * 2, h: TOP_TEXT + CARD.h + CAPTION }; // 124 × 110
export const OWN_PLATE = { w: OWN_LABELS + OWN_CARD.pitch * 2 + OWN_CARD.w + PAD, h: OWN_CARD.h + PAD * 2 }; // 352 × 94
const BAND_GAP = 4;
const TOP_BAR = 32;
const BTN_H = 28;
const MIN_BTN_W = 112;

// 翻牌动画：since = 该座位牌面首次可见的时刻（由调用方计时），duration = 一次翻牌用时。
export type Anim = { now: number; since: Record<number, number>; duration: number };

export const IDLE_ANIM: Anim = { now: 0, since: {}, duration: 320 };

// 底部那一行台账数字的标签。它的口径就是 snap.total（单机 webmin/model.ts::tableTotal、
// 联机 webui/netplay.ts 同一条式子）：**本局在场**各家的筹码 + 池，离桌座位不计入 ——
// 那一份由房间台账继续欠着，等它拿 token 重连才会带回来，届时这个数会自己跳上去。
// 原先这里写的是「桌上总额」，那是一个比算法实际范围更宽的标签（rev=10 应修 7）：
// 玩家拿它判断"这局值不值得跟"，而它与重连后看到的账本对不上。
// 导出给用例钉"文案 ↔ departed 过滤"这一对：只改文案或只改过滤，nst/12 与 nui/22 会各红一条。
export const TOTAL_LABEL = '在场筹码+池';

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

// 座位板落位：0 号位固定给真人（最下方），其余按快照序填顶部横排；顶部超过两枚就改两侧各一枚。
function placePlates(seatCount: number, ring: Rect): Rect[] {
  const out: Rect[] = [{ x: ring.x + (ring.w - OWN_PLATE.w) / 2, y: ring.y + ring.h - OWN_PLATE.h, w: OWN_PLATE.w, h: OWN_PLATE.h }];
  const m = seatCount - 1;
  if (m <= 0) return out;
  const sides = m >= 4 ? 2 : 0;
  const top = m - sides;
  for (let k = 0; k < top; k += 1) {
    const cx = ring.x + (ring.w * (k + 1)) / (top + 1);
    out.push({ x: cx - OPP_PLATE.w / 2, y: ring.y, w: OPP_PLATE.w, h: OPP_PLATE.h });
  }
  const midY = ring.y + OPP_PLATE.h + BAND_GAP;
  if (sides === 2) {
    out.push({ x: ring.x, y: midY, w: OPP_PLATE.w, h: OPP_PLATE.h });
    out.push({ x: ring.x + ring.w - OPP_PLATE.w, y: midY, w: OPP_PLATE.w, h: OPP_PLATE.h });
  }
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

export function buildScene(snap: Snapshot, width: number, height: number, st: Style = TABLE_STYLE, anim: Anim = IDLE_ANIM): Scene {
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

  // 顶栏只放状态行：在场筹码+池与台账一起靠到右下，两边不会在窄窗口里撞成一团。
  // 状态行是模型拼好的整句（信息全优先，不许在这儿删字），所以放不下时只能缩字号。
  const statusSize = fitSize(snap.status, w - st.pad * 2, 13);
  primitives.push({ kind: 'rect', rect: { x: 0, y: 0, w, h: TOP_BAR }, fill: st.panel, stroke: null, radius: 0 });
  primitives.push(text(st.pad, 21, snap.status, st, { size: statusSize, bold: true }));

  // 牌桌：外轨 + 绿呢台面。座位板压在边轨上（台面先画），所以台面比座位环的内空更大一点。
  // 但椭圆绝不能顶穿顶栏 —— 顶栏那行状态是模型拼好的整句，被木轨盖住就等于丢信息（rev=7 实测踩过）。
  const cx = w / 2;
  const cy = ring.y + (ring.h - OWN_PLATE.h) / 2;
  const RAIL = 18;
  const rx = Math.min(Math.max(120, ring.w / 2 - OPP_PLATE.w / 2 + 30), cx - RAIL);
  const ry = Math.min(Math.max(60, (ring.h - OWN_PLATE.h) / 2 + 24), Math.max(40, cy - RAIL - TOP_BAR - 2), Math.max(40, stripTop - 2 - RAIL - cy));
  primitives.push({ kind: 'ellipse', cx, cy, rx: rx + RAIL, ry: ry + RAIL, fill: st.rail, stroke: null });
  primitives.push({ kind: 'ellipse', cx, cy, rx, ry, fill: st.felt, stroke: st.feltEdge });
  primitives.push(text(cx, cy - 12, `池 ${String(snap.pot)}`, st, { size: 18, bold: true, color: st.accent, align: 'center' }));
  primitives.push(text(cx, cy + 8, `注级 ${String(snap.stake)}`, st, { size: 13, color: st.dim, align: 'center' }));

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
    primitives.push({ kind: 'rect', rect: box, fill: seat.departed ? st.panelSoft : st.panel, stroke: isTurn ? st.accent : st.dim, radius: 8 });

    const cardX = own ? box.x + OWN_LABELS : box.x + PAD;
    const cardY = own ? box.y + PAD : box.y + TOP_TEXT;
    const labelX = box.x + PAD;
    // role 三档：human=本标签页的我、bot=单机占位机器人、remote=联机桌上别的真人。
    // 联机桌上把别人标成 bot 会印出"[电脑]"，那是错的（M5 加的就是这一档）。
    const who = seat.role === 'human' ? '[你]' : seat.role === 'bot' ? '[电脑]' : '[玩家]';
    const head = `${seat.marks}${seat.name}${who} ${seat.departed ? '离桌' : seat.looked ? '明' : '闷'}`;
    const labelRoom = (own ? OWN_LABELS : box.w) - PAD * 2 - 4;
    primitives.push(text(labelX, box.y + (own ? 16 : 14), head, st, { size: fitSize(head, labelRoom, own ? 15 : 13), bold: true, color: seat.departed ? st.dim : st.fg }));
    const chipsLine = `筹码 ${String(seat.chips)} · 投入 ${String(seat.committed)}`;
    primitives.push(text(labelX, box.y + (own ? 34 : 28), chipsLine, st, { size: fitSize(chipsLine, labelRoom, own ? 13 : 11), color: st.dim }));
    if (own) primitives.push(text(labelX, box.y + 52, seat.status, st, { size: fitSize(seat.status, labelRoom, 13), color: st.dim }));

    // 三张牌位：翻牌进度 < 0.5 时只许画牌背，绝不提前露牌面
    const open = flipProgress(anim, seat.seat) >= 0.5;
    const faceUp = !seat.hidden && open;
    for (let k = 0; k < 3; k += 1) {
      primitives.push({
        kind: 'rect',
        rect: { x: cardX + k * c.pitch, y: cardY, w: c.w, h: c.h },
        fill: faceUp ? st.cardFace : st.cardBack,
        stroke: faceUp ? st.dim : '#8fa398',
        radius: 6,
      });
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
    settle.forEach((line, i) => {
      primitives.push(text(panel.x + 10, panel.y + 20 + i * st.rowH, line, st, { size: fitSize(line, panel.w - 20, 12), color: st.fg }));
    });
    primitives.push(text(panel.x + panel.w - 10, panel.y + 20 + settle.length * st.rowH, ledgerLine, st, { size: fitSize(ledgerLine, panel.w - 20, 12), color: st.dim, align: 'right' }));
  } else {
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

  // 意图按钮：合法绿、非法灰但照样可点（验收③）。文案与价格全来自模型，这里只管排版（放不下就折两行）。
  snap.buttons.forEach((b, i) => {
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    const rect = { x: st.pad + c * (grid.btnW + st.pad), y: btnTop + r * (BTN_H + st.pad), w: grid.btnW, h: BTN_H };
    primitives.push({ kind: 'rect', rect, fill: b.legal ? st.legal : st.illegal, stroke: b.legal ? st.fg : st.dim, radius: 5 });
    const avail = grid.btnW - 16;
    const lines = wrapLabel(b.text, avail, 13);
    const longest = lines.reduce((a, l) => (textWidth(l) > textWidth(a) ? l : a), '');
    const size = Math.max(10, Math.min(13, Math.floor(avail / Math.max(1, textWidth(longest)))));
    if (lines.length === 1) {
      primitives.push(text(rect.x + 8, rect.y + 19, lines[0] ?? '', st, { size, color: b.legal ? st.fg : st.dim }));
    } else {
      primitives.push(text(rect.x + 8, rect.y + 12, lines[0] ?? '', st, { size, color: b.legal ? st.fg : st.dim }));
      primitives.push(text(rect.x + 8, rect.y + 25, lines[1] ?? '', st, { size, color: b.legal ? st.fg : st.dim }));
    }
    hits.push({ id: `btn:${String(i)}`, rect, intent: b.intent });
  });

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
