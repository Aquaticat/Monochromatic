import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { parseMemoryToBytes, } from './boot.ts';

//region parseMemoryToBytes -- converts human-readable memory strings to byte counts

await describe({
  name: parseMemoryToBytes.name,
  children: [
    it({
      name: 'parses gigabytes',
      fn: async () => {
        expect(parseMemoryToBytes('4G',),).toBe(4 * 1_073_741_824,);
      },
    }),

    it({
      name: 'parses megabytes',
      fn: async () => {
        expect(parseMemoryToBytes('2048M',),).toBe(2048 * 1_048_576,);
      },
    }),

    it({
      name: 'parses lowercase g',
      fn: async () => {
        expect(parseMemoryToBytes('8g',),).toBe(8 * 1_073_741_824,);
      },
    }),

    it({
      name: 'parses lowercase m',
      fn: async () => {
        expect(parseMemoryToBytes('512m',),).toBe(512 * 1_048_576,);
      },
    }),

    it({
      name: 'parses 1G correctly',
      fn: async () => {
        expect(parseMemoryToBytes('1G',),).toBe(1_073_741_824,);
      },
    }),

    it({
      name: 'rejects missing unit',
      fn: async () => {
        expect(() => {
          parseMemoryToBytes('4096',);
        },)
          .toThrow('invalid memory format',);
      },
    }),

    it({
      name: 'rejects invalid unit',
      fn: async () => {
        expect(() => {
          parseMemoryToBytes('4T',);
        },)
          .toThrow('invalid memory format',);
      },
    }),

    it({
      name: 'rejects empty string',
      fn: async () => {
        expect(() => {
          parseMemoryToBytes('',);
        },)
          .toThrow('invalid memory format',);
      },
    }),

    it({
      name: 'rejects non-numeric prefix',
      fn: async () => {
        expect(() => {
          parseMemoryToBytes('abcG',);
        },)
          .toThrow('invalid memory format',);
      },
    }),

    it({
      name: 'rejects decimal values',
      fn: async () => {
        expect(() => {
          parseMemoryToBytes('4.5G',);
        },)
          .toThrow('invalid memory format',);
      },
    }),
  ],
},);

//endregion parseMemoryToBytes
