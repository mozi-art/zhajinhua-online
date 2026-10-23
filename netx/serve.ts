// M4/M5 · 房间进程入口：`node netx/serve.ts [端口]`（默认 DEFAULT_ROOM_PORT，只绑 127.0.0.1）。
//
// 这是**组合根**：整个联机层里唯一同时认识"房间层"和"页面静态服务"两个模块的文件，
// 所以它反过来谁都不许认识（nst/04 钉的是 src/webui/webmin 不许 import netx；这里是 netx 的一次性
// 装配脚本，不被任何库 import，测试只 import 下面那个 startRoom）。
//
// M5 起它同时端出 webui 页面：`http://127.0.0.1:端口/` 打开就是牌桌，联机模式连的 ws 地址就是同一个
// 端口 —— 工单 §4 M5 要的是"一条命令起、干净退出、端口可配置、/health 保持"，两件事不必开两个进程。
// 服务端 AI 填座不在 M5 范围内（工单原话）：座位不够时就是"人不够"，页面会看见。
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWsRoom } from './ws.ts';
import type { WsRoom } from './ws.ts';
import { PROTOCOL_ID } from './protocol.ts';
import { serveStatic } from '../webmin/serve.ts';

export const DEFAULT_ROOM_PORT = 8790;
export const ROOM_SEATS = 6;
export const MIN_BUY_IN = 256;

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
  info: WsRoom['info'];
  close(): Promise<void>;
};

export async function startRoom(options: StartRoomOptions = {}): Promise<RunningRoom> {
  const seats = options.seats ?? ROOM_SEATS;
  const host = options.host ?? '127.0.0.1';
  const ws = createWsRoom({
    seats: Array.from({ length: seats }, (_, i) => ({ seat: i, name: `座位${String(i)}` })),
    firstDealer: 0,
    turnMs: options.turnMs ?? 30000,
    nonceMs: options.nonceMs ?? 15000,
    settleMs: options.settleMs ?? 4000,
    handGapMs: options.handGapMs ?? 6000,
    onHttpRequest: options.static === false ? undefined : (req, res) => serveStatic(req, res),
  });
  const port = await ws.listen(options.port ?? DEFAULT_ROOM_PORT, host);
  ws.room.start();
  const origin = `http://${host}:${String(port)}/`;
  return {
    port,
    wsUrl: `ws://${host}:${String(port)}`,
    httpUrl: origin,
    uiUrl: `${origin}webui/`,
    info: () => ws.info(),
    close: () => ws.close(),
  };
}

function portFromArgv(): number {
  const raw = process.argv[2] ?? process.env['PORT'] ?? String(DEFAULT_ROOM_PORT);
  const n = Number(raw);
  // 允许 0：让内核挑一个空闲端口（测试起真进程时用，打印出来的那一行里就是真实端口）
  return Number.isInteger(n) && n >= 0 && n < 65536 ? n : Number.NaN;
}

// 只在被当作主模块直接运行时才起进程（测试 import startRoom 时不许顺手监听）。
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const port = portFromArgv();
  if (Number.isNaN(port)) {
    process.stderr.write(`bad port: ${String(process.argv[2])}\n`);
    process.exitCode = 2;
  } else {
    const running = await startRoom({ port });
    process.stdout.write(
      `炸金花房间 · ws ${running.wsUrl} · 页面 ${running.uiUrl} · 健康检查 ${running.httpUrl}health\n` +
        `子协议 "${PROTOCOL_ID}"，座位 ${String(ROOM_SEATS)} 个，最低买入 ${String(MIN_BUY_IN)}。Ctrl+C 停；或输一行 quit 回车。\n`,
    );
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
