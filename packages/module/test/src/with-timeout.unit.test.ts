/**
 * Tests for the `withTimeout` utility.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

await describe({
  name: 'withTimeout',
  children: [
    it({
      name: 'resolves when promise settles in time',
      fn: async () => {
        const DELAY = 10;
        const TIMEOUT = 200;
        const result = await it({
          name: 'fast',
          fn: async () => new Promise((resolve,) => {
            setTimeout(resolve, DELAY,);
          },),
          timeout: TIMEOUT,
        },);
        expect(result.name,).toBe('fast',);
      },
    }),

    it({
      name: 'rejects with descriptive message on timeout',
      fn: async () => {
        const DELAY = 300;
        const TIMEOUT = 10;
        const rejection = it({
          name: 'timeout-label',
          fn: async () => new Promise((resolve,) => {
            setTimeout(resolve, DELAY,);
          },),
          timeout: TIMEOUT,
        },);
        await expect(rejection,).rejects.toBeInstanceOf(Error,);
        await expect(rejection,).rejects.toHaveProperty('message', 'timeout-label',);
      },
    }),
  ],
},);
