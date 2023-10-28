import { BufferWriter, allocateBuffer, BufferReader } from './buffer';

export const ProtocolType = {
  String: 0,
  Buffer: 1,
  UInt8: 2,
  UInt16: 3,
  UInt32: 4,
  JSONObject: 5,
  BigInt: 6,
  Array: 7,
} as const;

export interface ProtocolDeclaration {
  type: keyof typeof ProtocolType;
  name: string;
}

export class ProtocolBuilder {
  constructor(public decls: ProtocolDeclaration[]) {}

  compileReader() {
    const functions = [] as ((reader: BufferReader) => any)[];

    for (const decl of this.decls) {
      switch (decl.type) {
        case 'String':
          functions.push((reader) => {
            reader.readUInt8();
            return reader.readString();
          });
          break;
        case 'Buffer':
          functions.push((reader) => {
            reader.readUInt8();
            return reader.readBuffer();
          });
          break;
        case 'UInt8':
          functions.push((reader) => {
            reader.readUInt8();
            return reader.readUInt8();
          });
          break;
        case 'UInt16':
          functions.push((reader) => {
            reader.readUInt8();
            return reader.readUInt16BE();
          });
          break;
        case 'UInt32':
          functions.push((reader) => {
            reader.readUInt8();
            return reader.readUInt32BE();
          });
          break;
        case 'JSONObject':
          functions.push((reader) => {
            reader.readUInt8();
            const buffer = reader.readBuffer();
            const json = buffer.toString('utf8');
            return JSON.parse(json);
          });
          break;
        case 'BigInt':
          functions.push((reader) => {
            reader.readUInt8();
            return reader.readBigInt();
          });
          break;
        default:
          throw new Error(`Unknown type ${decl.type}`);
      }
    }

    return (buffer: Buffer) => {
      const reader = new BufferReader(buffer);
      const data = [] as any[];
      for (const fn of functions) {
        data.push(fn(reader));
      }
      return data;
    };
  }

  compileWriter() {
    const functions = [] as ((writer: BufferWriter, data: any) => void)[];

    for (const decl of this.decls) {
      switch (decl.type) {
        case 'String':
          functions.push((writer, data: string) => {
            writer.writeUInt8(ProtocolType.String);
            writer.writeString(data);
          });
          break;
        case 'Buffer':
          functions.push((writer, data: Buffer) => {
            writer.writeUInt8(ProtocolType.Buffer);
            writer.writeBuffer(data);
          });
          break;
        case 'UInt8':
          functions.push((writer, data: number) => {
            writer.writeUInt8(ProtocolType.UInt8);
            writer.writeUInt8(data);
          });
          break;
        case 'UInt16':
          functions.push((writer, data: number) => {
            writer.writeUInt8(ProtocolType.UInt16);
            writer.writeUInt16BE(data);
          });
          break;
        case 'UInt32':
          functions.push((writer, data: number) => {
            writer.writeUInt8(ProtocolType.UInt32);
            writer.writeUInt32BE(data);
          });
          break;
        case 'JSONObject':
          functions.push((writer, data: any) => {
            writer.writeUInt8(ProtocolType.JSONObject);
            const buffer = JSON.stringify(data);
            writer.writeBuffer(Buffer.from(buffer, 'utf8'));
          });
          break;
        case 'BigInt':
          functions.push((writer, data: any) => {
            writer.writeUInt8(ProtocolType.BigInt);
            writer.writeBigInt(data);
          });
          break;
        default:
          throw new Error(`Unknown type ${decl.type}`);
      }
    }

    return (data: any[]) => {
      // 1m
      const buffer = allocateBuffer(1024 * 1024);
      const writer = new BufferWriter(buffer);
      for (let i = 0; i < data.length; i++) {
        const element = data[i];
        const fn = functions[i];
        fn(writer, element);
      }
      return writer.make();
    };
  }
}

export function serialize(data: any[]) {
  const buffer = allocateBuffer(1024 * 1024);
  const writer = new BufferWriter(buffer);
  if (typeof data === 'bigint') {
    writer.writeUInt8(ProtocolType.BigInt);
    writer.writeBigInt(data);
  } else if (typeof data === 'number') {
    writer.writeUInt8(ProtocolType.UInt32);
    writer.writeUInt32BE(data);
  } else if (typeof data === 'string') {
    writer.writeUInt8(ProtocolType.String);
    writer.writeString(data);
  } else if (Buffer.isBuffer(data)) {
    writer.writeUInt8(ProtocolType.Buffer);
    writer.writeBuffer(data);
  } else if (Array.isArray(data)) {
    const buffers = [] as Buffer[];
    for (const element of data) {
      buffers.push(serialize(element));
    }
    writer.writeUInt8(ProtocolType.Array);
    writer.writeUIntVar(buffers.length);
    for (const buffer of buffers) {
      writer.writeBuffer(buffer);
    }
  } else if (typeof data === 'object') {
    writer.writeUInt8(ProtocolType.JSONObject);
    writer.writeString(JSON.stringify(data));
  }

  return writer.make();
}

export function deserialize(buffer: Buffer) {
  const reader = new BufferReader(buffer);

  const type = reader.readUInt8();
  switch (type) {
    case ProtocolType.String:
      return reader.readString();
    case ProtocolType.Buffer:
      return reader.readBuffer();
    case ProtocolType.UInt8:
      return reader.readUInt8();
    case ProtocolType.UInt16:
      return reader.readUInt16BE();
    case ProtocolType.UInt32:
      return reader.readUInt32BE();
    case ProtocolType.JSONObject:
      const buffer = reader.readBuffer();
      const json = buffer.toString('utf8');
      return JSON.parse(json);
    case ProtocolType.BigInt:
      return reader.readBigInt();
    case ProtocolType.Array:
      const length = reader.readUIntVar();
      const data = [] as any[];
      for (let i = 0; i < length; i++) {
        const buffer = reader.readBuffer();
        data.push(deserialize(buffer));
      }
      return data;
    default:
      throw new Error(`Unknown type ${type}`);
  }
}
