// M1.5 无头验证：会话模型 + 页面层能做的事，不用浏览器就全部断言掉。
// 覆盖工单 §4 M1.5 验收 ①（M1 零回归、零运行时依赖）②（一整局含真人发起比牌与一次结算）
// ③（非法意图被拒且状态不变），外加静态服务的**路径安全**（它是唯一会把项目文件暴露出去的部件）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, note } from './harness.ts';
import { classify } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { stateHash } from '../src/engine/state.ts';
import {
  act,
  botStep,
  chooseBotIntent,
  compareTargets,
  createSession,
  currentLedgerTotal,
  deriveSeed,
  intentOptions,
  isBotsTurn,
  ledger,
  logRows,
  seatRows,
  seatCells,
  intentsFor,
  settlementRows,
  settlementSummary,
  revealedHandsLine,
  handAscii,
  statusLine,
  stepBots,
  tableTotal,
  handText,
  view,
} from '../webmin/model.ts';
import type { Intent, Session } from '../webmin/model.ts';
import { redirectTarget, resolveStatic } from '../webmin/serve.ts';

const ANTE = 1;

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

// 剥掉注释后再扫，免得"注释里提了一句 Math.random"被当成命中
function code(rel: string): string {
  return read(rel)
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function sess(bots = 2, seed = 20260925, buyIn = 256): Session {
  return createSession({ bots, baseSeed: seed, buyIn, humanSeat: 0 });
}

function legal(s: Session | null) {
  return s === null ? [] : intentOptions(s);
}

// 等价于"真人点一下按钮"：点完让机器人接力，直到轮回真人或本局结束
function click(s: Session, intent: Intent): Session {
  const r = act(s, intent);
  assert.equal(r.ok, true, `意图 ${intent.kind} 本该合法却被拒（${r.ok ? '' : r.error}）`);
  return stepBots(r.session).session as Session;
}

// 把行动权交到真人手上（开局通常是机器人先动）
function toHuman(s: Session): Session {
  return stepBots(s).session as Session;
}

function humanMove(s: Session, preferRaise = false): Intent | null {
  const opts = legal(s);
  if (opts.length === 0) return null;
  const byKind = (k: string) => opts.find((o) => o.intent.kind === k)?.intent;
  if (opts.some((o) => o.intent.kind === 'settle')) return { kind: 'settle' };
  if (opts.some((o) => o.intent.kind === 'nextHand')) return { kind: 'nextHand' };
  if (preferRaise) {
    const up = byKind('raise');
    if (up !== undefined) return up;
  }
  return (byKind('call') ?? byKind('fold') ?? opts[0]?.intent) as Intent;
}

// 把一局推到 settled。开局第一手通常是机器人先动（庄家是真人）。
function finishHand(s: Session, preferRaise = false): { session: Session; steps: number } {
  let cur = s;
  let steps = 0;
  while (cur.state.phase !== 'settled' && steps < 400) {
    steps += 1;
    const mv = humanMove(cur, preferRaise);
    if (mv !== null) {
      cur = click(cur, mv);
      continue;
    }
    assert.equal(cur.state.phase, 'betting', `phase=${cur.state.phase} 却没有可点的意图`);
    const b = stepBots(cur);
    assert.equal(b.ok, true, `机器人步进被拒：${b.ok ? '' : b.error}`);
    cur = b.session as Session;
  }
  return { session: cur, steps };
}

test('ui/01 createSession 建立座位、首局与台账', () => {
  const s = sess(2);
  assert.equal(s.seats.length, 3);
  assert.equal(s.humanSeat, 0);
  assert.equal(s.state.phase, 'betting');
  assert.equal(s.state.pot, 3 * ANTE);
  assert.equal(s.dealer, 0);
  assert.equal(s.over, null);
  // 底注已进池 ⇒ 口袋里是 买入−底注；桌上总额（含池）仍是 人数×买入
  assert.deepEqual(ledger(s).map((x) => x.chips), [255, 255, 255]);
  assert.equal(tableTotal(s), 768);
  assert.equal(currentLedgerTotal(s), 768);
});

test('ui/02 非法开局参数一律抛 TypeError', () => {
  for (const bad of [{ bots: -1 }, { bots: 6 }, { bots: 1.5 }, { baseSeed: Number.NaN }, { buyIn: 0 }]) {
    assert.throws(() => createSession({ bots: 2, baseSeed: 1, buyIn: 256, ...bad } as never), TypeError, JSON.stringify(bad));
  }
});

test('ui/03 deriveSeed 确定、逐局不同、不用时钟', () => {
  const a = deriveSeed(20260925, 1);
  assert.equal(a, deriveSeed(20260925, 1));
  assert.notEqual(a, deriveSeed(20260925, 2));
  assert.ok(Number.isInteger(a) && a >= 0);
  const set = new Set<number>();
  for (let i = 1; i <= 200; i += 1) set.add(deriveSeed(7, i));
  assert.ok(set.size > 195, `200 局只产生 ${String(set.size)} 个不同种子`);
  note(`SEED base=20260925 h1=${String(a)} h2=${String(deriveSeed(20260925, 2))}`);
});

test('ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变', () => {
  const s = sess(2);
  assert.ok(isBotsTurn(s), '庄家是真人 ⇒ 开局应轮到机器人');
  const before = stateHash(s.state);
  const r = act(s, { kind: 'call' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, 'not_current_turn');
  assert.equal(stateHash(r.session.state), before, '被拒的点击改动了状态');
  assert.match(String(r.session.note ?? ''), /被引擎拒绝/);
});

test('ui/05 真人+机器人打完一整局：走到结算，台账守恒', () => {
  const { session: s, steps } = finishHand(sess(3));
  assert.equal(s.state.phase, 'settled');
  assert.ok(steps < 90, `一局走了 ${String(steps)} 步`);
  const rows = settlementRows(s);
  assert.ok(rows.length >= 5, `结算面板只有 ${String(rows.length)} 行`);
  assert.match(rows[0] ?? '', /结束原因/);
  assert.match(rows.join('\n'), /豹子|同花顺|同花|顺子|对子|单张|未开牌/);
  assert.match(rows.join('\n'), /赢|没赢|应赢/);
  assert.match(rows.join('\n'), /指纹 [0-9a-f]{16}/);
  assert.equal(s.state.pot, 0);
  assert.equal(tableTotal(s), 4 * 256);
  assert.ok(ledger(s).some((x) => x.chips > 256), '总该有一家赢了钱');
  note(`UI05 steps=${String(steps)} ${String(rows[0])}`);
});

test('ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过', () => {
  let s = sess(2);
  assert.ok(compareTargets(s).length > 0);
  let tried = false;
  let blockedOnce = false;
  for (let round = 0; round < 120 && !tried; round += 1) {
    if (s.state.phase === 'awaitingSettle') {
      s = click(s, { kind: 'settle' });
      continue;
    }
    if (s.state.phase === 'settled') {
      s = click(s, { kind: 'nextHand' });
      continue;
    }
    if (s.state.turn !== 0) {
      s = stepBots(s).session as Session;
      continue;
    }
    const t = compareTargets(s);
    const target = t.find((x) => legal(s).some((o) => o.intent.kind === 'compare' && o.intent.target === x));
    if (target === undefined) {
      const probe = act(s, { kind: 'compare', target: t[0] as number });
      if (!probe.ok && probe.error === 'compare_forbidden_before_first_actions') blockedOnce = true;
      const mv = humanMove(s, true);
      if (mv !== null) s = click(s, mv);
      continue;
    }
    const before = s.state.seats.filter((x) => x.active).length;
    const r = act(s, { kind: 'compare', target });
    assert.equal(r.ok, true);
    s = stepBots(r.session).session as Session;
    assert.equal(s.state.seats.filter((x) => x.active).length, before - 1, '比牌应当恰好淘汰一家');
    assert.ok(s.state.log.some((e) => e.type === 'compare'));
    assert.notEqual(s.state.seats.find((x) => x.out === 'eliminated'), undefined, '该有一家记为被淘汰');
    tried = true;
  }
  assert.ok(tried, '120 轮内没构造出一次合法的真人比牌');
  assert.ok(blockedOnce, '从未观察到"首圈禁比"把比牌挡下来');
  note('UI06 合法比牌达成，且首圈禁比确凿生效过');
});

test('ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点', () => {
  const s0 = sess(2);
  const bad: Intent[] = [
    { kind: 'settle' },
    { kind: 'nextHand' },
    { kind: 'look' },
    { kind: 'call' },
    { kind: 'raise' },
    { kind: 'compare', target: 0 },
    { kind: 'compare', target: -7 },
  ];
  let rejected = 0;
  for (const intent of bad) {
    if (legal(s0).some((o) => JSON.stringify(o.intent) === JSON.stringify(intent))) continue;
    const before = stateHash(s0.state);
    const r = act(s0, intent);
    assert.equal(r.ok, false, `本该被拒：${intent.kind}`);
    if (!r.ok) {
      assert.ok(r.error.length > 0);
      assert.equal(stateHash(r.session.state), before, `${intent.kind} 被拒却改了状态`);
      rejected += 1;
    }
  }
  assert.equal(rejected, bad.length);
  const reset = act(s0, { kind: 'reset' });
  assert.equal(reset.ok, true, '整桌重来是会话层意图，任何时刻可点');
  if (reset.ok) assert.equal(reset.session.handIndex, 1);
  const s = stepBots(s0).session as Session;
  if (s.state.turn === 0) {
    const once = act(s, { kind: 'look' });
    assert.equal(once.ok, true);
    const twice = act(once.session, { kind: 'look' });
    assert.equal(twice.ok, false);
    if (!twice.ok) assert.equal(twice.error, 'already_looked');
    const early = act(once.session, { kind: 'nextHand' });
    assert.equal(early.ok, false);
    if (!early.ok) assert.equal(early.error, 'not_settled');
  }
  note(`UI07 rejected=${String(rejected)}/${String(bad.length)}`);
});

test('ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒', () => {
  const { session: settled } = finishHand(sess(2));
  const before = ledger(settled).map((x) => x.chips);
  const dealerBefore = settled.dealer;
  // 用 act 而不是 click：这一步要看的是"刚开出来的新局"，不能被机器人先手改变池
  const opened = act(settled, { kind: 'nextHand' });
  assert.equal(opened.ok, true);
  const next = opened.session as Session;
  assert.equal(next.handIndex, 2);
  const order = next.seats.map((x) => x.seat).sort((a, b) => a - b);
  const want = order[(order.indexOf(dealerBefore) + 1) % order.length] as number;
  assert.equal(next.dealer, want, '庄家应轮转到上局庄家的下家');
  assert.equal(next.state.dealer, want);
  assert.equal(next.state.phase, 'betting');
  assert.equal(next.state.pot, next.rules.ante * next.seats.length);
  assert.deepEqual(
    ledger(next).map((x) => x.chips).sort((a, b) => a - b),
    [...before].sort((a, b) => a - b).map((c) => c - next.rules.ante),
    '新一局口袋里 = 上局结算值再扣底注',
  );
  assert.equal(tableTotal(next), tableTotal(settled), '跨局桌上总额必须守恒');
});

test('ui/09 连打 12 局：每局有限步结束、总额恒定', () => {
  let s = sess(2, 4242);
  const start = tableTotal(s);
  assert.equal(start, 3 * 256);
  let hands = 0;
  for (let hand = 0; hand < 12; hand += 1) {
    if (s.over !== null) break;
    const r = finishHand(s, hand % 3 === 0);
    s = r.session;
    assert.equal(s.state.phase, 'settled');
    assert.ok(r.steps < 90, `第 ${String(hand + 1)} 局走了 ${String(r.steps)} 步`);
    assert.equal(tableTotal(s), start, `第 ${String(hand + 1)} 局桌上总额变了`);
    hands += 1;
    s = click(s, { kind: 'nextHand' });
    assert.equal(tableTotal(s), start, '开局瞬间总额就错了');
  }
  assert.ok(hands >= 6, `只打满 ${String(hands)} 局`);
  note(`UI09 hands=${String(hands)} total=${String(tableTotal(s))} over=${String(s.over)}`);
});

test('ui/10 机器人走 AI：只出合法意图、闷着不加注不比牌、注级抬高先转明', () => {
  let checked = 0;
  let raises = 0;
  let folds = 0;
  let calls = 0;
  let looks = 0;
  let compares = 0;
  for (let seedBase = 1; seedBase <= 40; seedBase += 1) {
    let s = sess(2, seedBase * 7919);
    for (let step = 0; step < 80 && s.state.phase !== 'settled'; step += 1) {
      if (isBotsTurn(s)) {
        const seat = s.state.turn;
        const intent = chooseBotIntent(s, seat);
        const kinds = intentsFor(s, seat).map((i) => i.kind);
        const dark = s.state.seats.find((x) => x.seat === seat)?.looked === false;
        assert.ok(kinds.includes(intent.kind), `机器人选了合法集合外的 ${intent.kind}（合法 ${kinds.join('/')}）`);
        // rev=4 ④ 的两条不变量在 M3 必须原样成立：闷着不抬价、注级抬高必先转明
        if (dark) assert.notEqual(intent.kind, 'raise', '闷着的时候绝不许加注');
        if (dark) assert.notEqual(intent.kind, 'compare', '闷着不比牌（§4 M3 的比牌资格含"已看牌"）');
        if (dark && s.state.stake > s.rules.stake.initial) assert.equal(intent.kind, 'look', `注级 ${String(s.state.stake)} 还闷着却没有先转明`);
        if (intent.kind === 'raise') raises += 1;
        if (intent.kind === 'fold') folds += 1;
        if (intent.kind === 'call') calls += 1;
        if (intent.kind === 'look') looks += 1;
        if (intent.kind === 'compare') compares += 1;
        checked += 1;
        const r = botStep(s);
        assert.equal(r.ok, true, `机器人 ${intent.kind} 被拒：${r.ok ? '' : r.error}`);
        s = r.session as Session;
        continue;
      }
      const mv = humanMove(s, seedBase % 2 === 0);
      if (mv === null) break;
      // 这里刻意不用 click()：click 会把机器人一步带走，样本就统计不到 botStep 上了
      const hr = act(s, mv);
      assert.equal(hr.ok, true, `真人 ${mv.kind} 被拒：${hr.ok ? '' : hr.error}`);
      s = hr.session;
    }
  }
  assert.ok(checked > 100, `机器人只走了 ${String(checked)} 步，样本不足`);
  assert.equal(raises + folds + calls + looks + compares, checked);
  assert.ok(calls > 0 && folds > 0, `跟/走两条臂没都走到 call=${String(calls)} fold=${String(folds)}`);
  assert.ok(looks > 0, '一局里没有任何机器人在注级 ≥2 时转明 ⇒ 未看牌分支没被走到');
  assert.ok(compares > 0, '40 局样本里机器人从没主动比过牌 ⇒ §4 M3 的比牌分支在真实对局里是死代码');
  note(`UI10 botSteps=${String(checked)} raise=${String(raises)} call=${String(calls)} fold=${String(folds)} look=${String(looks)} compare=${String(compares)}`);
});

// M2 起 bot 的决策来自 src/ai（牌力档位 + 池赔率）。这一组只钉两件事：
// ① 页面层不留第二套策略 —— "chooseBotIntent 里必须同时出现 project() 与 decideAi()、且不许出现 classify/.hand"
//    那条静态检查在 ui/14；② 几个能从规范直接推出的极端局面（阈值细节成组覆盖在 test/ai-honest.test.ts）。
test('ui/10b 机器人走 AI：强牌加注 / 同一副牌随赔率翻转 / 闷着遇高注级先转明', () => {
  const force = (s: Session, seat: number, hand: Card[], stake: number, looked = true): Session => ({
    ...s,
    state: {
      ...s.state,
      stake,
      turn: seat,
      seats: s.state.seats.map((x) => (x.seat === seat ? { ...x, hand, looked, actionsTotal: 1 } : x)),
    },
  });
  const mk = (rank: number, suit: number): Card => ({ rank, suit });
  const base = sess(2);
  const bot = 1;

  const trips = force(base, bot, [mk(9, 0), mk(9, 1), mk(9, 2)], 1);
  assert.ok(intentsFor(trips, bot).some((i) => i.kind === 'raise'), '构造局应当允许加注');
  assert.equal(chooseBotIntent(trips, bot).kind, 'raise', '看过牌的豹子该做价值加注');

  // 同一副"中等偏弱的 A 高牌"，只改池与注级 ⇒ 决策必须翻转。这钉的是"赔率真的进了决策"，
  // 而不是"这手牌本身该不该打"。
  const mid = [mk(14, 0), mk(6, 1), mk(3, 2)];
  const dear = force(base, bot, mid, 4);
  assert.equal(chooseBotIntent(dear, bot).kind, 'fold', 'A 高牌遇到注级 4 的明价（8 进 5 的池）该弃');

  const cheap = force({ ...base, state: { ...base.state, pot: 120 } }, bot, mid, 1);
  assert.equal(chooseBotIntent(cheap, bot).kind, 'call', '同一副牌，池给到 120、只要跟 2 ⇒ 该跟');

  // 闷着 + 注级已抬高 ⇒ 唯一诚实的动作是先看牌（此时它连自己拿什么都看不到）
  const dark = force(base, bot, [mk(9, 0), mk(9, 1), mk(9, 2)], 4, false);
  assert.equal(chooseBotIntent(dark, bot).kind, 'look', '闷着遇到高注级，先转明而不是拿先验硬跟');
});

// rev=4 ④ 的不变量在 M2 必须原样成立（现在是信息边界保证的，不是策略代码保证的）
test('ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）', () => {
  const mk = (rank: number, suit: number): Card => ({ rank, suit });
  const bot = 1;
  const hands: Card[][] = [
    [mk(14, 0), mk(14, 1), mk(14, 2)],
    [mk(9, 2), mk(10, 2), mk(11, 2)],
    [mk(2, 1), mk(7, 1), mk(13, 1)],
    [mk(3, 0), mk(3, 1), mk(12, 2)],
    [mk(5, 0), mk(6, 1), mk(7, 2)],
    [mk(2, 0), mk(4, 1), mk(7, 2)],
    [mk(13, 0), mk(14, 1), mk(12, 2)],
  ];
  const darkAt = (stake: number, s: Session, hand: Card[]): Session => ({
    ...s,
    state: {
      ...s.state,
      stake,
      turn: bot,
      seats: s.state.seats.map((x) => (x.seat === bot ? { ...x, hand, looked: false, actionsTotal: 1 } : x)),
    },
  });
  let sawLook = false;
  for (const stake of [1, 2, 4, 8]) {
    const picks = hands.map((h) => chooseBotIntent(darkAt(stake, sess(2), h), bot).kind);
    assert.equal(new Set(picks).size, 1, `注级 ${String(stake)} 闷着时的决策被手牌影响了：${picks.join('/')}`);
    const picked = picks[0] as string;
    assert.ok(['look', 'call', 'fold'].includes(picked), `闷着时选了 ${picked}：既不能加注也不能比牌`);
    if (picked === 'look') sawLook = true;
  }
  assert.ok(sawLook, '四个注级上都没触发转明 ⇒ AI 的"看牌/保持闷"决策是死代码');
  // 反向对照：已看牌时同样这批牌必须走出不同决策，否则上面的"决策不变"是门焊死的假象
  const litAt = (stake: number, s: Session, hand: Card[]): Session => ({
    ...s,
    state: {
      ...s.state,
      stake,
      turn: bot,
      seats: s.state.seats.map((x) => (x.seat === bot ? { ...x, hand, looked: true, actionsTotal: 1 } : x)),
    },
  });
  const lit = hands.map((h) => chooseBotIntent(litAt(1, sess(2), h), bot).kind);
  assert.ok(new Set(lit).size >= 2, `已看牌时策略没在用手牌：${lit.join('/')}`);
});

test('ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来', () => {
  let s = sess(2, 99, 3);
  let guard = 0;
  while (s.over === null && guard < 80) {
    guard += 1;
    s = finishHand(s).session;
    if (s.over !== null) break;
    s = click(s, { kind: 'nextHand' });
  }
  assert.notEqual(s.over, null, `打了 ${String(guard)} 局还没收桌`);
  if (s.over === null) return;
  assert.match(s.over, /牌局结束/);
  assert.deepEqual(legal(s).map((o) => o.intent.kind), ['reset']);
  const before = stateHash(s.state);
  const stray = act(s, { kind: 'call' });
  assert.equal(stray.ok, false);
  if (!stray.ok) assert.equal(stray.error, 'session_over');
  assert.equal(stateHash(stray.session.state), before, '结束后 stray 点击不该动状态');
  const back = act(s, { kind: 'reset' });
  assert.equal(back.ok, true);
  if (back.ok) {
    assert.equal(back.session.handIndex, 1);
    assert.equal(back.session.over, null);
    assert.equal(tableTotal(back.session), 3 * 3);
  }
  note(`UI11 收桌于第 ${String(guard)} 局：${s.over}`);
});

test('ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）', () => {
  for (const mode of ['rotate', 'winner', 'loser'] as const) {
    // 买入压到 3：一定会在几局之内有人破产离桌
    let s = createSession({ bots: 3, baseSeed: 99, buyIn: 3, humanSeat: 0, dealerNext: mode });
    assert.equal(s.seats.length, 4);
    let guard = 0;
    while (s.over === null && guard < 60) {
      guard += 1;
      s = finishHand(s).session;
      if (s.over !== null) break;
      s = click(s, { kind: 'nextHand' });
    }
    assert.notEqual(s.over, null, `${mode} 档跑不出一次收桌`);
    const back = act(s, { kind: 'reset' });
    assert.equal(back.ok, true);
    if (!back.ok) return;
    assert.equal(back.session.seats.length, 4, '整桌重来把离桌的玩家弄丢了（名册被中途裁过）');
    assert.equal(tableTotal(back.session), 4 * 3, '重来后桌上总额应 = 人数 × 买入');
    assert.equal(back.session.rules.dealer.next, mode, '整桌重来把庄家规则静默重置成轮庄了');
    assert.equal(back.session.handIndex, 1);
  }
});

test('ui/12 视图字符串满足"信息全优先"', () => {
  const s = sess(3);
  const status = statusLine(s);
  assert.match(status, /第 1 局/);
  assert.match(status, /注级 \d+/);
  assert.match(status, /池 \d+/);
  assert.match(status, /轮到|等结算|已结算/);
  assert.match(status, /庄位规则 轮庄/, '状态行没暴露当前庄位规则（三档要在界面上看得见）');
  const winnerStatus = statusLine(
    createSession({ bots: 2, baseSeed: 5, buyIn: 256, humanSeat: 0, dealerNext: 'winner' }),
  );
  assert.match(winnerStatus, /庄位规则 赢家坐庄/);
  const rows = seatRows(s);
  assert.equal(rows.length, 4);
  for (const r of rows) {
    assert.match(r, /筹码 \d+/);
    assert.match(r, /本局已投入 \d+/);
    assert.match(r, /闷|明/);
    assert.match(r, /牌 /);
  }
  assert.ok(rows.some((r) => r.includes('[你]')), '没标出真人自己');
  assert.ok(rows.some((r) => r.includes('庄')), '没标出庄家');
  assert.ok(rows.some((r) => r.includes('◀')), '没标出当前行动者');
  assert.equal(settlementRows(s).length, 0, '未结束时不该有结算内容');
  const logs = logRows(s);
  assert.ok(logs.length >= 1);
  assert.match(logs[0] ?? '', /^#\d{3}/);
  // 开局第一手是机器人（庄家是真人），先让它动，日志必须变长
  const after = stepBots(s).session as Session;
  assert.ok(logRows(after).length > logs.length, '机器人走一步之后日志没变长');
  assert.ok(settlementRows(finishHand(sess(2)).session).length > 0, '结束后应有结算面板');
});

test('ui/13 静态服务的白名单与路径穿越防护', () => {
  for (const url of ['/webmin/index.html', '/webmin/app.ts', '/webmin/model.ts', '/src/cards.ts', '/src/engine/state.ts']) {
    assert.equal(resolveStatic(url).ok, true, `${url} 应当放行`);
  }
  const appTs = resolveStatic('/webmin/app.ts');
  assert.ok(appTs.ok === true && appTs.needsStrip === true && /javascript/.test(appTs.mime));
  const html = resolveStatic('/webmin/index.html');
  assert.ok(html.ok === true && html.needsStrip === false && /text\/html/.test(html.mime));
  // 根路径不再由 resolveStatic 直接发文件：那样文档 URL 还是 /，页面里的 ./app.ts 会被解析成
  // /app.ts 而被白名单拒（实测 403，页面完全起不来）⇒ 必须先 302 到真实位置。
  assert.equal(resolveStatic('/').ok, false, '根路径不该被 resolveStatic 直接放行');
  assert.equal(redirectTarget('/'), '/webmin/index.html');
  assert.equal(redirectTarget('/index.html'), '/webmin/index.html');
  assert.equal(redirectTarget('/webmin/'), '/webmin/index.html');
  assert.equal(redirectTarget('/webmin/index.html'), null);
  assert.equal(redirectTarget('/app.ts'), null);
  assert.equal(resolveStatic('/webmin').ok, false, '目录列表不该被放行');
  assert.equal(resolveStatic('/src').ok, false, '目录列表不该被放行');
  assert.equal(resolveStatic('/webmin/model.ts?v=3').ok, true, 'query 应当被剥掉');
  // 归一化是"先算路径再判边界"，所以落在允许目录内的 .. 路径应当放行（不是见 .. 就拒）
  assert.equal(resolveStatic('/webmin/../src/cards.ts').ok, true, '归一化后仍在 src/ 内应当放行');
  assert.equal(resolveStatic('/src/engine/../cards.ts').ok, true, '同上');
  for (const bad of [
    '/../BRIEF.md',
    '/%2e%2e/BRIEF.md',
    '/..%2f..%2fwindows/win.ini',
    '/webmin/../BRIEF.md',
    '/BRIEF.md',
    '/test/run.ts',
    '/package.json',
    '/node_modules/typescript/package.json',
    '/webmin/x.png',
    '/webmin/x.exe',
    // 图片收窄规则（3d0d022）：webui 下、assets 之外的图片同样拒绝 ——
    // 只钉 webmin+x.png 的话，"把图片挪进 webui 根目录"这条绕路就没人看着
    '/webui/evil.png',
    '/webui/../src/cards.png',
    '/src/engine/state.jpg',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
  ]) {
    const r = resolveStatic(bad);
    assert.equal(r.ok, false, `必须拒绝 ${bad}`);
    if (!r.ok) assert.ok([400, 403].includes(r.status), `${bad} → ${String(r.status)}`);
  }
});

test('ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则', () => {
  const model = code('webmin/model.ts');
  for (const banned of [/document\./, /window\./, /localStorage/, /\bDate\b/, /Math\.random/, /node:/, /performance\./]) {
    assert.ok(!banned.test(model), `webmin/model.ts 出现 ${String(banned)}`);
  }
  const app = code('webmin/app.ts');
  assert.ok(!/node:/.test(app), 'app.ts 是浏览器代码，不许 import node 内置');
  assert.ok(!/\bclassify\(/.test(app), 'app.ts 不许自己判牌型，只能问 model');
  assert.ok(!/legalActions\(/.test(app), 'app.ts 不许自己判合法性');
  const serve = code('webmin/serve.ts');
  assert.ok(/node:http/.test(serve) && /stripTypeScriptTypes/.test(serve), 'serve.ts 应是唯一用 node 内置与 strip 的地方');
  for (const banned of [/Math\.random/, /new Date/, /Date\.now/]) {
    assert.ok(!banned.test(serve), `serve.ts 出现 ${String(banned)}`);
  }
  for (const f of ['src/cards.ts', 'src/rules.ts', 'src/engine/state.ts', 'src/engine/actions.ts', 'src/engine/validate.ts', 'src/engine/settle.ts', 'src/engine/project.ts']) {
    assert.ok(!/webmin/.test(read(f)), `${f} 不许反向依赖 webmin`);
  }
  // M2 起机器人不再自带策略：chooseBotIntent 只许"投影 + 合法表 → AI"，自己一手牌都不许碰
  const all = code('webmin/model.ts');
  const from = all.indexOf('export function chooseBotIntent');
  assert.ok(from >= 0, 'chooseBotIntent 找不到了');
  const rest = all.slice(from + 'export function chooseBotIntent'.length);
  const cut = rest.indexOf('\nexport ');
  const fnText = rest.slice(0, cut >= 0 ? cut : rest.length);
  for (const banned of [/\.hand\b/, /classify\(/, /me\.looked/]) {
    assert.ok(!banned.test(fnText), `chooseBotIntent 里出现了 ${String(banned)} —— 决策信息应全部来自投影`);
  }
  assert.ok(/decideAi\(/.test(fnText), 'chooseBotIntent 没把决策交给 src/ai');
  assert.ok(/project\(/.test(fnText), 'chooseBotIntent 没走 project() 投影');
  // looked 门本身搬进了 AI：没看过牌 ⇒ cards 是 'unknown'，先验决策不得引用真实牌力
  const ai = code('src/ai/honest.ts');
  assert.ok(/me\.cards !== 'unknown'/.test(ai), 'AI 里的"看过牌才认牌力"这道门没了');
  assert.ok(/BLIND_PRIOR/.test(ai), 'AI 未看牌时的先验常量和它的用法都要在');
});

test('ui/15 页面接线：html 与各模块 import 路径都能被服务放行', () => {
  const html = read('webmin/index.html');
  assert.ok(!/<[^>]*>[^<]*session[^<]*</i.test(html), '可见文案中英混排（复审非阻塞项）：按钮文字里不要再出现英文');
  const m = /<script type="module" src="([^"]+)"/.exec(html);
  assert.notEqual(m, null, 'index.html 没挂 module 脚本');
  assert.equal(resolveStatic(`/webmin/${(m?.[1] ?? '').replace(/^\.\//, '')}`).ok, true);
  for (const spec of [...code('webmin/app.ts').matchAll(/from '(\.[^']+)'/g)].map((x) => x[1] as string)) {
    assert.equal(resolveStatic(`/webmin/${spec.replace(/^\.\//, '')}`).ok, true, `app.ts 的 ${spec} 不可服务`);
  }
  for (const spec of [...code('webmin/model.ts').matchAll(/from '(\.\.\/src[^']+)'/g)].map((x) => x[1] as string)) {
    const r = resolveStatic(`/webmin/${spec}`);
    assert.equal(r.ok, true, `model.ts 的 ${spec} 经浏览器解析后不可服务`);
    if (r.ok) assert.ok(/[\\/]src[\\/]/.test(r.abs), `${spec} 解析后跑出了 src：${r.abs}`);
  }
  // M2：庄家规则下拉必须三档齐全，且 value 与 Rules.dealer.next 的枚举一一对应（面板不许自创第四档）
  const dealerSel = /<select id="dealerNext">([\s\S]*?)<\/select>/.exec(html);
  assert.notEqual(dealerSel, null, '开局面板缺"庄家规则"下拉');
  const optionValues = [...(dealerSel?.[1] ?? '').matchAll(/value="([^"]+)"/g)].map((m) => m[1] as string);
  assert.deepEqual([...optionValues].sort(), ['loser', 'rotate', 'winner'], `下拉档位不对：${optionValues.join('/')}`);
});

test('ui/16 一整局的可见性推进：局中暗牌、终局按规则亮', () => {
  const s = sess(2);
  const rows = seatRows(s);
  assert.equal(rows.filter((r) => r.includes('···')).length, rows.length, '开局全员闷牌：一行牌面都不该露出来');
  const mine = rows.find((r) => r.includes('[你]')) ?? '';
  assert.ok(mine.includes('···'), 'rev=4 缺陷形态：真人没点看牌就看见了自己的牌');
  // 正向对照（防"把门焊死"混过上一条）：点看牌后本人那行必须露出真牌，并从"闷"翻成"明"
  const peek = act(toHuman(s), { kind: 'look' });
  assert.equal(peek.ok, true, '轮到自己时看牌本该合法');
  const mineAfter = (seatRows(peek.session).find((r) => r.includes('[你]')) ?? '');
  assert.ok(!mineAfter.includes('···'), '点了看牌却没露出自己的牌');
  assert.ok(mineAfter.includes('明'), '看牌之后闷/明标记没翻转');
  assert.ok(seatRows(peek.session).filter((r) => r.includes('···')).length >= 2, '看牌只放开本人，别家还得藏着');
  const { session: settled } = finishHand(s);
  const t = settled.state.terminal;
  assert.notEqual(t, null);
  const text = settlementRows(settled).join('\n');
  if (t?.reason === 'oneLeft') {
    assert.match(text, /不开牌通吃/);
  } else {
    assert.match(text, /强制开牌/);
    // 强制开牌只亮"还活着的"；弃牌者永不亮牌（§1 比牌行：输者出局牌不公开）——
    // M2 之后 AI 会弃牌，这一局不再必然"三家全活"，所以按存活与否分开断言，别把前提写死成"没人弃牌"
    const alive = seatRows(settled).filter((r) => !r.includes('弃牌'));
    const dead = seatRows(settled).filter((r) => r.includes('弃牌'));
    assert.ok(alive.every((r) => !r.includes('···')), '强制开牌后活跃家还藏着牌');
    assert.ok(dead.every((r) => r.includes('···')), '弃牌者被亮出来了');
  }
  assert.equal(tableTotal(settled), 3 * 256);
  note(`UI16 reason=${String(t?.reason)}`);
});

test('ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）', () => {
  const s = sess(2);
  const me = s.state.seats.find((x) => x.seat === 0);
  assert.notEqual(me, undefined);
  if (me === undefined) return;
  const tier = classify(me.hand, s.rules).tier;
  const cn: Record<string, string> = {
    trips: '豹子',
    straightFlush: '同花顺',
    flush: '同花',
    straight: '顺子',
    pair: '对子',
    highCard: '单张',
  };
  const label = `(${cn[tier] ?? ''})`;
  const mineRow = (x: Session) => (seatRows(x).find((r) => r.includes('[你]')) ?? '');
  assert.ok(!mineRow(s).includes(label), '没看牌就在真人行里印出了牌型名');
  const peek = act(toHuman(s), { kind: 'look' });
  assert.equal(peek.ok, true);
  assert.ok(mineRow(peek.session).includes(label), `看牌后页面没显示 ${String(cn[tier])}`);
});

// rev=4 防再犯：缺陷的界面形态就是"没点看牌却看见自己的牌"，所以在会话层再钉一遍——
// 投影全树序列化 + 渲染出来的座位行都不许出现本人牌面。正向对照同批跑，免得门焊死也算通过。
test('ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面', () => {
  const s = sess(3);
  const own = s.state.seats.find((x) => x.seat === 0)?.hand;
  assert.notEqual(own, undefined);
  if (own === undefined) return;
  const needle = JSON.stringify(own);
  assert.equal(s.state.seats.find((x) => x.seat === 0)?.looked, false, '构造前提：真人还是闷的');
  assert.ok(!JSON.stringify(view(s)).includes(needle), '投影泄漏了真人没看过的牌');
  assert.ok(!seatRows(s).some((r) => r.includes(handText(own))), '座位行泄漏了真人没看过的牌');
  const peek = act(toHuman(s), { kind: 'look' });
  assert.equal(peek.ok, true);
  assert.ok(JSON.stringify(view(peek.session)).includes(needle), '正向对照：看牌后视图里该出现本人牌面');
  assert.ok(seatRows(peek.session).some((r) => r.includes('[你]') && r.includes(handText(own))), '正向对照：座位行该印出真牌');
});

test('ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）', () => {
  const { session: s } = finishHand(sess(3));
  assert.equal(s.state.phase, 'settled');
  const rows = settlementRows(s);
  const summary = settlementSummary(s);
  for (const line of summary) assert.ok(rows.includes(line), `摘要里冒出了一整块没有的行：${line}`);
  assert.match(summary[0] ?? '', /结束原因/);
  assert.match(summary[summary.length - 1] ?? '', /指纹 [0-9a-f]{16}/);
  const cells = seatCells(s);
  assert.equal(cells.filter((c) => c.resultText !== '').length, cells.length, '结算时有座位拿不到自己的结果短句');
  for (const c of cells) {
    const row = rows.find((r) => r.startsWith(c.name));
    assert.ok(row !== undefined, `整块里没有 ${c.name} 那行`);
    assert.ok((row ?? '').endsWith(`${c.resultText}（现筹码 ${String(c.chips)}）`), `板上写的「${c.resultText}」与整块那行对不上：${row ?? ''}`);
  }
  // 未结算时必须全空 —— 否则等于提前把赢家宣布出来
  assert.ok(seatCells(sess(3)).every((c) => c.resultText === ''), '牌局没打完就有座位带着结果');
  // 短句必须与"谁是赢家"严格一致（不能把没赢写成赢）
  const winners = new Set(s.state.terminal?.winners ?? []);
  for (const c of cells) {
    const isWinner = winners.has(c.seat);
    assert.equal(/^赢 \d+$/.test(c.resultText), isWinner, `${c.name} 的板上写「${c.resultText}」，但赢家集合是 ${Array.from(winners).join(',')}`);
    if (isWinner) {
      const share = s.state.terminal?.shares[s.state.terminal.winners.indexOf(c.seat)] ?? -1;
      assert.equal(c.resultText, `赢 ${String(share)}`, `${c.name} 的赢额与分池对不上`);
    } else {
      assert.equal(c.resultText, '没赢');
    }
  }
  // 待结算（terminal 已生成、筹码还没分）时只能宣布"应赢"
  let pending: Session | null = null;
  {
    let cur = sess(3);
    for (let g = 0; g < 400 && pending === null; g += 1) {
      if (cur.state.terminal !== null && cur.state.phase !== 'settled') pending = cur;
      const mv = humanMove(cur, false);
      if (mv !== null) {
        cur = click(cur, mv);
        continue;
      }
      const b = stepBots(cur);
      if (!b.ok) break;
      cur = b.session as Session;
    }
  }
  if (pending !== null) {
    const pw = new Set(pending.state.terminal?.winners ?? []);
    for (const c of seatCells(pending)) {
      if (c.resultText === '') continue;
      assert.match(c.resultText, /^应赢 \d+$/, `待结算阶段就宣布了实赢：${c.resultText}`);
      assert.ok(pw.has(c.seat), '待结算时非赢家却有结果');
    }
    note(`UI19 待结算样本：phase=${pending.state.phase} 赢家=${Array.from(pw).join(',')}`);
  } else {
    note('UI19 待结算样本：本种子下没走到该相位');
  }
  // 一整块里除每家的账以外的那些行，摘要必须一行不落地接住
  const perSeat = new Set(cells.map((c) => c.name));
  const dropped = rows.filter((r) => !summary.includes(r) && !Array.from(perSeat).some((nm) => r.startsWith(nm)));
  assert.deepEqual(dropped, [], `这些行既不在摘要里、又不是每家的账 ⇒ 从 UI 上消失了：${dropped.join(' / ')}`);
});

test('ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）', () => {
  assert.equal(revealedHandsLine(sess(3)), '', '没人看牌、没结算时不该有亮牌行');
  const { session: s } = finishHand(sess(3));
  const line = revealedHandsLine(s);
  assert.match(line, /^亮牌：/);
  assert.ok(!/[♠♥♦♣]/.test(line), `这行是给 OCR 读的 ASCII 记法，不该出现花色字形：${line}`);
  const map: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
  const ascii = (t: string): string => t.split(' ').map((g) => `${g.slice(0, -1)}${map[g.slice(-1)] ?? '?'}`).join(' ');
  const shown = seatCells(s).filter((c) => !c.hidden && !c.departed);
  assert.ok(shown.length >= 1, '强制开牌后一张牌都没亮 ⇒ 这行没有意义');
  for (const c of shown) {
    assert.ok(line.includes(`${c.name} ${ascii(c.cardsText)}`), `亮牌行漏了 ${c.name} 的 ${ascii(c.cardsText)}：${line}`);
  }
  for (const c of seatCells(s).filter((x) => x.hidden)) assert.equal(line.includes(`${c.name} `), false, `亮牌行里冒出了没亮牌的 ${c.name}：${line}`);
  assert.equal(handAscii([{ rank: 7, suit: 0 }, { rank: 10, suit: 1 }, { rank: 13, suit: 3 }]), '7S TH KD', 'ASCII 记法与本行口径不一致');
  note(`UI20 ${line}`);
});

test('ui/21 大厅短链：/lobby 与 /lobby/ 都 302 到 webui/lobby.html，目标页与其模块都在白名单内', () => {
  assert.equal(redirectTarget('/lobby'), '/webui/lobby.html');
  assert.equal(redirectTarget('/lobby/'), '/webui/lobby.html', '带尾斜杠的写法同解');
  assert.equal(redirectTarget('/lobby.html'), null, '只认短链那一个词，不吞别的路径');
  const page = resolveStatic('/webui/lobby.html');
  assert.ok(page.ok, '大厅页本身要可被静态服务端出去');
  if (page.ok) assert.match(page.mime, /text\/html/);
  const mod = resolveStatic('/webui/lobby.ts');
  assert.ok(mod.ok, '大厅的模块也要放行（.ts 现场剥类型）');
  if (mod.ok) assert.equal(mod.needsStrip, true);
  note('ui/21 /lobby →302→ webui/lobby.html，页面与模块都过 resolveStatic');
});
