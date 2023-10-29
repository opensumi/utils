import { createPair, sleep } from './utils';

describe('simple-rpc', () => {
  it('should work', async () => {
    const { c1, c2, dispose } = createPair();
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

    dispose();
  });

  it('can invoke undefined method', async () => {
    const { c1, c2, dispose } = createPair();

    c2.on('add', (a: number, b: number) => {
      return a + b;
    });

    expect(c1.invoke('add1', 1, 2)).rejects.toThrow();

    await c1.invoke('add2').catch((e) => {
      console.log(e);
      expect(e.message).toBe('method add2 not found');
    });

    dispose();
  });

  it('can handle error', async () => {
    const { c1, c2, dispose } = createPair();

    c2.on('add', async () => {
      const err = new Error('error');
      err.cause = new Error('cause');

      throw err;
    });

    expect(c1.invoke('add', 1, 2)).rejects.toThrow(
      new Error('error', {
        cause: new Error('cause'),
      }),
    );

    dispose();
  });

  it('has service style', async () => {
    const { c1, c2, dispose } = createPair();
    c1.on('short', async (url: string) => {
      await sleep(100);
      return url;
    });

    interface C1 {
      short(url: string): Promise<string>;
    }

    interface C2 {
      add(a: number, b: number): Promise<number>;
    }

    const client2 = c2.createProxy<C1, C2>({
      add: async (a: number, b: number) => {
        return a + b;
      },
    });

    const client1 = c1.createProxy<C2, C1>({
      short: async (url: string) => {
        return url;
      },
    });

    const result = await client1.add(1, 2);
    expect(result).toBe(3);

    const url = await client2.short('https://www.google.com');
    expect(url).toBe('https://www.google.com');

    dispose();
  });
});
