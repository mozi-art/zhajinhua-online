// M4 · 真实 WebSocket 服务端接线（node:http + node:net + 自家帧编解码，零第三方依赖）。
//
// 职责边界：本文件只做"socket ↔ 房间"的搬运与握手，不含任何规则判断。
//   - 握手：校验 Upgrade / Sec-WebSocket-Version=13 / Sec-WebSocket-Key，回 Sec-WebSocket-Accept；
//     客户端若声明子协议 zjh-m4-1 则原样回显（不声明也允许连上，兼容通用工具）。
//   - 收：字节 → FrameReader（要求掩码、长度最小编码、控制帧合法）→ 文本 → room.receiveText
//   - 发：room.pending → encodeDown（服务端自己也要过协议校验）→ 未掩码文本帧
//   - 时钟：真实 setTimeout；每次时钟回调后统一 flush，保证定时器触发的广播能落到 socket。
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
function refuseUpgrade(socket: Duplex, status: number, statusText: string, why: string, extraHeaders: string[] = []): void {
  const head = [
    `HTTP/1.1 ${String(status)} ${statusText}`,
    ...extraHeaders,
    'Connection: close',
    'content-type: text/plain; charset=utf-8',
  ];
  socket.write(`${head.join('\r\n')}\r\n\r\n${why}\n`);
  socket.end();
}

export function createWsRoom(options: WsRoomOptions) {
  const links = new Map<string, Link>();
  let connSeq = 0;

  // 房间的时钟在这里落地：定时器一响，先把局面推进（room 内部的回调）再把积压的下行刷出去。
  // 这里不给 now()：房间层的义务只有"到点叫我"，没有任何一处需要读真实时间（rev=8 应修 4）。
  const clock: Clock = {
    after(ms: number, fn: () => void): () => void {
      const t = setTimeout(() => {
        fn();
        flush();
      }, ms);
      return () => clearTimeout(t);
    },
  };

  const room: Room = createRoom({
    rules: options.rules ?? presets.classic,
    seats: options.seats,
    firstDealer: options.firstDealer ?? (options.seats[0]?.seat ?? 0),
    clock,
    entropy: () => randomBytes(16).toString('hex'),
    turnMs: options.turnMs,
    nonceMs: options.nonceMs,
    settleMs: options.settleMs,
    handGapMs: options.handGapMs,
  });

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
    flush();
  }

  const http: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = (req.url ?? '').split('?')[0] ?? '';
      if (url === '/health') {
        const info = room.info();
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
    const upgrades = headerList(req, 'upgrade');
    if (!upgrades.includes('websocket')) {
      refuseUpgrade(socket, 400, 'Bad Request', 'upgrade header missing');
      return;
    }
    if (!headerList(req, 'connection').includes('upgrade')) {
      refuseUpgrade(socket, 400, 'Bad Request', 'connection header lacks upgrade');
      return;
    }
    const version = String(req.headers['sec-websocket-version'] ?? '');
    if (version === '') {
      // 4.2.2 第 3 步：|Sec-WebSocket-Version| 是握手必需字段，缺了就是普通 HTTP 请求
      refuseUpgrade(socket, 400, 'Bad Request', 'sec-websocket-version missing');
      return;
    }
    if (version !== '13') {
      // RFC 6455 §4.2.2 第 4 步：版本不被支持 ⇒ MUST 回 426 Upgrade Required，
      // 并带 |Sec-WebSocket-Version| 列出服务端支持的版本。（425 是 RFC 8470 的 TLS 早数据码，用错地方了。）
      refuseUpgrade(socket, 426, 'Upgrade Required', 'version not supported', ['Sec-WebSocket-Version: 13']);
      return;
    }
    const key = String(req.headers['sec-websocket-key'] ?? '');
    let accept: string;
    try {
      accept = handshakeAccept(key);
    } catch {
      refuseUpgrade(socket, 400, 'Bad Request', 'sec-websocket-key invalid');
      return;
    }
    const requested = headerList(req, 'sec-websocket-protocol');
    const lines = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
    ];
    if (requested.includes(PROTOCOL_ID.toLowerCase())) lines.push(`Sec-WebSocket-Protocol: ${PROTOCOL_ID}`);
    const id = `c${String((connSeq += 1))}`;
    const reader = new FrameReader({ masked: true });
    const link: Link = { id, socket, reader, open: true };
    links.set(id, link);
    room.open(id);
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
  });

  return {
    http,
    room,
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
    flush,
    info(): RoomInfo {
      return room.info();
    },
    close(): Promise<void> {
      for (const link of [...links.values()]) dropLink(link, encodeClose(1001, 'room shutting down'));
      room.dispose(); // 关掉房间里的定时器，否则进程收不了尾
      return new Promise((resolve) => {
        http.close(() => resolve());
      });
    },
  };
}

export type WsRoom = ReturnType<typeof createWsRoom>;
