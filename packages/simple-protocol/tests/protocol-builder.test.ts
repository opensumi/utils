import { ProtocolBuilder } from '../src/protocol-builder';

describe('protocol builder', () => {
  it('Object should work', async () => {
    const protocol = new ProtocolBuilder({
      type: 'Object',
      name: 'test',
      fields: [
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
          type: 'UBigInt',
          name: 'bigint',
        },
        {
          type: 'Undefined',
          name: 'undefined',
        },
        {
          type: 'Union',
          name: 'union',
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
              type: 'UBigInt',
              name: 'bigint',
            },
          ],
        },
        {
          type: 'Array',
          name: 'testArray',
          element: {
            type: 'String',
            name: 'element',
          },
        },
        {
          type: 'Object',
          name: 'testNestObject',
          fields: [
            {
              name: 'aaa',
              type: 'String',
            },
            {
              name: 'bool',
              type: 'Boolean',
            },
          ],
        },
      ],
    });

    const reader = protocol.compileReader();
    const writer = protocol.compileWriter();

    const data = {
      type: 'hello',
      payload: Buffer.from('world'),
      eight: 8,
      sixteen: 65535,
      thirtytwo: 4294967295,
      json: { hello: 'world' },
      bigint: 15779779462787834424n,
      undefined: undefined,
      union: [
        'hello',
        Buffer.from('world'),
        8,
        65535,
        4294967295,
        { hello: 'world' },
        15779779462787834424n,
      ],
      testArray: ['hello', 'world'],
      testNestObject: {
        aaa: 'hello',
        bool: true,
      },
    };
    const buffer = writer(data);
    console.log(buffer);

    const data2 = reader(buffer);
    console.log(data2);

    expect(data2).toEqual(data);
  });

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
          type: 'UBigInt',
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
});
