// M4 · RFC 6455 帧编解码（自己实现，不引第三方 ws 包）。
// 为什么自己写：工单 §3.7 钉着 dependencies={}，而"届时安装 ws"从未在任何一轮裁定里真正落到
// 白名单上（已在 QUESTIONS.md Q5 提出，2026-09-26 裁定：不扩白名单、零依赖手写）。手写版本还顺带带来一条硬证据 ——
// test/netx-ws.test.ts 用 Node 内置的 WebSocket 客户端（另一套独立实现）打真实 socket，
// 握手与分帧能互通，说明这里实现的是标准协议，不是自说自话的私有格式。
//
// 严格度按"服务端收不可信客户端"来定：掩码必须存在且形式正确、长度必须最小编码、RSV 位必须为 0、
// 控制帧不得分片且 payload ≤125、close code 必须合法、消息总长有上限。每条都有对应用例。
//
// 本文件零 IO、零时钟：只做 Uint8Array ↔ 帧的双向转换，socket 接线在 netx/ws.ts。

import { MAX_MESSAGE_BYTES } from './protocol.ts';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'; // RFC 6455 §1.3 固定常量

export const OPCODE = {
  cont: 0x0,
  text: 0x1,
  binary: 0x2,
  close: 0x8,
  ping: 0x9,
  pong: 0xa,
} as const;

export const MAX_FRAME_PAYLOAD = MAX_MESSAGE_BYTES;

export class FrameError extends Error {
  code: string;

  constructor(code: string, msg: string) {
    super(`ws frame error: ${code} — ${msg}`);
    this.name = 'FrameError';
    this.code = code;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  const at = (i: number): string => B64.charAt(i);
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8) | (bytes[i + 2] as number);
    out += at((n >> 18) & 63) + at((n >> 12) & 63) + at((n >> 6) & 63) + at(n & 63);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] as number) << 16;
    out += at((n >> 18) & 63) + at((n >> 12) & 63) + '==';
  } else if (rest === 2) {
    const n = ((bytes[i] as number) << 16) | ((bytes[i + 1] as number) << 8);
    out += at((n >> 18) & 63) + at((n >> 12) & 63) + at((n >> 6) & 63) + '=';
  }
  return out;
}

// 握手按 RFC 6455 规定用 SHA-1 —— 这不是我们挑的强度，而是协议写死的算法；
// 这里唯一需要的性质是"两端算得一样"（accept 值由客户端自己发的 key 推导，不涉及抗碰撞）。
// 承诺与种子合成一律用 netx/sha256.ts 的 SHA-256。
function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

export function sha1(bytes: Uint8Array): Uint8Array {
  const total = Math.floor((bytes.length + 9 + 63) / 64) * 64;
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const bitLen = bytes.length * 8;
  const view = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  view.setUint32(total - 8, Math.floor(bitLen / 4294967296));
  view.setUint32(total - 4, bitLen % 4294967296);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i += 1) w[i] = rotl(((w[i - 3] as number) ^ (w[i - 8] as number) ^ (w[i - 14] as number) ^ (w[i - 16] as number)) >>> 0, 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i += 1) {
      let f = 0;
      let k = 0;
      if (i < 20) {
        f = ((b & c) | (~b & d)) >>> 0;
        k = 0x5a827999;
      } else if (i < 40) {
        f = (b ^ c ^ d) >>> 0;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = ((b & c) | (b & d) | (c & d)) >>> 0;
        k = 0x8f1bbcdc;
      } else {
        f = (b ^ c ^ d) >>> 0;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + (w[i] as number)) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer, out.byteOffset, out.byteLength);
  ov.setUint32(0, h0);
  ov.setUint32(4, h1);
  ov.setUint32(8, h2);
  ov.setUint32(12, h3);
  ov.setUint32(16, h4);
  return out;
}

// 握手 Sec-WebSocket-Accept = Base64(SHA-1(key + GUID))。
// 已知向量：'dGhlIHNhbXBsZSBub25jZQ==' → 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='（RFC 6455 §1.3）
//
// key 的校验口径（2026-09-28 rev=9 复审 §4.4 裁定：维持现状，但必须把话写在这里）：
// 只要求"存在 + 可见 ASCII 1..128"，**不**校验它是不是 16 字节熵的 base64（即不要求 24 字符带 '==' 那种形状）。
// 依据：RFC 6455 §4.2.2 对服务端只要求该字段存在，值的形状是客户端的事（§1.3 的注释明说服务端不必检查）；
// 放宽也不产生可利用面 —— Accept 由 SHA-1 派生，客户端伪造 key 只会让它自己握不上手。
// 反面：非 ASCII / 空 / 超长（>128）仍然抛 bad_key ⇒ ws.ts 那条 400 分支有实际含义（见 ws/05、frame/15）。
// 待办（记进 SELF-REVIEW 下一轮）：若将来本服务端被放在会重写头字段的前置代理之后，
// 需把这条收紧到严格 24 字符 base64（`/^[\dA-Za-z+/]{22}==$/`）——那时"透传的 key 形状"就不再可信了。
export function handshakeAccept(secWebSocketKey: string): string {
  if (!/^[\x21-\x7e]{1,128}$/.test(secWebSocketKey)) {
    throw new FrameError('bad_key', 'Sec-WebSocket-Key must be a visible ASCII token');
  }
  return bytesToBase64(sha1(new TextEncoder().encode(secWebSocketKey + GUID)));
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export type FrameOpts = { maskKey?: Uint8Array; fin?: boolean };

function headerBytes(opcode: number, len: number, masked: boolean, fin: boolean): number[] {
  if (len > MAX_FRAME_PAYLOAD) throw new FrameError('too_large', `payload ${String(len)} beyond frame limit`);
  const b0 = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  const maskBit = masked ? 0x80 : 0x00;
  if (len <= 125) return [b0, maskBit | len];
  if (len <= 0xffff) {
    return [b0, maskBit | 126, (len >> 8) & 255, len & 255];
  }
  if (Number.isSafeInteger(len)) {
    return [
      b0,
      maskBit | 127,
      0,
      0,
      0,
      0,
      (len >>> 24) & 255,
      (len >>> 16) & 255,
      (len >>> 8) & 255,
      len & 255,
    ];
  }
  throw new FrameError('too_large', `payload ${String(len)} beyond safe integer range`);
}

// 不给 maskKey = 服务端方向（不得掩码）；给 = 客户端方向（必须掩码，掩码键紧跟长度字段）。
export function encodeFrame(opcode: number, payload: Uint8Array, opts?: FrameOpts): Uint8Array {
  const maskKey = opts?.maskKey;
  const fin = opts?.fin !== false;
  const head = headerBytes(opcode, payload.length, maskKey !== undefined, fin);
  if (maskKey !== undefined && maskKey.length !== 4) {
    throw new FrameError('bad_mask', 'a client frame needs exactly a 4-byte mask key');
  }
  const withMask =
    maskKey === undefined
      ? head
      : [...head, (maskKey[0] as number) & 255, (maskKey[1] as number) & 255, (maskKey[2] as number) & 255, (maskKey[3] as number) & 255];
  const out = new Uint8Array(withMask.length + payload.length);
  out.set(withMask);
  if (maskKey === undefined) {
    out.set(payload, withMask.length);
  } else {
    for (let i = 0; i < payload.length; i += 1) {
      out[withMask.length + i] = ((payload[i] as number) ^ (maskKey[i % 4] as number)) & 255;
    }
  }
  return out;
}

export function encodeText(text: string, opts?: FrameOpts): Uint8Array {
  return encodeFrame(OPCODE.text, encoder.encode(text), opts);
}

// 一条文本消息拆成两帧（首帧 FIN=0 + 续帧）。只给分片路径的用例用。
export function encodeTextFragmented(text: string, splitAt: number, opts?: FrameOpts): Uint8Array[] {
  const bytes = encoder.encode(text);
  if (splitAt < 0 || splitAt > bytes.length) throw new FrameError('bad_split', 'split point outside payload');
  return [
    encodeFrame(OPCODE.text, bytes.slice(0, splitAt), { ...opts, fin: false }),
    encodeFrame(OPCODE.cont, bytes.slice(splitAt), opts),
  ];
}

export function encodeClose(code: number, reason = '', opts?: FrameOpts): Uint8Array {
  const text = encoder.encode(reason);
  const payload = new Uint8Array(2 + text.length);
  payload[0] = (code >> 8) & 255;
  payload[1] = code & 255;
  payload.set(text, 2);
  return encodeFrame(OPCODE.close, payload, opts);
}

export function encodePing(payload: Uint8Array, opts?: FrameOpts): Uint8Array {
  return encodeFrame(OPCODE.ping, payload, opts);
}

export function encodePong(payload: Uint8Array, opts?: FrameOpts): Uint8Array {
  return encodeFrame(OPCODE.pong, payload, opts);
}

export type Inbound =
  | { kind: 'text'; text: string }
  | { kind: 'ping'; payload: Uint8Array }
  | { kind: 'pong'; payload: Uint8Array }
  | { kind: 'close'; code: number; reason: string };

// 线上允许出现的 close code（1004/1005/1006/1015 是保留值，不得出现在帧里）
export function closeCodeAllowed(code: number): boolean {
  return (code >= 1000 && code <= 1003) || (code >= 1007 && code <= 1011) || (code >= 3000 && code <= 4999);
}

function decodeClose(payload: Uint8Array): { code: number; reason: string } {
  if (payload.length === 0) return { code: 1005, reason: '' };
  if (payload.length === 1) throw new FrameError('bad_close', 'close payload must be 0 or >=2 bytes');
  const code = ((payload[0] as number) << 8) | (payload[1] as number);
  if (!closeCodeAllowed(code)) throw new FrameError('bad_close', `illegal close code ${String(code)}`);
  let reason = '';
  if (payload.length > 2) {
    try {
      reason = decoder.decode(payload.slice(2));
    } catch {
      throw new FrameError('bad_close', 'close reason is not valid UTF-8');
    }
  }
  return { code, reason };
}

function decodeText(payload: Uint8Array): string {
  try {
    return decoder.decode(payload);
  } catch {
    throw new FrameError('bad_utf8', 'text payload is not valid UTF-8');
  }
}

type RawFrame = { fin: boolean; opcode: number; payload: Uint8Array };

// 增量解帧器。
//   masked=true ⇒ 服务端收客户端（每个客户端帧必须掩码）
//   masked=false ⇒ 客户端收服务端（服务端帧不得掩码）
// 一次 push 可以喂任意多的字节（TCP 分包/粘包都覆盖到了）。
export class FrameReader {
  private readonly masked: boolean;
  private readonly maxMessage: number;
  private buf: Uint8Array;
  private fragOpcode = -1;
  private fragChunks: Uint8Array[] = [];
  private fragSize = 0;

  constructor(opts: { masked: boolean; maxMessageBytes?: number }) {
    this.masked = opts.masked;
    this.maxMessage = opts.maxMessageBytes ?? MAX_FRAME_PAYLOAD;
    this.buf = new Uint8Array(0);
  }

  // 还有半帧没收拢时不许假装能读
  waitingForMore(): boolean {
    return this.fragOpcode >= 0 || this.buf.length > 0;
  }

  push(chunk: Uint8Array): Inbound[] {
    if (chunk.length > 0) {
      const merged = new Uint8Array(this.buf.length + chunk.length);
      merged.set(this.buf);
      merged.set(chunk, this.buf.length);
      this.buf = merged;
    }
    const out: Inbound[] = [];
    for (;;) {
      const taken = this.takeFrame();
      if (taken === null) break;
      out.push(...this.consume(taken));
    }
    return out;
  }

  private consume(taken: RawFrame): Inbound[] {
    const isControl = (taken.opcode & 0x8) !== 0;
    if (isControl) {
      if (!taken.fin) throw new FrameError('control_fragmented', 'control frames must not be fragmented');
      if (taken.payload.length > 125) {
        throw new FrameError('control_too_long', `control payload ${String(taken.payload.length)} > 125`);
      }
      if (taken.opcode === OPCODE.close) {
        const c = decodeClose(taken.payload);
        return [{ kind: 'close', code: c.code, reason: c.reason }];
      }
      if (taken.opcode === OPCODE.ping) return [{ kind: 'ping', payload: taken.payload }];
      if (taken.opcode === OPCODE.pong) return [{ kind: 'pong', payload: taken.payload }];
      throw new FrameError('bad_opcode', `unknown control opcode 0x${taken.opcode.toString(16)}`);
    }

    if (taken.opcode === OPCODE.cont) {
      if (this.fragOpcode < 0) throw new FrameError('bad_opcode', 'continuation without an open data frame');
      this.append(taken);
      return taken.fin ? [this.finishFrag()] : [];
    }

    if (taken.opcode !== OPCODE.text && taken.opcode !== OPCODE.binary) {
      throw new FrameError('bad_opcode', `unknown data opcode 0x${taken.opcode.toString(16)}`);
    }
    if (taken.opcode === OPCODE.binary) {
      // 这套协议只在文本帧上跑 JSON（且文本帧必须整段是合法 UTF-8）：
      // 收二进制等于给对端开第二条编码通道，没必要冒这个险。
      throw new FrameError('bad_opcode', 'binary frames are not accepted');
    }
    if (this.fragOpcode >= 0) throw new FrameError('interleaved', 'new data frame while a fragment is open');
    if (!taken.fin) {
      this.fragOpcode = taken.opcode;
      this.append(taken);
      return [];
    }
    return [{ kind: 'text', text: decodeText(taken.payload) }];
  }

  private append(frame: RawFrame): void {
    this.fragSize += frame.payload.length;
    if (this.fragSize > this.maxMessage) {
      throw new FrameError('message_too_large', `assembled message over ${String(this.maxMessage)} bytes`);
    }
    this.fragChunks.push(frame.payload);
  }

  private finishFrag(): Inbound {
    const chunks = this.fragChunks;
    this.fragOpcode = -1;
    this.fragChunks = [];
    this.fragSize = 0;
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const joined = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      joined.set(c, at);
      at += c.length;
    }
    return { kind: 'text', text: decodeText(joined) };
  }

  private takeFrame(): RawFrame | null {
    const b = this.buf;
    if (b.length < 2) return null;
    const first = b[0] as number;
    const second = b[1] as number;
    if ((first & 0x70) !== 0) throw new FrameError('rsv_bits', 'RSV bits must be 0 (no extension negotiated)');
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const hasMask = (second & 0x80) !== 0;
    if (hasMask !== this.masked) {
      throw new FrameError(
        this.masked ? 'unmasked_frame' : 'unexpected_mask',
        this.masked ? 'client frames must be masked' : 'server frames must not be masked',
      );
    }
    let len = second & 0x7f;
    let at = 2;
    if (len === 126) {
      if (b.length < at + 2) return null;
      len = ((b[at] as number) << 8) | (b[at + 1] as number);
      at += 2;
      if (len < 126) throw new FrameError('non_minimal_length', '16-bit length used for a payload that fits 7 bits');
    } else if (len === 127) {
      if (b.length < at + 8) return null;
      const hi =
        ((b[at] as number) << 24) | ((b[at + 1] as number) << 16) | ((b[at + 2] as number) << 8) | (b[at + 3] as number);
      const lo =
        ((b[at + 4] as number) << 24) |
        ((b[at + 5] as number) << 16) |
        ((b[at + 6] as number) << 8) |
        (b[at + 7] as number);
      if (hi !== 0) throw new FrameError('too_large', 'payload length beyond 32 bits');
      len = lo >>> 0;
      at += 8;
      if (len <= 0xffff) throw new FrameError('non_minimal_length', '64-bit length used for a short payload');
    }
    if (len > this.maxMessage) throw new FrameError('message_too_large', `single frame claims ${String(len)} bytes`);
    const need = at + (hasMask ? 4 : 0) + len;
    if (b.length < need) return null;
    const mask = hasMask ? b.slice(at, at + 4) : null;
    if (hasMask) at += 4;
    const payload = b.slice(at, at + len);
    if (mask !== null) {
      for (let i = 0; i < payload.length; i += 1) {
        payload[i] = ((payload[i] as number) ^ (mask[i % 4] as number)) & 255;
      }
    }
    this.buf = b.slice(need);
    return { fin, opcode, payload };
  }
}
