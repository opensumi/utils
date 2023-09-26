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

    c2.on('add', async (a: number, b: number) => {
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
});
