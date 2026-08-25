import { StatedRefusalError, } from '../stated-refusal.ts';

//region Asked count
// How many units a person asked a bench or calibration to run, read off the
// command line and refused when it is not a count.
//
// FOUR CLIs SPELLED THIS `Number(process.argv[2] ?? String(DEFAULT_SLICES,),)`
// and none of them checked the result. `Number('fourty')` is `NaN`,
// `pickSpreadSample` takes `slice(0, NaN)` and returns nothing, and the run
// then edits, judges and reports over an empty sample. It prints its roster, it
// prints its totals, it exits zero, and every number in it is over no slices at
// all. `#231` measured that: `count NaN -> picked 0`.
//
// A CALIBRATION THAT MEASURED NOTHING IS WORSE THAN ONE THAT REFUSED, because
// the operator reads the clean exit as evidence. That is the whole argument for
// putting a refusal here rather than a fallback: falling back to the default
// would also hide the typo, and would spend a roster doing it.
//
// ZERO IS REFUSED TOO, unlike the audit's `--cap 0`. That cap has a use, namely
// reading a whole archive and buying nothing, and these have none: a bench over
// zero slices asks nobody anything and reports nothing. Where a run wants to do
// nothing, not running it is the way to say so.

/**
 * Position a bare count is written at, after the runtime and the script.
 */
const COUNT_ARGV_INDEX = 2;

/**
 * Smallest count worth running, since a bench over none measures nothing.
 */
const AT_LEAST = 1;

/**
 * Reads how many units a run was asked for.
 *
 * @param argv - process arguments, passed rather than read so this is testable
 * without a subprocess
 *
 * @param fallback - count to run when the person named none
 *
 * @param asks - what this run calls the things it counts, for the refusal
 * sentence; a person reading `slices` should not have to guess
 *
 * @returns Count asked for, or the fallback when none was named
 *
 * @throws StatedRefusalError when a count was named that is not a whole number
 * of at least one
 *
 * @example
 * ```ts
 * const wanted = readAskedCount({ argv: process.argv, fallback: 6, asks: 'slices', },);
 * ```
 */
export function readAskedCount(
  {
    argv,
    fallback,
    asks,
  }: {
    readonly argv: readonly string[];
    readonly fallback: number;
    readonly asks: string;
  },
): number {
  /**
   * Count as written, empty when the person named none.
   */
  const written = argv[COUNT_ARGV_INDEX] ?? '';
  if (written === '')
    return fallback;

  /**
   * Count as a whole number, which a mistyped one is not.
   */
  const asked = Math.trunc(Number(written,),);

  if (!Number.isFinite(asked,))
    throw new StatedRefusalError({
      says: `${asks} must be a whole number, and ${written} is not one`,
    },);

  if (asked < AT_LEAST)
    throw new StatedRefusalError({
      says: `${asks} must be at least ${String(AT_LEAST,)}, and ${written} is not`,
    },);

  return asked;
}

//endregion Asked count
