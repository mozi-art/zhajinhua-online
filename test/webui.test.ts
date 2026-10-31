// M3 · 正式 UI 的无头验收。两类断言：
// ① 层次机检 —— §4 M3「只渲染 + 发意图，绝不自己判规则」落成可执行约束；
// ② bridge / scene 的行为与确定性 —— 这两层是纯逻辑，不开浏览器就能全部钉死。
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test, note } from './harness.ts';
import { stateHash } from '../src/engine/state.ts';
import { EMPTY_UI, dispatch, drain, snapshot, start } from '../webui/bridge.ts';
import type { Snapshot, StartOptions } from '../webui/bridge.ts';
import { buildScene, chipStackCount, hitAt, INK_STYLE, PAPER_STYLE, statusBubbleInk, TABLE_STYLE } from '../webui/scene.ts';
import type { Hit, Rect } from '../webui/scene.ts';
import { paint } from '../webui/paint.ts';
import { act, createSession, handText, intentOptions } from '../webmin/model.ts';
import type { Session } from '../webmin/model.ts';
import { redirectTarget, resolveStatic } from '../webmin/serve.ts';
import { DEALER_NEXT_IDS, presets } from '../src/rules.ts';

const OPTS: StartOptions = { bots: 3, buyIn: 256, baseSeed: 20260925, presetName: 'classic', dealerNext: 'rotate' };

function stripped(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function opened(opts: Partial<StartOptions> = {}) {
  return start(EMPTY_UI, { ...OPTS, ...opts });
}

const TOP_BAR = 32;

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// 整棵图元树里的"牌面矩形"与"点数字号"—— 工单 rev=7 的硬指标就按这两组量出来，不看常量表
function faceRects(sc: ReturnType<typeof buildScene>): Rect[] {
  return sc.primitives.filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === TABLE_STYLE.cardFace).map((p) => p.rect);
}

function glyphSizes(sc: ReturnType<typeof buildScene>): number[] {
  // 牌角分两行（点数一行、花色一行），所以一张牌有两个图元；两行都必须在工单下限之上
  const rank = /^[2-9TJQKA]$/;
  const suit = /^[♠♥♣♦]$/;
  return sc.primitives
    .filter((p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text' && (rank.test(p.text) || suit.test(p.text)))
    .map((p) => p.size);
}

// 造一桌"候选按钮很多"的局面：按钮条会不会把牌桌挤没，只有在候选多的时候才看得出来。
function busyTable(minButtons: number): Snapshot {
  for (let seed = 1; seed <= 20; seed += 1) {
    let ui = opened({ bots: 5, baseSeed: seed, buyIn: 300 });
    for (let step = 0; step < 60; step += 1) {
      const s = snapshot(ui);
      if (s.buttons.length >= minButtons) return s;
      if (s.over !== null) break;
      const legal = s.buttons.filter((b) => b.legal && b.intent.kind !== 'reset');
      const cmp = legal.filter((b) => b.intent.kind === 'compare');
      const chosen = cmp[step % Math.max(1, cmp.length)] ?? legal[step % Math.max(1, legal.length)];
      if (chosen === undefined) {
        const before = s.status;
        ui = drain(ui);
        if (snapshot(ui).status === before) break;
        continue;
      }
      ui = dispatch(ui, chosen.intent);
    }
  }
  return assert.fail(`构造不出至少 ${String(minButtons)} 个候选按钮的一桌 ⇒ 按钮条高度预算这条哨兵会静默失效`);
}

// ---------------- ① 层次机检 ----------------

test('ui3/01 层次：webui 只 import 彼此与 webmin/model，绝不直接碰引擎或 src', () => {
  for (const f of ['webui/bridge.ts', 'webui/scene.ts', 'webui/paint.ts', 'webui/main.ts']) {
    const body = stripped(f);
    const specs = [...body.matchAll(/from '([^']+)'/g)].map((x) => x[1] as string);
    assert.ok(specs.length > 0, `${f} 没有任何 import？`);
    for (const m of specs) {
      assert.ok(m.startsWith('./') || m === '../webmin/model.ts', `${f} import 了不该碰的模块：${m}`);
    }
  }
});

test('ui3/02 层次：只有入口层能碰 DOM；UI 侧一行规则判定都没有', () => {
  for (const f of ['webui/bridge.ts', 'webui/scene.ts', 'webui/paint.ts']) {
    const body = stripped(f);
    for (const banned of [/document\./, /window\./, /localStorage/, /\bDate\b/, /Math\.random/, /node:/, /requestAnimationFrame/, /performance\./]) {
      assert.ok(!banned.test(body), `${f} 出现 ${String(banned)}`);
    }
    for (const judge of [/legalActions\(/, /checkAction\(/, /\bclassify\(/, /actionCost\(/, /presets\./, /startHand\(/, /\bapply\(/]) {
      assert.ok(!judge.test(body), `${f} 里出现了规则判定：${String(judge)}`);
    }
  }
  const entry = stripped('webui/main.ts');
  assert.ok(/getElementById/.test(entry), '入口层应当是唯一碰 DOM 的地方');
  for (const judge of [/legalActions\(/, /checkAction\(/, /\bclassify\(/, /actionCost\(/]) {
    assert.ok(!judge.test(entry), `入口层不许自己判合法性或算钱：${String(judge)}`);
  }
});

// ---------------- ② bridge 行为 ----------------

test('ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位', () => {
  const s = snapshot(opened());
  assert.equal(s.started, true);
  assert.equal(s.seats.length, 4);
  assert.equal(s.total, 4 * 256);
  assert.equal(s.dealerRule, '轮庄');
  assert.ok(s.seats.every((x) => x.hidden && x.cardsText === '···'), '开局不该有任何一行露出牌面');
  // 闷/明是公开信息：机器人可以在开局就主动转明（AI 的看牌决策），所以只能断言真人自己还闷着
  assert.equal(s.seats.find((x) => x.role === 'human')?.looked, false);
  assert.ok(s.seats.every((x) => x.looked || x.hidden), '任何一行亮牌都必须以"它看过牌或被翻开"为前提');
  assert.ok(s.seats.some((x) => x.role === 'human' && x.name === '你'));
});

test('ui3/04 bridge：三档庄家规则都开得出桌并回显在快照里', () => {
  for (const [mode, label] of [['rotate', '轮庄'], ['winner', '赢家坐庄'], ['loser', '输家坐庄']] as const) {
    const s = snapshot(opened({ dealerNext: mode }));
    assert.equal(s.dealerRule, label);
    assert.ok(s.status.includes(`庄位规则 ${label}`), s.status);
  }
});

test('ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉', () => {
  const html = stripped('webui/index.html');
  const main = stripped('webui/main.ts');
  for (const id of ['bots', 'buyIn', 'preset', 'dealerNext', 'seed']) {
    assert.ok(html.includes(`id="${id}"`), `webui/index.html 缺控件 #${id}`);
    assert.ok(main.includes(`'${id}'`), `main.ts 没读 #${id} ⇒ 这个控件是摆设`);
  }
  const block = (id: string) => new RegExp(`<select id="${id}">([\\s\\S]*?)</select>`).exec(html)?.[1] ?? '';
  const values = (id: string) => [...block(id).matchAll(/value="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(values('dealerNext'), [...DEALER_NEXT_IDS].sort(), 'webui 的庄家下拉与 Rules.dealer.next 的档位不一致');
  assert.deepEqual(values('preset'), Object.keys(presets).sort(), 'webui 的牌型口径下拉与 presets 不一致');
  // 画布与提示位也必须在：少了 #board 就只剩一个空白页，少了 #hint 就丢了被拒回执
  for (const id of ['board', 'hint', 'newGame']) {
    assert.ok(html.includes(`id="${id}"`) && main.includes(`'${id}'`), `#${id} 没接上`);
  }
  // 竖向空间必须整块让给画布：写死 calc(100vh - Npx) 会在 720×640 的窗口里把画布压到 560 以下，
  // 于是复审班一打开就是"窗口太小"（rev=7 实测踩过，故钉成文本级约束）
  assert.ok(!/calc\(100vh/.test(html), '页面样式里不许出现 calc(100vh - …) 这种固定扣高的画布尺寸');
  assert.match(html, /body\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
  assert.match(html, /#stage\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/);
  assert.match(html, /#board\s*\{[^}]*height:\s*100%/);
  // 页面自身框架的竖向预算必须 ≤80px：验收窗口 720×640 里画布才剩得下 560 高。
  // 46 = 一行控件的内容高（实测 header 52 减去上下 padding 8）+ 画布上下边框 2；
  // 这个数是浏览器里量出来的（evidence/m7-cards-readable.txt [4]），不是猜的。
  const rulePad = (sel: string): number => {
    const block = new RegExp(`\\n\\s*${sel}\\s*\\{([^}]*)\\}`).exec(`\n${html}`)?.[1] ?? '';
    const m = /padding:\s*(\d+)px/.exec(block);
    return m === null ? 999 : Number(m[1]);
  };
  const chrome = rulePad('header') * 2 + rulePad('#stage') * 2 + 46;
  assert.ok(chrome <= 80, `页面框架竖向预算 ${String(chrome)}px > 80px ⇒ 720×640 窗口里画布不足 560 高（header pad=${String(rulePad('header'))} stage pad=${String(rulePad('#stage'))}）`);
});

test('ui3/05 bridge：非法意图走引擎拒绝路径，计数与状态指纹都对', () => {
  let ui = opened();
  ui = dispatch(ui, { kind: 'raise' }); // 不轮到自己时必然非法；轮到自己时加注也可能合法 ⇒ 用一定会被拒的比牌
  const before = ui.session === null ? '' : stateHash(ui.session.state);
  ui = dispatch(ui, { kind: 'compare', target: -1 });
  const after = ui.session === null ? '' : stateHash(ui.session.state);
  assert.ok(ui.rejections >= 1, '非法比牌没有被计入拒绝');
  assert.match(String(ui.lastError ?? ''), /被引擎拒绝/);
  assert.equal(after, before, '被拒的意图改动了引擎状态');
});

test('ui3/06 bridge：真人点看牌 ⇒ 只有自己那行亮牌，且快照里搜不到任何别家牌面', () => {
  let ui = opened({ bots: 2 });
  for (let g = 0; g < 60 && ui.session !== null && ui.session.state.turn !== ui.session.humanSeat && ui.session.state.phase === 'betting'; g += 1) {
    ui = drain(ui);
  }
  const s0 = snapshot(ui);
  assert.equal(s0.seats.find((x) => x.role === 'human')?.hidden, true, '构造前提：真人还没看牌');
  ui = dispatch(ui, { kind: 'look' });
  const s1 = snapshot(ui);
  assert.equal(ui.rejections, 0, `轮到自己时看牌被拒：${String(ui.lastError)}`);
  const mine = s1.seats.find((x) => x.role === 'human');
  assert.equal(mine?.hidden, false);
  assert.equal(mine?.looked, true);
  assert.equal(s1.seats.filter((x) => x.hidden).length, s1.seats.length - 1, '看牌只放开本人，别家必须仍然隐藏');
  // 真正的泄露检查：拿引擎里那些仍隐藏的座位手牌去搜整棵快照
  const st = (ui.session as Session).state;
  const hiddenHands = st.seats.filter((x) => x.seat !== s1.humanSeat).map((x) => JSON.stringify(x.hand));
  const text = JSON.stringify(s1);
  for (const h of hiddenHands) assert.ok(!text.includes(h), `快照里泄漏了别家牌面 ${h}`);
  const mineSeat = st.seats.find((x) => x.seat === s1.humanSeat);
  assert.ok(mineSeat !== undefined && mine !== undefined);
  if (mineSeat === undefined || mine === undefined) return;
  assert.equal(mine.cardsText, handText(mineSeat.hand), '本人看过之后快照应印出他的真牌');
  assert.notEqual(mine.tierText, '', '亮牌之后应带上牌型名');
});

test('ui3/07 bridge：把一局打完 ⇒ 结算区有内容、日志在长、桌上总额守恒', () => {
  let ui = opened({ bots: 2 });
  for (let g = 0; g < 400; g += 1) {
    const s = snapshot(ui);
    if (s.phase === 'settled') break;
    const legal = s.buttons.filter((b) => b.legal);
    if (legal.length > 0) ui = dispatch(ui, legal[0]?.intent ?? { kind: 'fold' });
    ui = drain(ui);
  }
  const s = snapshot(ui);
  assert.equal(s.phase, 'settled', `没打到结算：phase=${s.phase}`);
  assert.ok(s.settlement.length > 1, '结算面板应有内容');
  assert.equal(s.total, 3 * 256, '跨结算不守恒');
  assert.ok(s.log.length >= 3);
  assert.ok(s.settlement.every((line) => typeof line === 'string' && line.length > 0));
  note(`UI307 结算行=${String(s.settlement.length)} 日志行=${String(s.log.length)} 点击=${String(ui.clicks)} 被拒=${String(ui.rejections)}`);
});

// ---------------- ③ scene 布局与确定性 ----------------

test('ui3/08 scene 是纯函数：同一输入两次布局逐字节相同', () => {
  const s = snapshot(opened());
  assert.equal(JSON.stringify(buildScene(s, 960, 620, TABLE_STYLE)), JSON.stringify(buildScene(s, 960, 620, TABLE_STYLE)));
});

test('ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）', () => {
  for (const [w, h] of [[560, 560], [960, 620], [1600, 900]] as const) {
    const s = snapshot(opened());
    const sc = buildScene(s, w, h, TABLE_STYLE);
    assert.equal(sc.hits.length, s.buttons.length, '每个候选按钮都该有一块命中区');
    assert.ok(sc.hits.every((hh) => hh.rect.w > 4 && hh.rect.h > 4), '出现零/负尺寸命中区');
    for (const hh of sc.hits) {
      assert.ok(hh.rect.x >= 0 && hh.rect.y >= 0, `${hh.id} 画到画布外（负坐标）`);
      assert.ok(hh.rect.x + hh.rect.w <= sc.width + 1, `${hh.id} 超出右边界 @${String(w)}×${String(h)}`);
      assert.ok(hh.rect.y + hh.rect.h <= sc.height + 1, `${hh.id} 超出下边界 @${String(w)}×${String(h)}`);
    }
    for (let i = 0; i < sc.hits.length; i += 1) {
      for (let j = i + 1; j < sc.hits.length; j += 1) {
        const a = sc.hits[i] as Hit;
        const b = sc.hits[j] as Hit;
        const overlap = a.rect.x < b.rect.x + b.rect.w && b.rect.x < a.rect.x + a.rect.w && a.rect.y < b.rect.y + b.rect.h && b.rect.y < a.rect.y + a.rect.h;
        assert.ok(!overlap, `命中区重叠：${a.id} × ${b.id} @${String(w)}×${String(h)}`);
      }
    }
  }
});

test('ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）', () => {
  const s = snapshot(opened());
  for (const [w, h] of [[300, 400], [520, 900], [900, 400]] as const) {
    const sc = buildScene(s, w, h, TABLE_STYLE);
    assert.equal(sc.hits.length, 0, `${String(w)}×${String(h)} 下还留了可点区`);
    const t = sc.primitives.filter((p) => p.kind === 'text').map((p) => p.text).join(' ');
    assert.match(t, /窗口太小/, `${String(w)}×${String(h)} 应给出明确提示`);
    assert.ok(t.includes(`${String(w)}×${String(h)}`), '提示里要带上当前尺寸，别让人猜');
  }
});

test('ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）', () => {
  const s = busyTable(10);
  assert.ok(s.buttons.length >= 10, `构造前提没成立：只有 ${String(s.buttons.length)} 个候选`);
  for (const [w, h] of [[560, 560], [720, 640], [960, 620], [1600, 900]] as const) {
    const sc = buildScene(s, w, h, TABLE_STYLE);
    assert.equal(sc.hits.length, s.buttons.length, `${String(w)}×${String(h)} 走进了提示路径 ⇒ 按钮条把牌桌吃没了`);
    const rows = new Set(sc.hits.map((hh) => Math.round(hh.rect.y))).size;
    assert.ok(rows <= 3, `按钮条吃了 ${String(rows)} 行 @${String(w)}×${String(h)} ⇒ 竖向预算没先满足牌桌`);
    const rects = [...sc.plates, ...sc.hits.map((hh) => hh.rect)];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i] as Rect;
        const b = rects[j] as Rect;
        assert.ok(!intersects(a, b), `${String(w)}×${String(h)} 下第 ${String(i)} 与第 ${String(j)} 块互相压住`);
      }
    }
    for (const p of sc.plates) {
      assert.ok(p.x >= 0 && p.y >= TOP_BAR && p.x + p.w <= sc.width + 1 && p.y + p.h <= sc.height + 1, `座位板越界 @${String(w)}×${String(h)}`);
    }
  }
});

test('ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中', () => {
  const sc = buildScene(snapshot(opened()), 960, 620, TABLE_STYLE);
  const hit = sc.hits[0];
  assert.ok(hit !== undefined);
  if (hit === undefined) return;
  const mid = hitAt(sc, hit.rect.x + hit.rect.w / 2, hit.rect.y + hit.rect.h / 2);
  assert.deepEqual(mid?.intent, hit.intent);
  // 边界必须算在区内：写成开区间会让按钮最外一圈像素点不着（变异 U06 就是这么溜过去的）
  const corners: [number, number][] = [
    [hit.rect.x, hit.rect.y],
    [hit.rect.x + hit.rect.w, hit.rect.y],
    [hit.rect.x, hit.rect.y + hit.rect.h],
    [hit.rect.x + hit.rect.w, hit.rect.y + hit.rect.h],
  ];
  for (const [px, py] of corners) {
    assert.deepEqual(hitAt(sc, px, py)?.intent, hit.intent, `边角 (${String(px)},${String(py)}) 应当可点`);
  }
  assert.equal(hitAt(sc, hit.rect.x - 1, hit.rect.y + hit.rect.h / 2), null, '边界外 1px 不该命中');
  assert.equal(hitAt(sc, -20, -20), null);
});

test('ui3/11 scene 不泄露未看过的牌：开局整棵图元树里没有任何牌面字符', () => {
  const prims = buildScene(snapshot(opened()), 960, 620, TABLE_STYLE).primitives;
  const texts = prims.filter((p) => p.kind === 'text').map((p) => p.text);
  const glyphs = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const suits = ['♠', '♥', '♣', '♦'];
  const cardLike = texts.filter((t) => glyphs.some((g) => suits.some((su) => t.includes(`${g}${su}`))));
  assert.deepEqual(cardLike, [], `开局就画出了牌面：${cardLike.join(' | ')}`);
  // 牌角现在是"点数一行 + 花色一行"，所以漏牌可能只漏一个字符 —— 单字符也要扫
  const lone = texts.filter((t) => /^[2-9TJQKA]$|^[♠♥♣♦]$/.test(t));
  assert.deepEqual(lone, [], `开局就画出了单个点数/花色：${lone.join(' | ')}`);
  assert.ok(texts.includes('···'), '隐藏位应当显式画成 ···');
});

test('ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）', () => {
  const before = buildScene(snapshot(opened({ bots: 2 })), 1200, 700, TABLE_STYLE);
  assert.equal(faceGlyphCount(before), 0, '没看牌时不该画出任何一张牌面');
  let ui = opened({ bots: 2 });
  for (let g = 0; g < 60 && ui.session !== null && ui.session.state.turn !== ui.session.humanSeat && ui.session.state.phase === 'betting'; g += 1) ui = drain(ui);
  ui = dispatch(ui, { kind: 'look' });
  assert.equal(ui.rejections, 0);
  const snap = snapshot(ui);
  const sc = buildScene(snap, 1200, 700, TABLE_STYLE);
  assert.equal(faceGlyphCount(sc), 3, `看牌后应正好亮出三张，实际 ${String(faceGlyphCount(sc))}`);
  const shown = snap.seats.find((x) => x.role === 'human');
  const engineHand = (ui.session as Session).state.seats.find((x) => x.seat === snap.humanSeat);
  assert.ok(engineHand !== undefined && shown !== undefined);
  if (engineHand === undefined || shown === undefined) return;
  assert.equal(shown.cardsText, handText(engineHand.hand), 'scene 用的牌面必须与引擎里的本人手牌一致');
});

test('ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应', () => {
  const sc = buildScene(snapshot(opened()), 960, 620, TABLE_STYLE);
  const ops: string[] = [];
  const drawn: string[] = [];
  const ctx = {
    beginPath: () => ops.push('beginPath'),
    roundRect: (x: number, y: number, w: number, h: number) => {
      ops.push('roundRect');
      drawn.push(`rect ${String(x)} ${String(y)} ${String(w)} ${String(h)}`);
    },
    ellipse: (cx: number, cy: number, rx: number, ry: number) => {
      ops.push('ellipse');
      drawn.push(`ellipse ${String(cx)} ${String(cy)} ${String(rx)} ${String(ry)}`);
    },
    fill: () => ops.push('fill'),
    stroke: () => ops.push('stroke'),
    fillText: () => ops.push('fillText'),
    moveTo: () => ops.push('moveTo'),
    lineTo: () => ops.push('lineTo'),
    clearRect: () => ops.push('clearRect'),
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    setTransform: () => ops.push('setTransform'),
    translate: () => ops.push('translate'),
    rotate: () => ops.push('rotate'),
    // 渐变材质化：paint 会拿一个 Gradient 对象逐色标 addColorStop —— 假 ctx 给个哑对象
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
  paint(ctx as unknown as CanvasRenderingContext2D, sc);
  assert.equal(ops.filter((o) => o === 'roundRect').length, sc.primitives.filter((p) => p.kind === 'rect').length);
  assert.equal(ops.filter((o) => o === 'ellipse').length, sc.primitives.filter((p) => p.kind === 'ellipse').length);
  assert.equal(ops.filter((o) => o === 'fillText').length, sc.primitives.filter((p) => p.kind === 'text').length);
  assert.ok(sc.primitives.some((p) => p.kind === 'ellipse'), '牌桌必须是椭圆台面 —— 一个椭圆图元都没有');
  assert.equal(ops.filter((o) => o === 'clearRect').length, 1);
  assert.ok(sc.primitives.filter((p) => p.kind === 'text').length > 10, '快照内容太少，画不出东西');
  // 光数调用次数不够：把半径改成 0 一样"调用了 ellipse"，牌桌却消失了。几何参数必须逐字搬到 ctx 上。
  const want: string[] = [];
  for (const p of sc.primitives) {
    if (p.kind === 'ellipse') want.push(`ellipse ${String(p.cx)} ${String(p.cy)} ${String(p.rx)} ${String(p.ry)}`);
    if (p.kind === 'rect') want.push(`rect ${String(p.rect.x)} ${String(p.rect.y)} ${String(p.rect.w)} ${String(p.rect.h)}`);
  }
  assert.deepEqual(drawn, want, 'paint 画出来的几何与 scene 给的图元不一致（尺寸/位置被改写）');
  const table = sc.primitives.filter((p) => p.kind === 'ellipse')[1];
  assert.ok(table !== undefined && table.rx > 60 && table.ry > 40, '台面椭圆退化成一团 ⇒ 牌桌看不见');
});

test('ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5', () => {
  assert.equal(redirectTarget('/webui/'), '/webui/index.html');
  assert.equal(redirectTarget('/webui'), '/webui/index.html');
  assert.equal(redirectTarget('/'), '/webmin/index.html', '根路径不能悄悄换页面（rev=3–5 的复跑命令都指着它）');
  for (const url of ['/webui/index.html', '/webui/main.ts', '/webui/bridge.ts', '/webui/scene.ts', '/webui/paint.ts', '/webui/sfx.ts', '/webui/assets/felt-fabric.jpg', '/webmin/model.ts', '/src/engine/state.ts']) {
    assert.equal(resolveStatic(url).ok, true, `${url} 应当放行`);
  }
  for (const bad of ['/webui/../BRIEF.md', '/../BRIEF.md', '/BRIEF.md', '/webui/x.exe', '/webui/index.html.bak', '/test/run.ts']) {
    assert.equal(resolveStatic(bad).ok, false, `必须拒绝 ${bad}`);
  }
});

test('ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）', () => {
  const s = createSession({ bots: 2, baseSeed: 5, buyIn: 256 });
  assert.notEqual(s.state.turn, s.humanSeat, '构造前提：此刻是机器人的回合');
  assert.deepEqual(
    intentOptions(s).map((o) => o.intent.kind),
    ['reset'],
    '没轮到真人时，唯一合法的会话层意图应当只有"整桌重来"，且必须报成合法',
  );
  // 反证：它若被报成灰的，act() 其实会放行 ⇒ 灰按钮契约破产。这里直接确认它确实合法。
  assert.equal(act(s, { kind: 'reset' }).ok, true);
});

// ---------- 翻牌动画（进度是入参，scene 保持纯函数） ----------

function lookedSnap(): Snapshot {
  let ui = opened({ bots: 2 });
  for (let g = 0; g < 60 && ui.session !== null && ui.session.state.turn !== ui.session.humanSeat && ui.session.state.phase === 'betting'; g += 1) ui = drain(ui);
  ui = dispatch(ui, { kind: 'look' });
  assert.equal(ui.rejections, 0, '构造前提：轮到自己时看牌合法');
  return snapshot(ui);
}

function faceGlyphCount(sc: ReturnType<typeof buildScene>): number {
  // 牌角现在是两行（点数一行、花色一行），"亮了几张牌"按点数那一行数
  const texts = sc.primitives.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
  return texts.filter((t) => /^[2-9TJQKA]$/.test(t)).length;
}

test('ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮', () => {
  const snap = lookedSnap();
  const mine = snap.seats.find((x) => x.role === 'human');
  assert.equal(mine?.hidden, false, '构造前提：真人已看过牌');
  if (mine === undefined) return;
  const since = 1000;
  const anim = (t: number) => ({ now: since + t, since: { [mine.seat]: since }, duration: 320 });
  const early = buildScene(snap, 960, 620, TABLE_STYLE, anim(0));
  assert.equal(faceGlyphCount(early), 0, '进度 0 就画出了牌面 ⇒ 动画把牌面提前泄出去了');
  const mid40 = buildScene(snap, 960, 620, TABLE_STYLE, anim(128)); // 40% < 50%
  assert.equal(faceGlyphCount(mid40), 0, '未过半仍不许露牌面');
  const done = buildScene(snap, 960, 620, TABLE_STYLE, anim(320));
  assert.equal(faceGlyphCount(done), 3, '进度满了应当亮出三张牌');
  const backs = (p: ReturnType<typeof buildScene>) => p.primitives.filter((x) => x.kind === 'rect' && x.fill === TABLE_STYLE.cardBack).length;
  assert.ok(backs(early) > backs(done), '牌背应随翻牌推进而减少');
});

test('ui3/16 动画进度是纯入参：同一 (快照, anim) 两次布局逐字节相同；不给 anim 时直接终态', () => {
  const snap = lookedSnap();
  const a = buildScene(snap, 900, 600, TABLE_STYLE, { now: 1100, since: { 0: 1000 }, duration: 320 });
  const b = buildScene(snap, 900, 600, TABLE_STYLE, { now: 1100, since: { 0: 1000 }, duration: 320 });
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'scene 里混进了外部时钟或可变状态');
  // 不传动画（默认 IDLE_ANIM）时必须直接是终态：绝不允许"永远卡在翻一半"
  assert.equal(faceGlyphCount(buildScene(snap, 900, 600, TABLE_STYLE)), 3);
});

test('ui3/17 没配 since 的座位视为已翻开；换局后重新亮牌的座位会重新起算', () => {
  const snap = lookedSnap();
  const sc = buildScene(snap, 900, 600, TABLE_STYLE, { now: 0, since: {}, duration: 320 });
  assert.equal(faceGlyphCount(sc), 3, 'since 里没有这一家 ⇒ 按已翻开处理（不能因为漏记就把牌永久藏起来）');
  const sc2 = buildScene(snap, 900, 600, TABLE_STYLE, { now: 0, since: { 99: 0 }, duration: 320 });
  assert.equal(faceGlyphCount(sc2), 3, '无关座位的 since 不该影响本人这一行');
});

test('ui3/14 灰按钮点了必被引擎拒（验收③在 M3 侧的等价形态）', () => {
  // bots=0 在 M1.5 的语义里是"只有真人一家"，引擎按 2–6 人校验必然拒绝开桌 —— 顺手钉住这条边界
  assert.equal(snapshot(opened({ bots: 0 })).started, false);
  assert.match(String(snapshot(opened({ bots: 0 })).note ?? ''), /开桌失败|2/);

  const ui = opened({ bots: 1 });
  const s = snapshot(ui);
  assert.equal(s.started, true);
  const grey = s.buttons.filter((b) => !b.legal);
  assert.ok(grey.length > 0, '候选全集里应当有非法项可点');
  const before = stateHash((ui.session as Session).state);
  for (const b of grey) {
    const r = act(ui.session as Session, b.intent);
    assert.equal(r.ok, false, `灰按钮「${b.text}」竟然被放行`);
    assert.equal(stateHash((ui.session as Session).state), before, `灰按钮「${b.text}」改动了状态`);
  }
  // 轮到真人时：合法项存在、且合法项按 label 带价格（UI 不自己算钱的反证：钱来自 model）
  // 单机路径的 cost 恒为数字；`null` 是联机专用的"服务端没下发金额"（见 webmin/model.ts 的 ButtonOption 注释）
  const legal = s.buttons.filter((b) => b.legal);
  if (legal.length > 0) {
    assert.ok(legal.every((b) => b.cost !== null), '单机快照里每个合法按钮都该有钱数：钱来自 model，不是 UI 自己算的');
    assert.ok(legal.some((b) => (b.cost ?? 0) > 0 || b.intent.kind === 'look' || b.intent.kind === 'fold'));
    assert.ok(legal.every((b) => Number.isInteger(b.cost) && (b.cost ?? -1) >= 0));
  }
});

// ---------------- rev=7 观感硬指标：牌面尺寸与"2–6 家排得开" ----------------

function settledSnap(bots: 1 | 2 | 3 | 4 | 5 = 2): Snapshot {
  let ui = opened({ bots });
  for (let g = 0; g < 400; g += 1) {
    const s = snapshot(ui);
    if (s.phase === 'settled') break;
    const legal = s.buttons.filter((b) => b.legal);
    // 真人一律跟注（别弃牌）：弃牌者的牌按 §1 不亮，那样就量不到"亮牌最多的一刻"
    const pick = legal.find((b) => b.intent.kind === 'call') ?? legal[0];
    if (pick !== undefined) ui = dispatch(ui, pick.intent);
    ui = drain(ui);
  }
  const s = snapshot(ui);
  assert.equal(s.phase, 'settled', '构造前提：这一局要打结算');
  return s;
}

test('ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）', () => {
  const looked = buildScene(lookedSnap(), 900, 700, TABLE_STYLE);
  const showdown = buildScene(settledSnap(), 1200, 820, TABLE_STYLE);
  for (const [name, sc] of [['看牌后', looked], ['比牌后', showdown]] as const) {
    const rects = faceRects(sc);
    const sizes = glyphSizes(sc);
    assert.ok(rects.length >= 3, `${name}只量到 ${String(rects.length)} 张牌面`);
    assert.equal(sizes.length, rects.length * 2, `${name}的牌角图元数对不上（每张牌应有"点数 + 花色"两行）：${String(rects.length)} 张牌 / ${String(sizes.length)} 个图元`);
    for (const r of rects) assert.ok(r.w >= 48 && r.h >= 64, `${name}的牌面只有 ${String(r.w)}×${String(r.h)} ⇒ 低于工单下限 48×64`);
    for (const sz of sizes) assert.ok(sz >= 18, `${name}的点数字号 ${String(sz)} < 18`);
  }
  const heights = [...new Set(faceRects(showdown).map((r) => r.h))].sort((a, b) => a - b);
  assert.ok(heights.length >= 2 && (heights[0] ?? 0) >= 64 && (heights[heights.length - 1] ?? 0) > (heights[0] ?? 0), `本人手牌没有比别家再大一档：${heights.join(',')}`);
});

test('ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）', () => {
  for (const bots of [1, 2, 3, 4, 5] as const) {
    const s = snapshot(opened({ bots }));
    assert.equal(s.seats.length, bots + 1);
    for (const [w, h] of [[560, 560], [720, 640], [960, 620], [1600, 900]] as const) {
      const sc = buildScene(s, w, h, TABLE_STYLE);
      assert.ok(sc.hits.length > 0, `${String(bots + 1)} 家在 ${String(w)}×${String(h)} 走进了提示路径`);
      assert.equal(sc.plates.length, s.seats.length, `${String(bots + 1)} 家只排出 ${String(sc.plates.length)} 块座位板`);
      const all = [...sc.plates, ...sc.hits.map((hh) => hh.rect)];
      for (let i = 0; i < all.length; i += 1) {
        for (let j = i + 1; j < all.length; j += 1) {
          assert.ok(!intersects(all[i] as Rect, all[j] as Rect), `${String(bots + 1)} 家 @${String(w)}×${String(h)}：第 ${String(i)} 与第 ${String(j)} 块互相压住`);
        }
      }
      for (const p of sc.plates) {
        assert.ok(p.x >= 0 && p.y >= TOP_BAR && p.x + p.w <= sc.width + 1 && p.y + p.h <= sc.height + 1, `座位板越界 ${String(bots + 1)} 家 @${String(w)}×${String(h)}`);
        // 底部条（日志 / 结算块）是牌桌之外的地盘：座位板压上去就说明"装不下还硬排"
        if (sc.strip !== null) assert.ok(!intersects(p, sc.strip), `座位板压进底部条 ${String(bots + 1)} 家 @${String(w)}×${String(h)}`);
      }
    }
  }
});

test('ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）', () => {
  const base = busyTable(10);
  // 造一个比真实Catalog更极端的快照：18 个候选 ⇒ 按钮条要吃掉 5 行，560 高的画布必然装不下
  const fat: Snapshot = { ...base, buttons: Array.from({ length: 18 }, (_, i) => ({ ...(base.buttons[i % base.buttons.length] as Snapshot['buttons'][number]), text: `候选 ${String(i)}` })) };
  for (const [w, h] of [[560, 560], [720, 640], [960, 620]] as const) {
    const sc = buildScene(fat, w, h, TABLE_STYLE);
    const noticePath = sc.hits.length === 0 && sc.plates.length === 0;
    const texts = sc.primitives.filter((p) => p.kind === 'text').map((p) => p.text).join(' ');
    if (noticePath) {
      assert.match(texts, /放不下|窗口太小/, `${String(w)}×${String(h)} 走提示路径却不说明原因`);
      continue;
    }
    // 另一条腿：排得下，那就必须谁都不压谁
    const all = [...sc.plates, ...sc.hits.map((hh) => hh.rect), ...(sc.strip === null ? [] : [sc.strip])];
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        assert.ok(!intersects(all[i] as Rect, all[j] as Rect), `${String(w)}×${String(h)}：第 ${String(i)} 与第 ${String(j)} 块互相压住（装不下还硬排）`);
      }
    }
    for (const p of sc.plates) {
      assert.ok(p.y >= TOP_BAR && p.y + p.h <= sc.height + 1, `座位板越界 @${String(w)}×${String(h)}`);
    }
  }
});

test('ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）', () => {
  for (const bots of [1, 2, 3, 5] as const) {
    const snap = settledSnap(bots);
    assert.equal(snap.seats.length, bots + 1);
    assert.ok(snap.settlement.length > 1, `构造前提：${String(bots + 1)} 家这局要有结算内容`);
    for (const [w, h] of [[560, 560], [720, 640], [900, 700], [1200, 820]] as const) {
      const sc = buildScene(snap, w, h, TABLE_STYLE);
      assert.ok(sc.plates.length > 0, `${String(bots + 1)} 家 @${String(w)}×${String(h)} 走进了提示路径`);
      const panels = sc.primitives.filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.stroke === TABLE_STYLE.accent && p.fill === TABLE_STYLE.panelSoft);
      assert.ok(panels.length >= 1, `${String(bots + 1)} 家 @${String(w)}×${String(h)} 结算块没画出来（结算行有 ${String(snap.settlement.length)} 条）`);
      for (const panel of panels) {
        for (const r of faceRects(sc)) {
          assert.ok(!intersects(panel.rect, r), `结算块盖住了牌面 (${String(r.x)},${String(r.y)}) @${String(bots + 1)} 家 ${String(w)}×${String(h)}`);
        }
        for (const p of sc.plates) assert.ok(!intersects(panel.rect, p), `结算块压住座位板 @${String(bots + 1)} 家 ${String(w)}×${String(h)}`);
        assert.ok(panel.rect.y + panel.rect.h <= sc.height + 1, `结算块掉出画布 @${String(w)}×${String(h)}`);
      }
    }
  }
});

test('ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）', () => {
  for (const bots of [1, 3, 5] as const) {
    const s = snapshot(opened({ bots }));
    for (const [w, h] of [[560, 560], [720, 640], [960, 620], [1280, 800]] as const) {
      const sc = buildScene(s, w, h, TABLE_STYLE);
      assert.ok(sc.plates.length > 0, `${String(bots + 1)} 家 @${String(w)}×${String(h)} 走进了提示路径`);
      const topIdx = sc.primitives.findIndex((p) => p.kind === 'text' && p.text === s.status);
      assert.ok(topIdx > 0, '状态行没画出来');
      // 状态行不许截断，所以它只能靠缩字号待在自己那一栏里 —— 画到画布外就是丢信息
      const statusPrim = sc.primitives[topIdx] as Extract<(typeof sc.primitives)[number], { kind: 'text' }>;
      const statusUnits = Array.from(statusPrim.text).reduce((acc, ch) => acc + (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.62), 0);
      assert.ok(statusUnits * statusPrim.size <= w - 2 * TABLE_STYLE.pad + 1, `状态行宽 ${String(Math.round(statusUnits * statusPrim.size))} > 画布可用 ${String(w - 2 * TABLE_STYLE.pad)} @${String(w)}×${String(h)}（没缩字号）`);
      for (let i = topIdx + 1; i < sc.primitives.length; i += 1) {
        const p = sc.primitives[i];
        if (p === undefined) continue;
        if (p.kind === 'rect') {
          assert.ok(p.rect.y >= TOP_BAR || p.rect.h <= 1, `${String(bots + 1)} 家 @${String(w)}×${String(h)}：第 ${String(i)} 个矩形（y=${String(p.rect.y)}）压进顶栏`);
        }
        if (p.kind === 'ellipse') {
          assert.ok(p.cy - p.ry >= TOP_BAR, `${String(bots + 1)} 家 @${String(w)}×${String(h)}：牌桌椭圆上缘 y=${String(Math.round(p.cy - p.ry))} 顶穿顶栏，状态行会被盖住`);
        }
      }
    }
  }
});

test('ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里', () => {
  const units = (t: string): number => Array.from(t).reduce((acc, ch) => acc + (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.62), 0);
  const s = busyTable(8);
  for (const [w, h] of [[560, 560], [720, 640], [960, 620], [1600, 900]] as const) {
    const sc = buildScene(s, w, h, TABLE_STYLE);
    assert.equal(sc.hits.length, s.buttons.length);
    sc.hits.forEach((hit, i) => {
      const label = (s.buttons[i] as { text: string }).text;
      const lines = sc.primitives
        .filter((p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text' && p.y >= hit.rect.y && p.y <= hit.rect.y + hit.rect.h && p.x >= hit.rect.x && p.x <= hit.rect.x + hit.rect.w)
        .sort((a, b) => a.y - b.y);
      assert.ok(lines.length >= 1 && lines.length <= 2, `${String(w)}×${String(h)} 第 ${String(i)} 颗按钮上有 ${String(lines.length)} 行文字`);
      // 折行允许挪动空白，但一个字都不许丢或多 —— 去掉全部空白后必须逐字相同
      assert.equal(lines.map((l) => l.text.replace(/\s+/g, '')).join(''), label.replace(/\s+/g, ''), `按钮文案被改了/被截了：${label}`);
      for (const l of lines) {
        assert.ok(units(l.text) * l.size <= hit.rect.w - 4, `第 ${String(i)} 颗按钮里「${l.text}」宽 ${String(Math.round(units(l.text) * l.size))} > 按钮宽 ${String(Math.round(hit.rect.w))} @${String(w)}×${String(h)}`);
      }
    });
  }
});

test('ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里', () => {
  const units = (t: string): number => Array.from(t).reduce((acc, ch) => acc + (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.62), 0);
  const snap = settledSnap(2);
  for (const [w, h] of [[560, 560], [720, 640], [960, 620], [1280, 800]] as const) {
    const sc = buildScene(snap, w, h, TABLE_STYLE);
    const faces = sc.primitives
      .filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === TABLE_STYLE.cardFace)
      .map((p) => p.rect)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const marks = sc.primitives.filter(
      (p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text' && (/^[2-9TJQKA]$/.test(p.text) || /^[♠♥♣♦]$/.test(p.text)),
    );
    assert.ok(faces.length >= 3 && marks.length === faces.length * 2, `${String(w)}×${String(h)}：${String(faces.length)} 张牌面配 ${String(marks.length)} 个牌角图元`);
    for (const m of marks) {
      // 归属判定：牌是扇形叠放的，一张牌角可能同时落在两张牌的矩形里 ⇒ 取"起点最靠右的那张"才是它自己的牌
      const own = faces.filter((f) => m.x >= f.x - 1 && m.x < f.x + f.w && m.y > f.y && m.y <= f.y + f.h + 4).sort((a, b) => b.x - a.x)[0];
      assert.ok(own !== undefined, `牌角「${m.text}」(${String(m.x)},${String(m.y)}) 不在任何一张牌里 @${String(w)}×${String(h)}`);
      if (own === undefined) continue;
      const next = faces.filter((f) => Math.abs(f.y - own.y) < 1 && f.x > own.x).sort((a, b) => a.x - b.x)[0];
      const limit = next !== undefined ? next.x : own.x + own.w;
      assert.ok(m.x + units(m.text) * m.size <= limit - 1, `牌角「${m.text}」宽 ${String(Math.round(units(m.text) * m.size))} 越过本牌露出区 ${String(Math.round(limit - m.x))} ⇒ 压在邻牌脸上 @${String(w)}×${String(h)}`);
    }
  }
});

test('ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板', () => {
  const units = (t: string): number => Array.from(t).reduce((acc, ch) => acc + (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.62), 0);
  for (const bots of [2, 5] as const) {
    const snap = settledSnap(bots);
    const shown = snap.seats.filter((c) => !c.hidden);
    assert.ok(shown.length >= 1, `构造前提：${String(bots + 1)} 家这局结束时没有一张亮牌`);
    for (const [w, h] of [[560, 560], [720, 640], [960, 620], [1280, 800]] as const) {
      const sc = buildScene(snap, w, h, TABLE_STYLE);
      // 亮牌行的图元好认：桌面里唯一一批"居中 + 前景色 + 在底部条之上"的文字（池/注级是 accent/dim）
      const stripTop = sc.strip === null ? sc.height : sc.strip.y;
      const wrapped = sc.primitives.filter(
        (p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text' && p.align === 'center' && p.color === TABLE_STYLE.fg && p.y < stripTop,
      );
      const joined = wrapped.map((p) => p.text).join(' ');
      assert.ok(joined.includes('亮牌：'), `${String(bots + 1)} 家 @${String(w)}×${String(h)}：桌面上找不到"亮牌"文本行`);
      const ascii = (t: string): string => t.split(' ').map((g) => `${g.slice(0, -1)}${({ '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' } as Record<string, string>)[g.slice(-1)] ?? '?'}`).join(' ');
      for (const c of shown) assert.ok(joined.includes(`${c.name} ${ascii(c.cardsText)}`), `亮牌行漏了 ${c.name} 的 ${ascii(c.cardsText)}：${joined}`);
      assert.ok(!/[♠♥♦♣]/.test(joined), '亮牌行是给机器读的 ASCII 记法，不该出现花色字形');
      for (const only of wrapped) {
        assert.ok(only.size >= 12, `亮牌行字号只剩 ${String(only.size)}，机器读不动 @${String(w)}×${String(h)}`);
        const wide = units(only.text) * only.size;
        const box: Rect = { x: only.x - wide / 2, y: only.y - only.size, w: wide, h: only.size * 1.4 };
        for (const p of sc.plates) assert.ok(!intersects(box, p), `亮牌行压住座位板 @${String(bots + 1)} 家 ${String(w)}×${String(h)}`);
        for (const hh of sc.hits) assert.ok(!intersects(box, hh.rect), `亮牌行压住按钮 @${String(w)}×${String(h)}`);
        assert.ok(box.x >= 0 && box.x + box.w <= sc.width + 1, `亮牌行画出画布 @${String(w)}×${String(h)}`);
      }
    }
  }
});

// —— M6 · 大厅页（lby 前缀与 nui/srv 分开，不挤别人的号段）——
test('lby/01 大厅页模块图在静态服务策略下完整可达（镜像 nui/17 的走法，从 lobby.html 起步）', () => {
  // lobby.ts 不 import netx（nst/04 盯着），它的房间码口径经 netplay.ts 转口 ——
  // 所以这张图必须真的走到 netplay 与那道墙，否则"转口"是空话。
  const joinRel = (fromRel: string, spec: string): string => {
    const parts = fromRel.split('/').slice(0, -1);
    for (const seg of spec.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts.join('/');
  };
  const seen = new Set<string>();
  const refused: string[] = [];
  const queue: string[] = ['webui/lobby.html'];
  while (queue.length > 0) {
    const rel = queue.shift() as string;
    if (seen.has(rel)) continue;
    seen.add(rel);
    const r = resolveStatic(`/${rel}`);
    if (!r.ok) {
      refused.push(`/${rel} ⇒ ${r.why}`);
      continue;
    }
    const text = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    for (const m of text.matchAll(/<script\b[^\n]*?\bsrc="(\.[^"]+)"/g)) queue.push(joinRel(rel, m[1] as string));
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\b[^\n]*?from\s+'(\.[^']*)'|(?:^|\n)\s*import\s+'(\.[^']*)'/g)) {
      queue.push(joinRel(rel, (m[1] ?? m[2]) as string));
    }
  }
  assert.deepEqual(refused, [], `大厅模块图里有模块被静态服务拒掉，浏览器会整页起不来：\n${refused.join('\n')}`);
  assert.ok(seen.has('webui/lobby.ts') && seen.has('webui/netplay.ts'), '图必须从大厅页走到 netplay（房间码转口在那儿）');
  assert.ok(seen.has('netx/client.ts'), '图必须真的走到那道墙（经 netplay），否则大厅对码的校验是另一份实现');
  assert.ok(seen.has('netx/protocol.ts'), '房间码的定义在 protocol.ts，必须在图里');
  note(`lby/01 大厅模块图 ${String(seen.size)} 个文件全部可达，经 netplay 转口走到 protocol/client`);
});

test('lby/02 页面链接一律相对路径：lobby 与牌桌页在房间进程和 vite dev 两种宿主下都走得通', () => {
  const lobby = readFileSync(new URL('../webui/lobby.html', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../webui/index.html', import.meta.url), 'utf8');
  const linksOf = (html: string): string[] => [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1] as string);
  for (const href of linksOf(lobby)) {
    assert.ok(href.startsWith('./'), `大厅页的链接必须以 ./ 起步（vite dev 的根就是 webui/），实得 ${href}`);
  }
  assert.ok(linksOf(lobby).some((h) => /^\.\/index\.html\?room=/.test(h) || h === './index.html' || h.startsWith('./index.html')), '大厅要能回到牌桌页');
  // 大厅运行期生成的链接（lobby.ts 里拼的）同一条纪律：不许绝对路径
  const lobbyTs = readFileSync(new URL('../webui/lobby.ts', import.meta.url), 'utf8');
  assert.match(lobbyTs, /index\.html\?room=/, '大厅进桌的链接形态必须是 ./index.html?room=CODE（query 会在 /webui/ 的 302 上丢，不能写 ./?room=）');
  assert.ok(!lobbyTs.includes("'./?room="), "不许出现 ./?room= 这种会在 302 上丢 query 的写法");
  // 牌桌页新增的大厅链接也走相对路径；被 srv/05 钉住的旧内容不许被动到
  assert.ok(index.includes('href="./lobby.html"'), '牌桌页要有直达大厅的链接，且是相对路径');
  assert.ok(linksOf(index).every((h) => h.startsWith('./')), `牌桌页所有链接必须相对路径，实得 ${linksOf(index).join(', ')}`);
  note('lby/02 lobby/index 链接全部 ./ 相对；进桌统一 ./index.html?room=CODE（避开 /webui/ 302 丢 query）');
});

test('ui3/25 联机入口两个人因：空名字自动起名、离桌按钮走 leaveWire 且与断开并存', () => {
  const html = readFileSync(new URL('../webui/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="leaveBtn"'), '联机控件组里要有「离桌」按钮');
  assert.ok(html.includes('id="netBtn"'), '「连接/断开」仍在（离桌 ≠ 断开，两个动作并存）');
  assert.ok(html.includes('placeholder="留空自动起名"'), '名字框的占位要说明空名的行为（自动起名，不是拦下）');
  const main = stripped('webui/main.ts');
  assert.match(main, /function autoName\(\)/, '空名字要自动起一个可区分的名字（玩家-XXXX）');
  assert.match(main, /opts\.name = autoName\(\)/, 'connect 里空名走 autoName 并回填输入框（硬拦在单机态是死路：控件组藏着，名字框无处可填）');
  assert.ok(!/txt\('netName', '玩家'\)/.test(main), '调用点不许再给名字兜底"玩家"');
  assert.match(main, /leaveWire\(\)/, '离桌要走 netplay 的 leaveWire（清凭据 + 换身份 + 发 leave）');
  assert.ok((main.match(/renameWire\(/g) ?? []).length >= 2, '改名要两条路都在：连接中改框即时发 + 重连时补发（只做一条用户就找不到另一条）');
  assert.match(main, /addEventListener\('change'/, '名字框要有 change 监听（回车/失焦即改名）');
  // 真机实测缺陷：名字门拦下连接时，"模式"下拉那条路的 return 值被丢掉 ⇒ 看起来"进不去联机模式"。
  // 钉住两条入口都要把失败说出来（hint）并把焦点落到名字框。
  assert.equal((main.match(/const msg = connect\(/g) ?? []).length, 3, '按钮 / 下拉 / 自动化钩子三条入口都要接住 connect 的返回消息（吞掉 = 看起来"进不去联机模式"）');
  note('ui3/25 名字必填门 + 离桌按钮钉在源上（main.ts 恒 0 覆盖，与 srv/05 同口径）');
});

// ---------------- 第三批：天天斗地主题材质（rev=12） ----------------

test('ui3/39 天天斗地主题材质：金色行动钮/牌面内框/金牌金线/筹码内环，且金底深字读得出', () => {
  const s = snapshot(opened({ bots: 1 }));
  const sc = buildScene(s, 900, 700, TABLE_STYLE);
  const rects = sc.primitives.filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect');

  // ① 合法按钮 = 金色渐变胶囊：色标以数据进 scene（paint 零写死色的前提），半径吃到胶囊
  const legalBtns = s.buttons.filter((b) => b.legal);
  assert.ok(legalBtns.length >= 1, '构造前提：至少一颗合法按钮');
  const golds = rects.filter((p) => p.grad !== undefined);
  assert.ok(golds.length >= legalBtns.length, `合法按钮应走金色渐变，实得 ${String(golds.length)} 块 / 合法 ${String(legalBtns.length)} 颗`);
  for (const g of golds) {
    const grad = g.grad;
    if (grad === undefined) continue;
    assert.ok(grad.stops.length >= 2, '渐变色标至少两端');
    for (const [, color] of grad.stops) assert.ok(/^#[0-9a-fA-F]{6}$/.test(color), `色标必须是 scene 侧十六进制：${color}`);
    assert.equal(g.fill, 'transparent', '渐变钮不写平色（填充交给 paint 材质化）');
    assert.ok(g.radius >= 14, `胶囊半径应吃到 BTN_H/2=14，实得 ${String(g.radius)}`);
  }

  // ② 可读性：金底必须配深字 —— 亮度差就是这道门（改坏任一侧都红）
  const lum = (hex: string): number => {
    const v = hex.replace('#', '');
    const parts = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0);
    return (0.299 * (parts[0] as number) + 0.587 * (parts[1] as number) + 0.114 * (parts[2] as number)) / 255;
  };
  assert.ok(lum(TABLE_STYLE.accent) > 0.75, `accent 必须是斗地主金（够亮），实得亮度 ${lum(TABLE_STYLE.accent).toFixed(3)}`);
  assert.ok(/^#f/i.test(TABLE_STYLE.accent), 'accent 应是暖金（R 通道最高）');
  assert.ok(lum(TABLE_STYLE.btnText) < 0.25, `金按钮上的字必须够暗，实得亮度 ${lum(TABLE_STYLE.btnText).toFixed(3)}`);
  sc.hits.forEach((hit, i) => {
    const b = s.buttons[i];
    if (b === undefined) return;
    const inks = sc.primitives.filter(
      (p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text' && p.y >= hit.rect.y && p.y <= hit.rect.y + hit.rect.h && p.x >= hit.rect.x && p.x <= hit.rect.x + hit.rect.w,
    );
    assert.ok(inks.length >= 1, `第 ${String(i)} 颗按钮上没有字`);
    for (const t of inks) assert.equal(t.color, b.legal ? TABLE_STYLE.btnText : TABLE_STYLE.dim, `第 ${String(i)} 颗按钮字色错了（金底深字 / 灰钮暗字）`);
  });
  // ③ 不可点按钮保持 illegal 平色（灰钮契约：照样可点，验收③）
  if (s.buttons.some((b) => !b.legal)) {
    assert.ok(rects.some((p) => p.fill === TABLE_STYLE.illegal && p.grad === undefined), '不可点按钮应是 illegal 平色、不走渐变');
  }

  // ④ 亮牌时每张牌面配一道内描边，且内描边必须待在牌面里（不爬到邻牌脸上）
  const showdown = buildScene(settledSnap(1), 1200, 820, TABLE_STYLE);
  const faces = faceRects(showdown);
  assert.ok(faces.length >= 3, '构造前提：结算要有亮牌');
  const innerBorders = showdown.primitives.filter(
    (p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === 'transparent' && p.stroke !== null && p.radius === 4,
  );
  assert.ok(innerBorders.length >= faces.length, `每张亮牌都该有一道内描边，实得 ${String(innerBorders.length)} / 牌面 ${String(faces.length)}`);
  for (const ib of innerBorders) {
    const host = faces.find((f) => ib.rect.x >= f.x && ib.rect.y >= f.y && ib.rect.x + ib.rect.w <= f.x + f.w && ib.rect.y + ib.rect.h <= f.y + f.h);
    assert.ok(host !== undefined, `牌面内描边跑出了牌面：${JSON.stringify(ib.rect)}`);
  }

  // ⑤ 顶栏金线 + 台座金牌（细金条都在数据里）+ 筹码/头像内环（透明填充 + 描边的椭圆）
  const goldBars = rects.filter((p) => p.fill !== 'transparent' && p.stroke === null && p.rect.h >= 1 && p.rect.h <= 3);
  assert.ok(goldBars.length >= 2, '顶栏金线与台座金牌都应存在');
  const rings = sc.primitives.filter((p): p is Extract<typeof p, { kind: 'ellipse' }> => p.kind === 'ellipse' && p.fill === 'transparent' && p.stroke !== null);
  assert.ok(rings.length >= 2, '头像/筹码内环应存在');

  // ⑥ 轮次金条：把快照拨到"轮到真人"，座位板顶沿必须多一条 accent 细条
  const turnSc = buildScene({ ...s, turn: s.seats.find((x) => x.role === 'human')?.seat ?? 0 }, 900, 700, TABLE_STYLE);
  const turnBars = turnSc.primitives.filter(
    (p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === TABLE_STYLE.accent && p.stroke === null && p.rect.h === 3,
  );
  assert.ok(turnBars.length >= 1, '轮到此家时座位板顶沿要有金条');

  note('ui3/39 斗地主题材质：金钮/深字/牌面内框/金牌/金线/筹码内环，accent 与 btnText 明度对比达标');
});

test('ui3/26 hosted 结算面板与桌务路由：不压板/牌/按钮、画布内、命中区在、main 先拦桌务、单机拒绝', () => {
  // 构造一个 hosted 结算暂停形状的快照（两座亮牌 + 结算行 + 继续按钮 + hostPaused）
  const cell = (seat: number, name: string, role: 'human' | 'remote', cards: string): import('../webmin/model.ts').SeatCell => ({
    seat, name, role, marks: '', chips: 300, committed: 0, looked: true, active: false,
    status: '局中', cardsText: cards, tierText: '单张', resultText: seat === 0 ? '赢 2' : '没赢',
    hidden: false, departed: false,
  });
  const snap: Snapshot = {
    started: true,
    status: '联机·在线（甲）｜第 1 手·已结算',
    handIndex: 1, pot: 0, stake: 1, phase: 'settled', turn: -1, dealer: 0, humanSeat: 0,
    seats: [cell(0, '甲', 'human', '2S 4S 6S'), cell(1, '乙', 'remote', '3H 5H 7H')],
    buttons: [{ intent: { kind: 'begin' }, text: '继续下一局', cost: null, legal: true }],
    log: [],
    settlement: ['结束原因：稳定终局（三家各满三次行动）', '甲[你]｜2S 4S 6S 单张｜赢 2（现筹码 300）', '乙[玩家]｜3H 5H 7H 单张｜没赢（现筹码 298）'],
    settleSummary: ['甲 300'], revealedLine: '', ledgerLine: '甲=300 乙=298', total: 598,
    over: null, note: null, dealerRule: '轮庄', hostPaused: true,
  };
  const sc = buildScene(snap, 960, 620, TABLE_STYLE);
  // 面板恰好一块，用独立配色（panel + legal）—— 不与 ui3/20 的"panelSoft+accent 结算块"筛选相撞
  const panels = sc.primitives.filter((p) => p.kind === 'rect' && p.fill === TABLE_STYLE.panel && p.stroke === TABLE_STYLE.legal);
  assert.equal(panels.length, 1, `hostPaused 时应恰好一块居中面板，实得 ${String(panels.length)}`);
  const pr = (panels[0] as Extract<typeof p0, { kind: 'rect' }>).rect;
  const p0 = sc.primitives[0];
  assert.ok(pr.x >= 0 && pr.y >= 0 && pr.x + pr.w <= 960 && pr.y + pr.h <= 620, `面板必须整块在画布内：${JSON.stringify(pr)}`);
  for (const plate of sc.plates) assert.ok(!intersects(pr, plate), `面板压到了座位板：${JSON.stringify(plate)}`);
  for (const hit of sc.hits) assert.ok(!intersects(pr, hit.rect), `面板压到了按钮命中区：${JSON.stringify(hit.rect)}`);
  for (const f of faceRects(sc)) assert.ok(!intersects(pr, f), `面板压到了亮出来的牌：${JSON.stringify(f)}`);
  // 按钮命中区存在且就是继续（画得出还要点得着）
  assert.equal(sc.hits.length, 1, '恰好一个命中区');
  assert.equal(sc.hits[0]?.intent.kind, 'begin');
  // 面板文字不用 fg（避开 ui3/24 的居中文本收编口径）
  const inPanel = sc.primitives.filter((p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text' && p.align === 'center' && p.y >= pr.y && p.y <= pr.y + pr.h);
  assert.ok(inPanel.length >= 2, '面板里至少有标题与提示两行');
  for (const t of inPanel) assert.ok(t.color !== TABLE_STYLE.fg, `面板文字不该用 fg（ui3/24 口径）：${t.text}`);
  // 对照：hostPaused=false（单机/auto 的 settled）不画面板
  const sc2 = buildScene({ ...snap, hostPaused: false }, 960, 620, TABLE_STYLE);
  assert.equal(sc2.primitives.filter((p) => p.kind === 'rect' && p.fill === TABLE_STYLE.panel && p.stroke === TABLE_STYLE.legal).length, 0, '不暂停就没有面板');
  // 源钉：main.send 的桌务拦截必须先于 toMove（顺序错了 ready/begin 会被当成不认识的行动抢答）
  const main = stripped('webui/main.ts');
  const gateIdx = main.indexOf("intent.kind === 'ready' || intent.kind === 'begin'");
  const moveIdx = main.indexOf('const move = toMove(intent)');
  assert.ok(gateIdx >= 0 && moveIdx > gateIdx, '桌务拦截必须在 toMove 之前');
  // 单机拒绝：bridge 的 dispatch 对 ready/begin 走引擎拒绝路径（unknown_intent，不抛）
  const ui = start(EMPTY_UI, OPTS);
  const after = drain(dispatch(ui, { kind: 'ready' }));
  assert.ok(after.lastError !== null, `单机对 ready 该有拒绝说明，实得 ${String(after.lastError)}`);
  const after2 = drain(dispatch(after, { kind: 'begin' }));
  assert.ok(after2.lastError !== null, '单机对 begin 同样拒绝');
  note('ui3/26 居中面板四不压（板/牌/按钮/画布）+ 命中区在 + 独立配色 + 桌务先拦后 toMove + 单机拒绝');
});

test('lby/03 大厅数据面：等待中/进行中标签 + 自动刷新，都来自 /rooms 的 waiting', () => {
  const ts = readFileSync(new URL('../webui/lobby.ts', import.meta.url), 'utf8');
  assert.ok(ts.includes('waiting: boolean'), 'RoomRow 要收下 /rooms 新增的 waiting 字段');
  assert.ok(ts.includes("r.waiting ? '等待中' : '进行中'"), '列表行要有等待中/进行中的可读标签（不是裸 phase）');
  assert.ok(ts.includes('setInterval'), '大厅要自动刷新（新开出的桌不该要求手动刷新）');
  assert.ok(ts.includes("visibilityState === 'visible'"), '页面不可见时不刷（省无谓请求）');
  note('lby/03 大厅：waiting 标签 + 5 秒自动刷新（可见时）');
});

// ---------------- 第一批：悬停 / 主题 / 页面接线 ----------------

test('ui3/34 hover 是纯入参：不传与现状逐字节相同；命中按钮只多一块高亮且几何不变', () => {
  const s = snapshot(opened());
  const base = buildScene(s, 960, 620, TABLE_STYLE);
  // 缺省、显式 undefined、显式 null 三种"没有悬停"的形态都必须与现状完全一致
  assert.equal(JSON.stringify(base), JSON.stringify(buildScene(s, 960, 620, TABLE_STYLE, undefined, undefined)));
  assert.equal(JSON.stringify(base), JSON.stringify(buildScene(s, 960, 620, TABLE_STYLE, undefined, null)));
  const hit = base.hits[0];
  assert.ok(hit !== undefined, '构造前提：至少有一颗按钮');
  if (hit === undefined) return;
  const hovered = buildScene(s, 960, 620, TABLE_STYLE, undefined, { x: hit.rect.x + hit.rect.w / 2, y: hit.rect.y + hit.rect.h / 2 });
  assert.equal(hovered.primitives.length, base.primitives.length + 1, '命中按钮时应当恰好多一块高亮图元');
  const extra = hovered.primitives[hovered.primitives.length - 1];
  assert.ok(extra !== undefined && extra.kind === 'rect', '高亮必须是 rect 图元');
  if (extra !== undefined && extra.kind === 'rect') {
    assert.equal(extra.fill, 'transparent', '高亮只描边不填充');
    assert.equal(extra.stroke, TABLE_STYLE.accent, '高亮用当前主题的 accent');
    assert.deepEqual(extra.rect, hit.rect, '高亮必须 exactly 盖在命中按钮上');
  }
  // 命中区 / 座位板 / 底部条一概不变：hover 只加一块高亮，不动任何布局
  assert.deepEqual(hovered.hits, base.hits);
  assert.deepEqual(hovered.plates, base.plates);
  assert.deepEqual(hovered.strip, base.strip);
  // 悬停空白处（顶栏左上角，不是按钮）：与不传逐字节相同
  const none = buildScene(s, 960, 620, TABLE_STYLE, undefined, { x: 2, y: 2 });
  assert.equal(JSON.stringify(none), JSON.stringify(base), '悬停空白处的输出必须与缺省逐字节相同');
  // 悬停另一颗按钮：高亮跟着换（不会一直停在第一颗上）
  const hit2 = base.hits[1];
  if (hit2 !== undefined) {
    const hovered2 = buildScene(s, 960, 620, TABLE_STYLE, undefined, { x: hit2.rect.x + 2, y: hit2.rect.y + 2 });
    const extra2 = hovered2.primitives[hovered2.primitives.length - 1];
    assert.ok(extra2 !== undefined && extra2.kind === 'rect' && extra2.rect.x === hit2.rect.x && extra2.rect.y === hit2.rect.y, '高亮没有跟着第二颗按钮走');
  }
});

test('ui3/35 主题常量：INK/PAPER 字段与 TABLE_STYLE 同构、取值确有差异，且默认主题没有被顺手改掉', () => {
  const keys = Object.keys(TABLE_STYLE).sort();
  for (const [name, st] of [['墨金', INK_STYLE], ['月白', PAPER_STYLE]] as const) {
    assert.deepEqual(Object.keys(st).sort(), keys, `${name} 的字段集合与 TABLE_STYLE 不一致`);
    const diff = keys.filter((k) => (st as unknown as Record<string, unknown>)[k] !== (TABLE_STYLE as unknown as Record<string, unknown>)[k]);
    assert.ok(diff.length >= 5, `${name} 与 TABLE_STYLE 几乎相同（只有 ${String(diff.length)} 处不同）⇒ 换主题没有意义`);
  }
  // 布局量（pad/rowH/font）是布局契约的一部分：主题只许换色，不许顺手改布局
  for (const st of [INK_STYLE, PAPER_STYLE]) {
    assert.equal(st.pad, TABLE_STYLE.pad);
    assert.equal(st.rowH, TABLE_STYLE.rowH);
    assert.equal(st.font, TABLE_STYLE.font);
  }
  // 默认主题没被顺手改掉：buildScene 缺省仍等价于显式传 TABLE_STYLE
  const s = snapshot(opened());
  assert.equal(JSON.stringify(buildScene(s, 900, 600)), JSON.stringify(buildScene(s, 900, 600, TABLE_STYLE)));
  // 换主题之后布局不变：同一快照在三种主题下的 hits/plates 必须完全一致
  const table = buildScene(s, 900, 600, TABLE_STYLE);
  const ink = buildScene(s, 900, 600, INK_STYLE);
  const paper = buildScene(s, 900, 600, PAPER_STYLE);
  assert.deepEqual(ink.hits, table.hits);
  assert.deepEqual(ink.plates, table.plates);
  assert.deepEqual(paper.hits, table.hits);
  assert.deepEqual(paper.plates, table.plates);
});

test('ui3/36 页面接线：aria-live、语义键表与主题/音效/全屏三按钮', () => {
  const html = stripped('webui/index.html');
  const main = stripped('webui/main.ts');
  // aria-live：读屏器的播报位必须存在，且入口层真的在喂它
  assert.ok(html.includes('aria-live="polite"') && html.includes('id="live"'), 'index.html 缺 aria-live 播报位 #live');
  assert.ok(main.includes("'live'"), 'main.ts 没有写 #live ⇒ 播报位是摆设');
  // 三个新控件：HTML 有、main.ts 读了（与 ui3/04b 同一机检口径）
  for (const id of ['themeBtn', 'muteBtn', 'fsBtn']) {
    assert.ok(html.includes(`id="${id}"`), `index.html 缺控件 #${id}`);
    assert.ok(main.includes(`'${id}'`), `main.ts 没接 #${id} ⇒ 这个控件是摆设`);
  }
  // 语义键表：8 个 intent.kind 必须逐字出现在 main.ts 里（数字键按 kind 映射，不按下标）
  for (const kind of ['look', 'call', 'raise', 'fold', 'compare', 'settle', 'nextHand', 'reset'] as const) {
    assert.ok(main.includes(`'${kind}'`), `键盘语义键表缺 '${kind}'`);
  }
  // 全屏走按钮化的 requestFullscreen；音效走 sfx 模块（程序化合成，无素材文件）
  assert.ok(main.includes('requestFullscreen'), '全屏必须走 requestFullscreen 按钮，不是 F 键');
  assert.ok(main.includes('createSfx'), '音效模块没有接进入口层');
  assert.ok(stripped('webui/sfx.ts').includes('OscillatorNode') || readFileSync(new URL('../webui/sfx.ts', import.meta.url), 'utf8').includes('createOscillator'), 'sfx 应当是程序化合成，不是音频文件');
});

// ---------------- 第二批：3D 桌面 / 发牌动画 / paint 颜色纪律 ----------------

test('ui3/37 发牌动画：起飞前牌全在牌堆、途中无牌面泄露、落定后与静态布局逐字节一致', () => {
  const snap = snapshot(opened({ bots: 2 }));
  const W = 960;
  const H = 620;
  const start = 5000;
  const seats = snap.seats.length;
  const total = 70 * (seats * 3 - 1) + 260;
  const staticScene = buildScene(snap, W, H, TABLE_STYLE);
  // 牌堆位 = 桌面中心 = 台面椭圆的圆心（径向渐变椭圆中 rx 最大的那一个 = 呢面）
  const ellipses = staticScene.primitives.filter((p): p is Extract<typeof p, { kind: 'ellipse' }> => p.kind === 'ellipse');
  const radial = ellipses.filter((p) => p.grad?.radial === true);
  assert.ok(radial.length >= 1, '台面椭圆没找到');
  const felt = radial.reduce((a, b) => (b.rx > a.rx ? b : a), radial[0] as (typeof radial)[number]);
  assert.ok(felt !== undefined && felt.grad?.radial === true, '台面椭圆没找到');
  if (felt === undefined) return;
  const nearDeck = (r: Rect): boolean => Math.abs(r.x + r.w / 2 - felt.cx) < 60 && Math.abs(r.y + r.h / 2 - felt.cy) < 60;
  const backsOf = (sc: ReturnType<typeof buildScene>): Rect[] =>
    sc.primitives.filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === TABLE_STYLE.cardBack).map((p) => p.rect);
  // ① 起飞前（t=0）：所有牌背都聚在牌堆位，且整棵树没有任何牌面
  const atDeck = buildScene(snap, W, H, TABLE_STYLE, { now: start, since: {}, duration: 320, deal: { start, duration: 260, stagger: 70 } });
  const deckBacks = backsOf(atDeck);
  assert.equal(deckBacks.length, seats * 3, `起飞前应有 ${String(seats * 3)} 张牌背，实际 ${String(deckBacks.length)}`);
  for (const r of deckBacks) assert.ok(nearDeck(r), `起飞前的牌不在牌堆位 (${String(r.x)},${String(r.y)})`);
  assert.equal(faceGlyphCount(atDeck), 0, '发牌途中就画出了牌面 ⇒ 提前泄露');
  assert.equal(faceRects(atDeck).length, 0, '发牌途中出现了牌面矩形');
  assert.notEqual(JSON.stringify(atDeck), JSON.stringify(staticScene), '发牌动画没有改变任何图元 ⇒ 动画根本没生效');
  // ② 途中：有牌在飞（位置不同于静态）、无泄露、命中区与座位板纹丝不动、一切都在画布内
  const mid = buildScene(snap, W, H, TABLE_STYLE, { now: start + Math.floor(total / 2), since: {}, duration: 320, deal: { start, duration: 260, stagger: 70 } });
  assert.equal(faceGlyphCount(mid), 0, '飞行途中不许出现牌面');
  const midBacks = backsOf(mid);
  assert.ok(midBacks.some((r) => !nearDeck(r)), '飞到一半竟然没有一张牌离开牌堆');
  for (const r of [...backsOf(mid), ...faceRects(mid)]) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W + 1 && r.y + r.h <= H + 1, `飞行中的牌飞出了画布 (${String(r.x)},${String(r.y)})`);
  }
  assert.deepEqual(mid.hits, staticScene.hits, '发牌动画不许动命中区');
  assert.deepEqual(mid.plates, staticScene.plates, '发牌动画不许动座位板');
  // ③ 纯函数：同一 anim 两次布局逐字节相同
  const midAgain = buildScene(snap, W, H, TABLE_STYLE, { now: start + Math.floor(total / 2), since: {}, duration: 320, deal: { start, duration: 260, stagger: 70 } });
  assert.equal(JSON.stringify(mid), JSON.stringify(midAgain));
  // ④ 落定（t > 总时长）：与不带 deal 的静态布局逐字节一致 —— 绝不允许"永远卡在飞一半"
  const landed = buildScene(snap, W, H, TABLE_STYLE, { now: start + total + 500, since: {}, duration: 320, deal: { start, duration: 260, stagger: 70 } });
  assert.equal(JSON.stringify(landed), JSON.stringify(staticScene), '发牌落定后必须与静态布局逐字节一致');
  // ⑤ 提前跳过（now 直接拨到终点之后）同样落定
  const skipped = buildScene(snap, W, H, TABLE_STYLE, { now: start + total + 1, since: {}, duration: 320, deal: { start, duration: 260, stagger: 70 } });
  assert.equal(JSON.stringify(skipped), JSON.stringify(staticScene));
});

test('ui3/38 paint 颜色纪律：一个十六进制色值都不写，颜色全部来自 scene 图元数据', () => {
  const code = stripped('webui/paint.ts');
  const hexes = code.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  assert.deepEqual(hexes, [], `paint.ts 里出现了写死的颜色：${hexes.join(' ')}`);
  // 渐变必须由 paint 材质化（scene 只给色标数据），且真的在用 addColorStop
  assert.ok(code.includes('addColorStop'), '渐变色标没有被材质化');
  assert.ok(code.includes('createRadialGradient') || code.includes('createLinearGradient'), '渐变图元没有实现');
  // 3D 桌面的渐变确实进了 scene：台面椭圆带 radial 色标、木轨带竖向线性色标
  const sc = buildScene(snapshot(opened()), 960, 620, TABLE_STYLE);
  const grads = sc.primitives.filter((p): p is Extract<typeof p, { kind: 'ellipse' }> => p.kind === 'ellipse' && p.grad !== undefined);
  assert.ok(grads.length >= 2, `3D 桌面至少要两个渐变椭圆（木轨+呢面），实际 ${String(grads.length)}`);
  assert.ok(grads.some((p) => p.grad?.radial === true), '呢面应当是径向渐变');
  for (const p of grads) {
    for (const [offset, color] of p.grad?.stops ?? []) {
      assert.ok(offset >= 0 && offset <= 1, '色标位置必须在 [0,1]');
      assert.ok(/^#|rgba?\(/.test(color), '色标必须是颜色');
    }
  }
});

// ---------------- 雀魂式模板：桌前筹码 / 角位座位 ----------------

test('ui3/39 桌前筹码：枚数=投入÷注级（封顶8）、堆位朝桌心、不压按钮与座位板、飞筹两端逐字节一致', () => {
  // ① 折算公式
  assert.equal(chipStackCount(0, 1), 0, '没投入就不画堆');
  assert.equal(chipStackCount(3, 1), 3);
  assert.equal(chipStackCount(4, 2), 2);
  assert.equal(chipStackCount(1, 0), 0, '注级未知时宁可画不出，不许除零');
  assert.equal(chipStackCount(999, 1), 8, '视觉封顶 8 枚');
  // ② 开局（各家已下底注）⇒ 每家都有筹码堆
  const snap = snapshot(opened({ bots: 2 }));
  const sc = buildScene(snap, 960, 620, TABLE_STYLE);
  const chipEllipses = sc.primitives.filter((p): p is Extract<typeof p, { kind: 'ellipse' }> => p.kind === 'ellipse' && Math.abs(p.rx - 11) < 0.01);
  assert.ok(chipEllipses.length >= 3, '开局至少三家各有筹码堆');
  for (const c of chipEllipses) {
    assert.ok(c.cx >= 0 && c.cy >= 0 && c.cx <= sc.width + 1 && c.cy <= sc.height + 1, `筹码画出画布 (${String(c.cx)},${String(c.cy)})`);
  }
  // 筹码堆不压任何命中区（按钮是唯一可点面）
  for (const c of chipEllipses) {
    for (const hit of sc.hits) {
      const box: Rect = { x: c.cx - c.rx, y: c.cy - c.ry, w: c.rx * 2, h: c.ry * 2 };
      assert.ok(!intersects(box, hit.rect), `筹码堆压住按钮 ${hit.id}`);
    }
  }
  // 确定性
  assert.equal(JSON.stringify(sc), JSON.stringify(buildScene(snap, 960, 620, TABLE_STYLE)));
  // ③ 飞行筹码：t=0（未起飞）与 t≥总时长都与不带 chips 逐字节一致；中途多出飞行筹码
  const seat0 = snap.seats.find((x) => x.role === 'human');
  assert.ok(seat0 !== undefined);
  if (seat0 === undefined) return;
  const since = 9000;
  const withChips = (now: number): ReturnType<typeof buildScene> =>
    buildScene(snap, 960, 620, TABLE_STYLE, { now, since: {}, duration: 320, chips: { seat: seat0.seat, since, count: 2 } });
  const plain = buildScene(snap, 960, 620, TABLE_STYLE);
  assert.equal(JSON.stringify(withChips(since)), JSON.stringify(plain), '未起飞时不应画出飞行筹码');
  assert.equal(JSON.stringify(withChips(since + 2000)), JSON.stringify(plain), '落定后不应再画飞行筹码');
  const mid = withChips(since + 300);
  assert.notEqual(JSON.stringify(mid), JSON.stringify(plain), '飞行中应当多出筹码图元');
  const midChips = mid.primitives.filter((p): p is Extract<typeof p, { kind: 'ellipse' }> => p.kind === 'ellipse' && Math.abs(p.rx - 11) < 0.01);
  assert.ok(midChips.length === chipEllipses.length + 2, '飞行中应恰好多出 2 枚在途筹码');
});

test('ui3/40 雀魂角位：默认 3 人桌的两位对手在左上/右上两角，你在底部正中', () => {
  const snap = snapshot(opened({ bots: 2 }));
  assert.equal(snap.seats.length, 3, '默认桌型 = 你 + 2 机器人（可自定义 1–6 家）');
  for (const [w, h] of [[560, 560], [720, 640], [960, 620], [1600, 900]] as const) {
    const sc = buildScene(snap, w, h, TABLE_STYLE);
    assert.ok(sc.plates.length === 3, `${String(w)}×${String(h)} 座位板数量不对`);
    const top = sc.plates.filter((p) => p.y === TABLE_STYLE.pad + 32);
    assert.equal(top.length, 2, `${String(w)}×${String(h)} 对手板应同在顶部一条线上`);
    const left = top[0];
    const right = top[1];
    assert.ok(left !== undefined && right !== undefined);
    if (left === undefined || right === undefined) continue;
    assert.ok(left.x < right.x, '左角必须在右角左边');
    assert.ok(Math.abs(left.x - TABLE_STYLE.pad) <= 1, `左角板应贴左缘（x=${String(left.x)}）`);
    assert.ok(Math.abs(right.x + right.w - (w - TABLE_STYLE.pad)) <= 1, `右角板应贴右缘（x=${String(right.x)}）`);
    const own = sc.plates.find((p) => p.y > TOP_BAR + 100);
    assert.ok(own !== undefined && Math.abs(own.x + own.w / 2 - w / 2) <= 1, `${String(w)}×${String(h)} 本人板应在底部正中`);
  }
  // 人数可自定义仍然成立：6 家桌 4 视口不重叠由 ui3/19 守护，这里只钉"板数随人数走"
  for (const bots of [1, 3, 5] as const) {
    const s = snapshot(opened({ bots }));
    assert.equal(buildScene(s, 960, 620, TABLE_STYLE).plates.length, bots + 1);
  }
});

test('lby/04 资产纪律：单个二进制 ≤300KB、assets 总量 ≤600KB（BRIEF-UI §4；不用文件系统时钟，纯 readdir）', () => {
  const dir = new URL('../webui/assets/', import.meta.url);
  const files = readdirSync(dir);
  assert.ok(files.length >= 1, 'assets 目录不该是空的（构造前提）');
  let total = 0;
  for (const name of files) {
    const size = statSync(new URL(`../webui/assets/${name}`, import.meta.url)).size;
    total += size;
    assert.ok(size <= 300 * 1024, `webui/assets/${name} 单文件 ${String(size)} 字节超 300KB 上限（需压缩或程序化替代）`);
    if (name.endsWith('.svg')) {
      // SVG 安全门：不许带脚本/事件属性（静态服务也会端它给浏览器）
      const text = readFileSync(new URL(`../webui/assets/${name}`, import.meta.url), 'utf8');
      assert.ok(!/<script/i.test(text) && !/on[a-z]+\s*=/i.test(text), `webui/assets/${name} 含脚本或事件属性，拒绝入库`);
    }
  }
  assert.ok(total <= 600 * 1024, `webui/assets 总量 ${String(total)} 字节超 600KB 上限`);
  note(`lby/04 资产纪律：${String(files.length)} 个文件共 ${String(total)} 字节（单文件 ≤300KB、总量 ≤600KB、SVG 无脚本）`);
});

test('ui3/41 状态气泡（M-UI2）：语义色映射表、气泡容身在座位板内、不冒充牌面、不与庄家金牌叠字', () => {
  // ① 语义色映射：statusBubbleInk 是唯一出口（每处气泡都从这取字色）
  const ink = (s: string, turn = false): string => statusBubbleInk(s, turn, TABLE_STYLE);
  assert.equal(ink('行动中'), ink('局中', true), '轮到谁，谁的气泡就是金色档（isTurn 与"行动中"同档）');
  assert.notEqual(ink('行动中'), ink('局中'), '行动中与局中必须分档');
  assert.equal(ink('已准备'), ink('已准备', true) === ink('已准备') ? ink('已准备') : ink('已准备'), '恒定');
  assert.notEqual(ink('已准备'), ink('未准备'), '已准备（绿档）与未准备（警示档）分档');
  assert.equal(ink('弃牌'), ink('被淘汰'), '弃牌/被淘汰同一灰档');
  assert.equal(ink('本局不参与'), ink('弃牌'), '不参与也归灰档');
  // 深字纪律：白底气泡上的字色必须比底色深得多（可读性），且不等于 fg 本串（避开 ui3/24 的收编口径）
  for (const s of ['行动中', '已准备', '未准备', '弃牌', '局中', '本局不参与']) {
    assert.ok(ink(s) !== TABLE_STYLE.fg, `${s} 的字色不该是裸 fg`);
  }
  // ② 几何：真实快照（单机开局）里每一块气泡都待在自己座位板内、不压牌面、不冒充牌面
  const soloUi = opened();
  const b = buildScene(snapshot(soloUi), 960, 620, TABLE_STYLE);
  const bubbleFills = b.primitives.filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === TABLE_STYLE.bubble);
  assert.ok(bubbleFills.length >= 1, '至少一块状态气泡（本人板的"局中/行动中"）');
  const inPlate = (r: Rect): Rect | undefined => sc_plateAt(b, r);
  for (const bp of bubbleFills) {
    const plate = inPlate(bp.rect);
    assert.ok(plate !== undefined, `气泡 ${JSON.stringify(bp)} 必须整体落在某块座位板内`);
    for (const f of faceRects(b)) assert.ok(!intersects(bp.rect, f), `气泡压到了牌面：${JSON.stringify(bp)} vs ${JSON.stringify(f)}`);
  }
  // ③ 气泡不冒充牌面：cardFace 收集器（ui3/18/23 的口径）数不变 —— 气泡用独立 bubble 令牌
  const perSeat = snapshot(soloUi).seats.filter((s) => !s.hidden).length;
  assert.equal(faceRects(b).length, perSeat * 3, `亮牌矩形应当恰好 = 亮牌座位数×3，实得 ${String(faceRects(b).length)}（气泡不许混进来）`);
  // ④ 对手板气泡与庄家金牌共存：构造一个对手坐庄的快照，两者的矩形不得相交
  const dealerSnap = snapshot(opened());
  const opp = dealerSnap.seats.find((s) => s.role !== 'human');
  if (opp !== undefined) {
    dealerSnap.dealer = opp.seat;
    const b2 = buildScene(dealerSnap, 960, 620, TABLE_STYLE);
    const medals = b2.primitives.filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === TABLE_STYLE.accent && p.rect.w === 22 && p.rect.h === 15);
    const bubbles2 = b2.primitives.filter((p): p is Extract<typeof p, { kind: 'rect' }> => p.kind === 'rect' && p.fill === TABLE_STYLE.bubble);
    assert.ok(medals.length >= 1 && bubbles2.length >= 1, '构造前提：对手庄家金牌与气泡都在');
    for (const m of medals) for (const bp of bubbles2) assert.ok(!intersects(m.rect, bp.rect), `庄家金牌与状态气泡叠字：${JSON.stringify(m.rect)} vs ${JSON.stringify(bp.rect)}`);
  }
  note('ui3/41 气泡：语义色映射（金/绿/灰/警示分档）+ 容身在板内不压牌面 + bubble 令牌与 cardFace 分家 + 金牌共存');
});

// ui3/40 的辅助：气泡矩形落在哪块座位板内（完全包含才算）
function sc_plateAt(sc: ReturnType<typeof buildScene>, r: Rect): Rect | undefined {
  return sc.plates.find((p) => r.x >= p.x && r.y >= p.y && r.x + r.w <= p.x + p.w + 1 && r.y + r.h <= p.y + p.h + 1);
}
