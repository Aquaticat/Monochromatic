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
 * @param slices - prepared slice pairs, for the archive wording per index
 *
 * @param settled - settled per-slice records in document order
 *
 * @param l - lane logger
 *
 * @returns Same records with produced wording wrapped
 *
 * @example
 * ```ts
 * const wrapped = wrapTranslateRecords({ slices, settled, l, },);
 * ```
 */
export function wrapTranslateRecords(
  {
    slices,
    settled,
    l,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly settled: readonly TranslateSliceRecord[];
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
        .chunkIndex,
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
  };

  /**
   * Records with produced wording wrapped.
   */
  const wrapped = settled.map(function perRecord(record,): TranslateSliceRecord {
    if (!record.changed)
      return record;

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
    const changed = outputText !== incumbentByIndex.get(record.chunkIndex,);
    if (!changed)
      counted.demoted += 1;

    return {
      ...record,
      outputText,
      changed,
    };
  },);

  if (counted.rewrapped > 0)
    l.info(
      `semantic wrap: rewrapped ${String(counted.rewrapped,)} of ${
        String(settled.length,)
      } translated slices, ${String(counted.demoted,)} of them back to the archive's own wording`,
    );

  return wrapped;
}

//endregion Translate lane wrap
