import { EventEmitter } from '../src/index';
import { vi, it, describe, expect } from 'vitest';

describe('event emitter', () => {
  it('basic usage', () => {
    const emitter = new EventEmitter<{
      [key: string]: [string];
    }>();

    const spy = vi.fn();
    const spy2 = vi.fn();
    emitter.on('test', spy);
    emitter.on('foo', spy2);

    expect(emitter.hasListener('test')).toBe(true);
    const listeners = emitter.getAllListeners('test');
    expect(listeners.length).toBe(1);

    emitter.emit('test', 'hello');
    expect(spy).toBeCalledWith('hello');
    emitter.off('test', spy);

    const listeners2 = emitter.getAllListeners('test');
    expect(listeners2.length).toBe(0);

    emitter.emit('test', 'hello');
    expect(spy).toBeCalledTimes(1);

    emitter.once('test', spy);
    emitter.emit('test', 'hello');
    expect(spy).toBeCalledTimes(2);
    emitter.emit('test', 'hello');
    expect(spy).toBeCalledTimes(2);

    emitter.off('bar', spy);

    emitter.dispose();

    emitter.emit('test', 'hello');
    expect(spy).toBeCalledTimes(2);
  });

  it('many listeners listen to one event', () => {
    const emitter = new EventEmitter<{
      [key: string]: [string];
    }>();
    const spy = vi.fn();
    const spy2 = vi.fn();
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
    const spy = vi.fn();
    const spy2 = vi.fn();
    const spy3 = vi.fn();
    const disposeSpy = emitter.on('test', (...args) => {
      spy(...args);
    });
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
});
