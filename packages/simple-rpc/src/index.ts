import { IDisposable, Disposable } from './disposable';

type MaybePromise<T> = T | Promise<T> | PromiseLike<T>;

export interface ILogger {
  log(...args: any[]): void;
  error(...args: any[]): void;
}

export type IOptions = {
  onMessage: (cb: (data: any) => void) => IDisposable | void;
  postMessage: (data: any) => MaybePromise<void>;
  logger?: ILogger;
};

export type IRPCType = /** request */ 0 | /** response */ 1;

const RPC_TYPE = {
  REQUEST: 0,
  RESPONSE: 1,
} as const;

export type IFunction = (...args: any[]) => any;
export type IFunctionsCollection = Record<string, IFunction>;

export type TFunctionInvokeArgs = [
  IRPCType,
  /*msgId*/ string,
  /*method*/ string,
  /*args*/ any,
];

export interface ErrorLike {
  message: string;
  name: string;
  stack?: string;
  cause?: ErrorLike;
}

export type TResponseMessage = [
  /** response */ 1,
  /*msgId*/ string,
  /*error*/ ErrorLike,
  /*result*/ any,
];

function serializeErrorReplacer(key: string, value: any) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause,
    };
  }
  return value;
}

function serializeError(error: Error): ErrorLike {
  return JSON.parse(JSON.stringify(error, serializeErrorReplacer));
}

function reviveError(error: ErrorLike): Error {
  const result = new Error(error.message);
  result.name = error.name;
  result.stack = error.stack;
  if (error.cause) {
    (result as unknown as { cause: Error }).cause = reviveError(error.cause);
  }
  return result;
}

function isPromise<T = any>(obj: any): obj is Promise<T> {
  return (
    !!obj &&
    (typeof obj === 'object' || typeof obj === 'function') &&
    typeof obj.then === 'function'
  );
}

class RPCError extends Error {
  name = 'RPCError';
}

/**
 * This simple RPC client is used to communicate with each other between the webview and the host.
 * it use a duplex communication channel to send message and receive message(generalized as `postMessage` and `onMessage`).
 *
 * when client invoke a method, it will send a message to host, and wait for the host to return the result.
 */
export class RPCClient extends Disposable {
  nextMsgId = 0;

  postMessage: IOptions['postMessage'];
  onMessage: IOptions['onMessage'];

  #callbacks = {} as Record<string, (error: any, result: any) => void>;

  logger: ILogger;

  constructor(options: IOptions) {
    super();
    this.postMessage = options.postMessage;
    this.onMessage = options.onMessage;

    const dispose = this.onMessage((msg: TFunctionInvokeArgs) => {
      if (!Array.isArray(msg) || msg.length < 2) {
        return;
      }

      const [type, messageId, errorOrMethod, resultOrPayload] = msg;
      if (typeof type === 'undefined') {
        return;
      }

      if (type === RPC_TYPE.RESPONSE) {
        const callback = this.#callbacks[messageId];
        if (!callback) {
          return;
        }

        delete this.#callbacks[messageId];
        callback(errorOrMethod, resultOrPayload);
      } else {
        let result = undefined;
        let error: Error | undefined = undefined;

        const fn = this._functions[errorOrMethod];
        if (fn) {
          try {
            result = fn(...resultOrPayload);
          } catch (e) {
            error = e;
          }
        } else {
          error = new RPCError(`method ${errorOrMethod} not found`);
        }

        if (isPromise(result)) {
          result
            .then((res) =>
              this.postMessage(
                this._constructAnswer(messageId, undefined, res),
              ),
            )
            .catch((err) =>
              this.postMessage(this._constructAnswer(messageId, err)),
            );
        } else {
          this.postMessage(this._constructAnswer(messageId, error, result));
        }
      }
    });
    if (dispose) {
      this.addDispose(dispose);
    }
    this.logger = options.logger || console;
  }

  invoke(method: string, ...args: any[]) {
    const messageId = this.nextMsgId++ + '';
    const data = [
      RPC_TYPE.REQUEST,
      messageId,
      method,
      args,
    ] as TFunctionInvokeArgs;

    return new Promise((resolve, reject) => {
      this.#callbacks[messageId] = function (error, result) {
        if (error) {
          return reject(reviveError(error));
        }
        resolve(result);
      };
      this.postMessage(data);
    });
  }

  private _constructAnswer(
    answerId: string,
    error: Error,
    result?: any,
  ): TResponseMessage {
    if (error) {
      this.logger.error('RPCClient caught an error:', error);

      return [RPC_TYPE.RESPONSE, answerId, serializeError(error), null];
    } else {
      return [RPC_TYPE.RESPONSE, answerId, null, result];
    }
  }

  private _functions: IFunctionsCollection = {};

  on(_method: string, cb: IFunction): IDisposable {
    if (typeof cb === 'function') {
      this._functions[_method] = cb;
    } else {
      throw new Error('cb must be a function');
    }

    return {
      dispose: () => {
        delete this._functions[_method];
      },
    };
  }

  listenService(fns: IFunctionsCollection) {
    Object.entries(fns).forEach(([key, cb]) => {
      this.on(key, cb);
    });
  }

  createProxy<RemoteFunctions>() {
    return new Proxy(
      {},
      {
        get: (target, prop) => {
          return (...args: any[]) => {
            return this.invoke(prop.toString(), ...args);
          };
        },
      },
    ) as RemoteFunctions;
  }
}
