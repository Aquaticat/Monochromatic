/**
 * Tests for naming a caught value.
 *
 * The cases that matter are the ones a `catch` binding actually sees, which is
 * anything at all: this exists because asserting a caught value to `Error` is a
 * claim nobody checked, and the throw that breaks that assumption is the throw
 * whose report someone is reading.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { errorName, } from '../dist/final/node/index.mjs';

await describe({
  name: errorName.name,
  children: [
    it({
      name: 'NAMES a plain Error by its class',
      fn: async () => {
        expect(errorName({ error: new Error('a cat sat on the keyboard',), },),).toBe('Error',);
      },
    },),
    it({
      name: 'NAMES a subclass by ITS name rather than by Error, which is the whole point of asking',
      fn: async () => {
        /**
         * Error class standing in for the pipeline's named ones.
         */
        class TabbyMissingError extends Error {
          /**
           * Names itself the way the pipeline's error classes do.
           *
           * @example
           * ```ts
           * throw new TabbyMissingError();
           * ```
           */
          constructor() {
            super('no tabby',);
            this.name = 'TabbyMissingError';
          }
        }

        expect(errorName({ error: new TabbyMissingError(), },),).toBe('TabbyMissingError',);
      },
    },),
    it({
      name: 'REFUSES to invent a name for a thrown string, which is legal JavaScript and carries none',
      fn: async () => {
        expect(errorName({ error: 'mittens', },),).toBe('a thrown value that is not an Error',);
      },
    },),
    it({
      name:
        'REFUSES to invent one for null, the case a `error.name` read would crash on rather than '
        + 'merely mis-report',
      fn: async () => {
        expect(errorName({ error: null, },),).toBe('a thrown value that is not an Error',);
      },
    },),
    it({
      name: 'REFUSES to invent one for an object that merely LOOKS like an error by having a name',
      fn: async () => {
        expect(errorName({ error: { name: 'NotReallyAnError', }, },),)
          .toBe('a thrown value that is not an Error',);
      },
    },),
  ],
},);
