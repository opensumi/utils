export interface MessageQueueOptions<T> {
  send: (e: T) => void;
  sendChannelIsReady: () => boolean;
  flushTimeout?: number;
}

export class MessageQueue<T extends any> {
  private _queue: T[] = [];
  private _flushing = false;

  private _send: (e: T) => void;
  private _sendChannelIsReady: () => boolean;

  private _flushTimeout: number;

  constructor(options: MessageQueueOptions<T>) {
    this._send = options.send;
    this._sendChannelIsReady = options.sendChannelIsReady;
    this._flushTimeout = options.flushTimeout || 16;
  }

  flush() {
    if (!this._sendChannelIsReady()) {
      return;
    }
    this._flush();
  }

  private _flush() {
    if (this._flushing) {
      return;
    }
    this._flushing = true;
    while (this._queue.length > 0) {
      const e = this._queue.shift();
      this._send(e);
    }
    this._flushing = false;
  }

  push(data: T) {
    this._queue.push(data);
  }

  clear() {
    this._queue = [];
    this._flushing = false;
  }

  dispose() {
    this._queue = [];
  }

  get length() {
    return this._queue.length;
  }

  scheduled: any;
  scheduleFlush() {
    if (this.length === 0) {
      return;
    }

    if (this._sendChannelIsReady()) {
      this._flush();
      return;
    }
    if (this.scheduled) {
      clearTimeout(this.scheduled);
    }

    this.scheduled = setTimeout(() => {
      this.scheduleFlush();
    }, this._flushTimeout);
  }
}
