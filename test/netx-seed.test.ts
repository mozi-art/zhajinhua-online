// M4 · commit-reveal 种子合成（netx/seed.ts）。
// 工单 §4 M4 的原话是"单方选 seed 可磨种子，不合格"，所以这里的断言全部围绕两件事：
//   A. 每一家都真的说得上话（改任何一家的份额 ⇒ 种子必变）；
//   B. 谁都不能在看到别人选择之后再挑自己的值（承诺先于份额、承诺打不开就是假的）。
import assert from 'node:assert/strict';
import {
  commitOf,
  partyOfSeat,
  revealMatches,
  seedFromShares,
  seedVector,
  SERVER_PARTY,
  verifyCommit,
} from '../netx/seed.ts';
import type { Share } from '../netx/seed.ts';
import { sha256Hex } from '../netx/sha256.ts';
import { note, test } from './harness.ts';

const SHARES: Share[] = [
  { party: SERVER_PARTY, value: '11111111222222223333333344444444' },
  { party: 'seat:0', value: 'aaaaaaaa' },
  { party: 'seat:1', value: 'bbbbbbbb' },
  { party: 'seat:2', value: 'cccccccc' },
];

function withChanged(list: Share[], idx: number, value: string): Share[] {
  return list.map((s, i) => (i === idx ? { party: s.party, value } : s));
}

const V0 = (SHARES[0] as Share).value;

test('seed/01 承诺把 hand / party / 份额三者绑在一起', () => {
  const base = commitOf(1, SERVER_PARTY, V0);
  assert.match(base, /^[\da-f]{64}$/);
  assert.notEqual(base, V0, '承诺不能就是份额本身');
  assert.ok(!base.includes(V0.slice(0, 8)), '承诺里不能浮出份额的前缀');
  assert.equal(verifyCommit(1, SERVER_PARTY, V0, base), true);
  assert.equal(verifyCommit(2, SERVER_PARTY, V0, base), false, '换局号必须打不开');
  assert.equal(verifyCommit(1, 'seat:0', V0, base), false, '换提交方必须打不开');
  assert.equal(verifyCommit(1, SERVER_PARTY, 'deadbeef', base), false, '换份额必须打不开');
  assert.equal(verifyCommit(1, SERVER_PARTY, V0, 'f'.repeat(64)), false, '非承诺值一律算不匹配');
});

test('seed/02 合成与提交顺序无关（任何一端都能独立复算）', () => {
  const a = seedFromShares(7, SHARES);
  const b = seedFromShares(7, [...SHARES].reverse());
  const c = seedFromShares(7, [SHARES[3], SHARES[0], SHARES[2], SHARES[1]].filter((x): x is Share => x !== undefined));
  assert.equal(a, b);
  assert.equal(a, c);
});

test('seed/03 改任何一家的份额，种子必变（没有旁观者）', () => {
  const base = seedFromShares(3, SHARES);
  const seen = new Set<number>([base]);
  for (let i = 0; i < SHARES.length; i += 1) {
    const alt = seedFromShares(3, withChanged(SHARES, i, 'ee00' + String(i).repeat(2) + '13579bdf02468ace'));
    assert.notEqual(alt, base, `第 ${String(i)} 家换份额却没影响种子`);
    seen.add(alt);
  }
  assert.equal(seen.size, SHARES.length + 1, '每一家换的值还要互不相同');
});

test('seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选', () => {
  // 每一家各自扫 32 个值 ⇒ 种子必须 32 个都不同。
  // 若某家能"挑"出预设的种子，就说明它对合成有支配路径（磨种子）。
  for (let i = 0; i < SHARES.length; i += 1) {
    const out = new Set<number>();
    for (let n = 0; n < 32; n += 1) {
      const value = n.toString(16).padStart(8, '0').repeat(4);
      out.add(seedFromShares(11, withChanged(SHARES, i, value)));
    }
    assert.equal(out.size, 32, `party ${String(i)} 的 32 个候选撞出了同一个种子`);
  }
});

test('seed/05 局号参与合成：同一批份额在不同局给出不同种子', () => {
  const a = seedFromShares(1, SHARES);
  const b = seedFromShares(2, SHARES);
  assert.notEqual(a, b);
});

test('seed/06 合成结果是引擎接受的 uint32 整数', () => {
  for (let h = 1; h <= 200; h += 1) {
    const seed = seedFromShares(h, SHARES);
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, `hand ${String(h)} 的种子越界`);
  }
});

test('seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符）', () => {
  assert.throws(() => seedFromShares(1, []), TypeError);
  assert.throws(() => seedFromShares(1, [{ party: SERVER_PARTY, value: 'short' }]), /8\.\.256 hex/);
  assert.throws(() => seedFromShares(1, [{ party: SERVER_PARTY, value: 'deadbeefz' }]), /8\.\.256 hex/);
  assert.throws(() => seedFromShares(1, [{ party: 'bad party', value: 'deadbeef' }]), /charset/);
  assert.throws(() => seedFromShares(1, [{ party: 'a=b', value: 'deadbeef' }]), /charset/, '分隔符不许出现在 party 里');
  assert.throws(() => seedFromShares(1, [{ party: 'a|b', value: 'deadbeef' }]), /charset/);
  assert.throws(
    () => seedFromShares(1, [{ party: SERVER_PARTY, value: 'deadbeef' }, { party: SERVER_PARTY, value: 'cafebabe' }]),
    /more than one share/,
  );
  assert.throws(() => seedFromShares(0, SHARES), /hand/);
  assert.throws(() => commitOf(1, SERVER_PARTY, 'zz'), /8\.\.256 hex/);
});

test('seed/08 揭示核对：一一对上才算通过', () => {
  const commits = SHARES.map((s) => ({ party: s.party, commit: commitOf(5, s.party, s.value) }));
  assert.equal(revealMatches(5, commits, SHARES), null);
  assert.match(revealMatches(5, commits, SHARES.slice(1)) ?? '', /never revealed/);
  assert.match(revealMatches(5, commits, withChanged(SHARES, 0, 'ffffffff')) ?? '', /does not open its commitment/);
  assert.match(revealMatches(5, commits, [...SHARES, { party: 'seat:9', value: '12345678' }]) ?? '', /never committed/);
  assert.match(revealMatches(5, commits, [...SHARES, SHARES[0]].filter((x): x is Share => x !== undefined)) ?? '', /revealed twice/);
  assert.match(revealMatches(6, commits, SHARES) ?? '', /does not open its commitment/, '换局号后承诺不该再打得开');
  assert.match(revealMatches(5, [], SHARES) ?? '', /no commitments/);
});

test('seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造）', () => {
  const a = commitOf(1, 'seat:0', 'aaaaaaaa');
  const b = commitOf(1, 'seat:0', 'aaaaaaab');
  assert.notEqual(a, b);
  // 摘要入口本身也走 SHA-256（与 netx/02 的实现同源）
  assert.equal(commitOf(1, SERVER_PARTY, 'deadbeef'), sha256Hex(`zjh-m4-1|hand=1|party=${SERVER_PARTY}|value=deadbeef`));
});

test('seed/10 座位方命名在 party charset 内，且与"server"不撞', () => {
  assert.equal(partyOfSeat(0), 'seat:0');
  assert.notEqual(partyOfSeat(0), SERVER_PARTY);
  assert.throws(() => partyOfSeat(-1), TypeError);
  assert.throws(() => partyOfSeat(1.5), TypeError);
  for (const seat of [0, 1, 9, 10, 63]) {
    const party = partyOfSeat(seat);
    assert.equal(seedFromShares(1, [{ party, value: 'deadbeef' }]), seedFromShares(1, [{ party, value: 'deadbeef' }]));
  }
});

test('seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到）', () => {
  const seeds: number[] = [];
  for (let i = 0; i < 4096; i += 1) {
    seeds.push(seedFromShares(1, withChanged(SHARES, 0, i.toString(16).padStart(8, '0').repeat(4))));
  }
  assert.equal(new Set(seeds).size, 4096, '4096 个不同份额必须给出 4096 个不同种子');
  assert.ok(Math.max(...seeds) > 0xffff, '种子必须真的用到高 16 位（截断成 16 位时这条必炸）');
  note(`seed/12 4096 组份额合成 ${String(new Set(seeds).size)} 个互不相同的种子，最大值 ${String(Math.max(...seeds))}`);
});

test('seed/13 定序只用码点键：seedVector 与 canonicalShares 是同一把尺（rev=8 必修 4）', () => {
  // 故意把大小写与数字混进 party 名：'A'/'a'/'Seat:10'/'server' 在 localeCompare 与码点两套键下顺序相反。
  const MIXED: Share[] = [
    { party: SERVER_PARTY, value: '11111111' },
    { party: 'Seat:10', value: '22222222' },
    { party: 'seat:2', value: '33333333' },
    { party: 'A', value: '44444444' },
    { party: 'a', value: '55555555' },
  ];
  // 硬写的期望顺序（UTF-16 码点：A=65 < S=83 < a=97 < s=115；'seat:' < 'server' 因为 'a' < 'r'）
  const CODEPOINT = ['A', 'Seat:10', 'a', 'seat:2', 'server'];
  const LOCALE = [...CODEPOINT].sort((x, y) => x.localeCompare(y));
  assert.notDeepEqual(LOCALE, CODEPOINT, '前提：这组名字上两套键确实分叉，否则本用例是空转');

  const byCode = (list: Share[]): string[] => list.map((s) => commitOf(3, s.party, s.value));
  const v = seedVector(3, MIXED);
  assert.deepEqual(
    v.commit,
    byCode(CODEPOINT.map((party) => (MIXED.find((s) => s.party === party) as Share))),
    '向量里 commit 的顺序必须正好是码点序',
  );
  assert.deepEqual(
    seedVector(3, [...MIXED].reverse()).commit,
    v.commit,
    '乱序输入 ⇒ 同一份向量（定序与提交顺序无关）',
  );
  assert.equal(v.seed, seedFromShares(3, MIXED), '向量里的 seed 就是权威路径算出来的那颗');
  // 权威路径（canonicalShares → 种子）与向量路径同键 ⇒ 顺序换了种子也不能换
  assert.equal(
    seedFromShares(3, MIXED),
    seedFromShares(3, [...MIXED].sort((x, y) => x.party.localeCompare(y.party))),
    '两套键下种子恒等（定序只影响向量数组的排列，不影响权威路径）',
  );
  // 把 canonicalShares 的定序也钉在码点序上：照"码点序"手工拼一遍 canonical 文本，摘要前 32 位就是应有的种子。
  // 这条断言防的是"权威路径偷偷换成 locale 键"——那样换一台 ICU 就换一颗牌，且 seedVector 的向量照样自洽、抓不到。
  const canonical = `zjh-m4-1|seed|hand=3|${CODEPOINT.map((party) => {
    const s = MIXED.find((x) => x.party === party) as Share;
    return `${party}=${s.value}`;
  }).join('|')}`;
  assert.equal(
    seedFromShares(3, MIXED),
    parseInt(sha256Hex(canonical).slice(0, 8), 16) >>> 0,
    'canonicalShares 必须用同一把码点键：定序文本与手拼的不一致就说明它换了尺',
  );
  note(`seed/13 码点序=${CODEPOINT.join(',')} / locale 序=${LOCALE.join(',')} ⇒ 向量取前者，权威路径同键（seed=${String(v.seed)}）`);
});

test('seed/14 互为前缀的 party 名（seat:1 与 seat:10）：定序排的是 party，不是拼接串', () => {
  // 这是必修 4 的同一家族：'seat:1=..' 与 'seat:10=..' 按"整串"比时 '='(61) > '0'(48) ⇒ 'seat:10' 反而在前，
  // 而按 party 比时 'seat:1'（更短的前缀）在前。两条路径必须给同一个顺序，否则 seedVector 公布的向量与权威种子用的不是同一把尺。
  const S: Share[] = [
    { party: SERVER_PARTY, value: '11111111' },
    { party: 'seat:1', value: '22222222' },
    { party: 'seat:10', value: '33333333' },
    { party: 'seat:2', value: '44444444' },
  ];
  const BY_PARTY = ['seat:1', 'seat:10', 'seat:2', 'server'];
  const BY_JOINED = ['seat:10', 'seat:1', 'seat:2', 'server']; // 排拼接串会得到的顺序（对照用）
  assert.notDeepEqual(BY_PARTY, BY_JOINED, '前提：这组名字上两种排法确实分叉');
  const valueOf = (party: string): string => (S.find((x) => x.party === party) as Share).value;
  const canonicalByParty = `zjh-m4-1|seed|hand=9|${BY_PARTY.map((p) => `${p}=${valueOf(p)}`).join('|')}`;
  const canonicalByJoined = `zjh-m4-1|seed|hand=9|${BY_JOINED.map((p) => `${p}=${valueOf(p)}`).join('|')}`;
  const expectSeed = (text: string): number => parseInt(sha256Hex(text).slice(0, 8), 16) >>> 0;
  assert.notEqual(expectSeed(canonicalByParty), expectSeed(canonicalByJoined), '两种排法给出两颗种子 ⇒ 必须有一条断言站在中间把它们分开');
  assert.equal(seedFromShares(9, S), expectSeed(canonicalByParty), '权威路径按 party 定序');
  assert.deepEqual(
    seedVector(9, S).commit,
    BY_PARTY.map((p) => commitOf(9, p, valueOf(p))),
    '向量路径与权威路径同序',
  );
  note(`seed/14 前缀相撞的 party 名：权威 = 向量 = ${BY_PARTY.join(',')}（seed=${String(seedFromShares(9, S))}）`);
});

test('seed/11 固定向量：复审可照抄复算', () => {
  const v = seedVector(1, SHARES);
  // 承诺数组按 party 字典序（这里用 Array.prototype.sort 作参照，不假设实现内部写法）
  const order = SHARES.map((s) => s.party).sort();
  assert.deepEqual(
    v.commit,
    order.map((party) => commitOf(1, party, (SHARES.find((s) => s.party === party) as Share).value)),
  );
  assert.equal(v.seed, seedFromShares(1, SHARES));
  note(`seed/11 固定向量 hand=1 shares=[${order.map((p, i) => `${p}:${v.commit[i]?.slice(0, 8)}…`).join(', ')}]`);
  note(`seed/11 合成 seed=${String(v.seed)}（份额明文见 netx-seed.test.ts 顶部 SHARES）`);
});
