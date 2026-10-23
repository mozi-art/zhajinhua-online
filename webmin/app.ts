// M1.5 · 页面层：只做两件事 —— 把 model 给的字符串画出来，把点击变成意图交给 model。
// 这里**不判任何规则**：按钮可用性来自引擎 legalActions 的投影（intentOptions）；
// 所有候选按钮永远可点，于是"脚本外的非法点击"会真的走到引擎的拒绝路径（验收③）。
import {
  act,
  buttonOptions,
  createSession,
  currentLedgerTotal,
  intentOptions,
  isBotsTurn,
  ledger,
  logRows,
  seatRows,
  settlementRows,
  statusLine,
  stepBots,
  tableTotal,
} from './model.ts';
import type { DealerNextId, Intent, Session } from './model.ts';

let session: Session | null = null;
let note: string | null = null;
let clicks = 0;
let rejections = 0;

// 非法演示用的候选集：比牌必须带具体目标，这里放 -1，正常情况下永远不合法。
// 候选按钮全集（合法 + 灰显非法）由 model.buttonOptions 统一提供 —— M3 的 Canvas UI 用的是同一份，
// 页面层不再自带第二套清单。

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setText(id: string, value: string, cls?: string): void {
  const node = el(id);
  if (node === null) return;
  node.textContent = value;
  if (cls !== undefined) node.className = cls;
}

function num(id: string, fallback: number): number {
  const node = el(id) as HTMLInputElement | null;
  const v = Number(node?.value);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function drainBots(): void {
  if (session === null) return;
  const r = stepBots(session);
  session = r.session;
  if (!r.ok) {
    note = `机器人步进被拒（${r.error}）—— 页面没崩，可继续点`;
    rejections += 1;
  }
}

function dispatch(intent: Intent): void {
  clicks += 1;
  if (session === null) {
    note = '还没开局：先点「开新的一桌」';
    render();
    return;
  }
  const r = act(session, intent);
  session = r.session;
  if (r.ok) {
    note = null;
    drainBots();
  } else {
    note = `已拒绝（${r.error}）：状态未改动，页面可继续操作`;
    rejections += 1;
  }
  render();
}

function newSession(): void {
  const bots = Math.max(0, Math.min(5, num('bots', 2)));
  const buyIn = Math.max(1, num('buyIn', 256));
  const baseSeed = num('seed', 20260925);
  const presetNode = el('preset') as HTMLSelectElement | null;
  const presetName = presetNode?.value === 'a23off' ? 'a23off' : 'classic';
  const dealerNode = el('dealerNext') as HTMLSelectElement | null;
  const rawDealer = dealerNode?.value ?? 'rotate';
  const dealerNext: DealerNextId = rawDealer === 'winner' || rawDealer === 'loser' ? rawDealer : 'rotate';
  try {
    session = createSession({ bots, baseSeed, buyIn, humanSeat: 0, presetName, dealerNext });
    note = null;
    drainBots();
  } catch (err) {
    session = null;
    note = `开桌失败：${String((err as Error).message)}`;
  }
  render();
}

function machineView(): string {
  const s = session;
  const opts = s === null ? [] : intentOptions(s);
  return JSON.stringify(
    {
      started: s !== null,
      handIndex: s?.handIndex ?? 0,
      phase: s?.state.phase ?? 'none',
      pot: s?.state.pot ?? 0,
      stake: s?.state.stake ?? 0,
      turn: s?.state.turn ?? -1,
      humanSeat: s?.humanSeat ?? 0,
      botsTurn: s === null ? false : isBotsTurn(s),
      over: s?.over ?? null,
      clicks,
      rejections,
      ledgerTotal: s === null ? 0 : tableTotal(s),
      liveTotal: s === null ? 0 : currentLedgerTotal(s),
      legalIntents: opts.map((o) => o.intent),
      legalLabels: opts.map((o) => o.label),
      note,
    },
    null,
    1,
  );
}

function renderSeats(): void {
  const box = el('seats');
  if (box === null) return;
  box.textContent = '';
  for (const line of session === null ? [] : seatRows(session)) {
    const div = document.createElement('div');
    div.textContent = line;
    if (line.includes('[你]')) div.className = 'me';
    if (line.includes('弃牌') || line.includes('被淘汰')) div.className = 'dead';
    box.appendChild(div);
  }
}

function addButton(intent: Intent, label: string, isLegal: boolean): void {
  const box = el('actions');
  if (box === null) return;
  const b = document.createElement('button');
  b.textContent = label;
  b.className = isLegal ? 'legal' : 'illegal';
  b.setAttribute('data-kind', intent.kind);
  if (intent.kind === 'compare') b.setAttribute('data-target', String(intent.target));
  b.setAttribute('data-legal', String(isLegal));
  b.addEventListener('click', () => {
    dispatch(intent);
  });
  box.appendChild(b);
}

function renderActions(): void {
  const box = el('actions');
  if (box === null) return;
  box.textContent = '';
  // 合法项在前、非法候选照旧常显（灰虚线）：点了会被引擎拒绝，这正是验收③要能自动验证的路径
  for (const b of buttonOptions(session)) addButton(b.intent, b.text, b.legal);
  const autoBtn = document.createElement('button');
  autoBtn.textContent = '让机器人先走';
  autoBtn.setAttribute('data-kind', 'drain');
  autoBtn.addEventListener('click', () => {
    clicks += 1;
    drainBots();
    render();
  });
  box.appendChild(autoBtn);
}

function render(): void {
  setText('status', session === null ? '未开局。' : statusLine(session));
  setText(
    'ledger',
    session === null
      ? ''
      : `台账：${ledger(session).map((x) => `${x.name}=${String(x.chips)}`).join('  ')} ｜ 在场筹码+池 ${String(tableTotal(session))}（开局瞬间 = 人数×买入，之后必须恒定）`,
  );
  renderSeats();
  renderActions();
  setText('note', note ?? '（无）', note === null ? 'muted' : 'bad');
  const settle = session === null ? [] : settlementRows(session);
  setText('settlement', settle.length === 0 ? '（本局未结束）' : settle.join('\n'), settle.length === 0 ? 'muted' : 'good');
  setText('log', session === null ? '（无）' : logRows(session).join('\n'));
  setText('machine', machineView());
}

// 给浏览器自动化用的钩子：clickIntent 与点按钮走完全相同的一条路（含非法意图）。
declare global {
  interface Window {
    __zjh?: {
      status: () => string;
      machine: () => string;
      seats: () => string[];
      log: () => string[];
      settlement: () => string[];
      legalIntents: () => Intent[];
      clickIntent: (intent: Intent) => string;
      newSession: (opts?: { bots?: number; buyIn?: number; seed?: number; preset?: string; dealer?: string }) => string;
    };
  }
}

window.__zjh = {
  status: () => (session === null ? '未开局。' : statusLine(session)),
  machine: () => machineView(),
  seats: () => (session === null ? [] : seatRows(session)),
  log: () => (session === null ? [] : logRows(session)),
  settlement: () => (session === null ? [] : settlementRows(session)),
  legalIntents: () => (session === null ? [] : intentOptions(session).map((o) => o.intent)),
  clickIntent: (intent: Intent) => {
    dispatch(intent);
    return machineView();
  },
  newSession: (opts?: { bots?: number; buyIn?: number; seed?: number; preset?: string; dealer?: string }) => {
    const set = (id: string, v: number | string | undefined): void => {
      const node = el(id);
      if (node !== null && v !== undefined) (node as HTMLInputElement).value = String(v);
    };
    set('bots', opts?.bots);
    set('buyIn', opts?.buyIn);
    set('seed', opts?.seed);
    set('preset', opts?.preset);
    set('dealerNext', opts?.dealer);
    newSession();
    return machineView();
  },
};

function boot(): void {
  el('newSession')?.addEventListener('click', () => {
    newSession();
  });
  render();
}

boot();
