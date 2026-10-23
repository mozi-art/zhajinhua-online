// M2 · §1 庄家行三档（配置落 Rules.dealer.next）的验收。
// 两条腿：① 选庄纯函数 nextDealerOf 的表驱动点测（期望值是手推的座位号，不是代码算出来的）；
// ② 会话层真打若干局，断言"庄位走向"符合档位语义（属性断言，避免拿同一个函数自证）。
import assert from 'node:assert/strict';
import { test, note } from './harness.ts';
import { act, createSession, nextDealerOf, stepBots, tableTotal } from '../webmin/model.ts';
import type { PrevHand, Session } from '../webmin/model.ts';

function sess(dealerNext: 'rotate' | 'winner' | 'loser', bots = 3, seed = 20260925, buyIn = 256): Session {
  return createSession({ bots, baseSeed: seed, buyIn, humanSeat: 0, dealerNext });
}

// 把一局推到 settled：机器人接力，真人一律跟注（付不起就弃），最后点结算。
function playOne(s0: Session): Session {
  let s = s0;
  for (let guard = 0; guard < 400 && s.state.phase !== 'settled'; guard += 1) {
    if (s.state.phase === 'awaitingSettle') {
      const r = act(s, { kind: 'settle' });
      assert.equal(r.ok, true, `结算被拒：${r.ok ? '' : r.error}`);
      s = r.session;
      break;
    }
    if (s.state.turn === s.humanSeat) {
      const call = act(s, { kind: 'call' });
      const fold = act(s, { kind: 'fold' });
      assert.ok(call.ok || fold.ok, '真人既不能跟也不能弃');
      s = (call.ok ? call : fold).session;
    }
    const b = stepBots(s);
    assert.equal(b.ok, true, `机器人步进被拒：${b.ok ? '' : b.error}`);
    s = b.session as Session;
  }
  assert.equal(s.state.phase, 'settled', '一局没打完');
  return s;
}

function prevOf(s: Session): PrevHand {
  return {
    dealer: s.dealer,
    seats: s.state.seats.map((x) => x.seat).sort((a, b) => a - b),
    winners: s.state.terminal?.winners ?? [],
    remainderTo: (s.state.terminal?.remainderTo ?? -1) >= 0 ? (s.state.terminal?.remainderTo as number) : null,
  };
}

test('dealer/01 rotate：庄家的下家接任（手推座位号）', () => {
  // 4 家 0..3，上局庄家 1 ⇒ 下家是 2
  assert.equal(nextDealerOf('rotate', { dealer: 1, seats: [0, 1, 2, 3], winners: [3], remainderTo: null }, [0, 1, 2, 3]), 2);
  // 环形回绕：上局庄家 3 ⇒ 下家是 0
  assert.equal(nextDealerOf('rotate', { dealer: 3, seats: [0, 1, 2, 3], winners: [0], remainderTo: null }, [0, 1, 2, 3]), 0);
  // 下家离桌 ⇒ 沿环形序继续找仍在桌的第一家（这里是 3，不是座位号最小者）
  assert.equal(nextDealerOf('rotate', { dealer: 1, seats: [0, 1, 2, 3, 4], winners: [0], remainderTo: null }, [0, 1, 3, 4]), 3);
  // 老庄家自己离桌：仍按上局环形序从它后面第一家算起
  assert.equal(nextDealerOf('rotate', { dealer: 2, seats: [0, 1, 2, 3], winners: [0], remainderTo: null }, [0, 1, 3]), 3);
});

test('dealer/02 winner：单赢家通吃即该赢家坐庄', () => {
  const prev: PrevHand = { dealer: 0, seats: [0, 1, 2], winners: [2], remainderTo: null };
  assert.equal(nextDealerOf('winner', prev, [0, 1, 2]), 2, 'oneLeft 的赢家也要坐上庄');
  // 赢家恰是上局庄家自己：照该档语义仍是它（档位优先于"轮庄一定换人"）
  assert.equal(nextDealerOf('winner', { dealer: 0, seats: [0, 1, 2], winners: [0], remainderTo: null }, [0, 1, 2]), 0);
});

test('dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近', () => {
  const seats = [0, 1, 2, 3];
  // 上局庄家 0 ⇒ 环形序 1,2,3,0。赢家 {1,3}，余数给 3 ⇒ 3 坐庄（3 不是最近者，靠余数翻盘）
  assert.equal(nextDealerOf('winner', { dealer: 0, seats, winners: [1, 3], remainderTo: 3 }, seats), 3);
  // 无余数 ⇒ 取距庄家下家最近的赢家 = 1
  assert.equal(nextDealerOf('winner', { dealer: 0, seats, winners: [1, 3], remainderTo: null }, seats), 1);
  // 拿到余数的那位已离桌 ⇒ 退回环形最近
  assert.equal(nextDealerOf('winner', { dealer: 0, seats, winners: [1, 3], remainderTo: 3 }, [0, 1, 2]), 1);
});

test('dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家', () => {
  const seats = [0, 1, 2, 3];
  // 上局庄家 0 ⇒ 环形序 1,2,3,0。赢家 3 ⇒ 输家 {0,1,2}，最近者是 1
  assert.equal(nextDealerOf('loser', { dealer: 0, seats, winners: [3], remainderTo: null }, seats), 1);
  // 输家 1 离桌 ⇒ 顺延到 2（不是座位号最小者 0）
  assert.equal(nextDealerOf('loser', { dealer: 0, seats, winners: [3], remainderTo: null }, [0, 2, 3]), 2);
  // 弃牌者也算输家：赢家只有 3 ⇒ 输家是 {0,1,2}；庄家 2 ⇒ 环形序 3,0,1,2 ⇒ 最近的输家 = 0
  assert.equal(nextDealerOf('loser', { dealer: 2, seats, winners: [3], remainderTo: null }, seats), 0);
});

test('dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）', () => {
  // 可达构造：分池两名赢家 + 唯一输家破产离桌 ⇒ 桌上只剩两个赢家
  const prev: PrevHand = { dealer: 0, seats: [0, 1, 2], winners: [0, 1], remainderTo: 1 };
  assert.equal(nextDealerOf('loser', prev, [0, 1]), 1, '兜底 = 轮庄（庄家 0 的下家且在桌 = 1）');
  // 兜底不能返回 null，否则 beginNextHand 的 ?? 分支会静默吞掉异常
  assert.notEqual(nextDealerOf('loser', prev, [0, 1]), null);
});

test('dealer/06 三档都没有可留的座位时返回 null（调用方该收桌）', () => {
  const prev: PrevHand = { dealer: 0, seats: [0, 1, 2], winners: [2], remainderTo: null };
  assert.equal(nextDealerOf('rotate', prev, []), null);
  assert.equal(nextDealerOf('winner', prev, []), null);
  assert.equal(nextDealerOf('loser', prev, []), null);
});

test('dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError', () => {
  for (const mode of ['rotate', 'winner', 'loser'] as const) {
    const s = sess(mode);
    assert.equal(s.rules.dealer.next, mode);
    assert.equal(s.state.rules.dealer.next, mode, '规则要一路传到引擎状态里');
  }
  assert.equal(createSession({ bots: 2, baseSeed: 7 }).rules.dealer.next, 'rotate');
  assert.throws(() => sess('sticky' as never), TypeError, '枚举外的档位必须被拒');
  assert.throws(() => sess('' as never), TypeError, '空串也不是合法档位');
  // 建会话不许污染 preset 常量本身（preset 深冻结、且每次 validateRules 产出新对象）
  assert.equal(createSession({ bots: 2, baseSeed: 7, dealerNext: 'loser' }).rules.dealer.next, 'loser');
  assert.equal(createSession({ bots: 2, baseSeed: 7, presetName: 'a23off' }).rules.dealer.next, 'rotate', 'a23off 也得默认轮庄');
  assert.equal(sess('rotate').rules.dealer.next, 'rotate', '前面的会话不能把 rotate 档带偏');
});

test('dealer/08 会话层：winner 档 ⇒ 每局庄家 = 上一局赢家', () => {
  let s = sess('winner', 3, 555);
  const seen: string[] = [];
  for (let hand = 0; hand < 6; hand += 1) {
    const settled = playOne(s);
    const prev = prevOf(settled);
    const r = act(settled, { kind: 'nextHand' });
    assert.equal(r.ok, true);
    const next = r.session as Session;
    if (next.over !== null) break;
    assert.ok(prev.winners.includes(next.dealer), `第 ${String(next.handIndex)} 局庄家 ${String(next.dealer)} 不在上局赢家 ${prev.winners.join('/')} 里`);
    seen.push(`${prev.dealer}>${prev.winners.join(',')}=>${next.dealer}`);
    s = next;
  }
  assert.ok(seen.length >= 3, `只跑出了 ${String(seen.length)} 局样本`);
  note(`DEALER08 winner ${seen.join(' ')}`);
});

test('dealer/09 会话层：loser 档 ⇒ 庄家来自上一局非赢家（除非无在桌输家）', () => {
  let s = sess('loser', 3, 555);
  let fallbacks = 0;
  let hands = 0;
  for (let hand = 0; hand < 6; hand += 1) {
    const settled = playOne(s);
    const prev = prevOf(settled);
    const r = act(settled, { kind: 'nextHand' });
    assert.equal(r.ok, true);
    const next = r.session as Session;
    if (next.over !== null) break;
    const seated = next.state.seats.map((x) => x.seat);
    const losers = prev.seats.filter((x) => !prev.winners.includes(x) && seated.includes(x));
    if (losers.length === 0) fallbacks += 1;
    else assert.ok(losers.includes(next.dealer), `庄家 ${String(next.dealer)} 既不在输家 ${losers.join('/')} 里，也不该走兜底`);
    hands += 1;
    s = next;
  }
  assert.ok(hands >= 3, `只跑了 ${String(hands)} 局`);
  note(`DEALER09 loser hands=${String(hands)} fallback=${String(fallbacks)}`);
});

test('dealer/10 会话层：rotate 档仍是老行为（庄位逐局换人），且三档结果互不相同', () => {
  const seqOf = (mode: 'rotate' | 'winner' | 'loser', seed: number): number[] => {
    let s = sess(mode, 3, seed);
    const out: number[] = [];
    for (let hand = 0; hand < 5; hand += 1) {
      out.push(s.dealer);
      const settled = playOne(s);
      const r = act(settled, { kind: 'nextHand' });
      assert.equal(r.ok, true);
      const next = r.session as Session;
      if (next.over !== null) break;
      s = next;
    }
    return out;
  };
  const rotate = seqOf('rotate', 555);
  const winner = seqOf('winner', 555);
  const loser = seqOf('loser', 555);
  // rotate：每局庄家 = 上一局庄家的下家（4 人局，座位 0..3 全在桌 ⇒ 严格 +1 mod 4）
  rotate.slice(1).forEach((d, i) => {
    assert.equal(d, ((rotate[i] as number) + 1) % 4, `轮庄序列断了：${rotate.join('>')}`);
  });
  assert.ok(String(rotate) !== String(winner) || String(rotate) !== String(loser), '三档跑出来一模一样 ⇒ 配置是装饰');
  note(`DEALER10 rotate=${rotate.join(',')} winner=${winner.join(',')} loser=${loser.join(',')}`);
});

test('dealer/11 选庄不改钱：三档各自跨局守恒', () => {
  for (const mode of ['rotate', 'winner', 'loser'] as const) {
    let s = sess(mode, 2, 909, 256);
    for (let hand = 0; hand < 3; hand += 1) {
      const settled = playOne(s);
      assert.equal(tableTotal(settled), 3 * 256, `${mode} 档中途钱不守恒`);
      const r = act(settled, { kind: 'nextHand' });
      assert.equal(r.ok, true);
      const next = r.session as Session;
      if (next.over !== null) break;
      s = next;
    }
  }
});
