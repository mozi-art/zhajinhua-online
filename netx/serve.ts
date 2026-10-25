// M4/M5/M6 · 房间进程入口：`node netx/serve.ts [端口] [--host 绑定地址]`（默认 8790 / 127.0.0.1）。
//
// 这是**组合根**：整个联机层里唯一同时认识"房间层"和"页面静态服务"两个模块的文件，
// 所以它反过来谁都不许认识（nst/04 钉的是 src/webui/webmin 不许 import netx；这里是 netx 的一次性
// 装配脚本，不被任何库 import，测试只 import 下面那些纯函数与 startRoom）。
//
// M5 起它同时端出 webui 页面：`http://127.0.0.1:端口/` 打开就是牌桌，联机模式连的 ws 地址就是同一个
// 端口 —— 工单 §4 M5 要的是"一条命令起、干净退出、端口可配置、/health 保持"，两件事不必开两个进程。
// M6 起一个进程端多张桌：`/` 仍是那张默认桌（行为不动），`/r/房间码` 是新桌，`/lobby` 是大厅页。
// 服务端 AI 填座仍不在范围内（工单原话）：座位不够时就是"人不够"，页面会看见。
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHub } from './hub.ts';
import type { Hub, RoomSummary } from './hub.ts';
import type { RoomInfo } from './room.ts';
import { PROTOCOL_ID } from './protocol.ts';
import { serveStatic } from '../webmin/serve.ts';

export const DEFAULT_ROOM_PORT = 8790;
export const DEFAULT_HOST = '127.0.0.1';
export const ROOM_SEATS = 6;
export const MIN_BUY_IN = 256;

// —— CLI 参数解析（纯函数，测试直接打它，不起子进程）——
// 历史形态 `serve.ts 8790` / `serve.ts 0` / 坏端口退出码 2 一律不变；`--host H` 可出现在任意位置，
// 且**不占端口的位置**（`--host 0.0.0.0 9000` 与 `9000 --host 0.0.0.0` 同解）。HOST 环境变量与
// PORT 对称：只在命令行没提时兜底。
export type ParsedArgs = { port: number; host: string } | { error: 'port' | 'host'; raw: string };

// host 合法口径：IPv4 / IPv6（可带方括号）/ 主机名 / 通配，一个字符类说完 ——
// 不含空格、斜杠、百分号这些会混进 URL 或被 shell 拆开的字符；不许以 "-" 开头（那是下一个旗标）。
const HOST_RE = /^[0-9A-Za-z._:[\]-]{1,75}$/;

function hostOk(raw: string): boolean {
  return !raw.startsWith('-') && HOST_RE.test(raw);
}

export function parseRoomArgs(argv: readonly string[], env: { PORT?: string | undefined; HOST?: string | undefined } = {}): ParsedArgs {
  const positional: string[] = [];
  let host: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (a === '--host') {
      const v = argv[i + 1];
      // 缺值（旗标收尾）或值是下一个旗标 ⇒ 与坏值同档，raw 印旗标本身（"--host 后面没有值"读得出来）
      if (v === undefined || v.startsWith('--')) return { error: 'host', raw: a };
      if (!hostOk(v)) return { error: 'host', raw: v };
      host = v;
      i += 1;
    } else {
      positional.push(a);
    }
  }
  const rawPort = positional[0] ?? env['PORT'] ?? String(DEFAULT_ROOM_PORT);
  const n = Number(rawPort);
  // 允许 0：让内核挑一个空闲端口（测试起真进程时用，打印出来的那一行里就是真实端口）
  if (!(Number.isInteger(n) && n >= 0 && n < 65536)) return { error: 'port', raw: rawPort };
  const hostRaw = host ?? env['HOST'] ?? DEFAULT_HOST;
  if (!hostOk(hostRaw)) return { error: 'host', raw: hostRaw };
  return { port: n, host: hostRaw };
}

// —— 局域网地址枚举（纯函数；真网卡由调用处注入，测试喂假数据 ⇒ 双跑与机器无关）——
// 只认 IPv4：`--host 0.0.0.0` 时把"别的机器真的连得上"的地址逐个印出来。IPv6（含 :: 通配）刻意
// 不枚举 —— link-local 要带 zone、地址要加方括号，印出来一排多半连不上的东西比不印更糟
// （IPv6 通配的横幅另有说明行）。排序用默认码点序，多网卡去重 ⇒ 输出确定。
export type NetIfaces = Record<string, { family: string; address: string; internal: boolean }[]>;

export function lanAddresses(interfaces: NetIfaces, port: number): string[] {
  const seen = new Set<string>();
  for (const list of Object.values(interfaces)) {
    for (const ni of list ?? []) {
      if (ni.family !== 'IPv4' || ni.internal) continue;
      seen.add(`ws://${ni.address}:${String(port)}`);
    }
  }
  return [...seen].sort();
}

export type StartRoomOptions = {
  port?: number;
  seats?: number;
  host?: string;
  turnMs?: number;
  nonceMs?: number;
  settleMs?: number;
  handGapMs?: number;
  // 关掉静态页面（只想要一个纯 ws 端点时用）
  static?: boolean;
  idleMs?: number;
  maxRooms?: number;
  // 流程口径：默认 auto（与既有测试口径一致）；CLI 产品入口传 hosted（等待/准备/房主开始/续局）
  flow?: 'auto' | 'hosted';
  // 网卡快照的注入点（默认真 os.networkInterfaces）。lanAddresses/横幅的可测性全靠它。
  interfaces?: (() => NetIfaces) | undefined;
};

export type RunningRoom = {
  port: number;
  wsUrl: string;
  // 房间进程的**源**（末尾带斜杠）：`/health`、静态资源的 URL 都从它拼出来。
  // 它不是给用户点的那个链接 —— 见 uiUrl。
  httpUrl: string;
  // 给用户点的那一个：直达 M5 联机页。必修 1 的成因是 `/` 按 webmin/serve.ts 的口径 302 到
  // M1.5 那个零联机控件的单机页（那条映射本身要保留：rev=3–5 的复跑命令与验收证据都以它为入口），
  // 所以横幅里印的必须是 `/webui/`，而不是让操作员自己猜。
  uiUrl: string;
  // 绑定是通配（0.0.0.0）时 wsUrl 连不上（没人能连 0.0.0.0），真正可点的地址在这里。
  // 默认/具体 host 时为空数组 —— 那两种情况 wsUrl 本身就是可点的，不重复报。
  lanUrls: string[];
  info: () => RoomInfo;
  rooms: () => RoomSummary[];
  close(): Promise<void>;
};

export async function startRoom(options: StartRoomOptions = {}): Promise<RunningRoom> {
  const seats = options.seats ?? ROOM_SEATS;
  const host = options.host ?? DEFAULT_HOST;
  const hub: Hub = createHub({
    seats,
    firstDealer: 0,
    turnMs: options.turnMs ?? 30000,
    nonceMs: options.nonceMs ?? 15000,
    settleMs: options.settleMs ?? 4000,
    handGapMs: options.handGapMs ?? 6000,
    idleMs: options.idleMs,
    maxRooms: options.maxRooms,
    flow: options.flow,
    onHttpRequest: options.static === false ? undefined : (req, res) => serveStatic(req, res),
  });
  const port = await hub.listen(options.port ?? DEFAULT_ROOM_PORT, host);
  hub.room.start();
  const origin = `http://${host}:${String(port)}/`;
  const interfaces = options.interfaces ?? (() => networkInterfaces() as unknown as NetIfaces);
  const lanUrls = host === '0.0.0.0' ? lanAddresses(interfaces(), port) : [];
  return {
    port,
    wsUrl: `ws://${host}:${String(port)}`,
    httpUrl: origin,
    uiUrl: `${origin}webui/`,
    lanUrls,
    info: () => hub.info(),
    rooms: () => hub.rooms(),
    close: () => hub.close(),
  };
}

// —— 横幅（纯函数）——
// 默认 host 时前两行**逐字**沿用 M5 的那两行（子进程测试的正则、srv/03 的座位/买入文案都钉着）；
// 绑定面变宽只许**追加**行，不许改前两行：
//   · 具体地址（--host 192.168.x.x）：不追加 —— 用户点名了地址，横幅里的 ws:// 页面 http:// 就是它。
//   · 0.0.0.0：逐行印 lanUrls（可点的局域网地址；一枚举不到也要说一声，而不是静默）。
//   · :: / [::]：IPv6 通配不枚举地址（见 lanAddresses 的口径），但要说清"用具体 IPv6 访问"。
export function bannerLines(parts: { wsUrl: string; uiUrl: string; httpUrl: string; lanUrls: string[] }, host: string): string[] {
  const line1 = `炸金花房间 · ws ${parts.wsUrl} · 页面 ${parts.uiUrl} · 健康检查 ${parts.httpUrl}health`;
  const line2 = `子协议 "${PROTOCOL_ID}"，座位 ${String(ROOM_SEATS)} 个，最低买入 ${String(MIN_BUY_IN)}。Ctrl+C 停；或输一行 quit 回车。`;
  const extras: string[] = [];
  if (host === '0.0.0.0') {
    for (const u of parts.lanUrls) extras.push(`局域网 ${u}（页面 ${u.replace('ws://', 'http://')}/webui/）`);
    if (parts.lanUrls.length === 0) extras.push('（绑定 0.0.0.0，但没枚举到任何局域网 IPv4 地址）');
  } else if (host === '::' || host === '[::]') {
    extras.push('（IPv6 通配绑定：不枚举局域网地址，请用本机的具体 IPv6 地址访问）');
  }
  return [line1, line2, ...extras];
}

// 只在被当作主模块直接运行时才起进程（测试 import startRoom 时不许顺手监听）。
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const parsed = parseRoomArgs(process.argv.slice(2), { PORT: process.env['PORT'], HOST: process.env['HOST'] });
  if ('error' in parsed) {
    process.stderr.write(`bad ${parsed.error}: ${parsed.raw}\n`);
    process.exitCode = 2;
  } else {
    // 产品入口用 hosted 流程：等待 → 准备 → 房主开始 → 结算暂停 → 房主续局（auto 只是兼容/脚本口径）
    const running = await startRoom({ port: parsed.port, host: parsed.host, flow: 'hosted' });
    for (const line of bannerLines(running, parsed.host)) process.stdout.write(`${line}\n`);
    let stopping = false;
    const stop = (signal: string): void => {
      if (stopping) return;
      stopping = true;
      process.stdout.write(`收到 ${signal}，正在收尾…\n`);
      void running
        .close()
        .then(() => {
          process.stdout.write('已全部关闭，退出。\n');
          process.exit(0);
        })
        .catch((err: unknown) => {
          process.stderr.write(`收尾失败：${String(err)}\n`);
          process.exit(1);
        });
    };
    process.on('SIGINT', () => stop('SIGINT'));
    process.on('SIGTERM', () => stop('SIGTERM'));
    // 再给一条"能被人从管道里驱动"的收尾路径：输一行 quit。
    // 不是多余的便利品 —— Windows 下 SIGINT 根本投不给被 spawn 起来的子进程（libuv 只能 TerminateProcess，
    // 那是硬杀，走不到上面那两行），于是"干净退出"这件事在 Windows 上就没法被测。有了这一行，
    // 子进程测试（srv/03）在任何平台上量的都是同一条收尾路径。只对真正出现的 "quit" 一行反应，
    // 单纯 EOF（比如被 `</dev/null` 起来）不算停机命令。
    let inbuf = '';
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => {
        inbuf += chunk;
        if(/(^|\n)quit(\n|$)/.test(inbuf)) stop('stdin:quit');
      });
      process.stdin.resume();
    } catch {
      // 没有可读的 stdin（被重定向关掉了）⇒ 只剩信号那两条路
    }
  }
}
