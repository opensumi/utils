import { deserialize, serialize } from '../src/protocol-less';
import { it, describe, expect } from 'vitest';

describe('protocol less', () => {
  it('primitive types', async () => {
    // 2147483647
    const data = [2147483647];

    const buffer = serialize(data);
    console.log(buffer);
    const data2 = deserialize(buffer);
    expect(data2).toEqual(data);
  });

  it('can serialize and deserialize', async () => {
    const data = [
      'hello',
      Buffer.from('world'),
      8,
      65535,
      2147483647,
      { hello: 'world' },
      15779779462787834424n,
      [
        'hello',
        Buffer.from('world'),
        8,
        65535,
        2147483647,
        { hello: 'world' },
        15779779462787834424n,
      ],
      undefined,
      true,
      false,
    ];

    const buffer = serialize(data);
    console.log(buffer);
    const data2 = deserialize(buffer);
    expect(data2).toEqual(data);
  });
});
