import {
  BufferWriter,
  allocateBuffer,
  sliceBuffer,
  BufferReader,
} from './buffer';

export const ProtocolType = {
  String: 0,
  Buffer: 1,
  UInt8: 2,
  UInt16: 3,
  UInt32: 4,
  JSONObject: 5,
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
      return sliceBuffer(buffer, 0, writer.offset);
    };
  }
}
