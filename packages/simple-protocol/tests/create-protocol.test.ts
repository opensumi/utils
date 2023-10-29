import {
  ProtocolBuilder,
  serialize,
  deserialize,
} from '../src/protocol-builder';

describe('protocol builder', () => {
  it('Array should work', async () => {
    const protocol = new ProtocolBuilder({
      type: 'Array',
      name: 'test',
      element: {
        type: 'String',
        name: 'element',
      },
    });

    const reader = protocol.compileReader();
    const writer = protocol.compileWriter();

    const data = ['hello', 'world'];

    const buffer = writer(data);
    console.log(buffer);

    const data2 = reader(buffer);
    console.log(data2);

    expect(data2).toEqual(data);

    const data3 = [...data, 1234];
    expect(() => writer(data3)).toThrowError(
      'Field(element): Expected String, got number',
    );
  });
  it('Union should work', async () => {
    const protocol = new ProtocolBuilder({
      type: 'Union',
      name: 'test',
      elements: [
        {
          type: 'String',
          name: 'type',
        },
        {
          type: 'Buffer',
          name: 'payload',
        },
        {
          type: 'UInt8',
          name: 'eight',
        },
        {
          type: 'UInt16',
          name: 'sixteen',
        },
        {
          type: 'UInt32',
          name: 'thirtytwo',
        },
        {
          type: 'JSONObject',
          name: 'json',
        },
        {
          type: 'BigInt',
          name: 'bigint',
        },
      ],
    });

    const reader = protocol.compileReader();
    const writer = protocol.compileWriter();

    const data = [
      'hello',
      Buffer.from('world'),
      8,
      65535,
      4294967295,
      { hello: 'world' },
      15779779462787834424n,
    ];

    const buffer = writer(data);
    console.log(buffer);

    const data2 = reader(buffer);
    console.log(data2);

    expect(data2).toEqual(data);
  });

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
