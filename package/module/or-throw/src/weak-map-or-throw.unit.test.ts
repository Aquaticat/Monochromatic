/**
 * Tests for `weakMapOrThrow`.
 *
 * @module
 */

import {
  describe,
  expect,
  expectTypeOf,
  it,
} from '@monochromatic-dev/module-test/ts';

import { weakMapOrThrow, } from '@monochromatic-dev/module-or-throw';

await describe({
  name: weakMapOrThrow.name,
  children: [
    it({
      name: 'returns the value when it is a WeakMap',
      fn: async () => {
        const wm = new WeakMap();
        expect(weakMapOrThrow(wm,),).toBe(wm,);
      },
    },),

    it({
      name: 'throws on every non-WeakMap value',
      fn: async () => {
        expect(() => weakMapOrThrow(new Map(),)).toThrow('WeakMap',);
        expect(() => weakMapOrThrow(new WeakSet(),)).toThrow('WeakMap',);
        expect(() => weakMapOrThrow([],)).toThrow('WeakMap',);
        expect(() => weakMapOrThrow({},)).toThrow('WeakMap',);
        expect(() => weakMapOrThrow(null,)).toThrow('WeakMap',);
      },
    },),

    it({
      name: 'narrows unknown to WeakMap<object, unknown>',
      fn: async () => {
        const input: unknown = new WeakMap();
        const output = weakMapOrThrow(input,);
        expectTypeOf(output,).toEqualTypeOf<WeakMap<object, unknown>>();
      },
    },),
  ],
},);
