// M3 · 正式 UI 的无头验收。两类断言：
// ① 层次机检 —— §4 M3「只渲染 + 发意图，绝不自己判规则」落成可执行约束；
// ② bridge / scene 的行为与确定性 —— 这两层是纯逻辑，不开浏览器就能全部钉死。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, note } from './harness.ts';
import { stateHash } from '../src/engine/state.ts';
import { EMPTY_UI, dispatch, drain, snapshot, start } from '../webui/bridge.ts';
import type { Snapshot, StartOptions } from '../webui/bridge.ts';
import { buildScene, hitAt, TABLE_STYLE } from '../webui/scene.ts';
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
  for (const url of ['/webui/index.html', '/webui/main.ts', '/webui/bridge.ts', '/webui/scene.ts', '/webui/paint.ts', '/webmin/model.ts', '/src/engine/state.ts']) {
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
