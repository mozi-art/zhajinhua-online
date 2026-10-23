// npm test 的入口：发现 test/*.test.ts → 按文件名顺序登记 → 顺序执行 → 输出确定性报告。
// 输出不含耗时、时间戳、随机顺序（工单 §0.5 与 §3.7 的前提）。
// 本文件是测试工装，允许用 node 内置模块；src/ 下的纯度由 test/static-checks.test.ts 单独把关。
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type CaseRecord = { name: string; fn: () => void | Promise<void>; file: string };

const cases: CaseRecord[] = [];
const notes: string[] = [];

const g = globalThis as unknown as Record<symbol, unknown>;
g[Symbol.for('zjh.runner')] = 'own';
g[Symbol.for('zjh.cases')] = (name: string, fn: () => void | Promise<void>): void => {
  cases.push({ name, fn, file: '?' });
};
g[Symbol.for('zjh.note')] = (text: string): void => {
  notes.push(text);
};

// §0.5 双跑一致性的一个真实破口：M5 起 srv/01 会经 HTTP 取 `webui/main.ts`，那一走到
// `webmin/serve.ts::readAsset` → `node:module.stripTypeScriptTypes`，Node 就打一条 ExperimentalWarning，
// 而**行首带进程 PID** ⇒ 同一条命令两次运行的字节不一样（第一次实测就是栽在这一行上）。
// 试过 `process.on('warning', …)`：**实测拦不住** —— 监听器收到了，Node 的默认打印照样跑
// （`node -e` 单验：先打默认那两行，才打监听器里的输出）。所以只能在"写 stderr"这一侧精确删掉这两行。
// 精确到条目、不通用静音：其它警告照原样出去。
const warningNoise =
  /^\(node:\d+\) ExperimentalWarning: stripTypeScriptTypes is an experimental feature[^\n]*\n\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\n/g;
const realStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: unknown, ...rest: unknown[]): boolean => {
  if (typeof chunk === 'string') {
    const filtered = chunk.replace(warningNoise, '');
    if (filtered === '') return true;
    return (realStderrWrite as (c: string, ...a: unknown[]) => boolean)(filtered, ...rest);
  }
  return (realStderrWrite as (c: unknown, ...a: unknown[]) => boolean)(chunk, ...rest);
}) as typeof process.stderr.write;

const dir = resolve('test');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort();

for (const f of files) {
  const before = cases.length;
  await import(pathToFileURL(resolve(dir, f)).href);
  for (let i = before; i < cases.length; i += 1) {
    const c = cases[i];
    if (c !== undefined) c.file = `test/${f}`;
  }
}

function detail(err: unknown): string[] {
  const e = err as { name?: string; message?: string; code?: string; cause?: unknown };
  const head = `${e.name ?? 'Error'}${e.code === undefined ? '' : ` [${e.code}]`}: ${e.message ?? String(err)}`;
  const cause = e.cause as { name?: string; message?: string } | undefined;
  const extra = cause?.message === undefined ? [] : [`caused by: ${cause.name ?? 'Error'}: ${cause.message}`];
  return [...head.split('\n'), ...extra]
    .join('\n')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)
    .slice(0, 10);
}

const lines: string[] = [];
let passed = 0;
let failed = 0;

for (const c of cases) {
  try {
    await c.fn();
    passed += 1;
    lines.push(`PASS ${c.file} :: ${c.name}`);
  } catch (err) {
    failed += 1;
    lines.push(`FAIL ${c.file} :: ${c.name}`);
    for (const l of detail(err)) lines.push(`      | ${l}`);
  }
}

notes.sort();
lines.unshift('=== ZJH TEST REPORT (deterministic) ===');

const report: string[] = [
  ...lines,
  '',
  '=== NOTES (fixed vectors, recompute-able independently) ===',
  ...(notes.length > 0 ? notes : ['(none)']),
  '',
  `RUNNER files=${String(files.length)} cases=${String(cases.length)}`,
  `SUMMARY pass=${String(passed)} fail=${String(failed)} total=${String(cases.length)}`,
  failed === 0 && cases.length > 0 ? 'RESULT=ALL_PASS' : 'RESULT=HAS_FAIL',
];

process.stdout.write(`${report.join('\n')}\n`);
process.exitCode = failed === 0 && cases.length > 0 ? 0 : 1;
