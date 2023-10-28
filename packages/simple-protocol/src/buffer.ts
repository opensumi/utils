if (typeof Buffer === 'undefined') {
  // if this is running in the browser, we need to polyfill Buffer
  // see: https://github.com/feross/buffer
  global.Buffer = require('buffer/').Buffer;
}

import {
  decode,
  bytesUsed as bytesUsedFunc,
  decodeBN,
  encodeIntoBufferWriter,
  encodeIntoBNBufferWriter,
} from './bijective-varint';

export class BufferWriter {
  buffer: Buffer;
  constructor(
    bufferOrUint8: Buffer | Uint8Array,
    public offset = 0,
  ) {
    if (Buffer.isBuffer(bufferOrUint8)) {
      this.buffer = bufferOrUint8;
    } else {
      this.buffer = Buffer.from(
        bufferOrUint8,
        bufferOrUint8.byteOffset,
        bufferOrUint8.byteLength,
      );
    }
  }

  make() {
    return sliceBuffer(this.buffer, 0, this.offset);
  }

  allocate(bytes: number) {
    const targetSize = this.offset + bytes;
    let size = this.buffer.length;

    // if we have enough space, do nothing
    if (targetSize <= size) {
      return;
    }
    while (size < targetSize) {
      size *= 2;
    }
    // otherwise, allocate a new buffer
    const newBuffer = allocateBuffer(size);
    // copy the old buffer into the new buffer
    this.buffer.copy(newBuffer);
    // set the new buffer
    this.buffer = newBuffer;
  }

  writeUInt8(value: number) {
    this.allocate(1);
    this.buffer.writeUInt8(value, this.offset);
    this.offset += 1;
  }

  writeUInt16BE(value: number) {
    this.allocate(2);
    this.buffer.writeUInt16BE(value, this.offset);
    this.offset += 2;
  }

  writeUInt32BE(value: number) {
    this.allocate(4);
    this.buffer.writeUInt32BE(value, this.offset);
    this.offset += 4;
  }

  writeUIntVar(value: number) {
    encodeIntoBufferWriter(value, this);
  }

  writeBuffer(value: Buffer) {
    this.writeUIntVar(value.length);
    this.allocate(value.length);
    this.buffer.set(value, this.offset);
    this.offset += value.length;
  }

  writeString(value: string) {
    const bytes = Buffer.from(value, 'utf8');
    this.writeBuffer(bytes);
  }

  writeBigInt(value: bigint) {
    encodeIntoBNBufferWriter(value, this);
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

  readBigInt() {
    const [value, bytesUsed] = decodeBN(this.buffer, this.offset);
    this.offset += bytesUsed;
    return value;
  }
}

export function allocateBuffer(size: number) {
  return Buffer.allocUnsafe(size);
}

export function sliceBuffer(
  buffer: Buffer,
  start: number,
  end: number,
): Buffer {
  return Uint8Array.prototype.slice.call(buffer, start, end);
}
