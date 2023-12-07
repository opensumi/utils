# @opensumi/simple-rpc

This simple RPC client is used to communicate with each other between the client and the server.

it use a duplex communication channel to send message and receive message(generalized as `postMessage` and `onMessage`).

when client invoke a method, it will send a message to host, and wait for the host to return the result.

## Installation

```bash
npm install @opensumi/simple-rpc
```

## Usage

```typescript
import { RPCClient } from '@opensumi/simple-rpc';

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
```
