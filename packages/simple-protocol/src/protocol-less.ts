import { BufferWriter, BufferReader } from './buffer';
import { ProtocolType } from './protocol-builder';

function serializeWorker(data: unknown, writer: BufferWriter) {
  if (typeof data === 'undefined') {
    writer.writeUInt8(ProtocolType.Undefined);
  } else if (typeof data === 'boolean') {
    writer.writeUInt8(ProtocolType.Boolean);
    writer.writeUInt8(data ? 1 : 0);
  } else if (typeof data === 'bigint') {
    writer.writeUInt8(ProtocolType.BigInt);
    writer.writeBigInt(data);
  } else if (typeof data === 'number') {
    writer.writeUInt8(ProtocolType.Int32);
    writer.writeInt32(data);
  } else if (typeof data === 'string') {
    writer.writeUInt8(ProtocolType.String);
    writer.writeString(data);
  } else if (data instanceof Uint8Array) {
    writer.writeUInt8(ProtocolType.Buffer);
    writer.writeBuffer(data);
  } else if (Array.isArray(data)) {
    writer.writeUInt8(ProtocolType.Array);
    writer.writeUIntVar(data.length);
    for (const element of data) {
      serializeWorker(element, writer);
    }
  } else if (typeof data === 'object') {
    writer.writeUInt8(ProtocolType.JSONObject);
    writer.writeString(JSON.stringify(data));
  }
}
const writer = new BufferWriter();

export function serialize(data: unknown) {
  writer.reset();
  serializeWorker(data, writer);

  return writer.dump();
}

function deserializeWorker(reader: BufferReader) {
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
    case ProtocolType.Int32:
      return reader.readInt32();
    case ProtocolType.JSONObject: {
      const buffer = reader.readBuffer();
      const json = buffer.toString('utf8');
      return JSON.parse(json);
    }
    case ProtocolType.BigInt:
      return reader.readBigInt();
    case ProtocolType.Array: {
      const length = reader.readUIntVar();
      const data = [] as unknown[];
      for (let i = 0; i < length; i++) {
        data.push(deserializeWorker(reader));
      }
      return data;
    }
    case ProtocolType.Boolean:
      return reader.readUInt8() === 1;
    default:
      throw new Error(`Unknown type ${type}`);
  }
}
const reader = new BufferReader();

export function deserialize(buffer: Buffer | Uint8Array) {
  reader.reset(buffer);
  return deserializeWorker(reader);
}
