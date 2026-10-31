// rev=12 · 天天斗地主外壳的无头验收（与 webui.test.ts 的 scene 侧分开，互不重叠）。
// 这里钉的是"页面外壳"这条独立战线：斗地主绿金令牌、金底深字主钮、画布金框、
// 主题标签三处一致、以及 rev=7 立下的竖向预算纪律不许被美化破坏。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, note } from './harness.ts';
import { CARD_FONT, TABLE_STYLE } from '../webui/scene.ts';

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

// 只看 CSS 本体：注释里出现"calc(100vh - N"这类说明文字不该被当成违规
// （与 webui.test.ts 的 stripped() 同一路数，这里剥的是 HTML 内联样式里的 /* */）。
function css(html: string): string {
  return html.replace(/\/\*[\s\S]*?\*\//g, '');
}

const INDEX = read('webui/index.html');
const LOBBY = read('webui/lobby.html');
const MAIN = read('webui/main.ts');

test('shell/01 牌桌页外壳令牌：深墨绿底 + 斗地主金主钮 + 画布金框，且与 scene 同一套字体', () => {
  // 页面底色就是 scene 的 bg（跨层令牌一致：换主题时两边一起换，不会"框是绿的、桌是蓝的"）
  assert.ok(INDEX.includes(TABLE_STYLE.bg), `页面底色应直接用 scene 的 bg（${TABLE_STYLE.bg}）`);
  assert.ok(INDEX.includes('radial-gradient'), '页面要有一层径向氛围底（平色太寡淡）');
  // 主行动钮：金渐变 + 深字 + 内高光（与 scene 里金色行动钮同一套材质语言）
  assert.ok(INDEX.includes('linear-gradient(#ffd968, #f0a52a)'), '主行动钮应是斗地主金渐变');
  assert.ok(INDEX.includes('color: #23180a'), '金底必须配深字（金底金字读不出）');
  assert.ok(INDEX.includes('inset 0 1px 0 rgba(255, 255, 255'), '主钮要有一道内高光');
  assert.ok(INDEX.includes('button.ghost'), '氛围/音效/全屏要走幽灵款，与主钮分主次');
  // 画布金框：托住牌桌的那一道
  assert.ok(/border: 1px solid rgba\(255, 197, 61/.test(INDEX), '画布要有一道金框');
  assert.ok(INDEX.includes('box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55)'), '金框外再压一道暗边，绿呢上才不飘');
  // 字体与 scene 同源
  assert.ok(INDEX.includes('"PingFang SC"') && CARD_FONT.includes('"PingFang SC"'), '页面与牌桌必须同一套圆体黑体');
  // 氛围层的金线内框跟着默认主题走
  assert.ok(INDEX.includes('--amb-line: rgba(255, 197, 61'), '默认氛围变量应是金线（与 accent 同源）');
  note('shell/01 牌桌页外壳：绿底/金钮/深字/金框/同源字体');
});

test('shell/02 主题标签三处一致：main.ts 的 THEMES、页面初始文案、按钮 title 同说一个名', () => {
  assert.match(MAIN, /label: '斗地主'/, 'main.ts 的默认主题标签应是「斗地主」');
  assert.ok(INDEX.includes('主题：斗地主'), '页面初始文案要与 THEMES 一致（无存档时用户看见的就是它）');
  assert.ok(INDEX.includes('斗地主 → 墨金 → 月白'), '按钮 title 要说明循环顺序，且用同一个标签');
  // 标签不许再悄悄回到旧名（改一处忘两处 = 用户看到"主题：桌绿"却调到别的桌面）
  assert.ok(!/桌绿/.test(MAIN), 'main.ts 里不许再出现旧标签「桌绿」');
  assert.ok(!/桌绿/.test(INDEX), 'index.html 里不许再出现旧标签「桌绿」');
  note('shell/02 主题标签 main.ts / 初始文案 / title 三处一致');
});

test('shell/03 大厅页同款外壳 + 降级路径与控件一个不少', () => {
  assert.ok(LOBBY.includes(TABLE_STYLE.bg), '大厅与牌桌页同一套底色令牌');
  assert.ok(LOBBY.includes('linear-gradient(#ffd968, #f0a52a)'), '大厅主钮（开新桌 / 进入）同一套金渐变');
  assert.ok(LOBBY.includes('color: #23180a'), '大厅金钮同样配深字');
  assert.ok(LOBBY.includes('rgba(255, 197, 61, 0.32)'), '大厅页头同一道金色分隔');
  // 控件与降级说明：vite dev 下 /rooms 拿不到，页面必须说清楚而不是卡死
  for (const id of ['newRoom', 'codeInput', 'joinCode', 'codeNote', 'roomList', 'listNote']) {
    assert.ok(LOBBY.includes(`id="${id}"`), `大厅缺控件 #${id}`);
  }
  assert.ok(read('webui/lobby.ts').includes('拿不到房间列表'), '大厅要保留"拿不到列表"的降级说明');
  note('shell/03 大厅页同款外壳 + 降级说明与控件齐全');
});

test('shell/04 美化不许吃掉竖向预算：页面框架仍压在 ~80px，画布仍拿剩余高度', () => {
  for (const [name, html] of [['index.html', INDEX], ['lobby.html', LOBBY]] as const) {
    assert.ok(!/calc\(100vh/.test(css(html)), `${name} 不许写死 calc(100vh - N)：窗口一矮画布就被挤爆`);
  }
  // 紧凑两行的口径不变（这两句是 rev=7 验收窗口 720×640 的活口）
  assert.ok(/header \{[^}]*padding: 4px 10px/.test(INDEX), '牌桌页 header 仍是紧凑内边距 4px 10px');
  assert.ok(/header \{[^}]*font-size: 12px/.test(INDEX), '牌桌页 header 仍是 12px 小字');
  assert.ok(INDEX.includes('flex-direction: column'), '页面仍是"页头 + 舞台"的竖向弹性壳');
  assert.ok(/#stage \{[^}]*flex: 1 1 auto/.test(INDEX), '#stage 要吃掉剩余高度');
  assert.ok(/#stage \{[^}]*min-height: 0/.test(INDEX), '#stage 要允许被压缩（flex 子项默认 min-height:auto 会顶破预算）');
  // 可访问性与三个幽灵控件不许被美化顺手删掉
  assert.ok(INDEX.includes('aria-live="polite"') && INDEX.includes('id="live"'), 'aria-live 播报位仍在');
  for (const id of ['themeBtn', 'muteBtn', 'fsBtn']) assert.ok(INDEX.includes(`id="${id}"`), `幽灵控件 #${id} 仍在`);
  note('shell/04 竖向预算纪律未破：无 calc(100vh)、#stage 仍 flex:1 1 auto + min-height:0');
});
