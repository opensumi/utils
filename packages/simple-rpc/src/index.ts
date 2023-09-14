export interface IDisposable {
  dispose(): void;
}

export interface ILogger {
  log(...args: any[]): void;
  error(...args: any[]): void;
}

export type IOptions = {
  onMessage: (cb: (msg: any) => void) => void;
  postMessage: (msg: any) => void;
  logger?: ILogger;
};

type TOnMessageCbParams = [
  /*msgId*/ string,
  /*method*/ string,
  /*payload*/ any,
];

const kResponsePrefix = '-->';

const getUniqueId = (id: string | number) => `${id}`;

/**
 * 判断是不是 Promise
 */
function isPromise(obj: any) {
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
          return reject(new Error(error));
        }
        resolve(result);
      };
      this.postMessage(data);
    });
  }

  private _constructAnswer(messageId: string, error: any, result?: any) {
    const answerId = kResponsePrefix + messageId;
    if (error) {
      this.logger.error('Worker caught an error:', error);
      return [answerId, { message: error.message }, null];
    } else {
      return [answerId, null, result];
    }
  }

  private _functions: Record<string, any> = {};

  on(_method: string, cb: (msg: any) => any): IDisposable {
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
    try {
      const callbackResult = fn.apply(undefined, payload);
      result = { res: callbackResult };
    } catch (e) {
      result = { err: e };
    }
    if (result.err) {
      this.postMessage(this._constructAnswer(messageId, result.err));
    } else if (isPromise(result.res)) {
      result.res
        .then((res) =>
          this.postMessage(this._constructAnswer(messageId, null, res)),
        )
        .catch((err) =>
          this.postMessage(this._constructAnswer(messageId, err)),
        );
    } else {
      this.postMessage(this._constructAnswer(messageId, null, result.res));
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
