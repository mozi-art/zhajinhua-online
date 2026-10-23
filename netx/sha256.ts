// M4 · SHA-256（FIPS 180-4）的纯 TS 实现。
// 为什么不用 node:crypto：commit-reveal 两端都要算同一个摘要 —— 服务端在 Node，客户端要在浏览器里
// 核对"揭示的份额确实等于当初的承诺"。异步的 WebCrypto 与同步的 Node 模块凑不成一份同源代码，
// 而工单 §3.7 的"零运行时依赖"不允许引第三方包，所以这里自带一个。
// 正确性不靠自证：test/netx-crypto.test.ts 用公开向量 + 与 node:crypto.createHash('sha256') 做差分对比。
// 本文件只用位运算与 TypedArray：无时钟、无随机、无 IO。

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function padded(data: Uint8Array): Uint8Array {
  const len = data.length;
  const total = Math.floor((len + 9 + 63) / 64) * 64;
  const out = new Uint8Array(total);
  out.set(data);
  out[len] = 0x80;
  const bitLen = len * 8;
  const hi = Math.floor(bitLen / 4294967296);
  const lo = bitLen % 4294967296;
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(total - 8, hi);
  view.setUint32(total - 4, lo);
  return out;
}

// 返回 32 字节摘要；输入按原始字节（调用方负责编码，文本用 TextEncoder 的 UTF-8）。
export function sha256(data: Uint8Array): Uint8Array {
  const block = padded(data);
  const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
  const h = Uint32Array.from(H0);
  const w = new Uint32Array(64);
  for (let off = 0; off < block.length; off += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15] as number;
      const y = w[i - 2] as number;
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0);
    }
    let a = h[0] as number;
    let b = h[1] as number;
    let c = h[2] as number;
    let d = h[3] as number;
    let e = h[4] as number;
    let f = h[5] as number;
    let g = h[6] as number;
    let hh = h[7] as number;
    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + (K[i] as number) + (w[i] as number)) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = ((h[0] as number) + a) >>> 0;
    h[1] = ((h[1] as number) + b) >>> 0;
    h[2] = ((h[2] as number) + c) >>> 0;
    h[3] = ((h[3] as number) + d) >>> 0;
    h[4] = ((h[4] as number) + e) >>> 0;
    h[5] = ((h[5] as number) + f) >>> 0;
    h[6] = ((h[6] as number) + g) >>> 0;
    h[7] = ((h[7] as number) + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer, out.byteOffset, out.byteLength);
  for (let i = 0; i < 8; i += 1) ov.setUint32(i * 4, h[i] as number);
  return out;
}

const HEX = '0123456789abcdef';

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) {
    s += HEX.charAt(b >> 4) + HEX.charAt(b & 15);
  }
  return s;
}

export function hexToBytes(text: string): Uint8Array {
  if (!/^[\da-f]+$/i.test(text) || text.length % 2 !== 0) {
    throw new TypeError(`not a hex string: ${text.slice(0, 24)}`);
  }
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const encoder = new TextEncoder();

export function sha256Bytes(text: string): Uint8Array {
  return sha256(encoder.encode(text));
}

// 协议里唯一用到的摘要口径：UTF-8 文本 → 64 位小写十六进制。
export function sha256Hex(text: string): string {
  return bytesToHex(sha256Bytes(text));
}
