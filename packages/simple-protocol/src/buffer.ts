if (typeof Buffer === 'undefined') {
  // if this is running in the browser, we need to polyfill Buffer
  // see: https://github.com/feross/buffer
  global.Buffer = require('buffer/').Buffer;
}

import {
  decode,
  encodeInto,
  bytesUsed as bytesUsedFunc,
} from './bijective-varint';

export class BufferWriter {
  constructor(
    public buffer: Buffer,
    public offset = 0,
  ) {}

  writeUInt8(value: number) {
    this.buffer.writeUInt8(value, this.offset);
    this.offset += 1;
  }

  writeUInt16BE(value: number) {
    this.buffer.writeUInt16BE(value, this.offset);
    this.offset += 2;
  }

  writeUInt32BE(value: number) {
    this.buffer.writeUInt32BE(value, this.offset);
    this.offset += 4;
  }

  writeUIntVar(value: number) {
    const bytesUsed = encodeInto(value, this.buffer, this.offset);
    this.offset += bytesUsed;
  }

  writeBuffer(value: Buffer) {
    this.writeUIntVar(value.length);
    this.buffer.set(value, this.offset);
    this.offset += value.length;
  }

  writeString(value: string) {
    const bytes = Buffer.from(value, 'utf8');
    this.writeBuffer(bytes);
  }
}

export class BufferReader {
  constructor(
    public buffer: Buffer,
    public offset = 0,
  ) {}

  readUInt8() {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt16BE() {
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  readUInt32BE() {
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  readUIntVar() {
    const byteUsed = bytesUsedFunc(this.buffer);
    console.log(
      `🚀 ~ file: buffer.ts:77 ~ BufferReader ~ readUIntVar ~ byteUsed:`,
      byteUsed,
    );
    const [value, bytesUsed] = decode(this.buffer, this.offset);
    this.offset += bytesUsed;
    return value;
  }

  readBuffer() {
    const length = this.readUIntVar();
    const value = sliceBuffer(this.buffer, this.offset, this.offset + length);

    this.offset += length;
    return value;
  }

  readString() {
    const bytes = this.readBuffer();
    return bytes.toString('utf8');
  }
}

export function allocateBuffer(size: number) {
  return Buffer.allocUnsafe(size);
}

export function sliceBuffer(buffer: Buffer, start: number, end: number) {
  return Uint8Array.prototype.slice.call(buffer, start, end);
}
