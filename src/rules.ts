// Rules v1 schema —— 工单 §2.7 的接口契约实现。
// 本模块零运行时依赖：不 import 任何包，不读文件（preset 是 TS 常量，工单 B4 已钉死"零文件 IO"）。

export type TierId =
  | 'trips'
  | 'straightFlush'
  | 'flush'
  | 'straight'
  | 'pair'
  | 'highCard';

// §1 庄家行（M2 三档）：轮庄 / 赢家坐庄 / 输家坐庄。配置落 Rules.dealer.next。
export type DealerNextId = 'rotate' | 'winner' | 'loser';

export type Rules = {
  version: 1;
  players: { min: number; max: number };
  ante: number;
  stake: { initial: number; max: number };
  bet: { dark: number; seen: number };
  compare: { fee: number; firstCycleForbidden: boolean; tie: 'challengerLoses' };
  termination: { maxStakeActions: number; stallActions: number };
  showdown: { tie: 'split'; remainder: 'nearestAfterDealer' };
  allIn: 'forbidden';
  handEval: { a23: boolean; tierOrder: TierId[] };
  dealer: { next: DealerNextId };
};

// 牌型档位的唯一合法集合。§1 的"牌型序"只是它的一种排列，故不作为常量导出顺序。
export const TIER_IDS: readonly TierId[] = [
  'trips',
  'straightFlush',
  'flush',
  'straight',
  'pair',
  'highCard',
];

// 庄位流转的唯一合法集合（§1 庄家行三档）。
export const DEALER_NEXT_IDS: readonly DealerNextId[] = ['rotate', 'winner', 'loser'];

type Spec =
  | { kind: 'litNum'; value: number }
  | { kind: 'litStr'; value: string }
  | { kind: 'oneOf'; values: readonly string[] }
  | { kind: 'bool' }
  | { kind: 'posInt'; min: number }
  | { kind: 'tierOrder' }
  | { kind: 'obj'; fields: Record<string, Spec> };

function fail(path: string, msg: string): never {
  throw new TypeError(`invalid rules at "${path || '<root>'}": ${msg}`);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function check(spec: Spec, value: unknown, path: string): unknown {
  switch (spec.kind) {
    case 'litNum': {
      if (value !== spec.value) fail(path, `must be literal ${String(spec.value)}`);
      return value;
    }
    case 'litStr': {
      if (value !== spec.value) fail(path, `must be literal "${spec.value}"`);
      return value;
    }
    case 'oneOf': {
      if (typeof value !== 'string' || !(spec.values as readonly string[]).includes(value)) {
        fail(path, `must be one of ${spec.values.map((v) => `"${v}"`).join(' | ')}`);
      }
      return value;
    }
    case 'bool': {
      if (typeof value !== 'boolean') fail(path, 'must be a boolean');
      return value;
    }
    case 'posInt': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        fail(path, 'must be an integer');
      }
      if (value < spec.min) fail(path, `must be >= ${String(spec.min)}`);
      return value;
    }
    case 'tierOrder': {
      if (!Array.isArray(value)) fail(path, 'must be an array of tier ids');
      if (value.length !== TIER_IDS.length) {
        fail(path, `must list all ${String(TIER_IDS.length)} tiers exactly once`);
      }
      const seen = new Set<unknown>();
      for (const [i, item] of value.entries()) {
        if (typeof item !== 'string' || !(TIER_IDS as readonly string[]).includes(item)) {
          fail(`${path}[${String(i)}]`, `unknown tier id: ${String(item)}`);
        }
        if (seen.has(item)) fail(`${path}[${String(i)}]`, `duplicate tier id: ${item}`);
        seen.add(item);
      }
      return (value as TierId[]).slice();
    }
    case 'obj': {
      if (!isPlainObject(value)) fail(path, 'must be an object');
      const input = value;
      const unknownKeys = Object.keys(input)
        .filter((k) => !Object.prototype.hasOwnProperty.call(spec.fields, k))
        .sort();
      if (unknownKeys.length > 0) {
        fail(path, `unknown key "${String(unknownKeys[0])}"`);
      }
      const missing = Object.keys(spec.fields)
        .filter((k) => !Object.prototype.hasOwnProperty.call(input, k))
        .sort();
      if (missing.length > 0) {
        fail(path, `missing key "${String(missing[0])}"`);
      }
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

function crossField(r: Rules, path: string): void {
  if (r.players.min > r.players.max) {
    fail(`${path}.players`, `min (${String(r.players.min)}) must be <= max (${String(r.players.max)})`);
  }
  if (r.stake.initial > r.stake.max) {
    fail(`${path}.stake`, `initial (${String(r.stake.initial)}) must be <= max (${String(r.stake.max)})`);
  }
}

const SCHEMA: Spec = {
  kind: 'obj',
  fields: {
    version: { kind: 'litNum', value: 1 },
    players: {
      kind: 'obj',
      fields: { min: { kind: 'posInt', min: 1 }, max: { kind: 'posInt', min: 1 } },
    },
    ante: { kind: 'posInt', min: 1 },
    stake: {
      kind: 'obj',
      fields: { initial: { kind: 'posInt', min: 1 }, max: { kind: 'posInt', min: 1 } },
    },
    bet: {
      kind: 'obj',
      fields: { dark: { kind: 'posInt', min: 1 }, seen: { kind: 'posInt', min: 1 } },
    },
    compare: {
      kind: 'obj',
      fields: {
        fee: { kind: 'posInt', min: 1 },
        firstCycleForbidden: { kind: 'bool' },
        tie: { kind: 'litStr', value: 'challengerLoses' },
      },
    },
    termination: {
      kind: 'obj',
      fields: {
        maxStakeActions: { kind: 'posInt', min: 1 },
        stallActions: { kind: 'posInt', min: 1 },
      },
    },
    showdown: {
      kind: 'obj',
      fields: {
        tie: { kind: 'litStr', value: 'split' },
        remainder: { kind: 'litStr', value: 'nearestAfterDealer' },
      },
    },
    allIn: { kind: 'litStr', value: 'forbidden' },
    handEval: {
      kind: 'obj',
      fields: { a23: { kind: 'bool' }, tierOrder: { kind: 'tierOrder' } },
    },
    dealer: {
      kind: 'obj',
      fields: { next: { kind: 'oneOf', values: DEALER_NEXT_IDS } },
    },
  },
};

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const key of Object.keys(v)) {
      deepFreeze((v as Record<string, unknown>)[key]);
    }
  }
  return v;
}

// 工单 §2.7：未知 key 一律抛错（含 special235 / suitTiebreak，值为 false 也抛）。
export function validateRules(input: unknown): Rules {
  const checked = check(SCHEMA, input, '');
  if (!isPlainObject(checked)) fail('', 'must be an object');
  const out = checked as unknown as Rules;
  crossField(out, '');
  return deepFreeze(out);
}

// 两个 preset 都按字面量写出（不做"只差一个开关"的工厂函数），避免规则分歧进代码分支。
const classic: Rules = {
  version: 1,
  players: { min: 2, max: 6 },
  ante: 1,
  stake: { initial: 1, max: 16 },
  bet: { dark: 1, seen: 2 },
  compare: { fee: 2, firstCycleForbidden: true, tie: 'challengerLoses' },
  termination: { maxStakeActions: 1, stallActions: 3 },
  showdown: { tie: 'split', remainder: 'nearestAfterDealer' },
  allIn: 'forbidden',
  handEval: {
    a23: true,
    tierOrder: ['trips', 'straightFlush', 'flush', 'straight', 'pair', 'highCard'],
  },
  dealer: { next: 'rotate' },
};

const a23off: Rules = {
  version: 1,
  players: { min: 2, max: 6 },
  ante: 1,
  stake: { initial: 1, max: 16 },
  bet: { dark: 1, seen: 2 },
  compare: { fee: 2, firstCycleForbidden: true, tie: 'challengerLoses' },
  termination: { maxStakeActions: 1, stallActions: 3 },
  showdown: { tie: 'split', remainder: 'nearestAfterDealer' },
  allIn: 'forbidden',
  handEval: {
    a23: false,
    tierOrder: ['trips', 'straightFlush', 'flush', 'straight', 'pair', 'highCard'],
  },
  dealer: { next: 'rotate' },
};

export const presets = deepFreeze({
  classic: validateRules(classic),
  a23off: validateRules(a23off),
});
