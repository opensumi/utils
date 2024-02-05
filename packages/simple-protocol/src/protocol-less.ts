import { BufferWriter, allocateBuffer, BufferReader } from './buffer';
import { ProtocolType } from './protocol-builder';

function serializeWorker(data: unknown, writer: BufferWriter) {
  if (typeof data === 'undefined') {
    writer.writeUInt8(ProtocolType.Undefined);
  } else if (typeof data === 'boolean') {
    writer.writeUInt8(ProtocolType.Boolean);
    writer.writeUInt8(data ? 1 : 0);
  } else if (typeof data === 'bigint') {
    writer.writeUInt8(ProtocolType.UBigInt);
    writer.writeUBigInt(data);
  } else if (typeof data === 'number') {
    writer.writeUInt8(ProtocolType.UInt32);
    writer.writeUInt32BE(data);
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

export function serialize(data: unknown) {
  const buffer = allocateBuffer(1024 * 1024);
  const writer = new BufferWriter(buffer);

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
    case ProtocolType.UInt32:
      return reader.readUInt32BE();
    case ProtocolType.JSONObject: {
      const buffer = reader.readBuffer();
      const json = buffer.toString('utf8');
      return JSON.parse(json);
    }
    case ProtocolType.UBigInt:
      return reader.readUBigInt();
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

export function deserialize(buffer: Buffer | Uint8Array) {
  const reader = new BufferReader(buffer);
  return deserializeWorker(reader);
}
