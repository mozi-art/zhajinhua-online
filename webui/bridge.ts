// M3 · UI 与模型之间的唯一通道。
// 层次约束（由 test/webui.test.ts 机检）：本文件只准 import ../webmin/model.ts，
// 不碰 DOM、不碰时钟、不碰随机，也**绝不自己判任何规则** ——
// 合法性来自 model.buttonOptions（上游是引擎 legalActions），牌面来自 model 的投影，金额来自 actionCost。
import {
  act,
  buttonOptions,
  createSession,
  DEALER_NEXT_LABELS,
  ledger,
  logRows,
  seatCells,
  settlementRows,
  settlementSummary,
  revealedHandsLine,
  statusLine,
  stepBots,
  tableTotal,
} from '../webmin/model.ts';
import type { ButtonOption, DealerNextId, Intent, SeatCell, Session } from '../webmin/model.ts';

export type Snapshot = {
  started: boolean;
  status: string;
  handIndex: number;
  pot: number;
  stake: number;
  phase: string;
  turn: number;
  dealer: number;
  humanSeat: number;
  seats: SeatCell[];
  buttons: ButtonOption[];
  log: string[];
  settlement: string[];
  // 结算块要显示的那几行（每家的账改就地印在座位板上）
  settleSummary: string[];
  // 一行"谁亮了什么牌"的正常文本行，画在桌面中央给机器读（见 webmin/model.ts 的注释）
  revealedLine: string;
  ledgerLine: string;
  total: number;
  over: string | null;
  note: string | null;
  dealerRule: string;
};

export type StartOptions = {
  bots: number;
  buyIn: number;
  baseSeed: number;
  presetName: 'classic' | 'a23off';
  dealerNext: DealerNextId;
};

export type Ui = {
  session: Session | null;
  clicks: number;
  rejections: number;
  lastError: string | null;
  history: string[];
};

export const EMPTY_UI: Ui = { session: null, clicks: 0, rejections: 0, lastError: null, history: [] };

export function snapshot(ui: Ui): Snapshot {
  const s = ui.session;
  if (s === null) {
    return {
      started: false,
      status: '未开局。点"开新一桌"。',
      handIndex: 0,
      pot: 0,
      stake: 0,
      phase: 'idle',
      turn: -1,
      dealer: -1,
      humanSeat: 0,
      seats: [],
      buttons: buttonOptions(null),
      log: [],
      settlement: [],
      settleSummary: [],
      revealedLine: '',
      ledgerLine: '',
      total: 0,
      over: null,
      note: ui.lastError,
      dealerRule: DEALER_NEXT_LABELS.rotate,
    };
  }
  return {
    started: true,
    status: statusLine(s),
    handIndex: s.handIndex,
    pot: s.state.pot,
    stake: s.state.stake,
    phase: s.state.phase,
    turn: s.state.turn,
    dealer: s.dealer,
    humanSeat: s.humanSeat,
    seats: seatCells(s),
    buttons: buttonOptions(s),
    log: logRows(s),
    settlement: settlementRows(s),
    settleSummary: settlementSummary(s),
    revealedLine: revealedHandsLine(s),
    ledgerLine: ledger(s)
      .map((x) => `${x.name}=${String(x.chips)}`)
      .join(' '),
    total: tableTotal(s),
    over: s.over,
    note: s.note,
    dealerRule: DEALER_NEXT_LABELS[s.rules.dealer.next] ?? '?',
  };
}

export function start(ui: Ui, opts: StartOptions): Ui {
  try {
    const session = createSession({
      bots: opts.bots,
      buyIn: opts.buyIn,
      baseSeed: opts.baseSeed,
      humanSeat: 0,
      presetName: opts.presetName,
      dealerNext: opts.dealerNext,
    });
    const drained = stepBots(session);
    return {
      ...ui,
      session: drained.session as Session,
      clicks: 0,
      rejections: 0,
      lastError: null,
      history: [`开桌：${String(opts.bots)} 机器人 · 买入 ${String(opts.buyIn)} · 种子 ${String(opts.baseSeed)} · ${opts.presetName} · ${DEALER_NEXT_LABELS[opts.dealerNext] ?? '?'}`],
    };
  } catch (err) {
    return { ...ui, session: null, lastError: `开桌失败：${String((err as Error).message)}` };
  }
}

// 点一下：合法与非法都走同一条 act() 路径 —— 非法由引擎拒绝，UI 只负责把拒绝的话显示出来。
export function dispatch(ui: Ui, intent: Intent): Ui {
  if (ui.session === null) return { ...ui, lastError: '还没开局' };
  const r = act(ui.session, intent);
  if (r.ok) return { ...ui, session: r.session, clicks: ui.clicks + 1, lastError: null };
  return {
    ...ui,
    session: r.session,
    clicks: ui.clicks + 1,
    rejections: ui.rejections + 1,
    lastError: `被引擎拒绝：${r.error}`,
  };
}

// 机器人接力（真人点完后把行动权还给电脑）
export function drain(ui: Ui): Ui {
  if (ui.session === null) return ui;
  const r = stepBots(ui.session);
  if (!r.ok) return { ...ui, lastError: `机器人步进被拒：${r.error}` };
  return { ...ui, session: r.session as Session };
}
