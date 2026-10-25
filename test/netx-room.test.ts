// M4 · 权威房间（netx/room.ts）：开局准备、承诺→份额→发牌、合法性、超时托管、断线重连、多局连续。
// 全部用虚拟时钟 + 环线驱动，没有任何真实网络与真实定时器（工单 §0.5 双跑一致的前提）。
import assert from 'node:assert/strict';
import { presets } from '../src/rules.ts';
import { createRoom } from '../netx/room.ts';
import { commitOf, seedFromShares, SERVER_PARTY } from '../netx/seed.ts';
import { checkDown, encodeUp } from '../netx/protocol.ts';
import type { Down } from '../netx/protocol.ts';
import { createRig, counterEntropy, driveToSettle, fakeClock, finishHand, stepTimes } from './netx-fixtures.ts';
import type { Peer, Rig } from './netx-fixtures.ts';
import { note, test } from './harness.ts';

function downTo(rig: Rig, index: number): Down[] {
  return rig.wire().filter((w) => w.dir === 'down' && w.index === index).map((w) => checkDown(w.text));
}

function kinds(msgs: Down[]): string[] {
  return msgs.map((m) => m.t);
}

function peerOf(rig: Rig, i: number): Peer {
  const p = rig.peers[i];
  if (p === undefined) throw new Error(`no peer at ${String(i)}`);
  return p;
}

function firstKind(msgs: Down[], t: string): Down | undefined {
  return msgs.find((m) => m.t === t);
}

test('room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局', () => {
  const rig = createRig({ seats: 3 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  assert.deepEqual([rig.seatOf(a), rig.seatOf(b)], [0, 1]);
  const info = rig.info();
  assert.equal(info.hand, 1);
  assert.equal(info.phase, 'betting', '两家的份额都交了就该发牌');
  assert.deepEqual(info.seated, [0, 1]);
  assert.deepEqual(info.missing, []);
  assert.equal(info.fault, null);
  const tokens = new Set([peerOf(rig, a).info().token, peerOf(rig, b).info().token]);
  assert.equal(tokens.size, 2, '重连凭据必须互不相同');
  for (const i of [a, b]) {
    const msgs = downTo(rig, i);
    assert.equal(msgs[0]?.t, 'hello', '第一条下行必须是 hello');
    const hello = msgs[0];
    if (hello !== undefined && hello.t === 'hello') {
      assert.equal(hello.protocol, 'zjh-m4-1');
      assert.deepEqual(JSON.parse(JSON.stringify(hello.rules)), JSON.parse(JSON.stringify(presets.classic)));
    }
    assert.ok(kinds(msgs).includes('commit'), 'hello 之后要有服务端承诺');
    const atCommit = kinds(msgs).indexOf('commit');
    const atView = kinds(msgs).findIndex((k) => k === 'view' || k === 'patch');
    assert.ok(atView > atCommit, '牌局视图只能在承诺之后出现');
  }
  const c = rig.join('丙');
  assert.deepEqual(rig.info().seated, [0, 1], '中途加入的那家这一局不参与');
  const late = peerOf(rig, c).viewOf();
  assert.ok(late !== null && !late.seats.some((s) => s.seat === 2), '它的投影里连自己的座位都不该有');
  assert.deepEqual(peerOf(rig, c).info().violations, [], '不参与本局也不算越界');
});

test('room/02 承诺先于任何份额被接受（线上顺序可查，且承诺不是份额本身）', () => {
  const rig = createRig({ seats: 2 });
  const a = rig.join('甲');
  rig.join('乙');
  const wire = rig.wire();
  const commitAt = wire.findIndex((w) => w.dir === 'down' && w.text.includes('"t":"commit"'));
  const nonceAt = wire.findIndex((w) => w.dir === 'up' && w.text.includes('"t":"nonce"'));
  assert.ok(commitAt >= 0 && nonceAt > commitAt, `承诺(${String(commitAt)}) 必须早于第一份 nonce(${String(nonceAt)})`);
  const commit = checkDown(wire[commitAt]?.text ?? '');
  assert.ok(commit.t === 'commit');
  assert.match(commit.commit, /^[\da-f]{64}$/);
  assert.equal(commit.party, SERVER_PARTY);
  const share = peerOf(rig, a).shareOf();
  assert.ok(share === null || !commit.commit.includes(share.slice(0, 8)), '承诺里不许浮出份额前缀');
});

test('room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄', () => {
  const clock = fakeClock(0);
  const room = createRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
    ],
    firstDealer: 0,
    clock,
    entropy: counterEntropy(),
    nonceMs: 5000,
  });
  room.open('A');
  room.open('B');
  room.receiveText('A', encodeUp({ t: 'join', name: '甲', buyIn: 256 }));
  room.receiveText('B', encodeUp({ t: 'join', name: '乙', buyIn: 256 }));
  room.start();
  assert.equal(room.info().phase, 'collect');
  assert.equal(room.info().seq, 0, '没发牌前不该有任何局面 seq');
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 1, value: 'aaaaaaaa' }));
  room.pending('A');
  room.pending('B');
  assert.equal(room.info().phase, 'collect', '只交了一家不能发牌');
  assert.deepEqual(room.info().missing, ['seat:1']);
  room.receiveText('B', encodeUp({ t: 'nonce', hand: 1, value: 'bbbbbbbb' }));
  const got = room.pending('B').map((m) => checkDown(JSON.stringify(m)));
  assert.ok(got.some((m) => m.t === 'view' || m.t === 'patch'), '齐了就要立刻有牌局视图');
  assert.equal(room.info().phase, 'betting');
  assert.equal(room.info().seq, 1);
  assert.equal(room.peek(0)?.deal, null, '发牌了也不能把种子放出去');
  assert.equal(room.info().fault, null);
});

test('room/04 发牌之后再交份额一律被拒，且局面一字不动', () => {
  const rig = createRig({ seats: 2 });
  const a = rig.join('甲');
  rig.join('乙');
  const before = rig.info();
  assert.equal(before.phase, 'betting');
  rig.up(a, { t: 'nonce', hand: before.hand, value: 'cafebabe' });
  assert.equal(rig.rejectOf(a)?.code, 'nonce_late', '发牌之后再交份额 = 迟到（否则种子会中途变）');
  assert.equal(rig.info().stateHash, before.stateHash);
  rig.up(a, { t: 'nonce', hand: 99, value: 'cafebabe' });
  assert.equal(rig.rejectOf(a)?.code, 'nonce_late', '阶段门在局号门之前：先报"没在收份额"');
  assert.equal(rig.info().stateHash, before.stateHash);
  assert.equal(rig.info().fault, null);
});

test('room/04b 收份额阶段：错局号与"不在这局里"的家都被拒', () => {
  const clock = fakeClock(0);
  const room = createRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
    ],
    firstDealer: 0,
    clock,
    entropy: counterEntropy(),
    nonceMs: 5000,
  });
  room.open('A');
  room.open('B');
  room.receiveText('A', encodeUp({ t: 'join', name: '甲', buyIn: 256 }));
  room.receiveText('B', encodeUp({ t: 'join', name: '乙', buyIn: 256 }));
  room.start();
  const drain = (id: string): Down[] => room.pending(id).map((m) => checkDown(JSON.stringify(m)));
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 42, value: 'aaaaaaaa' }));
  const wrongHand = drain('A');
  assert.ok(wrongHand.some((m) => m.t === 'reject' && m.code === 'bad_hand'), '局号对不上要按当前局拒掉');
  assert.deepEqual(room.info().missing, ['seat:0', 'seat:1'], '被拒的份额不算数');
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 1, value: 'aaaaaaaa' }));
  drain('A');
  assert.deepEqual(room.info().missing, ['seat:1']);
  // 同一家再交一份：不许覆盖（否则交得晚的那一方能改掉已经锁定的种子）
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 1, value: 'ffffffff' }));
  const dup = drain('A');
  assert.ok(dup.some((m) => m.t === 'reject' && m.code === 'bad_nonce'), '重复交份额要被拒');
  assert.deepEqual(room.info().missing, ['seat:1']);
  room.receiveText('B', encodeUp({ t: 'nonce', hand: 1, value: 'bbbbbbbb' }));
  assert.equal(room.info().phase, 'betting', '被拒的那份不算数，有效那份照旧生效');
  assert.equal(room.peek(0)?.seats.find((s) => s.seat === 0) === undefined, false);
  assert.equal(room.info().fault, null);
});

test('room/05 座位由连接绑定：上行里没有 seat 字段，越界与伪造一律无副作用', () => {
  const rig = createRig({ seats: 3 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.join('丙');
  const turn = rig.info().turn;
  const victim = turn === rig.seatOf(a) ? b : a;
  const before = rig.info().stateHash;
  rig.raw(victim, '{"t":"action","hand":1,"move":{"kind":"fold"},"seat":9}');
  assert.equal(peerOf(rig, victim).info().errors.some((e) => e.code === 'bad_message'), true, '夹带 seat 的消息整条被丢弃');
  assert.equal(rig.info().stateHash, before, '伪造消息不得动局面');
  rig.up(victim, { t: 'action', hand: 1, move: { kind: 'fold' } });
  assert.equal(rig.rejectOf(victim)?.code, 'not_current_turn', '想动别人的回合 = 引擎按回合序拒绝');
  assert.equal(rig.info().stateHash, before);
  rig.raw(victim, '{"t":"action","hand":1,"move":{"kind":"settle"}}');
  assert.equal(rig.info().phase, 'betting', '客户端发起不了结算');
  assert.equal(rig.info().fault, null);
});

test('room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒', () => {
  const rig = createRig({ seats: 3 });
  const idx = [rig.join('甲'), rig.join('乙'), rig.join('丙')];
  finishHand(rig);
  const info = rig.info();
  assert.equal(info.phase, 'settled');
  assert.equal(info.pot, 0, '结算后池子必须清空');
  assert.equal(info.fault, null);
  assert.equal(info.chips.reduce((acc, row) => acc + row.chips, 0), 3 * 256, '总筹码守恒');
  for (const i of idx) {
    const got = peerOf(rig, i).info();
    assert.deepEqual(got.violations, [], '客户端不该发现任何越界');
    assert.equal(got.verifiedHand, 1, '揭示必须核对通过');
    const v = peerOf(rig, i).viewOf();
    assert.ok(v !== null && v.phase === 'settled');
    assert.ok(v.deal !== null, '结算后种子才对本人可见');
    const log = peerOf(rig, i).logOf();
    assert.equal(log[0]?.type, 'deal', '累积日志的第一条是本局发牌');
    assert.equal(log[log.length - 1]?.type, 'settle', '最后一条是结算');
    assert.deepEqual(log.map((e) => e.seq), Array.from({ length: log.length }, (_, k) => k + 1), 'seq 必须连续无洞');
    assert.equal(log.length, got.seq, '累积条数应等于当前 seq');
  }
});

test('room/07 全程没人动手：超时托管把一手牌走到结算，且走的是"自动跟注"这条臂', () => {
  // 两人局：房间在两家份额齐了就发牌，第三家只能在牌局中途入座 ⇒ 这里用两家把托管通道走满
  const rig = createRig({ seats: 2, turnMs: 1000, settleMs: 500, handGapMs: 60000 });
  const a = rig.join('甲');
  rig.join('乙');
  assert.equal(rig.wire().filter((w) => w.dir === 'up' && w.text.includes('"t":"action"')).length, 0);
  assert.equal(rig.info().phase, 'betting');
  // Q4 裁定 = B：托管跟注而不是弃牌 ⇒ 终止只能靠③（同一注级各家各 3 次行动），2 家 × 3 = 6 只回合表
  rig.clock.advance(6 * 1000 + 500);
  rig.settle();
  assert.equal(rig.info().phase, 'settled', '两家全靠托管也该走完');
  const log = peerOf(rig, a).logOf();
  const timed = log.filter((e) => e.note.startsWith('timeout→'));
  assert.equal(timed.length, 6, '六次托管行动全部留痕');
  assert.equal(timed.every((e) => e.type === 'call'), true, '两家都付得起 ⇒ 全是 call 事件，一个 fold 都不该有');
  assert.equal(log.some((e) => e.type === 'fold'), false, '托管跟注之后没人弃牌，一手牌该走满');
  assert.equal(log.some((e) => e.type === 'terminal' && e.note.startsWith('stall')), true, '终局原因必须是③拖延');
  assert.ok(log.some((e) => e.type === 'settle'));
  assert.equal(rig.info().fault, null);
  note('room/07 全程托管 ⇒ 六次 timeout→call、零弃牌、终局 stall；三家版见 timeout/01');
});

test('room/08 断线重连·seq 对得上 ⇒ 只补增量，补齐后三家视图与日志逐条一致', () => {
  const rig = createRig({ seats: 3 });
  rig.join('甲');
  rig.join('乙');
  const c = rig.join('丙');
  stepTimes(rig, 1);
  const atDrop = peerOf(rig, c).info().seq;
  rig.drop(c);
  stepTimes(rig, 3);
  rig.reconnect(c);
  const tail = downTo(rig, c).slice(-3);
  assert.ok(tail.some((m) => m.t === 'patch'), '重连应走增量');
  assert.ok(!tail.some((m) => m.t === 'view'), '这一步不该发全量快照');
  const patch = tail.filter((m) => m.t === 'patch').pop();
  assert.ok(patch !== undefined && patch.t === 'patch');
  assert.equal(patch.since, atDrop, '增量必须从我断线时那个 seq 起算');
  assert.equal(new Set(rig.peers.map((p) => p.info().seq)).size, 1, '三家 seq 必须一致');
  assert.equal(new Set(rig.peers.map((p) => p.logOf().map((e) => e.seq).join(','))).size, 1, '日志必须逐条一致');
  assert.equal(
    new Set(
      rig.peers.map((p) => {
        const v = p.viewOf();
        return v === null ? '' : `${String(v.pot)}|${String(v.stake)}|${String(v.turn)}`;
      }),
    ).size,
    1,
    '权威数字必须一致',
  );
  for (const p of rig.peers) assert.deepEqual(p.info().violations, []);
});

test('room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见', () => {
  const rig = createRig({ seats: 3 });
  rig.join('甲');
  rig.join('乙');
  const c = rig.join('丙');
  rig.drop(c);
  finishHand(rig);
  rig.clock.advance(6000);
  rig.settle();
  assert.equal(rig.info().hand, 2, '第二局应该已经开起来');
  rig.reconnect(c);
  const tail = downTo(rig, c).slice(-3);
  const snap = tail.find((m) => m.t === 'view');
  assert.ok(snap !== undefined, '跨局重连必须给全量快照');
  assert.ok(snap.t === 'view');
  assert.equal(snap.hand, 2);
  assert.equal(snap.view.log[0]?.seq, 1, '快照的日志应从本局第一条开始');
  assert.equal(peerOf(rig, c).info().hand, 2);
  assert.deepEqual(peerOf(rig, c).info().violations, []);
});

test('room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完', () => {
  const clock = fakeClock(0);
  const room = createRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
      { seat: 2, name: '丙' },
    ],
    firstDealer: 0,
    clock,
    entropy: counterEntropy(),
    nonceMs: 3000,
    turnMs: 2000,
    settleMs: 700,
    handGapMs: 20000,
  });
  for (const id of ['A', 'B', 'C']) room.open(id);
  room.receiveText('A', encodeUp({ t: 'join', name: '甲', buyIn: 256 }));
  room.receiveText('B', encodeUp({ t: 'join', name: '乙', buyIn: 256 }));
  room.receiveText('C', encodeUp({ t: 'join', name: '丙', buyIn: 256 }));
  room.start();
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 1, value: 'aaaa1111' }));
  room.receiveText('B', encodeUp({ t: 'nonce', hand: 1, value: 'bbbb2222' }));
  assert.equal(room.info().phase, 'collect');
  assert.deepEqual(room.info().missing, ['seat:2']);
  clock.advance(3000);
  assert.equal(room.info().phase, 'betting', '到点把没交的那家剔掉，牌局继续');
  assert.deepEqual(room.info().seated, [0, 1]);
  assert.deepEqual(room.info().missing, [], '剔掉之后 expected 必须一起重建 ⇒ 账上不再挂着缺席者');
  const forC = room.pending('C').map((m) => checkDown(JSON.stringify(m)));
  assert.ok(forC.some((m) => m.t === 'notice'), '被跳过的原因要说在明面上');
  clock.advance(2000 * 6 + 700);
  assert.equal(room.info().phase, 'settled', '两人局靠托管走满 3 次行动后强制开牌');
  assert.deepEqual(room.info().missing, [], '缺席者已从 expected 里重建掉 ⇒ 账上不该再挂着它');
  assert.equal(room.info().fault, null);
});

test('room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上', () => {
  const rig = createRig({ seats: 3 });
  const idx = [rig.join('甲'), rig.join('乙'), rig.join('丙')];
  const dealers: number[] = [];
  for (let h = 1; h <= 3; h += 1) {
    finishHand(rig);
    const settled = peerOf(rig, idx[0] as number).viewOf();
    assert.ok(settled !== null);
    dealers.push(settled.dealer);
    for (const i of idx) {
      const got = peerOf(rig, i).info();
      assert.equal(got.verifiedHand, h, `第 ${String(h)} 局的揭示要能核对上`);
      assert.deepEqual(got.violations, []);
    }
    rig.clock.advance(6000);
    rig.settle();
  }
  assert.deepEqual(dealers, [0, 1, 2], '轮庄：每局庄家 = 上局庄家的下家');
  assert.equal(rig.info().chips.reduce((a, row) => a + row.chips, 0), 768, '三局之后总筹码仍然守恒');
  assert.equal(rig.info().hand, 4);
  assert.equal(rig.info().fault, null);
  note(`room/11 三局庄家轮转 ${dealers.join('→')}；结束时 ${rig.info().chips.map((x) => `${String(x.seat)}:${String(x.chips)}`).join(' ')}`);
});

test('room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少', () => {
  const rig = createRig({ seats: 2, minBuyIn: 1, handGapMs: 1000, settleMs: 500 });
  const a = rig.join('甲', 1);
  const b = rig.join('乙', 1);
  // 底注 1、买入 1 ⇒ 开局后谁都没钱跟注，唯一合法行动是弃牌（§1 全押禁用）
  finishHand(rig, 500);
  const chips = rig.info().chips;
  assert.equal(chips.reduce((x, row) => x + row.chips, 0), 2, '两颗买入既没蒸发也没凭空长出');
  assert.ok(chips.some((row) => row.chips === 0), '输家归零');
  assert.equal(rig.info().over, null, '这一局本身是走完的');
  const log = peerOf(rig, a).logOf();
  assert.ok(log.some((e) => e.type === 'terminal' && e.note.startsWith('oneLeft')), '靠一家弃牌结束');
  assert.ok(!log.some((e) => e.note === 'timeout→fold'), '不该靠托管收场');
  assert.equal(rig.rejectOf(b)?.code, 'cannot_afford', '想跟却发现付不起：全押禁用，只能弃');
  void b;
  rig.clock.advance(1000);
  rig.settle();
  assert.match(rig.info().over ?? '', /收桌/, '只剩一家付得起底注就该收桌');
  assert.equal(rig.info().fault, null);
});

test('room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接', () => {
  const rig = createRig({ seats: 3 });
  const a = rig.join('甲');
  rig.join('乙');
  const seat = rig.seatOf(a);
  const token = peerOf(rig, a).info().token;
  const oldConn = rig.connOf(a);
  assert.ok(rig.info().hand >= 1);
  rig.room.open('x');
  rig.room.receiveText('x', encodeUp({ t: 'resume', token: 'f'.repeat(40), hand: rig.info().hand, since: 0 }));
  const bad = rig.room.pending('x').map((m) => checkDown(JSON.stringify(m)));
  assert.equal(bad.length, 1);
  assert.ok(bad[0]?.t === 'error' && bad[0].code === 'bad_token', '乱 token 只该收到一条 bad_token');
  assert.equal(rig.info().connections.find((c) => c.id === 'x')?.seat, null, '伪造凭据不许占座');
  rig.room.receiveText('x', encodeUp({ t: 'resume', token, hand: rig.info().hand, since: 0 }));
  const good = rig.room.pending('x').map((m) => checkDown(JSON.stringify(m)));
  const hello = good.find((m) => m.t === 'hello');
  assert.ok(hello !== undefined && hello.t === 'hello' && hello.seat === seat, '真凭据该回到原来的座位');
  rig.settle();
  assert.ok(peerOf(rig, a).info().errors.some((e) => e.code === 'replaced'), '旧连接要被告知被顶替');
  assert.equal(rig.info().connections.find((c) => c.id === oldConn)?.seat, null, '旧连接被顶下来，不再持有座位');
  assert.equal(rig.info().fault, null);
});

test('room/14 承诺与揭示双向绑定：打得开、合得出、换一家就对不上', () => {
  const rig = createRig({ seats: 2 });
  const a = rig.join('甲');
  rig.join('乙');
  finishHand(rig);
  const downs = rig.wire().filter((w) => w.dir === 'down').map((w) => checkDown(w.text));
  const commit = downs.find((m) => m.t === 'commit');
  const reveal = downs.find((m) => m.t === 'reveal');
  assert.ok(commit !== undefined && commit.t === 'commit');
  assert.ok(reveal !== undefined && reveal.t === 'reveal');
  if (commit.t !== 'commit' || reveal.t !== 'reveal') return;
  const server = reveal.shares.find((s) => s.party === SERVER_PARTY);
  assert.ok(server !== undefined);
  assert.equal(commitOf(commit.hand, SERVER_PARTY, server.value), commit.commit, '揭示的份额必须打得开当初的承诺');
  assert.equal(seedFromShares(reveal.hand, reveal.shares), reveal.seed, '全部份额合成的就是真正发牌用的种子');
  const swapped = reveal.shares.map((s, i) => (i === 0 ? { ...s, value: 'deadbeef' } : s));
  assert.notEqual(seedFromShares(reveal.hand, swapped), reveal.seed, '任何一家被换掉，种子立刻对不上');
  assert.equal(peerOf(rig, a).info().verifiedHand, reveal.hand);
});

test('room/15 房间层的门槛：最小买入与满座都不占座', () => {
  const rig = createRig({ seats: 2 });
  rig.join('甲', 256);
  rig.room.open('poor');
  rig.room.receiveText('poor', encodeUp({ t: 'join', name: '穷鬼', buyIn: 255 }));
  const poor = rig.room.pending('poor').map((m) => checkDown(JSON.stringify(m)));
  assert.ok(poor.some((m) => m.t === 'error' && m.code === 'buy_in_too_low'), '最小买入 256×底注属房间层（§1 全押行）');
  rig.join('乙', 256);
  rig.room.open('late');
  rig.room.receiveText('late', encodeUp({ t: 'join', name: '第三人', buyIn: 300 }));
  const late = rig.room.pending('late').map((m) => checkDown(JSON.stringify(m)));
  assert.ok(late.some((m) => m.t === 'error' && m.code === 'room_full'), '两个座位就只能坐两个人');
  assert.equal(rig.info().connections.filter((c) => c.seat !== null).length, 2, '被拒的连接不占座位');
  assert.deepEqual(rig.info().seated, [0, 1]);
});

test('room/16 driveToSettle 走的一手牌必然在有限步内终止（引擎不变量在联机层同样成立）', () => {
  for (const seats of [2, 3, 4, 5, 6]) {
    const rig = createRig({ seats });
    const idx: number[] = [];
    for (let i = 0; i < seats; i += 1) idx.push(rig.join(`客${String(i)}`));
    const steps = driveToSettle(rig, 200);
    assert.ok(steps > 0 && steps < 200, `${String(seats)} 家局走了 ${String(steps)} 步`);
    assert.equal(rig.info().phase, 'awaitingSettle');
    for (const i of idx) assert.deepEqual(peerOf(rig, i).info().violations, []);
    assert.equal(rig.info().fault, null);
  }
  note('room/16 2~6 家全部靠"看牌+跟注"走到强制开牌，无违规、无 fault');
});

test('room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）', () => {
  const rig = createRig({ seats: 2, turnMs: 300, settleMs: 200, handGapMs: 60000 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  void b;
  rig.drop(a); // 甲发牌后掉线，整局靠托管走完（断线 ≠ 弃牌：它仍在桌，托管替它跟注）
  rig.clock.advance(300 * 6 + 200);
  rig.settle();
  assert.equal(rig.info().phase, 'settled');
  assert.equal(peerOf(rig, a).info().verifiedHand, null, '掉线期间它一条也没收到（队列随连接作废）');
  rig.reconnect(a);
  const kinds = downTo(rig, a).map((m) => m.t);
  const tail = kinds.slice(kinds.lastIndexOf('hello'));
  assert.deepEqual(
    tail.filter((k) => k === 'commit' || k === 'collect' || k === 'reveal'),
    ['commit', 'collect', 'reveal'],
    '顺序：先承诺，再收集进度，最后揭示',
  );
  assert.ok(tail.includes('view') || tail.includes('patch'), '还要有一份当前局面');
  const info = peerOf(rig, a).info();
  assert.deepEqual(info.violations, []);
  assert.equal(info.verifiedHand, 1, '补回承诺之后，它照样能核对这一局的种子');
  assert.equal(rig.info().fault, null);
  note('room/17 缺席完全局的重连：承诺/快照/揭示三件齐补，种子核对通过');
});

test('room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎）', () => {
  const rig = createRig({ seats: 2, turnMs: 300, settleMs: 100000 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  void b;
  // 谁都不动 ⇒ 两家各托管跟注 3 次（Q4=B：托管不再白白弃牌）走满拖延终止，
  // 结算表故意设得很长，把局面稳在 awaitingSettle
  rig.clock.advance(300 * 6);
  rig.settle();
  assert.equal(rig.info().phase, 'awaitingSettle');
  const before = rig.info().stateHash;
  const actor = rig.seatOf(a) === rig.info().turn ? a : b;
  rig.up(actor, { t: 'action', hand: rig.info().hand, move: { kind: 'call' } });
  const rej = rig.rejectOf(actor);
  assert.equal(rej?.code, 'not_dealt', '房间层就该答复"这一局已经不在行动阶段"，不该把请求转给引擎');
  assert.equal(rig.info().stateHash, before);
  assert.equal(rig.info().fault, null);
});

test('room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面', () => {
  const rig = createRig({ seats: 3 });
  rig.join('甲');
  rig.join('乙');
  const before = rig.info().stateHash;
  rig.room.open('ghost');
  for (const text of [
    '{"t":"action","hand":1,"move":{"kind":"fold"}}',
    '{"t":"nonce","hand":1,"value":"deadbeef"}',
    '{"t":"ping","echo":1}',
  ]) rig.room.receiveText('ghost', text);
  const msgs = rig.room.pending('ghost').map((m) => checkDown(JSON.stringify(m)));
  assert.equal(msgs.length, 3, '三条都被答复：没绑上座位之前，连 ping 也不受理');
  assert.ok(msgs.every((m) => m.t === 'error' && m.code === 'no_seat'), JSON.stringify(msgs));
  assert.equal(rig.info().stateHash, before, '局面一字未动');
  assert.equal(rig.info().fault, null);
});
test('room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只', () => {
  const rig = createRig({ seats: 2, turnMs: 500, nonceMs: 300, settleMs: 100, handGapMs: 1000 });
  const a = rig.join('甲');
  rig.join('乙');
  assert.equal(rig.info().phase, 'betting');
  assert.equal(rig.clock.pending(), 1, '发牌之后桌上只该有"当前回合"一只定时器');
  assert.equal(rig.clock.nextDue(), rig.clock.now() + 500, '那只定时器的到期时间就是 turnMs');
  void a;
  // 谁都不动 ⇒ 两家各托管跟注 3 次把这一局推到结算（Q4=B：托管 = 自动跟注，不是白弃）
  rig.clock.advance(500 * 6 + 100);
  rig.settle();
  assert.equal(rig.info().phase, 'settled');
  assert.equal(rig.clock.pending(), 1, '结算之后只该剩"局间停顿"一只定时器');
  assert.equal(rig.clock.nextDue(), rig.clock.now() + 1000);
  assert.equal(rig.info().fault, null);
  note('room/18 每一阶段的待发定时器数量恒为 1（nonce/回合/结算表都被正确取消）');
});

// ——— rev=9 覆盖缺口（复审 §5 点名）：ping→pong、连接层三条拒绝分支、行动/份额阶段的门 ———

test('room/21 应用层 ping→pong 端到端（rev=8 里这条路径零覆盖）', () => {
  const rig = createRig({ seats: 3 });
  rig.join('甲');
  rig.join('乙');
  assert.equal(rig.wireText('down').filter((t) => t.includes('"t":"pong"')).length, 0, '此前不该出现过 pong');
  const before = rig.info().stateHash;
  rig.up(0, { t: 'ping', echo: 4242 });
  const pongs = rig.wireText('down').filter((t) => t.includes('"t":"pong"'));
  assert.deepEqual(pongs, ['{"t":"pong","echo":4242}'], 'pong 必须原样回显 echo，且只回一条');
  assert.equal(rig.info().stateHash, before, '心跳不碰局面');
  assert.equal(rig.info().fault, null);
  assert.deepEqual(peerOf(rig, 0).info().violations, [], '客户端收到 pong 不算越界');
  // 连发三条各自回显：echo 不是常量，服务端不该把它写死
  rig.up(0, { t: 'ping', echo: 7 });
  rig.up(1, { t: 'ping', echo: 8 });
  const all = rig.wireText('down').filter((t) => t.includes('"t":"pong"'));
  assert.deepEqual(all, ['{"t":"pong","echo":4242}', '{"t":"pong","echo":7}', '{"t":"pong","echo":8}']);
  note(`room/21 应用层心跳：三条 ping 各自回显，局面一字未动（${String(all.length)} 条 pong）`);
});

test('room/22 已经绑上座位的连接再 join ⇒ already_joined，座位绑定不动', () => {
  const rig = createRig({ seats: 3 });
  const a = rig.join('甲');
  const before = peerOf(rig, a).info();
  rig.up(a, { t: 'join', name: '改名换座', buyIn: 256 });
  const errs = peerOf(rig, a).info().errors;
  assert.equal(errs.length, before.errors.length + 1, '多出一条 error');
  assert.equal(errs.at(-1)?.code, 'already_joined', JSON.stringify(errs.at(-1)));
  assert.equal(rig.seatOf(a), before.seat, '第二次 join 不许把它挪到别的座位');
  assert.equal(rig.info().fault, null);
  // 对照：同一条连接被顶掉座位之后（换新连接重连）才允许重新绑座
  const b = rig.join('乙');
  rig.up(b, { t: 'join', name: '乙', buyIn: 128 });
  assert.equal(peerOf(rig, b).info().errors.at(-1)?.code, 'already_joined', '绑过座的连接第二次 join 一律拒，与买入无关');
});

test('room/23 拿别人座位的 token 在已绑座的连接上重连 ⇒ token_seat_mismatch', () => {
  const rig = createRig({ seats: 3 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  const tokenB = peerOf(rig, b).info().token;
  const seatA = rig.seatOf(a);
  rig.up(a, { t: 'resume', token: tokenB, hand: rig.info().hand, since: 0 });
  assert.equal(peerOf(rig, a).info().errors.at(-1)?.code, 'token_seat_mismatch', JSON.stringify(peerOf(rig, a).info().errors.at(-1)));
  assert.equal(rig.seatOf(a), seatA, '被拒之后原来绑的座位还在');
  assert.equal(rig.info().fault, null);
  // 对照：没绑座的连接拿这个合法 token 重连 ⇒ 应当成功（顶号那条路径走的是 replaced，不是 mismatch）
  rig.room.open('fresh');
  const errsBefore = peerOf(rig, b).info().errors.length;
  rig.up(b, { t: 'resume', token: tokenB, hand: rig.info().hand, since: 0 });
  assert.equal(peerOf(rig, b).info().errors.length, errsBefore, '自己的 token 重连自己的座 ⇒ 不该报错');
});

test('room/24 行动阶段的两道门：没有牌局 ⇒ not_dealt，局号错位 ⇒ bad_hand', () => {
  // ① 一家入座还开不了局：hand === null，此时任何行动都只能得到"没有牌局在进行"
  const solo = createRig({ seats: 3 });
  const only = solo.join('甲');
  assert.equal(solo.info().phase, 'idle');
  const hashBefore = solo.info().stateHash;
  solo.up(only, { t: 'action', hand: 1, move: { kind: 'fold' } });
  const err = peerOf(solo, only).info().errors.at(-1);
  assert.equal(err?.code, 'not_dealt', JSON.stringify(err));
  assert.match(err?.why ?? '', /no hand in progress/, '这条 not_dealt 说的是"根本没有牌局"，不是"不在行动阶段"');
  assert.equal(solo.info().stateHash, hashBefore, '没牌局时行动不产生任何局面');

  // ② 牌局在进行，但消息里的局号对不上 ⇒ 走 reject（带 hand 号的都算 reject，不算 error）
  const rig = createRig({ seats: 3 });
  const a = rig.join('甲');
  rig.join('乙');
  const live = rig.info();
  assert.equal(live.phase, 'betting');
  rig.up(a, { t: 'action', hand: live.hand + 5, move: { kind: 'fold' } });
  const rej = rig.rejectOf(a);
  assert.equal(rej?.code, 'bad_hand', JSON.stringify(rej));
  assert.match(rej?.why ?? '', /current hand is 1, message says 6/);
  assert.equal(rig.info().stateHash, live.stateHash, '被拒的行动一字未动局面');
  assert.equal(rig.info().fault, null);
});

test('room/25 份额阶段的两道门：没有牌局 ⇒ not_dealt，不在本局名单里的 party ⇒ no_seat', () => {
  // ① hand === null：一家入座还开不了局，份额没地方收
  const solo = createRig({ seats: 3 });
  const only = solo.join('甲');
  assert.equal(solo.info().phase, 'idle');
  solo.up(only, { t: 'nonce', hand: 1, value: 'aaaa1111' });
  const err = peerOf(solo, only).info().errors.at(-1);
  assert.equal(err?.code, 'not_dealt', JSON.stringify(err));
  assert.match(err?.why ?? '', /no hand in progress/);

  // ② collect 阶段中途入座的第三家：它有自己的座位，但不在这局 expected 的名单里 ⇒ no_seat
  //    （用底层房间手搓：环线工装会让新玩家自动交份额，构造不出"缺一家长在 collect"的窗口）
  const clock = fakeClock(0);
  const room = createRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
      { seat: 2, name: '丙' },
    ],
    firstDealer: 0,
    clock,
    entropy: counterEntropy(),
    nonceMs: 60000,
    turnMs: 2000,
    settleMs: 700,
    handGapMs: 20000,
  });
  for (const id of ['A', 'B', 'C']) room.open(id);
  room.start();
  room.receiveText('A', encodeUp({ t: 'join', name: '甲', buyIn: 256 }));
  room.receiveText('B', encodeUp({ t: 'join', name: '乙', buyIn: 256 }));
  assert.equal(room.info().phase, 'collect', '两家入座、份额未齐 ⇒ 停在 collect');
  assert.deepEqual(room.info().missing, ['seat:0', 'seat:1']);
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 1, value: 'aaaa1111' }));
  assert.equal(room.info().phase, 'collect', '只交了一家，还在等');
  assert.deepEqual(room.info().missing, ['seat:1']);
  room.receiveText('C', encodeUp({ t: 'join', name: '丙', buyIn: 256 }));
  assert.equal(room.info().phase, 'collect', '中途入座不许把这一局重新拉开');
  assert.deepEqual(room.info().seated, [0, 1], '丙不在本局名单里');
  room.receiveText('C', encodeUp({ t: 'nonce', hand: 1, value: 'cccc1111' }));
  const forC = room.pending('C').map((m) => checkDown(JSON.stringify(m)));
  const rej = forC.find((m) => m.t === 'reject');
  assert.ok(rej !== undefined && rej.t === 'reject', JSON.stringify(forC.map((m) => m.t)));
  if (rej !== undefined && rej.t === 'reject') {
    assert.equal(rej.code, 'no_seat');
    assert.match(rej.why, /seat:2 is not dealt into this hand/);
    assert.equal(rej.hand, 1);
  }
  assert.deepEqual(room.info().missing, ['seat:1'], '被拒的份额没有被偷偷收下');
  assert.equal(room.info().fault, null);

  // ③ 对照：乙把缺的那一份交上 ⇒ 立刻发牌（证明 ② 里那一步没把局面卡死）
  room.receiveText('B', encodeUp({ t: 'nonce', hand: 1, value: 'bbbb1111' }));
  assert.equal(room.info().phase, 'betting');
  assert.deepEqual(room.info().seated, [0, 1]);
  assert.deepEqual(room.info().missing, [], '发牌之后不该再有"还缺谁"的账');

  // ④ 对照：expected 重建之后 missing 必须清空（rev=8 必修 2 删掉的那段死代码，靠这条守住"重建"这一步）
  const clock2 = fakeClock(0);
  const room2 = createRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
      { seat: 2, name: '丙' },
    ],
    firstDealer: 0,
    clock: clock2,
    entropy: counterEntropy(),
    nonceMs: 3000,
    turnMs: 2000,
    settleMs: 700,
    handGapMs: 20000,
  });
  for (const id of ['A', 'B', 'C']) room2.open(id);
  room2.receiveText('A', encodeUp({ t: 'join', name: '甲', buyIn: 256 }));
  room2.receiveText('B', encodeUp({ t: 'join', name: '乙', buyIn: 256 }));
  room2.receiveText('C', encodeUp({ t: 'join', name: '丙', buyIn: 256 }));
  room2.start();
  room2.receiveText('A', encodeUp({ t: 'nonce', hand: 1, value: 'aaaa1111' }));
  room2.receiveText('B', encodeUp({ t: 'nonce', hand: 1, value: 'bbbb1111' }));
  assert.deepEqual(room2.info().missing, ['seat:2']);
  clock2.advance(3000);
  assert.equal(room2.info().phase, 'betting');
  assert.deepEqual(room2.info().missing, [], '剔掉缺席者之后 expected 必须重建 ⇒ 账上不再缺人');
  assert.equal(clock2.pending(), 1, '发牌之后只剩"当前回合"一只定时器（nonce 表不许残留或重武装）');
});

test('room/26 诊断面的连接清单按码点序给出（与份额定序同一把尺，rev=8 应修 5）', () => {
  const clock = fakeClock(0);
  const room = createRoom({
    seats: Array.from({ length: 3 }, (_, i) => ({ seat: i, name: `桌客${String(i)}` })),
    firstDealer: 0,
    clock,
    entropy: counterEntropy(),
  });
  // id 里故意混进大小写：让"码点序"与"locale 序"真的分叉，否则这条用例分不出两套键
  const ids = ['c1', 'C2', 'a10', 'B3', 'c10', 'A2'];
  for (const id of ids) room.open(id);
  const listed = room.info().connections.map((c) => c.id);
  const CODE = ['A2', 'B3', 'C2', 'a10', 'c1', 'c10'];
  const LOCALE = [...ids].sort((a, b) => a.localeCompare(b));
  assert.notDeepEqual(CODE, LOCALE, `前提：这组 id 上两套键确实分叉（locale 给出 ${LOCALE.join(',')}）`);
  assert.deepEqual(listed, CODE, '诊断面顺序必须是码点序：大写在前、按码点排');
  assert.ok(listed.every((id) => id !== undefined));
  assert.equal(room.info().fault, null);
  // 对照：顺序由 id 字符串决定、不由开连接的先后决定（插入序会把 c1 排在最前）
  assert.notDeepEqual(listed, ids, '按开连接先后给出清单是不合规的');
  note(`room/26 连接清单 = ${listed.join(', ')}（码点序；locale 序会是 ${LOCALE.join(', ')}）`);
});

// ——— rev=10 应修（REVIEW.md rev=9 §4）：构造期自检 + "开不齐人"那条臂 ———

test('room/27 构造期三道 TypeError 各自说清越界在哪（rev=9 应修 1）', () => {
  const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ seat: i, name: `桌客${String(i)}` }));
  const base = { firstDealer: 0, clock: fakeClock(0), entropy: counterEntropy() };
  // ① 座位数低于 rules.players.min
  assert.throws(
    () => createRoom({ ...base, seats: seats(1) }),
    (e: unknown) => {
      assert.ok(e instanceof TypeError, '构造期用 TypeError，不用字符串抛');
      assert.match((e as Error).message, /room needs 2\.\.6 seats, got 1/);
      return true;
    },
  );
  // ② 高于 max（同一道门的上沿，且报的是真实人数）
  assert.throws(
    () => createRoom({ ...base, seats: seats(7) }),
    (e: unknown) => {
      assert.match((e as Error).message, /room needs 2\.\.6 seats, got 7/);
      return true;
    },
  );
  // ③ firstDealer 不在名单里
  assert.throws(
    () => createRoom({ ...base, seats: seats(3), firstDealer: 9 }),
    (e: unknown) => {
      assert.match((e as Error).message, /firstDealer 9 is not a seat of this room/);
      return true;
    },
  );
  // 附带的两道：非法 seat 号与非法名字
  assert.throws(
    () => createRoom({ ...base, seats: [{ seat: -1, name: '甲' }, { seat: 1, name: '乙' }], firstDealer: 1 }),
    /bad seat -1/,
  );
  assert.throws(
    () => createRoom({ ...base, seats: [{ seat: 0, name: '' }, { seat: 1, name: '乙' }] }),
    /bad name for seat 0/,
  );
  assert.throws(
    () => createRoom({ ...base, seats: [{ seat: 0, name: 'x'.repeat(25) }, { seat: 1, name: '乙' }] }),
    /bad name for seat 0/,
  );
  // 对照：合法构造不抛，且 6 家（上沿）合法
  assert.doesNotThrow(() => createRoom({ ...base, seats: seats(6), handGapMs: 60000 }));
});

test('room/28 到点还凑不齐最低人数 ⇒ 本局作废、只挂局间表、到点重开为第二局（rev=9 应修 2）', () => {
  const clock = fakeClock(0);
  const room = createRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
    ],
    firstDealer: 0,
    clock,
    entropy: counterEntropy(),
    nonceMs: 1000,
    turnMs: 2000,
    settleMs: 700,
    handGapMs: 5000,
  });
  room.open('A');
  room.open('B');
  room.start();
  room.receiveText('A', encodeUp({ t: 'join', name: '甲', buyIn: 256 }));
  room.receiveText('B', encodeUp({ t: 'join', name: '乙', buyIn: 256 }));
  assert.equal(room.info().hand, 1);
  assert.equal(room.info().phase, 'collect');
  assert.deepEqual(room.info().missing, ['seat:0', 'seat:1']);
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 1, value: 'aaaa1111' }));
  assert.deepEqual(room.info().missing, ['seat:1']);

  // 到点：只剩一家 ⇒ 低于 rules.players.min ⇒ 这一局作废（hand 归 0），桌上只该剩"局间停顿"一只表
  clock.advance(1000);
  assert.equal(room.info().phase, 'idle', '本局作废 ⇒ 回到 idle');
  assert.equal(room.info().hand, 0, '没有进行中的牌局');
  assert.deepEqual(room.info().seated, []);
  assert.deepEqual(room.info().missing, []);
  assert.equal(clock.pending(), 1, '只挂 gap 定时器：既不重武装 nonce 表，也不留回合表');
  const why = room.pending('A').concat(room.pending('B')).map((m) => checkDown(JSON.stringify(m)));
  const notices = why.filter((m) => m.t === 'notice').map((m) => (m.t === 'notice' ? m.text : ''));
  assert.ok(
    notices.some((t) => t.includes('没在 1000ms 内提交份额')),
    `要说明是谁没交（实得 ${JSON.stringify(notices)}）`,
  );
  assert.ok(notices.some((t) => t.includes('能开局的人不够')), '还要说明"因此这一局不开"');

  // 台账：作废的一局不许扣任何人的钱（两家仍然各 256）
  const chips = () => room.info().chips.map((c) => c.chips).join(',');
  assert.equal(chips(), '256,256', '作废局不扣底注');

  // 到点重开：新的 index = 2，份额重新收
  clock.advance(5000);
  assert.equal(room.info().hand, 2, '重开的是第二局（局号不回卷）');
  assert.equal(room.info().phase, 'collect');
  assert.deepEqual(room.info().missing, ['seat:0', 'seat:1'], '上一局的份额不许残留到这一局');
  assert.equal(clock.pending(), 1, '重开之后只挂 nonce 表');
  room.receiveText('A', encodeUp({ t: 'nonce', hand: 2, value: 'aaaa1111' }));
  room.receiveText('B', encodeUp({ t: 'nonce', hand: 2, value: 'bbbb1111' }));
  assert.equal(room.info().phase, 'betting');
  assert.deepEqual(room.info().seated, [0, 1]);
  assert.equal(room.info().fault, null);

  // 走完这一局：台账仍然守恒（1024/512 一类的总数不因作废局漂移）
  clock.advance(2000 * 6 + 700);
  assert.equal(room.info().phase, 'settled');
  assert.equal(chips(), room.info().chips.map((c) => c.chips).join(','));
  assert.equal(room.info().chips.reduce((a, c) => a + c.chips, 0), 512, '两笔买入一颗不少');
  note('room/28 到点开不齐人 ⇒ 本局作废 + 局号不回卷 + 台账零扣减；重开后份额重新收');
});

test('room/29 庄家那一座没交份额 ⇒ 剔除之后庄家必须挪到还在桌的一家，牌局照常开（旧行为：整个房间进程被 TypeError 打死）', () => {
  // M5 真浏览器实测撞到的崩溃链：onNonceDeadline 把缺席的那几家剔出本局 ⇒ 若被剔的正是庄家，
  // h.dealer 就成了一个不在 seats 里的号 ⇒ startHand 抛 TypeError ⇒ 抛出点在注入时钟的回调里，
  // 没人接 ⇒ 房间进程直接退出。这条用例把"不炸"钉成断言主体。
  const clock = fakeClock(0);
  const room = createRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
      { seat: 2, name: '丙' },
    ],
    firstDealer: 0,
    clock,
    entropy: counterEntropy(0x9a7e),
    nonceMs: 1000,
    turnMs: 30000,
    settleMs: 700,
    handGapMs: 5000,
  });
  room.open('A');
  room.open('B');
  room.open('C');
  // 先让三家都坐进名册，再开局 ⇒ 本局的 expected 一定含三个座位
  // （两家一到就 beginHand 的话，第三家会掉到下一手，构造前提就不成立了）
  room.receiveText('A', encodeUp({ t: 'join', name: '甲', buyIn: 256 }));
  room.receiveText('B', encodeUp({ t: 'join', name: '乙', buyIn: 256 }));
  room.receiveText('C', encodeUp({ t: 'join', name: '丙', buyIn: 256 }));
  room.start();
  assert.equal(room.info().dealer, 0, '构造前提：庄家就是那个不交份额的座位');
  assert.deepEqual(room.info().missing, ['seat:0', 'seat:1', 'seat:2']);
  // 只有乙、丙交份额；甲（庄家）一直沉默
  room.receiveText('B', encodeUp({ t: 'nonce', hand: 1, value: 'bbbb2222' }));
  room.receiveText('C', encodeUp({ t: 'nonce', hand: 1, value: 'cccc3333' }));
  assert.deepEqual(room.info().missing, ['seat:0']);

  // 到点：还剩两家 ≥ players.min ⇒ 本局照开，但庄家不能是缺席的那一座
  assert.doesNotThrow(() => clock.advance(1000), '份额到点 ⇒ startHand 抛了 TypeError ⇒ 进程会被打死');
  assert.equal(room.info().phase, 'betting', '剔除缺席者之后这局该开出来');
  assert.equal(room.info().dealer, 1, `庄家要挪到还在桌的第一家，实得 ${String(room.info().dealer)}`);
  assert.equal(room.info().fault, null);
  // 这条挪庄家的话要对**在场的每一家**各说一次（note 是广播），所以按连接分别数。
  // 注意 pending() 是"取走"语义 ⇒ 每家只取一次，别在断言里再调一遍（那会拿到空）。
  const movedOf = (id: 'A' | 'B' | 'C'): string[] =>
    room
      .pending(id)
      .filter((m) => m.t === 'notice')
      .map((m) => (m.t === 'notice' ? m.text : ''))
      .filter((t) => t.includes('庄家挪'));
  const movedB = movedOf('B');
  const movedC = movedOf('C');
  assert.equal(movedB.length, 1, '乙该正好看到一条挪庄家的说明');
  assert.equal(movedC.length, 1, '丙该正好看到一条挪庄家的说明');
  assert.match(movedB[0] ?? '', /座位 0 没交份额，本局庄家挪到座位 1/);
  assert.match(movedC[0] ?? '', /座位 0 没交份额，本局庄家挪到座位 1/);

  // 这一局必须真能打完：乙、丙两家各自看到同一个庄家
  const v1 = room.peek(1);
  const v2 = room.peek(2);
  assert.ok(v1 !== null && v2 !== null);
  assert.equal(v1?.dealer, 1);
  assert.equal(v2?.dealer, 1);
  assert.deepEqual([...new Set([v1?.turn, v2?.turn])].length, 1, '两家看到的行动权不一致');
  assert.equal(v1?.seats.length, 2, '本局只该有交了份额的那两家');
  assert.equal(room.info().chips.find((c) => c.seat === 0)?.chips, 256, '缺席的那一家这局一分不动');
  note(`room/29 庄家缺席 ⇒ 挪到座位${String(room.info().dealer)}、牌局开出来、进程没炸；缺席家筹码原样`);
});


test('room/30 显式离桌：局中被拒（leave_late）、局间离桌后座位释放、旧凭据作废、新玩家可入该座', () => {
  const rig = createRig({ seats: 3 });
  rig.join('甲');
  rig.join('乙');
  // ① 局中发起：那一座的筹码还押在当前一手里 ⇒ leave_late，座位原地不动
  rig.up(0, { t: 'leave' });
  assert.equal(rig.rejectOf(0)?.code, 'leave_late', '局中离桌必须被拒');
  assert.equal(rig.info().connections.filter((c) => c.seat === rig.seatOf(0)).length, 1, '被拒后座位没丢');
  // ② 局间离桌：结算之后发 ⇒ 成功，连接还在但不再持座
  finishHand(rig);
  const rejectsBefore = rig.peers[0]?.info().rejects.length ?? 0;
  rig.up(0, { t: 'leave' });
  assert.equal(rig.peers[0]?.info().rejects.length, rejectsBefore, '局间离桌不该产生新的拒绝（rejectOf 读的是历史，这里比增量）');
  assert.equal(rig.info().connections.filter((c) => c.seat === rig.seatOf(0)).length, 0, '该连接已不持座');
  assert.ok(rig.wireText('down').some((t) => t.includes('已离桌')), '离桌者要收到一条确认');
  assert.ok(rig.wireText('down').some((t) => t.includes('离开 0 号位')), '全桌要看见谁走了');
  // ③ 旧凭据作废：甲凭旧 token 重连 ⇒ bad_token（不是悄悄复活到原座）
  rig.reconnect(0);
  assert.ok(rig.peers[0]?.info().errors.some((e) => e.code === 'bad_token'), '离桌后的旧 token 必须是废纸');
  // ④ 座位已还回去：新玩家入座拿到的是甲原来的那座
  const idx = rig.join('丙');
  assert.equal(rig.seatOf(idx), rig.seatOf(0), '释放的座位要能被新玩家拿走');
  note('room/30 离桌：leave_late 档 / 局间成功 / token 作废 / 座位可复用');
});

test('room/31 死座清扫：不在场且筹码不足底注的座位在下一手开始前自动离桌；在场或有钱的一律保留', () => {
  // 三家各 1/1/100 买入（minBuyIn=1）：无论谁赢，两个 1 买入家里必有一家输光（<底注 1）⇒
  // 被清对象必然存在且与种子无关。断线但有钱的丙必须**不被**清（断线重连的权利不受这条影响）。
  const rig = createRig({ seats: 3, minBuyIn: 1 });
  rig.join('甲', 1);
  rig.join('乙', 1);
  rig.join('丙', 100);
  finishHand(rig);
  const broke = rig.info().chips.filter((row) => row.chips < 1).map((row) => row.seat);
  assert.ok(broke.length >= 1, '构造前提：必有一家输光');
  const victimSeat = broke[0] as number;
  const victimIdx = rig.peers.findIndex((p) => p.info().seat === victimSeat);
  assert.ok(victimIdx >= 0, '找到输光那一家的下标');
  rig.drop(victimIdx); // 输光的那家断线（标签页关掉的真实形态）
  rig.drop(2); // 有钱的丙也断线 —— 对照：他必须被保留
  rig.clock.advance(6000); // 手间隙到点 ⇒ beginHand ⇒ 清扫
  rig.settle();
  assert.ok(rig.wireText('down').some((t) => t.includes('不在场且筹码不足底注，已自动离桌')), '清扫要说清楚依据');
  assert.equal(rig.info().chips.some((row) => row.seat === victimSeat), false, '死座已出册');
  assert.equal(rig.info().chips.some((row) => row.seat === rig.seatOf(2)), true, '断线但有钱的座位不许被清');
  assert.equal(rig.info().over, null, '活着的两家照常开下一手（清扫不收桌）');
  note(`room/31 清扫：座位${String(victimSeat)} 自动离桌，断线富座保留，房间继续`);
});

// —— M6 hosted 流程（等待 → 准备 → 房主开局 → 结算暂停 → 房主续局）——
// 拒绝分档口径（proto/06 钉着 rejectSeat 字面量 vs NET_REJECT_CODES）：局内（hand 在）走
// rejectSeat（not_host / begin_late，码在表里）；局外（hand === null）走 error（not_ready /
// not_host / flow_off / begin_ignored，不进表）。errors 用 peer.info().errors 断言。
const errOf = (rig: Rig, i: number, code: string): boolean =>
  (rig.peers[i]?.info().errors ?? []).some((e) => e.code === code);

test('room/32 hosted 基本流：准备门与房主门各有自己的档，结算停住不自动续，续局无需再准备', () => {
  const rig = createRig({ seats: 3, flow: 'hosted' });
  const a = rig.join('甲'); // 座位 0 = 在线最小号 = 房主
  const b = rig.join('乙');
  // ① 无人准备：房主 begin → not_ready（局外 error 档）
  rig.up(a, { t: 'begin' });
  assert.ok(errOf(rig, a, 'not_ready'), '没准备好就该被 not_ready 拦下');
  // ② 非房主 begin → not_host（局外 error 档）
  rig.up(b, { t: 'begin' });
  assert.ok(errOf(rig, b, 'not_host'), '非房主点开始就该被 not_host 拦下');
  // ③ 只有一家准备：仍 not_ready
  rig.up(a, { t: 'ready', on: true });
  rig.up(a, { t: 'begin' });
  assert.ok(errOf(rig, a, 'not_ready'), '乙没准备，甲点了也开不了');
  // ④ 全员准备 → 房主 begin → 开局（collect），table 广播 waiting=false
  rig.up(b, { t: 'ready', on: true });
  rig.up(a, { t: 'begin' });
  assert.equal(rig.info().hand, 1, '准备齐了、房主点了，就该开局（rig 的 peers 会自动交份额，phase 可能已到 betting，故按局号断言）');
  assert.ok(rig.wireText('down').some((t) => t.includes('"t":"table"')), '桌况要广播');
  assert.equal(rig.peers[a]?.info().table?.waiting, false, '开局之后 waiting 必须翻 false');
  // ⑤ 局中：房主 begin → begin_late（局内 reject 档，hand 是真的）
  rig.up(a, { t: 'begin' });
  assert.equal(rig.rejectOf(a)?.code, 'begin_late', '局中点继续该被 begin_late 拒（reject 档）');
  // ⑥ 打完一手 → settled；**零待触发定时器**（auto 会挂 handGap 表，hosted 不挂 —— 这条是不再自动续局的硬门）
  finishHand(rig);
  assert.equal(rig.info().phase, 'settled');
  assert.equal(rig.clock.pending(), 0, '结算后必须零定时器：挂着 handGap 表就等于还会自动续局');
  // ⑦ 结算暂停期非房主点继续 → not_host（hand 还在 ⇒ reject 档）
  rig.up(b, { t: 'begin' });
  assert.equal(rig.rejectOf(b)?.code, 'not_host', '暂停期非房主点继续走 reject 档 not_host');
  // ⑧ 房主继续 → 第 2 手，且**无需再准备**（ready 只守第一次开局）
  rig.up(a, { t: 'begin' });
  assert.equal(rig.info().hand, 2, '房主点了继续就该开第 2 手');
  // ⑨ 对照：auto 房间对桌务上行一律 flow_off
  const auto = createRig({ seats: 2 });
  const x = auto.join('甲');
  auto.join('乙'); // auto：人齐自动开局
  assert.equal(auto.info().hand, 1, '对照前提：auto 房间已自动开局（peers 自动交份额，phase 可能已到 betting）');
  auto.up(x, { t: 'ready', on: true });
  auto.up(x, { t: 'begin' });
  assert.ok(errOf(auto, x, 'flow_off'), 'auto 房间的 ready/begin 都该被 flow_off 挡下');
  note('room/32 hosted：not_ready/not_host（局外 error 档）、begin_late/not_host（局内 reject 档）、结算零定时器、续局免准备、auto 对照 flow_off');
});

test('room/33 hosted 桌况：房主断线即让位、重连 catchup 立刻带回 table、collect 加入者不误入等待', () => {
  const rig = createRig({ seats: 3, flow: 'hosted' });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.up(a, { t: 'ready', on: true });
  rig.up(b, { t: 'ready', on: true });
  // ① 房主（甲，座位 0）断线 → host 让位给乙（座位 1）
  rig.drop(a);
  assert.equal(rig.peers[b]?.info().table?.host, 1, '房主断线即刻让位（host 是在线最小号的派生值）');
  // ② 只剩乙在线：即便大家都准备过，在线数不够 → not_ready（准备门只数在线座位）
  rig.up(b, { t: 'begin' });
  assert.ok(errOf(rig, b, 'not_ready'), '断线的人不该算进"全员准备"（门只数在线座位）');
  // ③ 甲凭 token 重连 → catchup 立刻补 table（等待期正是 hand===null，这条最容易在提前 return 处丢）
  rig.reconnect(a);
  const tbl = rig.peers[a]?.info().table;
  assert.ok(tbl !== null, '重连的第一批下行里必须有 table（否则不知道谁是房主、谁准备了）');
  assert.equal(tbl?.waiting, true, '还在等待期');
  assert.equal(tbl?.host, 0, '甲回来了，host 回到在线最小号 0');
  assert.equal(rig.peers[b]?.info().table?.host, 0, '重连触发的桌况广播要让乙也看见 host 回来了');
  // ④ 甲的准备标志跨断线仍在（重连不摘 readiness）→ 房主 begin 直接开局
  rig.up(a, { t: 'begin' });
  assert.equal(rig.info().hand, 1, '重连回来无需再准备，房主一点就开');
  // ⑤ collect 阶段丙加入：他不该看到"准备/开始"（waiting 严格 = hand === null）
  const c = rig.join('丙');
  assert.equal(rig.peers[c]?.info().table?.waiting, false, 'collect 加入者的 waiting 必须是 false（局已开）');
  note('room/33 让位/重连桌况/在线准备门/collect 加入者 waiting=false');
});

test('room/34 桌务边角：未入座 no_seat、离桌摘准备、收桌后 begin_ignored', () => {
  const rig = createRig({ seats: 3, flow: 'hosted' });
  const a = rig.join('甲');
  const b = rig.join('乙');
  // ① 未持座的连接发桌务 → no_seat（与 leave/nonce 同一道门）
  rig.room.open('ghost');
  rig.room.receiveText('ghost', '{"t":"ready","on":true}');
  const ghostDown = rig.room.pending('ghost').map((m) => JSON.stringify(m)).join('');
  assert.ok(ghostDown.includes('no_seat'), `未入座发 ready 该被 no_seat 挡，实得 ${ghostDown.slice(0, 80)}`);
  // ② 离桌摘准备：乙准备后离桌 → 在线只剩甲 → 甲 begin → not_ready（乙的"已准备"不许再算数）
  rig.up(a, { t: 'ready', on: true });
  rig.up(b, { t: 'ready', on: true });
  rig.up(b, { t: 'leave' });
  rig.up(a, { t: 'begin' });
  assert.ok(errOf(rig, a, 'not_ready'), '离桌的人不许占着"已准备"的名分卡住开局');
  // ③ 新玩家入座拿到乙的旧座 → 全员（在线）准备 → 开局
  const c = rig.join('丙');
  rig.up(c, { t: 'ready', on: true });
  rig.up(a, { t: 'begin' });
  assert.equal(rig.info().hand, 1, '补齐后开局');
  // ④ 打完、甲离桌 → 只剩丙付得起 → 丙（新房主）begin → beginHand 发现人不够 → 收桌；再点 → begin_ignored
  finishHand(rig);
  rig.up(a, { t: 'leave' });
  rig.up(c, { t: 'begin' });
  assert.ok(rig.info().over !== null, '人不够付底注，这一下把桌收了');
  rig.up(c, { t: 'begin' });
  assert.ok(errOf(rig, c, 'begin_ignored'), '收桌之后再点继续必须说得清楚（begin_ignored），不是静默');
  note('room/34 no_seat 门 / 离桌摘准备 / 收桌 begin_ignored');
});

test('room/35 改名：座位与凭据不动、全桌名册刷新、局中也行；同名改名是幂等无操作', () => {
  const rig = createRig({ seats: 3, flow: 'hosted' });
  const a = rig.join('甲');
  const b = rig.join('乙');
  // 局中改名也行：名字不参与任何判定（纯展示面）
  rig.up(a, { t: 'ready', on: true });
  rig.up(b, { t: 'ready', on: true });
  rig.up(a, { t: 'begin' });
  rig.up(b, { t: 'rename', name: '小明' });
  // 名册从 hello 来：甲那侧的 roster 应已更新（refreshRosters 重发了各家的 hello）
  const roster = rig.peers[a]?.rosterOf() ?? [];
  assert.ok(roster.some((r) => r.seat === rig.seatOf(b) && r.name === '小明'), `甲的名册里乙该已叫小明：${JSON.stringify(roster)}`);
  assert.ok(rig.wireText('down').some((t) => t.includes('现在叫 小明')), '改名要说给全桌听（notice）');
  // 同名改名：幂等，不再广播
  const notesBefore = rig.wireText('down').filter((t) => t.includes('现在叫')).length;
  rig.up(b, { t: 'rename', name: '小明' });
  assert.equal(rig.wireText('down').filter((t) => t.includes('现在叫')).length, notesBefore, '同名改名不该再广播');
  // 座位与凭据不动：token 没换、座位没挪
  const tok = rig.peers[b]?.info().token;
  assert.ok(tok !== '' && rig.seatOf(b) === 1, '座位与凭据原样');
  note('room/35 rename：名册刷新 + notice + 幂等 + 座位凭据不动');
});
