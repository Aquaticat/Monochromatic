/**
 * Tests for reading how many units a bench or calibration was asked for.
 *
 * THE REFUSAL IS THE POINT, and it replaced four copies of a silent fallback.
 * `editor-calibrate`, `producer-calibrate`, `roster-bench` and
 * `editor-width-probe` each spelled this `Number(process.argv[2] ?? default)`
 * and none checked the result. `Number('fourty')` is `NaN`, and
 * `pickSpreadSample` with a count of `NaN` returns nothing, measured: `count
 * NaN -> picked 0`. So a typo ran the whole calibration over an empty sample,
 * printed its roster and its totals, and exited zero.
 *
 * WHY REFUSING BEATS FALLING BACK. A fallback also hides the typo, and it
 * spends a roster while hiding it. The operator who typed `fourty` wanted forty
 * slices, and would read a clean six-slice default as the forty they asked for.
 *
 * ZERO IS REFUSED, WHICH THE AUDIT'S `--cap 0` IS NOT. That cap reads a whole
 * archive and buys nothing, which is a real use. A bench over zero slices asks
 * nobody anything, so there is nothing for it to mean.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  readAskedCount,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

//region Asked count tests

/**
 * What `process.argv` carries before anything a person typed.
 */
const BEFORE_COUNT: readonly string[] = [
  '/usr/bin/node',
  '/somewhere/editor-calibrate.mjs',
];

/**
 * Count a run does when nobody names one.
 */
const FALLBACK = 6;

/**
 * Count one operator asked for instead.
 */
const ASKED_FOR = 40;

/**
 * What the counted things are called, which the refusal has to name.
 */
const ASKS = 'slices';

/**
 * A count typed the way a person mistypes one.
 */
const MISTYPED = 'fourty';

/**
 * Builds a command line the way `process.argv` presents one.
 *
 * @param typed - what the operator wrote after the script path
 *
 * @returns Whole argument vector, script path and all
 *
 * @example
 * ```ts
 * const argv = commandLine({ typed: ['40',], },);
 * ```
 */
function commandLine(
  { typed, }: { readonly typed: readonly string[]; },
): readonly string[] {
  return [
    ...BEFORE_COUNT,
    ...typed,
  ];
}

/**
 * Reads a count off a command line carrying only what was typed.
 *
 * @param typed - what the operator wrote after the script path
 *
 * @returns Count the reader settled on
 *
 * @throws StatedRefusalError when the reader refuses what was typed
 *
 * @example
 * ```ts
 * const wanted = countFrom({ typed: ['40',], },);
 * ```
 */
function countFrom(
  { typed, }: { readonly typed: readonly string[]; },
): number {
  return readAskedCount({
    argv: commandLine({ typed, },),
    fallback: FALLBACK,
    asks: ASKS,
  },);
}

await describe({
  name: readAskedCount.name,
  children: [
    it({
      name: 'FALLS BACK when nobody named a count',
      fn: async () => {
        expect(countFrom({ typed: [], },),).toBe(FALLBACK,);
      },
    },),
    it({
      name: 'READS the count that was named',
      fn: async () => {
        expect(countFrom({ typed: [String(ASKED_FOR,),], },),).toBe(ASKED_FOR,);
      },
    },),
    it({
      name: 'TRUNCATES a fractional count rather than refusing it',
      fn: async () => {
        expect(countFrom({ typed: ['40.9',], },),).toBe(ASKED_FOR,);
      },
    },),
    it({
      name: 'REFUSES a count that is not a number, instead of running over nothing',
      fn: async () => {
        expect(() => {
          countFrom({ typed: [MISTYPED,], },);
        },).toThrow(StatedRefusalError,);
      },
    },),
    it({
      name: 'NAMES both the units and what was typed, so the operator can see the typo',
      fn: async () => {
        expect(() => {
          countFrom({ typed: [MISTYPED,], },);
        },).toThrow(`${ASKS} must be a whole number, and ${MISTYPED} is not one`,);
      },
    },),
    it({
      name: 'REFUSES a count of zero, which would ask nobody anything',
      fn: async () => {
        expect(() => {
          countFrom({ typed: ['0',], },);
        },).toThrow(StatedRefusalError,);
      },
    },),
    it({
      name: 'REFUSES a negative count, which no sampler can take',
      fn: async () => {
        expect(() => {
          countFrom({ typed: ['-3',], },);
        },).toThrow('slices must be at least 1, and -3 is not',);
      },
    },),
    it({
      name: 'REFUSES a count that is a number with something after it',
      fn: async () => {
        // `Number('40slices')` is `NaN`, so this lands on the same refusal as a
        // word. Held separately because it is the near miss a person actually
        // types, and because a reader built on `parseInt` would accept it as 40.
        expect(() => {
          countFrom({ typed: ['40slices',], },);
        },).toThrow(StatedRefusalError,);
      },
    },),
    it({
      name: 'REFUSES an unbounded count, which truncates to itself and never lands',
      fn: async () => {
        expect(() => {
          countFrom({ typed: ['Infinity',], },);
        },).toThrow(StatedRefusalError,);
      },
    },),
    it({
      name: 'FALLS BACK for an argument written empty, which names no count',
      fn: async () => {
        expect(countFrom({ typed: ['',], },),).toBe(FALLBACK,);
      },
    },),
    it({
      name: 'ANSWERS in the caller\'s own words, so two runs do not share a noun',
      fn: async () => {
        expect(() => {
          readAskedCount({
            argv: commandLine({ typed: [MISTYPED,], },),
            fallback: FALLBACK,
            asks: 'entries',
          },);
        },).toThrow(`entries must be a whole number, and ${MISTYPED} is not one`,);
      },
    },),
  ],
},);

//endregion Asked count tests
