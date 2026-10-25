// M1.5 · 零依赖本地静态服务：node:http + node:module 的 stripTypeScriptTypes()。
// 只做一件事：把 webmin/ 、webui/ 与 src/ 下的 .html/.ts/.css 交给浏览器，.ts 现场抹掉类型标注。
// 只监听 127.0.0.1；只允许这三个目录；路径穿越一律拒绝。
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
// webmin/ = M1.5 最小可玩版（rev=3 起的全部证据与测试面所指）；
// webui/  = M3 正式 UI（Canvas）。两个目录并存，互不改动，服务层只是都放行。
const ALLOW_DIRS = ['webmin', 'webui', 'src'];
// M5 起页面里多了联机那条路：webui/netplay.ts 必须直接复用 netx/client.ts 那道墙（工单 §4 M5 的原话，
// 另写一份客户端协议实现按 §5 禁令同级处理）。浏览器要真去 fetch 那四个文件，所以这里逐个点名放行 ——
// **只放行可移植的那四个**：netx/room.ts（权威房间）、netx/ws.ts + netx/serve.ts（真 socket 与进程入口）、
// netx/frames.ts（帧实现）都不在列，它们是服务端-side 的代码，页面用不到，也不该被端出去。
// 这条清单是"文件名白名单"而不是"再开一个目录"，就是为了防止哪天有人往 netx/ 里新增一个服务端文件
// 却被目录规则顺手放行。（nui/17 从 webui/index.html 起遍历整张模块图，逐个过 resolveStatic 验可达；
// srv/01 反向盯着 room/ws 必须仍然 403。）
const ALLOW_FILES = ['netx/client.ts', 'netx/protocol.ts', 'netx/seed.ts', 'netx/sha256.ts'];
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export type Resolved =
  | { ok: true; abs: string; mime: string; needsStrip: boolean }
  | { ok: false; status: number; why: string };

// 百分号转义坏掉（`/%`、`/%zz`、`/%e0`）时 decodeURIComponent 会**同步抛** URIError。
// 这两处调用原先都排在第一个 `await` 之前 ⇒ 抛出来的是一个没人接的 rejected promise ⇒
// Node 24 按未捕获异常终止整个进程（rev=10 复审必修 2：一条不需要认证、任意网页里放一个
// `<img src="http://127.0.0.1:8199/%zz">` 就能打死本地静态服务的请求）。
// 口径与既有的 `NUL in path` / `backslash in path` 同档：**这是请求的错，回 400，不回 500**
// （回 500 会让运维以为服务自己坏了，而它什么都没坏）。
function decodePath(requestUrl: string): string | null {
  try {
    return decodeURIComponent(requestUrl.split('?')[0] ?? '/');
  } catch {
    return null;
  }
}

// 纯函数，单独可测：把请求路径映射到磁盘路径，越界/未知扩展名一律拒绝。
// 根路径不能"就地返回" index.html：那样文档 URL 还是 /，页面里 ./app.ts 会被解析成
// /app.ts 而被白名单拒掉（实测 403，页面整个起不来）。所以根路径一律 302 到真实位置。
export function redirectTarget(requestUrl: string): string | null {
  const raw = decodePath(requestUrl);
  // 畸形 URL 不重定向（它也不该被重定向到任何入口）；随后由 resolveStatic 回那条 400
  if (raw === null) return null;
  // 根路径仍指向 M1.5：rev=3–5 的复跑命令与验收证据都以它为入口，不能悄悄换页面。
  if (raw === '/' || raw === '/index.html' || raw === '/webmin' || raw === '/webmin/') return '/webmin/index.html';
  if (raw === '/webui' || raw === '/webui/') return '/webui/index.html';
  // M6 大厅短链。只做路径映射（纯函数、零 netx 依赖）；目标页自己在 webui/ 白名单目录里。
  if (raw === '/lobby' || raw === '/lobby/') return '/webui/lobby.html';
  return null;
}

export function resolveStatic(requestUrl: string): Resolved {
  const raw = decodePath(requestUrl);
  if (raw === null) return { ok: false, status: 400, why: 'malformed percent-escape' };
  if (raw.includes('\0')) return { ok: false, status: 400, why: 'NUL in path' };
  const rel = raw.replace(/^\/+/, '');
  if (rel.includes('\\')) return { ok: false, status: 400, why: 'backslash in path' };
  const abs = resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return { ok: false, status: 403, why: 'outside project root' };
  const within = ALLOW_DIRS.some((d) => abs === resolve(ROOT, d) || abs.startsWith(resolve(ROOT, d) + sep));
  const rel2 = abs.slice(ROOT.length + 1).split(sep).join('/');
  if (!within && !ALLOW_FILES.includes(rel2)) {
    return { ok: false, status: 403, why: `only ${ALLOW_DIRS.join(', ')} (and ${ALLOW_FILES.length} named netx browser modules) are served` };
  }
  if (abs === resolve(ROOT, 'webmin') || abs === resolve(ROOT, 'src')) return { ok: false, status: 403, why: 'directory listing refused' };
  const ext = extname(abs).toLowerCase();
  const mime = MIME[ext];
  if (mime === undefined) return { ok: false, status: 403, why: `refused extension ${ext || '(none)'}` };
  // 图片只许从 webui/assets/ 出（webui 氛围层的素材）：webmin / src 下出现图片仍然拒绝，
  // ui/13 钉的 /webmin/x.png 防线原样成立 —— 放行面按"目录 + 扩展名"双重收窄。
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext) && !rel2.startsWith('webui/assets/')) {
    return { ok: false, status: 403, why: 'images are only served from webui/assets/' };
  }
  return { ok: true, abs, mime, needsStrip: ext === '.ts' };
}

export async function readAsset(r: Extract<Resolved, { ok: true }>): Promise<string> {
  const text = await readFile(r.abs, 'utf8');
  if (!r.needsStrip) return text;
  // strip 模式只做"类型标注换空白"，行列号不变 ⇒ 浏览器控制台里的报错位置仍然对得上源码
  return stripTypeScriptTypes(text, { mode: 'strip' });
}

// 把一次请求当作静态文件来处理；返回 true 表示"我已经写过响应了"。
// 之所以做成返回布尔而不是直接建服务：房间进程（netx/serve.ts）要在同一个端口上既发页面
// 又收 websocket，它需要一个"不归我管就还给你"的钩子，而不是两份会互相漂移的路由实现。
export async function serveStatic(req: { url?: string | undefined }, res: ServerResponse): Promise<boolean> {
  try {
    const to = redirectTarget(req.url ?? '/');
    if (to !== null) {
      res.writeHead(302, { location: to, 'cache-control': 'no-store' });
      res.end();
      return true;
    }
    const r = resolveStatic(req.url ?? '/');
    if (!r.ok) {
      res.writeHead(r.status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(`HTTP ${String(r.status)}: ${r.why}\n`);
      return true;
    }
    try {
      const body = await readAsset(r);
      res.writeHead(200, {
        'content-type': r.mime,
        'cache-control': 'no-store',
        'content-length': String(Buffer.byteLength(body)),
      });
      res.end(body);
    } catch (err) {
      const e = err as { code?: string };
      const status = e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500;
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(`HTTP ${String(status)}: ${String(e.code ?? err)} ${r.abs}\n`);
    }
    return true;
  } catch (err) {
    // 兜底：以上任何一步将来有人在 await 之前抛出，都不许再变成进程级故障（必修 2 的那一类）。
    // 走到这里说明是服务端自己出事了 ⇒ 这一档才是 500（畸形请求在上面已经回过 400）。
    try {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      res.end(`HTTP 500: ${String((err as Error).message ?? err)}\n`);
    } catch {
      // 头已经发出去了：这次响应救不回来，但进程必须活着
    }
    return true;
  }
}

const server = createServer((req, res) => {
  // `.catch` 不是装饰：serveStatic 现在自己不会抛，但"将来有人往 await 之前塞进会抛的东西"
  // 就是必修 2 那次的成因。这一层保证最坏情况也只是那一个请求失败。
  void serveStatic(req, res).catch(() => {
    res.destroy();
  });
});

const portArg = Number(process.argv[2] ?? process.env['PORT'] ?? 8123);
// 0 是一个有效请求（"给内核挑一个空闲端口"），以前写成 `> 0` 会把它悄悄换成 8123：
// 要拿这个入口做真进程测试就没法避开端口占用。
const port = Number.isInteger(portArg) && portArg >= 0 && portArg < 65536 ? portArg : 8123;

// 只在被当作主模块直接运行时才监听（被测试 import 时不起服务）。
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  server.listen(port, '127.0.0.1', () => {
    // 打印**真正绑上的**端口：传 0 时 requested ≠ actual，照着这一行去点就会点错。
    const addr = server.address();
    const actual = typeof addr === 'object' && addr !== null ? addr.port : port;
    process.stdout.write(`炸金花 M1.5 → http://127.0.0.1:${String(actual)}/  (根目录 ${ROOT}，Ctrl+C 停)\n`);
  });
}
