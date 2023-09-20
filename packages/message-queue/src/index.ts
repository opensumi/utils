export class MessageQueue {
  private _queue: any[] = [];
  private _flushing = false;

  private _send: (e: any) => void;
  private _sendChannelIsReady: () => boolean;

  constructor(options: {
    send: (e: any) => void;
    sendChannelIsReady: () => boolean;
  }) {
    this._send = options.send;
    this._sendChannelIsReady = options.sendChannelIsReady;
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

  push(data: any) {
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
    }, 50);
  }
}
