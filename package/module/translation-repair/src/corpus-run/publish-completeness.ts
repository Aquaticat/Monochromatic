import type { UnfilledSlice, } from '../translate-document-contract.ts';

//region Publication completeness
// A corpus artifact may retain evidence about a missing passage, and a published
// memorial page omits such a passage only with the gap recorded, never silently.
//
// THE PAGE SHIPS WITHOUT THE PASSAGE, since the no-loop design of 2026-09-01
// (doc/planning/translation-repair-no-loop-design.md, "Insertion placement,
// single round"): an insertion is recovered supplementary content whose
// absence is a recorded gap, not a missing required page. A refusal that
// predated that design outlived it: on 2026-09-02 it dropped XIEPT2 after 35
// minutes over one passage the judges could not back in two rounds, and the
// publish test records an earlier XIEPT2 attempt lost the same way after four
// hours forty-eight minutes. The pass has recorded the gap as findings and
// published since; the refusal, kept for callers that might want to fail
// closed, had none, and went on 2026-09-29 with its error class (ledger B30).

/**
 Findings that record each unfilled source passage a page ships without.

 @param unfilled - source passages with no shipped rendering

 @returns One finding per passage, naming the slice and why it is unfilled

 @example
 ```ts
 unfilledPageFindings({ unfilled: [{ sliceIndex: 15, reason: 'no-candidate-backed', findings: [], }], },);
 // => ['source-passage-unfilled (slice 15, no-candidate-backed): the page ships without this passage, recorded as a gap']
 ```
 */
export function unfilledPageFindings(
  { unfilled, }: { readonly unfilled: readonly UnfilledSlice[]; },
): readonly string[] {
  return unfilled.map(function toFinding(passage,): string {
    return `source-passage-unfilled (slice ${String(passage.sliceIndex,)}, ${passage.reason}): `
      + 'the page ships without this passage, recorded as a gap';
  },);
}

//endregion Publication completeness
