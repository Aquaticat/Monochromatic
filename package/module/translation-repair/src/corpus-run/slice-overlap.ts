import { StatedRefusalError, } from '../stated-refusal.ts';

//region Slice overlap
// How many independent units a driver may have in flight at once.
//
// ITS OWN FILE because the dial is the thing under test rather than part of
// running a slice, and because `editor-calibrate.ts` is at its line budget:
// splitting is the remedy this repository prescribes for that, and a concept
// with its own name and its own refusal is what there was to split off.
//
// THE FALLBACK IS THE CALLER'S, not this file's. The editor calibration runs
// four slices at once by the owner's decision of 2026-08-26, taken on arm B
// against arms A and A2 (`doc/decision/translation-repair-calibration-overlap.md`);
// the corpus pass keeps running one at a time until `#261` measures it there.
// One dial, two defaults, so a launch that sets nothing gets what its driver
// was decided to do and a launch that sets the variable gets that everywhere.

/**
 * Environment variable naming how many slices may run at once.
 */
const OVERLAP_VAR = 'TRANSLATION_REPAIR_SLICE_OVERLAP';

/**
 * Fewest slices a driver can keep in flight and still do work.
 */
const MINIMUM_OVERLAP = 1;

/**
 * Slices the editor calibration keeps in flight when nobody said.
 *
 * FOUR, DECIDED ON MEASUREMENT: arm B (four in flight) ran the same four
 * slices in 24.18 min against arm A's 43.18 with the same call time, arm A2
 * repeated arm A unchanged in 58.95 min, and normalized as wall clock over
 * call time the arms read A 0.41, A2 0.38, B 0.23, six run-to-run bands apart.
 */
export const CALIBRATION_OVERLAP = 4;

/**
 * Reads how many slices may be in flight at once.
 *
 * REFUSES RATHER THAN FALLS BACK on a value it cannot read, because the whole
 * point of this dial is that two runs differ in it and nothing else: a typo
 * that silently became the fallback would produce two identical runs and a
 * comparison showing no effect, which is the worst possible outcome of a
 * measurement.
 *
 * @param fallback - slices in flight when nothing is set, which is what the
 * calling driver was decided to do
 *
 * @returns Slices allowed in flight, at least one
 *
 * @throws StatedRefusalError when the variable is set to anything but a whole
 * number of at least one
 *
 * @example
 * ```ts
 * const overlap = readOverlap({ fallback: CALIBRATION_OVERLAP, },);
 * ```
 */
export function readOverlap({ fallback, }: { readonly fallback: number; },): number {
  /**
   * Value as the invoker set it, empty when they set none.
   */
  const written = process.env[OVERLAP_VAR] ?? '';

  if (written === '')
    return fallback;

  /**
   * Value as a whole number, which a mistyped one is not.
   */
  const asked = Math.trunc(Number(written,),);

  if (!Number.isFinite(asked,))
    throw new StatedRefusalError({
      says: `${OVERLAP_VAR} must be a whole number, and ${written} is not one`,
    },);

  if (asked < MINIMUM_OVERLAP)
    throw new StatedRefusalError({
      says: `${OVERLAP_VAR} must be at least ${String(MINIMUM_OVERLAP,)}, and ${written} is not`,
    },);

  return asked;
}

//endregion Slice overlap
