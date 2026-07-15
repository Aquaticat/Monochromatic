/**
 * Tests for `errorOrThrow`.
 *
 * @module
 */

import {
  describe,
  expect,
  expectTypeOf,
  it,
} from '@monochromatic-dev/module-test/ts';

import { errorOrThrow, } from '@monochromatic-dev/module-or-throw';

await describe({
  name: errorOrThrow.name,
  children: [
    it({
      name: 'returns Error instances unchanged',
      fn: async () => {
        const e = new Error('boom',);
        expect(errorOrThrow(e,),).toBe(e,);
      },
    },),

    it({
      name: 'returns Error subclass instances unchanged',
      fn: async () => {
        const te = new TypeError('bad type',);
        expect(errorOrThrow(te,),).toBe(te,);
        const re = new RangeError('out of range',);
        expect(errorOrThrow(re,),).toBe(re,);
      },
    },),

    it({
      name: 'throws on non-Error values, including error-shaped plain objects',
      fn: async () => {
        expect(() => errorOrThrow('boom',)).toThrow('Error',);
        expect(() => errorOrThrow({ message: 'boom', },)).toThrow('Error',);
        expect(() => errorOrThrow(null,)).toThrow('Error',);
        expect(() => errorOrThrow(undefined,)).toThrow('Error',);
      },
    },),

    it({
      name: 'narrows unknown to Error',
      fn: async () => {
        const caught: unknown = new Error('boom',);
        const output = errorOrThrow(caught,);
        expectTypeOf(output,).toEqualTypeOf<Error>();
      },
    },),
  ],
},);
