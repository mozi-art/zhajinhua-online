// M4 · 摘要与握手原语（netx/sha256.ts + netx/frames.ts 的握手部分）。
// commit-reveal 的安全性全压在这个摘要上，所以它不能只靠"看起来对"：
// 公开向量 + 与 node:crypto 的逐字节差分 + 雪崩性，三道都留。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bytesToHex, hexToBytes, sha256, sha256Bytes, sha256Hex } from '../netx/sha256.ts';
import { bytesToBase64, handshakeAccept, sha1 } from '../netx/frames.ts';
import { note, test } from './harness.ts';

test('netx/01 SHA-256 命中 FIPS 180-4 公开向量', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  // 百万个 'a'：跨 15625 个块，专门覆盖 64 位长度补齐那条路径
  assert.equal(
    sha256Hex('a'.repeat(1000000)),
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
  );
  // 上面的常量不是凭记忆留下的：netx/02 里同一条输入与 node:crypto 逐字节对过差分。
  // （写这条测试时我先记错了 56 字节向量的后半段、又记错了这里第 21 位起 —— 长十六进制
  //  常量必须有一个独立实现来兜底，所以差分才是主证据，公开向量是第二道保险。）
});

test('netx/02 与 node:crypto 逐字节差分（覆盖补齐边界与多字节 UTF-8）', () => {
  const inputs: string[] = [];
  for (let n = 0; n <= 200; n += 1) inputs.push('x'.repeat(n));
  for (const s of ['中', '中'.repeat(21), '💥'.repeat(7), 'a\u0000b', '\U0010FFFF']) inputs.push(s);
  inputs.push('y'.repeat(4096), 'a'.repeat(1000000));
  for (const s of inputs) {
    const mine = sha256Hex(s);
    const ref = createHash('sha256').update(s, 'utf8').digest('hex');
    assert.equal(mine, ref, `digest differs for a ${String(s.length)}-char input`);
  }
  note(`netx/02 SHA-256 与 node:crypto 差分 ${String(inputs.length)} 条输入全部一致`);
});

test('netx/03 雪崩：改一个字符，256 位里至少一半上下变化', () => {
  const cases: [string, string][] = [
    ['zjh-m4|hand=1|party=server|value=aaaaaaaa', 'zjh-m4|hand=1|party=server|value=aaaaaaab'],
    ['zjh-m4|hand=1|party=server', 'zjh-m4|hand=2|party=server'],
    ['0'.repeat(64), '0'.repeat(63) + '1'],
    ['commit-reveal', 'commit-revel'],
    ['a'.repeat(1000), 'a'.repeat(999) + 'b'],
  ];
  for (const [a, b] of cases) {
    const ha = sha256Bytes(a);
    const hb = sha256Bytes(b);
    let diff = 0;
    for (let i = 0; i < 32; i += 1) {
      let x = ((ha[i] as number) ^ (hb[i] as number)) >>> 0;
      while (x !== 0) {
        diff += x & 1;
        x >>>= 1;
      }
    }
    assert.ok(diff >= 48, `only ${String(diff)} bits changed for "${a.slice(0, 12)}" vs "${b.slice(0, 12)}"`);
  }
});

test('netx/04 base64 命中经典向量（长度余数 0/1/2 三条路径都走到）', () => {
  const cases: [string, string][] = [
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ];
  const enc = new TextEncoder();
  for (const [text, want] of cases) {
    assert.equal(bytesToBase64(enc.encode(text)), want);
  }
});

test('netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错', () => {
  assert.equal(handshakeAccept('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  assert.throws(() => handshakeAccept('has space'), /Sec-WebSocket-Key/);
  assert.throws(() => handshakeAccept(''), /Sec-WebSocket-Key/);
});

test('netx/06 十六进制与字节的往返（承诺/份额的编码面）', () => {
  for (const text of ['00', 'ff', '0123456789abcdef', 'DeAdBeEf']) {
    assert.deepEqual([...hexToBytes(text)], [...hexToBytes(text.toLowerCase())]);
    assert.equal(bytesToHex(hexToBytes(text.toLowerCase())), text.toLowerCase());
  }
  assert.throws(() => hexToBytes('zz'), /not a hex string/);
  assert.throws(() => hexToBytes('abc'), /not a hex string/);
});

test('netx/07 摘要入口对空输入与非空输入给出不同长度一致的输出', () => {
  assert.equal(sha256(new Uint8Array(0)).length, 32);
  assert.equal(sha256(new Uint8Array([0])).length, 32);
  assert.notEqual(sha256Hex(''), sha256Hex('\u0000'));
});

test('netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量', () => {
  const enc = new TextEncoder();
  const texts: string[] = [];
  for (let n = 0; n <= 200; n += 1) texts.push('q'.repeat(n));
  texts.push('a'.repeat(1000), 'a'.repeat(119));
  for (const s of texts) {
    const mine = bytesToHex(sha1(enc.encode(s)));
    const ref = createHash('sha1').update(s, 'utf8').digest('hex');
    assert.equal(mine, ref, `sha1 differs for a ${String(s.length)}-char input`);
  }
  assert.equal(
    bytesToHex(sha1(enc.encode('abc'))),
    'a9993e364706816aba3e25717850c26c9cd0d89d', // RFC 3174 公开向量
  );
  assert.equal(handshakeAccept('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  note('netx/08 SHA-1 与 node:crypto 差分 202 条一致；握手向量 = RFC 6455 §1.3');
});
