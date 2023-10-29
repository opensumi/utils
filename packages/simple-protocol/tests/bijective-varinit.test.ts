import fs from 'node:fs';
import {
  bytesUsed,
  decode,
  zigzagEncode,
  zigzagDecode,
  decodeBN,
  zigzagDecodeBN,
  zigzagEncodeBN,
  bufContainsVarint,
  MAX_BIGINT_LEN,
  encodeIntoBNBufferWriter,
  MAX_INT_LEN,
  encodeIntoBufferWriter,
} from '../src/bijective-varint';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { BufferWriter } from '../src/buffer';

// Helper function while debugging.
const printBinary = (x: Uint8Array) => {
  console.log([...x].map((b) => b.toString(2).padStart(8, '0')).join(' '));
};

const checkZigZag = (n: number, expectNumber?: number) => {
  const zz = zigzagEncode(n);
  if (expectNumber != null) {
    expect(zz).toBe(expectNumber);
  }
  expect(zz).toBeGreaterThanOrEqual(0);

  const out = zigzagDecode(zz);
  expect(out).toBe(n);

  const zzn = zigzagEncodeBN(BigInt(n));
  expect(zzn).toBe(BigInt(zz));

  const outn = zigzagDecodeBN(zzn);
  expect(outn).toBe(BigInt(n));
};

const roundtripUint = (n: number) => {
  const encoded = encode(n);
  const [decoded, _bytesUsed] = decode(encoded);
  expect(decoded).toBe(n);
  expect(_bytesUsed).toBe(encoded.length);

  if (n < Number.MAX_SAFE_INTEGER / 2) {
    checkZigZag(n);
    if (n !== 0) checkZigZag(-n);
  }

  roundtripBN(BigInt(n));
};

const bufferWriter = new BufferWriter(new Uint8Array(MAX_INT_LEN));
const bnBufferWriter = new BufferWriter(new Uint8Array(MAX_BIGINT_LEN));

/**
 * Encode the given unsigned number as a varint. Returns the varint in a Uint8Array.
 *
 * This method is a wrapper around `encodeInto`. If you're encoding into
 * a buffer, its more efficient to use `encodeInto` directly to avoid
 * the unnecessary Uint8Array allocation here and the copy into the destination
 * buffer.
 *
 * NOTE: This method uses unsigned varint encoding. If you want to encode a signed
 * number, call encode(zigzagEncode(num)).
 */
export function encode(num: number): Uint8Array {
  bufferWriter.offset = 0;
  const bytesUsed = encodeIntoBufferWriter(num, bufferWriter);
  const out = new Uint8Array(bytesUsed);
  out.set(bufferWriter.make());
  return out;
}

/**
 * Encode the given bigint as a varint. Returns the encoded number in a Uint8Array.
 *
 * This method is a wrapper around `encodeIntoBN`. If you're encoding into
 * a buffer, its more efficient to use `encodeIntoBN` directly to avoid
 * the unnecessary Uint8Array allocation here and the copy into the destination
 * buffer.
 *
 * NOTE: This method uses unsigned varint encoding. If you want to encode a signed
 * number, call encodeBN(zigzagEncodeBN(num)).
 */
export function encodeBN(num: bigint): Uint8Array {
  bnBufferWriter.offset = 0;
  const bytesUsed = encodeIntoBNBufferWriter(num, bnBufferWriter);
  const out = new Uint8Array(bytesUsed);
  out.set(bnBufferWriter.make());
  return out;
}

const roundtripBN = (n: bigint) => {
  // console.log('\nx', n)
  const encoded = encodeBN(n);
  const [decoded, _bytesUsed] = decodeBN(encoded);
  expect(decoded).toBe(n);

  // Check that the number of bytes used makes sense.
  expect(bytesUsed(encoded)).toBe(encoded.byteLength);
  expect(_bytesUsed).toBe(encoded.byteLength);

  // Check that hasEnoughBytesForVarint returns the right thing too.
  expect(bufContainsVarint(encoded)).toBeTruthy();

  for (let i = 0; i < encoded.byteLength; i++) {
    const shorter = encoded.slice(0, i);

    if (bufContainsVarint(shorter)) {
      console.log('Fail with:', 'encoded', encoded, 'shorter', shorter);
    }
    expect(bufContainsVarint(shorter)).toBeFalsy();
  }

  // if (n !== decoded) {
  //   console.log('MISMATCH', n)
  //   console.log('enc', encoded)
  //   printBinary(encoded)
  //   if (n < Number.MAX_SAFE_INTEGER) {
  //     console.log('old encoding', varintEncode(Number(n)))
  //   }
  //   console.log('dec', decoded)
  //   // console.log(

  //   throw Error('Bad encode / decode')
  // }
  // assert(n === decoded)
};

describe('bijective varinit', () => {
  it('zigzags the same as protobuf', () => {
    // from https://protobuf.dev/programming-guides/encoding/#signed-ints :
    checkZigZag(0, 0);
    checkZigZag(-1, 1);
    checkZigZag(1, 2);
    checkZigZag(-2, 3);
    checkZigZag(2147483647, 4294967294);
    checkZigZag(-2147483648, 4294967295);
  });

  it('roundtrip encodes simple numbers correctly', () => {
    roundtripUint(0);
    roundtripUint(1);
    roundtripUint(100);
    roundtripUint(1000000);
    roundtripUint(Number.MAX_SAFE_INTEGER);
  });

  it('zigzag encodes correctly', () => {
    checkZigZag(0);
    checkZigZag(1);
    checkZigZag(-1);
    checkZigZag(10000);
    checkZigZag(-10000);
  });

  it('correctly handles conformance tests from varint_tests.txt', () => {
    const tests = fs
      .readFileSync(path.join(__dirname, 'varint_tests.txt'), 'utf8')
      .split('\n')
      .filter((line) => line != '')
      .reverse();

    for (const line of tests) {
      const spaceIdx = line.indexOf(' ');
      expect(spaceIdx).toBeGreaterThan(0);

      const num = parseInt(line.slice(0, spaceIdx));
      if (num > Number.MAX_SAFE_INTEGER) continue;

      // console.log(num)

      const bytes = line.slice(spaceIdx + 1);

      const expectBytes = new Uint8Array(JSON.parse(bytes) as number[]);
      // return [parseInt(num), JSON.parse(bytes)]

      const actualBytes = encode(num);

      const reportedBytes = bytesUsed(actualBytes);
      expect(reportedBytes).toBe(actualBytes.length);

      const [actualDecode, _bytesUsed] = decode(actualBytes);
      expect(num).toBe(actualDecode);
      expect(actualBytes).toEqual(expectBytes);
      expect(_bytesUsed).toBe(actualBytes.length);

      console.log(actualBytes, expectBytes);
    }
  });

  it('handles simple bigints', () => {
    roundtripBN(0n);
    roundtripBN(1n);
    roundtripBN(0xffffffffffffn);
    roundtripBN(2n ** 128n - 1n); // Largest number we support.
  });

  it('fuzzes', () => {
    // Ideally we'd use a stable RNG here, but it should be fine as any
    // errors are trivially reproducable.

    for (let i = 0; i < 20000; i++) {
      // We'll generate a number with a random number of bits.
      const bits = Math.ceil(Math.random() * 128);
      const numBytes = Math.ceil(bits / 8);

      // Using crypto.randomBytes because its easier than Math.random, and I'm lazy.
      const bytes = randomBytes(numBytes);
      bytes[0] &= 0xff >> (8 - (bits % 8));

      let num = 0n;
      for (const b of bytes) {
        num = (num << 8n) | BigInt(b);
      }

      // console.log(num)

      roundtripBN(num);
      if (num < Number.MAX_SAFE_INTEGER) {
        roundtripUint(Number(num));
      }
    }
  });
});

// console.log(10, varintEncode(10))
// console.log(100, varintEncode(100))
// console.log(1000, varintEncode(1000))
// console.log(100000, varintEncode(100000))
// console.log(10000000, varintEncode(10000000))
