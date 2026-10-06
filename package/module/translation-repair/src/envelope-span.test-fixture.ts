import type { EditableEnvelope, } from '../dist/final/node/index.mjs';

//region Envelope span
// WHAT A CASE COMPARES OF AN ENVELOPE. An envelope carries two fields derived
// by hashing (`envelopeId`, `baseHash`), which a case would have to compute
// with the code under test to spell out; the four others say where the
// envelope lies, what text it holds and which issues it serves.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. Two test files each kept their own copy of
// this projection, which the duplicate-bodies scan found; both import it from
// here.

/**
 Reads the fields of one envelope a case spells out.

 @param envelope - envelope the code under test derived

 @returns Its offsets, base text and issue ids, without its hashed fields

 @example
 ```ts
 expect(envelopes.map(envelopeSpanOf,),).toEqual([{ startOffset: 4, endOffset: 12, baseText: 'cat naps', issueIds: ['adjudicated/nap',], },],);
 ```
 */
export function envelopeSpanOf(
  envelope: EditableEnvelope,
): Pick<EditableEnvelope, 'baseText' | 'endOffset' | 'issueIds' | 'startOffset'> {
  return {
    startOffset: envelope.startOffset,
    endOffset: envelope.endOffset,
    baseText: envelope.baseText,
    issueIds: envelope.issueIds,
  };
}

//endregion Envelope span
