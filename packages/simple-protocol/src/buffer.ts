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

export interface IBufferWriterOptions {
  littleEndian?: boolean;
}

export class BufferWriter {
  dataView: DataView;

  littleEndian = false;

  constructor(
    public buffer: Buffer | Uint8Array,
    public offset = 0,
    options: IBufferWriterOptions = {},
  ) {
    this.dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);
    this.littleEndian = options.littleEndian;
  }

  dump() {
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
    this.dataView = new DataView(this.buffer.buffer, this.buffer.byteOffset);
  }

  writeUInt8Unsafe(value: number) {
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeUInt8(value: number) {
    this.allocate(1);
    this.dataView.setUint8(this.offset, value);
    this.offset += 1;
  }

  writeUInt16BE(value: number) {
    this.allocate(2);
    this.dataView.setUint16(this.offset, value, this.littleEndian);
    this.offset += 2;
  }

  writeUInt32BE(value: number) {
    this.allocate(4);
    this.dataView.setUint32(this.offset, value, this.littleEndian);
    this.offset += 4;
  }

  writeUIntVar(value: number) {
    encodeIntoBufferWriter(value, this);
  }

  writeBuffer(value: Uint8Array) {
    this.writeUIntVar(value.length);
    this.allocate(value.length);
    this.buffer.set(value, this.offset);
    this.offset += value.length;
  }

  writeString(value: string) {
    const bytes = Buffer.from(value, 'utf8');
    this.writeBuffer(bytes);
  }

  writeUBigInt(value: bigint) {
    encodeIntoBNBufferWriter(value, this);
  }
}

export class BufferReader {
  littleEndian = false;
  dataView: DataView;

  constructor(
    public buffer: Buffer | Uint8Array,
    public offset = 0,
  ) {
    this.dataView = new DataView(buffer.buffer, buffer.byteOffset);
  }

  reset() {
    this.offset = 0;
  }

  readUInt8() {
    const value = this.dataView.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt16BE() {
    const value = this.dataView.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return value;
  }

  readUInt32BE() {
    const value = this.dataView.getUint32(this.offset, this.littleEndian);
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
    const length = this.readUIntVar();
    const value = utf8Slice(this.buffer, this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readUBigInt() {
    const [value, bytesUsed] = decodeBN(this.buffer, this.offset);
    this.offset += bytesUsed;
    return value;
  }
}

export const isNodeEnv = typeof process === 'object';

export function allocateBuffer(size: number) {
  if (isNodeEnv) {
    return Buffer.allocUnsafe(size);
  }

  return new Uint8Array(size);
}

export const sharedBuffer = allocateBuffer(1024);

export function sliceBuffer(
  buffer: Buffer | Uint8Array,
  start: number,
  end: number,
  size?: number,
): Buffer | Uint8Array {
  size = size ?? end - start;
  const buf = allocateBuffer(size);
  sliceBufferTo(buffer, buf, start, end);
  return buf;
}

export function sliceBufferTo(
  buffer: Buffer | Uint8Array,
  to: Buffer | Uint8Array,
  start: number,
  end: number,
) {
  for (let i = 0; i < end; i++) {
    to[i] = buffer[start + i];
  }
  return to;
}

export function utf8Slice(
  buffer: Buffer | Uint8Array,
  start: number,
  end: number,
) {
  return buffer.toString('utf8', start, end);
}
