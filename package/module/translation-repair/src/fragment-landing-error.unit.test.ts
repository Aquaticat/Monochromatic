/**
 Tests for the error a fragment landing outside its slice throws, and the check that throws it (`fragment-landing-error.ts`).

 Fixtures are cat-themed invention.

 @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertLandingInside,
  FragmentLandingError,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: FragmentLandingError.name,
      concurrency: 1,
      children: [
        it({
          name: 'IS an Error named for its class',
          fn: async () => {
            /**
             The error for a landing that ends past its slice.
             */
            const error = new FragmentLandingError({
              slice: 24,
              start: 30,
              end: 31,
            },);
            expect(Error.isError(error,),).toBe(true,);
            expect(error.name,).toBe('FragmentLandingError',);
          },
        },),

        it({
          name: 'NAMES the offsets and the length of the slice in its message, and no text',
          fn: async () => {
            /**
             The error for a landing that ends before it starts.
             */
            const { message, } = new FragmentLandingError({
              slice: 24,
              start: 9,
              end: 3,
            },);
            expect(message,).toContain('lands at 9 to 3 in a slice of 24 units',);
          },
        },),
      ],
    },),

    describe({
      name: assertLandingInside.name,
      concurrency: 1,
      children: [
        it({
          name: 'ACCEPTS a landing inside the slice, empty or whole',
          fn: async () => {
            assertLandingInside({
              slice: 24,
              start: 8,
              end: 20,
            },);
            assertLandingInside({
              slice: 24,
              start: 0,
              end: 24,
            },);
            assertLandingInside({
              slice: 24,
              start: 5,
              end: 5,
            },);
          },
        },),

        it({
          name: 'THROWS for a landing that starts before the slice, ends past it, or ends before it starts',
          fn: async () => {
            for (const [start, end,] of [[-1, 3,], [20, 25,], [9, 3,],] as const) {
              expect(caught(function landOutside(): void {
                assertLandingInside({
                  slice: 24,
                  start,
                  end,
                },);
              },) instanceof FragmentLandingError,).toBe(true,);
            }
          },
        },),
      ],
    },),
  ],
},);
