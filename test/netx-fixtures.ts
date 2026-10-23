// M4 测试工装：虚拟时钟 + 房间↔客户端的环线（loopback）。
// 目的是让"联机"这件事在无网络、无真实定时器的条件下被逐字节断言（工单 §0.5 双跑一致）。
// 本文件是测试工装，允许用 node 内置模块。
import { createRoom } from '../netx/room.ts';
import type { Clock, Room, RoomInfo } from '../netx/room.ts';
import { createPeer } from '../netx/client.ts';
import type { Peer } from '../netx/client.ts';
import { encodeUp } from '../netx/protocol.ts';
import type { Down, Move, Up } from '../netx/protocol.ts';

// 注入给房间的 Clock 只有"到点叫我"这一项义务；now/advance/pending/nextDue 是夹具自己的观测面，
// 用来断言到期时间，不参与被验收的代码（rev=8 应修 4：netx/ 里不存在读钟的路径）。
export type FakeClock = Clock & {
  now(): number;
  advance(ms: number): void;
  pending(): number;
  nextDue(): number | null;
};

type Timer = { due: number; seq: number; fn: () => void };

export function fakeClock(startMs = 0): FakeClock {
  let nowMs = startMs;
  let seq = 0;
  const timers: Timer[] = [];
  return {
    now(): number {
      return nowMs;
    },
    after(ms: number, fn: () => void): () => void {
      const t: Timer = { due: nowMs + ms, seq: (seq += 1), fn };
      timers.push(t);
      return () => {
        const at = timers.indexOf(t);
        if (at >= 0) timers.splice(at, 1);
      };
    },
    // 按到期先后触发；回调里新产生的定时器也在同一轮里参与排序（确定性）
    advance(ms: number): void {
      const limit = nowMs + ms;
      for (;;) {
        const due = timers.filter((t) => t.due <= limit).sort((a, b) => a.due - b.due || a.seq - b.seq)[0];
        if (due === undefined) break;
        timers.splice(timers.indexOf(due), 1);
        nowMs = due.due;
        due.fn();
      }
      nowMs = limit;
    },
    pending(): number {
      return timers.length;
    },
    nextDue(): number | null {
      if (timers.length === 0) return null;
      return Math.min(...timers.map((t) => t.due));
    },
  };
}

// 确定性"随机"：每次给出稳定、互不相同、只含十六进制的 32 字符串
export function counterEntropy(start = 0x12345678): () => string {
  let n = start;
  return () => {
    n += 1;
    return n.toString(16).padStart(8, '0').repeat(4);
  };
}

export type RigOptions = {
  seats?: number;
  turnMs?: number;
  nonceMs?: number;
  settleMs?: number;
  handGapMs?: number;
  firstDealer?: number;
  minBuyIn?: number;
};

export type Wire = { dir: 'up' | 'down'; index: number; text: string };

export type Rig = {
  room: Room;
  clock: FakeClock;
  peers: Peer[];
  join(name?: string, buyIn?: number): number;
  drop(index: number): void;
  reconnect(index: number): void;
  up(index: number, msg: Up): void;
  raw(index: number, text: string): void;
  act(index: number, move: Move): string | null;
  rejectOf(index: number): { code: string; why: string } | null;
  settle(): void;
  wire(): Wire[];
  wireText(dir: 'up' | 'down' | 'both'): string[];
  info(): RoomInfo;
  turnOf(index: number): number;
  connOf(index: number): string;
  myTurn(index: number): boolean;
  seatOf(index: number): number;
};

export function createRig(options: RigOptions = {}): Rig {
  const clock = fakeClock(1000);
  const seatCount = options.seats ?? 3;
  const room = createRoom({
    seats: Array.from({ length: seatCount }, (_, i) => ({ seat: i, name: `桌客${String(i)}` })),
    firstDealer: options.firstDealer ?? 0,
    clock,
    entropy: counterEntropy(),
    minBuyIn: options.minBuyIn,
    turnMs: options.turnMs ?? 30000,
    nonceMs: options.nonceMs ?? 15000,
    settleMs: options.settleMs ?? 4000,
    handGapMs: options.handGapMs ?? 6000,
  });
  room.start();
  const peers: Peer[] = [];
  const ids: string[] = [];
  const wire: Wire[] = [];
  let connSeq = 0;

  function open(): string {
    connSeq += 1;
    const id = `r${String(connSeq)}`;
    room.open(id);
    return id;
  }

  function peerAt(i: number): Peer {
    const p = peers[i];
    if (p === undefined) throw new Error(`no peer at ${String(i)}`);
    return p;
  }

  function sendUp(index: number, up: Up): void {
    const id = ids[index] ?? '';
    const text = encodeUp(up);
    wire.push({ dir: 'up', index, text });
    room.receiveText(id, text);
  }

  // 双向泵到静默：客户端的回应一定在下一轮才抵达服务端（不是同步函数调用）
  function settle(): void {
    for (let round = 0; round < 400; round += 1) {
      let activity = false;
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        if (id === undefined || id === '') continue;
        const down = room.pending(id);
        if (down.length === 0) continue;
        activity = true;
        for (const msg of down) {
          const text = JSON.stringify(msg);
          wire.push({ dir: 'down', index: i, text });
          for (const up of peerAt(i).inbound(text)) sendUp(i, up);
        }
      }
      if (!activity) return;
    }
    throw new Error('rig did not reach quiescence (possible ping-pong loop)');
  }

  return {
    room,
    clock,
    peers,
    join(name, buyIn) {
      const id = open();
      const index = peers.length;
      peers.push(
        createPeer({
          name: name ?? `玩家${String(index)}`,
          buyIn: buyIn ?? 256,
          entropy: counterEntropy(index * 0x01010101),
        }),
      );
      ids.push(id);
      sendUp(index, peerAt(index).hello());
      settle();
      return index;
    },
    drop(index) {
      const id = ids[index];
      if (id === undefined || id === '') return;
      room.close(id);
      ids[index] = '';
      settle();
    },
    reconnect(index) {
      const peer = peers[index];
      if (peer === undefined) throw new Error('no such peer');
      const up = peer.resume();
      if (up === null) throw new Error('peer has no token yet');
      const conn = open();
      ids[index] = conn;
      sendUp(index, up);
      settle();
    },
    up(index, msg) {
      if (ids[index] === undefined || ids[index] === '') throw new Error('peer is not connected');
      sendUp(index, msg);
      settle();
    },
    // 线上原始字节：用来喂"协议层面就不合法"的消息（夹带 seat、自造 kind 等）
    raw(index, text) {
      const id = ids[index];
      if (id === undefined || id === '') throw new Error('peer is not connected');
      wire.push({ dir: 'up', index, text });
      room.receiveText(id, text);
      settle();
    },
    act(index, move) {
      const peer = peers[index];
      if (peer === undefined) throw new Error('no such peer');
      const { up, why } = peer.act(move);
      if (up === null) return why ?? 'refused';
      this.up(index, up);
      return null;
    },
    rejectOf(index) {
      // 审计面（服务端对这一家说过的最后一条拒绝），不是提示行那个"仍描述当前处境"的 lastReject：
      // 后者会在我发出下一个行动时过期（rev=10 应修 4），拿它当历史会把既有用例读成 undefined。
      const all = peerAt(index).info().rejects;
      return all.length > 0 ? (all[all.length - 1] as { code: string; why: string }) : null;
    },
    settle,
    wire() {
      return [...wire];
    },
    wireText(dir) {
      return wire.filter((w) => dir === 'both' || w.dir === dir).map((w) => w.text);
    },
    info() {
      return room.info();
    },
    turnOf(index) {
      const v = peerAt(index).viewOf();
      return v === null ? -2 : v.turn;
    },
    connOf(index) {
      return ids[index] ?? '';
    },
    myTurn(index) {
      const v = peerAt(index).viewOf();
      return v !== null && v.phase === 'betting' && v.turn === peerAt(index).info().seat;
    },
    seatOf(index) {
      return peerAt(index).info().seat;
    },
  };
}

export type { Down, Move, Peer, Room, RoomInfo, Up };

// 走一步：轮到谁谁动（没看牌先看牌，然后一律跟；服务端说付不起就弃牌）。
// 这是驱动器不是断言 —— 规则判定仍然只在服务端。
export function stepOnce(rig: Rig): boolean {
  if (rig.info().phase !== 'betting') return false;
  let idx = -1;
  for (let i = 0; i < rig.peers.length; i += 1) {
    if (rig.myTurn(i)) {
      idx = i;
      break;
    }
  }
  if (idx < 0) throw new Error('没有任何一家轮得到（可能全掉线了）');
  const peer = rig.peers[idx] as Peer;
  const view = peer.viewOf();
  if (view === null) throw new Error('peer has no view');
  const me = view.seats.find((s) => s.seat === peer.info().seat);
  if (me === undefined) throw new Error('peer is not in this hand');
  const before = rig.rejectOf(idx);
  const move: Move = me.looked ? { kind: 'call' } : { kind: 'look' };
  const why = rig.act(idx, move);
  if (why !== null) throw new Error(`驱动被客户端拒绝：${why}`);
  const after = rig.rejectOf(idx);
  if (after !== null && after !== before && after.code === 'cannot_afford') {
    const alt = rig.act(idx, { kind: 'fold' });
    if (alt !== null) throw new Error(`弃牌也被拒：${alt}`);
  }
  return true;
}

export function stepTimes(rig: Rig, n: number): number {
  let done = 0;
  for (let i = 0; i < n; i += 1) {
    if (!stepOnce(rig)) break;
    done += 1;
  }
  return done;
}

export function driveToSettle(rig: Rig, maxSteps = 80): number {
  for (let steps = 0; steps < maxSteps; steps += 1) {
    if (!stepOnce(rig)) return steps;
  }
  throw new Error(`一手牌在 ${String(maxSteps)} 步内没走完`);
}

// 走完整一手：行动 → 结算定时器 → 揭示
export function finishHand(rig: Rig, settleMs = 4000): number {
  const steps = driveToSettle(rig);
  rig.clock.advance(settleMs);
  rig.settle();
  return steps;
}
