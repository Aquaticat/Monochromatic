/**
 * Tests for the `describe` suite runner.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

await describe({
  name: 'describe',
  children: [
    it({
      name: 'returns name on success',
      fn: async () => {
        const result = await describe({
          name: 'inner-suite',
          children: [
            it({ name: 'passing', fn: async () => {}, },),
          ],
        },);
        expect(result.name,).toBe('inner-suite',);
      },
    }),

    it({
      name: 'runs children concurrently',
      fn: async () => {
        const DELAY = 100;
        const MAX_SEQUENTIAL = 180;
        const start = performance.now();

        await describe({
          name: 'concurrent-suite',
          children: [
            it({
              name: 'child-a',
              fn: async () => new Promise((resolve,) => {
                setTimeout(resolve, DELAY,);
              },),
            }),
            it({
              name: 'child-b',
              fn: async () => new Promise((resolve,) => {
                setTimeout(resolve, DELAY,);
              },),
            }),
          ],
        },);

        const elapsed = performance.now() - start;
        expect(elapsed,).toBeLessThan(MAX_SEQUENTIAL,);
      },
    }),

    it({
      name: 'wraps single child failure',
      fn: async () => {
        const rejection = describe({
          name: 'failing-suite',
          children: [
            it({
              name: 'bad',
              fn: async () => {
                throw new Error('boom',);
              },
            }),
          ],
        },);
        await expect(rejection,).rejects.toBeInstanceOf(Error,);
        await expect(rejection,).rejects.toHaveProperty('message', 'failing-suite',);
      },
    }),

    it({
      name: 'wraps multiple child failures in AggregateError',
      fn: async () => {
        const rejection = describe({
          name: 'multi-fail-suite',
          children: [
            it({
              name: 'bad-1',
              fn: async () => {
                throw new Error('one',);
              },
            }),
            it({
              name: 'bad-2',
              fn: async () => {
                throw new Error('two',);
              },
            }),
          ],
        },);
        await expect(rejection,).rejects.toBeInstanceOf(Error,);
        await expect(rejection,).rejects.toHaveProperty('message', 'multi-fail-suite',);
      },
    }),

    it({
      name: 'empty name re-throws cause directly',
      fn: async () => {
        const rejection = describe({
          name: '',
          children: [
            it({
              name: 'bad',
              fn: async () => {
                throw new Error('direct',);
              },
            }),
          ],
        },);
        await expect(rejection,).rejects.toBeInstanceOf(Error,);
        await expect(rejection,).rejects.toHaveProperty('message', 'bad',);
      },
    }),

    it({
      name: 'limits concurrency to the given value',
      fn: async () => {
        const DELAY = 50;
        const CHILD_COUNT = 4;
        let peak = 0;
        let active = 0;

        /**
         * Creates a thunk that tracks concurrent active count
         * while sleeping for DELAY ms.
         *
         * @param index - Child index used for naming
         *
         * @returns thunk returning a promise that resolves after DELAY
         */
        function makeChild(index: number,) {
          return () => it({
            name: `limited-${String(index,)}`,
            fn: async () => {
              active += 1;
              if (active > peak) {
                peak = active;
              }

              await new Promise((resolve,) => {
                setTimeout(resolve, DELAY,);
              },);
              active -= 1;
            },
          },);
        }

        await describe({
          name: 'concurrency-suite',
          concurrency: 2,
          children: Array.from({ length: CHILD_COUNT, }, (_, index,) => makeChild(index,),),
        },);

        expect(peak,).toBe(2,);
      },
    }),

    it({
      name: 'respects suite timeout',
      fn: async () => {
        const DELAY = 300;
        const TIMEOUT = 50;
        const rejection = describe({
          name: 'slow-suite',
          children: [
            it({
              name: 'slow',
              fn: async () => new Promise((resolve,) => {
                setTimeout(resolve, DELAY,);
              },),
            }),
          ],
          timeout: TIMEOUT,
        },);
        await expect(rejection,).rejects.toBeInstanceOf(Error,);
      },
    }),
  ],
},);
