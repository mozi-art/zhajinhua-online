// M4 · 消息契约与严格校验（netx/protocol.ts）。
// 这一层是"接口契约"，所以两头都要卡：客户端不能宽容（否则服务端可以偷偷多塞），
// 服务端也不能自由（发之前就过同一个校验器，否则协议只约束弱者）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { presets } from '../src/rules.ts';
import { startHand } from '../src/engine/state.ts';
import type { GameState } from '../src/engine/state.ts';
import { project } from '../src/engine/project.ts';
import {
  checkDown,
  checkUp,
  checkViewLeak,
  encodeDown,
  encodeUp,
  ENGINE_REJECT_CODES,
  NET_REJECT_CODES,
  ProtocolError,
  toAction,
} from '../netx/protocol.ts';
import type { Down, Up } from '../netx/protocol.ts';
import { note, test } from './harness.ts';

function sampleView(seat = 0): ReturnType<typeof project> {
  const state: GameState = startHand({
    rules: presets.classic,
    seed: 12345,
    dealer: 0,
    seats: [
      { seat: 0, chips: 300 },
      { seat: 1, chips: 300 },
      { seat: 2, chips: 300 },
    ],
  });
  return project(state, seat);
}

const UPS: Up[] = [
  { t: 'join', name: '小庄', buyIn: 256 },
  { t: 'nonce', hand: 3, value: 'deadbeefcafebabe' },
  { t: 'action', hand: 3, move: { kind: 'look' } },
  { t: 'action', hand: 3, move: { kind: 'compare', target: 1 } },
  { t: 'resume', token: 'a'.repeat(40), hand: 3, since: 12 },
  { t: 'leave' },
  { t: 'ready', on: true },
  { t: 'ready', on: false },
  { t: 'begin' },
  { t: 'rename', name: '小明' },
  { t: 'ping', echo: 7 },
];

const DOWNS: Down[] = [
  {
    t: 'hello',
    protocol: 'zjh-m4-1',
    token: 'b'.repeat(40),
    seat: 2,
    name: '小庄',
    rules: presets.classic,
    seats: [{ seat: 0, name: '甲' }, { seat: 2, name: '小庄' }],
  },
  { t: 'table', host: 0, ready: [0, 2], waiting: true, playing: false },
  { t: 'commit', hand: 1, party: 'server', commit: 'c'.repeat(64) },
  { t: 'collect', hand: 1, committed: ['seat:0'], missing: ['seat:1', 'server'] },
  { t: 'view', hand: 1, seq: 1, view: sampleView(0) },
  { t: 'patch', hand: 1, since: 1, seq: 4, view: sampleView(0) },
  { t: 'reveal', hand: 1, seed: 4294967295, shares: [{ party: 'server', value: 'deadbeef' }] },
  { t: 'reject', hand: 1, code: 'not_current_turn', why: 'turn is seat 1' },
  { t: 'notice', text: '没人交了份额' },
  { t: 'error', code: 'bad_message', why: 'unknown key "seat"' },
  { t: 'pong', echo: 7 },
];

test('proto/01 双向消息 encode→check 往返保真，且字节稳定', () => {
  for (const up of UPS) {
    const text = encodeUp(up);
    assert.deepEqual(checkUp(text), up, `up 往返变形: ${text.slice(0, 60)}`);
    assert.equal(encodeUp(checkUp(text)), text, '同一条消息重编码必须逐字节相同（§0.5 的前提）');
  }
  for (const down of DOWNS) {
    const text = encodeDown(down);
    assert.deepEqual(checkDown(text), down, `down 往返变形: ${text.slice(0, 60)}`);
    assert.equal(encodeDown(checkDown(text)), text);
  }
  note(`proto/01 上行 ${String(UPS.length)} 条 / 下行 ${String(DOWNS.length)} 条往返保真且字节稳定`);
});

test('proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）', () => {
  const bad: [string, unknown][] = [
    ['up.join.seat', { t: 'join', name: 'a', buyIn: 256, seat: 0 }],
    ['up.action.seat（座位伪造）', { t: 'action', hand: 1, move: { kind: 'fold' }, seat: 1 }],
    ['up.action.move.kind 多余', { t: 'action', hand: 1, move: { kind: 'fold', seat: 1 } }],
    ['up.nonce.extra', { t: 'nonce', hand: 1, value: 'deadbeef', note: 'x' }],
    ['down.view.seq2', { t: 'view', hand: 1, seq: 1, view: sampleView(0), cheat: true }],
    ['down.view.view.pot2', { t: 'view', hand: 1, seq: 1, view: { ...sampleView(0), odds: 1 } }],
    [
      'down.hello.rules.special235',
      {
        t: 'hello',
        protocol: 'zjh-m4-1',
        token: 'b'.repeat(40),
        seat: 0,
        name: 'a',
        rules: { ...presets.classic, special235: true },
        seats: [],
      },
    ],
    [
      'down.hello.rules.handEval.suitTiebreak',
      {
        t: 'hello',
        protocol: 'zjh-m4-1',
        token: 'b'.repeat(40),
        seat: 0,
        name: 'a',
        rules: { ...presets.classic, handEval: { ...presets.classic.handEval, suitTiebreak: false } },
        seats: [],
      },
    ],
  ];
  for (const [label, msg] of bad) {
    const isUp = typeof msg === 'object' && msg !== null && ['join', 'nonce', 'action', 'resume', 'ping'].includes(String((msg as { t: string }).t));
    if (isUp) assert.throws(() => checkUp(msg), /unknown key/, `${label} 应当被拒`);
    else assert.throws(() => checkDown(msg), /unknown key|must be literal/, `${label} 应当被拒`);
  }
});

test('proto/03 缺 key 与类型不符一律拒', () => {
  assert.throws(() => checkUp({ t: 'join', name: 'a' }), /missing key "buyIn"/);
  assert.throws(() => checkUp({ t: 'action', hand: 1 }), /missing key "move"/);
  assert.throws(() => checkUp({ t: 'nonce', hand: '1', value: 'deadbeef' }), /must be an integer/);
  assert.throws(() => checkUp({ t: 'ping', echo: 1.5 }), /must be an integer/);
  assert.throws(() => checkDown({ t: 'pong', echo: '1' }), /must be an integer/);
  assert.throws(() => checkDown('not json'), /not valid JSON/);
  assert.throws(() => checkDown('[1,2]'), /must be an object/);
  assert.throws(() => checkDown('null'), /must be an object/);
  assert.throws(() => checkDown('{"t":"nope"}'), /unknown downbound message tag/);
  assert.throws(() => checkDown({ t: 'view', hand: 1, seq: 1 }), /missing key "view"/);
});

test('proto/04 数值与长度越界一律拒', () => {
  const view = sampleView(0);
  assert.throws(() => checkDown({ t: 'view', hand: 1, seq: 0, view }), /seq/);
  assert.throws(() => checkUp({ t: 'nonce', hand: 0, value: 'deadbeef' }), /hand/);
  assert.throws(() => checkUp({ t: 'join', name: '', buyIn: 256 }), /length/);
  assert.throws(() => checkUp({ t: 'join', name: 'x'.repeat(25), buyIn: 256 }), /length/);
  assert.throws(() => checkUp({ t: 'join', name: 'a', buyIn: 0 }), /buyIn/);
  assert.throws(() => checkUp({ t: 'join', name: 'a', buyIn: -5 }), /buyIn/);
  assert.throws(() => checkUp({ t: 'nonce', hand: 1, value: 'abc' }), /8\.\.256 hex/);
  assert.throws(() => checkUp({ t: 'nonce', hand: 1, value: 'ABCD1234' }), /8\.\.256 hex/, '大写字母不算合法份额');
  assert.throws(() => checkDown({ t: 'commit', hand: 1, party: 'server', commit: 'ab' }), /64 hex/);
  assert.throws(
    () => checkDown({ t: 'view', hand: 1, seq: 1, view: { ...view, pot: 1099511627776 } }),
    /pot/,
    'pot 越界要拦住',
  );
  assert.throws(
    () => checkDown({ t: 'view', hand: 1, seq: 1, view: { ...view, seats: Array.from({ length: 65 }, () => view.seats[0]) } }),
    /too long/,
  );
  assert.throws(() => checkDown({ t: 'error', code: 'x'.repeat(60), why: 'y' }), /length/);
  assert.throws(() => checkDown({ t: 'error', code: '中文', why: 'y' }), /printable ASCII|length/);
});

test('proto/05 引擎拒绝码全集与 src/engine/validate.ts 逐字对齐（防契约漂移）', () => {
  const src = readFileSync(new URL('../src/engine/validate.ts', import.meta.url), 'utf8');
  const block = /export type RejectCode =([\s\S]*?);/.exec(src);
  assert.ok(block !== null, '读不到 RejectCode 定义');
  const listed = [...(block[1] as string).matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
  assert.deepEqual([...ENGINE_REJECT_CODES].sort(), listed.sort(), 'wire 上的引擎拒绝码集合与源码不一致');
});

test('proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项', () => {
  const src = readFileSync(new URL('../netx/room.ts', import.meta.url), 'utf8');
  const emitted = [...src.matchAll(/rejectSeat\([^)]*?'([a-z_]+)'/g)].map((m) => m[1] as string);
  const viaVerdict = /code: verdict\.code/.test(src);
  assert.ok(viaVerdict, '服务端把引擎拒绝码透传这条路应当在 room.ts 里');
  for (const code of emitted) {
    assert.ok((NET_REJECT_CODES as readonly string[]).includes(code), `room.ts 发出了未声明的码 ${code}`);
  }
  for (const code of NET_REJECT_CODES) {
    assert.ok(emitted.includes(code), `声明了 ${code} 却没有任何地方会发它`);
  }
  note(`proto/06 net 拒绝码 ${String(NET_REJECT_CODES.length)} 个全部会被真正发出：${NET_REJECT_CODES.join(', ')}`);
});

test('proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形', () => {
  const base = sampleView(0);
  const other = base.seats.find((s) => s.seat === 1);
  const self = base.seats.find((s) => s.seat === 0);
  assert.ok(other !== undefined && self !== undefined);
  assert.equal(checkViewLeak(base, 0), null, '刚发牌时对 0 号位应当是干净的');

  const leakOther = { ...base, seats: base.seats.map((s) => (s.seat === 1 ? { ...s, cards: s.cards === 'unknown' ? [{ rank: 2, suit: 0 }, { rank: 3, suit: 0 }, { rank: 4, suit: 0 }] : s.cards } : s)) };
  assert.match(checkViewLeak(leakOther, 0) ?? '', /cards of seat 1/);

  const leakOwnUnlooked = { ...base, seats: base.seats.map((s) => (s.seat === 0 ? { ...s, cards: [{ rank: 2, suit: 0 }, { rank: 3, suit: 0 }, { rank: 4, suit: 0 }] } : s)) };
  assert.match(checkViewLeak(leakOwnUnlooked, 0) ?? '', /before look/);

  const wrongViewer = { ...base, viewer: 2 };
  assert.match(checkViewLeak(wrongViewer, 0) ?? '', /projected for seat 2/);

  const seedEarly = { ...base, deal: { seed: 12345 } };
  assert.match(checkViewLeak(seedEarly, 0) ?? '', /seed exposed in phase betting/);

  const noteLeak = { ...base, log: [{ ...(base.log[0] as NonNullable<typeof base.log[0]>), note: 'rank=14 suit=2' }] };
  assert.match(checkViewLeak(noteLeak, 0) ?? '', /event note looks like card data/);

  // 合法：别人已亮牌；本人已看牌
  const revealed = { ...base, seats: base.seats.map((s) => (s.seat === 1 ? { ...s, revealed: true, cards: [{ rank: 2, suit: 0 }, { rank: 3, suit: 0 }, { rank: 4, suit: 0 }] } : s)) };
  assert.equal(checkViewLeak(revealed, 0), null);
  const looked = { ...base, seats: base.seats.map((s) => (s.seat === 0 ? { ...s, looked: true, cards: [{ rank: 2, suit: 0 }, { rank: 3, suit: 0 }, { rank: 4, suit: 0 }] } : s)) };
  assert.equal(checkViewLeak(looked, 0), null);
});

test('proto/08 已看牌但未亮牌的"别人"仍然算泄漏（rev=4 口径在网络层同样生效）', () => {
  const base = sampleView(1);
  const polluted = {
    ...base,
    seats: base.seats.map((s) =>
      s.seat === 0 ? { ...s, looked: true, cards: [{ rank: 14, suit: 0 }, { rank: 14, suit: 1 }, { rank: 2, suit: 2 }] } : s,
    ),
  };
  assert.match(checkViewLeak(polluted, 1) ?? '', /cards of seat 0/);
});

test('proto/09 toAction 只能用绑定的座位，compare 才带 target', () => {
  assert.deepEqual(toAction({ kind: 'look' }, 3), { kind: 'look', seat: 3 });
  assert.deepEqual(toAction({ kind: 'raise' }, 3), { kind: 'raise', seat: 3 });
  assert.deepEqual(toAction({ kind: 'compare', target: 1 }, 3), { kind: 'compare', seat: 3, target: 1 });
  const wire = 'seat' in toAction({ kind: 'fold' }, 3) ? 'has' : 'none';
  assert.equal(wire, 'has', '引擎 Action 本来就要 seat，这里只保证座位来自参数');
});

test('proto/10 校验错误信息带路径，便于线上定位', () => {
  const err = (() => {
    try {
      checkUp({ t: 'action', hand: 1, move: { kind: 'settle' } });
      return null;
    } catch (e) {
      return e as Error & { path?: string };
    }
  })();
  assert.ok(err !== null, '客户端伪造 settle 必须被拒');
  assert.equal(err.name, 'ProtocolError');
  assert.match(err.message, /move/);
  assert.ok((err.path ?? '').startsWith('move'), `path 应指向 move，实得 ${String(err.path)}`);
});

test('proto/11 巨帧保护：超过上限的字符串直接拒', () => {
  const huge = `{"t":"notice","text":"${'x'.repeat(1048577)}"}`;
  assert.throws(() => checkDown(huge), /message too large/);
});

test('proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上', () => {
  const bads: [string, unknown][] = [
    ['超长 notice', { t: 'notice', text: 'x'.repeat(700) }],
    ['缺 view 字段', { t: 'view', hand: 1, seq: 1 }],
    ['未知下行 tag', { t: 'debug-dump', hand: 1 }],
    ['自造拒绝码', { t: 'reject', hand: 1, code: 'made_up_code', why: 'x' }],
    ['下行夹带私货 key', { t: 'pong', echo: 1, peek: [1, 2] }],
    ['上行想带 seat', { t: 'action', hand: 1, move: { kind: 'fold', seat: 2 } }],
  ];
  for (const [label, msg] of bads) {
    const isDown = ['notice', 'view', 'debug-dump', 'reject', 'pong'].includes(String((msg as { t: string }).t));
    if (isDown) assert.throws(() => encodeDown(msg as Down), /length|missing key|unknown|must be one of|unknown key/, `${label} 应当发不出去`);
    else assert.throws(() => encodeUp(msg as Up), /unknown key/, `${label} 应当发不出去`);
  }
  note('proto/12 出口编码：6 类非法消息全部在本地被拦（服务端不能只约束客户端）');
});

test('proto/13 入参既不是 JSON 文本也不是对象 ⇒ 报"必须是文本或对象"，不报成 schema 错（rev=9 应修 3）', () => {
  // parse() 的两条臂要分得开：坏 JSON 文本 ⇒ "not valid JSON"；连文本都不是 ⇒ "must be JSON text or a plain object"。
  // 混成一条报错的话，"对面发来一个 42" 会被误报成"消息缺 key"，排查方向就错了。
  const notText: unknown[] = [42, 3.5, true, null, [], [1, 2], new Uint8Array(4), Symbol('s'), undefined];
  for (const [i, raw] of notText.entries()) {
    const tag = String(raw === undefined ? 'undefined' : Array.isArray(raw) ? `Array(${String(raw.length)})` : typeof raw);
    assert.throws(
      () => checkUp(raw),
      (e: unknown) => {
        assert.ok(e instanceof ProtocolError, `第 ${String(i)} 条不是 ProtocolError：${String(e)}`);
        assert.match((e as Error).message, /message must be JSON text or a plain object/, `入参 ${tag} 的报错口径不对`);
        return true;
      },
      `上行：入参 ${tag} 应当被拒`,
    );
    assert.throws(
      () => checkDown(raw),
      /message must be JSON text or a plain object/,
      `下行：入参 ${tag} 应当被拒`,
    );
  }
  // "是 object 但不是普通对象"的那一类（typed array / Date / Map / 类实例）也必须在入口就被说清 ——
  // 它们取不到 't'，若漏过 parse 就会被报成"消息缺 tag"，把排查方向带歪到 schema 上。
  class Box {
    t = 'ping';
  }
  const notPlain: [string, unknown][] = [
    ['Uint8Array', new Uint8Array([1, 2])],
    ['RegExp', /ping/],
    ['Map', new Map([['t', 'ping']])],
    ['Set', new Set(['t'])],
    ['类实例', new Box()],
  ];
  for (const [label, raw] of notPlain) {
    assert.throws(() => checkUp(raw), /message must be JSON text or a plain object/, `${label} 不该被当成普通对象`);
  }
  // 对照：null 原型对象（有些库会产出）仍然算普通对象，别把它一起关掉
  const bare: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  bare['t'] = 'ping';
  bare['echo'] = 1;
  assert.equal(checkUp(bare).t, 'ping', 'null 原型对象必须仍然合法（判据是原型而不是 constructor）');
  // 对照 1：合法的"对象"与"文本"两种入参都收（checkUp 的入参形状本身没被写死成只有文本）
  assert.equal(checkUp({ t: 'ping', echo: 1 }).t, 'ping');
  assert.equal(checkUp('{"t":"ping","echo":1}').t, 'ping');
  // 对照 2：坏 JSON 文本走的是另一条报错（证明上面那些不是撞进了 JSON 分支）
  assert.throws(() => checkUp('{"t":'), /not valid JSON/);
  // 对照 3：对象缺 key 的报错仍是 schema 口径（证明"必须是对象"这条没有把 schema 检查吃掉）
  assert.throws(() => checkUp({ t: 'ping' }), /missing key|echo/);
  note('proto/13 parse() 两条报错口径互不混用：非文本非对象 / 坏 JSON / schema 缺 key 各归各');
});
