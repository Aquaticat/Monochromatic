/**
 * Tests for caught-error formatting.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { caughtErrorMessage, } from './error-format.ts';

await describe({
  name: caughtErrorMessage.name,
  children: [
    it({
      name: 'returns Error messages and thrown strings',
      fn: async () => {
        /** Error instance carrying expected message. */
        const error = new Error('missing');
        expect(caughtErrorMessage(error,),).toBe('missing',);
        expect(caughtErrorMessage('plain failure',),).toBe('plain failure',);
      },
    },),
    it({
      name: 'does not invoke coercion hooks on thrown references',
      fn: async () => {
        /** Number of caller-owned coercion hook invocations. */
        let coercionCount = 0;
        /** Thrown reference carrying observable coercion hook. */
        const value = {
          toString(): string {
            coercionCount++;
            return 'coerced';
          },
        };
        expect(caughtErrorMessage(value,),).toBe(
          'Non-Error thrown value of type object',
        );
        expect(coercionCount,).toBe(0,);
      },
    },),
  ],
},);
