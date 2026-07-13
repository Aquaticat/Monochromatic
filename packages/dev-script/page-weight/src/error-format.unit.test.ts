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
        /** Number of caller-owned coercion method invocations. */
        let coercionCount = 0;
        /** Thrown reference carrying ordinary coercion method. */
        const ordinaryValue = {
          toString(): string {
            coercionCount++;
            return 'coerced';
          },
        };
        /** Thrown reference carrying preferred primitive-conversion method. */
        const exoticValue = {
          [Symbol.toPrimitive](): string {
            coercionCount++;
            return 'coerced';
          },
        };
        /** Number of caller-owned proxy property reads. */
        let proxyReadCount = 0;
        /** Thrown proxy whose conversion-property lookup is observable. */
        const proxyValue = new Proxy({}, {
          get(): never {
            proxyReadCount++;
            throw new Error('unexpected conversion property read',);
          },
        },);
        expect(caughtErrorMessage(ordinaryValue,),).toBe(
          'Non-Error thrown value of type object',
        );
        expect(caughtErrorMessage(exoticValue,),).toBe(
          'Non-Error thrown value of type object',
        );
        expect(caughtErrorMessage(proxyValue,),).toBe(
          'Non-Error thrown value of type object',
        );
        expect(coercionCount,).toBe(0,);
        expect(proxyReadCount,).toBe(0,);
      },
    },),
  ],
},);
