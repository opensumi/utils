export interface IDisposable {
  dispose(): void;
}

/**
 *
 * ```ts
 * interface EventTypes {
 *   'event-with-parameters': any[];
 *   'event-with-parameters2': [string, number];
 *   'event-with-example-handler': (...args: any[]) => void;
 * }
 * ```
 */
export type EventTypes = object;
type Argument = any;

type ArgumentMap<T extends object> = {
  [K in keyof T]: T[K] extends (...args: Argument[]) => void
    ? Parameters<T[K]>
    : T[K] extends Argument[]
    ? T[K]
    : Argument[];
};

export type EventNames<T extends EventTypes> = T extends string | symbol
  ? T
  : keyof T;

export type EventListener<
  T extends EventTypes,
  K extends EventNames<T>,
> = T extends string | symbol
  ? (...args: Argument[]) => void
  : (
      ...args: ArgumentMap<Exclude<T, string | symbol>>[Extract<K, keyof T>]
    ) => void;

export class EventEmitter<Events extends EventTypes = EventTypes> {
  private _listeners: Map<
    EventNames<Events>,
    EventListener<Events, EventNames<Events>>[]
  > = new Map();

  on<T extends EventNames<Events>>(
    event: T,
    listener: EventListener<Events, T>,
  ): IDisposable {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push(listener);

    return {
      dispose: () => this.off(event, listener),
    };
  }

  off<T extends EventNames<Events>>(
    event: T,
    listener: EventListener<Events, T>,
  ) {
    if (!this._listeners.has(event)) {
      return;
    }

    const listeners = this._listeners.get(event)!;
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  once<T extends EventNames<Events>>(
    event: T,
    listener: EventListener<Events, T>,
  ) {
    const remove = this.on(event, ((
      ...args: Parameters<EventListener<Events, T>>
    ) => {
      remove.dispose();
      listener.apply(this, args);
    }) as EventListener<Events, T>);

    return remove;
  }

  emit<T extends EventNames<Events>>(
    event: T,
    ...args: Parameters<EventListener<Events, T>>
  ) {
    if (!this._listeners.has(event)) {
      return;
    }
    [...this._listeners.get(event)!].forEach((listener) =>
      listener.apply(this, args),
    );
  }

  hasListener<T extends EventNames<Events>>(event: T) {
    return this._listeners.has(event);
  }

  eventNames() {
    return Array.from(this._listeners.keys());
  }

  getAllListeners<T extends EventNames<Events>>(
    event: T,
  ): Array<EventListener<Events, T>> {
    return this._listeners.get(event) || [];
  }

  removeAllListeners<T extends EventNames<Events>>(event: T) {
    this._listeners.delete(event);
  }

  dispose() {
    this._listeners.clear();
  }
}
