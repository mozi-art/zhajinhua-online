// M4 · RFC 6455 帧编解码（netx/frames.ts）。
// 自己实现协议就要自己把"对端不可信"这条走到底：这里每条严格性断言都用手工拼出的字节序列驱动，
// 而不是"自己编自己解"——自编自解只能证明一致，证明不了合规。
// 真实互通的最后一环在 test/netx-ws.test.ts（Node 内置 WebSocket 客户端打进来）。
import assert from 'node:assert/strict';
import {
  bytesToBase64,
  closeCodeAllowed,
  encodeClose,
  encodeFrame,
  encodePing,
  encodePong,
  encodeText,
  encodeTextFragmented,
  FrameError,
  FrameReader,
  handshakeAccept,
  OPCODE,
} from '../netx/frames.ts';
import { note, test } from './harness.ts';

const enc = new TextEncoder();

function frame(opts: {
  opcode: number;
  payload: number[];
  fin?: boolean;
  mask?: number[];
  lenForm?: 'auto' | '126' | '127';
  rsv?: number;
}): Uint8Array {
  const n = opts.payload.length;
  const form = opts.lenForm ?? (n <= 125 ? 'auto' : n <= 0xffff ? '126' : '127');
  const b0 = (opts.fin === false ? 0x00 : 0x80) | (opts.rsv ?? 0) | (opts.opcode & 0x0f);
  const masked = opts.mask !== undefined;
  const lenByte = masked ? 0x80 : 0x00;
  const head: number[] = [b0];
  if (form === 'auto') head.push(lenByte | n);
  else if (form === '126') head.push(lenByte | 126, (n >> 8) & 255, n & 255);
  else head.push(lenByte | 127, 0, 0, 0, 0, (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  if (opts.mask !== undefined) head.push(...opts.mask);
  const out = new Uint8Array(head.length + n);
  out.set(head);
  for (let i = 0; i < n; i += 1) {
    out[head.length + i] = opts.mask === undefined ? (opts.payload[i] as number) : ((opts.payload[i] as number) ^ (opts.mask[i % 4] as number)) & 255;
  }
  return out;
}

function server(): FrameReader {
  return new FrameReader({ masked: true });
}

function bytesOf(text: string): number[] {
  return [...enc.encode(text)];
}

test('frame/01 编码的三档长度字段逐字节符合规范', () => {
  const short = encodeFrame(OPCODE.text, enc.encode('Hi'));
  assert.deepEqual([...short], [0x81, 0x02, 0x48, 0x69]);
  const mid = encodeFrame(OPCODE.text, new Uint8Array(200));
  assert.deepEqual([...mid.slice(0, 4)], [0x81, 0x7e, 0x00, 0xc8]);
  const big = encodeFrame(OPCODE.text, new Uint8Array(70000));
  assert.deepEqual([...big.slice(0, 10)], [0x81, 0x7f, 0, 0, 0, 0, 0, 0x01, 0x11, 0x70]);
  const boundary = [
    [125, [0x7d]],
    [126, [0x7e, 0x00, 0x7e]],
    [0xffff, [0x7e, 0xff, 0xff]],
    [0x10000, [0x7f, 0, 0, 0, 0, 0, 1, 0, 0]],
  ] as [number, number[]][];
  for (const [len, head] of boundary) {
    const f = encodeFrame(OPCODE.text, new Uint8Array(len));
    assert.deepEqual([...f.slice(1, 1 + head.length)], head, `长度 ${String(len)} 的头部不对`);
    assert.equal(f.length, head.length + 1 + len);
  }
});

test('frame/02 客户端方向必须掩码，且 XOR 逐字节可复算', () => {
  const mask = [0x37, 0xfa, 0x21, 0x3d];
  const masked = encodeText('Hi', { maskKey: new Uint8Array(mask) });
  assert.deepEqual([...masked], [0x81, 0x82, 0x37, 0xfa, 0x21, 0x3d, 0x48 ^ 0x37, 0x69 ^ 0xfa]);
  const unmasked = encodeText('Hi');
  assert.equal((unmasked[1] as number) & 0x80, 0, '服务端帧不得置掩码位');
});

test('frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解', () => {
  const messages = ['hello', 'x'.repeat(200), JSON.stringify({ t: 'ping', echo: 1 }), '中'.repeat(40)];
  const mask = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
  const wire = new Uint8Array(messages.reduce((a, m) => a + encodeText(m, { maskKey: mask }).length, 0));
  let at = 0;
  for (const m of messages) {
    const f = encodeText(m, { maskKey: mask });
    wire.set(f, at);
    at += f.length;
  }
  // 一次全喂
  const r1 = server();
  const got = r1.push(wire);
  assert.deepEqual(got.map((i) => (i.kind === 'text' ? i.text : i.kind)), messages);
  // 一次一字节
  const r2 = server();
  const slow: string[] = [];
  for (let i = 0; i < wire.length; i += 1) {
    for (const item of r2.push(wire.slice(i, i + 1))) {
      if (item.kind === 'text') slow.push(item.text);
    }
  }
  assert.deepEqual(slow, messages, '分包喂入必须得到同样的消息序列');
});

test('frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒', () => {
  const r = server();
  assert.throws(() => r.push(encodeText('no mask here')), (e: unknown) => (e as FrameError).code === 'unmasked_frame');
  const c = new FrameReader({ masked: false });
  assert.throws(
    () => c.push(encodeText('masked', { maskKey: new Uint8Array([1, 2, 3, 4]) })),
    (e: unknown) => (e as FrameError).code === 'unexpected_mask',
  );
});

test('frame/05 长度必须最小编码，64 位长度不得越出 32 位', () => {
  const r = server();
  assert.throws(
    () => r.push(frame({ opcode: OPCODE.text, payload: bytesOf('Hi'), mask: [1, 2, 3, 4], lenForm: '126' })),
    (e: unknown) => (e as FrameError).code === 'non_minimal_length',
  );
  assert.throws(
    () => r.push(frame({ opcode: OPCODE.text, payload: bytesOf('Hi'), mask: [1, 2, 3, 4], lenForm: '127' })),
    (e: unknown) => (e as FrameError).code === 'non_minimal_length',
  );
  assert.throws(
    () => r.push(frame({ opcode: OPCODE.text, payload: bytesOf('Hi'), mask: [1, 2, 3, 4], lenForm: '126' })),
    /non_minimal/,
  );
  const huge = frame({ opcode: OPCODE.text, payload: [], mask: [1, 2, 3, 4], lenForm: '127' });
  huge[4] = 0x80; // 高 32 位非 0
  assert.throws(() => server().push(huge), (e: unknown) => (e as FrameError).code === 'too_large');
});

test('frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）', () => {
  for (const rsv of [0x40, 0x20, 0x10]) {
    assert.throws(
      () => server().push(frame({ opcode: OPCODE.text, payload: bytesOf('hi'), mask: [1, 2, 3, 4], rsv })),
      (e: unknown) => (e as FrameError).code === 'rsv_bits',
      `RSV ${String(rsv)} 没被拦住`,
    );
  }
});

test('frame/07 控制帧规则：ping/pong 原样交回，close 解析状态码', () => {
  const r = server();
  const items = r.push(
    new Uint8Array([
      ...encodePing(enc.encode('hb'), { maskKey: new Uint8Array([1, 2, 3, 4]) }),
      ...encodeClose(1000, '再见', { maskKey: new Uint8Array([1, 2, 3, 4]) }),
    ]),
  );
  assert.equal(items.length, 2);
  assert.equal(items[0]?.kind, 'ping');
  assert.deepEqual([...(items[0]?.kind === 'ping' ? items[0].payload : [])], [0x68, 0x62]);
  assert.deepEqual(items[1], { kind: 'close', code: 1000, reason: '再见' });
  const bare = server().push(frame({ opcode: OPCODE.close, payload: [], mask: [1, 2, 3, 4] }));
  assert.deepEqual(bare[0], { kind: 'close', code: 1005, reason: '' });
});

test('frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码）', () => {
  const bad: [string, number[]][] = [
    ['one byte', [0x00]],
    ['1004', [0x03, 0xec]],
    ['1005', [0x03, 0xed]],
    ['1006', [0x03, 0xee]],
    ['1015', [0x03, 0xf7]],
    ['999', [0x03, 0xe7]],
    ['3000 合法但 5000 非法', [0x13, 0x88]],
  ];
  for (const [label, payload] of bad) {
    assert.throws(
      () => server().push(frame({ opcode: OPCODE.close, payload, mask: [1, 2, 3, 4] })),
      (e: unknown) => (e as FrameError).code === 'bad_close',
      `close ${label} 应当被拒`,
    );
  }
  assert.equal(closeCodeAllowed(1000), true);
  assert.equal(closeCodeAllowed(3000), true);
  assert.equal(closeCodeAllowed(1005), false);
  assert.equal(closeCodeAllowed(1015), false);
});

test('frame/09 控制帧不得分片、载荷不得过 125', () => {
  assert.throws(
    () => server().push(frame({ opcode: OPCODE.ping, payload: new Array(8).fill(1), fin: false, mask: [1, 2, 3, 4] })),
    (e: unknown) => (e as FrameError).code === 'control_fragmented',
  );
  assert.throws(
    () => server().push(frame({ opcode: OPCODE.ping, payload: new Array(126).fill(1), mask: [1, 2, 3, 4], lenForm: '126' })),
    (e: unknown) => (e as FrameError).code === 'control_too_long',
  );
});

test('frame/10 文本分片可重组，控制帧插在中间也不丢序', () => {
  const mask = new Uint8Array([9, 8, 7, 6]);
  const parts = encodeTextFragmented('炸金花联机分片测试', 5, { maskKey: mask });
  const r = server();
  assert.equal(r.waitingForMore(), false);
  assert.deepEqual(r.push(parts[0] as Uint8Array), []);
  assert.equal(r.waitingForMore(), true, '半个消息没收回不能报静默');
  const ping = encodePing(enc.encode('i'), { maskKey: mask });
  const between = r.push(ping);
  assert.deepEqual(between.map((i) => i.kind), ['ping']);
  const done = r.push(parts[1] as Uint8Array);
  assert.deepEqual(done.map((i) => (i.kind === 'text' ? i.text : i.kind)), ['炸金花联机分片测试']);
  assert.equal(r.waitingForMore(), false);
});

test('frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续）', () => {
  const bytes = enc.encode('炸金花');
  assert.equal(bytes.length, 9);
  const mask = new Uint8Array([1, 1, 1, 1]);
  // 故意在第一字的第 2 个字节后切断
  const a = encodeFrame(OPCODE.text, bytes.slice(0, 2), { maskKey: mask, fin: false });
  const b = encodeFrame(OPCODE.cont, bytes.slice(2), { maskKey: mask });
  const out = server().push(new Uint8Array([...a, ...b]));
  assert.deepEqual(out.map((i) => (i.kind === 'text' ? i.text : i.kind)), ['炸金花']);
});

test('frame/12 非法帧序与未知操作码一律拒', () => {
  const mask = [1, 2, 3, 4];
  const open = new Uint8Array(encodeFrame(OPCODE.text, enc.encode('a'), { maskKey: new Uint8Array(mask), fin: false }));
  assert.throws(
    () => server().push(new Uint8Array([...open, ...encodeFrame(OPCODE.text, enc.encode('b'), { maskKey: new Uint8Array(mask) })])),
    (e: unknown) => (e as FrameError).code === 'interleaved',
  );
  assert.throws(
    () => server().push(encodeFrame(OPCODE.cont, enc.encode('orphan'), { maskKey: new Uint8Array(mask) })),
    (e: unknown) => (e as FrameError).code === 'bad_opcode',
    '无主续帧要拒',
  );
  assert.throws(
    () => server().push(encodeFrame(OPCODE.binary, enc.encode('bin'), { maskKey: new Uint8Array(mask) })),
    (e: unknown) => (e as FrameError).code === 'bad_opcode',
    '这个协议只走文本帧',
  );
  assert.throws(
    () => server().push(frame({ opcode: 0x3, payload: [1], mask })),
    (e: unknown) => (e as FrameError).code === 'bad_opcode',
  );
  assert.throws(
    () => server().push(frame({ opcode: 0xb, payload: [1], mask })),
    (e: unknown) => (e as FrameError).code === 'bad_opcode',
  );
});

test('frame/13 巨帧、巨消息与编码侧都有上限', () => {
  const mask = new Uint8Array([1, 2, 3, 4]);
  // 单帧声明 2,000,000 字节：应先撞上 maxMessage 上限，而不是回头等那么多字节
  const claim = new Uint8Array([0x81, 0xff, 0, 0, 0, 0, 0x00, 0x1e, 0x84, 0x80, 1, 2, 3, 4]);
  assert.throws(
    () => server().push(claim),
    (e: unknown) => (e as FrameError).code === 'message_too_large',
  );
  // 分片累加超上限
  const r = new FrameReader({ masked: true, maxMessageBytes: 64 });
  r.push(encodeTextFragmented('y'.repeat(50), 25, { maskKey: mask })[0] as Uint8Array);
  assert.throws(
    () => r.push(encodeFrame(OPCODE.cont, new Uint8Array(50), { maskKey: mask })),
    (e: unknown) => (e as FrameError).code === 'message_too_large',
  );
  // 发送侧同样拦：不靠对端兜底
  assert.throws(() => encodeFrame(OPCODE.text, new Uint8Array(1048577)), /too_large/);
});

test('frame/14 非法 UTF-8 文本帧拒收', () => {
  assert.throws(
    () => server().push(frame({ opcode: OPCODE.text, payload: [0xff, 0xfe], mask: [1, 2, 3, 4] })),
    (e: unknown) => (e as FrameError).code === 'bad_utf8',
  );
});

test('frame/15 握手 accept：已知向量 + key 边界', () => {
  assert.equal(handshakeAccept('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  assert.equal(handshakeAccept('a'.repeat(24)).length, 28, 'SHA-1 摘要 base64 后固定 28 字符');
  assert.throws(() => handshakeAccept('a'.repeat(129)), FrameError);
  assert.throws(() => handshakeAccept('带 空格'), FrameError);
  assert.equal(bytesToBase64(new Uint8Array(20)).length, 28);
  note('frame/15 握手向量 = RFC 6455 §1.3（SHA-1 + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11）');
});

test('frame/16 编码侧的三道参数自检：掩码键长度、分片点、pong 帧', () => {
  // rev=8 覆盖缺口：这三处只有编码侧调用能到，环线工装永远走的是合法参数 ⇒ 直接对 API 断言
  for (const keyLen of [0, 1, 3, 5, 4 + 1]) {
    assert.throws(
      () => encodeFrame(OPCODE.text, enc.encode('Hi'), { maskKey: new Uint8Array(keyLen) }),
      (e: unknown) => (e as FrameError).code === 'bad_mask',
      `掩码键 ${String(keyLen)} 字节必须被拒（RFC 6455 钉死 4 字节）`,
    );
  }
  assert.doesNotThrow(() => encodeFrame(OPCODE.text, enc.encode('Hi'), { maskKey: new Uint8Array([1, 2, 3, 4]) }));

  assert.throws(
    () => encodeTextFragmented('abc', 10),
    (e: unknown) => (e as FrameError).code === 'bad_split',
    '分片点越过载荷 ⇒ 不许悄悄给出空续帧',
  );
  assert.throws(
    () => encodeTextFragmented('abc', -1),
    (e: unknown) => (e as FrameError).code === 'bad_split',
  );
  // 边界值本身合法：0 与 payload.length（首帧空 / 续帧空）
  assert.equal(encodeTextFragmented('abc', 0).length, 2, 'splitAt=0 是合法的"全在续帧里"');
  assert.equal(encodeTextFragmented('abc', 3).length, 2, 'splitAt=length 是合法的"全在首帧里"');

  // encodePong：控制帧的第四条编码出口（应用层 pong 走的是 JSON 消息，不是控制帧，所以这里必须单独测）
  const pong = encodePong(enc.encode('hb'), { maskKey: new Uint8Array([9, 8, 7, 6]) });
  const got = server().push(pong);
  assert.equal(got.length, 1, '一条 pong 控制帧解出一条入站事件');
  assert.equal(got[0]?.kind, 'pong');
  assert.equal(new TextDecoder().decode((got[0] as { payload: Uint8Array }).payload), 'hb', '掩码解完之后的载荷原样');
});

test('frame/17 64 位长度字段：非最小编码要拒、合法长帧要收、高 32 位不许越界', () => {
  // ① 64 位长度写一个只有 2 字节的载荷 ⇒ 非最小编码（rev=8 覆盖缺口：frame/05 那两条撞的都是 16 位臂）
  assert.throws(
    () => server().push(frame({ opcode: OPCODE.text, payload: bytesOf('Hi'), mask: [1, 2, 3, 4], lenForm: '127' })),
    (e: unknown) => {
      const err = e as FrameError;
      assert.equal(err.code, 'non_minimal_length');
      assert.match(err.message, /64-bit length used for a short payload/, '报错必须指向 64 位那一臂，不能靠 16 位那条蒙过去');
      return true;
    },
  );
  // ② 真正需要 64 位的帧（> 0xffff）必须解得开，且载荷逐字节还原
  const big = new Uint8Array(66000).fill(0x41);
  const r = new FrameReader({ masked: true, maxMessageBytes: 200_000 });
  const events = r.push(frame({ opcode: OPCODE.text, payload: [...big], mask: [1, 2, 3, 4], lenForm: '127' }));
  assert.equal(events.length, 1);
  const first = events[0];
  assert.ok(first !== undefined && first.kind === 'text', '64 位长度帧应当解成一条文本消息');
  assert.equal(first.text.length, 66000, '长度字段读错了就到这里现形');
  assert.equal(/^A+$/.test(first.text) && first.text.endsWith('A'), true, '掩码解完之后的载荷原样');
  // ③ 高 32 位非 0 ⇒ 直接 too_large（frame/05 已测，这里补的是"下限"那一侧：正好 0x10000 不再算非最小）
  const exactly = frame({ opcode: OPCODE.text, payload: [], mask: [1, 2, 3, 4], lenForm: '127' });
  const n = 0x10000;
  exactly[6] = (n >>> 24) & 255;
  exactly[7] = (n >>> 16) & 255;
  exactly[8] = (n >>> 8) & 255;
  exactly[9] = n & 255;
  // 声称 65536 字节但实际一个字节都没跟上来 ⇒ 是"半帧"，不是"非最小编码"
  assert.equal(server().push(exactly).length, 0, '长度合法但数据没到齐 ⇒ 等，不报错');
  note('frame/17 64 位长度三臂：非最小拒 / 66000 字节合法帧解通 / 0x10000 声明走"等数据"分支');
});
