export interface IDisposable {
  dispose(): void;
}

export interface ILogger {
  log(...args: any[]): void;
  error(...args: any[]): void;
}

export type IOptions = {
  onMessage: (cb: (data: any) => void) => void;
  postMessage: (data: any) => void;
  logger?: ILogger;
};

type TOnMessageCbParams = [
  /*msgId*/ string,
  /*method*/ string,
  /*payload*/ any,
];

export interface ErrorLike {
  message: string;
  name: string;
  stack?: string;
  cause?: ErrorLike;
}

type TResponseMessage = [/*msgId*/ string, /*error*/ ErrorLike, /*result*/ any];

const kResponsePrefix = '-->';

const getUniqueId = (id: string | number) => `${id}`;

function serializeErrorReplacer(key: string, value: any) {
  if (value?.constructor.name === 'Error') {
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

/**
 * This simple RPC client is used to communicate with each other between the webview and the host.
 * it use a duplex communication channel to send message and receive message(generalized as `postMessage` and `onMessage`).
 *
 * when client invoke a method, it will send a message to host, and wait for the host to return the result.
 * the send format is: [messageId, method, payload], and client will waiting for a response message: ['response-'+messageId, error, result].
 */
export class RPCClient {
  nextMsgId = 0;

  postMessage: IOptions['postMessage'];
  onMessage: IOptions['onMessage'];

  #callbacks = {} as Record<string, (error: any, result: any) => void>;

  logger: ILogger;

  constructor(options: IOptions) {
    this.postMessage = options.postMessage;
    this.onMessage = options.onMessage;

    this.onMessage((msg: TOnMessageCbParams) => {
      if (!Array.isArray(msg) || msg.length < 2) {
        // 不是符合规范的 message
        return;
      }

      const [messageId, errorOrMethod, resultOrPayload] = msg;
      if (!messageId) {
        // 不是符合规范的 message
        return;
      }

      if (messageId.startsWith(kResponsePrefix)) {
        const callbackId = messageId.slice(kResponsePrefix.length);
        const callback = this.#callbacks[callbackId];
        if (!callback) {
          // 没找到对应的回调函数，不是符合规范的 message
          return;
        }
        delete this.#callbacks[callbackId];
        callback(errorOrMethod, resultOrPayload);
      } else {
        // 不是响应的 message，是 invoke 发过来的 message
        if (!errorOrMethod) {
          return;
        }

        const fn = this._functions[errorOrMethod];
        if (!fn) {
          return;
        }

        this.execFn(messageId, fn, resultOrPayload);
      }
    });

    this.logger = options.logger || console;
  }

  invoke(method: string, ...payload: any[]) {
    const messageId = getUniqueId(this.nextMsgId++);
    const data = [messageId, method, payload];

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
    messageId: string,
    error: Error,
    result?: any,
  ): TResponseMessage {
    const answerId = kResponsePrefix + messageId;
    if (error) {
      this.logger.error('RPCClient caught an error:', error);

      return [answerId, serializeError(error), null];
    } else {
      return [answerId, null, result];
    }
  }

  private _functions: Record<string, any> = {};

  on(_method: string, cb: (...args: any[]) => any): IDisposable {
    if (typeof cb === 'function') {
      this._functions[_method] = cb;
    }

    return {
      dispose: () => {
        delete this._functions[_method];
      },
    };
  }

  private execFn(messageId: string, fn: any, payload: any) {
    let result = null;
    let error: Error | null = null;
    try {
      result = fn.apply(undefined, payload);
    } catch (e) {
      error = e;
    }

    if (error) {
      this.postMessage(this._constructAnswer(messageId, error));
    } else if (isPromise(result)) {
      result
        .then((res) =>
          this.postMessage(this._constructAnswer(messageId, null, res)),
        )
        .catch((err) =>
          this.postMessage(this._constructAnswer(messageId, err)),
        );
    } else {
      this.postMessage(this._constructAnswer(messageId, null, result));
    }
  }

  private saveFunctionsForProxy(fns: Record<string, any>) {
    Object.entries(fns).forEach(([key, cb]) => {
      this.on(key, cb);
    });
  }

  createProxy<RemoteFunctions, LocalFunctions>(functions: LocalFunctions) {
    this.saveFunctionsForProxy(functions);
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
