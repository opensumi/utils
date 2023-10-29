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
  Union: 8,
  Object: 9,
  Undefined: 10,
} as const;

export interface BaseProtocolDeclaration {
  type: keyof typeof ProtocolType;
  name: string;
}

export interface ProtocolArrayDeclaration extends BaseProtocolDeclaration {
  type: 'Array';
  element: BaseProtocolDeclaration;
}

export interface ProtocolUnionDeclaration extends BaseProtocolDeclaration {
  type: 'Union';
  elements: BaseProtocolDeclaration[];
}

export interface ProtocolObjectDeclaration extends BaseProtocolDeclaration {
  type: 'Object';
  fields: BaseProtocolDeclaration[];
}

export type ProtocolDeclaration =
  | BaseProtocolDeclaration
  | ProtocolArrayDeclaration
  | ProtocolObjectDeclaration
  | ProtocolUnionDeclaration;

export const noop = () => {};

export interface IProtobolBuilderOptions {
  /**
   * If true, the buffer will remove the ProtocolType header.
   */
  compact?: boolean;
}

export type ProtocolWrite<T = any> = (writer: BufferWriter, data: T) => void;
export type ProtocolRead<T = any> = (reader: BufferReader) => T;

class WriteTypeError extends Error {
  constructor(decl: ProtocolDeclaration, value: any) {
    super(`Field(${decl.name}): Expected ${decl.type}, got ${typeof value}`);
  }
}

const assertWriteType = (
  bool: boolean,
  decl: ProtocolDeclaration,
  value: any,
) => {
  if (!bool) {
    throw new WriteTypeError(decl, value);
  }
};

export class ProtocolBuilder {
  compact: boolean;
  decl: ProtocolDeclaration;
  constructor(decls: ProtocolDeclaration, options?: IProtobolBuilderOptions) {
    this.decl = decls;
    this.compact = !!options?.compact;
  }

  private createWriteFuncWithDeclaration(
    decl: ProtocolDeclaration,
  ): ProtocolWrite {
    let fn: ProtocolWrite = noop;
    switch (decl.type) {
      case 'String':
        fn = (writer, data: string) => {
          assertWriteType(typeof data === 'string', decl, data);
          writer.writeString(data);
        };
        break;
      case 'Buffer':
        fn = (writer, data: Buffer) => {
          assertWriteType(Buffer.isBuffer(data), decl, data);
          writer.writeBuffer(data);
        };
        break;
      case 'UInt8':
        fn = (writer, data: number) => {
          assertWriteType(typeof data === 'number', decl, data);
          // if data is not UInt8(0~255), Buffer write will throw
          writer.writeUInt8(data);
        };
        break;
      case 'UInt16':
        fn = (writer, data: number) => {
          assertWriteType(typeof data === 'number', decl, data);
          writer.writeUInt16BE(data);
        };
        break;
      case 'UInt32':
        fn = (writer, data: number) => {
          assertWriteType(typeof data === 'number', decl, data);
          writer.writeUInt32BE(data);
        };
        break;
      case 'JSONObject':
        fn = (writer, data: any) => {
          assertWriteType(typeof data === 'object', decl, data);
          const buffer = JSON.stringify(data);
          writer.writeBuffer(Buffer.from(buffer, 'utf8'));
        };
        break;
      case 'BigInt':
        fn = (writer, data: any) => {
          assertWriteType(typeof data === 'bigint', decl, data);
          writer.writeBigInt(data);
        };
        break;
      case 'Array': {
        const t = this.createWriteFuncWithDeclaration(
          (decl as ProtocolArrayDeclaration).element,
        );
        fn = (writer, data: any[]) => {
          assertWriteType(Array.isArray(data), decl, data);
          writer.writeUIntVar(data.length);
          for (const element of data) {
            t(writer, element);
          }
        };
        break;
      }
      case 'Union': {
        const functions = [] as ProtocolWrite[];
        const elements = (decl as ProtocolUnionDeclaration).elements;
        for (const element of elements) {
          functions.push(this.createWriteFuncWithDeclaration(element));
        }
        fn = (writer, data: any) => {
          assertWriteType(Array.isArray(data), decl, data);

          writer.writeUInt8(data.length);
          for (let i = 0; i < data.length; i++) {
            const element = data[i];
            const func = functions[i];
            func(writer, element);
          }
        };
        break;
      }
      case 'Object': {
        const fields = (decl as ProtocolObjectDeclaration).fields;
        const functions = {} as Record<string, ProtocolWrite>;
        for (const field of fields) {
          const key = field.name;
          functions[key] = this.createWriteFuncWithDeclaration(field);
        }
        fn = (writer, data: any) => {
          assertWriteType(typeof data === 'object', decl, data);
          writer.writeUInt8(Object.keys(functions).length);
          for (const key of Object.keys(data)) {
            const fn = functions[key];
            const value = data[key];
            if (!fn) {
              throw new Error(`Unknown key ${key}`);
            }
            writer.writeString(key);
            fn(writer, value);
          }
        };
        break;
      }
      default:
        throw new Error(`${decl.name}: Unknown type ${decl.type}`);
    }
    return fn;
  }

  private createReadFuncWithDeclaration(
    decl: ProtocolDeclaration,
  ): ProtocolRead {
    let fn: ProtocolRead = () => {
      throw new Error(
        `${decl.name}: Encountered unknown type, expected ${decl.type}`,
      );
    };

    switch (decl.type) {
      case 'String':
        fn = (reader) => {
          return reader.readString();
        };
        break;
      case 'Buffer':
        fn = (reader) => {
          return reader.readBuffer();
        };
        break;
      case 'UInt8':
        fn = (reader) => {
          return reader.readUInt8();
        };
        break;
      case 'UInt16':
        fn = (reader) => {
          return reader.readUInt16BE();
        };
        break;
      case 'UInt32':
        fn = (reader) => {
          return reader.readUInt32BE();
        };
        break;
      case 'JSONObject':
        fn = (reader) => {
          const buffer = reader.readBuffer();
          const json = buffer.toString('utf8');
          return JSON.parse(json);
        };
        break;
      case 'BigInt':
        fn = (reader) => {
          return reader.readBigInt();
        };
        break;
      case 'Array': {
        const t = this.createReadFuncWithDeclaration(
          (decl as ProtocolArrayDeclaration).element,
        );
        fn = (reader) => {
          const length = reader.readUIntVar();
          const data = [] as any[];
          for (let i = 0; i < length; i++) {
            data.push(t(reader));
          }
          return data;
        };
        break;
      }
      case 'Union': {
        const functions = [] as ProtocolRead[];
        const elements = (decl as ProtocolUnionDeclaration).elements;
        for (const element of elements) {
          functions.push(this.createReadFuncWithDeclaration(element));
        }
        fn = (reader) => {
          const length = reader.readUInt8();
          const data = [] as any[];
          for (let i = 0; i < length; i++) {
            const func = functions[i];
            data.push(func(reader));
          }
          return data;
        };
        break;
      }
      case 'Object': {
        const fields = (decl as ProtocolObjectDeclaration).fields;
        const functions = {} as Record<string, ProtocolRead>;
        for (const field of fields) {
          const key = field.name;
          functions[key] = this.createReadFuncWithDeclaration(field);
        }
        fn = (reader) => {
          const length = reader.readUInt8();
          const data = {} as Record<string, any>;
          for (let i = 0; i < length; i++) {
            const key = reader.readString();
            const func = functions[key];
            if (!func) {
              throw new Error(`Unknown key ${key}`);
            }
            data[key] = func(reader);
          }
          return data;
        };
        break;
      }
      default:
        throw new Error(`Unknown type ${decl.type}`);
    }
    return fn;
  }
  compileReader() {
    const fn = this.createReadFuncWithDeclaration(this.decl);
    return (buffer: Buffer) => {
      const reader = new BufferReader(buffer);
      const data = fn(reader);
      return data;
    };
  }

  compileWriter() {
    const func = this.createWriteFuncWithDeclaration(this.decl);
    return (data: any) => {
      // 1m
      const buffer = allocateBuffer(1024 * 1024);
      const writer = new BufferWriter(buffer);
      func(writer, data);
      return writer.make();
    };
  }
}

export function serialize(data: any) {
  const buffer = allocateBuffer(1024 * 1024);
  const writer = new BufferWriter(buffer);
  if (typeof data === 'undefined') {
    writer.writeUInt8(ProtocolType.Undefined);
  } else if (typeof data === 'bigint') {
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
    case ProtocolType.Undefined:
      return undefined;
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
