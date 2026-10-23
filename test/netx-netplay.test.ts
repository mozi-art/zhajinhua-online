// M5 · 联机可玩：webui/netplay.ts 把 netx/client.ts 那道"不信任服务端"的墙接到 M3 的渲染层。
// 这里全部用内存管道（假 socket）+ 假时钟 + 每标签页的假存储驱动；真实浏览器的两个标签页由监督方
// 按工单 §4 M5 验收①亲自跑，本文件是它的可重跑替身 —— 并且比手工点几下断言得更细。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRoom } from '../netx/room.ts';
import type { Room } from '../netx/room.ts';
import type { Move } from '../netx/protocol.ts';
import { createNet } from '../webui/netplay.ts';
import type { Net, Store } from '../webui/netplay.ts';
import { buttonRow, toMove } from '../webui/netplay.ts';
import {
  dispatch as soloDispatch,
  drain as soloDrain,
  EMPTY_UI,
  snapshot as soloSnapshot,
  start as soloStart,
} from '../webui/bridge.ts';
import type { Snapshot } from '../webui/bridge.ts';
import { buildScene, TABLE_STYLE, TOTAL_LABEL } from '../webui/scene.ts';
import { handAscii, handText, tierName } from '../webmin/model.ts';
import { resolveStatic } from '../webmin/serve.ts';
import type { Intent, Session } from '../webmin/model.ts';
import { classify } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import type { Rules } from '../src/rules.ts';
// (d) 那条跨通路对账要用单机那一侧的真投影，以及引擎里那一处价格算术本身
import { project } from '../src/engine/project.ts';
import { priceOf } from '../src/engine/state.ts';
import { counterEntropy, fakeClock } from './netx-fixtures.ts';
import { note, test } from './harness.ts';

type Store0 = Store & { map: Map<string, string> };

function makeStore(): Store0 {
  const map = new Map<string, string>();
  return {
    map,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      map.set(k, v);
    },
    del: (k) => {
      map.delete(k);
    },
  };
}

type Tab = { net: Net; store: Store0; conn: string; name: string; down: string[] };

type Rig = {
  room: Room;
  clock: ReturnType<typeof fakeClock>;
  tabs: Tab[];
  join(name: string, store?: Store0, buyIn?: number): Tab;
  pump(tab: Tab): number;
  pumpAll(): void;
  act(tab: Tab, move: Move): void;
  snap(tab: Tab): Snapshot;
  text(tab: Tab): string;
  turnTab(): Tab | null;
  viewOf(tab: Tab): ReturnType<Net['peer']['viewOf']>;
  start(): void;
  handGapMs: number;
};

function readSource(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function openRig(
  seats: number,
  opts: {
    turnMs?: number;
    nonceMs?: number;
    settleMs?: number;
    handGapMs?: number;
    startAt?: number | false;
    minBuyIn?: number;
    entropySeed?: number;
  } = {},
): Rig {
  const clock = fakeClock(0);
  const room = createRoom({
    seats: Array.from({ length: seats }, (_, i) => ({ seat: i, name: `座位${String(i)}` })),
    firstDealer: 0,
    clock,
    // 默认种子保持 0x51ee7（其余用例的发牌结果依赖它）；要造"两台互不相认的房间"时换个种子。
    entropy: counterEntropy(opts.entropySeed ?? 0x51ee7),
    // §1 把"最低买入 256×底注"划给房间层，是个可配置旋钮。nui/13 要构造一个"买不起跟价"的座位，
    // 按默认门槛得先打光好几手牌才够穷；这里把门槛放开是为了**便宜地到达那个状态**，
    // 断言的对象（客户端仍发得出去、服务端 reject、页面照实显示）与此无关。
    minBuyIn: opts.minBuyIn ?? 256,
    turnMs: opts.turnMs ?? 30000,
    nonceMs: opts.nonceMs ?? 20000,
    settleMs: opts.settleMs ?? 200,
    handGapMs: opts.handGapMs ?? 60000,
  });
  function pump(tab: Tab): number {
    // 注意：room.pending() 是"取走"语义 —— 拿它探测会把消息丢掉。
    // 第一版在这里写了 `if (room.pending(conn).length === 0) return` 的探测，结果整条链路上所有
    // 下行都被探测那一下吞掉，牌局永远停在 collect。改成一律取走并喂给会话。
    let delivered = 0;
    for (let round = 0; round < 60; round += 1) {
      const down = room.pending(tab.conn);
      if (down.length === 0) return delivered;
      delivered += down.length;
      for (const msg of down) {
        const text = JSON.stringify(msg);
        tab.down.push(text);
        for (const up of tab.net.onText(text)) room.receiveText(tab.conn, up);
      }
    }
    return delivered;
  }
  const rig: Rig = {
    room,
    clock,
    tabs: [],
    join(name, store, buyIn) {
      const conn = `t${String(rig.tabs.length + 1)}`;
      const use = store ?? makeStore();
      room.open(conn);
      const net = createNet({
        name,
        buyIn: buyIn ?? 256,
        entropy: counterEntropy(0x1000 + rig.tabs.length * 0x11),
        store: use,
      });
      const tab: Tab = { net, store: use, conn, name, down: [] };
      rig.tabs.push(tab);
      room.receiveText(conn, net.joinWire());
      net.markOpen();
      pump(tab);
      return tab;
    },
    pump,
    pumpAll() {
      for (let round = 0; round < 200; round += 1) {
        let busy = 0;
        for (const t of rig.tabs) busy += pump(t);
        if (busy === 0) return;
      }
      throw new Error('环线没收敛（可能来回互发）');
    },
    act(tab, move) {
      const r = tab.net.act(move);
      assert.equal(r.sent, true, `这一意图没被允许发出：${r.why ?? '?'}`);
      room.receiveText(tab.conn, r.wire as string);
      pump(tab);
    },
    snap(tab) {
      pump(tab);
      return tab.net.snapshot();
    },
    text(tab) {
      pump(tab);
      return JSON.stringify(tab.net.snapshot());
    },
    viewOf(tab) {
      pump(tab);
      return tab.net.peer.viewOf();
    },
    turnTab() {
      for (const t of rig.tabs) {
        const v = t.net.peer.viewOf();
        if (v !== null && v.phase === 'betting' && v.turn === t.net.info().seat) return t;
      }
      return null;
    },
    start() {
      room.start();
      for (const t of rig.tabs) pump(t);
    },
    handGapMs: opts.handGapMs ?? 60000,
  };
  // 默认立刻 start()；nui/04 要"三家都在名册里再开局"，就传 startAt:false 先入座后开机。
  if (opts.startAt !== false) room.start();
  return rig;
}

// 走满一手：轮到谁谁"看牌 + 跟注"，直到离开行动阶段
function playHand(rig: Rig): void {
  for (let step = 0; step < 200; step += 1) {
    rig.pumpAll();
    const tab = rig.turnTab();
    if (tab === null) return;
    const me = rig.viewOf(tab)?.seats.find((s) => s.seat === tab.net.info().seat);
    if (me !== undefined && !me.looked) rig.act(tab, { kind: 'look' });
    else rig.act(tab, { kind: 'call' });
  }
  throw new Error('一手牌在 200 步内没走完');
}

// 每家都看过牌之后，它自己那份牌面（room.peek 以那座的名义取投影才看得到）。
// 快照里没有裸的 rank/suit，只有 handText / handAscii 两种排版 ⇒ 负向断言必须拿文本来搜。
type LookedHand = { seat: number; text: string; ascii: string };

function lookedHands(rig: Rig): LookedHand[] {
  const out: LookedHand[] = [];
  for (const t of rig.tabs) {
    const seat = t.net.info().seat;
    const v = rig.room.peek(seat);
    const row = v?.seats.find((s) => s.seat === seat);
    if (row === undefined || row.cards === 'unknown' || !row.looked) continue;
    out.push({ seat, text: handText(row.cards), ascii: handAscii(row.cards) });
  }
  return out;
}

function settleNow(rig: Rig): void {
  rig.clock.advance(200);
  rig.pumpAll();
}

// 只重连之后新到的那几条：tab.down 是从入桌起的全量流水，直接 slice(-N) 会把 join 那一刻收到的
// 第一份 view 也算进"重连收到的消息"里 —— 那是测试自己的读数错误，不是实现的错。
function kindsFrom(tab: Tab, from: number): string[] {
  return tab.down.slice(from).map((t) => (JSON.parse(t) as { t: string }).t);
}

// 页面上那一个按钮此刻印着的金额（快照里读出来的，不是测试自己算的）
function sameAct(a: Intent, kind: Move['kind'], target?: number): boolean {
  if (a.kind !== kind) return false;
  return kind !== 'compare' || (a.kind === 'compare' && a.target === target);
}

function shownCost(tab: Tab, kind: Move['kind'], target?: number): number | null {
  const btn = tab.net.snapshot().buttons.find((b) => sameAct(b.intent, kind, target));
  return btn === undefined ? null : btn.cost;
}

// 服务端记进本局日志的最后一笔该类型事件（下行里的原始 Event，含 amount）
function bookedAmount(tab: Tab, type: string): { seq: number; amount: number } | null {
  const events = tab.net.peer.logOf().filter((e) => e.type === type && e.seat === tab.net.info().seat);
  const last = events.at(-1);
  return last === undefined ? null : { seq: last.seq, amount: last.amount };
}

// 剥掉"哪家是我"这个视角标记：结算面板的其余内容在两侧必须逐字相同
function stripWho(rows: string[]): string[] {
  return rows.map((r) => r.replace('[你]', '◎').replace('[玩家]', '◎'));
}

test('nui/01 联机快照与单机快照键集逐字一致 ⇒ 同一套 scene/paint 不必改一个字', () => {
  const rig = openRig(2);
  const a = rig.join('甲');
  rig.join('乙');
  rig.pumpAll();
  const mid = rig.snap(a);
  assert.equal(mid.phase, 'betting', '构造前提：先取一份行动阶段中的快照');
  const midScene = buildScene(mid, 960, 620, TABLE_STYLE);
  assert.ok(midScene.hits.length > 0, '行动阶段没生成按钮命中区 ⇒ 鼠标点不动');
  playHand(rig);
  settleNow(rig);
  const snap = rig.snap(a);
  assert.deepEqual(
    Object.keys(snap).sort(),
    Object.keys(soloSnapshot(EMPTY_UI)).sort(),
    '两份快照的字段集漂移了 ⇒ 渲染层就要写第二套',
  );
  const scene = buildScene(snap, 960, 620, TABLE_STYLE);
  assert.ok(scene.primitives.length > 30, '联机快照喂不进 scene 的话图元数不会这么大');
  const ids = scene.hits.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length, '命中区 id 不许重复');
  assert.equal(snap.seats.length, 2);
  assert.equal(snap.seats.filter((s) => s.role === 'human').length, 1, '本标签页只能有一家标成"你"');
  assert.equal(snap.seats.filter((s) => s.role === 'remote').length, 1, '对面那位是别的真人（remote），不是电脑');
  note(`nui/01 快照 ${String(Object.keys(snap).length)} 个字段两边一致；联机快照排版出 ${String(scene.primitives.length)} 图元 / ${String(scene.hits.length)} 命中区`);
});

test('nui/02 只有一道墙：netplay 里不得出现第二份协议实现，也不得自己判规则算钱', () => {
  // 只扫代码，不扫注释：本文件的注释里会写"不得 import legalActions / actionCost"这类自我约束，
  // 拿原文扫等于把自己的说明当成违规（test/static.test.ts 的 codeOf 同一个道理）。
  const body = readSource('webui/netplay.ts')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert.match(body, /from '\.\.\/netx\/client\.ts'/, 'netplay 没 import netx/client.ts ⇒ 它就不是那道墙');
  assert.match(body, /createPeer\(/, 'netplay 必须用 client.ts 的 createPeer 建会话');
  assert.match(body, /\.inbound\(/, '下行必须喂给 peer.inbound（schema 校验 + 投影自检 + 揭示核对都在那儿）');
  const banned = [
    /commitOf\s*\(/,
    /verifyCommit\s*\(/,
    /seedFromShares\s*\(/,
    /revealMatches\s*\(/,
    /checkDown\s*\(/,
    /checkViewLeak\s*\(/,
    /function\s+logShape/,
    /sha256/i,
    /stateHash\s*\(/,
    /legalActions/,
    /actionCost/,
    /callPrice/,
    /checkAction/,
    /\bapply\(/,
  ];
  for (const re of banned) assert.ok(!re.test(body), `netplay 里出现 ${String(re)} ⇒ 第二道墙 / 自己判规则`);
  // 反向：两条路互不知道对方存在
  assert.ok(!/from '\.\.\/netx\//.test(readSource('webmin/model.ts')), 'webmin/model.ts 反向依赖了 netx');
  assert.ok(!/from '\.\.\/netx\//.test(readSource('webui/bridge.ts')), '单机通路 webui/bridge.ts 反向依赖了 netx');
  // 正向对照：上面那些判据拿去扫一份"坏实现"必须全命中，否则本用例是空转
  const bad = [
    "import { commitOf, seedFromShares, revealMatches, verifyCommit } from '../netx/seed.ts';",
    'const c = commitOf(1, p, v) + seedFromShares(1, s) + revealMatches(1, a, b) + verifyCommit(1, p, v, c);',
    'checkDown(t); checkViewLeak(v, 0); function logShape() {} sha256Hex(x); stateHash(s);',
    'legalActions(st); actionCost(st, 0, "call"); callPrice(st, 0); checkAction(st, a); apply(st, a);',
  ].join('\n');
  const hits = banned.filter((re) => re.test(bad));
  assert.equal(hits.length, banned.length, `对照组只命中 ${String(hits.length)}/${String(banned.length)} 条`);
});

test('nui/03 两家打完两整手：看牌 / 加注 / 比牌 / 结算面板 / 第二手轮庄，两侧数字逐字一致', () => {
  const rig = openRig(2);
  const a = rig.join('甲');
  const b = rig.join('乙');
  assert.deepEqual([a.net.info().seat, b.net.info().seat], [0, 1]);
  assert.equal(rig.snap(a).handIndex, 1);

  playHand(rig);
  settleNow(rig);
  const sa = rig.snap(a);
  const sb = rig.snap(b);
  assert.equal(sa.phase, 'settled');
  assert.equal(sa.pot, sb.pot, '池额两侧不一致');
  assert.equal(sa.stake, sb.stake);
  const chipsOf = (s: Snapshot): string => s.seats.map((x) => `${String(x.seat)}:${String(x.chips)}`).join(',');
  assert.equal(chipsOf(sa), chipsOf(sb), '筹码两侧不一致');
  assert.deepEqual(stripWho(sa.settlement), sb.settlement.map((l) => l.replace('[你]', '◎').replace('[玩家]', '◎')), '结算面板两侧不一致');
  assert.equal(sa.settlement.filter((l) => l.includes('[你]')).length, 1, '自己那一行必须标 [你]');
  assert.equal(sa.settlement.filter((l) => l.includes('[玩家]')).length, 1, '别家那一行必须标 [玩家]');
  assert.equal(sb.settlement.filter((l) => l.includes('[你]')).length, 1, '对面那一侧也只能标自己为 [你]');
  assert.ok(sa.settlement.length >= 3, '结算面板至少要有结束原因 + 两家结果');
  assert.ok(sa.settlement.some((l) => l.includes('揭示核对 通过')), '结算面板要报出揭示核对的结果');
  assert.ok(sa.revealedLine.startsWith('亮牌：'), '开牌后必须给出可读的亮牌行');
  assert.equal(sa.total, 512, '两笔买入一颗不少一颗不多');
  assert.equal(a.net.info().verifiedHand, 1);
  assert.equal(b.net.info().verifiedHand, 1);
  assert.deepEqual(a.net.info().trustLines, []);

  // 第 2 手：局间停顿后轮庄推进，并走"加注 + 比牌"这条路径
  rig.clock.advance(rig.handGapMs + 1);
  rig.pumpAll();
  assert.equal(rig.snap(a).handIndex, 2, '局间停顿后该开第 2 手');
  const dealer = rig.viewOf(a)?.dealer ?? -1;
  assert.equal(dealer, 1, '轮庄：第 2 手庄家从 0 推到 1');
  assert.equal(rig.viewOf(b)?.dealer ?? -1, dealer, '两侧看到的庄家不一致');
  // 第 2 手：局间停顿后轮庄推进，并走"加注 + 比牌"这条路径。
  // 比牌受 §1 首圈禁的约束（每个在桌的人都至少动过一次才允许），所以先各自动一次再比。
  const acted = new Set<number>();
  for (let step = 0; step < 40; step += 1) {
    rig.pumpAll();
    const tab = rig.turnTab();
    if (tab === null) break;
    const other = tab === a ? b : a;
    const seat = tab.net.info().seat;
    const me = rig.viewOf(tab)?.seats.find((s) => s.seat === seat);
    if (me !== undefined && !me.looked) {
      rig.act(tab, { kind: 'look' }); // 看牌不占行动，下一轮同一家继续决策
      continue;
    }
    if (!acted.has(seat)) {
      acted.add(seat);
      rig.act(tab, acted.size === 1 ? { kind: 'raise' } : { kind: 'call' });
      continue;
    }
    rig.act(tab, { kind: 'compare', target: other.net.info().seat });
  }
  settleNow(rig);
  const s2 = rig.snap(a);
  assert.equal(s2.phase, 'settled', `第 2 手没走到结算 ${JSON.stringify({ p: s2.phase, log: s2.log.slice(-8), rj: a.net.info().lastReject, rj2: b.net.info().lastReject, u: a.net.info().untrusted })}`);
  assert.ok(s2.log.some((l) => l.includes('compare')), `日志里应有比牌事件：${s2.log.join(' ⏎ ')}`);
  assert.ok(s2.log.some((l) => l.includes('raise')), '日志里应有加注事件');
  assert.equal(a.net.info().untrusted, false, '第 2 手不许冒出越界');
  assert.equal(rig.room.info().fault, null);
  const total = rig.room.info().chips.reduce((x, c) => x + c.chips, 0) + rig.room.info().pot;
  assert.equal(total, 512, '两整手之后台账守恒');
  note(`nui/03 两整手：第 1 手池 ${String(sa.pot)}，第 2 手庄家=座位${String(dealer)}，终局台账 ${String(total)}`);
});

test('nui/04 负向：没看牌时本人牌不在快照里，别家牌面全程不出现', () => {
  // startAt:false ⇒ 三家都坐进名册之后再开局。默认是"两家到齐就发牌"，第三家会掉到第 2 手，
  // 本用例要的"三家同局、挨家核对彼此牌面"就构造不出来。
  const rig = openRig(3, { startAt: false });
  const a = rig.join('甲');
  const b = rig.join('乙');
  const c = rig.join('丙');
  rig.start();
  rig.pumpAll();
  assert.deepEqual([a, b, c].map((t) => t.net.info().hand), [1, 1, 1], '构造前提：三家在同一手里，否则彼此牌面根本无从泄漏');
  // ① 谁都没看牌：整棵快照里不该出现任何一张牌（既不该有裸的 rank/suit 结构，也不该有牌面文本）
  const first = rig.snap(a);
  assert.equal(first.seats.length, 3, '构造前提：三家都该在座位环上（hello 里的名册会随入座刷新）');
  assert.ok(first.seats.every((s) => s.hidden), '构造前提：谁都没看牌');
  assert.ok(!rig.text(a).includes('"rank"'), '未看牌时快照里出现了 rank ⇒ 牌面已经上了页面');
  assert.ok(!/[2-9TJQKA][♠♥♣♦]/.test(rig.text(a)), '未看牌时快照里出现了牌面文本 ⇒ 投影之外的来源');
  assert.ok(rig.text(a).includes('···'), '本人那格该是占位符');

  // ② 三家挨个看牌 + 跟注：每家只能看见自己那份，别家那份在谁的快照里都不许出现
  for (let round = 0; round < 3; round += 1) {
    rig.pumpAll(); // 别家的视图也要追上来，否则 turnTab() 读的是过期 seq 里的"轮到谁"
    const tab = rig.turnTab();
    if (tab === null) break;
    rig.act(tab, { kind: 'look' });
    rig.act(tab, { kind: 'call' });
  }
  const hands = lookedHands(rig);
  assert.equal(hands.length, 3, `三家都该看过牌，实得 ${String(hands.length)} 家`);
  assert.equal(new Set(hands.map((h) => h.text)).size, 3, '构造前提：三家的牌面互不相同，否则下面的搜索没有区分力');
  for (const viewer of rig.tabs) {
    const text = rig.text(viewer);
    const mine = viewer.net.info().seat;
    for (const h of hands) {
      const visible = h.seat === mine;
      if (visible) assert.ok(text.includes(h.text), `座位${String(mine)} 的快照里应当看得见自己看过的牌 ${h.text}`);
      else assert.ok(!text.includes(h.text) && !text.includes(h.ascii), `别家（座位${String(h.seat)}）的牌面泄漏进了座位${String(mine)} 的快照`);
    }
  }
  // ③ 正向对照：等这一手强制开牌之后，三家的牌面必须都出现在每一家的快照里
  playHand(rig);
  settleNow(rig);
  const after = lookedHands(rig);
  assert.equal(after.length, 3);
  for (const viewer of rig.tabs) {
    const text = rig.text(viewer);
    for (const h of after) assert.ok(text.includes(h.text), `开牌之后仍缺座位${String(h.seat)} 的牌面 ${h.text}`);
  }
  assert.equal(rig.snap(a).seats.filter((s) => !s.hidden).length, 3, '开牌之后三格都该亮');
  note('nui/04 未看牌 / 别家牌面 / 开牌之后三个阶段各自都拿整棵快照搜过（含正、反向对照）');
});

test('nui/05 伪造下行：当场标"不可信"并停手；leak_blocked 与 replaced 的提示可区分', () => {
  const rig = openRig(2);
  const a = rig.join('甲');
  const b = rig.join('乙');
  const view = rig.viewOf(a);
  assert.ok(view !== null);
  const other = (view?.seats.find((s) => s.seat !== a.net.info().seat) as { seat: number }).seat;
  const poisoned = {
    t: 'patch',
    hand: a.net.info().hand,
    since: view?.seq ?? 0,
    seq: (view?.seq ?? 0) + 1,
    view: {
      ...view,
      seq: (view?.seq ?? 0) + 1,
      log: [],
      seats: (view?.seats ?? []).map((s) =>
        s.seat === other ? { ...s, cards: [{ rank: 14, suit: 0 }, { rank: 13, suit: 1 }, { rank: 12, suit: 2 }] } : s,
      ),
    },
  };
  assert.deepEqual(a.net.info().trustLines, [], '注入之前不该有越界');
  a.net.onText(JSON.stringify(poisoned));
  const info = a.net.info();
  assert.equal(info.untrusted, true, '越界下行没被认出来');
  assert.ok(info.trustLines.some((l) => l.includes('这一局不可信')), `要有"这一局不可信"的明示：${info.trustLines.join(' / ')}`);
  assert.ok(info.trustLines.some((l) => l.includes('已停手')), '还要明说已经停手');
  for (const move of [{ kind: 'call' } as Move, { kind: 'fold' } as Move, { kind: 'look' } as Move]) {
    const r = a.net.act(move);
    assert.equal(r.sent, false, `停手之后还发得出 ${move.kind}`);
    assert.match(r.why ?? '', /peer flagged the server/);
  }
  const snap = a.net.snapshot();
  assert.equal(snap.buttons.length, 1, '停手后按钮条该只剩一条说明');
  assert.equal(snap.buttons[0]?.legal, false, '那条说明必须是灰的');
  assert.match(String(snap.buttons[0]?.text), /已停手/);
  assert.match(String(snap.note), /不可信/);
  // 停手这件事必须铺到日志区（一行标题塞不下三条话；变异 B02 就是"只留标题"这一种偷懒）
  assert.match(snap.log[0] ?? '', /这一局不可信/, '越界提示必须是日志区的第一行');
  assert.ok(snap.log.some((l) => l.includes('已停手')), '日志区要写明白"已经停手"');
  assert.ok(snap.log.some((l) => l.startsWith('#')), '越界提示是**附加**在真实日志之前，不是把日志整段换掉');
  assert.ok(buildScene(snap, 960, 620, TABLE_STYLE).primitives.length > 0, '停手状态在牌桌上排不出版');
  assert.equal(b.net.info().untrusted, false, '别家的会话不该被牵连');

  // 两类 error 的可区分反馈
  const rig2 = openRig(2);
  const x = rig2.join('甲');
  const y = rig2.join('乙');
  x.net.onText('{"t":"error","code":"leak_blocked","why":"cards of seat 1 exposed"}');
  y.net.onText('{"t":"error","code":"replaced","why":"another connection took over this seat"}');
  const leakLines = x.net.info().trustLines;
  const replLines = y.net.info().trustLines;
  assert.ok(leakLines.some((l) => l.includes('服务端承认自己漏了牌')), JSON.stringify(leakLines));
  assert.ok(replLines.some((l) => l.includes('已被另一个连接接管')), JSON.stringify(replLines));
  assert.notDeepEqual(leakLines, replLines, '两类反馈的文案不能长成一样');
  assert.equal(y.net.info().untrusted, false, '被顶号是连接层的事，不该把整局判成不可信');
  assert.equal(x.net.info().untrusted, true, '服务端承认漏牌 ⇒ 必须判不可信');
  note('nui/05 三类可见反馈各自可辨认：伪造下行→停手；leak_blocked→漏牌；replaced→顶号');
});

test('nui/06 断线重连：增量与快照两条路都真走到，台账一颗不错', () => {
  const rig = openRig(2, { settleMs: 200, handGapMs: 60000 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.pumpAll();
  const totalBefore = rig.snap(a).total;
  assert.equal(totalBefore, 512, '构造前提：两笔买入共 512');
  assert.equal(rig.snap(a).phase, 'betting', '构造前提：两家已进第 1 手');

  // ① 只是 socket 断了（页面没刷新）⇒ 同一份会话凭 token 回来，seq 对得上 ⇒ 增量
  const seqAtDrop = a.net.info().seq;
  assert.ok(seqAtDrop >= 1, '至少已经看过一条局面消息');
  rig.room.close(a.conn);
  a.net.markClosed();
  const t = rig.turnTab();
  if (t !== null) rig.act(t, { kind: 'call' }); // 别人先动一步，制造"我漏掉的那几条"
  const fresh = 't9';
  const mark1 = a.down.length;
  rig.room.open(fresh);
  const resume = a.net.resumeWire();
  assert.ok(resume !== null, '拿过 token 就该能构造 resume');
  rig.room.receiveText(fresh, resume);
  a.conn = fresh;
  a.net.markOpen();
  rig.pump(a);
  const k1 = kindsFrom(a, mark1);
  assert.ok(k1.includes('patch'), `重连应当只补增量，实得 ${JSON.stringify(k1)}`);
  assert.ok(!k1.includes('view'), 'seq 对得上却发全量快照 ⇒ 增量那条路等于没走');
  assert.equal(a.net.info().seq > seqAtDrop, true, '增量必须把我追到当前');
  assert.deepEqual(a.net.info().trustLines, [], '重连之后不该冒出越界');
  assert.equal(rig.snap(a).total, totalBefore, '重连把台账改了 ⇒ 重复扣或凭空增');

  // ② 页面刷新（内存全丢，只剩存储）：仍在同一局 ⇒ 它只能老实报 since=0，服务端把整段日志补回来。
  //    报一个记忆里的 seq 会先撞上客户端自己那道"增量必须接得上号"的闸，所以这一路是 (0,seq] 的增量。
  const reloaded: Tab = {
    net: createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x77e), store: a.store }),
    store: a.store,
    conn: 't10',
    name: '甲',
    down: [],
  };
  rig.room.open(reloaded.conn);
  const r2 = reloaded.net.resumeWire();
  assert.ok(r2 !== null, '刷新后凭存储里的 token 也要能重连');
  assert.match(r2, /"since":0/, '刷新后的这一页一条都没看过，不许谎报 seq');
  rig.room.receiveText(reloaded.conn, r2);
  reloaded.net.markOpen();
  const mark2 = reloaded.down.length;
  rig.pump(reloaded);
  const k2 = kindsFrom(reloaded, mark2);
  assert.ok(k2.includes('patch'), `同一局内刷新该由增量补全，实得 ${JSON.stringify(k2)}`);
  const back = rig.snap(reloaded);
  assert.ok(back.log.length >= 1, `整段本局日志都要补回来，实得 ${String(back.log.length)} 条`);
  assert.deepEqual(reloaded.net.info().trustLines, [], '刷新重建之后仍然零越界');
  assert.equal(back.total, totalBefore, '刷新重连不该动台账');
  assert.equal(a.net.info().link, 'open');
  // 同一个 token 被新连接接管 ⇒ 旧那条已被服务端摘掉座位，留着只会让 playHand 对着空气行动
  rig.tabs.splice(rig.tabs.indexOf(a), 1);
  const hand1Record = String(a.store.map.get('zjh-m5:session'));
  rig.tabs.push(reloaded);

  // ③ 收尾：把第 1 手打完，刷新回来的这一家仍然核对通过
  playHand(rig);
  settleNow(rig);
  assert.equal(
    reloaded.net.info().verifiedHand,
    1,
    `刷新之后没能核对揭示 ${JSON.stringify(reloaded.net.peer.info().violations)} ${JSON.stringify(kindsFrom(reloaded, 0))}`,
  );
  assert.equal(b.net.info().verifiedHand, 1);
  assert.equal(rig.room.info().chips.reduce((s, c) => s + c.chips, 0) + rig.room.info().pot, 512, '第 1 手后台账不守恒');

  // ④ 全量快照那条路：第 2 手已经开局，而这一页存着的凭据停在第 1 手（关着标签页错过了一整手）。
  //    hand 对不上 ⇒ 服务端不能补增量，只能给整份快照。
  rig.clock.advance(rig.handGapMs + 1);
  rig.pumpAll();
  assert.equal(rig.snap(b).handIndex, 2, '构造前提：已进入第 2 手');
  const staleStore = makeStore();
  staleStore.set('zjh-m5:session', hand1Record);
  const late: Tab = {
    net: createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x1ade), store: staleStore }),
    store: staleStore,
    conn: 't11',
    name: '甲',
    down: [],
  };
  rig.room.open(late.conn);
  const r4 = late.net.resumeWire();
  assert.ok(r4 !== null && /"hand":1/.test(r4), '过期凭据报的是它看到的第 1 手');
  rig.room.receiveText(late.conn, r4);
  late.net.markOpen();
  rig.tabs.push(late);
  rig.pumpAll(); // 第 2 手的行动推进一次 ⇒ 服务端才会下发这一家的局面
  const t2 = rig.turnTab();
  if (t2 !== null) rig.act(t2, { kind: 'call' });
  rig.pumpAll();
  const k4 = kindsFrom(late, 0);
  assert.ok(k4.includes('view'), `跨局重连该给全量快照，实得 ${JSON.stringify(k4)}`);
  assert.ok(!k4.includes('patch'), '对不上号的 seq 绝不能走增量（那会把半截日志当成全部）');
  assert.equal(late.net.info().hand, 2, '快照要把它追到当前这手');
  assert.deepEqual(late.net.info().trustLines, [], '跨局重连也不该冒出越界');
  assert.equal(rig.snap(late).total, 512, '重连之后台账仍然守恒');
  note('nui/06 三条重连形状各自真实走到：断线→(seq,now] 增量、同局刷新→(0,now] 增量、跨局→全量快照；台账全程守恒 512');
});

test('nui/07 同一浏览器两个标签页各占一座：per-tab 存储互不覆盖；共享存储会翻车（对照）', () => {
  const rig = openRig(2);
  const t1 = rig.join('甲');
  const t2 = rig.join('乙');
  rig.pumpAll();
  assert.deepEqual([t1.net.info().seat, t2.net.info().seat], [0, 1]);
  const s1 = t1.store.map.get('zjh-m5:session');
  const s2 = t2.store.map.get('zjh-m5:session');
  assert.ok(s1 !== undefined && s2 !== undefined, '两个标签页都该留下自己的凭据');
  assert.notEqual(s1, s2, '两份 per-tab 存储里的凭据不该相同');
  assert.ok(t1.net.resumeWire() !== null && t2.net.resumeWire() !== null, '两边都该能凭自己的凭据重连');

  // 反面：两份页面挂到同一个全局存储（localStorage 语义）⇒ 后入座的把先入座的凭据覆盖了
  const shared = makeStore();
  const rig2 = openRig(2);
  const p1 = rig2.join('甲', shared);
  const p2 = rig2.join('乙', shared);
  rig2.pumpAll();
  assert.equal(p1.store.map.get('zjh-m5:session'), p2.store.map.get('zjh-m5:session'), '共享存储下第二次 join 必然覆盖第一份');
  const hijacked = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x21), store: shared });
  const wire = hijacked.resumeWire();
  assert.ok(wire !== null);
  rig2.room.open('c-shared');
  rig2.room.receiveText('c-shared', wire as string);
  const got = rig2.room.pending('c-shared').map((m) => JSON.stringify(m));
  const seat = got.map((g) => (JSON.parse(g) as { seat?: number }).seat).find((x) => typeof x === 'number');
  assert.equal(seat, p2.net.info().seat, '共享存储 ⇒ 第一个标签页被接到了第二个的座位上（工单点的那次翻车）');
  note(`nui/07 per-tab 存储各占一座；换成共享存储时"甲"被接回座位${String(seat)}（=乙的座位）`);
});

test('nui/08 超时托管一路带到 UI：日志行里就是 timeout→call 的字样', () => {
  const rig = openRig(2, { turnMs: 500, settleMs: 200, handGapMs: 60000 });
  const a = rig.join('甲');
  rig.join('乙');
  rig.pumpAll();
  rig.clock.advance(500 * 6 + 200);
  rig.pumpAll();
  const snap = rig.snap(a);
  assert.equal(snap.phase, 'settled', '全员托管也该走完这一手');
  const timed = snap.log.filter((l) => l.includes('timeout→'));
  assert.equal(timed.length, 6, `日志里该有六条托管痕迹：${snap.log.join(' ⏎ ')}`);
  assert.ok(timed.every((l) => l.includes('timeout→call')), '托管痕迹必须是"跟注"而不是弃牌（Q4=B）');
  assert.ok(snap.settlement.some((l) => l.includes('强制开牌')), `结算面板要写清终局原因：${snap.settlement.join(' ⏎ ')}`);
  assert.equal(a.net.info().untrusted, false);
  note(`nui/08 UI 日志里 ${String(timed.length)} 条 timeout→call；末条：${timed[5] ?? ''}`);
});

test('nui/09 按钮：可用性只看服务端 phase/turn；金额来自引擎那一处算术且只进文案（Q6=A2）', () => {
  const rig = openRig(3, { startAt: false });
  const a = rig.join('甲');
  rig.join('乙');
  rig.join('丙');
  rig.start();
  rig.pumpAll();
  const view = rig.viewOf(a);
  assert.ok(view !== null && view.turn !== a.net.info().seat, '构造前提：第 1 手不从甲开始');
  const idle = rig.snap(a);
  assert.equal(idle.buttons.length, 1);
  assert.equal(idle.buttons[0]?.legal, false, '不轮到你时不许出现可点按钮');
  const r = a.net.act({ kind: 'fold' });
  assert.equal(r.sent, false, '不轮到自己却把行动发了出去');
  assert.match(r.why ?? '', /turn is seat/);

  const tab = rig.turnTab() as Tab;
  const snap = rig.snap(tab);
  const kindsOf = [...new Set(snap.buttons.map((x) => x.intent.kind))].sort();
  assert.deepEqual(kindsOf, ['call', 'compare', 'fold', 'look', 'raise'], `轮到自己该有的意图不齐：${kindsOf.join(',')}`);
  assert.ok(snap.buttons.every((x) => x.legal), '轮到自己时所有候选都可点（合法性由服务端 reject 决定）');
  assert.ok(snap.buttons.every((x) => x.cost !== null), '裁定 A2 之后联机侧按钮也要印出金额');
  const v = rig.viewOf(tab) as NonNullable<ReturnType<Rig['viewOf']>>;
  const me = v.seats.find((s) => s.seat === tab.net.info().seat) as { looked: boolean };
  for (const btn of snap.buttons) {
    const mv = toMove(btn.intent);
    assert.ok(mv !== null, `${btn.intent.kind} 不是五种行动之一`);
    const want = priceOf(mv.kind, v.stake, me.looked, v.rules);
    assert.equal(btn.cost, want, `${btn.intent.kind} 按钮上的金额与 priceOf 不一致`);
  }
  const activeOthers = (rig.viewOf(tab)?.seats ?? []).filter((x) => x.active && x.seat !== tab.net.info().seat).length;
  assert.ok(activeOthers >= 1, '构造前提：至少还剩一个 active 对手');
  assert.equal(
    snap.buttons.filter((x) => x.intent.kind === 'compare').length,
    activeOthers,
    '比牌候选必须正好等于服务端投影里 active 的对手数（不多不少，也不自己判合法性）',
  );
  // 服务端 reject 的原文要能显示出来：点一个此刻必然被拒的（不轮到自己那一家）
  const wrong = rig.tabs.find((x) => x !== tab) as Tab;
  const refused = wrong.net.act({ kind: 'call' });
  assert.equal(refused.sent, false);
  note('nui/09 按钮只列候选意图；cost 恒 null；不轮到自己时全灰且发不出去');
});

test('nui/10 刷新之后仍能核对揭示：份额必须随凭据一起存下来', () => {
  const rig = openRig(3, { settleMs: 200, handGapMs: 60000, startAt: false });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.join('丙');
  rig.start();
  rig.pumpAll();
  const share = a.net.peer.shareOf();
  assert.ok(share !== null && share.length >= 8, '构造前提：本局份额已生成');
  const saved = JSON.parse(String(a.store.map.get('zjh-m5:session'))) as { share: string | null; token: string; hand: number };
  assert.equal(saved.share, share, '刷新前必须把本局份额存进每标签页存储');
  assert.ok(saved.token.length >= 20);
  assert.equal(saved.hand, 1);

  // 只留存储，重建整个会话
  const reloaded = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x9e7), store: a.store });
  const wire = reloaded.resumeWire();
  assert.ok(wire !== null);
  const up = JSON.parse(wire) as { t: string; hand: number; since: number };
  assert.deepEqual([up.t, up.hand, up.since], ['resume', 1, 0], '刷新后该报"这一局我看到第 0 条"，不能谎报 seq');
  rig.room.open('r10');
  rig.room.receiveText('r10', wire);
  reloaded.markOpen();
  const tab: Tab = { net: reloaded, store: a.store, conn: 'r10', name: '甲', down: [] };
  rig.pump(tab);
  for (const t of tab.down.filter((x) => (JSON.parse(x) as { t: string }).t === 'collect')) {
    const missing = (JSON.parse(t) as { missing: string[] }).missing;
    assert.ok(!missing.includes('seat:0'), '重连后服务端还问我收份额 ⇒ 局末会误报越界');
  }
  rig.tabs.push(tab);
  playHand(rig);
  settleNow(rig);
  assert.equal(reloaded.info().verifiedHand, 1, '刷新之后核对揭示必须仍然通过（份额没存住就会误报）');
  assert.deepEqual(reloaded.info().trustLines, [], '刷新重连不该冒出任何越界');
  assert.equal(b.net.info().verifiedHand, 1);
  note('nui/10 份额随凭据存住 ⇒ 刷新重连后局末核对照样通过，且服务端不再向它重复收份额');
});

// —————————————————————— Q6=A2：价格接缝（ANSWERS.md 第六轮 (a)–(d)）——————————————————————

// 行动前先读页面上印着的数，行动后读服务端记进本局日志的那笔 amount。
// 两个数来自两个独立来源（页面派生 vs 服务端事件流），却是同一处算术 ⇒ 这才叫对账。
function probe(rig: Rig, tab: Tab, move: Move): { kind: string; stake: number; looked: boolean; shown: number | null; priced: number; booked: number | null } {
  const v = rig.viewOf(tab) as NonNullable<ReturnType<Rig['viewOf']>>;
  const seat = tab.net.info().seat;
  const me = v.seats.find((s) => s.seat === seat) as { looked: boolean };
  const shown = shownCost(tab, move.kind, move.kind === 'compare' ? move.target : undefined);
  const priced = priceOf(move.kind, v.stake, me.looked, v.rules);
  rig.act(tab, move);
  const got = bookedAmount(tab, move.kind);
  return { kind: move.kind, stake: v.stake, looked: me.looked, shown, priced, booked: got === null ? null : got.amount };
}

test('nui/11 (a) 端到端价格一致性：行动前页面显示的 cost === 行动后 log 里那条事件的 amount（跟/加/比各一次）', () => {
  const rig = openRig(2, { startAt: false });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.start();
  rig.pumpAll();
  // 首圈：两家各先亮牌再跟注（§1 首圈禁比 ⇒ 比牌要等到人人都动过）
  for (let round = 0; round < 4; round += 1) {
    rig.pumpAll();
    const tab = rig.turnTab();
    if (tab === null) break;
    const seat = tab.net.info().seat;
    const me = rig.viewOf(tab)?.seats.find((s) => s.seat === seat);
    if (me !== undefined && !me.looked) rig.act(tab, { kind: 'look' });
    else rig.act(tab, { kind: 'call' });
  }
  const rows: ReturnType<typeof probe>[] = [];
  const wants: Move[] = [{ kind: 'raise' }, { kind: 'call' }, { kind: 'compare', target: -1 }];
  for (const want of wants) {
    rig.pumpAll();
    const tab = rig.turnTab();
    if (tab === null) break;
    if (want.kind === 'compare') {
      const other = tab === a ? b : a;
      want.target = other.net.info().seat;
    }
    rows.push(probe(rig, tab, want));
  }
  assert.equal(rows.length, 3, `跟/加/比三种各来一次没凑齐，实得 ${rows.map((r) => r.kind).join(',')}`);
  for (const r of rows) {
    assert.notEqual(r.shown, null, `${r.kind} 那一个按钮在页面上没印金额`);
    assert.notEqual(r.booked, null, `${r.kind} 之后日志里找不到这笔事件`);
    assert.equal(r.shown, r.priced, `${r.kind}：页面显示的数与 priceOf 的输出口径不一致`);
    assert.equal(r.shown, r.booked, `${r.kind}：页面显示 ${String(r.shown)}，服务端记账 ${String(r.booked)}（注级 ${String(r.stake)}，${r.looked ? '明' : '闷'}）`);
  }
  assert.ok(rows.some((r) => (r.shown ?? 0) > 0), '构造前提：至少有一笔是真要花钱的');
  note(`nui/11 (a) 三种行动各自对账通过：${rows.map((r) => `${r.kind}=${String(r.shown)}@注级${String(r.stake)}`).join(' / ')}`);
});

test('nui/12 (b) 闷/明差价在页面上看得见，且两个数都等于 priceOf 的输出（不是测试里手写的常量）', () => {
  const rig = openRig(2);
  const a = rig.join('甲');
  rig.join('乙');
  rig.pumpAll();
  // 等到甲那一格轮到它
  for (let step = 0; step < 8 && rig.turnTab() !== a; step += 1) {
    const tab = rig.turnTab();
    if (tab === null) break;
    rig.act(tab, { kind: 'call' });
    rig.pumpAll();
  }
  assert.equal(rig.turnTab(), a, '构造前提：轮到甲');
  const v = rig.viewOf(a) as NonNullable<ReturnType<Rig['viewOf']>>;
  const dark = shownCost(a, 'call') as number;
  assert.equal(dark, priceOf('call', v.stake, false, v.rules), '闷着的时候页面金额不等于 priceOf(…, looked=false, …)');
  assert.match(String(a.net.snapshot().buttons.find((x) => x.intent.kind === 'call')?.text), /出 \d+/, '跟注按钮没把金额印进文案');
  rig.act(a, { kind: 'look' });
  const v2 = rig.viewOf(a) as NonNullable<ReturnType<Rig['viewOf']>>;
  const seen = shownCost(a, 'call') as number;
  assert.equal(seen, priceOf('call', v2.stake, true, v2.rules), '看牌之后页面金额不等于 priceOf(…, looked=true, …)');
  assert.ok(v.rules.bet.dark !== v.rules.bet.seen, '构造前提：这套 presets 的闷/明乘数本来就不同');
  assert.notEqual(dark, seen, `同一个按钮在亮牌前后必须显示不同的数（实得 ${String(dark)} / ${String(seen)}）`);
  assert.equal(seen > dark, true, '明注比闷注贵 —— 反过来的话乘数被换掉了');
  assert.equal(a.net.snapshot().buttons.filter((x) => x.legal).every((x) => x.intent.kind !== 'settle'), true, '联机侧不该出现推进类按钮');
  note(`nui/12 (b) 注级 ${String(v.stake)}：闷 ${String(dark)} → 明 ${String(seen)}，两个数都由 priceOf 现算`);
});

test('nui/13 (c) 买不起跟价的座位：按钮仍然可点、发得出去，代价由服务端 reject 送回来并被页面显示', () => {
  const rig = openRig(2, { startAt: false, minBuyIn: 1 });
  const poor = rig.join('穷', undefined, 6);
  const rich = rig.join('富', undefined, 256);
  rig.start();
  rig.pumpAll();
  // 策略：富人一直加注把注级顶上去，穷人一直跟 ⇒ 便宜地到达"跟价 > 筹码"那一格
  let stuck = { price: 0, chips: 0 };
  for (let step = 0; step < 30; step += 1) {
    rig.pumpAll();
    const tab = rig.turnTab();
    if (tab === null) break;
    const seat = tab.net.info().seat;
    const v = rig.viewOf(tab) as NonNullable<ReturnType<Rig['viewOf']>>;
    const me = v.seats.find((s) => s.seat === seat) as { looked: boolean; chips: number };
    const price = priceOf('call', v.stake, me.looked, v.rules);
    if (tab === poor && price > me.chips) {
      stuck = { price, chips: me.chips };
      break;
    }
    if (!me.looked) rig.act(tab, { kind: 'look' });
    else if (tab === rich) rig.act(tab, { kind: 'raise' });
    else rig.act(tab, { kind: 'call' });
  }
  assert.ok(stuck.price > stuck.chips, `没构造出"买不起跟价"的那一格（实得 price=${String(stuck.price)} chips=${String(stuck.chips)}）`);
  const snap = poor.net.snapshot();
  const callBtn = snap.buttons.find((x) => x.intent.kind === 'call');
  assert.ok(callBtn !== undefined, '轮到它却没有跟注按钮 ⇒ 后面的断言没有对象');
  assert.equal(callBtn?.legal, true, '页面自己判了"买不起 ⇒ 禁用" —— ③ 明令禁止这条路');
  assert.equal(callBtn?.cost, stuck.price, '按钮上印的正是那笔它付不起的价');
  const chipsBefore = (rig.viewOf(poor)?.seats.find((s) => s.seat === poor.net.info().seat) as { chips: number }).chips;
  const r = poor.net.act({ kind: 'call' });
  assert.equal(r.sent, true, '客户端自己把这一击拦下了 ⇒ 判规则的地方多了一处');
  rig.room.receiveText(poor.conn, r.wire as string);
  rig.pump(poor);
  const rejected = poor.net.info().lastReject;
  assert.ok(rejected !== null, '服务端没把 reject 送回来');
  assert.equal(rejected?.code, 'cannot_afford', `reject 口径不对：${JSON.stringify(rejected)}`);
  assert.match(poor.net.snapshot().note ?? '', /服务端拒绝/, 'reject 没上到牌桌上那条警告位');
  assert.match(poor.net.snapshot().note ?? '', /only fold is legal/, '警告位应当把服务端原话带出来');
  const after = poor.net.snapshot();
  assert.equal(after.buttons.find((x) => x.intent.kind === 'call')?.legal, true, '被拒之后页面把它自己禁用了 ⇒ 又变成自己判规则');
  assert.equal((rig.viewOf(poor)?.seats.find((s) => s.seat === poor.net.info().seat) as { chips: number }).chips, chipsBefore, '被拒的这一击不该已经扣钱');
  assert.equal(rig.room.info().fault, null);
  assert.equal(rich.net.info().untrusted, false);
  assert.equal(poor.net.info().untrusted, false, '被 reject 是一次普通拒绝，不该把整局判成不可信');
  note(`nui/13 (c) 穷座筹码 ${String(stuck.chips)} 对 ${String(stuck.price)} 的跟价：仍可点、发得出、服务端拒、页面照实说`);
});

test('nui/14 (d) 同一条按钮契约两条路共用一处算术：单机 buttonOptions 的 cost 与联机 buttonRow 的 cost 相等', () => {
  const nameOf = (seat: number): string => `座位${String(seat)}`;
  let u = soloStart(EMPTY_UI, { bots: 2, buyIn: 256, baseSeed: 20260928, presetName: 'classic', dealerNext: 'rotate' });
  const triples = new Set<string>();
  let compared = 0;
  const plan: Intent[] = [{ kind: 'look' }, { kind: 'call' }, { kind: 'raise' }, { kind: 'call' }, { kind: 'look' }, { kind: 'compare', target: 2 }];
  for (let step = 0; step < plan.length; step += 1) {
    const s = u.session as Session;
    if (s.state.phase === 'betting' && s.state.turn === s.humanSeat) {
      const view = project(s.state, s.humanSeat);
      const solo = soloSnapshot(u).buttons.filter((x) => x.legal && x.cost !== null);
      const online = buttonRow(view, s.humanSeat, nameOf);
      for (const b of solo) {
        const twin = online.find((x) => sameAct(x.intent, b.intent.kind as Move['kind'], b.intent.kind === 'compare' ? b.intent.target : undefined));
        if (twin === undefined) continue; // reset / 无目标比牌这类只有单机一侧列
        assert.notEqual(twin.cost, null, `联机侧 ${b.intent.kind} 没有金额 ⇒ 两条路的契约不一样形`);
        assert.equal(twin.cost, b.cost, `注级 ${String(view.stake)}、${view.seats.find((x) => x.seat === s.humanSeat)?.looked ? '明' : '闷'}：单机 ${String(b.cost)} vs 联机 ${String(twin.cost)}`);
        triples.add(`${b.intent.kind}:${String(view.stake)}:${String(twin.cost)}`);
        compared += 1;
      }
    }
    u = soloDrain(soloDispatch(u, plan[step] as Intent));
  }
  assert.ok(compared >= 8, `只对账了 ${String(compared)} 次，太少 ⇒ 这条断言接近空转`);
  assert.ok(triples.size >= 4, `覆盖的 (动作,注级,金额) 组合只有 ${String(triples.size)} 种：${[...triples].join(' / ')}`);
  assert.equal(u.session === null, false, '单机那一条路被这些点击打挂了');
  note(`nui/14 (d) 两条路对同一 state 逐按钮相等：${String(compared)} 次、${String(triples.size)} 种组合`);
});

test('nui/15 意图 → 动作的收窄：只有五种真行动能上协议线，推进类意图一律 null', () => {
  const moves: Move[] = [{ kind: 'look' }, { kind: 'call' }, { kind: 'raise' }, { kind: 'fold' }, { kind: 'compare', target: 2 }];
  for (const m of moves) assert.deepEqual(toMove(m), m, `${m.kind} 本该原样成为一条 Move`);
  for (const kind of ['settle', 'nextHand', 'reset']) {
    assert.equal(toMove({ kind } as Intent), null, `${kind} 是单机页面自己推进的意图，联机侧不许发`);
  }
  const carried = toMove({ kind: 'compare', target: -1 } as Intent);
  assert.ok(carried !== null && carried.kind === 'compare', '比牌意图应当原样成为一条 Move');
  assert.equal(carried.target, -1, '比牌目标要原样带过去，不许在这里被改写');
});

test('nui/18 凭据作废（房间重启后 token 不认）⇒ 清存储 + 说清楚 + 自动补一条全新 join，页面不许停在"已连接、零下行"', () => {
  // 真浏览器实测撞到的死局：页面带着上一世（进程已重启）的 token 去 resume，服务端回 bad_token，
  // 而页面既不回落成 join、也不显示原因 ⇒ "联机·已连接"却永远没有局面。
  // 分两层钉：(a) netplay 自己必须**产出**那条 join（传输层只是管道，所以这里能被无头钉住）；
  //         (b) 一根哑管道串上房间之后，整条链路真的能把座位拿回来并收到局面。
  const rig = openRig(2);
  const a = rig.join('甲');
  rig.join('乙');
  rig.pumpAll();
  assert.equal(a.net.info().hand, 1, '构造前提：已经开了一手，凭据里才有一个可接续的局号');
  const record = String(a.store.map.get('zjh-m5:session'));
  const token = String(JSON.parse(record).token);

  // ———— (a) 单元级：喂一条 bad_token，看这一层交出什么上行 ————
  const s1 = makeStore();
  s1.set('zjh-m5:session', record);
  const u = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0xba7e), store: s1 });
  const ups = u.onText(JSON.stringify({ t: 'error', code: 'bad_token', why: 'unknown resume token' }));
  assert.deepEqual(ups.map((x) => (JSON.parse(x) as { t: string }).t), ['join'], 'onText 必须自己产出那条全新的 join（否则就得靠传输层写分支，那里钉不住）');
  assert.equal(u.info().staleToken, true, '服务端说不认这个 token，这一层没认出来');
  assert.equal(u.info().hasToken, false, '作废的凭据必须从存储里丢掉，否则每次刷新都重蹈一次');
  assert.equal(u.resumeWire(), null, '凭据已作废 ⇒ 不许再自称有可重连的凭据');
  assert.ok(
    u.info().trustLines.some((l) => l.includes('凭据已作废') && l.includes('重新入桌')),
    `要把话说清楚：${JSON.stringify(u.info().trustLines)}`,
  );
  assert.equal(u.info().untrusted, false, 'token 不认是连接层的事，不该把整局判成不可信');
  // 同一条错误再来一次：提示可以重申，但绝不发第二条 join（防被坏服务端拖成 join 洪水）
  assert.deepEqual(u.onText(JSON.stringify({ t: 'error', code: 'bad_token', why: 'again' })), [], '自动重入桌只能有一次');

  // ———— (b) 端到端：换一台全新房间（熵种子不同 ⇒ 它发不出同一份 token），只接一根哑管道 ————
  const rig2 = openRig(2, { startAt: false, entropySeed: 0xc0ffee });
  const s2 = makeStore();
  s2.set('zjh-m5:session', record);
  const revived: Tab = {
    net: createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0xba7f), store: s2 }),
    store: s2,
    conn: 't20',
    name: '甲',
    down: [],
  };
  rig2.room.open(revived.conn);
  const wire = revived.net.resumeWire();
  assert.ok(wire !== null && wire.includes(token.slice(0, 12)), '构造前提：它先拿旧凭据去 resume');
  revived.net.markOpen();
  rig2.room.receiveText(revived.conn, wire);
  rig2.pump(revived); // pump 就是把 onText 的返回值原样发回去 —— 与 socket 那端同一种哑管道
  assert.ok(revived.net.info().seat >= 0, '自动重入桌之后该有座位');
  assert.equal(revived.net.info().staleToken, false, 'hello 回来了，提示就该消掉，不许一直挂着"正在重新入桌"');
  const fresh = JSON.parse(String(s2.map.get('zjh-m5:session'))) as { token: string };
  assert.notEqual(fresh.token, token, '新凭据应当是这台房间给的那一份');

  // 死局的判据是"永远零下行"，所以要真开一手再验
  const mate = rig2.join('乙');
  rig2.tabs.push(revived); // 这一页是自己攒出来的，不推进环线就永远没人替它取件（工装细节，不是产品行为）
  rig2.start();
  rig2.pumpAll();
  assert.equal(revived.net.info().seq > 0, true, `重新入桌之后仍然一条局面都没收到 ⇒ 还是那个死局；收到 ${JSON.stringify(kindsFrom(revived, 0))} 环线=${JSON.stringify(rig2.room.info().phase)}`);
  assert.equal(revived.net.snapshot().started, true, '快照仍然空着');
  assert.deepEqual(revived.net.info().trustLines, [], '重新入桌干净了就不该再挂着任何提示');
  assert.notEqual(mate.net.info().seat, revived.net.info().seat, '两家该各占一座');
  assert.equal(rig2.room.info().fault, null);
  note('nui/18 bad_token ⇒ 清存储 + 提示 + onText 自己产出 join（一次），哑管道端到端也真把局面接回来了');
});

test('nui/17 页面模块图在静态服务策略下完整可达（浏览器实测抓到的那类 403 由这条兜住）', () => {
  // 真浏览器里跑出来的 bug：webui/netplay.ts 按值 import ../netx/client.ts，而静态服务只放行
  // webmin/webui/src 三个目录 ⇒ 浏览器 fetch /netx/client.ts 得 403 ⇒ **整张模块图加载失败**，
  // 页面既不开画布也不报错在牌桌上（只在控制台）。这种"只有真浏览器才会撞上"的失败模式，
  // 用一条遍历 import 图的机检提前拦住：每个被 import 的相对模块都必须过 resolveStatic。
  const joinRel = (fromRel: string, spec: string): string => {
    const parts = fromRel.split('/').slice(0, -1);
    for (const seg of spec.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts.join('/');
  };
  const seen = new Set<string>();
  const refused: string[] = [];
  const queue: string[] = ['webui/index.html'];
  while (queue.length > 0) {
    const rel = queue.shift() as string;
    if (seen.has(rel)) continue;
    seen.add(rel);
    const r = resolveStatic(`/${rel}`);
    if (!r.ok) {
      refused.push(`/${rel} ⇒ ${r.why}`);
      continue;
    }
    const text = readSource(rel);
    // 入口 HTML 里是 <script src="./main.ts">，模块图从这里起步；其余全是 import 语句
    for (const m of text.matchAll(/<script\b[^\n]*?\bsrc="(\.[^"]+)"/g)) queue.push(joinRel(rel, m[1] as string));
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\b[^\n]*?from\s+'(\.[^']*)'|(?:^|\n)\s*import\s+'(\.[^']*)'/g)) {
      const spec = (m[1] ?? m[2]) as string;
      queue.push(joinRel(rel, spec));
    }
  }
  assert.deepEqual(refused, [], `页面模块图里有模块被静态服务拒掉，浏览器会整页起不来：\n${refused.join('\n')}`);
  assert.ok(seen.has('webui/netplay.ts') && seen.has('netx/client.ts'), '构造前提：图里必须真的走到那道墙，否则这条检查是空的');
  assert.ok(seen.has('netx/sha256.ts'), '构造前提：摘要模块是被 client.ts 按值引的，必须在图里');
  const wall = [...seen].filter((f) => f.startsWith('netx/')).sort();
  assert.deepEqual(wall, ['netx/client.ts', 'netx/protocol.ts', 'netx/seed.ts', 'netx/sha256.ts'], '浏览器侧的 netx 进口面变了（服务端权威与传输层不许出现在页面图里）');
  assert.ok([...seen].every((f) => !/(paint|scene)\.ts/.test(f) || resolveStatic(`/${f}`).ok), '渲染层没可达');
  note(`nui/17 模块图 ${String(seen.size)} 个文件全部可达，其中 netx 只有 ${String(wall.length)} 个：${wall.join(', ')}`);
});

test('nui/16 入口层静态门：main.ts 只接线不判规则，联机那一侧只有一个进口', () => {
  const body = readSource('webui/main.ts')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert.match(body, /from '\.\/netplay\.ts'/, 'main.ts 没接到 netplay 那一层 ⇒ 联机模式是空的');
  assert.match(body, /new WebSocket\(/, 'main.ts 没建真 socket');
  assert.match(body, /WIRE_SUBPROTOCOL/, '子协议要从 netplay 转手，不许在这里再抄一遍字面量');
  assert.match(body, /toMove\(/, '点击的意图必须先收窄成 Move 再发');
  assert.match(body, /\.act\(/, '联机那一侧的行动出口是 net.act');
  assert.match(body, /\.onText\(/, '下行必须喂给那道墙');
  assert.match(body, /for \(const up of net\.onText\([\s\S]{0,60}\)\)\s*ws\.send\(up\)/, 'onmessage 必须是纯管道：onText 返回什么就发什么');
  assert.equal(
    (body.match(/joinWire\(\)/g) ?? []).length,
    1,
    '"该发哪条上行"只许在 onopen 那一处决定（凭据作废后的重入桌由 netplay 从 onText 里产出，别在传输层再写一遍）',
  );
  assert.match(body, /服务端拒绝/, '服务端的 reject 要在页面上说出口（(c) 那条的显示面）');
  assert.match(body, /trustLines/, '越界提示要上页面');
  const banned = [
    /netx\//,
    /legalActions/,
    /actionCost/,
    /callPrice/,
    /canAffordCall/,
    /checkDown/,
    /commitOf/,
    /stateHash/,
    /\bclassify\(/,
    /checkAction/,
    /\bapply\(/,
    /localStorage/,
  ];
  for (const re of banned) assert.ok(!re.test(body), `main.ts 里出现 ${String(re)} ⇒ 第二道墙 / 自己判规则 / 全局键`);
  // 正向对照：这些判据拿去扫一份"坏入口"必须全命中
  const bad = [
    "import { createRoom } from '../netx/room.ts';",
    'legalActions(st); actionCost(st, 0, "call"); callPrice(st, 0); canAffordCall(st, 0);',
    'checkDown(t); commitOf(1, p, v); stateHash(s); classify(cs, r); checkAction(st, a); apply(st, a);',
    'localStorage.setItem("token", t);',
  ].join('\n');
  const hits = banned.filter((re) => re.test(bad));
  assert.equal(hits.length, banned.length, `对照组只命中 ${String(hits.length)}/${String(banned.length)} 条 ⇒ 这条门是虚的`);
  note('nui/16 入口层只有接线与显示：netx 进口为零，规则与价格的判定面全在别处');
});

test('nui/19 过不了 schema 的下行不许清凭据、不许强制重入桌；已停手的那一世也不许再发上行（rev=10 应修 2）', () => {
  // 修之前的判据是"我自己 JSON.parse 原文嗅探 code"，于是**一条连协议校验都过不了的报文**
  // 就能把玩家的凭据抹掉并换一次入桌 —— 这一层的主题正是不信任服务端，判据却绕开了它自己的墙。
  const rig = openRig(2);
  const a = rig.join('甲');
  rig.join('乙');
  rig.pumpAll();
  const kept = a.store.map.get('zjh-m5:session') as string;
  assert.ok(a.net.info().hasToken, '构造前提：入桌后存储里有一份凭据');

  // ① 非法报文（缺 `why`）⇒ 墙记越界，但这一层什么都不许做
  const ups = a.net.onText(JSON.stringify({ t: 'error', code: 'bad_token' }));
  assert.deepEqual(ups, [], '一条没过校验的报文却产出了上行 ⇒ 判据绕过了那道墙');
  assert.equal(a.net.info().hasToken, true, '凭据被一条非法报文清掉了');
  assert.equal(a.store.map.get('zjh-m5:session'), kept, '存储被动过 ⇒ 同上');
  assert.equal(a.net.info().staleToken, false, '非法报文不该点亮"凭据已作废"这条提示');
  assert.equal(a.net.info().untrusted, true, '非法报文必须被墙记成越界（它确实记了）');
  // ② 对照组：同一 code、schema 合法 —— 但这一世**已经停手** ⇒ 仍然一条上行都不发
  const ups2 = a.net.onText(JSON.stringify({ t: 'error', code: 'bad_token', why: 'unknown resume token' }));
  assert.deepEqual(ups2, [], '已经停手的这一世不许再向服务端发任何上行，join 也是上行');
  assert.equal(a.net.info().hasToken, false, '合法回执之后仍该把废凭据丢掉（丢凭据 ≠ 发上行）');
  assert.equal(a.net.info().staleToken, true, '这条提示要留着：它是"为什么这页不动了"的答案');
  assert.match(a.net.info().trustLines.join(' '), /凭据已作废/);

  // ③ 干净的一世（没被抓过越界）才允许自动重入桌 —— 这条由 nui/18 端到端钉，这里只补判据形状
  const rig2 = openRig(2);
  const c = rig2.join('丙');
  rig2.join('丁');
  rig2.pumpAll();
  assert.equal(c.net.info().untrusted, false, '构造前提：这一世干净');
  const ups3 = c.net.onText(JSON.stringify({ t: 'error', code: 'bad_token', why: 'unknown resume token' }));
  assert.deepEqual(ups3.map((x) => (JSON.parse(x) as { t: string }).t), ['join'], '合法回执 ⇒ 干净的那一世才补一条全新入桌');
  assert.equal(c.net.info().hasToken, false, '旧凭据要先丢掉，新的那一份等 hello 回来再写');
  assert.equal(rig2.room.info().fault, null);
  assert.equal(rig.room.info().fault, null, '两间房间都不该因为这几条报文出事');
  note('nui/19 判据只认墙校验过的 errors：非法报文不清凭据不发上行；停手的那一世也不发；干净的那一世才自动重入桌');
});

test('nui/20 上一条 reject 在我发出新行动之后必须过期（提示行不许陈述已翻篇的事实，rev=10 应修 4）', () => {
  const rig = openRig(3, { startAt: false });
  const a = rig.join('甲');
  rig.join('乙');
  rig.join('丙');
  rig.start();
  rig.pumpAll();
  // 首圈禁比：轮到甲时直接 compare ⇒ 服务端拒，拒因先上到牌桌
  for (let step = 0; step < 12 && rig.turnTab() !== a; step += 1) {
    const t = rig.turnTab();
    if (t !== null) rig.act(t, { kind: 'call' });
    rig.pumpAll();
  }
  assert.equal(rig.turnTab(), a, '构造前提：轮到甲');
  const opp = rig.viewOf(a)?.seats.find((s) => s.seat !== a.net.info().seat && s.active) as { seat: number };
  rig.act(a, { kind: 'compare', target: opp.seat });
  const rejected = a.net.info().lastReject;
  assert.ok(rejected !== null, '服务端没把这条拒绝送回来');
  assert.match(a.net.snapshot().note ?? '', /服务端拒绝/, '拒绝的原文要上牌桌');
  // 我这一下被拒之后，下一个合法行动被接受 ⇒ 那一行不该还挂着旧账
  rig.act(a, { kind: 'call' });
  assert.equal(a.net.info().lastReject, null, '旧的 reject 还占着提示行：它在陈述一个已经翻篇的事实');
  const warnLine = a.net.snapshot().note ?? '';
  assert.ok(!warnLine.includes('服务端拒绝'), `牌桌警告位还在印那条旧拒绝：${warnLine}`);
  // 两个面的分工：提示行过期了，审计面不许跟着丢
  const audit = a.net.peer.info().rejects;
  assert.ok(
    audit.some((r) => r.code === rejected?.code),
    `rejects 里应当仍然查得到那条历史拒绝：${JSON.stringify(audit)}`,
  );
  assert.equal(a.net.info().untrusted, false);
  assert.equal(rig.room.info().fault, null);
  note(`nui/20 ${rejected?.code ?? '?'} 上屏后，下一个被接受的行动把它换下了提示行，审计面仍留着 ${String(audit.length)} 条`);
});

test('nui/21 服务端 notice 上到日志区：玩家既看得见结果、也看得见原因（rev=10 应修 5）', () => {
  // 房间用 note() 广播的那几条正是"可观测状态突变"的解释：谁入桌、谁没交份额所以这局不带他、
  // 庄家因此挪到谁。修之前它们只到 info().notices，页面上一个字都没有 —— 玩家只看见局面变了。
  // 构造：让"沉默"那一座（0 号位，本局庄家）从头到尾不交份额 ⇒ 一次触发两类 notice。
  const rig = openRig(3, { startAt: false, nonceMs: 5000 });
  rig.room.open('t-silent');
  rig.room.receiveText('t-silent', JSON.stringify({ t: 'join', name: '沉默', buyIn: 256 }));
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.pumpAll();
  const first = rig.snap(a);
  // 甲只能听见**它入桌之后**广播的 notice：'沉默' 那一条发在这页存在之前，物理上收不到（不是漏播）。
  // 名册本身不受影响 —— hello 里的 seats 带着所有人的名字（refreshRosters 就是为这件事加的）。
  const joined = first.log.filter((l) => l.includes('坐到') && l.includes('号位'));
  assert.deepEqual(
    joined.map((l) => l.slice(0, l.indexOf(' 坐到'))).sort(),
    ['乙', '甲'],
    `自己与后入桌那位的说明都该在，实得：${joined.join(' ⏎ ')}`,
  );
  assert.ok(!joined.some((l) => l.includes('沉默')), '不该凭空收到入桌之前广播的那条（那才是编造历史）');

  // 到点：沉默那席被剔出本局 ⇒ "没交份额" + "庄家挪位"两条都该出现在页面上。
  // 开机必须排在上面那次快照之后：nonce 定时器是 beginHand 才武装的，没开局就没有到点这回事
  // （第一版正是漏了 rig.start()，房间整程停在 idle、missing=[]，两条 notice 当然一条也不会出现）。
  rig.start();
  rig.clock.advance(5000 + 1);
  rig.pumpAll();
  const later = a.net.snapshot().log;
  assert.ok(
    later.some((l) => l.includes('没在') && l.includes('提交份额')),
    `份额到点不齐的解释没上页面：${later.join(' ⏎ ')}`,
  );
  assert.ok(
    later.some((l) => l.includes('庄家') && l.includes('挪到座位 1')),
    `庄家从缺席的 0 号位挪到 1 号位，这条原因得上页面：${later.join(' ⏎ ')}`,
  );
  assert.equal(a.net.info().untrusted, false, 'notice 只是说明，不该把任何一侧判成不可信');
  assert.equal(b.net.info().untrusted, false);
  // 键集不许因为多并了 notices 而漂移；条数上限也不许被撑破
  assert.deepEqual(
    Object.keys(a.net.snapshot()).sort(),
    Object.keys(soloSnapshot(EMPTY_UI)).sort(),
    '并 notices 之后快照键集变了 ⇒ 渲染层又要写第二套',
  );
  assert.ok(a.net.snapshot().log.length <= 40, '日志区被 notices 撑破了上限');
  assert.ok(a.net.snapshot().log.some((l) => l.startsWith('#')), '服务端说明是**附加**在引擎日志之前，不是把日志整段换掉');
  note('nui/21 入座 / 没交份额 / 挪庄三类 notice 都进了日志区，键集与 40 行上限不变');
});

test('nui/22 底部那行数字的标签与 departed 过滤同口径：是「在场筹码+池」，不是「桌上总额」（rev=10 应修 7 / §8.9）', () => {
  // 构造沿用 nui/21：0 号位从头到尾不交份额 ⇒ 到点被剔出本局 ⇒ 名册里有它、这一局的 view 里没有它。
  // 于是页面出现 departed 占位格（chips 记 0 —— 页面拿不到房间欠它多少，绝不编造），
  // 而房间侧那笔筹码仍然欠着（room.ts 的 chips 表只在结算时按本手在座者回写，从不 delete）。
  const rig = openRig(3, { startAt: false, nonceMs: 5000 });
  rig.room.open('t-silent');
  rig.room.receiveText('t-silent', JSON.stringify({ t: 'join', name: '沉默', buyIn: 256 }));
  const a = rig.join('甲');
  rig.join('乙');
  rig.start();
  rig.clock.advance(5000 + 1);
  rig.pumpAll();

  const page = rig.snap(a);
  const gone = page.seats.find((s) => s.departed);
  assert.ok(gone !== undefined, `构造前提：该有一格"在册但本局不在桌"，实得 ${JSON.stringify(page.seats.map((s) => ({ seat: s.seat, departed: s.departed })))}`);
  assert.equal(gone.seat, 0, '被剔出本局的正是没交份额的 0 号位');
  assert.equal(gone.chips, 0, '页面不知道房间欠离桌那家多少 ⇒ 占位格记 0，不许猜一个数');
  assert.equal(gone.status, '本局不参与');
  assert.equal(gone.hidden, true);

  const present = page.seats.filter((s) => !s.departed);
  assert.equal(present.length, 2);
  // ① 标签承诺的范围 = 算法实际算的范围
  assert.equal(page.total, present.reduce((s, x) => s + x.chips, 0) + page.pot, '标签说什么，total 就得算什么');
  assert.ok(!page.ledgerLine.includes('沉默'), `ledgerLine 必须与 total 同口径，不许把不在场那家列进台账行：${page.ledgerLine}`);
  // ② 房间整本账比它大，差额正好是离桌那一家的买入 ⇒ 旧标签「桌上总额」说的正是那个更大的范围。
  //    （这里不能拿"在场那几家的房间余额 + 池"来比：房间台账要到结算才回写，底注还留在账上，
  //    加一遍池就成了双重计入 —— 第一版就是这么算错的，512 对 514。）
  const roomChips = rig.room.info().chips;
  const roomAll = roomChips.reduce((s, c) => s + c.chips, 0);
  const owed = roomChips.find((c) => c.seat === 0)?.chips ?? 0;
  assert.equal(owed, 256, '房间仍然欠着离桌那一家全部买入（它拿 token 回来就能续上）');
  assert.equal(roomAll - page.total, owed, '页面与房间整本账的差 = 正好一个缺席者，一颗不多一颗不少');
  assert.notEqual(page.total, roomAll, '若有人只把过滤摘掉而不改标签，这个数就会等于房间整本账 ⇒ 标签重新开始说谎');
  // ③ 文案自己交代范围，且渲染时与这个数绑在同一行
  assert.ok(TOTAL_LABEL.includes('在场') && !TOTAL_LABEL.includes('桌上'), `标签没交代自己的范围：${TOTAL_LABEL}`);
  const texts = buildScene(page, 900, 760, TABLE_STYLE).primitives.filter((p) => p.kind === 'text').map((p) => p.text);
  const line = texts.find((t) => t.includes(String(page.total)));
  assert.ok(line !== undefined && line.startsWith(TOTAL_LABEL), `底部那一行没把标签和数字绑在一起，实得：${JSON.stringify(texts.slice(-3))}`);
  assert.equal(a.net.info().untrusted, false, '离桌只是状态说明，不该把整局判成不可信');
  assert.equal(rig.room.info().fault, null);
  note(`nui/22 在场=${String(page.total)}、房间整本=${String(roomChips.reduce((s, c) => s + c.chips, 0))}（差额 ${String(owed)} = 离桌那一家），标签「${TOTAL_LABEL}」与过滤同口径`);
});

test('nui/23 在座座位格是服务端那一行的逐项映射：牌面/等级/筹码/已投入/状态/庄标/隐藏（rev=10 §8.12 i 主路径）', () => {
  // 这一整块（netplay 的座位格映射）此前零覆盖：无头侧从来没有完整走过一次"我在桌、我看得到自己那一格"。
  // 它不是错误分支，是主路径。这里按三个时刻各比对一遍：开局（谁都没看牌）→ 甲看牌 → 打完结算。
  const rig = openRig(3, { startAt: false, settleMs: 200, handGapMs: 60000 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  const c = rig.join('丙');
  rig.start();
  rig.pumpAll();
  const rules = a.net.peer.rulesOf();
  assert.ok(rules !== null, '拿不到规则就没法核对等级文案');
  const mySeat = a.net.info().seat;

  const cellFor = (seat: number): Snapshot['seats'][number] => {
    const cell = rig.snap(a).seats.find((s) => s.seat === seat);
    assert.ok(cell !== undefined, `座位 ${String(seat)} 的格子丢了`);
    return cell as Snapshot['seats'][number];
  };
  // viewOf() 的返回类型经由 netx/protocol.ts 的 `export type { … }` 转手，直接拿它推中间量会让 tsc
  // 报 TS7022（隐式 any，因为初始化式间接引用了自身）。这里显式命名一次，下面所有读数都过这个窄口径。
  type PeerView = ReturnType<Net['peer']['viewOf']>;
  // 逐格比对：每一格都必须由 view 里那一行推出来，既不多不少也不改数
  const check = (label: string): void => {
    const v: PeerView = a.net.peer.viewOf();
    assert.ok(v !== null, `${label}：视图没了`);
    if (v === null) return;
    const snap = rig.snap(a);
    assert.equal(snap.seats.length, v.seats.length, `${label}：格子数与 view 的行数不一致`);
    for (const row of v.seats) {
      const cell = cellFor(row.seat);
      const hidden = row.cards === 'unknown';
      const where = `${label}·${String(row.seat)} 号位`;
      assert.equal(cell.hidden, hidden, `${where}：hidden 与"牌面是否未知"不一致`);
      assert.equal(cell.chips, row.chips, `${where}：筹码没照抄`);
      assert.equal(cell.committed, row.committed, `${where}：已投入没照抄`);
      assert.equal(cell.looked, row.looked, `${where}：看没看牌没照抄`);
      assert.equal(cell.active, row.active, `${where}：在不在桌没照抄`);
      assert.equal(cell.cardsText, hidden ? '···' : handText(row.cards as Card[]), `${where}：牌面文案`);
      assert.equal(cell.tierText, hidden ? '' : tierName(classify(row.cards as Card[], rules as Rules).tier), `${where}：等级文案`);
      assert.equal(
        cell.status,
        !row.active ? (row.out === 'folded' ? '弃牌' : '被淘汰') : v.phase !== 'betting' ? '局中' : v.turn === row.seat ? '行动中' : '局中',
        `${where}：状态文案`,
      );
      assert.equal(
        cell.marks,
        [row.seat === v.dealer ? '庄' : '', v.phase === 'betting' && row.seat === v.turn ? '◀' : ''].filter(Boolean).join(''),
        `${where}：庄/行动标记`,
      );
      assert.equal(cell.role, row.seat === mySeat ? 'human' : 'remote', `${where}：只有我自己那一格是 human`);
      const terminal: { winners: number[]; shares: number[] } | null = v.terminal;
      const idx: number = terminal === null ? -1 : terminal.winners.indexOf(row.seat);
      assert.equal(
        cell.resultText,
        terminal === null ? '' : idx >= 0 ? (v.phase === 'settled' ? `赢 ${String(terminal.shares[idx] ?? 0)}` : `应赢 ${String(terminal.shares[idx] ?? 0)}`) : v.phase === 'settled' ? '没赢' : '',
        `${where}：结算文案`,
      );
    }
  };

  check('开局·谁都没看牌');
  const me0 = cellFor(mySeat);
  assert.equal(me0.cardsText, '···', '没看牌时连自己那格都不许露牌面（与 M1.5 同一道门）');
  assert.equal(rig.snap(a).revealedLine, '', '没开牌就不该有亮牌行');

  // 庄家 0 号位不首先行动 ⇒ 要"轮到甲"得先让别人各动一次。用 call 而不是 look：
  // look 不消耗回合（点了不算动过），拿它循环会原地转圈；call 消耗回合且**不亮牌**，别家格子仍是 ···。
  for (let step = 0; step < 12 && rig.turnTab() !== a; step += 1) {
    const t = rig.turnTab();
    if (t !== null) rig.act(t, { kind: 'call' });
    rig.pumpAll();
  }
  assert.equal(rig.turnTab(), a, '构造前提：轮到甲');
  rig.act(a, { kind: 'look' });
  rig.pumpAll();
  check('甲看牌之后');
  const me1 = cellFor(mySeat);
  assert.notEqual(me1.cardsText, '···', '看了牌就得让自己这一格可读');
  assert.ok(me1.tierText !== '', '等级文案要跟着出来');
  for (const row of (a.net.peer.viewOf() as NonNullable<ReturnType<Net['peer']['viewOf']>>).seats) {
    if (row.seat === mySeat) continue;
    assert.equal(cellFor(row.seat).cardsText, '···', '我看了自己的牌，绝不因此点亮别家那格');
  }

  playHand(rig);
  settleNow(rig);
  check('打完这一手');
  const end = rig.snap(a);
  assert.equal(end.phase, 'settled');
  assert.ok(end.seats.some((s) => s.resultText.startsWith('赢')), '总得有一家把"赢 N"印出来');
  assert.equal(end.revealedLine.startsWith('亮牌：'), true, '强制开牌之后必须有亮牌行');
  assert.deepEqual(a.net.info().trustLines, [], '逐项映射不该制造越界');
  assert.equal(a.net.info().verifiedHand, 1);
  assert.equal(rig.room.info().fault, null);
  note(`nui/23 座位格主路径三个时刻各比对 ${String((a.net.peer.viewOf()?.seats.length ?? 0) * 9)} 项，牌面/等级/筹码/状态/结算文案全部由 view 那一行推出（甲${String(mySeat)}、乙${String(b.net.info().seat)}、丙${String(c.net.info().seat)}）`);
});

// §8.13：复审预告 rev=11 的注入点从 reveal 换到 patch。这一条先把话说在前面并钉住 ——
// 第二道墙判泄漏用的是 checkViewLeak(view, seat)，它作用在**整份投影**上，不区分这条投影是
// 全量快照、增量补丁，还是揭示之后补下来的牌面。所以 patch 上塞别家牌面与 reveal 上改份额同等对待。
test('nui/24 中间人改 patch：往我的 view 里塞别家的牌面必须被抓、不许采纳、页面立刻停手（rev=10 §8.13）', () => {
  const rig = openRig(2, { settleMs: 200, handGapMs: 60000 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.pumpAll();
  // 只让第一家动一次，然后**由本用例自己取走**甲队列里那条增量：
  // 原件必须先落到本用例手里、绝不能让会话先看见 —— 会话一旦跟上到 seq 2，
  // 我再喂的那一条就会先撞上"seq 接不上号"那道闸，测到的就不是泄漏判据了（第一版正是栽在这里）。
  const first = rig.turnTab();
  assert.ok(first !== null, '构造前提：开局就该有人能行动');
  rig.act(first, { kind: 'call' });
  const queued = rig.room.pending(a.conn).map((m) => JSON.parse(JSON.stringify(m)) as { t: string; view?: { seats: { seat: number; cards: unknown }[] } });
  const patches = queued.filter((m) => m.t === 'patch');
  assert.ok(patches.length >= 1, `构造前提：甲的待发队列里要有一条真 patch 当底稿，实得 ${JSON.stringify(queued.map((m) => m.t))}`);
  const base = patches[patches.length - 1] as { t: string; hand: number; since: number; seq: number; view: { seats: { seat: number; cards: unknown }[]; viewer: number } };
  assert.equal(base.view.seats.some((r) => r.seat !== a.net.info().seat && r.cards === 'unknown'), true, '底稿里别家本来就应当是未知牌（否则这个构造没意义）');
  assert.equal(base.view.viewer, a.net.info().seat, '底稿确实是投给我这一家的（否则泄漏判据不该由它负责）');
  const forged = JSON.parse(JSON.stringify(base)) as typeof base;
  const victim = forged.view.seats.find((r) => r.seat !== a.net.info().seat) as { seat: number; cards: unknown };
  victim.cards = [
    { rank: 12, suit: 0 },
    { rank: 11, suit: 1 },
    { rank: 10, suit: 2 },
  ];

  const violationsBefore = a.net.peer.info().violations.length;
  // 走页面那条真管道（main.ts 的 onmessage 就是这个循环）；队列里除那一条 patch 之外的消息原样送回
  for (const m of queued) {
    const text = m === base ? JSON.stringify(forged) : JSON.stringify(m);
    for (const up of a.net.onText(text)) rig.room.receiveText(a.conn, up);
  }

  const viol = a.net.peer.info().violations;
  assert.ok(viol.length > violationsBefore, '别家的牌面出现在我的投影里却没被抓 ⇒ 第二道墙只认揭示那一条路');
  assert.match(String(viol.at(-1)), /patch unusable/, `判据要落在 patch 这一支上，实得 ${JSON.stringify(viol)}`);
  assert.match(String(viol.at(-1)), /cards of seat/, `越界记录要指得出是哪一家的牌：${JSON.stringify(viol)}`);
  assert.equal(a.net.info().untrusted, true);
  const snap = a.net.snapshot();
  assert.ok(snap.log.some((l) => l.includes('不可信')), '停手 + 为什么停手必须上日志区，不能只活在 violations 数组里');
  assert.equal(snap.buttons.length, 1, `五个动作该塌成一个"已停手"，实得 ${JSON.stringify(snap.buttons.map((x) => x.text))}`);
  assert.equal(snap.buttons[0]?.legal, false);
  assert.match(String(snap.buttons[0]?.text), /已停手/);
  // 不采纳：那张伪造的牌面一个字都不许上牌桌
  const cell = snap.seats.find((s) => s.seat === b.net.info().seat) as Snapshot['seats'][number];
  assert.equal(cell.cardsText, '···', '被拒的投影绝不能显示出来');
  const blocked = a.net.act({ kind: 'call' });
  assert.equal(blocked.sent, false, '已经抓到越界，act 还放得出去 ⇒ 停手只是文案');
  assert.match(String(blocked.why), /peer flagged the server/);
  // 对照：同一份底稿原样（不塞牌面）喂给一个干净的会话 ⇒ 墙不误伤，合法增量照常采纳
  const clean = openRig(2, { settleMs: 200, handGapMs: 60000 });
  const x = clean.join('甲');
  clean.join('乙');
  clean.pumpAll();
  const firstDown = x.down.length;
  const xFirst = clean.turnTab();
  assert.ok(xFirst !== null, '对照组：开局就该有人能行动');
  clean.act(xFirst, { kind: 'call' });
  clean.pumpAll();
  const legit = x.down.slice(firstDown).map((s) => JSON.parse(s) as { t: string }).filter((m) => m.t === 'patch');
  assert.ok(legit.length >= 1, '对照组没能收到合法 patch ⇒ 它没有可比性');
  assert.deepEqual(x.net.peer.info().violations, [], `合法增量不该被误伤：${JSON.stringify(x.net.peer.info().violations)}`);
  assert.equal(x.net.info().untrusted, false);
  assert.equal(rig.room.info().fault, null, '客户端抓到越界不是服务端的 fault 档（那是它自己算错了才用的）');
  note(`nui/24 patch 上塞别家牌面 ⇒ 当场抓到（${String(viol.length)} 条越界）、投影不采纳、页面塌成"已停手"、act 发不出去；同工装下的合法 patch 零误伤`);
});

// 与 nui/24（牌面）/nui/27（数字）成对的第三面：**seq 与采纳面**。
// rev=11 这一条的标题与断言写的是"改 chips/pot 抓不到 —— 客户端无法独立核对"，那句话被 rev=11 复审
// 用纯客户端恒等式实测证伪 ⇒ 本轮**改写而不是删除**（复审 §3 的原话：把假边界钉成测试，比没有用例更糟）。
// 数字那一面挪到 nui/27/28 去钉；这里留下只有本用例能钉住的两件事：
//   ① 一条**合法**增量确实被采纳（后面的"重放被抓"因此只能归因于 seq，而不是底稿本身有毛病）；
//   ② 同一条 patch **重放** ⇒ seq 接不上 ⇒ 当场被抓；被拒的那一帧不许进快照。
test('nui/25 seq 面与采纳面：合法增量被采纳、同一条重放当场被抓、被拒的帧不进快照（rev=11 必修 1 的改写）', () => {
  // turnMs 压到 5000：甲停手之后要能靠"托管到点"把这一手推下去（Q4=B）
  const rig = openRig(2, { settleMs: 200, handGapMs: 60000, turnMs: 5000 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.pumpAll();
  const one = rig.turnTab();
  assert.ok(one !== null, '构造前提：开局就该有人能行动');
  rig.act(one, { kind: 'call' });
  // 底稿由本用例从甲的待发队列里取走，会话必须先没见过原件
  const queued = rig.room
    .pending(a.conn)
    .map((m) => JSON.parse(JSON.stringify(m)) as { t: string; hand: number; since: number; seq: number; view: { pot: number; seats: { seat: number; chips: number }[] } });
  const patches = queued.filter((m) => m.t === 'patch');
  assert.equal(patches.length, 1, `构造前提：这一帧里应当只有一条 patch，重放才有唯一对照，实得 ${String(patches.length)} 条`);
  const base = patches.at(-1);
  assert.ok(base !== undefined, '构造前提：底稿取到了');
  // ① 原样喂回去 ⇒ 合法增量被采纳，violations 仍然空
  for (const m of queued) {
    for (const up of a.net.onText(JSON.stringify(m))) rig.room.receiveText(a.conn, up);
  }
  assert.deepEqual(a.net.peer.info().violations, [], `合法增量不该被误伤：${JSON.stringify(a.net.peer.info().violations)}`);
  const adopted = a.net.snapshot();
  assert.equal(adopted.pot, rig.room.info().pot, '采纳之后页面的池就是权威值（①不成立的话②就是空转）');
  assert.equal(a.net.info().seq >= base.seq, true, '采纳之后会话的 seq 要跟上这一帧（①不成立的话②就是空转）');
  // ② 同一条重放一次 ⇒ seq 接不上号 ⇒ 当场被抓
  for (const up of a.net.onText(JSON.stringify(base))) rig.room.receiveText(a.conn, up);
  assert.ok(
    a.net.peer.info().violations.length > 0,
    `重放同一条 patch 必须被 seq 那道闸抓住，实得 ${JSON.stringify(a.net.peer.info().violations)}`,
  );
  assert.match(String(a.net.peer.info().violations.at(-1)), /seq/, `越界记录要说清是 seq 对不上：${JSON.stringify(a.net.peer.info().violations)}`);
  assert.equal(a.net.info().untrusted, true);
  // ③ 被拒的帧不进快照 + 停手 + 权威面不动
  const snap = a.net.snapshot();
  assert.equal(snap.pot, rig.room.info().pot, '被拒的那一帧不许改动快照：页面继续显示上一帧的好数字');
  assert.equal(a.net.act({ kind: 'call' }).sent, false, '抓到越界之后甲必须停手（nui/05 那条口径）');
  assert.match(String(a.net.act({ kind: 'call' }).why), /peer flagged the server/);
  assert.equal(rig.room.info().pot, base.view.pot, '下行改不动服务端自己的池额');
  rig.clock.advance(5001);
  rig.pumpAll();
  assert.equal(rig.snap(a).pot, rig.room.info().pot, '权威面照常往下推，一帧被拒不会把快照冻在假数字上');
  // ④ 揭示核对这条路不受影响：种子仍然由各方份额与承诺合成，篡改 chips 改不动它。
  //    甲已经停手（它不再发任何上行），它那一席由**托管到点**推进 —— 这正是 Q4=B 的口径。
  for (let step = 0; step < 24 && rig.turnTab() !== null; step += 1) {
    const t = rig.turnTab();
    if (t === a) {
      rig.clock.advance(5001);
      rig.pumpAll();
    } else {
      rig.act(t as Tab, { kind: 'call' });
    }
    rig.pumpAll();
  }
  assert.equal(rig.turnTab(), null, '这一手应当在托管 + 乙的行动下走完');
  settleNow(rig);
  assert.equal(b.net.info().verifiedHand, 1, '没被越界污染的那一家仍然核对通过 ⇒ 揭示核对只认份额与承诺');
  assert.equal(a.net.info().untrusted, true, '停手不会因为结算而自动解除');
  assert.equal(rig.room.info().fault, null);
  note('nui/25 的 seq 面：重放同一条 patch 当场被抓；揭示核对仍然只认份额与承诺');
});

// —— rev=11 必修 1 的用面 ——
// rev=11 的 nui/25 曾经断言"chips/pot 这类公开权威数字客户端无法独立核对"。那句话是**假的**，
// 被复审用纯客户端恒等式实测证伪 ⇒ 本轮改写（不删除）：数字这一面**能**核对，核的就是三条恒等式
//   (a) pot === Σ committed ／ (c′) 同一手内每一家的 chips+committed 恒定 ／ (d) 全桌 Σ(chips+committed) 恒定
// 成立区间由探针量出（见 TEST-OUTPUT 第 12 节）：betting 与 awaitingSettle 全程成立，只有 settled 那一帧合法地破。
type Forge = 'pot' | 'my-chips' | 'my-committed' | 'other-chips' | 'committed-and-pot' | 'extra-seat';

function forgePatch(kind: Forge): {
  rig: Rig;
  a: Tab;
  b: Tab;
  viol: string[];
  snapPot: number;
  beforePot: number;
  forgedPot: number;
  truePot: number;
  base: { t: string; hand: number; since: number; seq: number; view: { pot: number; seats: { seat: number; chips: number; committed: number }[] } };
} {
  const rig = openRig(2, { settleMs: 200, handGapMs: 60000, turnMs: 5000 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  rig.pumpAll();
  const one = rig.turnTab();
  assert.ok(one !== null, '构造前提：开局就该有人能行动');
  rig.act(one, { kind: 'call' });
  // 底稿必须是**真发下来过、且会话还没见过**的一条 patch：先把队列取走，否则测到的是 seq 那道闸（nui/24 同一个坑）
  const queued = rig.room
    .pending(a.conn)
    .map((m) => JSON.parse(JSON.stringify(m)) as {
      t: string;
      hand: number;
      since: number;
      seq: number;
      view: { pot: number; seats: { seat: number; chips: number; committed: number }[] };
    });
  const patches = queued.filter((m) => m.t === 'patch');
  const base = patches.at(-1);
  assert.ok(base !== undefined, `构造前提：甲的待发队列里要有一条真 patch 当底稿，实得 ${JSON.stringify(queued.map((m) => m.t))}`);
  const forged = JSON.parse(JSON.stringify(base)) as typeof base;
  const mySeat = a.net.info().seat;
  const mine = forged.view.seats.find((r) => r.seat === mySeat) as { chips: number; committed: number };
  const other = forged.view.seats.find((r) => r.seat !== mySeat) as { chips: number; committed: number };
  if (kind === 'pot') forged.view.pot += 100;
  if (kind === 'my-chips') mine.chips += 100;
  if (kind === 'my-committed') mine.committed += 100;
  if (kind === 'other-chips') other.chips += 100;
  // 组合支：committed 与 pot **一起**改 ⇒ (a) 自己看不出问题，必须靠手内恒定那两条
  if (kind === 'committed-and-pot') {
    mine.committed += 100;
    forged.view.pot += 100;
  }
  // 第六支专门给 (d)：凭空**多塞一个座位行**（committed=0 ⇒ (a) 仍然成立；新座位没有基准 ⇒ 逐座位那条跳过）
  // ⇒ 只有"全桌 Σ(chips+committed) 手内恒定"能抓住它。没有这一支，(d) 就是一条没有牙的检查。
  if (kind === 'extra-seat') {
    const phantom = {
      seat: 5,
      chips: 100,
      active: false,
      out: null,
      looked: false,
      actionsTotal: 0,
      actionsAtStake: 0,
      committed: 0,
      revealed: false,
      cards: 'unknown',
    };
    forged.view.seats.push(phantom as unknown as (typeof forged.view.seats)[number]);
  }
  // 构造前提：这一支确实动到了一个数字（否则整条用例是空转 —— 注入没落地与检查有效长得一模一样）
  assert.notEqual(JSON.stringify(forged), JSON.stringify(base), `${kind}：注入没有改动任何字节 ⇒ 构造失效`);
  // 喂进去之前先记下"当前被采纳的那一帧"的池：被拒之后快照应当停在这一帧，而不是权威最新值
  const beforePot = a.net.snapshot().pot;
  for (const m of queued) {
    const text = m === base ? JSON.stringify(forged) : JSON.stringify(m);
    for (const up of a.net.onText(text)) rig.room.receiveText(a.conn, up);
  }
  const snap = a.net.snapshot();
  return {
    rig,
    a,
    b,
    viol: a.net.peer.info().violations,
    snapPot: snap.pot,
    beforePot,
    forgedPot: forged.view.pot,
    truePot: rig.room.info().pot,
    base,
  };
}

test('nui/27 patch 上的权威数字篡改：六种注入每一种都被纯客户端恒等式抓住、不采纳、并停手（rev=11 必修 1）', () => {
  const want: [Forge, RegExp][] = [
    ['pot', /pot \d+ != sum\(committed\)/],
    ['my-chips', /seat \d+ chips\+committed/],
    ['my-committed', /pot \d+ != sum\(committed\)/],
    ['other-chips', /seat \d+ chips\+committed/],
    // 这一支是**故意**让 (a) 放过去的：committed 与 pot 一起改，两数仍然相等 ⇒ 只能靠手内恒定抓
    ['committed-and-pot', /chips\+committed .* != /],
    // 这一支专门给 (d)：多塞一个 committed=0 的假座位 ⇒ (a) 与逐座位都放行，只有全桌总和对不上
    ['extra-seat', /table chips\+committed/],
  ];
  for (const [kind, re] of want) {
    const got = forgePatch(kind);
    assert.ok(got.viol.length > 0, `${kind}：改了数字却没被抓 ⇒ 那道墙只认牌面不认钱`);
    assert.match(String(got.viol.at(-1)), re, `${kind}：判据要指得出是哪条恒等式破了，实得 ${JSON.stringify(got.viol)}`);
    assert.equal(got.a.net.info().untrusted, true, `${kind}：抓到越界必须判这一局不可信`);
    // 只有动过池的那两支才有“假池不许进快照”可断言；没动池的支数由上面那条 beforePot 等式覆盖
    if (kind === 'pot' || kind === 'committed-and-pot') {
      assert.notEqual(got.snapPot, got.forgedPot, `${kind}：被拒的那一帧不许进快照（假数字一个字都不该出现）`);
    }
    assert.equal(got.snapPot, got.beforePot, `${kind}：页面停在**上一帧被采纳的好数字**上，而不是权威最新值`);
    // 权威侧一位没动：下行改不了服务端的池。而"被拒"不许吞掉 seq ⇒ 把**同一条 patch 的诚实原件**再喂一次，
    // 它必须接得上并被正常采纳（这一条不依赖任何定时器形状，是纯确定性的）。
    assert.equal(got.truePot, got.base.view.pot, `${kind}：服务端自己的池额不许被下行改写（房间那本账一位没动）`);
    const seqBefore = got.a.net.info().seq;
    const violBefore = got.a.net.peer.info().violations.length;
    for (const up of got.a.net.onText(JSON.stringify(got.base))) got.rig.room.receiveText(got.a.conn, up);
    assert.equal(got.a.net.info().seq, seqBefore + 1, `${kind}：被拒的那一帧不该吞掉 seq（诚实原件仍要接得上）`);
    assert.equal(got.a.net.peer.info().violations.length, violBefore, `${kind}：诚实原件不该被误判成新的越界`);
    assert.equal(got.a.net.snapshot().pot, got.rig.room.info().pot, `${kind}：采纳之后页面回到权威数字`);
    assert.equal(got.a.net.info().untrusted, true, `${kind}：停手不会因为下一帧合法就自动解除`);
    assert.equal(got.a.net.snapshot().buttons.length, 1, `${kind}：五个动作该塌成一个"已停手"`);
    assert.match(String(got.a.net.snapshot().buttons[0]?.text), /已停手/);
    assert.equal(got.a.net.act({ kind: 'call' }).sent, false, `${kind}：停手之后不许还发得出上行`);
    assert.match(String(got.a.net.act({ kind: 'call' }).why), /peer flagged the server/);
    // 另一家（没被注入）不受牵连：它那边零越界
    assert.deepEqual(got.b.net.peer.info().violations, [], `${kind}：注入只落到甲那一条连接，乙不该被误伤`);
    assert.equal(got.rig.room.info().fault, null);
  }
  note('nui/27 六种 patch 数字注入各被恒等式抓住：(a) 抓 pot/committed，逐座位恒定抓两家 chips 与"committed+pot 一起改"那一支，(d) 抓凭空多出来的假座位；被拒帧不采纳，页面停在已停手');
});

test('nui/28 诚实流量上恒等式不误报：三手多路行动逐帧采样，violations 恒空（误报与漏报同罪）', () => {
  // 复审的判据是"control 那一支的 78 次采样仍然 0 不符 ⇒ 不许靠放宽检查来换绿"。
  // 这里是它的无头版：真房间 + 真墙，看牌 / 跟注 / 加注 / 比牌 / 结算 / 换手都走一遍，
  // 每一帧都问一次"墙有没有说话"，并要求采样数足够大（不是空转）。
  const rig = openRig(3, { settleMs: 200, handGapMs: 4000, turnMs: 1200 });
  const a = rig.join('甲');
  const b = rig.join('乙');
  const c = rig.join('丙');
  rig.start();
  let sampled = 0;
  const sample = (tab: Tab): void => {
    sampled += 1;
    assert.deepEqual(tab.net.peer.info().violations, [], `第 ${String(sampled)} 次采样冒出越界：${JSON.stringify(tab.net.peer.info().violations)}`);
    assert.equal(tab.net.info().untrusted, false, '诚实流量不该把任何一侧判成不可信');
  };
  for (let hand = 1; hand <= 3; hand += 1) {
    for (let step = 0; step < 120; step += 1) {
      rig.pumpAll();
      sample(a);
      sample(b);
      sample(c);
      const t = rig.turnTab();
      if (t === null) break;
      const me = t.net.peer.viewOf()?.seats.find((s) => s.seat === t.net.info().seat);
      const others = (t.net.peer.viewOf()?.seats ?? []).filter((s) => s.seat !== t.net.info().seat && s.active);
      // 三种意图轮着来；加注会撞注级上限，被服务端**拒**也算走过这条路（拒绝不是越界）
      const pick = ['look', 'call', 'raise', 'compare', 'call'][step % 5] as 'look' | 'call' | 'raise' | 'compare';
      if (pick === 'look' && me !== undefined && !me.looked) rig.act(t, { kind: 'look' });
      else if (pick === 'compare' && me !== undefined && me.looked && others.length > 0) rig.act(t, { kind: 'compare', target: others[0]?.seat ?? 0 });
      else if (pick === 'raise') rig.act(t, { kind: 'raise' });
      else rig.act(t, { kind: 'call' });
    }
    // 走到这一手的终点：靠定时器推进（托管 / 结算）
    for (let step = 0; step < 40 && rig.turnTab() !== null; step += 1) {
      rig.clock.advance(1201);
      rig.pumpAll();
    }
    rig.clock.advance(201);
    rig.pumpAll();
    sample(a);
    sample(b);
    sample(c);
    if (hand < 3) {
      rig.clock.advance(4001);
      rig.pumpAll();
    }
  }
  assert.equal(rig.room.info().fault, null, '房间自检不该有 fault');
  assert.ok(rig.room.info().hand >= 3, `构造前提：至少走完三手，实得第 ${String(rig.room.info().hand)} 手`);
  assert.ok(sampled >= 60, `采样太少（${String(sampled)} 次）⇒ 这条对照等于没比`);
  assert.ok([a, b, c].every((t) => t.net.peer.info().verifiedHand !== null), '三家都该核对通过（诚实流量上揭示核对仍然成立）');
  note(`nui/28 诚实流量 ${String(sampled)} 次逐帧采样、0 处误报；三家都核对通过（靠放宽检查换绿会在这里露馅）`);
});

test('nui/26 per-tab 存储里那坨值是坏 JSON：会话建得起来、当作没有凭据、入桌照常（netplay.ts::readSaved 的 catch）', () => {
  // rev=10 §5(d) 点名 `netplay.ts:126-127`（readSaved 的 catch）可达而未测：这条不是错误分支的装饰，
  // 它是"存储是用户能改的东西"这一层的边界 —— sessionStorage 里躺着半截 JSON 时页面必须照常开牌。
  const rig = openRig(2, { startAt: false });
  const store = makeStore();
  store.set('zjh-m5:session', '{"token":"abc');
  const net = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0xbeef), store });
  assert.equal(net.info().hasToken, false, '坏存储必须降级成"没有凭据"，而不是在建会话那一步抛出来');
  assert.equal(net.resumeWire(), null, '没有可用凭据就不许谎报 resume');

  const tab: Tab = { net, store, conn: 't26', name: '甲', down: [] };
  rig.room.open(tab.conn);
  rig.room.receiveText(tab.conn, net.joinWire());
  net.markOpen();
  rig.tabs.push(tab);
  rig.join('乙');
  rig.start();
  rig.pumpAll();
  assert.equal(net.info().seat >= 0, true, '降级之后要能像一页全新的那样正常入桌拿到座位');
  assert.equal(net.info().hand >= 1, true, '这一页也得进得了局');
  assert.deepEqual(net.info().trustLines, [], '坏存储不该冒出任何越界');
  assert.match(store.get('zjh-m5:session') ?? '', /"token"/, '会话要把**新**凭据写回去（坏值只是被忽略，不是从此拒绝写）');
  assert.equal(net.snapshot().started, true);

  // 对照：同一份存储里放一条**结构合法**的凭据 ⇒ resumeWire 出得来（证明上面那条 null 不是把路写死）
  const good = makeStore();
  good.set('zjh-m5:session', JSON.stringify({ token: 'T'.repeat(20), seat: 1, hand: 1, name: '甲', share: null }));
  const revived = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0xcafe), store: good });
  assert.equal(revived.info().hasToken, true, '合法凭据应当被认出来');
  assert.ok(revived.resumeWire() !== null, '合法凭据必须能构造 resume ⇒ 否则前一段的断言是空转');
  assert.equal(rig.room.info().fault, null);
  note('nui/26 坏 JSON 降级为"没有凭据"、入桌照常、新凭据写回；对照：合法凭据能构造 resume');
});

// ——— rev=13 · Q7 裁定 = B：停手是**标签页级**的 ———
// 要堵的洞不在"服务端掐线"（那条路复用同一个 peer，本来就洗不掉），而在玩家最自然的那两下点击：
// 「断开」→「连接」在 main.ts 里新建一个 peer，violations 随旧 peer 一起丢 ⇒ 警告被静默抹掉。
// 这两条用例钉的就是：判定结果活过重建、四操作不清、再抓只涨次数、坏账不造停手。

test('nui/29 停手粘在标签页上：重连新建的会话仍然停手；再被抓只递增次数、不改首条；新标签页干净（Q7 = B）', () => {
  const got = forgePatch('pot');
  const store = got.a.store;
  const firstViol = String(got.viol.at(-1));

  // ① 落账：被抓的那一帧就把判定写进这个标签页的存储（写真源只许 peer.info()）
  const raw = store.get('zjh-m5:untrusted');
  assert.ok(raw !== null, '被抓之后标签页账必须落盘');
  const rec = JSON.parse(raw ?? '{}') as { count?: unknown; first?: unknown; hand?: unknown };
  assert.equal(rec.count, 1, `首世该记 1 次，实得 ${String(raw)}`);
  assert.equal(rec.first, firstViol, '账里存的就是那一条越界原文');
  assert.equal(typeof rec.hand, 'number', '还要带上手号');

  // ② 「断开」→「连接」：main.ts:152-156 那条路的替身 = 同一份 store 上再 createNet。
  //    新 peer 的 violations 是空的 ⇒ 没有粘性就会被洗掉，这正是裁定要堵的洞。
  const back = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0xbeef), store });
  assert.deepEqual(back.peer.info().violations, [], '前提：这一世那道墙本身是干净的 ⇒ 停手只能是继承来的');
  assert.equal(back.info().untrusted, true, '同一标签页重连 ⇒ 仍然判不可信');
  assert.equal(back.act({ kind: 'call' }).sent, false, '继承来的停手也必须发不出行动');
  assert.match(String(back.act({ kind: 'call' }).why), /只有关闭本标签页/, '为什么发不出去要说得出口');
  const lines0 = back.info().trustLines.join(' / ');
  assert.match(lines0, /本标签页曾判不可信 1 次/, `横幅要带次数：${lines0}`);
  assert.match(lines0, /只有关闭本标签页才能解除/, `横幅要说出唯一解除方式：${lines0}`);
  assert.ok(lines0.includes(firstViol), '还要把首条原文带出来，玩家才知道当初判的是什么');
  // 这一世还没有任何下行 ⇒ 页面走 collect 那一段，但提示行必须已经在（读取先于首帧）
  assert.match(back.snapshot().note ?? '', /只有关闭本标签页/, '警告位在第一条下行到达之前就该说话');

  // ③ 再来一次「断开→连接」，并把当年那条**诚实**快照喂回去 ⇒ 这一世的墙一条都不报，
  //    但按钮必须塌（与会话级停手同一条出口，不新造一套塌陷逻辑）
  const back2 = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0xc0de), store });
  assert.equal(back2.info().untrusted, true, '再"断开→连接"一次仍然停手');
  // 把当年那些**诚实**下行按原顺序回放到第一条 view 为止 ⇒ 这一世的墙一条都不报，
  // 但按钮必须塌（与会话级停手同一条出口，不新造一套塌陷逻辑）。
  // 为什么要回放一整段而不是一条 view：`rules` 是 hello 回执里带回来的，只喂 view 会停在 collect 那一段。
  const honest = got.a.down.slice(0, got.a.down.findIndex((s) => (JSON.parse(s) as { t?: string }).t === 'view') + 1);
  assert.ok(honest.length > 1, `构造前提：第一条 view 之前还要有 hello 回执之类的下行，实得 ${String(honest.length)} 条`);
  for (const s of honest) back2.onText(s);
  assert.deepEqual(back2.peer.info().violations, [], '诚实快照不该被误判成新的越界');
  assert.equal(store.get('zjh-m5:untrusted'), raw, '重连且没再被抓 ⇒ 账一位没动（重连不会自己涨数）');
  const snapOk = back2.snapshot();
  assert.equal(snapOk.started, true, '前提：这一世确实拿到了局面');
  assert.equal(snapOk.buttons.length, 1, `五个动作该塌成一个"已停手"，实得 ${JSON.stringify(snapOk.buttons.map((b) => b.text))}`);
  assert.match(String(snapOk.buttons[0]?.text), /已停手/);
  assert.equal(back2.act({ kind: 'call' }).sent, false, '有局面也不许发得出去');
  const potGood = snapOk.pot;

  // ④ 这一世再被抓一次：count 递增、first 不变；且**地板不替代** —— 逐帧复检照旧在跑、被拒帧照样不采纳
  const forged = JSON.parse(JSON.stringify(got.base)) as typeof got.base;
  forged.view.pot += 100;
  back2.onText(JSON.stringify({ t: 'view', hand: forged.hand, seq: forged.seq, view: forged.view }));
  assert.ok(back2.peer.info().violations.length > 0, '新会话里再篡改 ⇒ 那一世自己的墙仍然要响');
  assert.equal(back2.snapshot().pot, potGood, '被拒的那一帧不许进快照（粘性不是拿来替代复检的）');
  const rec2Raw = String(store.get('zjh-m5:untrusted'));
  const rec2 = JSON.parse(rec2Raw) as { count: number; first: string; hand: number };
  assert.equal(rec2.count, 2, `第二世再被抓 ⇒ 次数递增，实得 ${rec2Raw}`);
  assert.equal(rec2.first, firstViol, '而"首条"永远是当年那一条');
  assert.match(back2.info().trustLines.join(' / '), /曾判不可信 2 次/, '横幅跟着报真实次数');

  // ⑤ 四种操作一律不清（这里演两种：重新入桌与换 URL 走的都是 joinWire 那一步）：
  //    它清的是**凭据**那把键，粘性那把一位都不许动
  back2.joinWire();
  assert.equal(back2.info().untrusted, true, 'joinWire（重新入桌 / 换房间 URL）不清粘性');
  assert.equal(String(store.get('zjh-m5:untrusted')), rec2Raw, '重新入桌也不动账');
  assert.equal(store.get('zjh-m5:session'), null, '对照：joinWire 确实清了凭据那把键 ⇒ 两把键各管各的，不是顺手一起清');

  // ⑤ 对照：新标签页（另一份 sessionStorage）= 干净 —— 解除只有一条路
  const fresh = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x5eed), store: makeStore() });
  assert.equal(fresh.info().untrusted, false, '关闭标签页是唯一解除路径 ⇒ 新标签页不该带着旧账');
  assert.deepEqual(fresh.info().trustLines, [], '新标签页一条提示都不该有');
  assert.equal(got.rig.room.info().fault, null);
  note('nui/29 停手粘在标签页上：重连仍停手、joinWire/换 URL/再重连都不清、再抓 count 递增 first 不变、按钮塌同一条出口、新标签页干净');
});

test('nui/30 标签页账的读判据：坏 JSON 与形状不对一律降级成"没有"，合法账哪怕次数很大也照实停手（两把键互不牵连）', () => {
  const rig = openRig(2, { settleMs: 200, handGapMs: 60000, turnMs: 5000 });
  const a = rig.join('甲');
  rig.pumpAll();

  // 坏 JSON ⇒ 不造停手（与 readSaved 同一降级口径：坏存储不许凭空判人有罪，也不许把页面搞崩）
  const junk = makeStore();
  junk.set('zjh-m5:untrusted', '{不是 JSON');
  const j = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x1111), store: junk });
  assert.equal(j.info().untrusted, false, '读不出一个形状正确的记录就当作没有');
  assert.deepEqual(j.info().trustLines, [], '坏账不该冒出任何提示');

  // 形状不对的三种：first 空、count < 1、hand 缺 —— 判据不掺猜测
  for (const bad of [
    JSON.stringify({ count: 3, first: '', hand: 1 }),
    JSON.stringify({ count: 0, first: 'pot 104 != sum(committed) 4', hand: 1 }),
    JSON.stringify({ count: 2, first: 'pot 104 != sum(committed) 4' }),
  ]) {
    const s = makeStore();
    s.set('zjh-m5:untrusted', bad);
    const n = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x2222), store: s });
    assert.equal(n.info().untrusted, false, `形状不对的账不许判停手：${bad}`);
  }

  // 合法但次数很大 ⇒ 照实停手、照实报数，且 act 发不出去
  const big = makeStore();
  big.set('zjh-m5:untrusted', JSON.stringify({ count: 7, first: 'pot 104 != sum(committed) 4', hand: 3 }));
  const bn = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x3333), store: big });
  assert.equal(bn.info().untrusted, true);
  assert.equal(bn.act({ kind: 'call' }).sent, false, '合法账 ⇒ 行动一律发不出去');
  assert.match(bn.info().trustLines.join(' / '), /曾判不可信 7 次.*首条：pot 104 != sum\(committed\) 4/s, '次数与首条原文都要带出来');

  // 两把键互不牵连：坏**凭据**不清粘性、坏**粘性**不影响凭据路径
  const both = makeStore();
  both.set('zjh-m5:session', '{坏掉的凭据');
  both.set('zjh-m5:untrusted', JSON.stringify({ count: 1, first: 'table chips+committed 900 != 768 (同一手内应恒定)', hand: 2 }));
  const bt = createNet({ name: '甲', buyIn: 256, entropy: counterEntropy(0x4444), store: both });
  assert.equal(bt.info().hasToken, false, '坏凭据仍按"没有凭据"处理');
  assert.equal(bt.info().untrusted, true, '而粘性照旧 —— 一把键坏不掉另一把');
  assert.equal(a.net.info().untrusted, false, '对照：这一页从没被抓过，不该有粘性');
  assert.equal(rig.room.info().fault, null);
  note('nui/30 标签页账：坏 JSON/形状不对一律降级成"没有"，合法账照实停手并报次数；与凭据那把键互不牵连');
});
