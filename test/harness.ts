// 测试用例登记表。
// 两种运行模式：
//  1) `node test/run.ts`（= npm test）：run.ts 事先在 globalThis 上放好 runner 标记与
//     用例接收器，本模块只登记不执行，由 run.ts 顺序跑并输出确定性报告。
//  2) `node --test test/xxx.test.ts`：没有标记，直接转交 node:test，保持原生可用。
// 之所以自带报告：node --test 内置 reporter 会打印 (1.234ms) 与 duration_ms，
// 两次运行输出必然不同，违反工单 §0.5；而 --test-reporter 自定义报告器在
// 进程隔离下拿不到子测试事件、test:fail 的 data.error 还是空的（本机已实测）。
import { test as nodeTest } from 'node:test';

type CaseFn = () => void | Promise<void>;
type SinkFn = (name: string, fn: CaseFn) => void;
type NoteFn = (text: string) => void;

const KEY_RUNNER = Symbol.for('zjh.runner');
const KEY_SINK = Symbol.for('zjh.cases');
const KEY_NOTE = Symbol.for('zjh.note');
const g = globalThis as unknown as Record<symbol, unknown>;
const OWN_RUNNER = g[KEY_RUNNER] === 'own';

export function test(name: string, fn: CaseFn): void {
  if (OWN_RUNNER) {
    const sink = g[KEY_SINK];
    if (typeof sink !== 'function') {
      throw new Error('zjh runner flag present but case sink is missing');
    }
    (sink as SinkFn)(name, fn);
    return;
  }
  nodeTest(name, fn);
}

// 把"可独立复算的固定向量"打进报告的 NOTES 段（只在自持 runner 模式下生效）。
export function note(text: string): void {
  if (!OWN_RUNNER) return;
  const f = g[KEY_NOTE];
  if (typeof f === 'function') (f as NoteFn)(text);
}
