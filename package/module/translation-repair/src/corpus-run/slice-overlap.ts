import { StatedRefusalError, } from '../stated-refusal.ts';

//region Slice overlap
// How many independent units the calibration may have in flight at once.
//
// ITS OWN FILE because the dial is the thing under test rather than part of
// running a slice, and because `editor-calibrate.ts` is at its line budget:
// splitting is the remedy this repository prescribes for that, and a concept
// with its own name and its own refusal is what there was to split off.

/**
 * Environment variable naming how many slices may run at once.
 */
const OVERLAP_VAR = 'TRANSLATION_REPAIR_SLICE_OVERLAP';

/**
 * Slices in flight when nobody said, which is the sequential driver.
 */
const DEFAULT_OVERLAP = 1;

/**
 * Reads how many slices may be in flight at once.
 *
 * REFUSES RATHER THAN FALLS BACK on a value it cannot read, because the whole
 * point of this dial is that two runs differ in it and nothing else: a typo
 * that silently became one would produce two sequential runs and a comparison
 * showing no effect, which is the worst possible outcome of a measurement.
 *
 * @returns Slices allowed in flight, at least one
 *
 * @throws StatedRefusalError when the variable is set to anything but a whole
 * number of at least one
 *
 * @example
 * ```ts
 * const overlap = readOverlap();
 * ```
 */
export function readOverlap(): number {
  /**
   * Value as the invoker set it, empty when they set none.
   */
  const written = process.env[OVERLAP_VAR] ?? '';

  if (written === '')
    return DEFAULT_OVERLAP;

  /**
   * Value as a whole number, which a mistyped one is not.
   */
  const asked = Math.trunc(Number(written,),);

  if (!Number.isFinite(asked,))
    throw new StatedRefusalError({
      says: `${OVERLAP_VAR} must be a whole number, and ${written} is not one`,
    },);

  if (asked < DEFAULT_OVERLAP)
    throw new StatedRefusalError({
      says: `${OVERLAP_VAR} must be at least ${String(DEFAULT_OVERLAP,)}, and ${written} is not`,
    },);

  return asked;
}

//endregion Slice overlap
