// M4 · 超时托管语义（工单 §1「超时」行，2026-09-26 Q4 裁定 = B：自动跟注、付不起才弃）。
// 这一层是引擎侧的单点映射（只在 src/engine/actions.ts 的 timeout 分支），所以断言也钉在引擎上：
// (a) 全员托管必然走到结算且终局是 stall；(b) 付不起的回退成弃牌且不欠款；(c) 明/闷跟价各自正确；
// (d) 托管绝不产生 look / raise / compare 事件；外加可归因性（note 里必须带 timeout 字样）。
import assert from 'node:assert/strict';
import { presets } from '../src/rules.ts';
import { startHand } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { checkAction } from '../src/engine/validate.ts';
import { callPrice } from '../src/engine/state.ts';
import { InvalidActionError } from '../src/engine/validate.ts';
import { CHIPS, config3, hand3 } from './engine-fixtures.ts';
import { note, test } from './harness.ts';

function timeoutUntilEnd(state: GameState, limit = 80): GameState {
  let s = state;
  for (let n = 0; n < limit; n += 1) {
    if (s.phase !== 'betting') return s;
    s = apply(s, { kind: 'timeout', seat: s.turn } as Action);
  }
  throw new Error(`全员托管在 ${String(limit)} 步内没走完（终止性被破坏了）`);
}

test('timeout/01 (a) 全员托管的一手牌必然走完，且终局原因是 stall', () => {
  const s = timeoutUntilEnd(hand3(7));
  assert.equal(s.phase, 'awaitingSettle');
  assert.equal(s.terminal?.reason, 'stall', '§1 终止③（任意注级全员各 ≥3 次行动）必须兜住终止性');
  const notes = s.log.map((e) => e.note);
  assert.ok(notes.some((n) => n.startsWith('timeout→call')), '托管跟注要在日志里留下 timeout 字样');
  assert.equal(s.log.filter((e) => e.note.startsWith('timeout→')).length, 9, '三家各三次行动');
  assert.equal(s.seats.reduce((a, x) => a + x.chips, 0) + s.pot, 3 * CHIPS, '钱不会凭空出现或消失');
});

test('timeout/02 (b) 付不起跟价的那一家回退成弃牌，且不欠款、不出现负筹码', () => {
  // 2 家桌、庄家 0 ⇒ 首行动者是 1 号位；把 1 号位做成"交完底注就身无分文"的那一家
  const poor = startHand({
    rules: presets.classic,
    seed: 11,
    dealer: 0,
    seats: [
      { seat: 0, chips: 100 },
      { seat: 1, chips: presets.classic.ante },
    ],
  });
  assert.equal(poor.turn, 1);
  assert.equal((poor.seats.find((x) => x.seat === 1) as { chips: number }).chips, 0, '底注已付，再无余钱');
  const folded = apply(poor, { kind: 'timeout', seat: 1 });
  // 两人局里弃牌会立刻撞上终止①（只剩一家）⇒ 日志末尾多一条 terminal，托管那条在倒数第二
  assert.equal(folded.log.at(-2)?.type, 'fold');
  assert.equal(folded.log.at(-2)?.note, 'timeout→fold');
  assert.equal(folded.phase, 'awaitingSettle');
  const after = folded.seats.find((x) => x.seat === 1) as { chips: number; committed: number; active: boolean };
  assert.equal(after.chips, 0, '不许出现负筹码');
  assert.equal(after.committed, presets.classic.ante, '除了底注没有再多出一分（全押禁用 ⇒ 不存在欠款）');
  assert.equal(after.active, false);

  // 付不起时：托管与自主弃牌的局面只差 note
  const viaFold = apply(poor, { kind: 'fold', seat: 1 });
  const strip = (s: GameState): string => JSON.stringify({ ...s, log: s.log.map((e) => ({ ...e, note: '' })) });
  assert.equal(strip(folded), strip(viaFold), '付不起时托管 = 弃牌，只差 note');
  assert.equal(viaFold.log.at(-2)?.note, 'fold');
});

test('timeout/03 (c) 已看牌者付明注价、未看牌者付闷注价', () => {
  const dark = hand3(7);
  const seatD = dark.turn;
  const afterDark = apply(dark, { kind: 'timeout', seat: seatD });
  const priceDark = callPrice(dark, seatD);
  assert.equal(priceDark, dark.stake * presets.classic.bet.dark, '闷跟 = 注级 × 1');
  assert.equal(
    (afterDark.seats.find((x) => x.seat === seatD) as { committed: number }).committed -
      (dark.seats.find((x) => x.seat === seatD) as { committed: number }).committed,
    priceDark,
    '托管替未看牌者付的是闷注价',
  );
  assert.equal(afterDark.log.at(-1)?.note, 'timeout→call dark×stake');

  const seen = apply(hand3(7), { kind: 'look', seat: hand3(7).turn });
  const seatS = seen.turn;
  const priceSeen = callPrice(seen, seatS);
  assert.equal(priceSeen, seen.stake * presets.classic.bet.seen, '明跟 = 注级 × 2');
  const afterSeen = apply(seen, { kind: 'timeout', seat: seatS });
  assert.equal(
    (afterSeen.seats.find((x) => x.seat === seatS) as { committed: number }).committed -
      (seen.seats.find((x) => x.seat === seatS) as { committed: number }).committed,
    priceSeen,
  );
  assert.equal(afterSeen.log.at(-1)?.note, 'timeout→call seen×stake');
});

test('timeout/04 (d) 托管不产生 look / raise / compare 事件，也不替玩家看牌', () => {
  const s = timeoutUntilEnd(hand3(3));
  const types = new Set(s.log.map((e) => e.type));
  for (const t of ['look', 'raise', 'compare']) {
    assert.equal(types.has(t as 'look'), false, `托管日志里不该出现 ${t} 事件`);
  }
  assert.equal(s.seats.every((x) => !x.looked), true, '看牌是玩家本人的不可逆选择，托管不得代看');
  assert.deepEqual([...types].sort(), ['call', 'deal', 'terminal'], '全程只有跟注与终局两类事件');
});

test('timeout/05 托管仍是普通行动：同一道 validate，越界照样被拒', () => {
  const s = hand3(5);
  assert.equal(checkAction(s, { kind: 'timeout', seat: s.turn }).ok, true);
  const wrong = s.turn === 0 ? 1 : 0;
  const bad = checkAction(s, { kind: 'timeout', seat: wrong });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.code, 'not_current_turn');
  assert.throws(() => apply(s, { kind: 'timeout', seat: wrong }), InvalidActionError);
  const capped = timeoutUntilEnd(hand3(7));
  assert.equal(checkAction(capped, { kind: 'timeout', seat: 0 }).ok, false, 'awaitingSettle 阶段不许再托管');
});

test('timeout/06 可归因性：玩家自主跟注的 note 里不许出现 timeout', () => {
  const s = hand3(7);
  const selfCall = apply(s, { kind: 'call', seat: s.turn });
  const autoCall = apply(s, { kind: 'timeout', seat: s.turn });
  assert.equal(selfCall.log.at(-1)?.type, 'call');
  assert.equal(autoCall.log.at(-1)?.type, 'call');
  assert.equal(selfCall.log.at(-1)?.note.includes('timeout'), false, '自主跟注不能被误标成托管');
  assert.equal(autoCall.log.at(-1)?.note.includes('timeout'), true, '托管跟注必须可 grep');
  const strip = (x: GameState): string => JSON.stringify({ ...x, log: x.log.map((e) => ({ ...e, note: '', seq: 0 })) });
  assert.equal(strip(selfCall), strip(autoCall), '除 note 之外两条路径的局面完全相同');
  note('timeout/06 托管与自主跟注只差 note：timeout→call seen/dark×stake vs dark×stake');
});
