// M4 · 线上传输的消息契约（工单 §4 M4 的接口面）。
// 两条纪律抄自 src/rules.ts：
//   1) 严格校验 —— 未知 key、缺 key、越界整数、非法字符串一律抛错，不做"宽容解析"。
//      客户端尤其不能宽容：多接一个 key 就多一条服务端可以偷偷塞数据的通道。
//   2) 解码时按 schema 声明顺序**重建**对象 ⇒ 同一条消息在任何机器上重编码都是同一串字节（§0.5）。
// 上行 action 只带 move 不带 seat：座位由连接绑定，"替别人行动"在这套 schema 里根本无法表达。
import { validateRules } from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';
import type { Action } from '../src/engine/state.ts';
import type { Event } from '../src/engine/state.ts';
import type { View } from '../src/engine/project.ts';
import { isCommitText, isParty, isShareValue } from './seed.ts';
import type { Share } from './seed.ts';

export const PROTOCOL_ID = 'zjh-m4-1';

// 单条消息与单帧的硬上限：防止对端用一条巨帧把服务端内存吃掉。
export const MAX_MESSAGE_BYTES = 1048576;

// —— 上行 ——
export type Move =
  | { kind: 'look' }
  | { kind: 'fold' }
  | { kind: 'call' }
  | { kind: 'raise' }
  | { kind: 'compare'; target: number };

export type Up =
  | { t: 'join'; name: string; buyIn: number }
  | { t: 'nonce'; hand: number; value: string }
  | { t: 'action'; hand: number; move: Move }
  | { t: 'resume'; token: string; hand: number; since: number }
  | { t: 'ping'; echo: number };

// —— 下行 ——
// 两条投影通道的分工（工单 §4 M4："stateSeq 快照 + 增量重连"）：
//   view  = 快照。view.log 是**本局全量**（1..seq）。首连、跨局重连、seq 对不上时走这条。
//   patch = 增量。envelope 的 since 是"服务端认为我看到的 seq"，view.log 只带 (since, seq] 这一段；
//           权威数字（pot/stake/turn/各家筹码）仍来自 view 本身，增量补的是日志连续性。
// 客户端两件事都要卡：seq 不能倒着走、增量的头一条必须正好接在自己那条后面（netx/client.ts）。
export type Roster = { seat: number; name: string };

export type Down =
  | { t: 'hello'; protocol: string; token: string; seat: number; name: string; rules: Rules; seats: Roster[] }
  | { t: 'commit'; hand: number; party: string; commit: string }
  | { t: 'collect'; hand: number; committed: string[]; missing: string[] }
  | { t: 'view'; hand: number; seq: number; view: View }
  | { t: 'patch'; hand: number; since: number; seq: number; view: View }
  | { t: 'reveal'; hand: number; seed: number; shares: Share[] }
  | { t: 'reject'; hand: number; code: RejectWireCode; why: string }
  | { t: 'notice'; text: string }
  | { t: 'error'; code: string; why: string }
  | { t: 'pong'; echo: number };

// 引擎的 RejectCode 全集（与 src/engine/validate.ts 逐字对齐；net 侧另加自己的码）。
// 漂移由 test/netx-protocol.test.ts 直接读源码比对，不靠人眼。
export const ENGINE_REJECT_CODES = [
  'unknown_action',
  'phase_not_betting',
  'nothing_to_settle',
  'bad_seat',
  'bad_target',
  'seat_not_active',
  'not_current_turn',
  'already_looked',
  'stake_at_max',
  'cannot_afford',
  'compare_forbidden_before_first_actions',
] as const;

export const NET_REJECT_CODES = [
  'bad_hand',
  'no_seat',
  'not_dealt',
  'bad_nonce',
  'nonce_late',
] as const;

export type EngineRejectCode = (typeof ENGINE_REJECT_CODES)[number];
export type NetRejectCode = (typeof NET_REJECT_CODES)[number];
export type RejectWireCode = EngineRejectCode | NetRejectCode;

const REJECT_CODES: readonly string[] = [...ENGINE_REJECT_CODES, ...NET_REJECT_CODES];

// —— 校验器 ——
type Spec =
  | { kind: 'litStr'; value: string }
  | { kind: 'oneOf'; values: readonly string[] }
  | { kind: 'bool' }
  | { kind: 'int'; min: number; max: number }
  | { kind: 'str'; minLen: number; maxLen: number; ascii?: boolean }
  | { kind: 'arr'; of: Spec; maxLen: number }
  | { kind: 'obj'; fields: Record<string, Spec> }
  | { kind: 'anyOf'; specs: Spec[] }
  | { kind: 'nullable'; of: Spec }
  | { kind: 'rules' }
  | { kind: 'party' }
  | { kind: 'shareValue' }
  | { kind: 'commitHex' };

export class ProtocolError extends Error {
  path: string;

  constructor(path: string, msg: string) {
    super(`invalid message at "${path}": ${msg}`);
    this.name = 'ProtocolError';
    this.path = path;
  }
}

function fail(path: string, msg: string): never {
  throw new ProtocolError(path, msg);
}

function isPlain(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  // 只认"字面量那种对象"：typed array / Date / Map / 类实例都不算。
  // 放行它们会让报错信息自己说谎（写着"必须是文本或普通对象"却放进来一个 Uint8Array），
  // 而且这些对象上取不到 't'，只会被报成"消息缺 tag"，把排查方向带到 schema 上去。
  // 判据用原型而不是 constructor：JSON.parse 产出的是 Object.prototype，而 null 原型对象也应当合法。
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

const INT_MAX = 1099511627775; // 2^40-1，足够表达筹码与 pot

function check(spec: Spec, value: unknown, path: string): unknown {
  switch (spec.kind) {
    case 'litStr': {
      if (value !== spec.value) fail(path, `must be literal "${spec.value}"`);
      return value;
    }
    case 'oneOf': {
      if (typeof value !== 'string' || !spec.values.includes(value)) {
        fail(path, `must be one of ${spec.values.join(' | ')}`);
      }
      return value;
    }
    case 'bool': {
      if (typeof value !== 'boolean') fail(path, 'must be a boolean');
      return value;
    }
    case 'int': {
      if (typeof value !== 'number' || !Number.isInteger(value)) fail(path, 'must be an integer');
      if (value < spec.min || value > spec.max) fail(path, `must be in [${String(spec.min)}, ${String(spec.max)}]`);
      return value;
    }
    case 'str': {
      if (typeof value !== 'string') fail(path, 'must be a string');
      if (value.length < spec.minLen || value.length > spec.maxLen) {
        fail(path, `length must be in [${String(spec.minLen)}, ${String(spec.maxLen)}]`);
      }
      if (spec.ascii === true && !/^[\x20-\x7e]*$/.test(value)) fail(path, 'must be printable ASCII');
      return value;
    }
    case 'party': {
      if (!isParty(value)) fail(path, `party ${String(value)} outside charset`);
      return value;
    }
    case 'shareValue': {
      if (!isShareValue(value)) fail(path, 'share must be 8..256 hex chars');
      return value;
    }
    case 'commitHex': {
      if (!isCommitText(value)) fail(path, 'commit must be 64 hex chars');
      return value;
    }
    case 'rules': {
      // 规则面只有唯一出处：src/rules.ts 的 validateRules（含未知 key 必抛）
      try {
        return validateRules(value);
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        fail(path, why);
      }
    }
    case 'arr': {
      if (!Array.isArray(value)) fail(path, 'must be an array');
      if (value.length > spec.maxLen) fail(path, `array too long (max ${String(spec.maxLen)})`);
      return value.map((item, i) => check(spec.of, item, `${path}[${String(i)}]`));
    }
    case 'nullable': {
      if (value === null) return null;
      return check(spec.of, value, path);
    }
    case 'anyOf': {
      const errs: string[] = [];
      for (const s of spec.specs) {
        try {
          return check(s, value, path);
        } catch (err) {
          errs.push(err instanceof Error ? err.message : String(err));
        }
      }
      fail(path, `matches none of ${String(spec.specs.length)} alternatives: ${errs[0] ?? ''}`);
    }
    case 'obj': {
      if (!isPlain(value)) fail(path, 'must be an object');
      const input = value;
      const unknown = Object.keys(input).filter((k) => !has(spec.fields, k)).sort();
      if (unknown.length > 0) fail(path, `unknown key "${String(unknown[0])}"`);
      const missing = Object.keys(spec.fields).filter((k) => !has(input, k)).sort();
      if (missing.length > 0) fail(path, `missing key "${String(missing[0])}"`);
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(spec.fields)) {
        const sub = spec.fields[key];
        if (sub === undefined) fail(path, `internal schema gap at "${key}"`);
        out[key] = check(sub, input[key], path === '' ? key : `${path}.${key}`);
      }
      return out;
    }
    default: {
      const exhausted: never = spec;
      return exhausted;
    }
  }
}

function has(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// —— 结构体 ——
const CARD_SPEC: Spec = {
  kind: 'obj',
  fields: {
    rank: { kind: 'int', min: 2, max: 14 },
    suit: { kind: 'int', min: 0, max: 3 },
  },
};

const CARDS_SPEC: Spec = {
  kind: 'anyOf',
  specs: [{ kind: 'litStr', value: 'unknown' }, { kind: 'arr', of: CARD_SPEC, maxLen: 3 }],
};

const EVENT_SPEC: Spec = {
  kind: 'obj',
  fields: {
    seq: { kind: 'int', min: 1, max: INT_MAX },
    type: {
      kind: 'oneOf',
      values: ['deal', 'look', 'call', 'raise', 'fold', 'compare', 'eliminate', 'terminal', 'settle'],
    },
    seat: { kind: 'int', min: -1, max: 63 },
    target: { kind: 'int', min: -1, max: 63 },
    amount: { kind: 'int', min: 0, max: INT_MAX },
    stake: { kind: 'int', min: 0, max: 4096 },
    note: { kind: 'str', minLen: 0, maxLen: 200 },
  },
};

const SEAT_SPEC: Spec = {
  kind: 'obj',
  fields: {
    seat: { kind: 'int', min: 0, max: 63 },
    chips: { kind: 'int', min: 0, max: INT_MAX },
    active: { kind: 'bool' },
    out: { kind: 'nullable', of: { kind: 'oneOf', values: ['folded', 'eliminated'] } },
    looked: { kind: 'bool' },
    actionsTotal: { kind: 'int', min: 0, max: 4096 },
    actionsAtStake: { kind: 'int', min: 0, max: 4096 },
    committed: { kind: 'int', min: 0, max: INT_MAX },
    revealed: { kind: 'bool' },
    cards: CARDS_SPEC,
  },
};

const TERMINAL_SPEC: Spec = {
  kind: 'obj',
  fields: {
    reason: { kind: 'oneOf', values: ['oneLeft', 'stakeCap', 'stall'] },
    winners: { kind: 'arr', of: { kind: 'int', min: 0, max: 63 }, maxLen: 64 },
    shares: { kind: 'arr', of: { kind: 'int', min: 0, max: INT_MAX }, maxLen: 64 },
    remainderTo: { kind: 'int', min: -1, max: 63 },
  },
};

const VIEW_SPEC: Spec = {
  kind: 'obj',
  fields: {
    viewer: { kind: 'int', min: 0, max: 63 },
    rules: { kind: 'rules' },
    phase: { kind: 'oneOf', values: ['betting', 'awaitingSettle', 'settled'] },
    pot: { kind: 'int', min: 0, max: INT_MAX },
    stake: { kind: 'int', min: 0, max: 4096 },
    turn: { kind: 'int', min: -1, max: 63 },
    dealer: { kind: 'int', min: 0, max: 63 },
    seq: { kind: 'int', min: 1, max: INT_MAX },
    settledSeq: { kind: 'nullable', of: { kind: 'int', min: 1, max: INT_MAX } },
    terminal: { kind: 'nullable', of: TERMINAL_SPEC },
    log: { kind: 'arr', of: EVENT_SPEC, maxLen: 4000 },
    seats: { kind: 'arr', of: SEAT_SPEC, maxLen: 64 },
    deal: {
      kind: 'nullable',
      of: { kind: 'obj', fields: { seed: { kind: 'int', min: 0, max: 4294967295 } } },
    },
  },
};

const MOVE_SPEC: Spec = {
  kind: 'anyOf',
  specs: [
    { kind: 'obj', fields: { kind: { kind: 'litStr', value: 'look' } } },
    { kind: 'obj', fields: { kind: { kind: 'litStr', value: 'fold' } } },
    { kind: 'obj', fields: { kind: { kind: 'litStr', value: 'call' } } },
    { kind: 'obj', fields: { kind: { kind: 'litStr', value: 'raise' } } },
    {
      kind: 'obj',
      fields: {
        kind: { kind: 'litStr', value: 'compare' },
        target: { kind: 'int', min: 0, max: 63 },
      },
    },
  ],
};

const SHARE_SPEC: Spec = {
  kind: 'obj',
  fields: { party: { kind: 'party' }, value: { kind: 'shareValue' } },
};

const ROSTER_SPEC: Spec = {
  kind: 'obj',
  fields: { seat: { kind: 'int', min: 0, max: 63 }, name: { kind: 'str', minLen: 1, maxLen: 24 } },
};

const TOKEN_SPEC: Spec = { kind: 'str', minLen: 16, maxLen: 128, ascii: true };

const UP_SPEC: Record<string, Spec> = {
  join: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'join' },
      name: { kind: 'str', minLen: 1, maxLen: 24 },
      buyIn: { kind: 'int', min: 1, max: INT_MAX },
    },
  },
  nonce: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'nonce' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      value: { kind: 'shareValue' },
    },
  },
  action: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'action' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      move: MOVE_SPEC,
    },
  },
  resume: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'resume' },
      token: TOKEN_SPEC,
      hand: { kind: 'int', min: 1, max: INT_MAX },
      since: { kind: 'int', min: 0, max: INT_MAX },
    },
  },
  ping: {
    kind: 'obj',
    fields: { t: { kind: 'litStr', value: 'ping' }, echo: { kind: 'int', min: 0, max: INT_MAX } },
  },
};

const DOWN_SPEC: Record<string, Spec> = {
  hello: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'hello' },
      protocol: { kind: 'str', minLen: 1, maxLen: 32, ascii: true },
      token: TOKEN_SPEC,
      seat: { kind: 'int', min: 0, max: 63 },
      name: { kind: 'str', minLen: 1, maxLen: 24 },
      rules: { kind: 'rules' },
      seats: { kind: 'arr', of: ROSTER_SPEC, maxLen: 64 },
    },
  },
  commit: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'commit' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      party: { kind: 'party' },
      commit: { kind: 'commitHex' },
    },
  },
  collect: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'collect' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      committed: { kind: 'arr', of: { kind: 'party' }, maxLen: 64 },
      missing: { kind: 'arr', of: { kind: 'party' }, maxLen: 64 },
    },
  },
  view: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'view' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      seq: { kind: 'int', min: 1, max: INT_MAX },
      view: VIEW_SPEC,
    },
  },
  patch: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'patch' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      since: { kind: 'int', min: 0, max: INT_MAX },
      seq: { kind: 'int', min: 1, max: INT_MAX },
      view: VIEW_SPEC,
    },
  },
  reveal: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'reveal' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      seed: { kind: 'int', min: 0, max: 4294967295 },
      shares: { kind: 'arr', of: SHARE_SPEC, maxLen: 64 },
    },
  },
  reject: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'reject' },
      hand: { kind: 'int', min: 1, max: INT_MAX },
      code: { kind: 'oneOf', values: REJECT_CODES },
      why: { kind: 'str', minLen: 1, maxLen: 400 },
    },
  },
  notice: {
    kind: 'obj',
    fields: { t: { kind: 'litStr', value: 'notice' }, text: { kind: 'str', minLen: 1, maxLen: 600 } },
  },
  error: {
    kind: 'obj',
    fields: {
      t: { kind: 'litStr', value: 'error' },
      code: { kind: 'str', minLen: 1, maxLen: 40, ascii: true },
      why: { kind: 'str', minLen: 1, maxLen: 400 },
    },
  },
  pong: {
    kind: 'obj',
    fields: { t: { kind: 'litStr', value: 'pong' }, echo: { kind: 'int', min: 0, max: INT_MAX } },
  },
};

// 收线上文本、也收进程内已构造的对象：两条路走同一个校验器，
// 这样"服务端出口先自检"不需要先把消息序列化成字符串再解回来。
function parse(raw: unknown): unknown {
  if (typeof raw === 'string') {
    if (raw.length > MAX_MESSAGE_BYTES) fail('<root>', 'message too large');
    try {
      return JSON.parse(raw);
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      fail('<root>', `not valid JSON: ${why}`);
    }
  }
  if (!isPlain(raw)) {
    // 与 isPlain 共用同一个判据：否则 Uint8Array 这类"是 object 但不是普通对象"的入参会从这里漏过去，
    // 到 checkSide 才被拦，报错变成"消息必须是对象"——而它本该在入口就被说清是"既不是文本也不是普通对象"。
    fail('<root>', 'message must be JSON text or a plain object');
  }
  return raw;
}

function checkSide(specs: Record<string, Spec>, raw: unknown, side: string): unknown {
  if (!isPlain(raw)) fail('<root>', `${side}bound message must be an object`);
  const t = raw['t'];
  if (typeof t !== 'string') fail('t', 'message tag missing');
  const spec = specs[t];
  if (spec === undefined) fail('t', `unknown ${side}bound message tag "${t}"`);
  return check(spec, raw, '');
}

// 收：字符串 → 已校验的消息（未知 key 一律抛错）
export function checkUp(raw: unknown): Up {
  return checkSide(UP_SPEC, parse(raw), 'up') as Up;
}

export function checkDown(raw: unknown): Down {
  return checkSide(DOWN_SPEC, parse(raw), 'down') as Down;
}

// 发：先按同一套 schema 校验再序列化。服务端不能只约束客户端、自己随便发 ——
// 编码前重跑校验器就是为了让"服务端越界"在本地当场炸，而不是等到对面发现。
export function encodeUp(msg: Up): string {
  return JSON.stringify(checkUp(msg));
}

export function encodeDown(msg: Down): string {
  return JSON.stringify(checkDown(msg));
}

// 引擎的 Action 由 move + 连接绑定的座位合成；除此之外没有任何路径能指定座位。
export function toAction(move: Move, seat: number): Action {
  if (move.kind === 'compare') return { kind: 'compare', seat, target: move.target };
  return { kind: move.kind, seat };
}

// —— 客户端侧的防泄漏自检（服务端 project() 是第一道墙，这里是第二道）——
// 返回 null = 这一份投影对"我"是干净的；返回字符串 = 服务端越界了，客户端应当拒收并停手。
export function checkViewLeak(view: View, viewer: number): string | null {
  if (view.viewer !== viewer) return `view is projected for seat ${String(view.viewer)}, not ${String(viewer)}`;
  for (const s of view.seats) {
    if (s.cards === 'unknown') continue;
    if (s.revealed) continue;
    if (s.seat === viewer) {
      if (!s.looked) return `own cards exposed before look (seat ${String(s.seat)})`;
      continue;
    }
    return `cards of seat ${String(s.seat)} exposed while revealed=false`;
  }
  if (view.phase !== 'settled' && view.deal !== null) {
    return `seed exposed in phase ${view.phase} (only settled may expose it)`;
  }
  for (const e of view.log) {
    if (/\b(?:rank|suit|seed|cards|hand)\s*[=:]/.test(e.note)) return `event note looks like card data: ${e.note}`;
  }
  return null;
}

export type { Event, Share, View };
