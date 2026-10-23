// M4 · 多方 commit-reveal 种子合成（工单 §4 M4："commit-reveal 必须多方合成 seed，单方选 seed 可磨种子，不合格"）。
//
// 一轮一手的流程（本文件只管"怎么算"，什么时候算由 netx/room.ts 驱动）：
//   1) 服务端先公布 serverShare 的承诺 commit = SHA-256(tag|hand|party|value)；此刻谁也看不到任何份额。
//   2) 各家（每个在座玩家一方）提交 nonce = 自己的份额明文。提交时手里只有别人的**承诺**，
//      承诺不可逆，所以没有任何人能照着别人的份额挑对自己有利的值。
//   3) 全部份额按 party 定序拼接后取 SHA-256，前 32 bit 就是这一局的 seed（引擎用它洗牌）。
//   4) 局末（引擎 project() 在 settled 阶段才放行 seed）揭示全部份额，各家复算：
//      承诺对得上、合成 seed 对得上 —— 谁作弊都当场露。
//
// 承诺文本把 hand 与 party 绑进去，因此第 N 局的份额不能拿来冒充第 M 局的揭示。
// 本文件零 IO、零时钟、零随机：份额由调用方注入（真实随机在 netx/ws.ts 用 node:crypto 提供，
// 测试里注入确定性串以便复算）。

import { sha256Hex } from './sha256.ts';

export const COMMIT_TAG = 'zjh-m4-1';

export const SERVER_PARTY = 'server';

export type Share = { party: string; value: string };
export type Commitment = { party: string; commit: string };

const PARTY_RE = /^[A-Za-z0-9_:.-]{1,32}$/;
const VALUE_RE = /^[\da-f]{8,256}$/;
const COMMIT_RE = /^[\da-f]{64}$/;

export function partyOfSeat(seat: number): string {
  if (!Number.isInteger(seat) || seat < 0) throw new TypeError(`bad seat ${String(seat)}`);
  return `seat:${String(seat)}`;
}

export function isParty(v: unknown): v is string {
  return typeof v === 'string' && PARTY_RE.test(v);
}

// 份额至少 32 bit 的十六进制；charset 里不含 '=' 与 '|'，所以拼接文本是单射的。
export function isShareValue(v: unknown): v is string {
  return typeof v === 'string' && VALUE_RE.test(v);
}

export function isCommitText(v: unknown): v is string {
  return typeof v === 'string' && COMMIT_RE.test(v);
}

function bad(msg: string): never {
  throw new TypeError(`bad commit-reveal input: ${msg}`);
}

function checkHand(hand: number): void {
  if (!Number.isInteger(hand) || hand < 1) bad(`hand must be an integer >= 1, got ${String(hand)}`);
}

export function commitText(hand: number, party: string, value: string): string {
  checkHand(hand);
  if (!isParty(party)) bad(`party ${String(party)} outside charset`);
  if (!isShareValue(value)) bad(`share value for ${party} must be 8..256 hex chars`);
  return `${COMMIT_TAG}|hand=${String(hand)}|party=${party}|value=${value}`;
}

export function commitOf(hand: number, party: string, value: string): string {
  return sha256Hex(commitText(hand, party, value));
}

export function verifyCommit(hand: number, party: string, value: string, commit: string): boolean {
  if (!isCommitText(commit)) return false;
  return commitOf(hand, party, value) === commit;
}

// 唯一的字符串排序键：按 UTF-16 码点，不用 localeCompare。
// localeCompare 的结果随运行环境的 locale/ICU 变（'Z' 与 'a' 在两套键下顺序相反），
// 而定序既进种子、又进"公布给复审照抄复算"的固定向量 ⇒ 必须与机器无关。
export function byCodepoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonicalShares(hand: number, shares: readonly Share[]): string {
  checkHand(hand);
  if (shares.length < 1) bad('at least one share is required');
  const seen = new Set<string>();
  const list: Share[] = [];
  for (const s of shares) {
    if (!isParty(s.party)) bad(`party ${String(s.party)} outside charset`);
    if (!isShareValue(s.value)) bad(`share value for ${s.party} must be 8..256 hex chars`);
    if (seen.has(s.party)) bad(`party ${s.party} contributed more than one share`);
    seen.add(s.party);
    list.push(s);
  }
  // 定序 = 按 party 码点序：与提交顺序无关，任何一端都能独立复算出同一个 seed。
  // 排的是 party 本身，不是 "party=value" 拼接串 —— 后者在名字互为前缀时会分叉
  // （'seat:1=..' 与 'seat:10=..' 里 '='(61) > '0'(48)），那样 seedVector 公布的顺序就和权威顺序不同了。
  list.sort((a, b) => byCodepoint(a.party, b.party));
  const parts = list.map((s) => `${s.party}=${s.value}`);
  return `${COMMIT_TAG}|seed|hand=${String(hand)}|${parts.join('|')}`;
}

export function seedFromShares(hand: number, shares: readonly Share[]): number {
  return parseInt(sha256Hex(canonicalShares(hand, shares)).slice(0, 8), 16) >>> 0;
}

// 揭示核对：承诺集合与揭示集合必须**同一批 party**、一一对上，且没有多余份额。
export function revealMatches(hand: number, commits: readonly Commitment[], revealed: readonly Share[]): string | null {
  const byParty = new Map<string, string>();
  for (const r of revealed) {
    if (!isParty(r.party)) return `revealed party ${String(r.party)} outside charset`;
    if (byParty.has(r.party)) return `party ${r.party} revealed twice`;
    byParty.set(r.party, r.value);
  }
  if (commits.length < 1) return 'no commitments to check against';
  for (const c of commits) {
    const value = byParty.get(c.party);
    if (value === undefined) return `party ${c.party} never revealed its share`;
    if (!verifyCommit(hand, c.party, value, c.commit)) {
      return `party ${c.party} revealed a share that does not open its commitment`;
    }
    byParty.delete(c.party);
  }
  const extra = [...byParty.keys()].sort();
  if (extra.length > 0) return `revealed ${extra.join(',')} never committed`;
  return null;
}

// 供测试与复审复算的固定向量（不含任何机器相关量）。
// 排序键与 canonicalShares 共用 byCodepoint ⇒ 向量里 commit 数组的顺序换机器也复现得出。
export function seedVector(hand: number, shares: readonly Share[]): { commit: string[]; seed: number } {
  const sorted = [...shares].sort((a, b) => byCodepoint(a.party, b.party));
  return {
    commit: sorted.map((s) => commitOf(hand, s.party, s.value)),
    seed: seedFromShares(hand, sorted),
  };
}
