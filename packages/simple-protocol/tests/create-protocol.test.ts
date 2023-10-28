import { ProtocolBuilder } from '../src/protocol-builder';

describe('protocol builder', () => {
  it('should work', async () => {
    const protocol = new ProtocolBuilder([
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
    ]);

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