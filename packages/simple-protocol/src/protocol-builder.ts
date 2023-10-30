import { BufferWriter, allocateBuffer, BufferReader } from './buffer';

export const ProtocolType = {
  String: 0,
  Buffer: 1,
  UInt8: 2,
  UInt16: 3,
  UInt32: 4,
  JSONObject: 5,
  UBigInt: 6,
  Array: 7,
  Union: 8,
  Object: 9,
  Undefined: 10,
  Boolean: 11,
} as const;

export interface BaseProtocolDeclaration {
  type: keyof typeof ProtocolType;
  name: string;
}

export interface ProtocolArrayDeclaration extends BaseProtocolDeclaration {
  type: 'Array';
  element: ProtocolDeclaration;
}

export interface ProtocolUnionDeclaration extends BaseProtocolDeclaration {
  type: 'Union';
  elements: ProtocolDeclaration[];
}

export interface ProtocolObjectDeclaration extends BaseProtocolDeclaration {
  type: 'Object';
  fields: ProtocolDeclaration[];
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

export interface ICompileWriterOptions {
  initialAllocSize?: number;
}

export type ProtocolWrite<T = unknown> = (
  writer: BufferWriter,
  data: T,
) => void;
export type ProtocolRead<T = unknown> = (reader: BufferReader) => T;

class WriteTypeError extends Error {
  constructor(decl: ProtocolDeclaration, value: unknown) {
    super(`Field(${decl.name}): Expected ${decl.type}, got ${typeof value}`);
  }
}

const assertWriteType = (
  bool: boolean,
  decl: ProtocolDeclaration,
  value: unknown,
) => {
  if (!bool) {
    throw new WriteTypeError(decl, value);
  }
};

interface IProtocolCodeFactoryOprationBase {
  type: string;
}

interface IProtocolCodeFactoryOprationAssertType
  extends IProtocolCodeFactoryOprationBase {
  type: 'assertType';
  decl: string;
  code: string;
  inputVarName: string;
}

interface IProtocolCodeFactoryOprationWrite
  extends IProtocolCodeFactoryOprationBase {
  type: 'write';
  code: string;
}

interface IProtocolCodeFactoryOprationThrow {
  type: 'throw';
  message: string;
}

type TProtocolCodeFactoryOpration =
  | IProtocolCodeFactoryOprationAssertType
  | IProtocolCodeFactoryOprationWrite
  | IProtocolCodeFactoryOprationThrow;

let varId = 0;

class ProtocolCodeFactory {
  opeartorVarName = 'writer';
  inputVarName = 'data';

  assert(decl: ProtocolDeclaration, code: string) {
    this.addOpeartion({
      type: 'assertType',
      decl: JSON.stringify({ type: decl.type, name: decl.name }),
      code,
      inputVarName: this.inputVarName,
    });
  }

  comment(comment: string) {
    this.addOpeartion({
      type: 'write',
      code: `// ${comment}`,
    });
  }

  getNextVarName() {
    return '_x' + varId++;
  }

  varName(ref: string) {
    const nextVarName = this.getNextVarName();
    this.addOpeartion({
      type: 'write',
      code: `var ${nextVarName} = ` + ref + '\n',
    });
    return nextVarName;
  }

  quickInvokeMethodWithCustomStr(method: keyof BufferWriter, str: string) {
    this.addOpeartion({
      type: 'write',
      code: `${this.opeartorVarName}.${method}(${str});`,
    });
  }

  quickInvokeMethod(method: keyof BufferWriter, prefix = '', suffix = '') {
    this.addOpeartion({
      type: 'write',
      code: `${this.opeartorVarName}.${method}(${prefix}${this.inputVarName}${suffix});`,
    });
  }

  addFactory(factory: ProtocolCodeFactory) {
    this.opreations.push(...factory.opreations);
  }

  opreations = [] as TProtocolCodeFactoryOpration[];
  addOpeartion(opearation: TProtocolCodeFactoryOpration) {
    this.opreations.push(opearation);
  }

  args() {
    const args = [this.inputVarName];
    return args;
  }

  header() {
    let code = '';
    code += `${this.opeartorVarName}.offset = 0;\n`;
    code += `var _x = ${this.inputVarName};\n`;

    return code;
  }

  body() {
    let code = '';

    const rawOp = this.opreations;
    for (let i = 0; i < rawOp.length; i++) {
      const e = rawOp[i];
      if (e.type === 'assertType') {
        code += `assertWriteType(${e.code}, ${e.decl}, ${e.inputVarName});\n`;
      }
      if (e.type === 'write') {
        code += `${e.code}\n`;
      }
      if (e.type === 'throw') {
        code += `throw new Error(${e.message});\n`;
      }
    }

    return code;
  }

  footer() {
    let code = '';
    code += `return ${this.opeartorVarName}.dump();\n`;
    return code;
  }

  create(options: ICompileWriterOptions = {}) {
    const buffer = allocateBuffer(options.initialAllocSize ?? 1024 * 1024);
    const writer = new BufferWriter(buffer);
    const body = `function ProtolWriter(${this.args().join(', ')}) {
  ${this.header()}
  ${this.body()}
  ${this.footer()}
}
return ProtolWriter;
`;

    console.log(body);
    const fn = new Function(this.opeartorVarName, 'assertWriteType', body);
    return fn(writer, assertWriteType);
  }
}

export class ProtocolBuilder {
  compact: boolean;
  decl: ProtocolDeclaration;
  constructor(decls: ProtocolDeclaration, options?: IProtobolBuilderOptions) {
    this.decl = decls;
    this.compact = !!options?.compact;
  }

  private createWriteFuncWithDeclaration(
    codeFactory: ProtocolCodeFactory,
    decl: ProtocolDeclaration,
  ): void {
    if (!decl) {
      throw new Error('Declaration is empty');
    }

    switch (decl.type) {
      case 'String':
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'string'`,
        );
        codeFactory.quickInvokeMethod('writeString');
        break;
      case 'Buffer':
        codeFactory.assert(
          decl,
          `Buffer.isBuffer(${codeFactory.inputVarName})`,
        );
        codeFactory.quickInvokeMethod('writeBuffer');
        break;
      case 'UInt8':
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'number'`,
        );
        codeFactory.quickInvokeMethod('writeUInt8');
        break;
      case 'UInt16':
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'number'`,
        );
        codeFactory.quickInvokeMethod('writeUInt16BE');
        break;
      case 'UInt32':
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'number'`,
        );
        codeFactory.quickInvokeMethod('writeUInt32BE');
        break;
      case 'JSONObject':
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'object'`,
        );
        codeFactory.quickInvokeMethod('writeString', 'JSON.stringify(', ')');
        break;
      case 'UBigInt':
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'bigint'`,
        );
        codeFactory.quickInvokeMethod('writeUBigInt');
        break;
      case 'Array': {
        codeFactory.comment(`Array ${decl.name} start`);
        codeFactory.assert(decl, `Array.isArray(${codeFactory.inputVarName})`);
        codeFactory.quickInvokeMethod('writeUIntVar', '', '.length');
        codeFactory.addOpeartion({
          type: 'write',
          code: `for (const element of ${codeFactory.inputVarName}) {`,
        });
        const newCodeFactory = new ProtocolCodeFactory();
        newCodeFactory.inputVarName = 'element';
        this.createWriteFuncWithDeclaration(
          newCodeFactory,
          (decl as ProtocolArrayDeclaration).element,
        );
        codeFactory.addFactory(newCodeFactory);
        codeFactory.addOpeartion({
          type: 'write',
          code: `}`,
        });
        codeFactory.comment(`Array ${decl.name} end`);
        break;
      }
      case 'Union': {
        codeFactory.comment(`Union ${decl.name} start`);
        codeFactory.assert(decl, `Array.isArray(${codeFactory.inputVarName})`);
        codeFactory.quickInvokeMethod('writeUInt8', '', '.length');

        const elements = (decl as ProtocolUnionDeclaration).elements;

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          const newCodeFactory = new ProtocolCodeFactory();
          const varName = newCodeFactory.varName(
            `${codeFactory.inputVarName}[${i}]`,
          );
          newCodeFactory.inputVarName = varName;
          this.createWriteFuncWithDeclaration(newCodeFactory, element);
          codeFactory.addFactory(newCodeFactory);
        }
        codeFactory.comment(`Union ${decl.name} end`);
        break;
      }
      case 'Object': {
        const fields = (decl as ProtocolObjectDeclaration).fields;
        if (!fields) {
          throw new Error('Object fields is empty');
        }
        codeFactory.comment(`Object ${decl.name} start`);
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'object'`,
        );

        codeFactory.quickInvokeMethodWithCustomStr(
          'writeUInt8',
          `${fields.length}`,
        );

        for (const field of fields) {
          const key = field.name;
          codeFactory.quickInvokeMethodWithCustomStr('writeString', `'${key}'`);
          const newCodeFactory = new ProtocolCodeFactory();
          const newInputVarName = `${codeFactory.inputVarName}['${key}']`;
          const varName = newCodeFactory.varName(newInputVarName);
          newCodeFactory.inputVarName = varName;
          this.createWriteFuncWithDeclaration(newCodeFactory, field);
          codeFactory.addFactory(newCodeFactory);
        }
        codeFactory.comment(`Object ${decl.name} end`);
        break;
      }
      case 'Undefined': {
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'undefined'`,
        );
        codeFactory.quickInvokeMethodWithCustomStr('writeUInt8', '0');
        break;
      }
      case 'Boolean':
        codeFactory.assert(
          decl,
          `typeof ${codeFactory.inputVarName} === 'boolean'`,
        );
        codeFactory.quickInvokeMethod('writeUInt8', '', ' ? 1 : 0');
        break;
      default:
        throw new Error(
          `${(decl as ProtocolDeclaration).name}: Unknown type ${
            (decl as ProtocolDeclaration).type
          }`,
        );
    }
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
      case 'UBigInt':
        fn = (reader) => {
          return reader.readUBigInt();
        };
        break;
      case 'Array': {
        const t = this.createReadFuncWithDeclaration(
          (decl as ProtocolArrayDeclaration).element,
        );
        fn = (reader) => {
          const length = reader.readUIntVar();
          const data = [] as unknown[];
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
          const data = [] as unknown[];
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
          const data = {} as Record<string, unknown>;
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
      case 'Undefined': {
        fn = (reader) => {
          reader.readUInt8();
          return undefined;
        };
        break;
      }
      case 'Boolean': {
        fn = (reader) => {
          return reader.readUInt8() === 1;
        };
        break;
      }
      default:
        throw new Error(`Unknown type ${(decl as ProtocolDeclaration).type}`);
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

  compileWriter(options: ICompileWriterOptions = {}) {
    const codeFactory = new ProtocolCodeFactory();
    this.createWriteFuncWithDeclaration(codeFactory, this.decl);
    return codeFactory.create(options);
  }
}
