// M4 · 真实 socket 互操作（netx/ws.ts + netx/frames.ts 的端到端证据）。
// 关键点是"对面不是我自己写的客户端"：这里用 Node 内置的全局 WebSocket（undici 那套独立实现）
// 打进本仓库手写的 RFC 6455 服务端。握手、分帧、掩码、控制帧、断线重连都能互通，
// 才说明帧实现符合标准，而不是"自己编自己解"的自证。
//
// 本文件是全项目唯一允许 setTimeout 的测试：只当防挂死的看门狗（20 秒），不参与任何判定。
// 正常路径毫秒级完成；看门狗响了就是流程死了（断言失败而不是静默挂起）。
// 因此双跑输出仍然逐字节一致 —— nst/09 把这条例外写在明面上。
import assert from 'node:assert/strict';
import * as net from 'node:net';
import { readFileSync } from 'node:fs';
import { createWsRoom } from '../netx/ws.ts';
import { createPeer } from '../netx/client.ts';
import type { Peer } from '../netx/client.ts';
import { encodeUp } from '../netx/protocol.ts';
import type { Move, Up } from '../netx/protocol.ts';
import { counterEntropy } from './netx-fixtures.ts';
import { note, test } from './harness.ts';

const WATCHDOG_MS = 20000;

type WsEvent = { data?: unknown; code?: number };
type WsLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (ev: WsEvent) => void): void;
};

function wsCtor(): (new (url: string, protocols: string[]) => WsLike) | null {
  const g = globalThis as unknown as { WebSocket?: new (url: string, protocols: string[]) => WsLike };
  return typeof g.WebSocket === 'function' ? g.WebSocket : null;
}

type Sock = {
  send(text: string): void;
  next(): Promise<string>;
  closed(): Promise<number>;
  opened(): Promise<void>;
  close(): void;
};

function connect(url: string): Sock {
  const Ctor = wsCtor();
  if (Ctor === null) throw new Error('这台机器的 Node 没有全局 WebSocket');
  const ws = new Ctor(url, ['zjh-m4-1']);
  const queue: string[] = [];
  const waiters: ((t: string) => void)[] = [];
  const failers: ((err: Error) => void)[] = [];
  const closers: ((code: number) => void)[] = [];
  let closeCode: number | null = null;
  ws.addEventListener('message', (ev) => {
    const text = typeof ev.data === 'string' ? ev.data : '';
    const waiter = waiters.shift();
    if (waiter !== undefined) waiter(text);
    else queue.push(text);
  });
  ws.addEventListener('close', (ev) => {
    closeCode = ev.code ?? 1006;
    for (const f of closers.splice(0)) f(closeCode);
    for (const f of failers.splice(0)) f(new Error(`socket closed with ${String(closeCode)}`));
  });
  ws.addEventListener('error', () => {
    for (const f of failers.splice(0)) f(new Error('socket error'));
  });
  // undici 的 WebSocket 在 OPEN 之前 send() 会抛 InvalidStateError ⇒ 先等 open
  const openedPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('watchdog: 握手一直没完成')), WATCHDOG_MS);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('握手失败'));
    });
  });
  return {
    send: (text) => ws.send(text),
    opened: () => openedPromise,
    next(): Promise<string> {
      if (closeCode !== null) return Promise.reject(new Error(`socket already closed (${String(closeCode)})`));
      const head = queue.shift();
      if (head !== undefined) return Promise.resolve(head);
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`watchdog: ${String(WATCHDOG_MS)}ms 内没有收到消息`)), WATCHDOG_MS);
        waiters.push((t) => {
          clearTimeout(timer);
          resolve(t);
        });
        failers.push((err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    },
    closed(): Promise<number> {
      return closeCode !== null ? Promise.resolve(closeCode) : new Promise<number>((r) => closers.push(r));
    },
    close: () => ws.close(),
  };
}

// 一条真实连接 + 一个客户端会话：收包喂给会话，会话的回执（份额）与轮到我的行动直接发出去。
type Pipe = {
  peer: Peer;
  texts: string[];
  open(url: string, first: Up): Promise<void>;
  pump(until: () => boolean, rounds: number): Promise<void>;
  dropConnection(): Promise<void>;
  close(): void;
};

function makePipe(name: string, seed: number, act: boolean): Pipe {
  const peer = createPeer({ name, buyIn: 256, entropy: counterEntropy(seed) });
  let sock: Sock | null = null;
  const texts: string[] = [];
  const current: Pipe = {
    peer,
    texts,
    async open(url, first) {
      const live = connect(url);
      sock = live;
      await live.opened();
      live.send(encodeUp(first));
      await current.pump(() => false, 1);
    },
    async pump(until, rounds) {
      const live = sock;
      if (live === null) throw new Error('pipe not open');
      for (let i = 0; i < rounds; i += 1) {
        const text = await live.next();
        texts.push(text);
        for (const up of peer.inbound(text)) live.send(encodeUp(up));
        if (act) {
          const info = peer.info();
          const view = peer.viewOf();
          if (view !== null && view.phase === 'betting' && view.turn === info.seat) {
            const me = view.seats.find((s) => s.seat === info.seat);
            if (me !== undefined) {
              const rej = info.lastReject;
              const move: Move =
                rej !== null && rej.code === 'cannot_afford'
                  ? { kind: 'fold' }
                  : !me.looked
                    ? { kind: 'look' }
                    : { kind: 'call' };
              const { up } = peer.act(move);
              if (up !== null) live.send(encodeUp(up));
            }
          }
        }
        if (until()) return;
      }
    },
    async dropConnection() {
      const live = sock;
      if (live === null) return;
      live.close();
      await live.closed();
      sock = null;
    },
    close() {
      if (sock !== null) sock.close();
    },
  };
  return current;
}

const settledAndVerified = (p: Peer): boolean => {
  const info = p.info();
  return info.phase === 'settled' && info.verifiedHand === info.hand;
};

// 等到服务端的副作用真的发生：客户端"发出去了"不等于服务端"处理完了"，
// 真实 socket 上这两者之间隔着至少一个事件循环轮次 —— 判定必须以服务端侧为准。
// 用轮次计数当上限（不读时钟，输出仍然确定），到点没成就直接失败。
async function waitUntil(label: string, fn: () => boolean): Promise<void> {
  for (let i = 0; i < 200000; i += 1) {
    if (fn()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`watchdog: ${label} 一直没成立`);
}

test('ws/01 三个独立 WebSocket 客户端打进来，跑完整一手并各自核对揭示', async () => {
  const room = createWsRoom({
    seats: [
      { seat: 0, name: '桌客0' },
      { seat: 1, name: '桌客1' },
      { seat: 2, name: '桌客2' },
    ],
    firstDealer: 0,
    turnMs: 600000,
    nonceMs: 600000,
    settleMs: 60,
    handGapMs: 600000,
  });
  const portNo = await room.listen(0);
  const url = `ws://127.0.0.1:${String(portNo)}/`;
  const pipes = [makePipe('甲', 0x20000000, true), makePipe('乙', 0x30000000, true), makePipe('丙', 0x40000000, true)];
  try {
    room.room.start();
    for (const p of pipes) await p.open(url, p.peer.hello());
    await Promise.all(pipes.map((p) => p.pump(() => settledAndVerified(p.peer), 400)));
    for (const p of pipes) {
      const info = p.peer.info();
      assert.deepEqual(info.violations, [], `${info.name} 发现了服务端越界`);
      assert.equal(info.phase, 'settled');
      assert.equal(info.verifiedHand, 1, '揭示必须当场核对通过');
      assert.ok(info.committed.includes('server'), '核对的前提是承诺先到手');
    }
    const views = pipes.map((p) => {
      const v = p.peer.viewOf();
      return v === null ? '' : `${String(v.seq)}|${String(v.pot)}|${v.seats.map((s) => `${String(s.seat)}:${String(s.chips)}`).join(',')}`;
    });
    assert.equal(new Set(views).size, 1, '三个客户端看到的权威数字必须一致');
    const logs = pipes.map((p) => p.peer.logOf().map((e) => `${String(e.seq)}:${e.type}`).join('|'));
    assert.equal(new Set(logs).size, 1, '三条独立连接的日志必须逐条一致');
    assert.equal(room.info().fault, null, '服务端出口自检不能有 fault');
    assert.equal(room.info().chips.reduce((a, row) => a + row.chips, 0), 768, '三笔买入一颗不少');
    note(`ws/01 真实 socket + Node 内置 WebSocket 客户端跑完一手牌：${String(views[0]?.split('|')[0] ?? '')} 个 seq，三家各自核对通过`);
  } finally {
    for (const p of pipes) p.close();
    await room.close();
  }
});

test('ws/02 /health 可读；普通 HTTP 请求不会误入升级分支', async () => {
  const room = createWsRoom({ seats: [{ seat: 0, name: '甲' }, { seat: 1, name: '乙' }], firstDealer: 0 });
  const portNo = await room.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${String(portNo)}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { protocol: string; phase: string; connections: number };
    assert.equal(body.protocol, 'zjh-m4-1');
    assert.equal(body.phase, 'idle');
    assert.equal(body.connections, 0);
    const miss = await fetch(`http://127.0.0.1:${String(portNo)}/nope`);
    assert.equal(miss.status, 404);
  } finally {
    await room.close();
  }
});

// 裸 HTTP 升级请求：用来构造"协议层面就不合格"的握手（Node 的 WebSocket 客户端不会发这种东西）。
// 值为 null ⇒ 整条头字段都不发；缺省 ⇒ 发合法值。
type UpgradeOpts = { version?: string | null; upgrade?: string | null; connection?: string | null; key?: string | null; protocol?: boolean };

function upgradeLines(o: UpgradeOpts = {}): string[] {
  const lines: string[] = ['GET / HTTP/1.1', 'Host: 127.0.0.1'];
  const push = (name: string, value: string | null | undefined): void => {
    if (value === null) return;
    lines.push(`${name}: ${value}`);
  };
  push('Upgrade', o.upgrade === undefined ? 'websocket' : o.upgrade);
  push('Connection', o.connection === undefined ? 'Upgrade' : o.connection);
  push('Sec-WebSocket-Key', o.key === undefined ? 'dGhlIHNhbXBsZSBub25jZQ==' : o.key);
  push('Sec-WebSocket-Version', o.version === undefined ? '13' : o.version);
  if (o.protocol === true) lines.push('Sec-WebSocket-Protocol: zjh-m4-1');
  return lines;
}

// until 给出时：读到足够的字节就自己断开（成功的 101 握手不会由服务端主动关）
// body 收文本也收字节：控制帧载荷里有 0x00 / 0xff 这类不该被 UTF-8 编码再加工一遍的字节，
// 所以这里一律拼成 Buffer 写出去（早先用字符串写，0xff 会被编成两字节，帧就变形了）。
async function rawRequest(
  portNo: number,
  lines: string[],
  body: Uint8Array | string = new Uint8Array(0),
  until?: (buf: Buffer) => boolean,
): Promise<Buffer> {
  const head = Buffer.from(`${lines.join('\r\n')}\r\n\r\n`, 'latin1');
  const payload = typeof body === 'string' ? Buffer.from(body, 'latin1') : Buffer.from(body);
  const request = Buffer.concat([head, payload]);
  const buf = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    };
    const sock = net.connect(portNo, '127.0.0.1', () => {
      sock.write(request);
    });
    const timer = setTimeout(() => {
      sock.destroy();
      if (!settled) {
        settled = true;
        reject(new Error('watchdog: raw socket 没有按时收尾'));
      }
    }, WATCHDOG_MS);
    sock.on('data', (d: Buffer) => {
      chunks.push(d);
      if (until !== undefined && until(Buffer.concat(chunks))) {
        sock.destroy();
        finish();
      }
    });
    sock.on('close', finish);
    sock.on('error', () => {
      sock.destroy();
      finish();
    });
  });
  return buf;
}

const headDone = (b: Buffer): boolean => b.toString('latin1').includes('\r\n\r\n');
const sawCloseFrame = (b: Buffer): boolean => b.indexOf(0x88, 4) > 0;

test('ws/03 握手与帧的严格性在真 socket 上生效：合法 101、旧版本 426、未掩码被 1002 关掉', async () => {
  const room = createWsRoom({ seats: [{ seat: 0, name: '甲' }, { seat: 1, name: '乙' }], firstDealer: 0 });
  const portNo = await room.listen(0);
  try {
    // 必修 3：RFC 6455 §4.2.2 第 4 步 —— 版本不被支持 ⇒ MUST 426 Upgrade Required + 支持版本清单
    const old = (await rawRequest(portNo, upgradeLines({ version: '8' }))).toString('latin1');
    assert.ok(old.startsWith('HTTP/1.1 426 Upgrade Required'), `版本 8 应回 426，实得：${old.slice(0, 40)}`);
    assert.match(old, /Sec-WebSocket-Version: 13/, '426 必须带上服务端支持的版本');
    assert.equal(old.includes('425'), false, '425 Too Early 是 RFC 8470 的 TLS 早数据码，不该出现在这里');
    const ok = (await rawRequest(portNo, upgradeLines({ protocol: true }), '', headDone)).toString('latin1');
    assert.match(ok, /HTTP\/1\.1 101 /);
    assert.ok(ok.includes('s3pPLMBiTxaQ9kYGzzhZRbK+xOo='), 'accept 必须是 RFC 6455 §1.3 那一串');
    assert.match(ok, /Sec-WebSocket-Protocol: zjh-m4-1/);
    // 未掩码的客户端帧：两个字节 {} ，掩码位为 0 ⇒ 服务端按标准回 1002 关闭
    const rude = await rawRequest(portNo, upgradeLines(), Buffer.from([0x81, 0x02, 0x7b, 0x7d]).toString('latin1'), sawCloseFrame);
    const frameAt = rude.indexOf(0x88, 4);
    assert.ok(frameAt > 0, '应能读到服务端发来的 close 帧');
    const code = (((rude[(frameAt + 2) as number] as number) << 8) | (rude[(frameAt + 3) as number] as number)) >>> 0;
    assert.equal(code, 1002, `协议错误应回 1002，实得 ${String(code)}`);
  } finally {
    await room.close();
  }
});

test('ws/05 非法握手的每一条都被拒，且拒绝不在房间里留下连接', async () => {
  const room = createWsRoom({ seats: [{ seat: 0, name: '甲' }, { seat: 1, name: '乙' }], firstDealer: 0 });
  const portNo = await room.listen(0);
  // expect = 我们观察到的真实状态行。404 那几条不是本服务端答的：Node 的 http 自己就不把
  // "缺 Upgrade / Connection 不含 upgrade"的请求当作升级请求派发，于是落到普通 HTTP 分支（/health 之外一律 404）。
  // 结论：netx/ws.ts 里 Connection 头那两道 guard 在本机 Node 上够不到（纵深防御，见 SELF-REVIEW 的"已知未覆盖"）。
  const cases: [string, UpgradeOpts, string][] = [
    ['Upgrade 头缺失', { upgrade: null }, 'HTTP/1.1 404 Not Found'],
    ['Upgrade 值不是 websocket', { upgrade: 'HTTP' }, 'HTTP/1.1 400 Bad Request'],
    ['Connection 头缺失', { connection: null }, 'HTTP/1.1 404 Not Found'],
    ['Connection 值不含 upgrade', { connection: 'keep-alive' }, 'HTTP/1.1 404 Not Found'],
    ['Sec-WebSocket-Version 整条缺失', { version: null }, 'HTTP/1.1 400 Bad Request'],
    ['Sec-WebSocket-Version = 8', { version: '8' }, 'HTTP/1.1 426 Upgrade Required'],
    ['Sec-WebSocket-Version = 17', { version: '17' }, 'HTTP/1.1 426 Upgrade Required'],
    ['Sec-WebSocket-Key 缺失', { key: null }, 'HTTP/1.1 400 Bad Request'],
    ['Sec-WebSocket-Key 是空值', { key: '' }, 'HTTP/1.1 400 Bad Request'],
  ];
  try {
    for (const [label, opts, expect] of cases) {
      const res = (await rawRequest(portNo, upgradeLines(opts))).toString('latin1');
      assert.equal(res.split('\r\n')[0], expect, `${label}：状态行不符，实得 ${res.slice(0, 60)}`);
      if (expect !== 'HTTP/1.1 404 Not Found') {
        assert.match(res, /Connection: close/, `${label}：拒绝必须显式关连接`);
      }
      assert.equal(room.info().connections.length, 0, `${label}：被拒的握手不该在房间里留下连接`);
    }
    assert.equal(room.info().fault, null);
    // 对照：同一套工装发合法握手就该真的连上（否则上面的"零连接"是空转）
    const good = (await rawRequest(portNo, upgradeLines({ protocol: true }), '', headDone)).toString('latin1');
    assert.match(good, /HTTP\/1\.1 101 /);
    assert.equal(room.info().connections.length, 1, '对照组：合法握手确实建了一条连接');
    // 对照：Connection 是多值头（"Upgrade, Keep-Alive"）时仍然认 ⇒ 证明我们没有把它写死成单值比较
    const multi = (await rawRequest(portNo, upgradeLines({ connection: 'Upgrade, Keep-Alive' }), '', headDone)).toString('latin1');
    assert.match(multi, /HTTP\/1\.1 101 /, '多值 Connection 头必须照样升级');
    assert.equal(room.info().connections.length, 2);
    note(`ws/05 ${String(cases.length)} 条非法握手各自被拒（400/404/426 按来源分档），零连接残留`);
  } finally {
    await room.close();
  }
});

test('ws/06 真 socket 上的控制帧：客户端 ping 得到同载荷 pong，坏帧得到 1002（rev=9 应修 3）', async () => {
  const room = createWsRoom({ seats: [{ seat: 0, name: '甲' }, { seat: 1, name: '乙' }], firstDealer: 0 });
  const portNo = await room.listen(0);
  // 掩码控制帧：客户端 ⇒ 服务端必须掩码（RFC 6455 §5.1）。ping 的操作码是 9 ⇒ 首字节 0x89。
  function maskedControl(opcodeByte: number, payload: number[], mask: number[]): Uint8Array {
    const head = [opcodeByte, 0x80 | payload.length, ...mask];
    const body = payload.map((b, i) => b ^ (mask[i % 4] as number));
    return Uint8Array.from([...head, ...body]);
  }
  const PING = 0x89;
  const sawPong = (b: Buffer): boolean => b.indexOf(0x8a, 4) > 0;
  const sawClose = (b: Buffer): boolean => b.indexOf(0x88, 4) > 0;
  try {
    // ① ping → pong：载荷必须原样回显（RFC 6455 §5.5.2：pong 的 payload 与 ping 一致，最多 125 字节）
    const payload = [0x7a, 0x68, 0x21, 0x00, 0xff]; // 含 0x00 与 0xff，防"当字符串处理"的偷懒实现
    const res = await rawRequest(portNo, upgradeLines(), maskedControl(PING, payload, [1, 2, 3, 4]), sawPong);
    const at = res.indexOf(0x8a, 4);
    assert.ok(at > 0, `应当读到服务端回来的 pong 控制帧，实得 ${String(res.length)} 字节`);
    assert.equal(res[at + 1] as number, payload.length, 'pong 不得分片、长度就是载荷长度（服务端方向不许掩码）');
    assert.deepEqual([...res.subarray(at + 2, at + 2 + payload.length)], payload, 'pong 必须原样回显 ping 的载荷');
    assert.equal(room.info().connections.length, 1, '控制帧不算游戏消息：只留握手那一条连接');
    assert.equal(room.info().fault, null);
    // ② 空载荷的 ping 也要能回（payload 长度 0 是合法边界）
    const empty = await rawRequest(portNo, upgradeLines(), maskedControl(PING, [], [9, 9, 9, 9]), sawPong);
    const at2 = empty.indexOf(0x8a, 4);
    assert.ok(at2 > 0 && (empty[at2 + 1] as number) === 0, '零长度 ping ⇒ 零长度 pong');
    // ③ 客户端自己发 pong（RFC 6455 允许非邀请式 pong）⇒ 服务端必须安静忽略，绝不"回一个 pong 表示收到"。
    //    同一条管道里紧跟一个真 ping，再用一条 close 收尾：TCP 保序 ⇒ 读到 close 回声时前面的应答都已到手，
    //    于是"整条应答里恰好一个 pong"是确定性断言，不是抢时间窗。
    const pipelined = Uint8Array.from([
      ...maskedControl(0x8a, [1, 2, 3], [5, 6, 7, 8]),
      ...maskedControl(PING, payload, [1, 1, 1, 1]),
      ...maskedControl(0x88, [0x03, 0xe8], [7, 7, 7, 7]), // 1000 normal closure
    ]);
    const pipe = await rawRequest(portNo, upgradeLines(), pipelined, sawClose);
    assert.ok(pipe.indexOf(Buffer.from([0x8a, payload.length, ...payload]), 4) > 0, '管道里的 ping 必须得到那一份 pong 回显');
    let pongFrames = 0;
    for (let i = 4; i + 1 < pipe.length; i += 1) {
      if (pipe[i] === 0x8a && ((pipe[i + 1] as number) & 0x80) === 0) pongFrames += 1;
    }
    assert.equal(pongFrames, 1, `应答里只该有一个 pong 帧（实得 ${String(pongFrames)} 个）⇒ 多出来的就是回声环路`);
    assert.ok(pipe.indexOf(0x88, 4) > 0, 'close 被正常回声');
    assert.equal(room.info().fault, null);
    // ④ 帧层非法（这里用未掩码的数据帧）⇒ 1002 关闭，且不进 handleInbound 的游戏路径
    const rude = await rawRequest(portNo, upgradeLines(), Uint8Array.from([0x81, 0x02, 0x7b, 0x7d]), sawClose);
    const cAt = rude.indexOf(0x88, 4);
    assert.ok(cAt > 0, '非法帧必须被 1002 关掉');
    const code = (((rude[(cAt + 2) as number] as number) << 8) | (rude[(cAt + 3) as number] as number)) >>> 0;
    assert.equal(code, 1002, `协议错误应回 1002，实得 ${String(code)}`);
    note(`ws/06 控制帧：ping(${payload.join(',')}) 原样回显、零长度边界、客户端 pong 不回声（管道里恰好一个 pong）、非法帧 1002`);
  } finally {
    await room.close();
  }
});

test('ws/09 握手拒绝的正文两两不同，且与 Node 自己答的那串 400 可分辨（rev=11 应修 2）', async () => {
  const room = createWsRoom({ seats: [{ seat: 0, name: '甲' }, { seat: 1, name: '乙' }], firstDealer: 0 });
  const portNo = await room.listen(0);
  const bodyOf = (res: Buffer): string => {
    const text = res.toString('latin1');
    const at = text.indexOf('\r\n\r\n');
    return at < 0 ? '' : text.slice(at + 4).replace(/\r?\n/g, '');
  };
  const headOf = (res: Buffer): string => res.toString('latin1').split('\r\n')[0] ?? '';
  try {
    // 三条**可达**的 guard：同一条管道下各自带自己的那句话
    const noUpgrade = await rawRequest(portNo, upgradeLines({ upgrade: 'HTTP' }));
    const noVersion = await rawRequest(portNo, upgradeLines({ version: null }));
    const noKey = await rawRequest(portNo, upgradeLines({ key: '' }));
    assert.equal(headOf(noUpgrade), 'HTTP/1.1 400 Bad Request');
    assert.equal(bodyOf(noUpgrade), 'upgrade header missing');
    assert.equal(bodyOf(noVersion), 'sec-websocket-version missing');
    assert.equal(bodyOf(noKey), 'sec-websocket-key invalid');
    const bodies = [bodyOf(noUpgrade), bodyOf(noVersion), bodyOf(noKey)];
    assert.equal(new Set(bodies).size, 3, `三条 guard 的正文必须互不相同，实得 ${JSON.stringify(bodies)}`);
    // 426 那一档也要能被分辨（它本来就带 Sec-WebSocket-Version 头，正文再加一句自己的）
    const old = await rawRequest(portNo, upgradeLines({ version: '8' }));
    assert.match(old.toString('latin1'), /HTTP\/1\.1 426 Upgrade Required/);
    assert.match(old.toString('latin1'), /Sec-WebSocket-Version: 13/);
    assert.equal(bodyOf(old), 'version not supported');
    // 对照（这才是应修 2 的病根）：Node/llhttp 自己答的 400 是**零正文**的那一串。
    //   obs-fold 折行与坏请求行都由它答 ⇒ 我们的正文与它必然不同，归因不再需要覆盖差分。
    const fold = await rawRequest(portNo, ['GET / HTTP/1.1', 'Host: 127.0.0.1', 'X-Fold: abc', ' def', 'Upgrade: websocket', 'Connection: Upgrade', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version: 13']);
    const badline = await rawRequest(portNo, ['GET / HTTP/9.9', 'Host: 127.0.0.1']);
    assert.equal(headOf(fold), 'HTTP/1.1 400 Bad Request', `obs-fold 那一发应当由 Node 答 400，实得 ${headOf(fold)}`);
    assert.equal(bodyOf(fold), '', 'Node 自己答的那一发应当是零正文 ⇒ 这正是我们原来分不清的原因');
    assert.equal(headOf(badline), 'HTTP/1.1 400 Bad Request');
    assert.equal(bodyOf(badline), '');
    for (const b of [...bodies, 'version not supported']) {
      assert.notEqual(b, bodyOf(fold), '我们的正文不许与 Node 那一发撞成同一串');
    }
    // 第四道 guard（Connection 不含 upgrade）在本机 Node 上够不到（ws/08 已给出分档实测），
    // 但它的正文仍然不许与别人相同 ⇒ 这一半只能钉在源码上。
    const src = readFileSync(new URL('../netx/ws.ts', import.meta.url), 'utf8');
    const fourth = 'connection header lacks upgrade';
    assert.ok(src.includes(`'${fourth}'`), '第四道 guard 的正文没写进源码');
    const all = [...bodies, 'version not supported', fourth];
    assert.equal(new Set(all).size, 5, '四条 400 与那条 426 的正文必须五者互不相同');
    assert.equal(room.info().fault, null);
    note('ws/09 三条可达 guard 的正文互不相同、426 另有自己的正文，且 Node 自己答的那一发仍是零正文 ⇒ 400 归因不再需要覆盖差分');
  } finally {
    await room.close();
  }
});

test('ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示', async () => {
  const room = createWsRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
    ],
    firstDealer: 0,
    turnMs: 400,
    nonceMs: 600000,
    settleMs: 60,
    handGapMs: 600000,
  });
  const portNo = await room.listen(0);
  const url = `ws://127.0.0.1:${String(portNo)}/`;
  const a = makePipe('甲', 0x50000000, false); // 全程不动手：让托管接管
  const b = makePipe('乙', 0x60000000, false);
  try {
    room.room.start();
    await a.open(url, a.peer.hello());
    await b.open(url, b.peer.hello());
    // 两家的份额都要交上去才发牌：并发泵，谁的消息到谁就动
    await Promise.all([a.pump(() => a.peer.info().nonceSent, 8), b.pump(() => b.peer.info().nonceSent, 8)]);
    await waitUntil('两家份额都被服务端收下并发牌', () => room.info().phase === 'betting');
    const seqAtDrop = a.peer.info().seq;
    await a.dropConnection();
    // 断线的一家不弃牌：回合到点由托管自动跟注（Q4=B），两家各三次行动后强制开牌、结算、揭示
    await b.pump(() => settledAndVerified(b.peer), 60);
    assert.equal(b.peer.info().verifiedHand, 1);
    assert.ok(b.peer.logOf().some((e) => e.note === 'timeout→call dark×stake'), '托管跟注的痕迹要能在日志里读到');
    assert.equal(b.peer.logOf().filter((e) => e.note.startsWith('timeout→')).length, 6, '六次托管行动，一家不少');
    const resume = a.peer.resume();
    assert.ok(resume !== null, '拿到过 token 就该能构造重连消息');
    await a.open(url, resume);
    await a.pump(() => settledAndVerified(a.peer), 60);
    const info = a.peer.info();
    assert.deepEqual(info.violations, [], '断线重连后仍然零越界');
    assert.equal(info.verifiedHand, 1, '重连也拿得到承诺，揭示能核对');
    assert.ok(info.seq >= seqAtDrop, 'seq 只前进不倒退');
    assert.equal(room.info().fault, null);
    note(`ws/04 断线期间牌局由托管走完；重连后 seq 从 ${String(seqAtDrop)} 追到 ${String(info.seq)}，揭示核对通过`);
  } finally {
    a.close();
    b.close();
    await room.close();
  }
});

// rev=10 应修 9 / §8.12(ii)：netx/ws.ts:145-149 那个 500 兜底此前零覆盖。
// 必修 2 之后 serveStatic 自己不再抛 ⇒ 要走到这层 catch 必须**故意**制造异常，用例意图也就写得清楚：
// 它兜的是"将来有人往 onHttpRequest 里塞了会抛的东西"，不是畸形 URL（畸形 URL 归 webmin/serve.ts 的 400 档）。
test('ws/07 onHttpRequest 抛异常 ⇒ 500 兜底、连接不残留、房间照常服务（rev=10 应修 9）', async () => {
  let mode: 'throw' | 'handle' | 'miss' = 'throw';
  const room = createWsRoom({
    seats: [
      { seat: 0, name: '甲' },
      { seat: 1, name: '乙' },
    ],
    firstDealer: 0,
    onHttpRequest: (_req, res) => {
      if (mode === 'throw') throw new Error('boom');
      if (mode === 'miss') return false;
      res.writeHead(203, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('handled by hook\n');
      return true;
    },
  });
  const portNo = await room.listen(0);
  const base = `http://127.0.0.1:${String(portNo)}`;
  try {
    // ① 钩子抛 ⇒ 这层 catch 答 500，并把异常原文带出来（运维要看得到是"钩子炸了"，不是一个字都不说）
    const bad = await fetch(`${base}/webui/`);
    assert.equal(bad.status, 500, `钩子抛异常应回 500，实得 ${String(bad.status)}`);
    assert.match(await bad.text(), /room handler failed: boom/);
    assert.equal(room.info().connections.length, 0, '一条走兜底分支的 HTTP 请求不许在房间里留下连接');
    // ② /health 仍然 200：兜底只兜那一次请求，既没把服务打死，也没让钩子遮蔽健康检查
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200, '钩子会抛也不许把 /health 一起拖下水（它是运维唯一的入口）');
    assert.equal(((await health.json()) as { fault: unknown }).fault, null, 'catch 不是房间的 fault：那是服务端自己算错了才用的档');
    // ③ 对照：钩子正常应答 ⇒ 它的状态码说了算，500 不是常驻档位（否则"兜底"就变成了新的默认行为）
    mode = 'handle';
    const handled = await fetch(`${base}/webui/`);
    assert.equal(handled.status, 203);
    assert.equal(await handled.text(), 'handled by hook\n');
    // ④ 对照：钩子答"我没处理" ⇒ 仍旧落到那句 404（钩子不许悄悄吞请求）
    mode = 'miss';
    const miss = await fetch(`${base}/nope`);
    assert.equal(miss.status, 404);
    assert.match(await miss.text(), /this endpoint is a websocket room/);
    // ⑤ 兜底之后真握手照样能连上：catch 没有把 http 服务卡住，也没有留下半开的 link
    mode = 'throw';
    const up = (await rawRequest(portNo, upgradeLines({ protocol: true }), '', headDone)).toString('latin1');
    assert.match(up, /HTTP\/1\.1 101 /, '一条失败的普通 HTTP 请求不该影响后续 WebSocket 升级');
    assert.equal(room.info().connections.length, 1, '升级成功的那条连接才该进名册');
  } finally {
    await room.close();
  }
  note('ws/07 钩子抛 ⇒ 500 + 原文；/health 与真握手照常；钩子自己应答时 203/404 两档不受影响');
});

// §8.12(ii) 的另一半：ws.ts:163-167（Connection 不含 upgrade ⇒ 400）实测**走不到**，
// 且不是"没找到用例"，而是被 Node 的 http 解析层挡在前面。这里把分档依据钉成正式用例：
// 判据是"谁答的" —— 我们那三行 400 没有响应体、带 Connection: close；Node 的 404 带那句固定文案。
test('ws/08 Connection 头的四种"我们不肯放行"写法全部停在 Node 层 404：ws.ts:163-167 按构造不可达', async () => {
  const room = createWsRoom({ seats: [{ seat: 0, name: '甲' }, { seat: 1, name: '乙' }], firstDealer: 0 });
  const portNo = await room.listen(0);
  const OUR_404 = 'this endpoint is a websocket room';
  const sawOur404 = (b: Buffer): boolean => b.toString('latin1').includes(OUR_404);
  // headerList 按 RFC 7230 以逗号分隔取 token：这四条里的 token 都不是 'upgrade'，我们的 guard 若见到必拒。
  const variants: [string, string][] = [
    ['空格分隔的多 token', 'Upgrade Keep-Alive'],
    ['制表符分隔', 'Upgrade\tKeep-Alive'],
    ['重复 token 不带逗号', 'Upgrade Upgrade'],
    ['尾随冒号', 'Upgrade:'],
  ];
  try {
    for (const [label, conn] of variants) {
      const res = (await rawRequest(portNo, upgradeLines({ connection: conn }), '', sawOur404)).toString('latin1');
      assert.equal(res.split('\r\n')[0], 'HTTP/1.1 404 Not Found', `${label}：实得 ${res.slice(0, 40)}`);
      assert.ok(res.includes(OUR_404), `${label}：这句文案只有我们的 HTTP 分支会印 ⇒ 请求确实没进 upgrade 事件`);
      assert.equal(room.info().connections.length, 0, `${label}：被挡在前面的握手不许留下连接`);
    }
    // 对照 A：能进 upgrade 事件、但 Upgrade 值不对 ⇒ 那才是**我们**答的 400
    //（rev=11 应修 2 之后它带着自己那句正文，与 Node 零正文的那一发一眼可分 ⇒ 归因不再需要覆盖差分）
    const wrongUpgrade = (await rawRequest(portNo, upgradeLines({ upgrade: 'HTTP' }))).toString('latin1');
    assert.equal(wrongUpgrade.split('\r\n')[0], 'HTTP/1.1 400 Bad Request');
    assert.ok(!wrongUpgrade.includes(OUR_404), '400 这一档出自 ws.ts 自己，不该带 HTTP 分支那句正文');
    assert.match(wrongUpgrade, /upgrade header missing/, `我们答的那一发应当带自己的正文：${wrongUpgrade.slice(0, 80)}`);
    assert.match(wrongUpgrade, /Connection: close/);
    // 对照 B：多值写法里只要有一个 token 是 upgrade 就放行（与 ws/05 那条互证，证明两档之间没有第三种答案）
    const multi = (await rawRequest(portNo, upgradeLines({ connection: 'Keep-Alive, upgrade' }), '', headDone)).toString('latin1');
    assert.match(multi, /HTTP\/1\.1 101 /);
    assert.equal(room.info().connections.length, 1);
    assert.equal(room.info().fault, null);
  } finally {
    await room.close();
  }
  note(`ws/08 ${String(variants.length)} 种 Connection 写法全部由 Node 层答 404（正文即判据），我们那三行 400 在本机 Node 上按构造不可达`);
});
