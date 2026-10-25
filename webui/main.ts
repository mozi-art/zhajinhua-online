// M3 · 入口与事件层。只干三件事：量尺寸、把 scene 交给 paint、把点击翻译成意图。
// 不判任何规则，也不直接 import 引擎：状态与合法性全部来自 bridge（其上游是 model → 引擎）。
// 这是唯一允许碰 DOM / 时钟的一层 —— 翻牌动画要一个 now，而 scene 只把它当入参，保持纯函数可测。
//
// M5 起这里多了两条路：
//   单机 —— 与 M3 完全一样，走 bridge（→ webmin/model → 引擎）。
//   联机 —— 走 netplay（→ netx/client 那道墙）。两条路交出同一种 Snapshot，所以 scene/paint 一个字没改。
// 这一层只做"接线"：WebSocket 与 sessionStorage 是 netplay 注入的两个端口，时钟与随机也只在这儿出现。
// 行动能不能发出去由 netplay/那道墙决定，规则对不对由服务端 reject 决定 —— 这里一个都不判。
import { dispatch, drain, EMPTY_UI, snapshot, start } from './bridge.ts';
import type { Snapshot, StartOptions, Ui } from './bridge.ts';
import { createNet, roomUrlFrom, ROOM_CODE_ALPHABET, toMove, WIRE_SUBPROTOCOL } from './netplay.ts';
import type { Net, NetInfo, Store } from './netplay.ts';
import { paint } from './paint.ts';
import { buildScene, hitAt, TABLE_STYLE } from './scene.ts';
import type { Intent } from '../webmin/model.ts';

type Mode = 'solo' | 'online';

let ui: Ui = EMPTY_UI;
let mode: Mode = 'solo';
let net: Net | null = null;
let sock: WebSocket | null = null;
let linkNote: string | null = null; // 连接层自己的话（连不上 / 断了 / 正在重连），与引擎的 lastError 分开
let wantOnline = false; // 只有"用户想联机"时 onclose 才自动重连；手动断开 ⇒ 不再追连
let retries = 0;
let retryTimer = 0;
const MAX_RETRIES = 5;
let scene = buildScene(snapshot(ui), 960, 620, TABLE_STYLE);
const FLIP_MS = 320;
// seat → 该座位牌面首次可见的时刻（换局或重新变暗时清掉，下一轮会重新起翻牌）
let flipSince: Record<number, number> = {};
let frameId = 0;

function clockMs(): number {
  return performance.now();
}

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function num(id: string, fallback: number): number {
  const node = el<HTMLInputElement>(id);
  const v = Number(node?.value);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function txt(id: string, fallback: string): string {
  const v = el<HTMLInputElement>(id)?.value.trim() ?? '';
  return v === '' ? fallback : v;
}

function readOptions(): StartOptions {
  const preset = el<HTMLSelectElement>('preset')?.value ?? 'classic';
  const dealer = el<HTMLSelectElement>('dealerNext')?.value ?? 'rotate';
  return {
    bots: Math.max(0, Math.min(5, num('bots', 2))),
    buyIn: Math.max(1, num('buyIn', 256)),
    baseSeed: num('seed', 20260925),
    presetName: preset === 'a23off' ? 'a23off' : 'classic',
    dealerNext: dealer === 'winner' || dealer === 'loser' ? dealer : 'rotate',
  };
}

// ——————————————————————————— 联机接线 ———————————————————————————

// 每标签页一份的存储。这里必须是 sessionStorage：localStorage 是全局键，同一浏览器开两个标签页
// 时后入座的会把先入座的凭据覆盖掉（工单 §4 M5 点的那次翻车，nui/07 拿共享存储做了反面对照）。
// 隐私模式等场景下 sessionStorage 会抛 —— 抛了就退化成"只活到刷新"，并在页面上说清楚，绝不偷偷改用全局存储。
let storeDegraded = false;
const tabStore: Store = {
  get: (k) => {
    try {
      return window.sessionStorage.getItem(k);
    } catch {
      storeDegraded = true;
      return null;
    }
  },
  set: (k, v) => {
    try {
      window.sessionStorage.setItem(k, v);
    } catch {
      storeDegraded = true;
    }
  },
  del: (k) => {
    try {
      window.sessionStorage.removeItem(k);
    } catch {
      storeDegraded = true;
    }
  },
};

// 客户端份额的熵源：浏览器给的真随机。拿不到就直接拒绝连接 —— 用 Math.random 顶上是把 commit-reveal
// 的前提（份额不可预测）换成一个可预测的数，那比不连更糟。
function browserEntropy(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function currentSnapshot(): Snapshot {
  if (mode === 'online' && net !== null) return net.snapshot();
  return snapshot(ui);
}

function openSocket(url: string, renameTo?: string): void {
  const ws = new WebSocket(url, WIRE_SUBPROTOCOL);
  sock = ws;
  ws.onopen = () => {
    if (net === null) return;
    net.markOpen();
    retries = 0;
    linkNote = null;
    // 有凭据就凭 token 回来（刷新 / 断线），没有才占一个新座。
    // resume 不带名字：输入框里的名字如果和会话里的不一样，就是玩家想改名 —— 补一条 rename
    // （座位不动）。不补的话，改了名字再重连桌上一寸不变（真机实测撞出来的"没变化"）。
    const wire = net.resumeWire();
    ws.send(wire ?? net.joinWire());
    if (wire !== null && renameTo !== undefined && renameTo !== '' && renameTo !== net.info().name) {
      ws.send(net.renameWire(renameTo));
    }
    render();
  };
  ws.onmessage = (ev: MessageEvent) => {
    if (net === null) return;
    // 纯管道：onText 返回什么就往 socket 里写什么。
    // "凭据被拒之后要改发一条全新的 join"这类决定归 netplay（那里能被无头用例钉住），这里不留分支。
    for (const up of net.onText(String(ev.data))) ws.send(up);
    render();
  };
  ws.onerror = () => {
    linkNote = `连不上 ${url}（房间进程起来了吗？）`;
    render();
  };
  ws.onclose = () => {
    net?.markClosed();
    if (!wantOnline || net === null) return;
    if (retries >= MAX_RETRIES) {
      linkNote = `已重连 ${String(MAX_RETRIES)} 次都不上，停在这里。检查房间进程后点"连接"。`;
      render();
      return;
    }
    retries += 1;
    linkNote = `连接断了，正在第 ${String(retries)} 次重连…`;
    render();
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      if (wantOnline) openSocket(url);
    }, 800 * retries);
  };
}

// 空名字的自动名：玩家-XXXX（XXXX 来自安全随机 + 房间码字母表）。牌桌上认人全靠名字，
// 一桌人都叫"玩家"就分不清谁是谁；而**硬拦空名**在单机态是死路——联机控件组藏着、名字框
// 根本看不见，切一次联机被拦一次（真机实测被抓出来的"进不去联机模式"）⇒ 改为起名放行。
function autoName(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  let tail = '';
  for (const b of buf) tail += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
  return `玩家-${tail}`;
}

function connect(opts: { url: string; name: string; buyIn: number }): string {
  disconnect();
  if (opts.name === '') {
    opts.name = autoName();
    const box = el<HTMLInputElement>('netName');
    if (box !== null) box.value = opts.name; // 回填：玩家看得见自己这回叫什么，下次可改
  }
  if (typeof window.WebSocket !== 'function') return '这个浏览器没有 WebSocket';
  try {
    net = createNet({ name: opts.name, buyIn: opts.buyIn, entropy: browserEntropy, store: tabStore });
  } catch (err) {
    net = null;
    return `拿不到安全随机数，已拒绝连接：${String((err as Error).message)}`;
  }
  wantOnline = true;
  retries = 0;
  mode = 'online';
  syncModeControls();
  linkNote = `正在连 ${opts.url}…`;
  openSocket(opts.url, opts.name);
  render();
  return linkNote;
}

function disconnect(): void {
  wantOnline = false;
  if (retryTimer !== 0) {
    window.clearTimeout(retryTimer);
    retryTimer = 0;
  }
  if (sock !== null) {
    sock.onclose = null;
    sock.onmessage = null;
    sock.onerror = null;
    sock.onopen = null;
    try {
      sock.close();
    } catch {
      // 已经关了
    }
  }
  sock = null;
  net = null;
  linkNote = null;
}

function backToSolo(): void {
  disconnect();
  mode = 'solo';
  syncModeControls();
  render();
}

function syncModeControls(): void {
  document.body.classList.toggle('mode-online', mode === 'online');
  document.body.classList.toggle('mode-solo', mode !== 'online');
  const btn = el<HTMLButtonElement>('netBtn');
  if (btn !== null) btn.textContent = mode === 'online' ? '断开' : '连接';
  const sel = el<HTMLSelectElement>('mode');
  if (sel !== null) sel.value = mode;
}

// 首屏就把默认房间地址填进连接框（工单 §4 M5："端口可配置，默认值写进 UI 连接输入框"）。
// 地址按当前页面自己是从哪儿端出来的一起算：房间进程同时也端页面（netx/serve.ts）。
// M6 起 ?room=房间码 会把默认地址指向那张码桌（大厅页/分享链接就是靠它直达）。
// 端口字面量必须留在本文件（srv/05 钉着 main.ts 与进程横幅两处同说一个默认端口），推导在 netplay。
const DEFAULT_PORT = '8790';

function defaultRoomUrl(): string {
  return roomUrlFrom({ hostname: window.location.hostname, port: window.location.port }, window.location.search, DEFAULT_PORT);
}

// ——————————————————————————— 渲染 ———————————————————————————

// 首次亮牌的座位记一个起始时刻；已经暗下去的（新开一局）清掉，好让下一轮重新翻一次
function armFlips(snap: Snapshot, now: number): void {
  const next: Record<number, number> = {};
  for (const seat of snap.seats) {
    const prev = flipSince[seat.seat];
    if (!seat.hidden) next[seat.seat] = prev ?? now;
  }
  flipSince = next;
}

function hintText(snap: Snapshot): string {
  // 连接层的话（连不上 / 断了 / 名字没填被拦 / 已离桌）优先于一切牌局文案 —— 哪怕页面此刻在单机态：
  // 失败提示只在联机态显示的话，"切联机被拦"就成了一句谁也看不见的悄悄话（真机实测缺陷）。
  if (linkNote !== null) return linkNote;
  if (mode === 'online') {
    const info = net === null ? null : net.info();
    if (info !== null && info.trustLines.length > 0) return info.trustLines.join(' ⏎ ');
    if (linkNote !== null) return linkNote;
    if (info !== null && info.lastReject !== null) return `服务端拒绝：${info.lastReject.why}`;
    if (storeDegraded) return '本浏览器不让页面存东西 ⇒ 刷新后只能重新入座（不会串到别的标签页）';
    return snap.status;
  }
  return ui.lastError ?? (ui.session === null ? '未开局' : `点击 ${String(ui.clicks)} · 被拒 ${String(ui.rejections)}`);
}

function render(): void {
  const canvas = el<HTMLCanvasElement>('board');
  const ctx = canvas?.getContext('2d');
  if (canvas === null || ctx === undefined || ctx === null) return;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const w = Math.max(240, Math.floor(canvas.clientWidth));
  const h = Math.max(240, Math.floor(canvas.clientHeight));
  if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const snap = currentSnapshot();
  const now = clockMs();
  armFlips(snap, now);
  scene = buildScene(snap, w, h, TABLE_STYLE, { now, since: flipSince, duration: FLIP_MS });
  paint(ctx, scene);
  const line = el<HTMLElement>('hint');
  if (line !== null) line.textContent = hintText(snap);
  // 只在"有翻牌在飞"时续帧，落地即停 —— 不做常驻 RAF 循环
  const stillFlipping = Object.values(flipSince).some((since) => now - since < FLIP_MS);
  if (stillFlipping && frameId === 0) {
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      render();
    });
  }
}

function send(intent: Intent): string | null {
  if (mode === 'online') {
    if (net === null) return '还没连上房间';
    // 桌务意图必须在 toMove 之前拦下：它们不是行动（toMove 会返回 null），走的是 netplay 的
    // ready()/begin() 两条桌务上行；顺序写死，别让"联机模式没有这个动作"抢答。
    if (intent.kind === 'ready' || intent.kind === 'begin') {
      if (sock === null || sock.readyState !== 1) return '连接不在，稍后自动重连';
      try {
        sock.send(intent.kind === 'ready' ? net.ready() : net.begin());
      } catch {
        return '连接正在关闭，稍后再试';
      }
      render();
      return null;
    }
    const move = toMove(intent);
    if (move === null) return `联机模式没有"${intent.kind}"这个动作：结算与推进归服务端`;
    const r = net.act(move);
    if (!r.sent) return `没发出去：${r.why ?? '?'}`;
    if (sock === null || sock.readyState !== 1) return '连接不在，稍后自动重连';
    sock.send(r.wire as string);
    render();
    return null;
  }
  ui = drain(dispatch(ui, intent));
  render();
  return null;
}

function boot(): void {
  const canvas = el<HTMLCanvasElement>('board');
  const url = el<HTMLInputElement>('netUrl');
  if (url !== null && url.value === '') url.value = defaultRoomUrl();
  el<HTMLButtonElement>('newGame')?.addEventListener('click', () => {
    ui = drain(start(EMPTY_UI, readOptions()));
    render();
  });
  el<HTMLButtonElement>('netBtn')?.addEventListener('click', () => {
    // 同一个按钮：单机态下它是"连接"，联机态下它是"断开"（页面只有一行控件的竖向预算，见 ui3/04b）
    if (mode === 'online') {
      linkNote = (backToSolo(), '已断开，回到单机模式');
    } else {
      const msg = connect({ url: txt('netUrl', defaultRoomUrl()), name: txt('netName', ''), buyIn: Math.max(1, num('buyIn', 256)) });
      linkNote = msg;
    }
    render();
  });
  // 离桌 ≠ 断开：断开只是掉线（座位保留、托管代打），离桌是把座位还回去（名册除名、凭据作废）。
  // 只在连着的时候有意义；发完就走人，页面回单机。
  // 连接中改名：名字框一变（回车或焦点离开触发 change）立即发 rename —— 座位不动、全桌名册刷新。
  // 真机实测教训：只做"重连时改名"没人找得到（用户的自然动作就是改完框等它变），必须就地生效。
  // 回车再挂一条 keydown 直发：个别 Webview 的"回车提交 change"不可靠（实测就没触发），双路保险；
  // 服务端对同名改名幂等，两条路先后各发一次也不会有副作用。
  const commitRename = (): void => {
    const name = txt('netName', '');
    if (mode !== 'online' || net === null || sock === null || sock.readyState !== 1) return; // 没连着：连接时自然会带上/自动改名
    if (name === '' || name === net.info().name) return;
    try {
      sock.send(net.renameWire(name));
    } catch {
      // 连接正在关：这一次发不出去，重连路径会再补
    }
  };
  el<HTMLInputElement>('netName')?.addEventListener('change', commitRename);
  el<HTMLInputElement>('netName')?.addEventListener('keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') commitRename();
  });
  el<HTMLButtonElement>('leaveBtn')?.addEventListener('click', () => {
    if (mode !== 'online' || net === null || sock === null || sock.readyState !== 1) {
      linkNote = '还没连上，谈不上离桌';
      render();
      return;
    }
    try {
      sock.send(net.leaveWire());
    } catch {
      // 连接已经在关：这一发发不出去也没关系，本地凭据已在 leaveWire 里清掉
    }
    linkNote = (backToSolo(), '已离桌，回到单机模式');
    render();
  });
  el<HTMLSelectElement>('mode')?.addEventListener('change', (ev) => {
    const want = (ev.target as HTMLSelectElement).value === 'online' ? 'online' : 'solo';
    if (want === mode) return;
    if (want === 'solo') {
      backToSolo();
      return;
    }
    // connect 失败（典型：名字没填）时必须**说出来并把控件弹回去**——这条 return 值先前被丢掉，
    // 现象就是"切了联机却毫无反应"，真机实测被当成"进不去联机模式"。
    const msg = connect({
      url: txt('netUrl', defaultRoomUrl()),
      name: txt('netName', ''),
      buyIn: Math.max(1, num('buyIn', 256)),
    });
    if (msg !== null) linkNote = msg;
    syncModeControls(); // 失败时把下拉拨回单机；成功时 connect 自己已同步过，这里幂等
    render();
  });
  canvas?.addEventListener('click', (ev) => {
    const box = canvas.getBoundingClientRect();
    const hit = hitAt(scene, ev.clientX - box.left, ev.clientY - box.top);
    if (hit !== null) {
      const why = send(hit.intent);
      const line = el<HTMLElement>('hint');
      if (why !== null && line !== null) line.textContent = why;
    }
  });
  window.addEventListener('resize', render);
  syncModeControls();
  render();
}

// 自动化钩子：给复审用的只读快照与"发意图"通道，页面自身逻辑不依赖它。
declare global {
  interface Window {
    __zjh3?: {
      snapshot: () => Snapshot;
      status: () => string;
      buttons: () => { text: string; legal: boolean }[];
      hits: () => { id: string; x: number; y: number; w: number; h: number }[];
      click: (intent: Intent) => string;
      newGame: (opts?: Partial<StartOptions>) => string;
      // —— M5 联机侧 ——
      mode: () => string;
      connect: (opts?: { url?: string; name?: string; buyIn?: number }) => string;
      disconnect: () => string;
      netInfo: () => NetInfo | null;
      // 复审探针：把一条"服务端下行"原样灌进那道墙（走的就是 socket.onmessage 那条路径）。
      // 它能证明越界提示真的上了页面，而不是只在测试里 —— 收到的东西照样要过 checkDown + 投影自检。
      feed: (text: string) => string;
    };
  }
}

window.__zjh3 = {
  snapshot: () => currentSnapshot(),
  status: () => currentSnapshot().status,
  buttons: () => currentSnapshot().buttons.map((b) => ({ text: b.text, legal: b.legal })),
  hits: () => scene.hits.map((hh) => ({ id: hh.id, x: hh.rect.x, y: hh.rect.y, w: hh.rect.w, h: hh.rect.h })),
  click: (intent: Intent) => {
    return send(intent) ?? currentSnapshot().status;
  },
  newGame: (opts?: Partial<StartOptions>) => {
    const base = readOptions();
    ui = drain(start(EMPTY_UI, { ...base, ...opts }));
    render();
    return snapshot(ui).status;
  },
  mode: () => mode,
  connect: (o) => {
    const msg = connect({
      url: o?.url ?? el<HTMLInputElement>('netUrl')?.value ?? defaultRoomUrl(),
      name: o?.name ?? txt('netName', ''),
      buyIn: Math.max(1, o?.buyIn ?? num('buyIn', 256)),
    });
    linkNote = msg;
    render();
    return msg;
  },
  disconnect: () => {
    backToSolo();
    return mode;
  },
  netInfo: () => (net === null ? null : net.info()),
  feed: (text: string) => {
    if (net === null) return 'not connected';
    const ups = net.onText(text);
    if (sock !== null && sock.readyState === 1) for (const up of ups) sock.send(up);
    render();
    return net.info().trustLines.join(' ⏎ ') || 'ok';
  },
};

boot();
