/**
 Round-trip and concatenation tests for the UTF-8 byte helpers shipped as
 `@internal` exports of the built artifact.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  bytesToString,
  concatBytes,
  stringToBytes,
} from '../dist/final/neutral/index.mjs';

await describe({
  name: 'byte conversions',
  children: [
    it({
      name: 'round-trips ASCII text through its exact UTF-8 bytes',
      fn: async () => {
        /**
         ASCII fixture decoded back below.
         */
        const ascii = 'hello config';

        expect(Array.from(stringToBytes('hi',),),).toEqual([
          104,
          105,
        ],);
        expect(bytesToString(stringToBytes(ascii,),),).toBe(ascii,);
      },
    },),

    it({
      name: 'round-trips multi-byte UTF-8 and emoji text through their exact bytes',
      fn: async () => {
        /**
         Mixed-width fixture carrying two-byte,
         three-byte,
         and four-byte code points.
         */
        const mixed = 'héllo 世界 🎉';

        expect(Array.from(stringToBytes('é',),),).toEqual([
          195,
          169,
        ],);
        expect(Array.from(stringToBytes('🎉',),),).toEqual([
          240,
          159,
          142,
          137,
        ],);
        expect(bytesToString(stringToBytes(mixed,),),).toBe(mixed,);
      },
    },),

    it({
      name: 'encodes the empty string as zero bytes and decodes empty bytes back',
      fn: async () => {
        expect(stringToBytes('',),).toHaveLength(0,);
        expect(bytesToString(new Uint8Array(0,),),).toBe('',);
      },
    },),

    it({
      name: 'concatenates multiple chunks into one buffer in order',
      fn: async () => {
        /**
         Joined result of three consecutive chunks.
         */
        const joined = concatBytes([
          new Uint8Array([
            1,
            2,
          ],),
          new Uint8Array([
            3,
          ],),
          new Uint8Array([
            4,
            5,
          ],),
        ],);

        expect(Array.from(joined,),).toEqual([
          1,
          2,
          3,
          4,
          5,
        ],);
      },
    },),

    it({
      name: 'copies a single chunk into one buffer of its own',
      fn: async () => {
        /**
         Lone chunk handed to `concatBytes`.
         */
        const chunk = new Uint8Array([
          7,
          8,
          9,
        ],);
        /**
         Result buffer built from the lone chunk.
         */
        const joined = concatBytes([chunk],);

        expect(joined === chunk,).toBe(false,);
        expect(Array.from(joined,),).toEqual([
          7,
          8,
          9,
        ],);
      },
    },),

    it({
      name: 'returns a zero-length buffer for no chunks',
      fn: async () => {
        expect(concatBytes([],),).toHaveLength(0,);
      },
    },),

    it({
      name: 'agrees with the runtime TextEncoder and TextDecoder on mixed text',
      fn: async () => {
        /**
         Fixture exercising every conversion width at once.
         */
        const mixed = 'abc é 世 🎉';
        /**
         Reference encoding from the runtime itself.
         */
        const expectedBytes = new TextEncoder()
          .encode(mixed,);

        expect(stringToBytes(mixed,),).toEqual(expectedBytes,);
        expect(bytesToString(expectedBytes,),).toBe(new TextDecoder().decode(expectedBytes,),);
      },
    },),
  ],
},);
