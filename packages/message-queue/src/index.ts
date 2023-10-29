export interface MessageQueueOptions<T> {
  send: (e: T) => void;
  isReady: () => boolean;
  flushTimeout?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
export class MessageQueue<T extends any> {
  private _queue: T[] = [];
  private _flushing = false;

  private _send: (e: T) => void;
  private _isReady: () => boolean;

  private _flushTimeout: number;

  constructor(options: MessageQueueOptions<T>) {
    this._send = options.send;
    this._isReady = options.isReady;
    this._flushTimeout = options.flushTimeout || 16;
  }

  private _ready = false;
  get ready() {
    return this._ready || (this._ready = this._isReady());
  }

  flush() {
    if (!this.ready) {
      return;
    }
    this._flush();
  }

  getQueue() {
    return this._queue;
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
    this.flush();
  }

  clear() {
    this._queue = [];
    this._flushing = false;
  }

  dispose() {
    this.clear();
  }

  get length() {
    return this._queue.length;
  }

  scheduled: ReturnType<typeof setTimeout> | undefined;
  scheduleFlush() {
    if (this.length === 0) {
      return;
    }

    if (this.ready) {
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
