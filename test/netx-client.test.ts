// M4 · 客户端会话（netx/client.ts）—— 一个"不信任服务端"的玩家应当怎么表现。
// 这里的服务端是手工拼出来的：合法消息要驱动到位，越界消息要当场发现并且从此停手。
import assert from 'node:assert/strict';
import { presets } from '../src/rules.ts';
import { startHand } from '../src/engine/state.ts';
import type { Event, GameState } from '../src/engine/state.ts';
import { apply } from '../src/engine/actions.ts';
import { project } from '../src/engine/project.ts';
import type { View } from '../src/engine/project.ts';
import { createPeer } from '../netx/client.ts';
import type { Down } from '../netx/protocol.ts';
import { commitOf, partyOfSeat, seedFromShares, SERVER_PARTY } from '../netx/seed.ts';
import type { Share } from '../netx/seed.ts';
import { counterEntropy } from './netx-fixtures.ts';
import { test } from './harness.ts';

function hand(seatCount = 3, dealer = 0, seed = 987654321): GameState {
  return startHand({
    rules: presets.classic,
    seed,
    dealer,
    seats: Array.from({ length: seatCount }, (_, i) => ({ seat: i, chips: 300 })),
  });
}

// 旁观者那一支要用的形状：**这一手根本没有 0 号位**，而不是"有 0 号位但我把那行删掉"。
// rev=12 必修 1（`checkMoney`）把这件事照出来了：`pot` 是各家 `committed` 之和，
// 删一行而不改 pot 得到的是一条**算术上不可能成立**的投影 ⇒ 诚实房间发不出它，
// 客户端现在抓住它是正确的。原来那条夹具是手工拼错的投影，不是检查太严。
function handWithoutViewer(seed = 987654321): GameState {
  return startHand({
    rules: presets.classic,
    seed,
    dealer: 1,
    seats: [
      { seat: 1, chips: 300 },
      { seat: 2, chips: 300 },
    ],
  });
}

function probe() {
  return createPeer({ name: '探针', buyIn: 256, entropy: counterEntropy(0x0a0b0c0d) });
}

const HELLO: Down = {
  t: 'hello',
  protocol: 'zjh-m4-1',
  token: 'a'.repeat(40),
  seat: 0,
  name: '探针',
  rules: presets.classic,
  seats: [
    { seat: 0, name: '探针' },
    { seat: 1, name: '乙' },
  ],
};

function viewOf(state: GameState, viewer = 0): View {
  return project(state, viewer);
}
const HELLO3: Down = {
  t: 'hello',
  protocol: 'zjh-m4-1',
  token: 'b'.repeat(40),
  seat: 0,
  name: '甲',
  rules: presets.classic,
  seats: [
    { seat: 0, name: '甲' },
    { seat: 1, name: '乙' },
    { seat: 2, name: '丙' },
  ],
};// 增量视图：log 只带 (from, seq] 那一段（与 netx/room.ts 的 patch 出口同形）
function slice(state: GameState, from: number): View {
  return { ...viewOf(state, 0), log: state.log.filter((e) => e.seq > from) };
}

// 故意越界的消息：类型上就不该合法，走 unknown 收口再喂给客户端
function view2(msg: unknown): View {
  return msg as View;
}

function bad(msg: unknown): Parameters<ReturnType<typeof probe>['inbound']>[0] {
  return msg as Parameters<ReturnType<typeof probe>['inbound']>[0];
}

const SERVER_SHARE: Share = { party: SERVER_PARTY, value: '1111aaaa2222bbbb' };

function commitFor(handNo: number, share: Share): { t: 'commit'; hand: number; party: string; commit: string } {
  return { t: 'commit', hand: handNo, party: share.party, commit: commitOf(handNo, share.party, share.value) };
}

test('client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次', () => {
  const p = probe();
  assert.deepEqual(p.inbound(HELLO), []);
  p.inbound({ t: 'commit', hand: 4, party: SERVER_PARTY, commit: 'c'.repeat(64) });
  const replies = p.inbound({ t: 'collect', hand: 4, committed: [SERVER_PARTY], missing: [partyOfSeat(0)] });
  assert.equal(replies.length, 1);
  assert.ok(replies[0]?.t === 'nonce' && replies[0].hand === 4, '应当回一份本局份额');
  const again = p.inbound({ t: 'collect', hand: 4, committed: [SERVER_PARTY], missing: [partyOfSeat(0)] });
  assert.deepEqual(again, [], '同一局不交第二份');
  const other = p.inbound({ t: 'collect', hand: 4, committed: [SERVER_PARTY], missing: [partyOfSeat(1)] });
  assert.deepEqual(other, [], '缺的不是我就什么都不发');
  // 没见到第 5 局的承诺就来收份额 ⇒ 顺序不对：不交，并且发现越界
  const outOfOrder = p.inbound({ t: 'collect', hand: 5, committed: [], missing: [partyOfSeat(0)] });
  assert.deepEqual(outOfOrder, [], '没有承诺就不参与合成');
  assert.match(p.info().violations.join(';'), /collect arrived before the server commitment/);
  p.inbound({ t: 'commit', hand: 5, party: SERVER_PARTY, commit: 'd'.repeat(64) });
  const next = p.inbound({ t: 'collect', hand: 5, committed: [], missing: [partyOfSeat(0)] });
  assert.equal(next.length, 1, '补上承诺之后，换局该重新交一份');
});

test('client/02 行动防呆：只有"轮到我且局面干净"才放行', () => {
  const p = probe();
  assert.equal(p.act({ kind: 'fold' }).up, null, '什么都没收到 ⇒ 不发行动');
  p.inbound(HELLO);
  // 庄家 = 2 号位 ⇒ 首行动者正好是 0 号位（探针自己），"轮到我"才是真实局面
  const st = hand(3, 2);
  assert.equal(st.turn, 0);
  p.inbound({ t: 'view', hand: 1, seq: st.seq, view: viewOf(st, 0) });
  const ok = p.act({ kind: 'fold' });
  assert.deepEqual(ok.up, { t: 'action', hand: 1, move: { kind: 'fold' } }, '轮到我 ⇒ 放行，且上行里没有 seat 字段');
  assert.equal(p.act({ kind: 'compare', target: 0 }).up, null, '不能跟自己比牌');
  const after = apply(st, { kind: 'fold', seat: 0 });
  p.inbound({ t: 'patch', hand: 1, since: st.seq, seq: after.seq, view: slice(after, st.seq) });
  assert.equal(after.turn, 1);
  assert.equal(p.act({ kind: 'call' }).up, null, '不轮到我 ⇒ 拒');
  assert.match(p.act({ kind: 'call' }).why ?? '', /turn is seat 1/);
  const folded = apply(after, { kind: 'fold', seat: 1 });
  const settledState = apply(folded, { kind: 'settle' });
  // since = 客户端此刻的 seq（after.seq），中间两次变化靠一段增量补齐
  p.inbound({ t: 'patch', hand: 1, since: after.seq, seq: settledState.seq, view: slice(settledState, after.seq) });
  assert.equal(p.info().seq, settledState.seq);
  assert.equal(p.info().logLen, settledState.seq, '增量补齐之后日志条数必须等于 seq');
  assert.equal(p.info().phase, 'settled');
  assert.match(p.act({ kind: 'call' }).why ?? '', /phase is settled/, '结算之后不再发行动');
  p.inbound({ t: 'notice', text: '只是提示' });
  assert.deepEqual(p.info().notices, ['只是提示']);
  assert.deepEqual(p.info().violations, []);
});

test('client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续', () => {
  const p = probe();
  p.inbound(HELLO);
  const st = hand(2);
  p.inbound(bad({ t: 'view', hand: 1, seq: st.seq, view: viewOf(st, 0), extra: 1 }));
  assert.match(p.info().violations.join(';'), /unparseable|unknown key/);
  const before = p.info().violations.length;
  p.inbound('{"t":');
  assert.equal(p.info().violations.length, before + 1, '半截 JSON 也算越界');
  assert.equal(p.act({ kind: 'fold' }).up, null, '越界之后不再发任何行动');
});

test('client/04 增量对不上号 ⇒ 不合并并记违规', () => {
  const p = probe();
  p.inbound(HELLO);
  const st = hand(3, 2);
  p.inbound({ t: 'view', hand: 1, seq: st.seq, view: viewOf(st, 0) });
  const st2 = apply(st, { kind: 'fold', seat: 0 });
  p.inbound({ t: 'patch', hand: 1, since: st.seq, seq: st2.seq, view: slice(st2, st.seq) });
  assert.equal(p.info().seq, st2.seq);
  assert.deepEqual(p.info().violations, []);
  // 服务端把我看到的 seq 记错了 ⇒ 这条不合并
  p.inbound({ t: 'patch', hand: 1, since: 99, seq: st2.seq + 1, view: slice(st2, 99) });
  assert.match(p.info().violations.join(';'), /patch claims I am at seq 99/);
  assert.equal(p.info().seq, st2.seq, '对不上号的那条不改动本地状态');
  // 增量里有洞 ⇒ 同样不合并
  const holey = view2({ ...viewOf(st2, 0), seq: st2.seq + 5, log: [{ ...st2.log[st2.log.length - 1], seq: st2.seq + 5 }] });
  p.inbound({ t: 'patch', hand: 1, since: st2.seq, seq: st2.seq + 5, view: holey });
  assert.match(p.info().violations.join(';'), /log starts at seq/);
  assert.equal(p.info().seq, st2.seq);
});

test('client/05 快照的日志有洞 = 不可信', () => {
  const p = probe();
  p.inbound(HELLO);
  const st = hand(2);
  p.inbound(bad({ t: 'view', hand: 1, seq: st.seq, view: { ...viewOf(st, 0), log: [{ ...st.log[0], seq: 2 }] } }));
  assert.match(p.info().violations.join(';'), /log starts at seq 2/);
  p.inbound(bad({ t: 'view', hand: 2, seq: st.seq, view: { ...viewOf(st, 0), log: [] } }));
  assert.match(p.info().violations.join(';'), /log stops before seq|log starts at seq 1/);
});

test('client/06 揭示核对的几类造假都会被当场发现', () => {
  // 让"引擎真正发牌用的种子"就是这批份额合成出来的种子 —— 这才是在线的对账关系
  const stub = probe();
  stub.inbound(HELLO);
  stub.inbound(commitFor(1, SERVER_SHARE));
  stub.inbound({ t: 'collect', hand: 1, committed: [], missing: [partyOfSeat(0)] });
  const mine: Share = { party: partyOfSeat(0), value: stub.shareOf() ?? '' };
  assert.notEqual(mine.value, '');
  const shares = [SERVER_SHARE, mine];
  const seed = seedFromShares(1, shares);
  const st = hand(2, 1, seed);
  const settled = apply(apply(st, { kind: 'fold', seat: st.turn }), { kind: 'settle' });
  assert.equal(settled.seed, seed, '发牌种子 = 合成种子（下面的核对以此为前提）');

  const fresh = () => {
    const p = probe();
    p.inbound(HELLO);
    p.inbound(commitFor(1, SERVER_SHARE));
    p.inbound({ t: 'collect', hand: 1, committed: [], missing: [partyOfSeat(0)] });
    p.inbound({ t: 'view', hand: 1, seq: settled.seq, view: viewOf(settled, 0) });
    return p;
  };
  const honest = fresh();
  honest.inbound({ t: 'reveal', hand: 1, seed, shares });
  assert.deepEqual(honest.info().violations, [], '诚实揭示：承诺打得开、我的份额在场、种子合得上');
  assert.equal(honest.info().verifiedHand, 1);

  const fakeServer = fresh();
  fakeServer.inbound({ t: 'reveal', hand: 1, seed, shares: [{ ...SERVER_SHARE, value: 'deadbeef' }, mine] });
  assert.match(fakeServer.info().violations.join(';'), /does not open its commitment/);

  const fakeMine = fresh();
  fakeMine.inbound({ t: 'reveal', hand: 1, seed, shares: [SERVER_SHARE, { ...mine, value: 'cafebabe00' }] });
  assert.match(fakeMine.info().violations.join(';'), /my own share is not the one/);

  const wrongSeed = fresh();
  wrongSeed.inbound({ t: 'reveal', hand: 1, seed: (seed ^ 0x55) >>> 0, shares });
  assert.match(wrongSeed.info().violations.join(';'), /do not synthesize the revealed seed/);

  const early = fresh();
  const notSettled = apply(st, { kind: 'fold', seat: st.turn });
  early.inbound({ t: 'view', hand: 1, seq: notSettled.seq, view: viewOf(notSettled, 0) });
  early.inbound({ t: 'reveal', hand: 1, seed, shares });
  assert.match(early.info().violations.join(';'), /reveal arrived while the hand is still/);

  const otherHand = fresh();
  otherHand.inbound({ t: 'reveal', hand: 9, seed, shares });
  assert.match(otherHand.info().violations.join(';'), /reveal for hand 9/);
});

test('client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手', () => {
  const p = probe();
  p.inbound(HELLO);
  const st = hand(2);
  p.inbound({ t: 'view', hand: 1, seq: st.seq, view: { ...viewOf(st, 0), deal: { seed: 42 } } });
  assert.match(p.info().violations.join(';'), /seed exposed in phase betting/);
  assert.equal(p.act({ kind: 'call' }).up, null, '发现泄露之后停手');
});

test('client/08 error 分两类：漏牌即停手，普通回执不停手', () => {
  const p = probe();
  p.inbound(HELLO);
  const st = hand(3, 2);
  p.inbound({ t: 'view', hand: 1, seq: st.seq, view: viewOf(st, 0) });
  p.inbound({ t: 'error', code: 'replaced', why: 'another connection took over this seat' });
  assert.equal(p.info().violations.length, 0, '被顶号是连接层的事');
  assert.equal(p.info().errors.length, 1);
  assert.notEqual(p.act({ kind: 'fold' }).up, null, '还能继续行动');
  p.inbound({ t: 'error', code: 'leak_blocked', why: 'cards of seat 1 exposed' });
  assert.match(p.info().violations.join(';'), /blocked its own leak/);
  assert.equal(p.act({ kind: 'fold' }).up, null, '服务端承认漏牌 ⇒ 立刻停手');
});

test('client/09 重连消息带的是"我看到的 hand/seq"，没凭据时不发', () => {
  const p = probe();
  assert.equal(p.resume(), null, '还没拿到 token 就不该有重连消息');
  p.inbound(HELLO);
  const st = hand(2);
  p.inbound({ t: 'view', hand: 3, seq: st.seq, view: viewOf(st, 0) });
  const up = p.resume();
  assert.ok(up !== null && up.t === 'resume');
  assert.equal(up.hand, 3);
  assert.equal(up.since, st.seq);
  assert.equal(up.token, 'a'.repeat(40));
});

test('client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报', () => {
  // 服务端事后完全可以编一组份额，让它自己合成出 reveal 里写的 seed；
  // 唯一能识破的办法是拿它跟"这一局真正发牌用的 seed"（结算视图里的 deal.seed）对账。
  const stub = probe();
  stub.inbound(HELLO);
  stub.inbound(commitFor(1, SERVER_SHARE));
  stub.inbound({ t: 'collect', hand: 1, committed: [], missing: [partyOfSeat(0)] });
  const mine: Share = { party: partyOfSeat(0), value: stub.shareOf() ?? '' };
  const p = probe();
  p.inbound(HELLO);
  p.inbound(commitFor(1, SERVER_SHARE));
  p.inbound({ t: 'collect', hand: 1, committed: [], missing: [partyOfSeat(0)] });
  const dealtWith = 305419896; // 引擎真正用来洗牌的那颗
  const st = hand(2, 1, dealtWith);
  const settled = apply(apply(st, { kind: 'fold', seat: st.turn }), { kind: 'settle' });
  p.inbound({ t: 'view', hand: 1, seq: settled.seq, view: viewOf(settled, 0) });
  const fakeShares = [SERVER_SHARE, mine];
  const fakeSeed = seedFromShares(1, fakeShares);
  assert.notEqual(fakeSeed, dealtWith, '构造前提：这组份额合成的种子 ≠ 真正发牌用的种子');
  p.inbound({ t: 'reveal', hand: 1, seed: fakeSeed, shares: fakeShares });
  assert.match(p.info().violations.join(';'), /not the seed the hand was dealt with/);
  assert.equal(p.info().verifiedHand, null, '没核对通过就不算通过');
});

test('client/10 旁观者的揭示（本局没参与、也没拿到过承诺）不报违规，也不算核对通过', () => {
  const p = probe();
  p.inbound(HELLO);
  // 它是"中途才连上、且这一局不在座"的旁观者：收得到公开投影，但没收到那一份承诺。
  // rev=12 之前这里写的是"拿两手投影再把 0 号位那一行删掉"——那是一条 pot 与 Σcommitted 对不上的
  // **算术上不可能**的投影（诚实房间发不出它），新落地的 `checkMoney` 会当场抓住 ⇒ 改成"这一手本来就没有 0 号位"。
  const st = handWithoutViewer(7);
  p.inbound({ t: 'view', hand: 1, seq: st.log.length, view: viewOf(st, 0) });
  p.inbound({ t: 'reveal', hand: 1, seed: 7, shares: [{ party: SERVER_PARTY, value: 'aaaa1111' }] });
  assert.deepEqual(p.info().violations, [], '无从核对 ⇒ 不谎报违规');
  assert.equal(p.info().verifiedHand, null, '但也不能谎称核对通过');
  // 对照：同一个旁观者如果被塞一条"数字自己都对不上"的投影，那是**注入**，不是无从核对
  const tampered = probe();
  tampered.inbound(HELLO);
  tampered.inbound({ t: 'view', hand: 1, seq: st.log.length, view: { ...viewOf(st, 0), pot: viewOf(st, 0).pot + 100 } });
  assert.ok(tampered.info().violations.length > 0, 'pot 被 +100 必须被抓');
  assert.match(String(tampered.info().violations.at(-1)), /pot/, `越界记录要说清是 pot 对不上：${JSON.stringify(tampered.info().violations)}`);
  assert.equal(tampered.viewOf(), null, '被拒的投影不许被采纳（页面拿不到假数字，而不是拿到再靠渲染层兜）');
});

// ——— 以下是 rev=9 必修 1：承诺存储"每 (hand, party) 写一次"（第二道墙上的洞）———

const S1_SHARE = 'aaaaaaaaaaaaaaaa';
const S1_OTHERS: Share[] = [
  { party: 'seat:1', value: 'bbbbbbbbbbbbbbbb' },
  { party: 'seat:2', value: 'cccccccccccccccc' },
];

// 一组"自我洽"的伪造揭示：份额里换掉服务端的分量，seed 按这组份额重新算 ⇒ 除了承诺对不上，别处都无懈可击
function forgedReveal(handNo: number, serverValue: string, myValue: string): Down {
  const shares: Share[] = [{ party: SERVER_PARTY, value: serverValue }, ...S1_OTHERS, { party: partyOfSeat(0), value: myValue }];
  return { t: 'reveal', hand: handNo, seed: seedFromShares(handNo, shares), shares };
}

function s1Peer(): ReturnType<typeof createPeer> {
  const p = createPeer({ name: '甲', buyIn: 256, entropy: () => S1_SHARE });
  p.inbound(HELLO3);
  return p;
}

test('client/12 收完份额之后改口重发承诺 ⇒ 当场识破，且那份"自洽揭示"随后也过不了（必修 1 主案）', () => {
  const first = '1111111111111111';
  const second = '2222222222222222';
  const p = s1Peer();
  p.inbound({ t: 'commit', hand: 1, party: SERVER_PARTY, commit: commitOf(1, SERVER_PARTY, first) });
  const ups = p.inbound({ t: 'collect', hand: 1, committed: [], missing: ['seat:0', 'seat:1', 'seat:2'] });
  assert.equal(ups.length, 1, '份额被收走的前提：客户端确实交过一份');
  assert.equal(p.shareOf(), S1_SHARE);
  // 恶意服务端：份额到手才改口，换一份承诺，再配一份与新承诺自洽的揭示
  p.inbound({ t: 'commit', hand: 1, party: SERVER_PARTY, commit: commitOf(1, SERVER_PARTY, second) });
  const after = p.info();
  assert.equal(after.violations.length, 1, '改口这一条必须立刻记下来');
  assert.match(after.violations[0] ?? '', /server re-committed a different value for party server in hand 1/);
  assert.deepEqual(after.committed, [SERVER_PARTY], '存储没被覆写：手里留着的还是第一份承诺');
  p.inbound(forgedReveal(1, second, S1_SHARE));
  const info = p.info();
  assert.match(info.violations.join(';'), /does not open its commitment/, '拿旧承诺去开新份额 ⇒ 第二道门也拦住');
  assert.equal(info.verifiedHand, null, '★这一局绝不能记成"已核对通过"');
  assert.equal(p.act({ kind: 'fold' }).up, null, '发现越界 ⇒ 停手');
});

test('client/13 对照组：不改口、只揭示另一个份额 ⇒ 承诺门独立就能抓住（洞在存储，不在核对逻辑）', () => {
  const first = '1111111111111111';
  const second = '2222222222222222';
  const p = s1Peer();
  p.inbound({ t: 'commit', hand: 1, party: SERVER_PARTY, commit: commitOf(1, SERVER_PARTY, first) });
  p.inbound({ t: 'collect', hand: 1, committed: [], missing: ['seat:0'] });
  p.inbound(forgedReveal(1, second, p.shareOf() ?? ''));
  const v = p.info().violations;
  assert.equal(v.length, 1, '只该有一条违规');
  assert.match(v[0] ?? '', /does not open its commitment/);
  assert.equal(p.info().verifiedHand, null);
});

test('client/13b 同值重发承诺要放过（断线补承诺），换局则重新开账', () => {
  const p = s1Peer();
  const commit1 = commitOf(1, SERVER_PARTY, S1_SHARE);
  p.inbound({ t: 'commit', hand: 1, party: SERVER_PARTY, commit: commit1 });
  p.inbound({ t: 'commit', hand: 1, party: SERVER_PARTY, commit: commit1 });
  p.inbound({ t: 'commit', hand: 1, party: SERVER_PARTY, commit: commit1 });
  assert.deepEqual(p.info().violations, [], 'catchup 会补发承诺：room/17、ws/04 依赖这一点，不能误伤');
  // 换局 ⇒ 新的一局本来就该有新的承诺，同一条 party 允许再写
  const commit2 = commitOf(2, SERVER_PARTY, 'bbbbbbb1');
  p.inbound({ t: 'commit', hand: 2, party: SERVER_PARTY, commit: commit2 });
  assert.deepEqual(p.info().violations, []);
  assert.deepEqual(p.info().committed, [SERVER_PARTY], '换局之后手里只留新一局那一份');
  p.inbound({ t: 'commit', hand: 2, party: SERVER_PARTY, commit: commit1 });
  assert.match(p.info().violations.join(';'), /re-committed a different value for party server in hand 2/);
});

test('client/14 别人的承诺混进来仍然算越界（写一次门不改变这一条）', () => {
  const p = s1Peer();
  p.inbound({ t: 'commit', hand: 1, party: 'seat:1', commit: 'e'.repeat(64) });
  assert.match(p.info().violations.join(';'), /a client party seat:1 appeared in a commit message/);
  assert.deepEqual(p.info().committed, [], '非 server 的承诺不进存储');
});

// ——— rev=9 覆盖缺口：logShape 的三道闸门（洞 / 错尾 / 错头）各自可分辨 ———

test('client/15 logShape 三道闸门报错文本互不相同，合法增量则一条不报（移植复审 S9）', () => {
  const p = probe();
  p.inbound(HELLO);
  const st = hand(3, 2);
  p.inbound({ t: 'view', hand: 1, seq: st.seq, view: viewOf(st, 0) });
  assert.deepEqual(p.info().violations, [], '正向对照：合法快照先立住');
  const base = st.seq;
  const last = st.log[st.log.length - 1] as Event;

  // ① 中间有洞：seq 跳号（head 对得上，所以不会撞上"起点"那条）
  const gapped = view2({ ...viewOf(st, 0), seq: base + 4, log: [{ ...last, seq: base + 1 }, { ...last, seq: base + 2 }, { ...last, seq: base + 4 }] });
  p.inbound({ t: 'patch', hand: 1, since: base, seq: base + 4, view: gapped });
  assert.match(p.info().violations.join(';'), /log has a seq gap at /, '洞要指名道姓');

  // ② 尾条 ≠ 信封 seq：整段自己连续，但最后一条对不上信封
  const wrongTail = view2({ ...viewOf(st, 0), seq: base + 3, log: [{ ...last, seq: base + 1 }, { ...last, seq: base + 2 }] });
  p.inbound({ t: 'patch', hand: 1, since: base, seq: base + 3, view: wrongTail });
  assert.match(p.info().violations.join(';'), /log ends at seq /, '错尾要与错头可分辨');

  // ③ 起点接不上：既然给了非空 log，第一条就必须是 since+1
  const wrongHead = view2({ ...viewOf(st, 0), seq: base + 6, log: [{ ...last, seq: base + 5 }, { ...last, seq: base + 6 }] });
  p.inbound({ t: 'patch', hand: 1, since: base, seq: base + 6, view: wrongHead });
  assert.match(p.info().violations.join(';'), /log starts at seq /);

  // ④ view.seq 与信封 seq 打架（client.ts:88）：这道门排在所有检查之前，报错文本自成一体
  const lying = view2({ ...viewOf(st, 0), seq: base + 9, log: [] });
  p.inbound({ t: 'patch', hand: 1, since: base, seq: base + 3, view: lying });
  assert.match(p.info().violations.join(';'), new RegExp(`view\\.seq ${String(base + 9)} != envelope seq ${String(base + 3)}`));

  const texts = new Set(p.info().violations.map((s) => (s.match(/(view\.seq|log has a seq gap|log ends at seq|log starts at seq)/)?.[0] ?? s)));
  assert.equal(texts.size, 4, '四道闸门的报错必须互不相同（否则变异无法分辨命中的是哪一道）');
  assert.equal(p.info().seq, base, '四条全部不合并 ⇒ 本地状态一字未动');

  // ⑤ 合并后条数 ≠ seq（client.ts:95-97）：logShape 三闸 + 信封对账都过了才会走到这里，
  //    而过了前三闸就意味着条数 == seq ⇒ 这道门是"防前面被改坏"的第二层，构造上够不到。
  //    这里用一条快照把本地条数与 seq 拧到不一致是做不到的（快照本身也要过同样的闸），
  //    所以 SELF-REVIEW 里把它记成"按构造恒真"，与 R05/R13 同档。

  // ④ 合法增量对照：连着走两步，一条都不该报
  const q = probe();
  q.inbound(HELLO);
  q.inbound({ t: 'view', hand: 1, seq: st.seq, view: viewOf(st, 0) });
  const s2 = apply(st, { kind: 'fold', seat: st.turn });
  const s3 = apply(s2, { kind: 'fold', seat: s2.turn });
  q.inbound({ t: 'patch', hand: 1, since: s2.seq - 1, seq: s2.seq, view: slice(s2, s2.seq - 1) });
  q.inbound({ t: 'patch', hand: 1, since: s2.seq, seq: s3.seq, view: slice(s3, s2.seq) });
  assert.deepEqual(q.info().violations, [], '合法的连续增量不该被任何一道门误拦');
  assert.equal(q.info().seq, s3.seq);
  assert.equal(q.info().logLen, s3.seq);
});

test('client/16 等待期（hand=0）也能凭 token resume —— hosted 掉线不该被迫重新 join 占新座', () => {
  // 口径改写（保留 ID）：原断言"hand=0 是协议非法值 ⇒ resume 不给"。hosted 流程上线后它成了缺陷 ——
  // 等待期掉线的人只能重新 join ⇒ 旧座位变鬼影 + 多占一座。现在协议允许 hand=0（等待期重连，
  // since 恒 0），与 rev=11 改写 nui/25 同一先例：边界变了，测试跟着边界走。
  const p = probe();
  p.inbound(HELLO);
  assert.equal(p.info().hand, 0, '构造前提：只入座、没开过任何一手');
  const wait = p.resume();
  assert.ok(wait !== null && wait.t === 'resume' && wait.hand === 0 && wait.since === 0, '等待期 resume：hand=0、since=0');
  const st = hand(2);
  p.inbound({ t: 'view', hand: 1, seq: st.seq, view: viewOf(st, 0) });
  const up = p.resume();
  assert.ok(up !== null && up.t === 'resume' && up.hand === 1, '进过一手之后就照常能重连');
});

test('client/17 table 下行：覆盖式存储并在 info() 暴露；auto 房间收不到 ⇒ 恒 null', () => {
  const p = probe();
  assert.equal(p.info().table, null, 'auto 房间没有 table 下行，桌况保持 null');
  p.inbound(HELLO);
  assert.equal(p.info().table, null, 'hello 不携带桌况');
  p.inbound({ t: 'table', host: 2, ready: [2, 4], waiting: true, playing: false });
  assert.deepEqual(p.info().table, { host: 2, ready: [2, 4], waiting: true, playing: false });
  p.inbound({ t: 'table', host: 4, ready: [], waiting: false, playing: true });
  assert.deepEqual(p.info().table, { host: 4, ready: [], waiting: false, playing: true }, '每次全量覆盖，不做增量合并');
  assert.deepEqual(p.info().violations, [], 'table 是纯状态面：不该触发任何越界');
});
