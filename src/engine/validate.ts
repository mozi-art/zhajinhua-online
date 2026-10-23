// M1 引擎 · 合法行动裁定（工单 §4 M1："唯一合法行动裁定入口"）。
// apply() 必须先过这里；任何地方都不允许绕过 checkAction 直接改状态。
import { actionCost, seatAt } from './state.ts';
import type { GameState, SeatState } from './state.ts';
import type { Action } from './state.ts';

export type RejectCode =
  | 'unknown_action'
  | 'phase_not_betting'
  | 'nothing_to_settle'
  | 'bad_seat'
  | 'bad_target'
  | 'seat_not_active'
  | 'not_current_turn'
  | 'already_looked'
  | 'stake_at_max'
  | 'cannot_afford'
  | 'compare_forbidden_before_first_actions';

export type Verdict = { ok: true } | { ok: false; code: RejectCode; why: string };

const ok: Verdict = { ok: true };

function no(code: RejectCode, why: string): Verdict {
  return { ok: false, code, why };
}

function activeOthers(state: GameState, seat: number): SeatState[] {
  return state.seats.filter((s) => s.active && s.seat !== seat);
}

// §1 首圈禁比：存在活跃玩家其本局总行动数 = 0 时，任何人都不得发起比牌。
// 开关取 rules.compare.firstCycleForbidden（规则驱动，不写死）。
function compareBlockedByFirstActions(state: GameState): boolean {
  if (!state.rules.compare.firstCycleForbidden) return false;
  return state.seats.some((s) => s.active && s.actionsTotal === 0);
}

export function checkAction(state: GameState, action: Action): Verdict {
  if (action === null || typeof action !== 'object' || typeof action.kind !== 'string') {
    return no('unknown_action', 'action must be a tagged object');
  }
  if (action.kind === 'settle') {
    if (state.phase === 'settled') return ok; // 幂等：重放已结算的状态不产生任何变动
    if (state.phase !== 'awaitingSettle') return no('nothing_to_settle', `phase=${state.phase}`);
    return ok;
  }
  if (state.phase !== 'betting') {
    return no('phase_not_betting', `phase=${state.phase}, hand already ${state.phase}`);
  }

  const kind = action.kind;
  const seat = 'seat' in action ? action.seat : Number.NaN;
  if (!Number.isInteger(seat) || state.seats.some((s) => s.seat === seat) === false) {
    return no('bad_seat', `seat ${String(seat)} not in this hand`);
  }
  if (seat !== state.turn) {
    return no('not_current_turn', `turn is seat ${String(state.turn)}, not ${String(seat)}`);
  }
  const s = seatAt(state, seat);
  if (!s.active) {
    return no('seat_not_active', `seat ${String(seat)} is ${String(s.out)}`);
  }

  switch (kind) {
    case 'look': {
      if (s.looked) return no('already_looked', `seat ${String(seat)} already looked`);
      return ok;
    }
    case 'fold': {
      return ok;
    }
    case 'timeout': {
      // §1 预留：超时由外部注入成普通行动。M4 语义（2026-09-26 Q4 裁定 = B）= 自动跟注，
      // 付不起才弃牌；映射只在 src/engine/actions.ts 的 timeout 分支这一处，不在这里判断。
      return ok;
    }
    case 'call': {
      if (s.chips < actionCost(state, seat, 'call')) {
        return no('cannot_afford', `need ${String(actionCost(state, seat, 'call'))}, chips=${String(s.chips)}; allIn is forbidden so only fold is legal`);
      }
      return ok;
    }
    case 'raise': {
      if (state.stake >= state.rules.stake.max || state.stake * 2 > state.rules.stake.max) {
        return no('stake_at_max', `stake ${String(state.stake)} cannot double within max ${String(state.rules.stake.max)}`);
      }
      if (s.chips < actionCost(state, seat, 'raise')) {
        return no('cannot_afford', `need ${String(actionCost(state, seat, 'raise'))}, chips=${String(s.chips)}`);
      }
      return ok;
    }
    case 'compare': {
      const target = 'target' in action ? action.target : Number.NaN;
      const wanted = state.seats.find((s) => s.seat === target);
      // 这里不能用 isActive/seatAt：它们对不存在的座位是"配置错误"直接抛，
      // 而一个非法的 target 属于要被拒绝的普通输入，必须走 Verdict 而不是异常。
      if (!Number.isInteger(target) || target === seat || wanted === undefined || !wanted.active) {
        return no('bad_target', `compare target ${String(target)} invalid (self / unknown seat / already out)`);
      }
      if (compareBlockedByFirstActions(state)) {
        return no(
          'compare_forbidden_before_first_actions',
          'some active player has 0 total actions yet (§1 首圈禁比)',
        );
      }
      if (s.chips < actionCost(state, seat, 'compare')) {
        return no('cannot_afford', `compare fee ${String(actionCost(state, seat, 'compare'))} > chips=${String(s.chips)}`);
      }
      return ok;
    }
    default: {
      return no('unknown_action', `unhandled action kind ${String(kind)}`);
    }
  }
}

export class InvalidActionError extends Error {
  code: RejectCode;
  action: Action;

  constructor(action: Action, code: RejectCode, why: string) {
    // action 可能是任意形状（这是"非法输入"路径），所以取 kind 必须防 null
    const kind = typeof action === 'object' && action !== null ? String(action.kind) : String(action);
    super(`illegal action ${kind}: ${why}`);
    this.name = 'InvalidActionError';
    this.code = code;
    this.action = action;
  }
}

// 当前回合座位的可执行动作集合（M2 的 AI 与 M3 的 UI 都从这里取按钮，不自己判规则）。
export function legalActions(state: GameState): Action[] {
  if (state.phase === 'settled') return [];
  if (state.phase === 'awaitingSettle') return [{ kind: 'settle' }];
  const seat = state.turn;
  if (seat < 0) return [];
  const out: Action[] = [];
  const candidates: Action[] = [
    { kind: 'fold', seat },
    { kind: 'timeout', seat },
    { kind: 'call', seat },
    { kind: 'raise', seat },
    { kind: 'compare', seat: seat, target: -1 },
  ];
  if (!seatAt(state, seat).looked) out.push({ kind: 'look', seat });
  for (const c of candidates) {
    if (c.kind === 'compare') {
      for (const t of activeOthers(state, seat)) {
        const probe: Action = { kind: 'compare', seat, target: t.seat };
        if (checkAction(state, probe).ok) out.push(probe);
      }
      continue;
    }
    if (checkAction(state, c).ok) out.push(c);
  }
  return out;
}

export function isLegal(state: GameState, action: Action): boolean {
  return checkAction(state, action).ok;
}
