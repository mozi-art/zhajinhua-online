// M5 · 房间进程（netx/serve.ts）的端到端证据。
// 这一层存在的意义就是"一条命令起"，所以测试也得真的把它当命令来跑：
//   · 起在内核挑的空闲端口上，/health 与 webui 页面从同一个端口端出来（工单 §4 M5：一条命令、端口可配置、/health 保持）
//   · 用 Node 的全局 WebSocket 打进去，对面跑的就是 netx/client.ts 那道墙 —— 与浏览器里那一页同一份代码
//   · 子进程收 SIGINT 要干净退出（退出码 0），坏参数要退出码 2 并留一句话
// 本文件与 netx-netplay 系列一样不用时钟；唯一允许的 setTimeout 是"防挂死看门狗"（nst/09 点名）。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createPeer } from '../netx/client.ts';
import type { Peer } from '../netx/client.ts';
import { encodeUp, PROTOCOL_ID } from '../netx/protocol.ts';
import type { Move, Up } from '../netx/protocol.ts';
import { bannerLines, DEFAULT_HOST, DEFAULT_ROOM_PORT, lanAddresses, MIN_BUY_IN, parseRoomArgs, ROOM_SEATS, startRoom } from '../netx/serve.ts';
import type { NetIfaces } from '../netx/serve.ts';
import { redirectTarget, resolveStatic } from '../webmin/serve.ts';
import { request } from 'node:http';
import type { ServerResponse } from 'node:http';
import { serveStatic } from '../webmin/serve.ts';
import { counterEntropy } from './netx-fixtures.ts';
import { note, test } from './harness.ts';

const WATCHDOG_MS = 20000;

function watchdog<T>(p: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`看门狗：${what} 没在 ${String(WATCHDOG_MS)}ms 内完成`)), WATCHDOG_MS);
    const clear = (): void => {
      clearTimeout(t);
    };
    p.then(
      (v) => {
        clear();
        resolve(v);
      },
      (err: unknown) => {
        clear();
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

type Cli = {
  label: string;
  peer: Peer;
  send(up: Up): void;
  next(): Promise<string>;
  close(): void;
};

function connect(url: string, label: string, peer: Peer): Promise<Cli> {
  return new Promise<Cli>((resolve, reject) => {
    const ws = new WebSocket(url, PROTOCOL_ID);
    const queue: string[] = [];
    const waiters: ((t: string) => void)[] = [];
    ws.addEventListener('error', () => reject(new Error(`${label}：socket 出错`)));
    ws.addEventListener('close', () => {
      for (const w of waiters.splice(0)) void w;
      reject(new Error(`${label}：连接已关`));
    });
    ws.addEventListener('message', (ev: MessageEvent) => {
      const text = typeof ev.data === 'string' ? ev.data : '';
      const w = waiters.shift();
      if (w !== undefined) w(text);
      else queue.push(text);
    });
    ws.addEventListener('open', () => {
      resolve({
        label,
        peer,
        send: (up: Up) => {
          ws.send(encodeUp(up));
        },
        next: () =>
          new Promise<string>((res) => {
            const item = queue.shift();
            if (item !== undefined) res(item);
            else waiters.push(res);
          }),
        close: () => ws.close(),
      });
    });
  });
}

// 把一条下行喂给那道墙，并把墙要求发出的上行立刻发出去
async function feed(cli: Cli, text: string): Promise<void> {
  for (const up of cli.peer.inbound(text)) cli.send(up);
}

// 与无头那套同一句话术：轮到我就先亮牌再跟注，直到服务端自己把这一手推向结算
function playPolicy(peer: Peer): Move | null {
  const view = peer.viewOf();
  const info = peer.info();
  if (view === null || view.phase !== 'betting' || view.turn !== info.seat) return null;
  const me = view.seats.find((s) => s.seat === info.seat);
  if (me === undefined) return null;
  return me.looked ? { kind: 'call' } : { kind: 'look' };
}

test('srv/01 房间进程在空闲端口上起来：/health 与 webui 页面同源同端口', async () => {
  const running = await watchdog(startRoom({ port: 0, settleMs: 60, handGapMs: 120 }), 'startRoom');
  try {
    assert.ok(running.port > 0, 'port:0 要让内核挑一个真端口');
    assert.equal(running.wsUrl, `ws://127.0.0.1:${String(running.port)}`);
    const health = await watchdog(fetch(`${running.httpUrl}health`), '/health');
    assert.equal(health.status, 200);
    const info = (await health.json()) as { protocol: string; seated: unknown[]; connections: number; fault: string | null };
    assert.equal(info.protocol, PROTOCOL_ID, '/health 里的协议标识要与握手用的子协议一致');
    assert.deepEqual(info.seated, [], '刚起来的房间一个人都不该在座');
    assert.equal(info.connections, 0);
    assert.equal(info.fault, null);

    const page = await watchdog(fetch(`${running.httpUrl}webui/index.html`), '页面');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await page.text(), /id="mode"/, '房间进程端出来的页面没有联机开关');

    const mod = await watchdog(fetch(`${running.httpUrl}webui/main.ts`), 'main.ts');
    assert.equal(mod.status, 200);
    assert.match(mod.headers.get('content-type') ?? '', /javascript/);
    const body = await mod.text();
    assert.ok(!body.includes('import type'), '.ts 要现场抹掉类型标注，否则浏览器解析不了');
    assert.ok(!/let mode: Mode/.test(body), '类型标注没抹干净');
    assert.ok(body.includes('./netplay.ts'), '页面侧的联机进口应当确实存在');

    const out = await watchdog(fetch(`${running.httpUrl}package.json`), '越界');
    assert.equal(out.status, 403, '房间进程也不许把仓库根目录当静态资源端出去');
    const root = await watchdog(fetch(`${running.httpUrl}`, { redirect: 'manual' }), '根路径');
    assert.equal(root.status, 302, '根路径仍按 webmin/serve.ts 的口径 302 到真实入口');
    assert.equal(root.headers.get('location'), '/webmin/index.html');
    // 模块图放行面（nui/17 从源码侧盯同一件事）：浏览器要 fetch 的那四个可移植模块必须给，
    // 服务端权威与传输层必须继续拒绝 —— 房间进程同时也端页面，这条边界就在页面上最容易破。
    const wall = await watchdog(fetch(`${running.httpUrl}netx/client.ts`), 'netx/client.ts');
    assert.equal(wall.status, 200, '那道墙的源码浏览器要按值 import，403 会让整页起不来');
    assert.match(wall.headers.get('content-type') ?? '', /javascript/);
    assert.ok(!(await wall.text()).includes('import type'), '给浏览器的 .ts 必须已经抹掉类型标注');
    for (const side of ['netx/room.ts', 'netx/ws.ts', 'netx/serve.ts', 'netx/frames.ts']) {
      const refused = await watchdog(fetch(`${running.httpUrl}${side}`), side);
      assert.equal(refused.status, 403, `${side} 是服务端侧代码，不该被端进页面`);
    }
  } finally {
    await watchdog(running.close(), 'close');
  }
});

test('srv/02 两家从房间进程真跑一手牌：跨真 socket 的揭示核对通过，零越界', async () => {
  const running = await watchdog(
    startRoom({ port: 0, turnMs: 60000, nonceMs: 60000, settleMs: 60, handGapMs: 120 }),
    'startRoom',
  );
  const clis: Cli[] = [];
  try {
    for (const [i, name] of ['甲', '乙'].entries()) {
      const peer = createPeer({ name, buyIn: MIN_BUY_IN, entropy: counterEntropy(0x5e00 + i) });
      const cli = await watchdog(connect(running.wsUrl, name, peer), '握手');
      clis.push(cli);
      cli.send(peer.hello());
    }
    let settled = 0;
    let steps = 0;
    while (settled < clis.length && steps < 400) {
      steps += 1;
      for (const cli of clis) {
        await feed(cli, await cli.next());
        const move = playPolicy(cli.peer);
        if (move !== null) cli.send({ t: 'action', hand: cli.peer.info().hand, move });
        if (cli.peer.info().phase === 'settled') settled += 1;
      }
    }
    assert.ok(settled >= 1, `${String(steps)} 步之后仍然没有任何一家看到结算`);
    for (const cli of clis) {
      const info = cli.peer.info();
      assert.deepEqual(info.violations, [], `${cli.label} 那道墙在服务端身上抓到了越界`);
      if (info.phase === 'settled') assert.equal(info.verifiedHand, info.hand, `${cli.label} 结算了却没核对揭示`);
    }
    assert.equal(running.info().fault, null, '房间自己报了故障');
    note(`srv/02 真 socket 走完一手：${String(steps)} 步，两家各自核对通过（端口由内核挑，不印进输出）`);
  } finally {
    for (const cli of clis) cli.close();
    await watchdog(running.close(), 'close');
  }
});

type Kid = {
  readonly stdout: string;
  readonly stderr: string;
  waitLine(re: RegExp): Promise<string>;
  write(text: string): void;
  kill(signal: NodeJS.Signals): void;
  exited(): Promise<number | null>;
};

function runNode(script: string, args: string[]): Kid {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: new URL('..', import.meta.url),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  const waiters: ((text: string) => void)[] = [];
  const reaper: ((err: Error) => void)[] = [];
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString('utf8');
    for (const w of waiters.splice(0)) w(stdout);
  });
  child.stderr.on('data', (b: Buffer) => {
    stderr += b.toString('utf8');
  });
  child.on('exit', (code) => {
    for (const r of reaper.splice(0)) r(new Error(`子进程提前退出，退出码 ${String(code)}；stderr=${stderr}`));
  });
  return {
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    waitLine: (re: RegExp) =>
      new Promise<string>((res, rej) => {
        const m = re.exec(stdout);
        if (m !== null) return res(m[1] ?? m[0]);
        waiters.push((text: string) => {
          const hit = re.exec(text);
          if (hit !== null) res(hit[1] ?? hit[0]);
          else waiters.push(() => {});
        });
        reaper.push(rej);
      }),
    write: (text: string) => {
      child.stdin.write(text);
    },
    kill: (signal) => {
      child.kill(signal);
    },
    exited: () => new Promise<number | null>((res) => child.on('exit', (code) => res(code))),
  };
}

test('srv/03 一条命令起、一句 quit 干净退出（退出码 0，不是被硬杀）', async () => {
  const kid = runNode("netx/serve.ts", ["0"]);
  // Windows 下 SIGINT 投不给被 spawn 的子进程（只能 TerminateProcess，那是硬杀），
  // 所以"干净退出"这条路要靠 stdin 上的一行 quit 来量：两个平台量的是同一条收尾代码。
  const port = await watchdog(kid.waitLine(/ws:\/\/127\.0\.0\.1:(\d+)/), '子进程打印监听行');
  assert.match(port, /^\d+$/, '横幅里要印出内核挑的真实端口');
  const health = await watchdog(fetch(`http://127.0.0.1:${port}/health`), '子进程 /health');
  assert.equal(health.status, 200);
  const page = await watchdog(fetch(`http://127.0.0.1:${port}/webui/index.html`), '子进程页面');
  assert.equal(page.status, 200);
  assert.match(kid.stdout, new RegExp(`座位 ${String(ROOM_SEATS)} 个，最低买入 ${String(MIN_BUY_IN)}`), '横幅要写清座位数与最低买入');
  kid.write('quit\n');
  const code = await watchdog(kid.exited(), '子进程退出');
  assert.equal(code, 0, `quit 之后退出码应为 0，实得 ${String(code)}（stderr=${kid.stderr}）`);
  assert.match(kid.stdout, /已全部关闭/, '要说清楚是"关完了"才退的');
});

test('srv/04 坏端口参数：退出码 2 且留一句话', async () => {
  const kid = runNode("netx/serve.ts", ["abc"]);
  const code = await watchdog(kid.exited(), '子进程退出');
  assert.equal(code, 2, `坏端口该以 2 退出，实得 ${String(code)}`);
  assert.match(kid.stderr, /bad port: abc/);
});

// 只扫代码，不扫注释：main.ts 的注释里会写"绝不能用 localStorage"这类自我约束，
// 拿原文扫等于把说明当成违规（与 nui/02 同一口径）。
function codeOf(src: string): string {
  return src
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

test('srv/05 默认端口在"房间进程"与"页面输入框"两处不许各说各话', () => {
  const html = read('webui/index.html');
  const main = codeOf(read('webui/main.ts'));
  assert.match(html, new RegExp(`ws://127\\.0\\.0\\.1:${String(DEFAULT_ROOM_PORT)}`), '连接框的 placeholder 与房间默认端口不一致');
  assert.match(main, new RegExp(`'${String(DEFAULT_ROOM_PORT)}'`), 'main.ts 里同地址兜底用的不是那个默认端口');
  assert.ok(!/localStorage/.test(main), 'main.ts 用了 localStorage ⇒ 同一浏览器两个标签页会互相顶掉 token');
  assert.match(main, /sessionStorage/, '每标签页存储必须是 sessionStorage');
  assert.match(main, /getRandomValues/, '份额熵源要用浏览器安全随机');
  assert.ok(!/Math\.random/.test(main), 'main.ts 自己取了伪随机 ⇒ 份额可预测，commit-reveal 的前提就没了');
  assert.match(main, /resumeWire\(\)[\s\S]{0,40}joinWire\(\)/, '连上之后要先凭 token 重连，没有凭据才占新座');
  note(`srv/05 默认端口 ${String(DEFAULT_ROOM_PORT)}：进程与页面两处一致；存储与熵源口径也钉住`);
});

test('srv/06 横幅里印出来的那个页面 URL 就是联机页（rev=10 必修 1）', async () => {
  // 复审实测：`node netx/serve.ts 8801` 印的是 `页面 http://127.0.0.1:8801/`，而 `/` 按
  // webmin/serve.ts 的口径 302 到 **M1.5 单机页**（全文没有"模式/房间/连接"任何一个控件）
  // ⇒ 照着 DELIVERY 的复现步骤走，根本玩不到联机。`/`→M1.5 那条映射要保留（rev=3–5 的证据链以它为入口），
  // 所以修法是"印出来的那一行必须直达 /webui/"，不是去换 `/` 的语义。
  const running = await watchdog(startRoom({ port: 0 }), 'startRoom');
  try {
    assert.equal(running.uiUrl, `${running.httpUrl}webui/`, 'uiUrl 必须与同源拼出来的一致');
    const page = await watchdog(fetch(running.uiUrl), 'uiUrl');
    assert.equal(page.status, 200);
    const body = await page.text();
    for (const id of ['id="mode"', 'id="netUrl"', 'id="netName"', 'id="netBtn"', 'id="board"']) {
      assert.ok(body.includes(id), `印出来的入口里没有 ${id} ⇒ 它不是联机页`);
    }
    // 对照 1：`/` 仍然 302 到 M1.5，且跟到底之后确实**没有**联机控件
    const root = await watchdog(fetch(running.httpUrl, { redirect: 'manual' }), '根路径');
    assert.equal(root.headers.get('location'), '/webmin/index.html', '那条 /→M1.5 映射被改动了（复审明令不许改）');
    const followed = await watchdog(fetch(running.httpUrl), '根路径跟到底');
    assert.ok(!(await followed.text()).includes('id="netUrl"'), '`/` 已经是联机页 ⇒ 上面那条 302 与事实不符');
    // 对照 2：真子进程横幅里印出来的那一行 URL，**原样**跟到底必须就是联机页。
    //   第一版这里是"捕获源、自己再拼一个 webui/ 去 fetch"，于是变异 M03（把横幅退回 httpUrl）
    //   照样过关 —— 那等于没在验横幅。现在逐字取它印出来的字符串，按复审 8.1 的判据跟到底；
    //   端口不比对（子进程与本机这次 startRoom 各拿一个内核端口），比的是**路径**：横幅给的就是 /webui/。
    const kid = runNode('netx/serve.ts', ['0']);
    try {
      const printed = await watchdog(kid.waitLine(/页面 (http:\/\/127\.0\.0\.1:\d+\/\S*)/), '横幅页面 URL');
      assert.equal(new URL(printed).pathname, '/webui/', `横幅印出来的路径不是联机页，实得 ${printed}`);
      assert.equal(new URL(printed).origin.startsWith('http://127.0.0.1:'), true, `横幅必须指回本机：${printed}`);
      const served = await watchdog(fetch(printed, { redirect: 'follow' }), '横幅 URL 原样跟到底');
      assert.equal(served.status, 200, `横幅那一行给的 ${printed} 打不开`);
      assert.ok((await served.text()).includes('id="netUrl"'), `横幅 URL 跟到底不是联机页：${printed}`);
      note(`srv/06 入口面：横幅原样印出 ${printed.replace(/127\.0\.0\.1:\d+/, '127.0.0.1:〔内核端口〕')} 且跟到底就是联机页；/ 仍 302 到 M1.5（映射未动）`);
    } finally {
      // 无论如何都要把子进程送走：留着它，父进程握着那条 stdout 管道 ⇒ 跑测进程永远不退（实测卡过一次）
      kid.write('quit\n');
      await watchdog(kid.exited(), '子进程退出').catch(() => undefined);
    }
  } finally {
    await watchdog(running.close(), 'close');
  }
});

test('srv/07 一条畸形百分号转义打死独立静态服务（rev=10 必修 2）⇒ 现在回 400 且进程存活', async () => {
  // 复审三次独立复现：`node webmin/serve.ts` 收到 `GET /%` 后 URIError 抛在第一个 await 之前
  // ⇒ 一个没人接的 rejected promise ⇒ Node 24 终止进程，此后任何路径都 code=000。
  // 攻击面：浏览器发跨源 GET 图片不需要预检 ⇒ 任意网页里放一个 <img> 就能打死它。
  assert.throws(() => decodeURIComponent('%'), URIError, '构造前提：这条输入确实同步抛');
  assert.equal(redirectTarget('/%'), null, '畸形 URL 不该重定向');
  const bad = resolveStatic('/%');
  assert.ok(!bad.ok && bad.status === 400 && bad.why === 'malformed percent-escape', `必修 2 要求 400 且口径与 NUL/backslash 同档，实得 ${JSON.stringify(bad)}`);

  const kid = runNode('webmin/serve.ts', ['0']);
  const url = await watchdog(kid.waitLine(/http:\/\/127\.0\.0\.1:(\d+)\//), '静态服务监听行');
  const port = Number(url);
  const code = (path: string): Promise<{ status: number; body: string }> =>
    new Promise((res, rej) => {
      const rq = request({ host: '127.0.0.1', port, path }, (r) => {
        let text = '';
        r.setEncoding('utf8');
        r.on('data', (c: string) => {
          text += c;
        });
        r.on('end', () => res({ status: r.statusCode ?? 0, body: text }));
      });
      rq.on('error', rej);
      rq.end(); // http.request 不写 body 也要显式 end，否则请求头根本不发出去（第一次跑就挂在这上面）
    });
  for (const path of ['/%', '/%zz', '/%e0%A4%A', '/webmin/%%']) {
    const r = await watchdog(code(path), `GET ${path}`);
    assert.equal(r.status, 400, `${path} 应当回 400（这是请求的错，不是服务的错），实得 ${String(r.status)}`);
    assert.match(r.body, /malformed percent-escape/, `${path} 的拒绝理由要与 NUL/backslash 同档：${r.body}`);
  }
  // 对照组：既有那两条同档 guard 的口径没被这次改动带偏
  const nul = await watchdog(code('/webmin/%00index.html'), 'NUL 对照');
  assert.equal(nul.status, 400, `对照组 /%00 现在也变了口径：${nul.body}`);
  const outside = await watchdog(code('/package.json'), '越界对照');
  assert.equal(outside.status, 403, '403 那一档不许被并进 400');
  // **进程还活着**：畸形请求之后合法路径必须仍然 200
  const alive = await watchdog(code('/webmin/index.html'), '打完畸形请求之后');
  assert.equal(alive.status, 200, '必修 2 的判据：进程被打死了');
  assert.match(alive.body, /<html/i);
  kid.kill('SIGKILL');
  await watchdog(kid.exited(), '子进程收尾');
  note('srv/07 四发畸形转义全部 400、%00 与越界 403 档位不变、事后合法路径仍 200（进程存活）');
});

// rev=10 §5(d) 点名 `webmin/serve.ts` 的 404/500 catch 段零覆盖。真 spawn 那条路拿不到它：
// 子进程是被 SIGKILL 送走的，V8 不刷 coverage ⇒ "跑到了但取证不到"。所以这里在**进程内**直接打
// serveStatic：文件不存在（ENOENT）必须是 404 而不是 500，并把响应形状（纯文本 + no-store）一起钉住。
test('srv/08 文件不存在回 404（不是 500），响应形状与 no-store 口径一起钉住', async () => {
  type Captured = { status: number; headers: Record<string, string>; body: string };
  const call = async (url: string): Promise<Captured> => {
    const got: Captured = { status: 0, headers: {}, body: '' };
    const res = {
      writeHead: (status: number, headers: Record<string, string>): unknown => {
        got.status = status;
        got.headers = headers;
        return res;
      },
      end: (chunk?: unknown): unknown => {
        got.body = typeof chunk === 'string' ? chunk : '';
        return res;
      },
    };
    const handled = await serveStatic({ url }, res as unknown as ServerResponse);
    assert.equal(handled, true, 'serveStatic 必须承认"这一条我答过了"');
    return got;
  };

  const missing = await watchdog(call('/webui/no-such-file.ts'), 'ENOENT 那一发');
  assert.equal(missing.status, 404, `不存在的路径要 404（服务端什么都没坏），实得 ${String(missing.status)} ${missing.body}`);
  assert.match(missing.body, /ENOENT/, `404 要把原因写出来：${missing.body}`);
  const dir = await watchdog(call('/webui/'), '目录入口那一发');
  // 目录这一发**不会**走到 EISDIR：`/webui/` 被 redirectTarget 认成入口先 302，其它目录名要么 403
  // （directory listing refused）要么因为没有扩展名而 403（refused extension）。所以 `readAsset` 的
  // catch 里那一支 EISDIR 在本服务的路由规则下按构造不可达 —— 这里把"目录到底答什么"钉成实测，而不是猜。
  assert.equal(dir.status, 302, `目录入口应当 302 到真实位置，实得 ${String(dir.status)}`);
  assert.equal(dir.headers['location'], '/webui/index.html');
  const inside = await watchdog(call('/src/engine/nope.ts'), 'src 下的不存在文件');
  assert.equal(inside.status, 404, `src 下不存在也要 404：${inside.body}`);
  assert.match(inside.body, /ENOENT/);
  // 响应形状：这一档是纯文本 + 不缓存（与 400/403 那几档同一口径，别悄悄发 HTML）
  assert.equal(missing.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(missing.headers['cache-control'], 'no-store');
  // 对照组：同一函数在文件真存在时是 200 + 正确 MIME ⇒ 上面那几条 404 不是"永远 404"的偷懒实现
  const ok = await watchdog(call('/webui/index.html'), '对照组：真实存在的页面');
  assert.equal(ok.status, 200, `对照组失败：${ok.body}`);
  assert.match(ok.headers['content-type'] ?? '', /text\/html/);
  assert.match(ok.body, /<html/i);
  note(`srv/08 ENOENT 与 src 下不存在都 404（带原因、纯文本、no-store），对照组 /webui/index.html 仍 200`);
});

// —— M6：--host 参数解析（纯函数直测，比起子进程更快更确定）——
test('srv/09 parseRoomArgs：位置端口不动、--host 任意位置不占端口位、坏端口/坏 host 各自的 token 不变', () => {
  // 历史形态一条不動：`serve.ts 8790`、`serve.ts 0`（内核挑端口）、坏端口退出档
  assert.deepEqual(parseRoomArgs(['8790']), { port: 8790, host: DEFAULT_HOST });
  assert.deepEqual(parseRoomArgs(['0']), { port: 0, host: DEFAULT_HOST });
  assert.deepEqual(parseRoomArgs(['abc']), { error: 'port', raw: 'abc' }, 'srv/04 的那个 token：bad port: abc');
  assert.deepEqual(parseRoomArgs([]), { port: DEFAULT_ROOM_PORT, host: DEFAULT_HOST }, '缺省 = 默认端口 + 默认绑定');
  assert.deepEqual(parseRoomArgs([], { PORT: '9001' }), { port: 9001, host: DEFAULT_HOST }, 'PORT 环境变量兜底');
  // --host 在前 / 在后 / 与端口混排，同一个解；值不占端口位
  assert.deepEqual(parseRoomArgs(['--host', '0.0.0.0', '9000']), { port: 9000, host: '0.0.0.0' });
  assert.deepEqual(parseRoomArgs(['9000', '--host', '0.0.0.0']), { port: 9000, host: '0.0.0.0' });
  assert.deepEqual(parseRoomArgs(['--host', '192.168.1.5', '0']), { port: 0, host: '192.168.1.5' });
  // 具体地址合法：IPv6 字面量（含方括号）、主机名都收
  assert.deepEqual(parseRoomArgs(['--host', '[::1]', '9000']), { port: 9000, host: '[::1]' });
  assert.deepEqual(parseRoomArgs(['--host', 'poker.lan', '9000']), { port: 9000, host: 'poker.lan' });
  // 坏 host：缺值（旗标收尾 / 值是下一个旗标）、带空格、以 - 开头、环境变量同档
  assert.deepEqual(parseRoomArgs(['--host']), { error: 'host', raw: '--host' }, '缺值 ⇒ raw 印旗标本身');
  assert.deepEqual(parseRoomArgs(['9000', '--host', '--verbose']), { error: 'host', raw: '--host' });
  assert.deepEqual(parseRoomArgs(['9000', '--host', 'a b']), { error: 'host', raw: 'a b' });
  assert.deepEqual(parseRoomArgs(['9000', '--host', '-x']), { error: 'host', raw: '-x' });
  assert.deepEqual(parseRoomArgs([], { HOST: 'a b' }), { error: 'host', raw: 'a b' });
  assert.deepEqual(parseRoomArgs([], { HOST: '0.0.0.0' }), { port: DEFAULT_ROOM_PORT, host: '0.0.0.0' });
  // 命令行优先于环境变量；重复 --host 取最后一个
  assert.deepEqual(parseRoomArgs(['--host', '192.168.1.5'], { HOST: '0.0.0.0' }), { port: DEFAULT_ROOM_PORT, host: '192.168.1.5' }, '命令行优先于环境变量');
  assert.deepEqual(parseRoomArgs(['--host', '0.0.0.0', '--host', '192.168.1.5', '9000']), { port: 9000, host: '192.168.1.5' });
  note(`srv/09 parseRoomArgs：端口位不动、--host 双向混排、坏值 token（bad host: <原样>）与 bad port: abc 各守各的档`);
});

// —— M6：局域网地址枚举与横幅分层（注入假网卡 ⇒ 与真机无关，双跑一致）——
const FAKE_IFACES: NetIfaces = {
  loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
  eth0: [
    { family: 'IPv4', address: '192.168.1.5', internal: false },
    { family: 'IPv6', address: 'fe80::1', internal: false },
  ],
  eth1: [{ family: 'IPv4', address: '10.0.0.3', internal: false }],
  vdup: [{ family: 'IPv4', address: '10.0.0.3', internal: false }],
};

test('srv/10 lanAddresses 与 bannerLines：非 internal IPv4、排序去重；默认 host 横幅逐字不变，通配只追加行', async () => {
  assert.deepEqual(lanAddresses(FAKE_IFACES, 8790), ['ws://10.0.0.3:8790', 'ws://192.168.1.5:8790'], 'internal/IPv6 剔除、跨网卡去重、码点序');
  assert.deepEqual(lanAddresses({}, 8790), [], '没有网卡 ⇒ 空表（横幅另有说明行，不静默）');
  // 默认 host：两行**逐字**等于 M5 的横幅（srv/03 的座位/买入文案、srv/06 的页面行都钉着它们）
  const lonely = { wsUrl: 'ws://127.0.0.1:8790', uiUrl: 'http://127.0.0.1:8790/webui/', httpUrl: 'http://127.0.0.1:8790/', lanUrls: [] as string[] };
  assert.deepEqual(bannerLines(lonely, '127.0.0.1'), [
    '炸金花房间 · ws ws://127.0.0.1:8790 · 页面 http://127.0.0.1:8790/webui/ · 健康检查 http://127.0.0.1:8790/health',
    `子协议 "${PROTOCOL_ID}"，座位 ${String(ROOM_SEATS)} 个，最低买入 ${String(MIN_BUY_IN)}。Ctrl+C 停；或输一行 quit 回车。`,
  ], '默认 host 的横幅一个字节都不许变');
  // 具体地址：不追加（用户点名了地址，前两行里的就是它）
  assert.equal(bannerLines({ ...lonely, wsUrl: 'ws://192.168.1.5:8790', uiUrl: 'http://192.168.1.5:8790/webui/', httpUrl: 'http://192.168.1.5:8790/' }, '192.168.1.5').length, 2);
  // 0.0.0.0：逐行追加可点地址；一枚举不到也要说一声
  const wild = bannerLines({ wsUrl: 'ws://0.0.0.0:8790', uiUrl: 'http://0.0.0.0:8790/webui/', httpUrl: 'http://0.0.0.0:8790/', lanUrls: ['ws://10.0.0.3:8790', 'ws://192.168.1.5:8790'] }, '0.0.0.0');
  assert.equal(wild.length, 4, '两行基础 + 两行局域网');
  assert.equal(wild[2], '局域网 ws://10.0.0.3:8790（页面 http://10.0.0.3:8790/webui/）');
  assert.equal(wild[3], '局域网 ws://192.168.1.5:8790（页面 http://192.168.1.5:8790/webui/）');
  const none = bannerLines({ wsUrl: 'ws://0.0.0.0:8790', uiUrl: 'http://0.0.0.0:8790/webui/', httpUrl: 'http://0.0.0.0:8790/', lanUrls: [] }, '0.0.0.0');
  assert.match(none[2] ?? '', /没枚举到任何局域网 IPv4 地址/, '空网卡要有说明行，不静默');
  // IPv6 通配：不枚举地址（lanAddresses 只认 IPv4），但要说清"用具体 IPv6 访问"
  const v6 = bannerLines({ wsUrl: 'ws://[::]:8790', uiUrl: 'http://[::]:8790/webui/', httpUrl: 'http://[::]:8790/', lanUrls: [] }, '::');
  assert.equal(v6.length, 3);
  assert.match(v6[2] ?? '', /IPv6 通配绑定：不枚举局域网地址/);
  // startRoom 侧：注入网卡 ⇒ lanUrls 确定生成；0.0.0.0 绑定下 127.0.0.1 仍可访问（/health 照常）
  const running = await watchdog(startRoom({ port: 0, host: '0.0.0.0', interfaces: () => FAKE_IFACES, static: false }), 'startRoom 0.0.0.0');
  try {
    assert.deepEqual(running.lanUrls, [`ws://10.0.0.3:${String(running.port)}`, `ws://192.168.1.5:${String(running.port)}`]);
    assert.equal(running.wsUrl, `ws://0.0.0.0:${String(running.port)}`, 'wsUrl 照实印绑定面（srv/06 的 origin 语义不动）');
    const health = await watchdog(fetch(`http://127.0.0.1:${String(running.port)}/health`), 'health');
    assert.equal(health.status, 200);
    assert.equal(((await health.json()) as { rooms: number }).rooms, 0);
  } finally {
    await watchdog(running.close(), 'close');
  }
  note('srv/10 局域网枚举（internal/IPv6 剔除、去重排序）+ 横幅四态（默认逐字不变/具体不追加/通配逐行/IPv6 说明行）');
});

test('srv/11 真子进程 --host：横幅印通配绑定、quit 干净退出；坏 host 退出码 2 且 token 原样', async () => {
  // 通配绑定下的横幅会枚举**本机真网卡**（每台机器不同）⇒ 只钉"印出了 0.0.0.0 的监听行"与
  // "干净退出"两件与机器无关的事，不把局域网行放进任何断言或 note（双跑一致的前提）。
  const kid = runNode('netx/serve.ts', ['0', '--host', '0.0.0.0']);
  try {
    const line = await watchdog(kid.waitLine(/ws ws:\/\/0\.0\.0\.0:(\d+)/), '通配监听行');
    assert.match(line, /^\d+$/, '横幅里要印出内核挑的真实端口');
    const health = await watchdog(fetch(`http://127.0.0.1:${String(line)}/health`), 'health');
    assert.equal(health.status, 200, '通配绑定下回环地址照样可达');
    assert.equal(((await health.json()) as { protocol: string }).protocol, PROTOCOL_ID);
  } finally {
    kid.write('quit\n');
    const code = await watchdog(kid.exited(), '子进程退出');
    assert.equal(code, 0, `quit 之后退出码应为 0，实得 ${String(code)}（stderr=${kid.stderr}）`);
    assert.match(kid.stdout, /已全部关闭/, '要说清楚是"关完了"才退的');
  }
  for (const [args, token] of [[[('--host')], 'bad host: --host'], [['--host', 'a b', '0'], 'bad host: a b']] as const) {
    const bad = runNode('netx/serve.ts', [...args]);
    const code = await watchdog(bad.exited(), '坏 host 子进程退出');
    assert.equal(code, 2, `坏 host 该以 2 退出（${String(args.join(' '))}），实得 ${String(code)}`);
    assert.ok(bad.stderr.includes(token), `stderr 要含 ${token}，实得 ${bad.stderr}`);
  }
  note('srv/11 --host 0.0.0.0 子进程：通配监听行 + 回环 /health 200 + quit 退出码 0；坏 host 退出码 2（token 原样）');
});

// M6 hosted 流程的产品路径端到端：startRoom({flow:'hosted'}) + 真 socket + 真那道墙。
// 语义级断言（零定时器、拒绝分档）由 room/32-34 用 FakeClock 钉死，这里验的是"CLI 形状的栈也能走通全流程"。
// 驱动纪律：跨 socket 的消息**没有顺序保证**（甲的 begin 可能赶在乙的 ready 之前被处理 ⇒ not_ready
// 之后没人重试 ⇒ 整桌死等）—— 所以每个阶段都"消费下行直到条件成立，再发下一步"，绝不盲发。
test('srv/12 startRoom 的 hosted 流程：准备 → 房主开始 → 打完一手 → 结算停住 → 房主续局', async () => {
  const running = await watchdog(
    startRoom({ port: 0, flow: 'hosted', turnMs: 250, nonceMs: 60000, settleMs: 60, handGapMs: 120 }),
    'startRoom',
  );
  const clis: Cli[] = [];
  // 消费一条连接的下行直到条件成立（有界轮次；到点抛错而不是挂死）
  const until = async (cli: Cli, ok: () => boolean, what: string, rounds = 200): Promise<void> => {
    for (let i = 0; i < rounds && !ok(); i += 1) await feed(cli, await cli.next());
    assert.ok(ok(), `${what} 一直没成立`);
  };
  try {
    for (const [i, name] of ['甲', '乙'].entries()) {
      const peer = createPeer({ name, buyIn: MIN_BUY_IN, entropy: counterEntropy(0x7a00 + i) });
      const cli = await watchdog(connect(running.wsUrl, name, peer), '握手');
      clis.push(cli);
      cli.send(peer.hello());
    }
    const a = clis[0] as Cli;
    const b = clis[1] as Cli;
    await until(a, () => a.peer.info().token !== '', '甲入座');
    await until(b, () => b.peer.info().token !== '', '乙入座');
    // 等待期：非房主点开始 → not_host（error 档，真 socket 上再验一次分档）
    b.send({ t: 'begin' });
    await until(b, () => b.peer.info().errors.some((e) => e.code === 'not_host'), '非房主 begin 被拒');
    // 双准备：等到**双方都看见 ready 齐了**再让房主点开始（跨 socket 无序 ⇒ 盲发会 not_ready 死等）
    a.send({ t: 'ready', on: true });
    b.send({ t: 'ready', on: true });
    await until(a, () => (a.peer.info().table?.ready.length ?? 0) >= 2, '双准备上桌况');
    a.send({ t: 'begin' });
    // 打完一手（同 srv/02 的驱动：轮到就亮牌跟注，直到双方都见 settled）
    let settled = 0;
    let steps = 0;
    while (settled < clis.length && steps < 400) {
      steps += 1;
      for (const cli of clis) {
        await feed(cli, await cli.next());
        const move = playPolicy(cli.peer);
        if (move !== null) cli.send({ t: 'action', hand: cli.peer.info().hand, move });
        if (cli.peer.info().phase === 'settled') settled += 1;
      }
    }
    assert.ok(settled >= 1, `${String(steps)} 步之后仍然没见到结算`);
    for (const cli of clis) {
      assert.deepEqual(cli.peer.info().violations, [], `${cli.label} 的墙抓到了越界`);
      assert.equal(cli.peer.info().table?.waiting, false, '开局之后 waiting 必须是 false');
    }
    assert.equal(running.info().phase, 'settled', '结算后房间停在 settled（"不再自动续"的零定时器断言由 room/32 钉死）');
    // 房主续局 → 第 2 手
    a.send({ t: 'begin' });
    let hand2 = false;
    steps = 0;
    while (!hand2 && steps < 200) {
      steps += 1;
      for (const cli of clis) {
        await feed(cli, await cli.next());
        if (cli.peer.info().hand >= 2) hand2 = true;
      }
    }
    assert.ok(hand2, '房主点了继续，第 2 手就该开出来（无需再准备）');
    assert.equal(running.info().fault, null);
    note('srv/12 hosted 产品路径：not_host（error 档）→ 双准备 → 房主开始 → 整手 → settled 停住 → 续局到第 2 手');
  } finally {
    for (const cli of clis) cli.close();
    await watchdog(running.close(), 'close');
  }
});
