// M1 引擎 · 投影视图（§4 M1：未公开的牌一律 unknown）—— 这是防作弊/防抓包的那道墙，专门测它。
// rev=4 起口径收紧：本人的牌也要看过（looked）才可见，见 §1 看牌行 + project/01、project/11。
import assert from 'node:assert/strict';
import { test } from './harness.ts';
import { presets } from '../src/rules.ts';
import { startHand } from '../src/engine/state.ts';
import type { Action, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { project } from '../src/engine/project.ts';
import { cardsOf, hand3, script } from './engine-fixtures.ts';

const call = (seat: number): Action => ({ kind: 'call', seat });
const fold = (seat: number): Action => ({ kind: 'fold', seat });
const look = (seat: number): Action => ({ kind: 'look', seat });

const OPEN_TO_ALL = [call(1), call(2), call(0), call(1), call(2), call(0), call(1), call(2), call(0)];

function hiddenCards(state: GameState, viewer: number): { seat: number; cards: string }[] {
  return state.seats
    .filter((s) => s.seat !== viewer && !s.revealed)
    .map((s) => ({ seat: s.seat, cards: JSON.stringify(s.hand) }));
}

test('project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）', () => {
  const s = hand3(1, 0);
  for (const viewer of [0, 1, 2]) {
    const v = project(s, viewer);
    assert.equal(v.seats.find((x) => x.seat === viewer)?.looked, false, '构造前提：开局全是闷牌');
    for (const seat of v.seats) {
      assert.equal(seat.cards, 'unknown', `没点看牌的 viewer=${String(viewer)} 不该看见座位 ${String(seat.seat)}`);
    }
  }
});

test('project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）', () => {
  const s = script(hand3(1, 0), [call(1), call(2), call(0)]);
  for (const viewer of [0, 1, 2]) {
    const text = JSON.stringify(project(s, viewer));
    for (const h of hiddenCards(s, viewer)) {
      assert.ok(!text.includes(h.cards), `viewer=${String(viewer)} 的视图里泄漏了座位 ${String(h.seat)} 的牌`);
    }
  }
});

test('project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown', () => {
  const ended = script(hand3(1, 0), OPEN_TO_ALL);
  assert.equal(ended.phase, 'awaitingSettle');
  const v = project(ended, 0);
  for (const seat of v.seats) {
    if (seat.active) {
      assert.notEqual(seat.cards, 'unknown', `已开牌但座位 ${String(seat.seat)} 还藏着`);
    } else {
      assert.equal(seat.cards, 'unknown');
    }
  }
  // 弃牌者即便牌已被别人"看见"过也不该在视图里露出来：1 号先弃，剩下的打到强制开牌
  const withFold = script(hand3(1, 0), [fold(1), call(2), call(0), call(2), call(0), call(2), call(0)]);
  assert.equal(withFold.terminal?.reason, 'stall');
  const v2 = project(withFold, 0);
  assert.equal(v2.seats.find((x) => x.seat === 1)?.cards, 'unknown');
  assert.equal(v2.seats.find((x) => x.seat === 2)?.cards !== 'unknown', true);
});

test('project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）', () => {
  const opened = script(hand3(1, 0), [call(1), fold(2), call(0)]);
  const after = apply(opened, { kind: 'compare', seat: 1, target: 0 });
  // 用观战视角看：弃牌的 2 号仍然藏牌，开牌的两家都可见
  const v = project(after, 99);
  assert.notEqual(v.seats.find((x) => x.seat === 0)?.cards, 'unknown');
  assert.notEqual(v.seats.find((x) => x.seat === 1)?.cards, 'unknown');
  assert.equal(v.seats.find((x) => x.seat === 2)?.cards, 'unknown', '没进开牌流程的弃牌者仍然藏牌');
  // 2 号弃牌且从未看牌 ⇒ 连它自己也别再想知道自己摸到过什么（§1 看牌行）
  assert.equal(project(after, 2).seats.find((x) => x.seat === 2)?.cards, 'unknown');
  // 它一旦看过牌，弃牌后仍看得见自己那手（revealed 之外的唯一放行口是 looked）
  const peeked = script(hand3(1, 0), [call(1), look(2), fold(2)]);
  assert.equal(peeked.seats.find((x) => x.seat === 2)?.looked, true, '构造前提：2 号看过牌才弃');
  assert.notEqual(project(peeked, 2).seats.find((x) => x.seat === 2)?.cards, 'unknown');
});

test('project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）', () => {
  const s = hand3(1, 0);
  assert.equal(project(s, 0).deal, null);
  const ended = script(s, OPEN_TO_ALL);
  assert.equal(project(ended, 0).deal, null, 'awaitingSettle 还不该给出 seed');
  const settled = apply(ended, { kind: 'settle' });
  assert.deepEqual(project(settled, 0).deal, { seed: 1 });
  assert.ok(JSON.stringify(project(settled, 0)).includes('"seed":1'));
});

test('project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步', () => {
  const seq: Action[] = [{ kind: 'look', seat: 1 }, call(1), call(2), { kind: 'raise', seat: 0 }, call(1)];
  const s = script(hand3(1, 0), seq);
  const v = project(s, 2);
  assert.equal(v.pot, s.pot);
  assert.equal(v.stake, s.stake);
  assert.equal(v.turn, s.turn);
  assert.equal(v.dealer, s.dealer);
  assert.equal(v.phase, s.phase);
  assert.equal(v.seq, s.seq);
  assert.equal(v.seats.length, s.seats.length);
  s.seats.forEach((x, i) => {
    const y = v.seats[i] as (typeof v.seats)[number];
    assert.equal(y.seat, x.seat);
    assert.equal(y.chips, x.chips);
    assert.equal(y.committed, x.committed);
    assert.equal(y.actionsTotal, x.actionsTotal);
    assert.equal(y.actionsAtStake, x.actionsAtStake);
    assert.equal(y.looked, x.looked, '闷/明是公开信息');
    assert.equal(y.active, x.active);
    assert.equal(y.out, x.out);
  });
  assert.equal(v.log.length, s.log.length);
  assert.deepEqual(v.rules, presets.classic);
});

test('project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌', () => {
  const s = script(hand3(1, 0), [call(1), call(2)]);
  for (const viewer of [-1, 99]) {
    const v = project(s, viewer);
    for (const seat of v.seats) assert.equal(seat.cards, 'unknown');
  }
});

test('project/08 视图是拷贝，改它不会污染引擎状态', () => {
  const s = script(hand3(1, 0), [look(1)]);
  const before = JSON.stringify(s);
  const v = project(s, 1);
  v.pot = 99999;
  const own = v.seats.find((x) => x.seat === 1);
  // 必须确认这里真的拿到了数组：门收紧后若仍是 'unknown'，下面那句 push 会被静默跳过，
  // 这条用例就退化成"什么都没测"（同一条断言的 teeth 依赖 looked）
  assert.notEqual(own?.cards, 'unknown', '构造前提没成立：看过牌却仍不可见');
  if (own !== undefined && own.cards !== 'unknown') own.cards.push({ rank: 14, suit: 1 });
  v.seats[0] = { ...v.seats[0] as (typeof v.seats)[number], chips: -1 };
  assert.equal(JSON.stringify(s), before, 'project 返回的视图与 state 共享了可变引用');
});

test('project/09 终局信息公开：赢家集合、份额、余数归属都可投影', () => {
  const ended = script(hand3(1, 0), OPEN_TO_ALL);
  const v = project(ended, 2);
  assert.notEqual(v.terminal, null);
  assert.ok((v.terminal?.winners.length ?? 0) >= 1);
  assert.equal(v.terminal?.shares.reduce((a, b) => a + b, 0), ended.pot);
  const settled = apply(ended, { kind: 'settle' });
  const v2 = project(settled, 2);
  assert.equal(v2.phase, 'settled');
  assert.equal(v2.pot, 0);
  assert.equal(v2.settledSeq, settled.settledSeq);
});

test('project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看', () => {
  const s = startHand(configMixed());
  const v = project(s, 1);
  assert.equal(v.turn, 1, '构造前提：1 号正是首个行动者');
  for (const seat of v.seats) assert.equal(seat.cards, 'unknown');
  const after = project(apply(s, look(1)), 1);
  assert.deepEqual(after.seats.find((x) => x.seat === 1)?.cards, cardsOf(apply(s, look(1)), 1));
  assert.equal(after.seats.find((x) => x.seat === 2)?.cards, 'unknown', '看牌只放开本人，不放开别人');
});

// rev=4 缺陷的防再犯断言：缺陷形态是"本人牌无条件放行"，所以必须整条 view 序列化来搜，
// 只断言 cards 字段是搜不出"从别处漏出去"的那条路的（日志/终局信息同样在 view 里）。
test('project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面', () => {
  const s = script(hand3(1, 0), [call(1), call(2)]); // 游标推到 0 号，0 号始终没点看牌
  const own = cardsOf(s, 0);
  const needle = JSON.stringify(own);
  const before = project(s, 0);
  assert.equal(s.seats.find((x) => x.seat === 0)?.looked, false, '构造前提：0 号还是闷的');
  assert.equal(before.seats.find((x) => x.seat === 0)?.cards, 'unknown');
  assert.ok(!JSON.stringify(before).includes(needle), '未看牌却把本人牌面序列化出去了 —— rev=4 缺陷复发');
  // 看牌只放开本人：别的视角照样看不见 0 号那手（否则"某人看了牌"会变成公共广播）
  assert.equal(project(apply(s, look(0)), 1).seats.find((x) => x.seat === 0)?.cards, 'unknown', '0 号看牌不该让 1 号也看见它');
  assert.equal(project(apply(s, look(0)), 99).seats.find((x) => x.seat === 0)?.cards, 'unknown', '观战同理');
  // 正向对照：看过之后必须搜得到，否则上面那条负向断言是假安全（门焊死也能"通过"）
  const after = project(apply(s, look(0)), 0);
  assert.ok(JSON.stringify(after).includes(needle), '点看牌之后本人牌面却没出现在视图里');
  assert.deepEqual(after.seats.find((x) => x.seat === 0)?.cards, own);
});

test('project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌', () => {
  const ended = script(hand3(1, 0), OPEN_TO_ALL);
  assert.equal(ended.phase, 'awaitingSettle');
  const me = ended.seats.find((x) => x.seat === 0);
  assert.equal(me?.looked, false, '构造前提：全程没人看牌');
  assert.equal(me?.revealed, true, '构造前提：强制开牌已亮牌');
  assert.notEqual(project(ended, 0).seats.find((x) => x.seat === 0)?.cards, 'unknown');
  assert.notEqual(project(ended, 99).seats.find((x) => x.seat === 0)?.cards, 'unknown', '观战视角同理');
});

function configMixed() {
  return {
    rules: presets.classic,
    seed: 42,
    dealer: 0,
    seats: [0, 1, 2, 3, 4].map((seat) => ({ seat, chips: 60 })),
  };
}
