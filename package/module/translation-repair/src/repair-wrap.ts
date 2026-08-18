import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { ChunkPair, } from './chunk-document.ts';
import type { ChunkRepairOutcome, } from './repair-contract.ts';
import { wrapReplacementText, } from './semantic-wrap.ts';

//region Repair lane wrap
// APPLIES THE SEMANTIC WRAP TO WHAT THE REPAIR LANE PRODUCED, at the one point
// both consumers read from.
//
// `assembleRepair` builds the replacements AND the lane wordings out of the
// same outcome list, and the delivery invariant requires those two to agree
// byte for byte: the ledger's rows are spliced over the archive and compared
// against the document the lane returned. Wrapping the list once, here, is what
// keeps them agreeing. Wrapping either consumer alone would break the other.
//
// ONLY CHANGED OUTCOMES ARE TOUCHED. An unchanged outcome carries the archive's
// own wording, and wrapping it would report a change nobody decided on. Two
// checks refuse exactly that, `assertReplacementsChange` and the delivery
// coherence rule that a replacement's wording may not be the archive's, so this
// is a correctness constraint rather than a preference.

/**
 * Wraps every changed repair outcome, re-deriving whether it still changes.
 *
 * RE-DERIVED RATHER THAN CARRIED FORWARD. A passage whose only difference from
 * the archive was its wrapping becomes identical to the archive once wrapped,
 * and an outcome still claiming a change at that point fails the assembly
 * assertion. It is a retention, so it is recorded as one. No slice in the pool
 * settled 2026-08-18 does this, which is why the case has its own test rather
 * than a measurement.
 *
 * @param slices - prepared slice pairs, for the archive wording per index
 *
 * @param outcomes - settled per-slice outcomes, refinement included
 *
 * @param l - lane logger
 *
 * @returns Same outcomes with produced wording wrapped
 *
 * @example
 * ```ts
 * const wrapped = wrapRepairOutcomes({ slices, outcomes, l, },);
 * ```
 */
export function wrapRepairOutcomes(
  {
    slices,
    outcomes,
    l,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly outcomes: readonly ChunkRepairOutcome[];
    readonly l: Logger;
  },
): readonly ChunkRepairOutcome[] {
  /**
   * Archive wording per slice index, which decides whether a wrap left anything
   * to change.
   */
  const incumbentByIndex = new Map(slices.map(function toEntry(slice,): readonly [number, string,] {
    return [
      slice.target
        .chunkIndex,
      slice.target
        .text,
    ];
  },),);

  /**
   * How many outcomes the wrap altered, and how many it demoted.
   */
  const counted = {
    rewrapped: 0,
    demoted: 0,
  };

  /**
   * Outcomes with produced wording wrapped.
   */
  const wrapped = outcomes.map(function perOutcome(outcome,): ChunkRepairOutcome {
    if (!outcome.changed)
      return outcome;

    /**
     * Wording as the rule would have it written.
     */
    const repairedText = wrapReplacementText({ text: outcome.repairedText, },);
    if (repairedText === outcome.repairedText)
      return outcome;
    counted.rewrapped += 1;

    /**
     * Archive wording here, absent when the slice is not in the pair list.
     */
    const incumbentText = incumbentByIndex.get(outcome.chunkIndex,);

    /**
     * Whether anything but the wrapping still separates the two.
     */
    const changed = repairedText !== incumbentText;
    if (!changed)
      counted.demoted += 1;

    return {
      ...outcome,
      repairedText,
      changed,
    };
  },);

  if (counted.rewrapped > 0)
    l.info(
      `semantic wrap: rewrapped ${String(counted.rewrapped,)} of ${
        String(outcomes.length,)
      } repair outcomes, ${String(counted.demoted,)} of them back to the archive's own wording`,
    );

  return wrapped;
}

//endregion Repair lane wrap
