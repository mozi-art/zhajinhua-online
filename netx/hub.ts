// M6 · 多房间路由：一个 http 服务 + 按升级路径区分的多张桌。
//
// 路由口径（顺序钉死，不许各处各写一份）：
//   `/`（含空路径）      —— 默认房间。行为与 M4/M5 的单房间逐字一致（/health 的字段、startRoom 语义），
//                            rev=3 起的证据链都以它为入口，多房间不许动它一个字节。
//   `/r/CODE`           —— 码房间。CODE = 4 位房间码（normalizeRoomCode 的字母表），先剥 query、
//                            再 decodeURIComponent（坏转义按 400 拒）、再大写化、最后过字母表 ——
//                            这条顺序天然挡掉 `/r/%2e%2e`、`/r/..` 之类的穿越串（码里没有点与斜杠的位置）。
//                            首次连入即建房、同码复用；空置到点回收（见下）。
//   其余路径            —— 404，带自己的正文（与握手层那条 404 文案不同源）。
//
// 两条资源纪律：
//   · maxRooms：码房间硬上限（默认 64）。"首连即建房"意味着不加限额的话，局域网里任何人都能
//     刷出大量房间（每间一个权威房间 + 一整套定时器）⇒ 超限一律 503 + 独特正文，存量房间照常服务。
//   · 空桌驱逐：码房间连接数归零起表（idleMs，默认 30 分钟），期间有人回来就取消；默认房间永不
//     驱逐（它是 /health 与历史入口的锚）。驱逐 = shutdown（发 1001、dispose 定时器、出册），
//     同一个码下次被连入时会得到一张全新的桌 —— 旧 token 随旧房间一起消失。
//
// 本文件是 socket 层（SOCKET_LAYER）：node:http 与真实时钟都允许出现在这。时钟可注入（RoomEndpoint
// 里的定时器跟着这一份走），测试注入 FakeClock 后"驱逐到点 / 取消 / 收桌"全是虚拟钟驱动的确定性断言。
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Rules } from '../src/rules.ts';
import type { Clock, Room, RoomInfo } from './room.ts';
import { checkUpgrade, createRoomEndpoint, realClock, refuseUpgrade } from './ws.ts';
import type { RoomEndpoint } from './ws.ts';
import { normalizeRoomCode, PROTOCOL_ID } from './protocol.ts';

export const DEFAULT_IDLE_MS = 30 * 60 * 1000;
export const DEFAULT_MAX_ROOMS = 64;

export type HubOptions = {
  seats?: number | undefined;
  firstDealer?: number | undefined;
  rules?: Rules | undefined;
  turnMs?: number | undefined;
  nonceMs?: number | undefined;
  settleMs?: number | undefined;
  handGapMs?: number | undefined;
  idleMs?: number | undefined;
  maxRooms?: number | undefined;
  flow?: 'auto' | 'hosted' | undefined;
  clock?: Clock | undefined;
  onHttpRequest?: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean> | boolean) | undefined;
};

export type RoomSummary = {
  code: string;
  // 已入座（付过买入）的人数；与"活连接数"分开报 —— 断线的座位还在桌上（托管中）
  seated: number;
  connections: number;
  phase: string;
  hand: number;
  // hosted 房间还没开过任何一手（等待/准备期）。大厅据此显示「等待中/进行中」——
  // 刻意不加进 phase 联合（phase 的取值被既有用例钉着），纯加法布尔。
  waiting: boolean;
};

type CodeRoom = { code: string; endpoint: RoomEndpoint; evict: (() => void) | null };

// 升级路径 → 路由判定。纯函数（错误也只描述、不写 socket），hub/01 直接测它。
export type RoomRoute =
  | { kind: 'default' }
  | { kind: 'code'; code: string }
  | { kind: 'refuse'; status: number; statusText: string; why: string };

export function routeOf(url: string): RoomRoute {
  const raw = (url.split('?')[0] ?? '/') || '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: 'refuse', status: 400, statusText: 'Bad Request', why: 'malformed percent-escape in upgrade path' };
  }
  if (decoded === '/' || decoded === '') return { kind: 'default' };
  if (!decoded.startsWith('/r/')) {
    return { kind: 'refuse', status: 404, statusText: 'Not Found', why: 'only / (default room) and /r/<code> are websocket endpoints' };
  }
  const code = normalizeRoomCode(decoded.slice(3));
  if (code === null) {
    return { kind: 'refuse', status: 404, statusText: 'Not Found', why: 'room code must be 4 chars (alphabet has no O/I/L/0/1)' };
  }
  return { kind: 'code', code };
}

export function createHub(options: HubOptions) {
  const seatCount = options.seats ?? 6;
  const seatRoster = () => Array.from({ length: seatCount }, (_, i) => ({ seat: i, name: `座位${String(i)}` }));
  const clock: Clock = options.clock ?? realClock();
  const idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
  const maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;

  const rooms = new Map<string, CodeRoom>();

  function endpointOf(hooks?: { onEmpty?: () => void; onActive?: () => void }): RoomEndpoint {
    return createRoomEndpoint({
      seats: seatRoster(),
      firstDealer: options.firstDealer ?? 0,
      rules: options.rules,
      turnMs: options.turnMs,
      nonceMs: options.nonceMs,
      settleMs: options.settleMs,
      handGapMs: options.handGapMs,
      clock,
      flow: options.flow,
      onEmpty: hooks?.onEmpty,
      onActive: hooks?.onActive,
    });
  }

  // 默认房间：进程起来就存在（/health 要能立刻报它），永不驱逐。
  const defaultEndpoint = endpointOf();

  function cancelEvict(r: CodeRoom): void {
    if (r.evict !== null) {
      r.evict();
      r.evict = null;
    }
  }

  function evictNow(code: string): void {
    const r = rooms.get(code);
    if (r === undefined) return;
    if (r.endpoint.linkCount() > 0) return; // 计数已回正：与 onActive 的取消互为双保险（hub/06 的变异靶）
    // 先出册再收摊：shutdown 会摘掉最后一条连接并触发 onEmpty，那一眼必须看到"本房间已不在册"，
    // 否则会给一张已经死了的桌再挂一张 30 分钟的驱逐表（真时钟下进程就收不了尾了）。
    r.evict = null;
    rooms.delete(code);
    r.endpoint.shutdown();
  }

  // 码房间：已有则复用（并取消它名下挂着的驱逐表）；没有则在限额内新建。
  // 返回 null 表示已被拒绝（503 已写回 socket），调用方直接返回。
  function codeRoom(code: string, socket: Duplex): RoomEndpoint | null {
    const existing = rooms.get(code);
    if (existing !== undefined) {
      cancelEvict(existing);
      return existing.endpoint;
    }
    if (rooms.size >= maxRooms) {
      refuseUpgrade(
        socket,
        503,
        'Service Unavailable',
        `room limit reached (${String(maxRooms)}), join an existing room instead`,
      );
      return null;
    }
    let r: CodeRoom; // 两个迁移钩子都只在 adopt/dropLink 时才会跑，那时 r 早已就位
    const endpoint = endpointOf({
      // 空 ⇄ 非空的两次迁移就是驱逐的武装与取消。取消有两处（onActive 这里 + codeRoom 的复用路径），
      // 互为双保险 —— 单摘一处会被另一处掩盖，hub/06 用 clock.pending()===0 钉住"取消确实发生了"
      // （变异实测：两处都摘 ⇒ pending 悬着 1 ⇒ 翻红）。
      onEmpty: () => {
        if (!rooms.has(code)) return; // 收摊过程中的那次过零不武装（见 evictNow 的出册顺序）
        r.evict = clock.after(idleMs, () => evictNow(code));
      },
      onActive: () => {
        cancelEvict(r);
      },
    });
    r = { code, endpoint, evict: null };
    rooms.set(code, r);
    endpoint.room.start(); // 码房间没有外部 start 调用点：建出来就该能开局
    return endpoint;
  }

  function summaries(): RoomSummary[] {
    return [...rooms.keys()]
      .sort()
      .map((code) => {
        const info = (rooms.get(code) as CodeRoom).endpoint.room.info();
        return {
          code,
          seated: info.chips.length,
          connections: info.connections.filter((c) => c.seat !== null).length,
          phase: info.phase,
          hand: info.hand,
          waiting: info.waiting,
        };
      });
  }

  const http: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = (req.url ?? '').split('?')[0] ?? '';
      if (url === '/health') {
        // 字段与 M5 的单房间逐字一致（srv/01 钉着）；多出来的只有 rooms（码房间数，默认房间不计）
        const info = defaultEndpoint.room.info();
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
            rooms: rooms.size,
          }),
        );
        return;
      }
      if (url === '/rooms') {
        // 大厅的数据面：不含默认房间（它永远存在、不是"码房间"，列出来只会占一个恒定的头名）
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(summaries()));
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
    const check = checkUpgrade(req, socket); // 守卫链（含 Origin 那道）在这里，两处入口共用
    if (!check.ok) return;
    const route = routeOf(req.url ?? '/');
    if (route.kind === 'refuse') {
      refuseUpgrade(socket, route.status, route.statusText, route.why);
      return;
    }
    if (route.kind === 'default') {
      defaultEndpoint.adopt(req, socket, head, check.accept, check.echoProtocol);
      return;
    }
    const endpoint = codeRoom(route.code, socket);
    if (endpoint === null) return;
    endpoint.adopt(req, socket, head, check.accept, check.echoProtocol);
  });

  function flushAll(): void {
    defaultEndpoint.flush();
    for (const code of [...rooms.keys()].sort()) (rooms.get(code) as CodeRoom).endpoint.flush();
  }

  return {
    http,
    room: defaultEndpoint.room as Room,
    listen(port: number, host = '127.0.0.1'): Promise<number> {
      return new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, () => {
          const address = http.address();
          resolve(address === null || typeof address === 'string' ? port : address.port);
        });
      });
    },
    flush: flushAll,
    info(): RoomInfo {
      return defaultEndpoint.room.info();
    },
    rooms(): RoomSummary[] {
      return summaries();
    },
    close(): Promise<void> {
      // 收摊顺序与 evictNow 同一条纪律：先把驱逐表全摘掉、把码房间**出册**，再逐张 shutdown ——
      // shutdown 摘最后一条连接会触发 onEmpty，那一眼必须看到"本房间已不在册"，否则会给死桌
      // 再挂一张 30 分钟的定时器（真时钟下进程就收不了尾，srv/03 的 quit→退出码 0 会挂住）。
      for (const code of [...rooms.keys()].sort()) cancelEvict(rooms.get(code) as CodeRoom);
      const endpoints = [...rooms.keys()].sort().map((code) => (rooms.get(code) as CodeRoom).endpoint);
      rooms.clear();
      defaultEndpoint.shutdown();
      for (const e of endpoints) e.shutdown();
      return new Promise((resolve) => {
        http.close(() => resolve());
      });
    },
  };
}

export type Hub = ReturnType<typeof createHub>;
