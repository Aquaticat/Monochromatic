/**
 * Tests that the overlap dial REFUSES rather than falling back.
 *
 * WHY A FALLBACK WOULD BE THE WORST OUTCOME. This dial exists so two runs can
 * differ in exactly one value and nothing else. A value it cannot read that
 * quietly became `1` would produce two sequential runs, a comparison showing no
 * difference, and a recorded conclusion that overlapping units does nothing.
 * That is not a failed measurement, it is a wrong one, and it would be believed.
 *
 * THE DEFAULT IS STILL A FALLBACK, deliberately: an UNSET variable is an
 * invoker who did not ask for overlap, which is a different thing from one who
 * asked for something unreadable.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  readOverlap,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Environment variable naming how many slices may run at once.
 */
const OVERLAP_VAR = 'TRANSLATION_REPAIR_SLICE_OVERLAP';

/**
 * Sets the dial for the duration of one case, restoring whatever was there.
 *
 * @param says - value to set, or nothing to clear it
 *
 * @returns Disposable putting the invoker's own value back
 *
 * @example
 * ```ts
 * using dial = dialSaying({ says: '4', },);
 * ```
 */
function dialSaying({ says, }: { readonly says?: string; },): Disposable {
  /**
   * Value as the invoking shell left it.
   */
  const before = process.env[OVERLAP_VAR];

  if (says === undefined)
    delete process.env.TRANSLATION_REPAIR_SLICE_OVERLAP;
  else
    process.env[OVERLAP_VAR] = says;

  return {
    [Symbol.dispose]: () => {
      if (before === undefined)
        delete process.env.TRANSLATION_REPAIR_SLICE_OVERLAP;
      else
        process.env[OVERLAP_VAR] = before;
    },
  };
}

//endregion Fixtures

await describe({
  name: readOverlap.name,
  // ONE AT A TIME. Every case here writes the same process-wide variable, and
  // `describe` runs its children concurrently by default, so two cases would
  // read each other's setting and the file would fail in a way that looks like
  // the code under test.
  concurrency: 1,
  children: [
    it({
      name: 'runs SEQUENTIALLY when nobody asked, so a driver invoked the way it always was behaves '
        + 'the way it always did and the control arm of any comparison is the same program',
      fn: async () => {
        using dial = dialSaying({},);

        expect(readOverlap(),).toBe(1,);
        expect(process.env[OVERLAP_VAR],).toBe(undefined,);
        expect(dial,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'READS a whole number, which is the case the dial exists for',
      fn: async () => {
        using dial = dialSaying({ says: '4', },);

        expect(readOverlap(),).toBe(4,);
        expect(dial,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'REFUSES a value that is not a number rather than falling back to one, because a typo '
        + 'that quietly became sequential would produce a comparison of two identical runs and a '
        + 'recorded conclusion that overlapping units changes nothing',
      fn: async () => {
        using dial = dialSaying({ says: 'four', },);

        /**
         * What the reader threw on a value nothing could read.
         */
        const refusal = caught(function readsProse() {
          readOverlap();
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain(OVERLAP_VAR,);
        expect((refusal as Error).message,).toContain('four',);
        expect(dial,).not.toBe(undefined,);
      },
    },),

    it({
      name: 'REFUSES zero, which is not a smaller amount of work but no work at all: a limit of zero '
        + 'admits nothing and the run would wait forever having said nothing about why',
      fn: async () => {
        using dial = dialSaying({ says: '0', },);

        /**
         * What the reader threw on a limit that admits nothing.
         */
        const refusal = caught(function readsZero() {
          readOverlap();
        },);

        expect(refusal,).toBeInstanceOf(StatedRefusalError,);
        expect((refusal as Error).message,).toContain('at least 1',);
        expect(dial,).not.toBe(undefined,);
      },
    },),
  ],
},);
