export type Handler = (...args: any[]) => void;

export class EventEmitter<T> {
  private _listeners: Map<T, Handler[]> = new Map();

  on(event: T, listener: Handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push(listener);

    return () => this.off(event, listener);
  }

  off(event: T, listener: Handler) {
    if (!this._listeners.has(event)) {
      return;
    }
    const listeners = this._listeners.get(event)!;
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  once(event: T, listener: Handler) {
    const remove: () => void = this.on(event, (...args: any[]) => {
      remove();
      listener.apply(this, args);
    });

    return remove;
  }

  emit(event: T, ...args: any[]) {
    if (!this._listeners.has(event)) {
      return;
    }
    [...this._listeners.get(event)!].forEach((listener) =>
      listener.apply(this, args),
    );
  }

  hasListener(event: T) {
    return this._listeners.has(event);
  }

  getListeners(event: T) {
    return this._listeners.get(event) || [];
  }

  dispose() {
    this._listeners.clear();
  }
}
