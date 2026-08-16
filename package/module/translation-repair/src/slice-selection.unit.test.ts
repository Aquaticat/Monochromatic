/**
 * Tests for the per-slice selection ledger.
 *
 * WHAT THESE PIN is the distinction the ledger exists for: "the judges kept the
 * archive" and "the archive was reinstated after the judges replaced it" are
 * different facts, and every count the lane reported before this collapsed them.
 * `#83` asked for the first; the assembly guard is what makes the second
 * possible. A reader holding one number cannot tell them apart, and the
 * replacement rate every quality claim rests on is computed from exactly this.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildSliceSelections,
  type SyntheticModelId,
  type TranslateSliceRecord,
} from '../dist/final/node/index.mjs';

/**
 * Model standing in for a translator.
 */
const CAT_A = 'hf:cat/Cat-A' as unknown as SyntheticModelId;

/**
 * Builds one settled record with the parts this ledger reads.
 *
 * Everything the ledger ignores is filled with whatever satisfies the type:
 * what is under test is which fields travel, not what the stage decided.
 *
 * @param chunkIndex - slice position
 *
 * @param origin - whether the winner was the archive's text or fresh
 *
 * @param decision - how the round ended
 *
 * @param voteWeight - weight the winner drew
 *
 * @returns Record shaped like one the driver settles
 *
 * @example
 * ```ts
 * const record = recordFor({ chunkIndex: 0, origin: 'fresh', decision: 'judged', voteWeight: 2, },);
 * ```
 */
function recordFor(
  {
    chunkIndex,
    origin,
    decision,
    voteWeight,
  }: {
    readonly chunkIndex: number;
    readonly origin: string;
    readonly decision: string;
    readonly voteWeight: number;
  },
): TranslateSliceRecord {
  return {
    kind: 'translate-slice',
    schemaVersion: 1,
    chunkIndex,
    outputText: 'The cat sleeps on the windowsill.\n',
    changed: origin === 'fresh',
    disposition: 'stage-result',
    findings: [],
    stageResult: {
      text: 'The cat sleeps on the windowsill.\n',
      origin,
      producer: {
        kind: 'model',
        modelId: CAT_A,
      },
      decision,
      voteWeight,
      tally: {
        judgesAvailable: 3,
        ballots: 3,
        abstentions: 0,
        selfVotes: 0,
      },
      ballots: [],
      heardTranslators: 2,
      candidateCount: 2,
      slate: [],
      selectedIndex: 1,
      shippedIndex: 1,
      perCandidate: [],
      findings: [],
    },
  } as unknown as TranslateSliceRecord;
}

await describe({
  name: buildSliceSelections.name,
  children: [
    it({
      name: 'SEPARATES an archive kept by the judges from one reinstated after they replaced it, '
        + 'which is the distinction every count before this collapsed. Both ship the archive text; '
        + 'only `origin` says whether that was chosen or restored',
      fn: async () => {
        /**
         * Slice 0: judges kept the archive. Slice 1: judges chose fresh text and
         * the assembly guard withdrew it.
         */
        const selections = buildSliceSelections({
          records: [
            recordFor({
              chunkIndex: 0,
              origin: 'incumbent',
              decision: 'judged',
              voteWeight: 2,
            },),
            recordFor({
              chunkIndex: 1,
              origin: 'fresh',
              decision: 'judged',
              voteWeight: 3,
            },),
          ],
          // Neither slice shipped: slice 0 had nothing to ship, slice 1 was
          // taken back.
          shippedChunkIndices: [],
        },);
        expect(selections.length,).toBe(2,);
        expect(selections[0]?.origin,).toBe('incumbent',);
        expect(selections[0]?.shipped,).toBe(false,);
        expect(selections[1]?.origin,).toBe('fresh',);
        expect(selections[1]?.shipped,).toBe(false,);
        // The pair reads differently despite both carrying the archive's text,
        // which is the whole claim.
        expect(selections[0]?.origin === selections[1]?.origin,).toBe(false,);
      },
    },),
    it({
      name: 'marks a slice SHIPPED when the document carries it, taken from the assembled bytes '
        + 'rather than re-derived from the record: a record says what the slice chose and the '
        + 'document says what it carries, and those disagree exactly where the guard intervened',
      fn: async () => {
        const selections = buildSliceSelections({
          records: [
            recordFor({
              chunkIndex: 4,
              origin: 'fresh',
              decision: 'judged',
              voteWeight: 3,
            },),
            recordFor({
              chunkIndex: 7,
              origin: 'fresh',
              decision: 'judged',
              voteWeight: 3,
            },),
          ],
          shippedChunkIndices: [7,],
        },);
        expect(selections[0]?.shipped,).toBe(false,);
        expect(selections[1]?.shipped,).toBe(true,);
      },
    },),
    it({
      name: 'carries the PRODUCER through, since who wrote the winning text is what a self-'
        + 'preference or per-model rate is computed over and no count preserves it',
      fn: async () => {
        const selections = buildSliceSelections({
          records: [recordFor({
            chunkIndex: 0,
            origin: 'fresh',
            decision: 'judged',
            voteWeight: 2,
          },),],
          shippedChunkIndices: [0,],
        },);
        expect(selections[0]?.producer
          .kind,).toBe('model',);
      },
    },),
    it({
      name: 'keeps the DECLINE vocabulary rather than flattening it to a boolean, so a slice the '
        + 'judges could not agree on stays distinguishable from one they agreed to keep',
      fn: async () => {
        const selections = buildSliceSelections({
          records: [
            recordFor({
              chunkIndex: 0,
              origin: 'incumbent',
              decision: 'declined-indecision',
              voteWeight: 0,
            },),
            recordFor({
              chunkIndex: 1,
              origin: 'incumbent',
              decision: 'judged',
              voteWeight: 2,
            },),
          ],
          shippedChunkIndices: [],
        },);
        expect(selections[0]?.decision,).toBe('declined-indecision',);
        expect(selections[1]?.decision,).toBe('judged',);
      },
    },),
    it({
      name: 'reports one entry per record in the order they arrived, so a reader joining this to '
        + 'the other lane slice by slice does not have to sort first',
      fn: async () => {
        const selections = buildSliceSelections({
          records: [3,
            9,
            11,].map(function toRecord(chunkIndex,) {
            return recordFor({
              chunkIndex,
              origin: 'fresh',
              decision: 'judged',
              voteWeight: 2,
            },);
          },),
          shippedChunkIndices: [9,],
        },);
        expect(selections.map(function toIndex(selection,) {
          return selection.chunkIndex;
        },),).toEqual([3,
          9,
          11,],);
      },
    },),
  ],
},);
