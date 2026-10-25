// M6 · 多房间路由（netx/hub.ts）的端到端证据：真 socket、真全局 WebSocket 客户端、真 /rooms。
//
// 时钟纪律（nst/09 的扫描面含本文件）：本文件零定时器 ——
//   · 等待一律事件驱动（socket 的 error/close 事件负责拒绝）或 setImmediate 轮询（量级照抄
//     netx-ws.test.ts::waitUntil：轮次封顶，到点抛错而不是静默挂起）；
//   · "到点"类行为（空桌驱逐）用注入的 FakeClock 推进，不开真定时器。
// 于是例外面（TIMER_EXCEPTIONS）不需要为本文件扩一格格。
import assert from 'node:assert/strict';
import * as net from 'node:net';
import { createHub, routeOf } from '../netx/hub.ts';
import type { Hub } from '../netx/hub.ts';
import { createPeer } from '../netx/client.ts';
import type { Peer } from '../netx/client.ts';
import { encodeUp, normalizeRoomCode } from '../netx/protocol.ts';
import type { Up } from '../netx/protocol.ts';
import { counterEntropy, fakeClock } from './netx-fixtures.ts';
import type { FakeClock } from './netx-fixtures.ts';
import { note, test } from './harness.ts';

// —— 零时钟的 WebSocket 客户端（与 netx-serve.test.ts::connect 同一件思想：事件驱动，无看门狗）——
type Cli = {
  peer: Peer;
  send(up: Up): void;
  poll(): string | null;
  next(): Promise<string>;
  close(): void;
};

function connect(url: string, peer: Peer): Promise<Cli> {
  return new Promise<Cli>((resolve, reject) => {
    const ws = new WebSocket(url, 'zjh-m4-1');
    const queue: string[] = [];
    const waiters: { res: (t: string) => void; rej: (e: Error) => void }[] = [];
    ws.addEventListener('error', () => reject(new Error(`socket 出错：${url}`)));
    ws.addEventListener('close', () => {
      for (const w of waiters.splice(0)) w.rej(new Error(`连接被关：${url}`));
      reject(new Error(`连接被关：${url}`));
    });
    ws.addEventListener('message', (ev: MessageEvent) => {
      const text = typeof ev.data === 'string' ? ev.data : '';
      const w = waiters.shift();
      if (w !== undefined) w.res(text);
      else queue.push(text);
    });
    ws.addEventListener('open', () => {
      resolve({
        peer,
        send: (up) => ws.send(encodeUp(up)),
        // 非阻塞取一条：泵循环用，没有就返回 null —— 零时钟下"等下一条"就是死等，绝不那样写
        poll: () => queue.shift() ?? null,
        // 阻塞取一条：只用在"这条上行必有恰好一条应答"的问答上（join→hello/error、resume→hello/error）
        next: () =>
          new Promise<string>((res, rej) => {
            const head = queue.shift();
            if (head !== undefined) res(head);
            else waiters.push({ res, rej });
          }),
        close: () => ws.close(),
      });
    });
  });
}

// 等到条件成立（轮次封顶）。服务端侧的判定直接看 hub 对象，比隔着 socket 猜更准。
async function waitUntil(label: string, fn: () => boolean): Promise<void> {
  for (let i = 0; i < 200000; i += 1) {
    if (fn()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`watchdog: ${label} 一直没成立`);
}

// 双向泵：把各家队列里的下行喂给那道墙，墙要回的上行（份额等）原样发回去；到 done 即停。
async function pumpUntil(clis: Cli[], done: () => boolean, label: string, rounds = 400): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    for (const cli of clis) {
      for (let t = cli.poll(); t !== null; t = cli.poll()) {
        for (const up of cli.peer.inbound(t)) cli.send(up);
      }
    }
    if (done()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error(`watchdog: ${label} 一直没成立`);
}

// 裸升级请求：默认只发给"该被拒"的那几发 —— 拒绝必带 Connection: close，close 事件就是收尾，
// 天然不需要定时器。成功路径（101）服务端不会关连接，必须传 closeOnHead=true：读到响应头
// 就自己断开，靠 destroy 触发的 close 事件收尾 —— 仍然零定时器。
function rawUpgrade(port: number, path: string, extra: string[] = [], closeOnHead = false): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lines = [
      `GET ${path} HTTP/1.1`,
      'Host: 127.0.0.1',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      'Sec-WebSocket-Version: 13',
      ...extra,
    ];
    const chunks: Buffer[] = [];
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(`${lines.join('\r\n')}\r\n\r\n`);
    });
    sock.on('data', (d: Buffer) => {
      chunks.push(d);
      if (closeOnHead && Buffer.concat(chunks).includes('\r\n\r\n')) sock.destroy();
    });
    sock.on('error', (err: Error) => reject(err));
    sock.on('close', () => resolve(Buffer.concat(chunks).toString('latin1')));
  });
}

const bodyOf = (res: string): string => {
  const at = res.indexOf('\r\n\r\n');
  return at < 0 ? '' : res.slice(at + 4).replace(/\r?\n/g, '');
};
const headOf = (res: string): string => res.split('\r\n')[0] ?? '';

// 一张 hub 的标准夹具：FakeClock + 超长的牌局定时器（本文件不测托管，别让它掺和）
function makeHub(over: Partial<Parameters<typeof createHub>[0]> = {}): { hub: Hub; clock: FakeClock } {
  const clock = fakeClock(1000);
  const hub = createHub({
    seats: 2,
    clock,
    turnMs: 600000,
    nonceMs: 600000,
    settleMs: 600000,
    handGapMs: 600000,
    ...over,
  });
  return { hub, clock };
}

async function openTab(url: string, name: string, seed: number): Promise<Cli> {
  const peer = createPeer({ name, buyIn: 256, entropy: counterEntropy(seed) });
  const cli = await connect(url, peer);
  cli.send(peer.hello());
  return cli;
}

test('hub/01 房间码与路由表：合法码归一化、非法码/穿越/坏转义各有自己的拒绝档', () => {
  assert.equal(normalizeRoomCode('AB3K'), 'AB3K', '全合法');
  assert.equal(normalizeRoomCode('ab3k'), 'AB3K', '小写归一成大写');
  assert.equal(normalizeRoomCode('aB3k'), 'AB3K', '混合大小写');
  assert.equal(normalizeRoomCode('ABCD'), 'ABCD', 'D 在字母表里（只排除 O/I/L）');
  // 长度与字符集：3 位、5 位、0/1、O/I/L、点、空格、斜杠、百分号全都不收
  for (const bad of ['AB3', 'AB3K5', 'ab0k', 'ab1k', 'abil', 'abOl', 'AB.K', 'AB K', 'AB/K', 'AB%K', '']) {
    assert.equal(normalizeRoomCode(bad), null, `「${bad}」不该是合法房间码`);
  }
  // 路由：默认房间 / 码房间 / 三档拒绝（正文两两不同，hub/07 在真 socket 上再对一遍）
  assert.deepEqual(routeOf('/'), { kind: 'default' });
  assert.deepEqual(routeOf('/?x=1'), { kind: 'default' }, '默认路径要剥 query');
  assert.deepEqual(routeOf('/r/ab3k'), { kind: 'code', code: 'AB3K' });
  assert.deepEqual(routeOf('/r/ab3k?x=1'), { kind: 'code', code: 'AB3K' }, '码路径也要剥 query（剥在解码与大写化之前）');
  assert.deepEqual(routeOf('/r/%61%62%33%6b'), { kind: 'code', code: 'AB3K' }, '百分号编码按解码后的值判定');
  const dotdot = routeOf('/r/%2e%2e');
  assert.equal(dotdot.kind, 'refuse', '解码成 .. 的路径必须被拒（穿越档由字母表兜住）');
  const zz = routeOf('/r/%zz');
  assert.equal(zz.kind, 'refuse', '坏转义要拒');
  if (zz.kind === 'refuse') assert.equal(zz.status, 400, '坏转义是请求的错：400 不是 500');
  for (const p of ['/r/AB3', '/r/AB3K5', '/r/ab0k', '/r/', '/r/AB3K/X', '/nope']) {
    const r = routeOf(p);
    assert.equal(r.kind, 'refuse', `${p} 该被拒`);
    if (r.kind === 'refuse') assert.equal(r.status, 404, `${p}：形状不对按 404`);
  }
  note('hub/01 房间码字母表 31 字符（无 0/1/O/I/L）；路由 = 剥 query → 解码 → 大写化 → 字母表');
});

test('hub/02 两张码房间在真 socket 上互不相干：各开各的局，A 桌的 token 在 B 桌是废纸', async () => {
  const { hub } = makeHub({ seats: 2 });
  const port = await hub.listen(0);
  const base = `ws://127.0.0.1:${String(port)}`;
  const a = await openTab(`${base}/r/AB3K`, '甲', 0x61000001);
  const b = await openTab(`${base}/r/AB3K`, '乙', 0x61000002);
  const c = await openTab(`${base}/r/ZZZZ`, '丙', 0x61000003);
  const d = await openTab(`${base}/r/ZZZZ`, '丁', 0x61000004);
  try {
    await pumpUntil([a, b, c, d], () => {
      const rows = hub.rooms();
      return rows.length === 2 && rows.every((r) => r.phase === 'betting' && r.seated === 2);
    }, '两桌各自进入 betting');
    const rows = hub.rooms();
    assert.deepEqual(rows.map((r) => r.code), ['AB3K', 'ZZZZ'], '两张桌都在，按码点序');
    assert.equal(rows[0]?.code, 'AB3K');
    for (const cli of [a, b, c, d]) {
      assert.deepEqual(cli.peer.info().violations, [], `${cli.peer.info().name} 的墙抓到了越界`);
    }
    // A 桌的凭据拿到 B 桌去用：token 是房间内的秘密，出了这张桌就是一串废字
    const stolen = a.peer.info().token;
    assert.ok(stolen !== '', '先拿到真 token（对照：不是拿空串碰运气）');
    const evil = createPeer({
      name: '丙',
      buyIn: 256,
      entropy: counterEntropy(0x61000005),
      restore: { token: stolen, seat: a.peer.info().seat, name: '甲', hand: 1, share: null },
    });
    const wire = await connect(`${base}/r/ZZZZ`, evil);
    try {
      wire.send(evil.resume() as Up);
      const reply = await wire.next(); // resume 必有恰好一条应答：hello 或 error
      for (const up of evil.inbound(reply)) wire.send(up);
      assert.ok(evil.info().errors.some((e) => e.code === 'bad_token'), `跨桌 token 必须得到 bad_token，实得 ${reply.slice(0, 80)}`);
    } finally {
      wire.close();
    }
    note(`hub/02 双桌隔离：两张桌各自 hand=1 betting；AB3K 的 token 在 ZZZZ 得到 bad_token`);
  } finally {
    a.close();
    b.close();
    c.close();
    d.close();
    await hub.close();
  }
});

test('hub/03 默认房间与码房间并存：/health 仍只报默认房间，只多一个 rooms 字段', async () => {
  const { hub } = makeHub({ seats: 2 });
  const port = await hub.listen(0);
  const base = `ws://127.0.0.1:${String(port)}`;
  const loner = await openTab(base, '独', 0x63000001); // 默认桌只有一家：开不了局
  const a = await openTab(`${base}/r/NP2S`, '甲', 0x63000002);
  const b = await openTab(`${base}/r/NP2S`, '乙', 0x63000003);
  try {
    await pumpUntil([a, b], () => hub.rooms().some((r) => r.code === 'NP2S' && r.phase === 'betting'), '码桌开局');
    const health = (await (await fetch(`http://127.0.0.1:${String(port)}/health`)).json()) as Record<string, unknown>;
    // M5 的字段一个不少（srv/01 钉过的那组）；hand=0 证明报的仍是默认桌（那边只有一家、没开局）
    for (const key of ['protocol', 'hand', 'phase', 'seated', 'connections', 'over', 'fault']) {
      assert.ok(key in health, `/health 丢了 M5 就有的字段 ${key}`);
    }
    assert.equal(health['hand'], 0, '码桌在打第 1 手，/health 的 hand 却不是 0 ⇒ 它开始报聚合值了');
    assert.equal(health['rooms'], 1, 'rooms 只数码房间（默认桌永远在、不该占这个数）');
    assert.equal(hub.rooms()[0]?.hand, 1, '码桌自己确实在第 1 手（上面那条断言的前提）');
    assert.equal(hub.info().hand, 0, 'info() 与 /health 同源：都是默认桌');
    note('hub/03 /health 字段纯加法（+rooms），语义仍指默认桌；默认桌与码桌同进程互不干扰');
  } finally {
    loner.close();
    a.close();
    b.close();
    await hub.close();
  }
});

test('hub/04 /rooms：按码排序、不含默认房间、HTTP 出口与进程内同源', async () => {
  const { hub } = makeHub();
  const port = await hub.listen(0);
  const base = `ws://127.0.0.1:${String(port)}`;
  const a = await openTab(`${base}/r/ZZZZ`, '甲', 0x64000001);
  const b = await openTab(`${base}/r/AB3K`, '乙', 0x64000002);
  try {
    await waitUntil('两张码桌都建好', () => hub.rooms().length === 2);
    a.close();
    b.close();
    await waitUntil('连接数归零', () => hub.rooms().every((r) => r.connections === 0));
    const rows = hub.rooms();
    assert.deepEqual(rows.map((r) => r.code), ['AB3K', 'ZZZZ'], '排序按码，不按建桌先后');
    const viaHttp = (await (await fetch(`http://127.0.0.1:${String(port)}/rooms`)).json()) as { code: string }[];
    assert.deepEqual(viaHttp, rows, '/rooms 与 hub.rooms() 必须同源同序（大厅渲染的就是它）');
    note('hub/04 /rooms 排序确定（码点序）、连接断开后条目仍在（驱逐是分钟级的事，不是断线即焚）');
  } finally {
    await hub.close();
  }
});

test('hub/05 码房间有硬上限：超限 503 带独特正文，存量房间照常服务（删掉上限检查本用例必翻红）', async () => {
  const { hub } = makeHub({ maxRooms: 1 });
  const port = await hub.listen(0);
  const base = `ws://127.0.0.1:${String(port)}`;
  const first = await openTab(`${base}/r/FR2S`, '甲', 0x65000001);
  try {
    await waitUntil('第一张码桌建好', () => hub.rooms().length === 1);
    // closeOnHead：万一上限守卫被人摘掉，这里会拿到 101（服务端不再关连接）——红在状态行断言上，
    // 而不是挂死等一条永远不会来的 close
    const refused = await rawUpgrade(port, '/r/SCND', [], true);
    assert.equal(headOf(refused), 'HTTP/1.1 503 Service Unavailable', `超限该回 503，实得 ${headOf(refused)}`);
    assert.match(bodyOf(refused), /room limit reached \(1\), join an existing room instead/, '503 要带自己的正文（与 404/400 那几档可分辨）');
    assert.match(refused, /Connection: close/);
    assert.equal(hub.rooms().length, 1, '被拒的那一发不许顺手建出第二张桌');
    // 对照：存量房间在超限后照常可连（上限挡的是"新桌"，不是"旧桌来人"）
    const again = await connect(`${base}/r/FR2S`, createPeer({ name: '乙', buyIn: 256, entropy: counterEntropy(0x65000002) }));
    again.close();
    note('hub/05 maxRooms=1：第 2 张新桌 503（独特正文），存量桌照常收第 2 条连接');
  } finally {
    first.close();
    await hub.close();
  }
});

test('hub/06 空桌驱逐（FakeClock）：到点逐出且 token 作废、重连取消驱逐、默认桌永不驱逐', async () => {
  // (a) 到点逐出：驱逐表武装 → advance 到点 → 出册 + shutdown；同码再连是一张全新的桌（旧 token 作废）
  {
    const { hub, clock } = makeHub({ idleMs: 1000 });
    const port = await hub.listen(0);
    const base = `ws://127.0.0.1:${String(port)}`;
    const t1 = await openTab(`${base}/r/CAFE`, '甲', 0x66000001);
    await pumpUntil([t1], () => t1.peer.info().token !== '', '入座完成（拿到 token）');
    const deadToken = t1.peer.info().token;
    t1.close();
    await waitUntil('断开落账', () => hub.rooms().every((r) => r.connections === 0));
    assert.equal(clock.pending(), 1, '空桌后恰好一张驱逐表（未开局 ⇒ 没有别的定时器）');
    clock.advance(999);
    assert.equal(hub.rooms().length, 1, '差 1ms 不到点不许逐');
    clock.advance(1);
    assert.equal(hub.rooms().length, 0, '到点逐出');
    assert.equal(clock.pending(), 0, '逐出之后不许残留定时器（收摊顺序：先出册再 shutdown）');
    const revived = createPeer({
      name: '甲',
      buyIn: 256,
      entropy: counterEntropy(0x66000002),
      restore: { token: deadToken, seat: t1.peer.info().seat, name: '甲', hand: 1, share: null },
    });
    const t2 = await connect(`${base}/r/CAFE`, revived);
    try {
      t2.send(revived.resume() as Up);
      const reply = await t2.next(); // 要么 hello（复活了旧桌）要么 error（正确：新桌不认识旧 token）
      for (const up of revived.inbound(reply)) t2.send(up);
      assert.ok(revived.info().errors.some((e) => e.code === 'bad_token'), `旧 token 在新桌上必须是废纸，实得 ${reply.slice(0, 80)}`);
      assert.equal(hub.rooms().length, 1, '同码再连 = 全新的桌（不是复活旧局）');
    } finally {
      t2.close();
      await hub.close();
    }
  }
  // (b) 重连取消驱逐：回桌那一刻取消函数必须真的被调用 —— 判据是 clock.pending() 归零。
  //     变异靶：把 hub.ts onActive 里的 cancelEvict 摘掉 ⇒ 这条 pending 断言必翻红
  //     （evictNow 里 linkCount 守卫只能防"逐出活桌"，防不了这张悬着的废表）。
  {
    const { hub, clock } = makeHub({ idleMs: 1000 });
    const port = await hub.listen(0);
    const base = `ws://127.0.0.1:${String(port)}`;
    const t1 = await openTab(`${base}/r/BEAR`, '甲', 0x66000011);
    await pumpUntil([t1], () => t1.peer.info().token !== '', '入座完成');
    t1.close();
    await waitUntil('断开落账', () => hub.rooms().every((r) => r.connections === 0));
    assert.equal(clock.pending(), 1, '驱逐表已武装');
    clock.advance(999);
    const back = createPeer({
      name: '甲',
      buyIn: 256,
      entropy: counterEntropy(0x66000012),
      restore: { token: t1.peer.info().token, seat: t1.peer.info().seat, name: '甲', hand: 1, share: null },
    });
    const t2 = await connect(`${base}/r/BEAR`, back);
    try {
      t2.send(back.resume() as Up);
      const reply = await t2.next(); // 凭旧 token 回桌：应答必须是 hello，不是 error
      for (const up of back.inbound(reply)) t2.send(up);
      assert.deepEqual(back.info().errors, [], `凭旧 token 回桌不该有任何 error，实得 ${reply.slice(0, 80)}`);
      assert.equal(back.info().seat, t1.peer.info().seat, '坐回的就是原座');
      // 取消驱逐有两处实现（hub.ts 的 onActive 与 codeRoom 复用路径），互为双保险 ⇒ 单摘一处
      // 会被另一处掩盖；这条断言钉的是**行为**：两处都摘掉（已实测变异）⇒ pending 悬着 1 ⇒ 必红
      assert.equal(clock.pending(), 0, '回桌即取消驱逐（变异实测：两处取消都摘掉时这里必红）');
      clock.advance(5000);
      assert.equal(hub.rooms().length, 1, '取消之后无论过多久，有人在线的桌不许被逐');
      assert.deepEqual(back.info().violations, [], '重连全程零越界');
    } finally {
      t2.close();
      await hub.close();
    }
  }
  // (c) 默认桌永不驱逐：空着也不武装，推多久都还在
  {
    const { hub, clock } = makeHub({ idleMs: 1000 });
    const port = await hub.listen(0);
    const base = `ws://127.0.0.1:${String(port)}`;
    const t = await openTab(base, '独', 0x66000021);
    await pumpUntil([t], () => t.peer.info().token !== '', '入座完成');
    t.close();
    await waitUntil('断开落账', () => hub.info().connections.length === 0);
    assert.equal(clock.pending(), 0, '默认桌断空不武装驱逐（它是 /health 与历史入口的锚）');
    clock.advance(100000);
    const health = await (await fetch(`http://127.0.0.1:${String(port)}/health`)).json();
    assert.equal((health as { protocol: string }).protocol, 'zjh-m4-1', '推了十万毫秒，默认桌照常应答');
    await hub.close();
  }
  note('hub/06 驱逐三态：到点逐出（token 作废）／重连取消（pending 归零钉住取消真的发生）／默认桌永不驱逐');
});

test('hub/07 路由拒绝在真 socket 上：三档正文两两不同，且不建桌、不留连接', async () => {
  const { hub } = makeHub();
  const port = await hub.listen(0);
  try {
    const short = await rawUpgrade(port, '/r/AB3');
    const escape = await rawUpgrade(port, '/r/%zz');
    const nowhere = await rawUpgrade(port, '/nope');
    assert.equal(headOf(short), 'HTTP/1.1 404 Not Found', '3 位码按 404');
    assert.equal(headOf(escape), 'HTTP/1.1 400 Bad Request', '坏转义按 400');
    assert.equal(headOf(nowhere), 'HTTP/1.1 404 Not Found', '非 /r/ 路径按 404');
    const bodies = [bodyOf(short), bodyOf(escape), bodyOf(nowhere)];
    assert.equal(new Set(bodies).size, 3, `三档正文必须两两不同，实得 ${JSON.stringify(bodies)}`);
    assert.match(bodies[0] ?? '', /room code must be 4 chars/, '码形状那一档要说清字母表');
    assert.match(bodies[1] ?? '', /malformed percent-escape/, '转义那一档要说清是转义的错');
    assert.match(bodies[2] ?? '', /only \/ \(default room\) and \/r\//, '路径那一档要说清端点只有两种');
    for (const r of [short, escape, nowhere]) assert.match(r, /Connection: close/, '拒绝必须显式关连接');
    assert.deepEqual(hub.rooms(), [], '被拒的升级不许建出任何桌');
    note(`hub/07 三档拒绝正文互不相同：${bodies.join(' / ')}`);
  } finally {
    await hub.close();
  }
});

test('hub/08 Origin 守卫进了 hub 的握手链；query 不碍路由；undici 的现状钉成 note', async () => {
  const { hub } = makeHub();
  const port = await hub.listen(0);
  const base = `ws://127.0.0.1:${String(port)}`;
  try {
    // ① 跨源 Origin 打到码路径 ⇒ 403（ws/10 在 ws.ts 侧钉四态；这里证 hub 用的确实是同一条守卫链）
    const evil = await rawUpgrade(port, '/r/QQ2S', ['Origin: https://evil.com']);
    assert.equal(headOf(evil), 'HTTP/1.1 403 Forbidden', `跨源该 403，实得 ${headOf(evil)}`);
    assert.equal(bodyOf(evil), 'origin not allowed for this endpoint');
    assert.deepEqual(hub.rooms(), [], '被 403 的升级不许建桌');
    // ② 同 hostname 不同端口（vite dev 那条流）在码路径上也放行（101 之后服务端不关连接，
    //    closeOnHead 让裸管道读到响应头就自断收尾）
    const dev = await rawUpgrade(port, '/r/QQ2S', ['Origin: http://127.0.0.1:5173'], true);
    assert.equal(headOf(dev), 'HTTP/1.1 101 Switching Protocols', `同 hostname 跨端口该放行，实得 ${headOf(dev)}`);
    // ③ Node 全局 WebSocket（undici）不是浏览环境：连接带 query 也照常开桌 —— 本文件所有 connect()
    //    能通就是"它不发明 Origin（或发的 Origin 与 Host 同 hostname）"的持续证据；哪天 Node 改了
    //    行为（比如开始发 Origin: null），这些用例会先翻红，届时照着 ws/10 的四态重校口径。
    const viaUndici = await openTab(`${base}/r/NP4S?x=1`, '甲', 0x68000001);
    await waitUntil('undici 客户端开出带 query 的码桌', () => hub.rooms().some((r) => r.code === 'NP4S'));
    viaUndici.close();
    note('hub/08 Origin 守卫与 query 剥离都在 hub 的升级链上生效；undici 现状 = 不触发 Origin 守卫（用例持续盯）');
  } finally {
    await hub.close();
  }
});

test('hub/09 hosted 房间在 /rooms 里报 waiting（等待中/进行中的数据面），auto 房间恒 false', async () => {
  const { hub } = makeHub({ flow: 'hosted' });
  const port = await hub.listen(0);
  const base = `ws://127.0.0.1:${String(port)}`;
  const a = await openTab(`${base}/r/W8T4`, '甲', 0x69000001);
  try {
    await waitUntil('hosted 码桌建好', () => hub.rooms().length === 1);
    assert.equal(hub.rooms()[0]?.waiting, true, 'hosted 未开局 ⇒ 等待中');
    const viaHttp = (await (await fetch(`http://127.0.0.1:${String(port)}/rooms`)).json()) as { code: string; waiting: boolean }[];
    assert.equal(viaHttp[0]?.waiting, true, '/rooms 与进程内同源（大厅渲染的就是它）');
    // 两家准备 + 房主开始 ⇒ waiting 翻 false（进行中）
    const b = await openTab(`${base}/r/W8T4`, '乙', 0x69000002);
    a.send({ t: 'ready', on: true });
    b.send({ t: 'ready', on: true });
    await pumpUntil([a, b], () => (a.peer.info().table?.ready.length ?? 0) >= 2, '双准备上桌况');
    a.send({ t: 'begin' });
    await pumpUntil([a, b], () => hub.rooms()[0]?.waiting === false, '开局');
    b.close();
  } finally {
    a.close();
    await hub.close();
  }
  // auto 房间恒 false（对照）
  const autoHub = makeHub();
  const port2 = await autoHub.hub.listen(0);
  const c = await openTab(`ws://127.0.0.1:${String(port2)}/r/AUT7`, '丙', 0x69000003);
  try {
    await waitUntil('auto 码桌建好', () => autoHub.hub.rooms().length === 1);
    assert.equal(autoHub.hub.rooms()[0]?.waiting, false, 'auto 房间没有等待概念');
  } finally {
    c.close();
    await autoHub.hub.close();
  }
  note('hub/09 /rooms 的 waiting：hosted 未开局 true、开局后 false、auto 恒 false');
});
