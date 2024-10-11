import { MessageQueue } from '../src/index';
import { it, describe, expect } from 'vitest';

describe('message-queue', () => {
  it('should work', () => {
    const result = [] as any[];
    let isReady = false;
    const mq = new MessageQueue({
      send: (e) => {
        result.push(e);
      },
      isReady: () => isReady,
    });

    mq.push(1);
    expect(result).toEqual([]);
    mq.flush();
    expect(result).toEqual([]);
    isReady = true;
    mq.flush();
    expect(result).toEqual([1]);

    mq.push(2);
    mq.push(3);
    expect(result).toEqual([1, 2, 3]);
  });

  it('dispose should work', () => {
    const result = [] as any[];
    let isReady = false;
    const mq = new MessageQueue({
      send: (e) => {
        result.push(e);
      },
      isReady: () => isReady,
    });

    mq.push(1);
    mq.push(2);
    mq.push(3);
    expect(result).toEqual([]);

    mq.dispose();
    mq.push(4);
    isReady = true;
    mq.flush();
    expect(result).toEqual([4]);
  });
});
