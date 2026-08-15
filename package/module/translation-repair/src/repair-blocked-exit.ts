import type { ChunkPair, } from './chunk-document.ts';
import { deriveShippedIndices, } from './assembly-invariant.ts';
import { buildLaneSliceTexts, } from './lane-slice-text.ts';
import { buildChunkCriticRecords, } from './critic-attribution.ts';
import { buildIssueRecords, } from './repair-record.ts';
import type { ChunkRepairOutcome, } from './repair-contract.ts';
import type { RepairTranslationResult, } from './repair-result.ts';

//region Repair blocked exit
// What the repair lane returns when the critics find the document is not a
// translation at all, and enough of it is that repairing the rest would be
// repairing the wrong thing.
//
// Its own file because it is the ONE exit that never reaches assembly, and so
// the one that has to state by hand every fact assembly would otherwise have
// derived. Inline, that hand-built result sat in the middle of the slice loop
// and read like an aside.

/**
 * Builds the result of a run blocked for non-translation dominance.
 *
 * @param targetText - archive translation, returned untouched
 *
 * @param slices - every prepared slice, which supplies the denominator
 *
 * @param outcomes - slices settled before the crossing; the rest were never
 * examined, because this exit fires from INSIDE the slice loop
 *
 * @param findings - alignment and cache findings gathered before the block,
 * which this result carries ahead of every slice's own
 *
 * @param standingChars - archive characters under standing non-translation
 * votes
 *
 * @param totalChars - archive characters in total, which the ratio is out of
 *
 * @returns Result naming the block, with every decision the run did reach
 *
 * @example
 * ```ts
 * return blockedRepairResult({ targetText, slices, outcomes, findings, standingChars, totalChars, },);
 * ```
 */
export function blockedRepairResult(
  {
    targetText,
    slices,
    outcomes,
    findings,
    standingChars,
    totalChars,
  }: {
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly outcomes: readonly ChunkRepairOutcome[];
    readonly findings: readonly string[];
    readonly standingChars: number;
    readonly totalChars: number;
  },
): RepairTranslationResult {
  // VACUOUS TODAY, and here for what it costs rather than for what it catches.
  // This exit returns its input and ships nothing, so the check passes by
  // inspection; what it pins is that any later edit letting a blocked run carry
  // some repair has to say which slices, in the same terms assembly uses. An
  // exit that states every fact by hand is exactly where those two drift apart.
  deriveShippedIndices({
    incumbentText: targetText,
    assembledText: targetText,
    slices,
    survivingReplacements: [],
  },);

  return {
    repairedText: targetText,
    status: 'blocked-non-translation',
    sliceCount: slices.length,
    issues: buildIssueRecords({
      outcomes,
      blocked: true,
    },),
    chunkCritics: buildChunkCriticRecords({ outcomes, },),
    // Nothing shipped and nothing was taken back at assembly: this exit never
    // reaches assembly. A blocked run returns its input, so no slice carries a
    // repair, and the withdrawal that says so belongs to the issue records
    // rather than to a guard that did not run.
    //
    // The per-slice wordings are what keep that readable rather than trapping a
    // consumer. Every slice still reports what it DECIDED, and the empty
    // shipped set says none of it reached the document; read together they
    // state "this lane had repairs and the document carries none of them",
    // which two empty index sets alone cannot.
    shippedChunkIndices: [],
    withdrawnChunkIndices: [],
    sliceTexts: buildLaneSliceTexts({
      slices,
      // This exit fires at the earliest dominance crossing, so the slices after
      // it were never examined. Recording the archive wording as their decision
      // would state a choice nobody made.
      undecided: 'not-evaluated',
      decided: outcomes.map(function toDecision(settled,): {
        readonly chunkIndex: number;
        readonly text: string;
      } {
        return {
          chunkIndex: settled.chunkIndex,
          text: settled.repairedText,
        };
      },),
    },),
    findings: [
      ...findings,
      ...outcomes.flatMap(function toFindings(done,): readonly string[] {
        return done.findings;
      },),
      `non-translation dominance (${String(standingChars,)} of ${
        String(totalChars,)
      } target chars)`,
    ],
  };
}

//endregion Repair blocked exit
