import { EventEmitter } from '../src';

const emitter = new EventEmitter<{
  foo: [string, string];
}>();

emitter.on('foo', (arg1, arg2) => {
  console.log(arg1, arg2);
});

emitter.emit('foo', 'bar', 'baz'); // => bar baz
