// M4 · 网络层防泄漏与视图收敛。
// 这一档是 M4 最硬的安全断言：不是"投影函数写对了"，而是
// **"任何一条离开服务端的字节里，都读不出你不该读的东西"** —— 用真实牌面反算后逐条扫描。
import assert from 'node:assert/strict';
import { makeDeck, mulberry32, shuffle } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { checkDown, encodeUp } from '../netx/protocol.ts';
import type { Down } from '../netx/protocol.ts';
import { createPeer } from '../netx/client.ts';
import { createRig, driveToSettle, finishHand, stepTimes } from './netx-fixtures.ts';
import type { Rig } from './netx-fixtures.ts';
import { note, test } from './harness.ts';

// 与 src/engine/state.ts 同一条发牌口径：seed + dealer + 座位序 ⇒ 每人三张。
// 这里独立复算一次，正是为了检验"M4 各端能同一 seed 复算同一副牌"那句注释。
function facesOf(seed: number, dealer: number, seated: number[]): Map<number, Card[]> {
  const deck = shuffle(makeDeck(), mulberry32(seed));
  const order = [...seated].sort((a, b) => a - b);
  const startIdx = order.indexOf(dealer);
  const out = new Map<number, Card[]>();
  let cursor = 0;
  for (let step = 1; step <= order.length; step += 1) {
    const seat = order[(startIdx + step) % order.length] as number;
    out.set(seat, [deck[cursor] as Card, deck[cursor + 1] as Card, deck[cursor + 2] as Card]);
    cursor += 3;
  }
  return out;
}

function faceJson(card: Card): string {
  return `{"rank":${String(card.rank)},"suit":${String(card.suit)}}`;
}

function views(msgs: Down[]): (Down & { t: 'view' | 'patch' })[] {
  return msgs.filter((m): m is Down & { t: 'view' | 'patch' } => m.t === 'view' || m.t === 'patch');
}

function downs(rig: Rig, index: number): Down[] {
  return rig.wire().filter((w) => w.dir === 'down' && w.index === index).map((w) => checkDown(w.text));
}

test('leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）', () => {
  const rig = createRig({ seats: 3 });
  [rig.join('甲'), rig.join('乙'), rig.join('丙')];
  finishHand(rig);
  assert.ok(rig.wire().some((w) => w.dir === 'down' && w.text.includes('"t":"reveal"')), '一手牌走完必须有揭示');
  const mine = rig.peers[0]?.viewOf();
  assert.ok(mine !== null && mine !== undefined);
  assert.ok(mine.deal !== null, '结算后本家才看得见种子');
  const seed = mine.deal.seed;
  const seated = rig.info().seated;
  const byDealer = facesOf(seed, mine.dealer, seated);

  // 复算的牌 = 投影亮出的牌（同 seed 可复算，这是 M4 各端能对账的前提）
  for (const seat of seated) {
    const shown: Card[] | 'unknown' | undefined = mine.seats.find((s) => s.seat === seat)?.cards;
    assert.notEqual(shown, 'unknown', '结算之后不该还有 unknown');
    if (shown !== undefined && shown !== 'unknown') {
      assert.deepEqual(
        shown.map(faceJson).sort(),
        (byDealer.get(seat) ?? []).map(faceJson).sort(),
        `${String(seat)} 号位：独立复算与投影亮牌必须逐张相同`,
      );
    }
  }

  // 逐条扫描：某家牌面的 JSON 片段，不许出现在"别人"看到的、且该家还没亮的投影里。
  // （本家看自己的牌是 rev=4 口径允许的，所以按 view.viewer 分流；这一条正是口径的可执行形态。）
  const stream = rig.wire().filter((w) => w.dir === 'down').map((w) => w.text);
  let checked = 0;
  for (const seat of seated) {
    const faces = (byDealer.get(seat) ?? []).map(faceJson);
    for (let i = 0; i < stream.length; i += 1) {
      const text = stream[i] as string;
      const msg = checkDown(text);
      const v = views([msg])[0];
      if (v === undefined || v.view.viewer === seat) continue;
      if (v.view.seats.some((s) => s.seat === seat && s.revealed)) continue;
      for (const needle of faces) {
        assert.ok(!text.includes(needle), `第 ${String(i)} 条下行（viewer=${String(v.view.viewer)}）提前泄露了 ${String(seat)} 号位的 ${needle}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0);
  assert.equal(rig.info().fault, null);
  note(`leak/01 按 seed 独立复算三家的牌面，逐条扫描"别人看到且尚未亮牌"的下行（${String(checked)} 次检查）：零命中`);
});

test('leak/02 种子与各家份额在揭示之前不外泄', () => {
  const rig = createRig({ seats: 4 });
  const idx = [rig.join('甲'), rig.join('乙')];
  const players = rig.info().seated.length; // 第一局只有开局时在桌的那几家
  assert.equal(players, 2);
  finishHand(rig);
  const stream = rig.wire();
  const revealAt = stream.findIndex((w) => w.dir === 'down' && w.text.includes('"t":"reveal"'));
  assert.ok(revealAt > 0);
  const settledAt = stream.findIndex((w) => w.dir === 'down' && w.text.includes('"phase":"settled"'));
  assert.ok(settledAt >= 0 && settledAt < revealAt, '先给结算视图，再给揭示');
  const reveal = checkDown(stream[revealAt]?.text ?? '');
  assert.ok(reveal.t === 'reveal');
  const shares = idx.map((i) => rig.peers[i]?.shareOf() ?? '').filter((s) => s !== '');
  assert.equal(shares.length, players, '每个参与方交一份份额');
  let scanned = 0;
  // 种子：结算视图之前不许出现（引擎口径 project() 就是"settled 才放行 seed"）
  for (let i = 0; i < settledAt; i += 1) {
    const w = stream[i];
    if (w === undefined || w.dir !== 'down') continue;
    scanned += 1;
    assert.ok(!w.text.includes('"seed"'), `第 ${String(i)} 条下行提前出现 seed 字段`);
    assert.ok(!w.text.includes('"deal":{'), `第 ${String(i)} 条下行提前出现 deal 载荷`);
    assert.ok(!w.text.includes(`:${String(reveal.seed)}`), `第 ${String(i)} 条下行提前出现种子数字`);
  }
  // 份额明文：揭示之前不许出现（揭示之后才是"可核对"的公开材料）
  for (let i = 0; i < revealAt; i += 1) {
    const w = stream[i];
    if (w === undefined || w.dir !== 'down') continue;
    for (const share of shares) {
      assert.ok(!w.text.includes(share), `第 ${String(i)} 条下行提前泄露了某家的份额`);
    }
  }
  note(`leak/02 结算视图前扫描 ${String(scanned)} 条下行：种子字段/种子数字零命中；揭示前份额明文零命中`);
});

test('leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界', () => {
  const rig = createRig({ seats: 3 });
  rig.join('甲');
  rig.join('乙');
  const spectator = rig.join('丙'); // 两家已够开局 ⇒ 丙这一局不参与
  finishHand(rig);
  rig.clock.advance(6000); // 局间停顿：第二局开起来，丙这一局上桌
  rig.settle();
  assert.equal(rig.info().hand, 2);
  driveToSettle(rig, 200);
  for (const p of rig.peers) assert.deepEqual(p.info().violations, [], '客户端侧一次越界都不该发现');
  assert.equal(rig.info().fault, null);
  const firstHand = views(downs(rig, spectator)).filter((m) => m.hand === 1);
  assert.ok(firstHand.length > 0, '旁观者也会收到本局投影（公开信息）');
  for (const m of firstHand) {
    assert.ok(!m.view.seats.some((s) => s.seat === spectator), '但投影里没有旁观者的座位');
  }
  const secondHand = views(downs(rig, spectator)).filter((m) => m.hand === 2);
  assert.ok(secondHand.some((m) => m.view.seats.some((s) => s.seat === spectator)), '第二局上桌后才出现');
});

test('leak/04 增量重连与全量快照两条路收敛：日志逐条一致、数字一致', () => {
  const stable = createRig({ seats: 3 });
  const jitter = createRig({ seats: 3 });
  for (const rig of [stable, jitter]) {
    rig.join('甲');
    rig.join('乙');
    rig.join('丙');
  }
  for (let step = 0; step < 8; step += 1) {
    stepTimes(stable, 1);
    stepTimes(jitter, 1);
    const victim = step % 3;
    jitter.drop(victim);
    jitter.reconnect(victim);
  }
  finishHand(stable);
  finishHand(jitter);
  const logs = (rig: Rig): string[] => rig.peers.map((p) => p.logOf().map((e) => `${String(e.seq)}:${e.type}:${String(e.seat)}`).join('|'));
  const a = logs(stable);
  const b = logs(jitter);
  assert.equal(new Set(a).size, 1, '稳定局内三家日志必须一致');
  assert.equal(new Set(b).size, 1, '抖动局内三家日志必须一致');
  assert.equal(a[0], b[0], '抖动重连补齐后的日志与一路稳定的日志逐条相同');
  const nums = (rig: Rig): string[] =>
    rig.peers.map((p) => {
      const v = p.viewOf();
      return v === null ? '' : `${String(v.pot)}|${String(v.stake)}|${v.seats.map((s) => String(s.chips)).join(',')}`;
    });
  assert.equal(new Set(nums(stable)).size, 1);
  assert.equal(new Set(nums(jitter)).size, 1);
  assert.equal(nums(stable)[0], nums(jitter)[0], '权威数字也必须在两条路径上一致');
  for (const p of [...stable.peers, ...jitter.peers]) assert.deepEqual(p.info().violations, []);
  assert.equal(stable.info().fault, null);
  assert.equal(jitter.info().fault, null);
  note('leak/04 抖动重连 8 次之后仍与稳定路径逐条收敛');
});

test('leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动', () => {
  const rig = createRig({ seats: 2 });
  const a = rig.join('甲');
  rig.join('乙');
  const good = rig.peers[a]?.viewOf();
  assert.ok(good !== undefined && good !== null);
  const polluted = {
    ...good,
    seats: good.seats.map((s) =>
      s.seat === 1 ? { ...s, cards: [{ rank: 14, suit: 0 }, { rank: 13, suit: 1 }, { rank: 12, suit: 2 }] } : s,
    ),
  };
  const probe = createPeer({ name: '探针', buyIn: 256, entropy: () => 'abcd1234abcd1234' });
  // 先让探针认领 0 号位（hello 是合法下行），再喂被污染的投影
  probe.inbound(JSON.stringify({ t: 'hello', protocol: 'zjh-m4-1', token: 'a'.repeat(40), seat: 0, name: '探针', rules: good.rules, seats: [] }));
  probe.inbound(JSON.stringify({ t: 'view', hand: 1, seq: good.seq, view: polluted }));
  const info = probe.info();
  assert.equal(info.violations.length, 1, '只该记一次同类违规');
  assert.match(info.violations[0] ?? '', /cards of seat 1/);
  const refused = probe.act({ kind: 'fold' });
  assert.equal(refused.up, null, '发现越界之后拒绝再发任何行动');
  assert.match(refused.why ?? '', /flagged the server/);
});

test('leak/06 上行 nonce 各交一份、互不相同，且承诺里读不出份额', () => {
  const rig = createRig({ seats: 2 });
  rig.join('甲');
  rig.join('乙');
  const nonceUps = rig.wire().filter((w) => w.dir === 'up' && w.text.includes('"t":"nonce"'));
  assert.equal(nonceUps.length, 2, '每家各交一份，不多交');
  const values = nonceUps.map((w) => String((JSON.parse(w.text) as { value: string }).value));
  assert.equal(new Set(values).size, 2, '份额互不相同');
  for (const v of values) assert.match(v, /^[\da-f]{8,}$/);
  const commitLine = rig.wire().find((w) => w.dir === 'down' && w.text.includes('"t":"commit"'));
  assert.ok(commitLine !== undefined);
  const commit = (JSON.parse(commitLine.text) as { commit: string }).commit;
  assert.match(commit, /^[\da-f]{64}$/);
  for (const v of values) assert.ok(!commit.includes(v), '承诺里不许出现份额');
});
