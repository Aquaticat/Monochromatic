import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { ChunkPair, } from './chunk-document.ts';
import { wrapReplacementText, } from './semantic-wrap.ts';
import type { TranslateSliceRecord, } from './translate-document-contract.ts';

//region Translate lane wrap
// APPLIES THE SEMANTIC WRAP TO WHAT THE TRANSLATE LANE PRODUCED, at the one
// point both consumers read from.
//
// `assembleTranslation` builds the replacements AND the lane wordings out of
// the same settled list, and the delivery invariant requires those two to agree
// byte for byte. Wrapping the list once, here, is what keeps them agreeing.
//
// ONLY CHANGED RECORDS ARE TOUCHED. A record that stands on the archive, either
// because the judges preferred it or because no translator answered, carries
// the archive's own wording; wrapping it would report a change nobody decided
// on and would contradict `sliceRecordAgrees`.

/**
 * Wraps every changed translate record, re-deriving whether it still changes.
 *
 * RE-DERIVED RATHER THAN CARRIED FORWARD, for the reason `wrapRepairOutcomes`
 * gives: a passage differing from the archive only in its wrapping becomes the
 * archive once wrapped, and a record still claiming a change there fails the
 * assembly assertion.
 *
 * NEVER APPLIED TO A LINE-STRUCTURED SLICE. The pipeline hands a governed
 * producer `TRANSLATE_LINE_STRUCTURE_RULE`, one output line per original line,
 * and then broke that work afterwards: over the 211 line-structured slices of
 * the pinned corpus the wrap changed 189 and broke 470 of 1091 lines, after
 * every decider had approved them. Flattening is caught by the structural
 * guard and sent back to its author instead of papered over here, because
 * `wrapReplacementText` splits and never joins, so it cannot put back a break
 * a producer merged away.
 *
 * @param slices - prepared slice pairs, for the archive wording per index
 *
 * @param settled - settled per-slice records in document order
 *
 * @param lineStructuredSlices - global indices the line-structure rule
 * governs, whose lines are the producer's to set
 *
 * @param l - lane logger
 *
 * @returns Same records with produced wording wrapped
 *
 * @example
 * ```ts
 * const wrapped = wrapTranslateRecords({ slices, settled, lineStructuredSlices, l, },);
 * ```
 */
export function wrapTranslateRecords(
  {
    slices,
    settled,
    lineStructuredSlices,
    l,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly settled: readonly TranslateSliceRecord[];
    readonly lineStructuredSlices: ReadonlySet<number>;
    readonly l: Logger;
  },
): readonly TranslateSliceRecord[] {
  /**
   * Archive wording per slice index, which decides whether a wrap left anything
   * to change.
   */
  const incumbentByIndex = new Map(slices.map(function toEntry(slice,): readonly [
    number,
    string,
  ] {
    return [
      slice.target
        .sliceIndex,
      slice.target
        .text,
    ];
  },),);

  /**
   * How many records the wrap altered, and how many it demoted.
   */
  const counted = {
    rewrapped: 0,
    demoted: 0,
    governed: 0,
  };

  /**
   * Records with produced wording wrapped.
   */
  const wrapped = settled.map(function perRecord(record,): TranslateSliceRecord {
    if (!record.changed)
      return record;

    // LEFT EXACTLY AS PRODUCED, like a record that changed nothing. The
    // line-structure rule made this slice's line breaks the producer's to set,
    // and this function only ever adds more.
    if (lineStructuredSlices.has(record.sliceIndex,)) {
      counted.governed += 1;
      return record;
    }

    /**
     * Wording as the rule would have it written.
     */
    const outputText = wrapReplacementText({ text: record.outputText, },);
    if (outputText === record.outputText)
      return record;
    counted.rewrapped += 1;

    /**
     * Whether anything but the wrapping still separates it from the archive.
     */
    const changed = outputText !== incumbentByIndex.get(record.sliceIndex,);
    if (!changed)
      counted.demoted += 1;

    return {
      ...record,
      outputText,
      changed,
    };
  },);

  if (counted.governed > 0)
    l.info(
      `semantic wrap: skipped ${String(counted.governed,)} line-structured translated slices, whose `
        + 'line breaks the producer was told to set',
    );

  if (counted.rewrapped > 0)
    l.info(
      `semantic wrap: rewrapped ${String(counted.rewrapped,)} of ${
        String(settled.length,)
      } translated slices, ${String(counted.demoted,)} of them back to the archive's own wording`,
    );

  return wrapped;
}

//endregion Translate lane wrap
