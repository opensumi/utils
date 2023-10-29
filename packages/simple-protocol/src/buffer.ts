import {
  decode,
  decodeBN,
  encodeIntoBufferWriter,
  encodeIntoBNBufferWriter,
} from './bijective-varint';

if (typeof Buffer === 'undefined') {
  throw new Error(
    '@opensumi/protocol: Buffer is not defined, please use a Buffer polyfill.',
  );
}

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

    this.buffer = sliceBuffer(this.buffer, 0, this.offset, size);
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
  size?: number,
): Buffer {
  size = size ?? end - start;
  const buf = allocateBuffer(size);
  for (let i = 0; i < size; i++) {
    buf[i] = buffer[start + i];
  }
  return buf;
}
