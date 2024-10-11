import { EventEmitter } from '../src';

const emitter = new EventEmitter<{
  foo: [string, string];
  bar: [number];
}>();

emitter.on('foo', (arg1, arg2) => {
  console.log(arg1, arg2);
});

emitter.on('bar', (num) => {
  console.log(num);
});

emitter.emit('foo', 'bar', 'baz'); // => bar baz
emitter.emit('bar', 42); // => 42
