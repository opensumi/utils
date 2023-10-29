import { deserialize, serialize } from '../src/protocol-less';

describe('protocol less', () => {
  it('can serialize and deserialize', async () => {
    const data = [
      'hello',
      Buffer.from('world'),
      8,
      65535,
      4294967295,
      { hello: 'world' },
      15779779462787834424n,
      [
        'hello',
        Buffer.from('world'),
        8,
        65535,
        4294967295,
        { hello: 'world' },
        15779779462787834424n,
      ],
      undefined,
    ];

    const buffer = serialize(data);
    console.log(buffer);
    const data2 = deserialize(buffer);
    expect(data2).toEqual(data);
  });
});
