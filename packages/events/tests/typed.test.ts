import { EventEmitter } from '../src/index';

describe('typed event emitter', () => {
  it('basic usage', () => {
    const emitter = new EventEmitter<{
      test: [string, string];
      foo: [string];
    }>();

    const spy = jest.fn();
    const spy2 = jest.fn();

    emitter.on('test', spy);
    emitter.on('foo', spy2);

    expect(emitter.hasListener('test')).toBe(true);
    const listeners = emitter.getAllListeners('test');
    expect(listeners.length).toBe(1);

    emitter.emit('test', 'hello', 'world');
    expect(spy).toBeCalledWith('hello', 'world');
    emitter.off('test', spy);

    const listeners2 = emitter.getAllListeners('test');
    expect(listeners2.length).toBe(0);

    emitter.emit('test', 'hello', 'world');
    expect(spy).toBeCalledTimes(1);

    emitter.once('test', spy);
    emitter.emit('test', 'hello', 'world');
    expect(spy).toBeCalledTimes(2);
    emitter.emit('test', 'hello', 'world');
    expect(spy).toBeCalledTimes(2);

    // @ts-expect-error bar is not a valid event
    emitter.off('bar', spy);

    emitter.dispose();

    emitter.emit('test', 'hello', 'world2');
    expect(spy).toBeCalledTimes(2);
  });

  it('many listeners listen to one event', () => {
    const emitter = new EventEmitter<{
      [key: string]: [string];
    }>();
    const spy = jest.fn();
    const spy2 = jest.fn();
    emitter.on('test', spy);
    emitter.on('test', spy2);
    emitter.emit('test', 'hello');
    expect(spy).toBeCalledWith('hello');
    expect(spy2).toBeCalledWith('hello');

    emitter.off('test', spy);
    emitter.emit('test', 'hello');
    expect(spy).toBeCalledTimes(1);
    expect(spy2).toBeCalledTimes(2);

    emitter.dispose();
  });

  it('can dispose event listener by using returned function', () => {
    const emitter = new EventEmitter<{
      [key: string]: [string];
    }>();
    const spy = jest.fn();
    const spy2 = jest.fn();
    const spy3 = jest.fn();
    const disposeSpy = emitter.on('test', spy);
    emitter.on('test', spy2);

    const disposeSpy3 = emitter.once('test', spy3);
    disposeSpy3.dispose();

    emitter.emit('test', 'hello');
    expect(spy).toBeCalledWith('hello');
    expect(spy2).toBeCalledWith('hello');

    disposeSpy.dispose();
    emitter.emit('test', 'hello');

    expect(spy).toBeCalledTimes(1);
    expect(spy2).toBeCalledTimes(2);
    expect(spy3).toBeCalledTimes(0);
    emitter.dispose();
  });

  it('event type can be string literal', () => {
    const emitter = new EventEmitter<{
      test: [...args: any];
    }>();
    const spy = jest.fn();
    emitter.on('test', spy);
    emitter.emit('test');
    expect(spy).toBeCalledTimes(1);

    emitter.dispose();
  });

  it('event type can be function', () => {
    const emitter = new EventEmitter<{
      test: (a: string, b: number) => void;
    }>();
    const spy = jest.fn();
    emitter.on('test', (a, b) => {
      spy(a, b);
    });
    emitter.emit('test', 'hello', 1);
    expect(spy).toBeCalledWith('hello', 1);

    const events = emitter.getAllListeners('test');
    expect(events.length).toBe(1);

    const eventNames = emitter.eventNames();
    expect(eventNames.length).toBe(1);

    emitter.dispose();
  });
});
