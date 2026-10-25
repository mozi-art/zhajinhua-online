// M4 · 真实 WebSocket 服务端接线（node:http + node:net + 自家帧编解码，零第三方依赖）。
//
// 职责边界：本文件只做"socket ↔ 房间"的搬运与握手，不含任何规则判断。
//   - 握手：校验 Upgrade / Sec-WebSocket-Version=13 / Sec-WebSocket-Key，回 Sec-WebSocket-Accept；
//     客户端若声明子协议 zjh-m4-1 则原样回显（不声明也允许连上，兼容通用工具）。
//   - 收：字节 → FrameReader（要求掩码、长度最小编码、控制帧合法）→ 文本 → room.receiveText
//   - 发：room.pending → encodeDown（服务端自己也要过协议校验）→ 未掩码文本帧
//   - 时钟：真实 setTimeout；每次时钟回调后统一 flush，保证定时器触发的广播能落到 socket。
//
// M6 起本文件多了两个可复用的出口（其余用法不变）：
//   · createRoomEndpoint —— "一个房间 + 它名下的连接集 + 出口泵"的接线件。createWsRoom（单房间）
//     与 netx/hub.ts（多房间路由）共用这一份，握手后的字节搬运只有一份实现，两处才不会漂移。
//     真实熵源（randomBytes）与真实时钟都长在这个接线件里，不随房间搬家。
//   · checkUpgrade / originAllowed —— 握手守卫链（含 Origin 防跨站劫持那一道）。
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { presets } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import { createRoom } from './room.ts';
import type { Clock, Room, RoomInfo } from './room.ts';
import { closeCodeAllowed, encodeClose, encodeFrame, encodeText, FrameReader, handshakeAccept, OPCODE } from './frames.ts';
import type { Inbound } from './frames.ts';
import { encodeDown, PROTOCOL_ID } from './protocol.ts';
import type { Down, Roster } from './protocol.ts';

export type WsRoomOptions = {
  seats: Roster[];
  firstDealer?: number;
  rules?: Rules;
  turnMs?: number;
  nonceMs?: number;
  settleMs?: number;
  handGapMs?: number;
  // 房间进程要顺手把牌桌页面端出去（工单 §4 M5："一条命令起"）。ws.ts 本身不认识任何页面，
  // 所以这里只留一个出口：非 /health 的 HTTP 请求先问这个钩子，它答"我处理了"才算完。
  // 返回 false（或不挂这个钩子）就还是那句 404 —— 挂了钩子也不许悄悄吃掉 /health。
  onHttpRequest?: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean> | boolean) | undefined;
};

type Link = { id: string; socket: Duplex; reader: FrameReader; open: boolean };

function headerList(req: IncomingMessage, name: string): string[] {
  const v = req.headers[name];
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).join(',').split(',').map((s) => s.trim().toLowerCase());
}

// 握手层的拒绝：状态行 + `Connection: close` 之外，**每条 guard 带一段各不相同的纯文本正文**（rev=11 应修 2）。
// 为什么值得带：不带正文时我们答的 400 与 Node/llhttp 自己答的 400 是**同一串字节**
// （`.scratch/r12-fold.ts` 实测：obs-fold 折行、坏请求行、我们那四处 guard 全部逐字相同），
// 于是要判断"这个 400 是谁答的"只能开三个进程做 V8 覆盖差分 —— 复审第一版探针就在这里给出过假阳性。
// RFC 6455 §4.2.1 允许 4xx 带正文 ⇒ 统一形状、各异正文，运维与复审都一眼可归因。
export function refuseUpgrade(socket: Duplex, status: number, statusText: string, why: string, extraHeaders: string[] = []): void {
  const head = [
    `HTTP/1.1 ${String(status)} ${statusText}`,
    ...extraHeaders,
    'Connection: close',
    'content-type: text/plain; charset=utf-8',
  ];
  socket.write(`${head.join('\r\n')}\r\n\r\n${why}\n`);
  socket.end();
}

// —— Origin 守卫（CSWSH 缓解）：跨站网页不许开这条 WebSocket ——
// 规则取最小、越少例外越好背：
//   · 没有 Origin ⇒ 放行。浏览器同源/跨站都必带 Origin，不带它的是非浏览器工具（wscat、自家
//     真 socket 测试、Node 的全局 WebSocket——undici 不是浏览环境，实测不发明此头）。Host 也缺
//     的组合同样放行：两个头都没有的只会是手写客户端，威胁模型里那不是"别人的页面"。
//   · `Origin: null` ⇒ 拒。file:// 与沙箱 iframe 会被浏览器序列化成 null —— 本服务端的页面永远
//     从自己端口端出去，null 只可能来自别的载体。
//   · 其余 ⇒ Origin 的 hostname 必须与 Host 头的 hostname **等值**（忽略端口：vite dev 在
//     127.0.0.1:5173 端页面、连 127.0.0.1:8790 的 ws，是合法开发流，卡死它没有换来任何安全）。
//     **不做 localhost↔127.0.0.1 归一**：两者不等值，用 http://localhost 打开的人自己换 IP 访问
//     （README 写明"以 IP 访问"），规则不为一台机器的别名悄悄开口子。
// 边界（写在这里而不是让人猜）：hostname 等值不防 DNS rebinding——evil.com 解析到本机时 Host 与
// Origin 一起落在攻击者手里，两个"等值"的假头照样过。那是浏览器同源策略级的对抗，不在本项目
// 威胁模型内（README 已知边界一节交代过）。
function hostnameOfHttp(input: string): string | null {
  // Host 头是 authority（host[:port]），Origin 是完整 URL —— 前面补个方案两者就都走 URL 解析，
  // IPv6 的方括号也被统一剥掉（`http://[::1]:80` 的 hostname 就是 `::1`）。
  try {
    return new URL(input.includes('://') ? input : `http://${input}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function originAllowed(originRaw: string | undefined, hostRaw: string | undefined): boolean {
  const origin = typeof originRaw === 'string' ? originRaw.trim() : '';
  if (origin === '') return true; // 无 Origin：非浏览器工具
  if (origin.toLowerCase() === 'null') return false; // file:// / 沙箱
  const oHost = hostnameOfHttp(origin);
  const hHost = hostnameOfHttp(typeof hostRaw === 'string' ? hostRaw : '');
  if (oHost === null || hHost === null) return false; // 解析不出的 Origin 一律按跨源处理
  return oHost === hHost;
}

// 真实时钟（socket 层专用）：定时器一响，先把局面推进（room 内部的回调）再由端点统一 flush。
// 这里不给 now()：房间层的义务只有"到点叫我"，没有任何一处需要读真实时间（rev=8 应修 4）。
export function realClock(): Clock {
  return {
    after(ms: number, fn: () => void): () => void {
      const t = setTimeout(() => {
        fn();
      }, ms);
      return () => clearTimeout(t);
    },
  };
}

// —— 握手守卫链：全部通过才返回 accept；任何一条不过都已把拒绝写回 socket（各带独特正文）——
export type UpgradeCheck = { ok: true; accept: string; echoProtocol: boolean } | { ok: false };

export function checkUpgrade(req: IncomingMessage, socket: Duplex): UpgradeCheck {
  const upgrades = headerList(req, 'upgrade');
  if (!upgrades.includes('websocket')) {
    refuseUpgrade(socket, 400, 'Bad Request', 'upgrade header missing');
    return { ok: false };
  }
  if (!headerList(req, 'connection').includes('upgrade')) {
    refuseUpgrade(socket, 400, 'Bad Request', 'connection header lacks upgrade');
    return { ok: false };
  }
  const version = String(req.headers['sec-websocket-version'] ?? '');
  if (version === '') {
    // 4.2.2 第 3 步：|Sec-WebSocket-Version| 是握手必需字段，缺了就是普通 HTTP 请求
    refuseUpgrade(socket, 400, 'Bad Request', 'sec-websocket-version missing');
    return { ok: false };
  }
  if (version !== '13') {
    // RFC 6455 §4.2.2 第 4 步：版本不被支持 ⇒ MUST 回 426 Upgrade Required，
    // 并带 |Sec-WebSocket-Version| 列出服务端支持的版本。（425 是 RFC 8470 的 TLS 早数据码，用错地方了。）
    refuseUpgrade(socket, 426, 'Upgrade Required', 'version not supported', ['Sec-WebSocket-Version: 13']);
    return { ok: false };
  }
  const key = String(req.headers['sec-websocket-key'] ?? '');
  let accept: string;
  try {
    accept = handshakeAccept(key);
  } catch {
    refuseUpgrade(socket, 400, 'Bad Request', 'sec-websocket-key invalid');
    return { ok: false };
  }
  const origin = typeof req.headers['origin'] === 'string' ? req.headers['origin'] : undefined;
  if (!originAllowed(origin, typeof req.headers['host'] === 'string' ? req.headers['host'] : undefined)) {
    refuseUpgrade(socket, 403, 'Forbidden', 'origin not allowed for this endpoint');
    return { ok: false };
  }
  return { ok: true, accept, echoProtocol: headerList(req, 'sec-websocket-protocol').includes(PROTOCOL_ID.toLowerCase()) };
}

// —— 房间端点：一个房间 + 它名下的连接集 + 出口泵 ——
// createWsRoom（单房间）与 netx/hub.ts（多房间）共用这一份接线。时钟可注入（hub 测试用虚拟钟），
// 真实熵源固定在这里：份额与重连凭据都出自 randomBytes(16)，不许哪张桌自己换一个更弱的源。
export type RoomEndpointOptions = {
  seats: Roster[];
  firstDealer?: number | undefined;
  rules?: Rules | undefined;
  turnMs?: number | undefined;
  nonceMs?: number | undefined;
  settleMs?: number | undefined;
  handGapMs?: number | undefined;
  clock?: Clock | undefined;
  flow?: 'auto' | 'hosted' | undefined;
  // 连接数的两次过零迁移（空 ⇄ 非空）。hub 拿它做空桌驱逐的武装与取消；单房间不挂。
  onEmpty?: (() => void) | undefined;
  onActive?: (() => void) | undefined;
};

export type RoomEndpoint = {
  room: Room;
  // 守卫链已过（checkUpgrade.ok），这里只做剩下的"接线"：101、FrameReader、data/error/close。
  adopt(req: IncomingMessage, socket: Duplex, head: Buffer, accept: string, echoProtocol: boolean): void;
  linkCount(): number;
  flush(): void;
  // 收摊：给每条连接发 1001、从房间里除名、关掉房间调度（真实服务端退出时留着定时器进程就收不了尾）
  shutdown(): void;
};

export function createRoomEndpoint(options: RoomEndpointOptions): RoomEndpoint {
  const links = new Map<string, Link>();
  let connSeq = 0;

  function send(link: Link, msgs: Down[]): void {
    if (!link.open) return;
    for (const m of msgs) {
      let text: string;
      try {
        text = encodeDown(m); // 服务端出口也过协议校验：越界的下行在本地就炸，不发给对面
      } catch {
        dropLink(link, encodeClose(1011, 'server produced an invalid message'));
        return;
      }
      link.socket.write(encodeText(text));
    }
  }

  function flush(): void {
    for (const link of links.values()) send(link, room.pending(link.id));
  }

  // 房间的时钟在这里落地（注入或真实都一样）：定时器一响，先把局面推进（room 内部的回调）
  // 再把积压的下行刷出去 —— 托管、结算这些定时器触发的广播才落得到 socket。
  const innerClock: Clock = options.clock ?? realClock();
  const clock: Clock = {
    after(ms: number, fn: () => void): () => void {
      return innerClock.after(ms, () => {
        fn();
        flush();
      });
    },
  };

  const room: Room = createRoom({
    rules: options.rules ?? presets.classic,
    seats: options.seats,
    firstDealer: options.firstDealer ?? (options.seats[0]?.seat ?? 0),
    clock,
    flow: options.flow,
    entropy: () => randomBytes(16).toString('hex'),
    turnMs: options.turnMs,
    nonceMs: options.nonceMs,
    settleMs: options.settleMs,
    handGapMs: options.handGapMs,
  });

  function handleInbound(link: Link, items: Inbound[]): void {
    for (const item of items) {
      if (item.kind === 'text') {
        room.receiveText(link.id, item.text);
        // 一条上行可能引起面向全桌的广播（开局、别人的行动）⇒ 必须刷所有连接，
        // 只刷"发话这一条"会让别人的客户端一直收不到局面（真 socket 测试抓到过）。
        flush();
      } else if (item.kind === 'ping') {
        link.socket.write(encodeFrame(OPCODE.pong, item.payload));
      } else if (item.kind === 'close') {
        // 回声一个同样状态的关闭帧（只有线上合法的码才回；1005/1006 是保留值，不得出现在帧里）
        const echo = closeCodeAllowed(item.code) ? item.code : 1000;
        dropLink(link, encodeClose(echo));
      }
    }
  }

  // 断开：可选地先发一帧（close / 协议错误），然后关 socket 并把座位标成掉线。
  // 连接数过零 ⇄ 回正是 hub 驱逐的两个迁移点，在这里发事件（顺序：先除名、后通知，
  // 通知时 linkCount() 已是新值）。
  function dropLink(link: Link, frame: Uint8Array | null): void {
    if (link.open) {
      link.open = false;
      try {
        if (frame !== null) link.socket.write(frame);
      } catch {
        // 已经在断开流程里，忽略
      }
      link.socket.end();
    }
    room.close(link.id);
    links.delete(link.id);
    if (links.size === 0) options.onEmpty?.();
  }

  return {
    room,
    adopt(req: IncomingMessage, socket: Duplex, head: Buffer, accept: string, echoProtocol: boolean): void {
      const lines = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
      ];
      if (echoProtocol) lines.push(`Sec-WebSocket-Protocol: ${PROTOCOL_ID}`);
      const wasEmpty = links.size === 0;
      const id = `c${String((connSeq += 1))}`;
      const reader = new FrameReader({ masked: true });
      const link: Link = { id, socket, reader, open: true };
      links.set(id, link);
      room.open(id);
      if (wasEmpty && links.size > 0) options.onActive?.();
      socket.on('error', () => dropLink(link, null));
      socket.on('close', () => dropLink(link, null));
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head.length > 0) {
        try {
          handleInbound(link, reader.push(new Uint8Array(head)));
        } catch {
          dropLink(link, encodeClose(1002, 'protocol error'));
        }
      }
      socket.on('data', (chunk: Buffer) => {
        try {
          handleInbound(link, reader.push(new Uint8Array(chunk)));
        } catch {
          dropLink(link, encodeClose(1002, 'protocol error'));
        }
      });
    },
    linkCount(): number {
      return links.size;
    },
    flush,
    shutdown(): void {
      for (const link of [...links.values()]) dropLink(link, encodeClose(1001, 'room shutting down'));
      room.dispose(); // 关掉房间里的定时器，否则进程收不了尾
    },
  };
}

export function createWsRoom(options: WsRoomOptions) {
  const endpoint = createRoomEndpoint({
    seats: options.seats,
    firstDealer: options.firstDealer,
    rules: options.rules,
    turnMs: options.turnMs,
    nonceMs: options.nonceMs,
    settleMs: options.settleMs,
    handGapMs: options.handGapMs,
  });

  const http: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = (req.url ?? '').split('?')[0] ?? '';
      if (url === '/health') {
        const info = endpoint.room.info();
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            protocol: PROTOCOL_ID,
            hand: info.hand,
            phase: info.phase,
            seated: info.seated,
            connections: info.connections.length,
            over: info.over,
            fault: info.fault,
          }),
        );
        return;
      }
      if (options.onHttpRequest !== undefined) {
        try {
          if (await options.onHttpRequest(req, res)) return;
        } catch (err) {
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(`room handler failed: ${String((err as Error).message)}\n`);
          return;
        }
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('this endpoint is a websocket room; see /health for status\n');
    })();
  });

  http.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const check = checkUpgrade(req, socket);
    if (!check.ok) return;
    endpoint.adopt(req, socket, head, check.accept, check.echoProtocol);
  });

  return {
    http,
    room: endpoint.room,
    listen(port: number, host = '127.0.0.1'): Promise<number> {
      return new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => {
          const address = http.address();
          resolve(address === null || typeof address === 'string' ? port : address.port);
        });
      });
    },
    // 时钟回调里产生的广播要能落到 socket：每次 tick 之后统一 flush
    flush: endpoint.flush,
    info(): RoomInfo {
      return endpoint.room.info();
    },
    close(): Promise<void> {
      endpoint.shutdown();
      return new Promise((resolve) => {
        http.close(() => resolve());
      });
    },
  };
}

export type WsRoom = ReturnType<typeof createWsRoom>;
