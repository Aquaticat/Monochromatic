import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { guardFootnoteAssembly, } from './assembly-integrity.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { buildChunkCriticRecords, } from './critic-attribution.ts';
import { buildLaneSliceTexts, } from './lane-slice-text.ts';
import type { ChunkRepairOutcome, } from './repair-contract.ts';
import { buildIssueRecords, } from './repair-record.ts';
import { repairReplacements, } from './repair-replacements.ts';
import type { RepairTranslationResult, } from './repair-result.ts';

//region Repair assembly
// What a settled run RETURNS, built once so the driver's exits cannot drift
// apart in what they report.
//
// This is the layer that decides what reached the reader. A slice's own
// selection cannot answer that: the assembly guard can take a repair back to
// keep a footnote relation whole, and a repair the document does not carry is
// not a repair a measurement may count.

/**
 * Assembles settled outcomes into the document and its report.
 *
 * @param targetText - translation as it stands, which is the fallback
 *
 * @param slices - prepared slice pairs in document order
 *
 * @param outcomes - settled per-slice outcomes, refinement included
 *
 * @param findings - alignment and phase findings to carry through
 *
 * @param l - driver logger
 *
 * @returns Repaired document with its issue report and status
 *
 * @example
 * ```ts
 * const result = assembleRepair({ targetText, slices, outcomes, findings, l, },);
 * ```
 */
export function assembleRepair(
  {
    targetText,
    slices,
    outcomes,
    findings,
    l,
  }: {
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly outcomes: readonly ChunkRepairOutcome[];
    readonly findings: readonly string[];
    readonly l: Logger;
  },
): RepairTranslationResult {
  /**
   * Document rebuilt slice by slice, with any replacement withdrawn that would
   * leave the footnote graph worse than the archive's.
   *
   * A footnote is a relation BETWEEN slices, and every stage works inside one,
   * so this is the only layer that can see it. The per-envelope footnote gate
   * bounds what one edit does; it cannot see a definition in another slice.
   */
  const guarded = guardFootnoteAssembly({
    targetText,
    slices,
    replacements: repairReplacements({ outcomes, },),
  },);
  if (guarded.revertedChunkIndices
    .length
    > 0) {
    l.warn(
      `withdrew ${
        String(guarded.revertedChunkIndices
          .length,)
      } slice repairs at assembly to keep the footnote graph whole`,
    );
  }

  /**
   * How many slices the document CARRIES a repair for.
   *
   * Read off the guard's surviving replacements rather than recomputed from the
   * outcomes, because the guard is what decides this. Reconstructing it from
   * `changed` and the reverted list would agree today and would go on agreeing
   * silently for exactly as long as those two stay in step.
   */
  const shippedSliceCount = guarded.replacements
    .length;

  /**
   * Whole-document issue report.
   */
  const issues = buildIssueRecords({
    outcomes,
    blocked: false,
    withdrawnChunkIndices: guarded.revertedChunkIndices,
  },);

  /**
   * Whether any slice shipped a repair.
   */
  const anyChanged = shippedSliceCount > 0;
  // SLICES rather than chunks: both arrays hold slice outcomes, and a section
  // subdivides into several, so reporting them as chunks understates the
  // denominator against every other count in the artifact.
  l.info(
    `repair ${anyChanged ? 'shipped' : 'kept input'}: ${
      String(shippedSliceCount,)
    }/${String(outcomes.length,)} slices changed, ${String(issues.length,)} issues`,
  );

  return {
    chunkCritics: buildChunkCriticRecords({ outcomes, },),
    repairedText: guarded.assembledText,
    status: anyChanged ? 'repaired' : 'unchanged',
    // Read off the guard's surviving replacements, which is the only place that
    // knows what the document carries. Sorted, because the guard returns them
    // in the order they were given and a reader comparing two lanes wants
    // document order.
    shippedChunkIndices: guarded.replacements
      .map(function toIndex(replacement,): number {
        return replacement.chunkIndex;
      },)
      .toSorted(function ascending(
        left,
        right,
      ): number {
        return left - right;
      },),
    withdrawnChunkIndices: guarded.revertedChunkIndices,
    // Every prepared slice, decided or left alone, paired with the archive's
    // own wording. Built from the outcomes rather than from the surviving
    // replacements, because this side of the record is what the lane CHOSE and
    // the index sets above are what the document carries.
    sliceTexts: buildLaneSliceTexts({
      slices,
      // Every slice was visited to reach assembly at all, so a gap here is a
      // defect rather than an early stop.
      undecided: 'refuse',
      decided: outcomes.map(function toDecision(outcome,): {
        readonly chunkIndex: number;
        readonly text: string;
      } {
        return {
          chunkIndex: outcome.chunkIndex,
          text: outcome.repairedText,
        };
      },),
    },),
    issues,
    findings: [
      ...findings,
      ...guarded.findings,
    ],
  };
}

//endregion Repair assembly
