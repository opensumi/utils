import { RPCClient } from '../src';
import { MessageChannel } from 'node:worker_threads';
import { sleep } from './utils';

describe('simple-rpc', () => {
  it('should work', async () => {
    const channel = new MessageChannel();
    const c1 = new RPCClient({
      postMessage: channel.port1.postMessage.bind(channel.port1),
      onMessage: (cb) => {
        channel.port1.on('message', cb);
      },
    });

    const c2 = new RPCClient({
      postMessage: channel.port2.postMessage.bind(channel.port2),
      onMessage: (cb) => {
        channel.port2.on('message', cb);
      },
    });

    c1.on('short', async (url: string) => {
      await sleep(100);
      return url;
    });

    c2.on('add', (a: number, b: number) => {
      return a + b;
    });

    const result = await c1.invoke('add', 1, 2);
    expect(result).toBe(3);

    const url = await c2.invoke('short', 'https://www.google.com');
    expect(url).toBe('https://www.google.com');

    channel.port1.close();
    channel.port2.close();
  });

  it('can handle error', async () => {
    const channel = new MessageChannel();
    const c1 = new RPCClient({
      postMessage: channel.port1.postMessage.bind(channel.port1),
      onMessage: (cb) => {
        channel.port1.on('message', cb);
      },
    });

    const c2 = new RPCClient({
      postMessage: channel.port2.postMessage.bind(channel.port2),
      onMessage: (cb) => {
        channel.port2.on('message', cb);
      },
    });

    c2.on('add', async (a: number, b: number) => {
      throw new Error('error');
    });

    expect(c1.invoke('add', 1, 2)).rejects.toThrow('error');

    channel.port1.close();
    channel.port2.close();
  });
});
