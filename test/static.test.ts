// 工单 §3.6 纯度 + §3.7 工程约束（静态检查清单已公开，这里先自查）。
// 本文件是测试工装，允许用 node 内置模块；被检查对象是 src/ 与 test/run.ts。
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from './harness.ts';

// M0 冻结面：只允许 import type，且只指向 ./rules.ts
const M0_FILES = ['src/cards.ts', 'src/rules.ts'];

function allSrcFiles(dir: string): string[] {
  return readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? allSrcFiles(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []))
    .sort();
}

// 引擎也受同一条纯度约束（工单 §2.5 / §5）：src/ 下所有文件都在扫描范围内
const SRC_FILES = allSrcFiles('src');

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

// 剥掉注释后再扫（本文件的其它用例刻意用原文扫 = 更严）。
// static/13 需要它：被禁的符号名恰好是这条约束的说明文字，不该为了过检把注释写成黑话。
function codeOf(rel: string): string {
  return read(rel)
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function scan(file: string, banned: RegExp[]): string[] {
  const hits: string[] = [];
  for (const line of read(file).split('\n')) {
    for (const re of banned) {
      if (re.test(line)) hits.push(`${file}: ${line.trim()}`);
    }
  }
  return hits;
}

const SRC_SCAN = (banned: RegExp[]): string[] => SRC_FILES.flatMap((f) => scan(f, banned));

test('static/00 扫描范围覆盖 cards / rules / engine / ai 全部源文件', () => {
  for (const f of [
    ...M0_FILES,
    'src/engine/state.ts',
    'src/engine/validate.ts',
    'src/engine/actions.ts',
    'src/engine/settle.ts',
    'src/engine/project.ts',
    'src/ai/honest.ts',
  ]) {
    assert.ok(SRC_FILES.includes(f), `扫描范围漏了 ${f}`);
  }
});

test('static/01 src 里不出现时钟与随机全局态', () => {
  assert.deepEqual(SRC_SCAN([/Math\.random/, /\bDate\b/, /performance/, /hrtime/, /timeOrigin/]), []);
});

test('static/02 src 里不出现文件、网络与控制台 IO', () => {
  assert.deepEqual(
    SRC_SCAN([/require\(/, /node:/, /fetch\(/, /readFile/, /writeFile/, /XMLHttpRequest/, /WebSocket/, /process\./, /console\./]),
    [],
  );
});

test('static/03 src 不引用任何运行时全局可变对象', () => {
  assert.deepEqual(SRC_SCAN([/globalThis/, /\bnew Function\b/, /\beval\(/, /\bmodule\./, /\bBuffer\b/]), []);
});

test('static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts', () => {
  for (const f of SRC_FILES) {
    for (const raw of read(f).split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('import ')) continue;
      assert.match(line, /from '\.\.?\//, `${f}: import 必须是相对路径，不允许裸包名/node: —— ${line}`);
      if (M0_FILES.includes(f)) {
        assert.match(line, /^import type \{[^}]*\} from '\.\/rules\.ts';$/, `${f}: ${line}`);
      }
    }
  }
});

test('static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）', () => {
  assert.deepEqual(
    SRC_SCAN([/\benum\b/, /\bnamespace\b/, /^\s*@[A-Za-z]/, /constructor\s*\([^)]*\b(private|public|protected|readonly)\b/]),
    [],
  );
});

test('static/06 零运行时依赖：dependencies 必须为空（或整体不存在）', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  const deps = pkg.dependencies;
  // 交付文本里 dependencies 字段整体缺省 —— Q5 裁定确认"缺省 ≡ 空对象"，语义就是零运行时依赖。
  // 这里同时容忍显式的空对象：若哪天有人把它写回去，也一样合规；两者都不合规的判据是"键非空"。
  assert.ok(deps === undefined || Object.keys(deps).length === 0, `存在运行时依赖: ${JSON.stringify(deps)}`);
});

test('static/07 devDependencies 落在工单白名单内', () => {
  const pkg = JSON.parse(read('package.json')) as { devDependencies?: Record<string, string> };
  // 白名单来源逐条标注（§2.7/§3.7 基准 + Q3 裁定 A 的 M3 扩充）；不在列内的一律算越界
  const allow = new Set(['typescript', '@types/node', 'tsx', 'vite']);
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    assert.ok(allow.has(name), `devDependency ${name} 不在白名单`);
  }
  // vite 只准待在 devDependencies：一旦进 dependencies，测试纯净性与"零运行时依赖"就同时失守
  const deps = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  assert.equal(Object.keys(deps.dependencies ?? {}).includes('vite'), false, 'vite 混进了 dependencies');
});

test('static/08 npm test 是单命令，且不依赖任何已安装依赖', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  const cmd = pkg.scripts['test'] ?? '';
  assert.equal(cmd, 'node test/run.ts');
  assert.ok(!/&&|\|/.test(cmd), `不应当是复合命令: ${cmd}`);
});

test('static/09 tsconfig 打开 strict 与 erasableSyntaxOnly', () => {
  const tsconfig = JSON.parse(read('tsconfig.json')) as { compilerOptions: Record<string, unknown> };
  assert.equal(tsconfig.compilerOptions['strict'], true);
  assert.equal(tsconfig.compilerOptions['erasableSyntaxOnly'], true);
  assert.equal(tsconfig.compilerOptions['noEmit'], true);
});

test('static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）', () => {
  const text = read('test/run.ts');
  for (const re of [/\bDate\b/, /performance/, /hrtime/, /random/]) {
    assert.ok(!re.test(text), `run.ts 不该出现 ${String(re)}`);
  }
});

test('static/11 测试目录可被 runner 发现且无空目录', () => {
  const files = readdirSync(new URL('../test', import.meta.url))
    .filter((f) => f.endsWith('.test.ts'))
    .sort();
  assert.ok(files.length >= 5, `发现的测试文件过少: ${files.join(',')}`);
  for (const f of files) {
    assert.ok(read(`test/${f}`).trim().length > 0, `${f} 是空文件`);
  }
});

test('static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）', () => {
  const names = new Set<string>();
  for (const f of M0_FILES) {
    for (const raw of read(f).split('\n')) {
      const m = /^export (?:function|const|type) (\w+)/.exec(raw.trim());
      if (m?.[1]) names.add(m[1]);
    }
  }
  const expected = new Set([
    'Card',
    'TierId',
    // M2 §1 庄家行：Rules 补 dealer.next 三档，导出形态与 TierId / TIER_IDS 对称
    'DealerNextId',
    'DEALER_NEXT_IDS',
    'Hand',
    'Rng',
    'classify',
    'compare',
    'makeDeck',
    'mulberry32',
    'shuffle',
    'Rules',
    'TierId',
    'TIER_IDS',
    // M2 §1 庄家行：dealer.next 三档配置。与 TierId/TIER_IDS 同构地导出"类型 + 合法集合"两件
    'DealerNextId',
    'DEALER_NEXT_IDS',
    'validateRules',
    'presets',
  ]);
  assert.deepEqual([...names].sort(), [...expected].sort());
});

// 工单 §2.6 + §4 M2「AI 不许偷看 / 只能用 project() 的合法信息」的可执行形态。
// 结构上 View 压根没有 hand 字段，所以这里禁的是"绕过 View 的写法"本身。
const AI_BANNED: RegExp[] = [
  /GameState/,
  /\.\s*hand(?![A-Za-z0-9_])/,
  /\bstate\.seats\b/,
  /legalActions\(/,
  /actionCost\(/,
  /\bapply\(/,
  /startHand\(/,
  /Math\.random/,
  /node:/,
  /webmin/,
];
test('static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中', () => {
  const aiFiles = SRC_FILES.filter((f) => f.startsWith('src/ai/'));
  assert.ok(aiFiles.length >= 1, 'src/ai/ 下一个实现文件都没有');
  for (const f of aiFiles) {
    const body = codeOf(f)
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    const hits = AI_BANNED.filter((re) => re.test(body)).map((re) => `${f}: ${String(re)}`);
    assert.deepEqual(hits, [], `${f} 出现了越界引用`);
    // engine/state.ts 只许 type-only import：拿到类型拿不到运行时状态
    for (const line of read(f).split('\n')) {
      if (/from '\.\.\/engine\/state\.ts'/.test(line)) {
        assert.match(line, /^\s*import type\b/, `${f} 对 engine/state.ts 做了运行时 import`);
      }
    }
  }
});
