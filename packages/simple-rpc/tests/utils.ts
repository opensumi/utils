import { RPCClient } from '../src';
import { MessageChannel } from 'node:worker_threads';

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createPair() {
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

  return {
    c1,
    c2,
    channel,
    dispose: () => {
      channel.port1.close();
      channel.port2.close();
    },
  };
}
