// M1 引擎 · 投影视图（工单 §4 M1：牌面只在"公开"之后才出这道墙，为 M4 联机做准备）。
// 规则：某张牌对 viewer 可见，当且仅当该座位已 revealed（强制开牌 / 剩两家开牌），
// 或者它是 viewer 自己的座位**且他已经看过牌**（§1 看牌行：看牌是获得自己牌面的唯一途径）。
// 未结算前不泄露 seed —— 否则任何客户端都能用 M0 冻结的确定性洗牌反算出全副牌序。
import type { Card } from '../cards.ts';
import type { Event, GameState, OutReason, Phase, Terminal } from './state.ts';
import type { Rules } from '../rules.ts';

export type ViewSeat = {
  seat: number;
  chips: number;
  active: boolean;
  out: OutReason | null;
  looked: boolean;
  actionsTotal: number;
  actionsAtStake: number;
  committed: number;
  revealed: boolean;
  cards: Card[] | 'unknown';
};

export type View = {
  viewer: number;
  rules: Rules;
  phase: Phase;
  pot: number;
  stake: number;
  turn: number;
  dealer: number;
  seq: number;
  settledSeq: number | null;
  terminal: Terminal | null;
  log: Event[];
  seats: ViewSeat[];
  deal: { seed: number } | null;
};

export function project(state: GameState, viewer: number): View {
  return {
    viewer,
    rules: state.rules,
    phase: state.phase,
    pot: state.pot,
    stake: state.stake,
    turn: state.turn,
    dealer: state.dealer,
    seq: state.seq,
    settledSeq: state.settledSeq,
    terminal: state.terminal,
    log: state.log.map((e) => ({ ...e })),
    seats: state.seats.map((s) => ({
      seat: s.seat,
      chips: s.chips,
      active: s.active,
      out: s.out,
      looked: s.looked,
      actionsTotal: s.actionsTotal,
      actionsAtStake: s.actionsAtStake,
      committed: s.committed,
      revealed: s.revealed,
      cards: s.revealed || (s.seat === viewer && s.looked) ? s.hand.map((c) => ({ ...c })) : 'unknown',
    })),
    deal: state.phase === 'settled' ? { seed: state.seed } : null,
  };
}
