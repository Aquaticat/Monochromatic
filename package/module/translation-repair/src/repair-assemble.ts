import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import { guardFootnoteAssembly, } from './assembly-integrity.ts';
import type { ChunkPair, } from './chunk-document.ts';
import { buildChunkCriticRecords, } from './critic-attribution.ts';
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
   * Slices whose repair SHIPPED, which is what the document carries rather than
   * what any slice's own selection chose.
   */
  const changedOutcomes = outcomes.filter(function shipped(outcome,) {
    return outcome.changed
      && (!guarded.revertedChunkIndices
        .includes(outcome.chunkIndex,));
  },);

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
  const anyChanged = changedOutcomes.length > 0;
  // SLICES rather than chunks: both arrays hold slice outcomes, and a section
  // subdivides into several, so reporting them as chunks understates the
  // denominator against every other count in the artifact.
  l.info(
    `repair ${anyChanged ? 'shipped' : 'kept input'}: ${
      String(changedOutcomes.length,)
    }/${String(outcomes.length,)} slices changed, ${String(issues.length,)} issues`,
  );

  return {
    chunkCritics: buildChunkCriticRecords({ outcomes, },),
    repairedText: guarded.assembledText,
    status: anyChanged ? 'repaired' : 'unchanged',
    issues,
    findings: [
      ...findings,
      ...guarded.findings,
    ],
  };
}

//endregion Repair assembly
