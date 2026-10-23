// M1 引擎 · 状态机推进（工单 §4 M1）。
// 单一连续循环，没有"下注轮"概念（§2.1）：座位游标只在活跃玩家间前进，
// 结束只由 §1 四类终止条件决定。所有金额进出都走 actionCost / pay 这一条路。
import { compare } from '../cards.ts';
import { actionCost, activeSeats, canAffordCall, nextActiveSeat, seatAt, startHand, withEvent } from './state.ts';
import type { Action, GameState, HandConfig, SeatState } from './state.ts';
import { InvalidActionError, checkAction } from './validate.ts';
import { resolveTerminal, settle } from './settle.ts';
import { revealForTerminal } from './settle.ts';

export { settle };

function pay(state: GameState, seat: number, amount: number): GameState {
  if (!Number.isInteger(amount) || amount < 0) throw new TypeError(`bad amount ${String(amount)}`);
  const seats = state.seats.map((s) =>
    s.seat === seat ? { ...s, chips: s.chips - amount, committed: s.committed + amount } : s,
  );
  return { ...state, seats, pot: state.pot + amount };
}

function bump(state: GameState, seat: number): GameState {
  const seats = state.seats.map((s) =>
    s.seat === seat ? { ...s, actionsTotal: s.actionsTotal + 1, actionsAtStake: s.actionsAtStake + 1 } : s,
  );
  return { ...state, seats };
}

// 行动后的统一收尾：先判终局，未终局才把游标推给下一个活跃座位。
function advance(state: GameState, actor: number): GameState {
  const terminal = resolveTerminal(state);
  if (terminal !== null) {
    const revealed = revealForTerminal(state, terminal);
    const withReveal: GameState = { ...state, seats: revealed, phase: 'awaitingSettle', turn: -1, terminal };
    return withEvent(withReveal, {
      type: 'terminal',
      seat: -1,
      target: -1,
      amount: withReveal.pot,
      stake: withReveal.stake,
      note: `${terminal.reason}:${terminal.winners.join('|')}`,
    });
  }
  const turn = nextActiveSeat(state, actor);
  return { ...state, turn };
}

// 弃牌：玩家自主弃牌，或托管在付不起跟价时的兜底（两者只有 note 不同）。
function doFold(state: GameState, seat: number, note: string): GameState {
  const seats = state.seats.map((s) => (s.seat === seat ? { ...s, active: false, out: 'folded' as const } : s));
  const counted = bump({ ...state, seats }, seat);
  const logged = withEvent(counted, {
    type: 'fold',
    seat,
    target: -1,
    amount: 0,
    stake: state.stake,
    note,
  });
  return advance(logged, seat);
}

// 跟注。noteTag 只用来把"时钟替玩家跟的"与"玩家自己跟的"在日志里分开（Q4 裁定的可归因性要求）。
function doCall(state: GameState, seat: number, noteTag = ''): GameState {
  const cost = actionCost(state, seat, 'call');
  let next = pay(state, seat, cost);
  next = bump(next, seat);
  const mode = seatAt(next, seat).looked ? 'seen' : 'dark';
  next = withEvent(next, {
    type: 'call',
    seat,
    target: -1,
    amount: cost,
    stake: next.stake,
    note: `${noteTag}${mode}×stake`,
  });
  return advance(next, seat);
}

export function apply(state: GameState, action: Action): GameState {
  const verdict = checkAction(state, action);
  if (!verdict.ok) throw new InvalidActionError(action, verdict.code, verdict.why);

  switch (action.kind) {
    case 'settle': {
      return settle(state);
    }
    case 'look': {
      const seats = state.seats.map((s) => (s.seat === action.seat ? { ...s, looked: true } : s));
      return withEvent({ ...state, seats }, {
        type: 'look',
        seat: action.seat,
        target: -1,
        amount: 0,
        stake: state.stake,
        note: '闷→明',
      });
    }
    case 'fold': {
      return doFold(state, action.seat, 'fold');
    }
    case 'timeout': {
      // 工单 §1「超时」行（2026-09-26 Q4 裁定 = B）：托管 = 自动跟注，付不起才弃。
      // 托管绝不 look / raise / 发起 compare；断线与超时同一条路（都从这里走）。
      // 事件类型仍是 call/fold（引擎不新增类型），靠 note 里的 timeout 字样保持可归因。
      if (canAffordCall(state, action.seat)) return doCall(state, action.seat, 'timeout→call ');
      return doFold(state, action.seat, 'timeout→fold');
    }
    case 'call': {
      return doCall(state, action.seat);
    }
    case 'raise': {
      const cost = actionCost(state, action.seat, 'raise');
      const before = state.stake;
      let next = pay(state, action.seat, cost);
      next = bump(next, action.seat);
      const stake = before * 2;
      // §1：加注后**全员**"当前注级行动数"清零（含加注者本人，按字面执行）。
      const seats = next.seats.map((s) => (s.active ? { ...s, actionsAtStake: 0 } : s));
      next = withEvent({ ...next, stake, seats }, {
        type: 'raise',
        seat: action.seat,
        target: -1,
        amount: cost,
        stake,
        note: `stake ${String(before)}→${String(stake)}`,
      });
      return advance(next, action.seat);
    }
    case 'compare': {
      const fee = actionCost(state, action.seat, 'compare');
      const contenders = activeSeats(state).length;
      let next = pay(state, action.seat, fee);
      next = bump(next, action.seat);
      const ch = seatAt(next, action.seat).hand;
      const th = seatAt(next, action.target).hand;
      const cmp = compare(ch, th, next.rules);
      // §1 平局 = 挑战者输；剩两家时比牌 = 直接开牌定胜负（两家牌都亮）
      const challengerLoses = cmp <= 0;
      const loser = challengerLoses ? action.seat : action.target;
      const winner = challengerLoses ? action.target : action.seat;
      const openBoth = contenders === 2;
      const seats = next.seats.map((s): SeatState => {
        if (s.seat === loser) return { ...s, active: false, out: 'eliminated', revealed: openBoth };
        if (s.seat === winner) return openBoth ? { ...s, revealed: true } : s;
        return s;
      });
      next = withEvent({ ...next, seats }, {
        type: 'compare',
        seat: action.seat,
        target: action.target,
        amount: fee,
        stake: next.stake,
        note: `${openBoth ? '开牌' : '比牌'} cmp=${String(cmp)} loser=${String(loser)}${challengerLoses ? '(challenger)' : ''}`,
      });
      return advance(next, action.seat);
    }
    default: {
      const exhausted: never = action;
      return exhausted;
    }
  }
}

// 脚本回放：同 seed + 同 action 序列 ⇒ 同状态（配合 stateHash 做确定性验收）。
export function replay(config: HandConfig, actions: Action[]): GameState {
  let state = startHand(config);
  for (const a of actions) state = apply(state, a);
  return state;
}
