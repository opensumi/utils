import { ProtocolBuilder } from '../src/create-protocol';

describe('create protocol', () => {
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
    ]);

    const reader = protocol.compileReader();
    const writer = protocol.compileWriter();

    const data = ['hello', Buffer.from('world')];

    const buffer = writer(data);
    console.log(buffer);

    const data2 = reader(buffer);
    console.log(data2);

    expect(data2).toEqual(data);
    expect;
  });
});
