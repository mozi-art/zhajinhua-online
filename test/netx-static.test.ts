// M4 · 联机层自身的静态机检。
// 目的只有一个：把"M4 没引任何第三方依赖""引擎仍然不知道联机存在"
// 这两件事从"我说了"变成可重跑的断言。
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { note, test } from './harness.ts';

function netxFiles(): string[] {
  return readdirSync(new URL('../netx', import.meta.url))
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => `netx/${f}`);
}

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

// 浏览器与 Node 同源可跑的那批：客户端与协议核心。
// M5 起把 webui/netplay.ts 也纳进来（工单 §4 M5："nst/03 的可移植层静态检查面因此要把 webui 里
// 新增的联机文件也纳进来"）—— 它是页面侧唯一碰协议的地方，一旦哪天有人往里塞 Date.now 或 localStorage，
// 这条检查会立刻响，而不是等到两个标签页互相顶掉 token 才发现。
const PORTABLE = [
  'netx/sha256.ts',
  'netx/seed.ts',
  'netx/protocol.ts',
  'netx/frames.ts',
  'netx/client.ts',
  'netx/room.ts',
  'webui/netplay.ts',
];
// 只有这三份允许碰 node: 与真实时钟（M6 起 hub.ts 也是 socket 层：多房间路由是服务端专属，
// 浏览器端永远不需要它 —— 房间码本身的校验在可移植的 protocol.ts 里）
const SOCKET_LAYER = ['netx/ws.ts', 'netx/serve.ts', 'netx/hub.ts'];

test('nst/01 扫描范围覆盖 netx 全部源文件，可移植清单里的文件都真实存在', () => {
  const files = netxFiles();
  const covered = new Set<string>([...PORTABLE, ...SOCKET_LAYER]);
  for (const f of files) {
    assert.ok(covered.has(f), `netx/${f} 没被任何一条静态检查覆盖（新增文件要归类）`);
  }
  for (const f of [...PORTABLE, ...SOCKET_LAYER]) {
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `清单里的 ${f} 不存在（改名要同步这条）`);
  }
});

test('nst/02 零第三方依赖：netx 里每个 import 都是相对路径或 node: 内置', () => {
  const offenders: string[] = [];
  const bare: string[] = [];
  for (const f of netxFiles()) {
    for (const raw of read(f).split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('import ') && !line.startsWith('export ')) continue;
      const m = /from '([^']+)'/.exec(line);
      if (m === null) continue;
      const spec = m[1] as string;
      if (spec.startsWith('./') || spec.startsWith('../')) continue;
      if (spec.startsWith('node:')) {
        if (!SOCKET_LAYER.includes(f)) offenders.push(`${f}: ${spec}`);
        continue;
      }
      bare.push(`${f}: ${spec}`);
    }
  }
  assert.deepEqual(bare, [], '出现了裸包名 import（等于引了第三方依赖）');
  assert.deepEqual(offenders, [], '协议核心不许依赖 node: 内置 —— 客户端要能在浏览器里跑同一份代码');
});

test('nst/03 协议核心里没有时钟、随机与 IO（引擎的确定性口径延续到联机层）', () => {
  const banned = [/Math\.random/, /\bDate\b/, /setTimeout/, /setInterval/, /process\./, /require\(/, /readFile/, /console\./];
  const hits = PORTABLE.flatMap((f) => {
    const body = read(f)
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    return banned.filter((re) => re.test(body)).map((re) => `${f}: ${String(re)}`);
  });
  assert.deepEqual(hits, [], '这些文件必须是纯计算：时钟与随机一律从外面注入');
});

function walkTs(dir: string): string[] {
  return readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walkTs(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : [],
    )
    .sort();
}

// 页面侧唯一允许知道 netx 存在的文件：那道墙的入口本身（工单 §4 M5 要求"直接复用 netx/client.ts、
// 不许写第二份客户端协议实现"）。把进口收窄到一个文件，比"谁都能 import netx"更容易证明只有一道墙；
// 引擎与单机通路则仍然一个字都不许认识 netx。
const UI_NET_SEAM = 'webui/netplay.ts';

test('nst/04 分层：src/ 与 webmin/ 完全不知道联机存在；webui 里只有 netplay.ts 这一个进口', () => {
  // rev=9 变异 N01 暴露的缺口：原先只扫这三个目录的顶层文件，且正则只认单层 '../netx/'
  // ⇒ src/engine/actions.ts 里一句 `from '../../netx/seed.ts'` 既能躲过目录、也能躲过正则。
  const files = ['src', 'webui', 'webmin'].flatMap((dir) => walkTs(dir));
  assert.ok(files.includes('src/engine/actions.ts'), '子目录必须真的被扫到，否则这条检查是空的');
  assert.ok(files.includes('webui/main.ts') && files.includes('webui/netplay.ts'), 'webui 的子层没扫全');
  const hits = files.flatMap((f) =>
    read(f)
      .split('\n')
      .filter((l) => /^\s*(?:import|export)\b[^\n]*from\s+'[^']*netx\/[^']*'|^\s*import\s+'[^']*netx\/[^']*'/.test(l))
      .map((l) => `${f}: ${l.trim()}`),
  );
  const seams = hits.filter((h) => h.startsWith(`${UI_NET_SEAM}:`));
  const others = hits.filter((h) => !h.startsWith(`${UI_NET_SEAM}:`));
  assert.deepEqual(others, [], '引擎与单机通路不该知道联机层存在');
  assert.ok(seams.length >= 1, `${UI_NET_SEAM} 必须确实 import netx/client.ts，否则"复用同一道墙"是空话`);
  // 进口本身也要收窄：只许认识"那道墙"和"消息形状"，不许直接拿房间/帧/摘要层自己搭一套
  for (const h of seams) {
    assert.match(h, /netx\/(?:client|protocol)\.ts'/, `页面侧多了一条不该有的 netx 进口：${h}`);
  }
  assert.ok(seams.some((h) => /netx\/client\.ts/.test(h)), '那组进口里必须包含 client.ts 那道墙本身');
  assert.ok(!seams.some((h) => /netx\/(?:room|ws|seed|sha256|frames)\.ts/.test(h)), '页面侧不许直接引用房间/传输/摘要层（那等于绕过第二道墙）');
});

test('nst/05 tsconfig 的 include 覆盖 netx，且沿用同一条可擦除语法约束', () => {
  const cfg = JSON.parse(read('tsconfig.json')) as { compilerOptions: Record<string, unknown>; include: string[] };
  assert.ok(cfg.include.includes('netx/**/*.ts'), 'netx 没进 include，tsc 就不会检查它');
  assert.equal(cfg.compilerOptions['strict'], true);
  assert.equal(cfg.compilerOptions['erasableSyntaxOnly'], true);
});

test('nst/06 netx 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）', () => {
  const banned = [/\benum\b/, /\bnamespace\b/, /^\s*@[A-Za-z]/, /constructor\s*\([^)]*\b(private|public|protected|readonly)\b/];
  const hits = netxFiles().flatMap((f) => {
    const body = read(f)
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    return banned.filter((re) => re.test(body)).map((re) => `${f}: ${String(re)}`);
  });
  assert.deepEqual(hits, []);
});

test('nst/07 M4 之后依赖面仍然没扩：dependencies 空、devDependencies 仍在白名单内', () => {
  const pkg = JSON.parse(read('package.json')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = Object.keys(pkg.dependencies ?? {});
  assert.deepEqual(deps, [], `dependencies 必须保持空对象，实得 ${deps.join(',')}`);
  const allow = new Set(['typescript', '@types/node', 'tsx', 'vite']);
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    assert.ok(allow.has(name), `devDependency ${name} 不在白名单`);
  }
  assert.equal('ws' in (pkg.dependencies ?? {}), false, '没装 ws —— 帧协议在 netx/frames.ts 自己实现');
  assert.equal('ws' in (pkg.devDependencies ?? {}), false, '同上');
  note(`nst/07 依赖面：dependencies=${JSON.stringify(pkg.dependencies ?? {})}，devDependencies=${Object.keys(pkg.devDependencies ?? {}).sort().join(',')}`);
});

test('nst/08 房间层的时钟与随机全部来自注入（RoomOptions 是唯一的入口）', () => {
  const room = read('netx/room.ts');
  assert.match(room, /clock\.after\(/, '定时器只从注入的 Clock 走');
  assert.match(room, /options\.entropy\(\)/, '份额与重连凭据只从注入的熵源走');
  assert.doesNotMatch(room, /randomBytes|crypto\.random/, 'room.ts 里不该自己取随机');
  // rev=8 应修 4：Clock 的义务只有"到点叫我"。接口里挂一个没人调用的 now() 会让复审误以为
  // 房间层在读真实时间；测试夹具要用钟面自己加（FakeClock.now / nextDue）。
  assert.doesNotMatch(room, /now\s*\(\s*\)\s*:\s*number/, 'Clock 接口里不该有无人调用的读钟方法');
  assert.doesNotMatch(room, /clock\.now\(/, '房间层不读钟：只排程');
  const ws = read('netx/ws.ts');
  assert.match(ws, /randomBytes\(16\)/, '真实熵在 socket 层给进来');
  assert.doesNotMatch(ws, /\bDate\b/, 'socket 层也不对表：整个 netx/ 里没有任何一处读真实时间');
});

test('nst/10 Q6=A2 ④：价格公式不许扩散 —— 页面侧只有 netplay.ts 这一个接缝', () => {
  // 裁定原文（ANSWERS.md 第六轮 ④）：除 webui/netplay.ts 那一个接缝，webui/*.ts 别处不许出现
  // rules.bet / rules.compare 字样。这里把它扩成四条同族判据：
  //   · 乘数字段只在接缝里出现            → 没有第二处算钱的地方
  //   · priceOf 只在接缝里被调用           → 算的那一下确实是引擎里的同一个函数
  //   · GameState 形状的价格函数不出现在 webui → ②"不许伪造 GameState 去调 actionCost"
  //   · canAffordCall 不出现在 webui       → ③"不许拿筹码与本地价比较来决定能不能点"
  const files = walkTs('webui');
  assert.ok(files.includes('webui/netplay.ts') && files.includes('webui/main.ts'), 'webui 没扫全 ⇒ 这条检查是空的');
  const codeOf = (f: string): string =>
    read(f)
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  const banned = [/rules\.bet\b/, /rules\.compare\b/, /actionCost\s*\(/, /callPrice\s*\(/, /canAffordCall\s*\(/];
  const seam = 'webui/netplay.ts';
  const offenders = files.flatMap((f) => (f === seam ? [] : banned.filter((re) => re.test(codeOf(f))).map((re) => `${f}: ${String(re)}`)));
  assert.deepEqual(offenders, [], '价格算式扩散到了接缝以外（Q6=A2 ②③④）');
  const seamBody = codeOf(seam);
  assert.match(seamBody, /priceOf\(/, '接缝本身必须真的调用那一处算术，否则联机侧的金额是别处来的');
  assert.equal(
    (seamBody.match(/priceOf\(/g) ?? []).length,
    1,
    '接缝里出现第二处 priceOf 调用以外的东西 ⇒ 有人在页面侧又算了一遍（应当是一个包装函数、多处取数）',
  );
  // 三档要花钱的按钮都必须从那一处包装取数（而不是各自现场乘一遍乘数）
  for (const kind of ['call', 'raise', 'compare']) {
    assert.match(seamBody, new RegExp(`\\bshow\\('${kind}'\\)`), `${kind} 按钮的金额没走 priceOf 那个包装`);
  }
  for (const f of files) {
    if (f === seam) continue;
    assert.equal(/priceOf\s*\(/.test(codeOf(f)), false, `${f} 也调了 priceOf ⇒ 出现第二个显示用价格的出口`);
  }
  // 正向对照：一份"坏页面层"必须被上面每条判据各命中一次
  const bad = [
    'const p = state.rules.bet.seen * state.stake;',
    'const fee = s.rules.compare.fee;',
    'return actionCost(st, 0, "call");',
    'return callPrice(st, 0);',
    'if (!canAffordCall(st, 0)) disable();',
  ].join('\n');
  const hits = banned.filter((re) => re.test(bad));
  assert.equal(hits.length, banned.length, `对照组只命中 ${String(hits.length)}/${String(banned.length)} 条 ⇒ 这条门是虚的`);
  note(`nst/10 扫 webui 全部 ${String(files.length)} 个 .ts：价格算式只在 ${seam}，其内 priceOf 只调一次、三档按钮都从它取数`);
});

test('nst/11 跑测工装必须挡住"带 PID 的实验警告"这条双跑破口（§0.5）', () => {
  // M5 起 srv/01 经 HTTP 取 .ts ⇒ readAsset 调 stripTypeScriptTypes ⇒ Node 往 stderr 打两行
  // 行首带进程 PID 的 ExperimentalWarning ⇒ 同一条命令两次运行字节不同（第一次双跑就栽在这里）。
  // 实测 process.on('warning') 拦不住默认打印，所以过滤做在写 stderr 那一侧；这条用例防的是
  // "以后有人把这层过滤删掉，于是交付证据里的哈希再也不相等"。行为侧的证据是 TEST-OUTPUT §10 的四个哈希。
  const runner = read('test/run.ts');
  assert.match(runner, /const warningNoise =/, '工装里没有这层过滤 ⇒ 双跑哈希会漂');
  assert.ok(
    runner.includes('ExperimentalWarning: stripTypeScriptTypes is an experimental feature'),
    '过滤必须精确到这一条警告（含它后面那行 trace 提示）',
  );
  assert.match(runner, /filtered = chunk\.replace\(warningNoise, ''\)/, '只删匹配上的噪声');
  assert.match(runner, /if \(filtered === ''\) return true;/, '整块都是噪声才吞掉');
  assert.match(runner, /realStderrWrite/, '其余内容必须仍然写回 stderr（不许通用静音）');
});

test('nst/09 M4 的测试文件自己也不许用时钟与随机（否则双跑必然不一致）', () => {
  const files = readdirSync(new URL('../test', import.meta.url))
    .filter((f) => f.startsWith('netx-') && f.endsWith('.ts'))
    .sort();
  assert.ok(files.length >= 6, `M4 测试文件过少：${files.join(',')}`);
  // 唯一例外：需要"等真实对端"的那些文件允许一条防挂死看门狗。它只负责在流程死掉时 reject，
  // 不参与任何判定（正常路径毫秒级完成），所以输出仍然逐字节一致。
  // M5 起这个例外从 1 个文件扩到 2 个：netx-serve.test.ts 要等子进程打印监听行。
  const TIMER_EXCEPTIONS: Record<string, number> = { 'netx-ws.test.ts': 3, 'netx-serve.test.ts': 1 };
  const hits = files.flatMap((f) => {
    const body = read(`test/${f}`)
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    const banned = f in TIMER_EXCEPTIONS
      ? [/Math\.random/, /Date\.now/, /new Date\(/, /performance\./]
      : [/Math\.random/, /Date\.now/, /new Date\(/, /performance\./, /setTimeout\(/];
    return banned.filter((re) => re.test(body)).map((re) => `test/${f}: ${String(re)}`);
  });
  assert.deepEqual(hits, [], '测试里的时间与随机会让 §0.5 的双跑一致性失效');
  for (const [name, atLeast] of Object.entries(TIMER_EXCEPTIONS)) {
    const body = read(`test/${name}`);
    assert.match(body, /WATCHDOG_MS = 20000/, `${name} 的看门狗必须是那个很宽的量级`);
    assert.equal(
      (body.match(/setTimeout\(/g) ?? []).length >= atLeast,
      true,
      `${name} 的看门狗确实存在（这条防的是"例外被悄悄删掉"）`,
    );
  }
  note(`nst/09 M4 测试文件 ${files.length} 份：${files.join(', ')}；时钟例外只给 ${Object.keys(TIMER_EXCEPTIONS).join(' / ')}（仅看门狗）`);
});

test('nst/12 「在场筹码+池」一把尺：标签、渲染处、过滤口径、两个页面入口必须同进退（rev=10 应修 7）', () => {
  // 应修 7 的改法是①"改标签"。裁定要求钉住"标签文案与 departed 过滤口径一致"。
  // 光钉行为不够（nui/22 只证明算法算的是在场 + 池），文案漂回「桌上总额」那天，
  // 显示的行会再一次陈述一个与自己口径不符的事实 ⇒ 这里把"文案 / 渲染处 / 过滤 / 两个入口"四处缝在一起。
  const label = /export const TOTAL_LABEL = '([^']*)';/.exec(read('webui/scene.ts'))?.[1];
  assert.ok(label !== undefined && label.length > 0, 'TOTAL_LABEL 没被导出 ⇒ 用例与门都钉不住这一对');
  const text = String(label);
  // ① 文案自己交代范围：必须说"在场"，不许再用那种更宽的整桌措辞
  assert.match(text, /在场/, `标签必须写明范围，实得「${text}」`);
  for (const wide of ['桌上', '总共', '全部', '所有']) assert.ok(!text.includes(wide), `标签里的「${wide}」比算法的范围宽：${text}`);
  // ② 渲染处只有一个，而且就是用这个常量
  const renderLines = read('webui/scene.ts').split('\n').filter((l) => l.includes('String(snap.total)'));
  assert.equal(renderLines.length, 1, `snap.total 的渲染出口应当只有一处，实得 ${String(renderLines.length)} 处`);
  assert.match(String(renderLines[0]), /TOTAL_LABEL/, '那一行没引用 TOTAL_LABEL ⇒ 有人在渲染处现场又写了一个标签');
  // ③ 过滤口径还在：netplay 的 total 仍然只算没离桌的那些格子（与 ledgerLine 同一个 filter）
  const seam = read('webui/netplay.ts');
  assert.match(seam, /total:[^\n]*departed[^\n]*c\.chips/, 'total 的 departed 过滤没了 ⇒ 标签又开始说谎（这是裁定点名的"不接受的改法"）');
  assert.match(seam, /ledgerLine[\s\S]{0,80}filter\(\(c\) => !c\.departed\)/, 'ledgerLine 与 total 不同口径 ⇒ 同一行里的两样东西会互相打脸');
  // ④ 一把尺：旧标签不许残留在任何交付**代码**里（注释里提它是历史说明，不算渲染）；
  //    两个页面入口（画布 + M1.5 的 DOM 台账行）用同一个词。
  const codeOnly = (f: string): string =>
    read(f)
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
  const scanned = ['webui', 'webmin', 'netx', 'src'].flatMap((d) => walkTs(d));
  const stale = scanned.filter((f) => codeOnly(f).includes('桌上总额'));
  assert.deepEqual(stale, [], '仍有源码在渲染旧标签 ⇒ 同一件事在两个入口有两种说法');
  assert.ok(read('webmin/app.ts').includes(text), `webmin/app.ts 的台账行没跟着同一把尺（应含「${text}」）`);
  // ⑤ 正向对照：三种"退回旧写法"的改动必须各被上面某条判据命中，否则这扇门是虚的。
  //    每组都先断言"锚点确实打中了"——改不动源码文本的对照组等于空转（这一类我自己栽过一次）。
  const scene = read('webui/scene.ts');
  const backToWide = scene.replace(`export const TOTAL_LABEL = '${text}';`, "export const TOTAL_LABEL = '桌上总额';");
  assert.notEqual(backToWide, scene, '对照组 A 的锚点没打中 ⇒ 它没有在比任何东西');
  assert.equal(/在场/.test(String(/export const TOTAL_LABEL = '([^']*)';/.exec(backToWide)?.[1] ?? '')), false, 'A（文案漂回宽口径）必须被 ① 命中');
  const hardCoded = scene.replace('${TOTAL_LABEL}', '在场数');
  assert.notEqual(hardCoded, scene, '对照组 B 的锚点没打中');
  assert.equal(
    hardCoded.split('\n').some((l) => l.includes('String(snap.total)') && /TOTAL_LABEL/.test(l)),
    false,
    'B（渲染处现场写死标签、绕开常量）必须被 ② 命中',
  );
  const noFilter = seam.replace('total: cells.reduce((a, c) => a + (c.departed ? 0 : c.chips), 0)', 'total: cells.reduce((a, c) => a + c.chips, 0)');
  assert.notEqual(noFilter, seam, '对照组 C 的锚点没打中');
  assert.equal(/total:[^\n]*departed[^\n]*c\.chips/.test(noFilter), false, 'C（只摘过滤不改标签，裁定点名的那一档）必须被 ③ 命中');
  note(`nst/12 标签「${text}」：文案①渲染②过滤③入口④四道判据互锁，三组对照各命中一条（webui/webmin/netx/src 共 ${scanned.length} 个 .ts 被扫）`);
});

test('nst/13 日志区两条分支同一条上限，且 notices 的窗口不许超过它（rev=11 应修 3）', () => {
  // 快照的 log 有两条产出路径：未开局（collect）那段与正常对局那段。两条都得受同一个 40 行上限管，
  // 而并进去的服务端 notices 自己还有个"最近 N 条"的窗口 —— 那个窗口一旦比上限大，
  // 引擎日志就会被挤出去（日志区变成 notices 专用栏）。这三件事全靠这条门钉住。
  const src = read('webui/netplay.ts');
  const logLines = src.split('\n').filter((l) => /^\s+log: \[/.test(l));
  assert.equal(logLines.length, 2, `netplay 里应当恰好两条 log 装配语句（collect 分支 + 主分支），实得 ${String(logLines.length)} 条`);
  for (const l of logLines) {
    assert.match(l, /\.slice\(-\d+\),\s*$/, `这条分支没接日志上限：${l.trim()}`);
  }
  const cap = /log: \[[^\n]*\]\.slice\(-(\d+)\)/.exec(logLines[1] as string)?.[1];
  const capCollect = /log: \[[^\n]*\]\.slice\(-(\d+)\)/.exec(logLines[0] as string)?.[1];
  assert.equal(cap, capCollect, `两条分支的上限不是同一个数：${String(cap)} vs ${String(capCollect)}`);
  const limit = Number(cap);
  assert.ok(Number.isInteger(limit) && limit > 0, `上限得是个正整数，实得 ${String(cap)}`);
  const noticeWindow = Number(/info\.notices\.slice\(-(\d+)\)/.exec(src)?.[1]);
  assert.ok(Number.isInteger(noticeWindow) && noticeWindow > 0, `没找到 notices 的窗口（锚点漂了）：${String(noticeWindow)}`);
  assert.ok(noticeWindow <= limit, `notices 窗口 ${String(noticeWindow)} 比日志上限 ${String(limit)} 还大 ⇒ 引擎日志会被挤光`);
  // 正向对照：把上限或窗口改成会违规的形状，判据必须各命中一次（否则这条门是虚的）
  const noCap = (logLines[0] as string).replace('.slice(-40)', '');
  assert.equal(/log: \[[^\n]*\]\.slice\(-\d+\)/.test(noCap), false, '对照组 A（collect 分支丢掉上限）必须被上面某条命中');
  const tooBig = src.replace(/info\.notices\.slice\(-(\d+)\)/, 'info.notices.slice(-999)');
  assert.notEqual(tooBig, src, '对照组 B 的锚点没打中');
  assert.ok(Number(/info\.notices\.slice\(-(\d+)\)/.exec(tooBig)?.[1]) > limit, '对照组 B：窗口 999 必须大于上限');
  // 同族的一件事：本轮往 netx-ws 加了用例，而那份文件是全项目仅有的两处"允许 setTimeout"之一。
  // nst/09 的例外是按**下限**给的（">= 3"），有人再加看门狗就会悄悄把例外面撑宽 ⇒ 这里钉住精确数量。
  const wsTimers = (read('test/netx-ws.test.ts').match(/setTimeout\(/g) ?? []).length;
  assert.equal(wsTimers, 3, `test/netx-ws.test.ts 里的 setTimeout 从 3 处变成了 ${String(wsTimers)} 处 ⇒ 要么改 nst/09 的例外清单并写明理由，要么别加时钟`);
  note(`nst/13 两条 log 分支同为 ${String(limit)} 行上限，notices 窗口 ${String(noticeWindow)} ≤ 上限；两组对照各命中一条，另钉住 netx-ws 的时钟例外仍是 3 处`);
});
