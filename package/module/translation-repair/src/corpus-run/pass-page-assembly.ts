import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { DocumentLanesResult, } from '../document-lanes.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { ArtifactConsolidation, } from './artifact-two-lane-consolidate.ts';
import type { ArtifactLaneSelection, } from './artifact-two-lane-contest.ts';
import type { SettledArtifact, } from './artifact-two-lane-contract.ts';
import { NO_PAGE_ASSEMBLY, } from './artifact-two-lane-page-assembly.ts';
import { guardPageAssembly, } from './page-assembly-guard.ts';
import { settledEntryArtifact, } from './pass-entry-artifact.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';

//region Pass page assembly
// The artifact is composed twice: once with no page assembly, so the page it
// would ship can be read, and once with what the guard made of that page. Both
// compositions are pure, and the second is the one written.

/**
 * Composes the settled artifact with the page-level guard's outcome recorded.
 *
 * @param entryId - corpus entry
 *
 * @param tip - pipeline tip
 *
 * @param pipelineDigest - digest of the pipeline that ran
 *
 * @param durationMs - wall time the entry took
 *
 * @param prepared - preparation both lanes ran over
 *
 * @param lanes - both lane results and their ledgers
 *
 * @param contestSlices - what the contest decided per slice
 *
 * @param consolidateSlices - what the third rendering settled per slice
 *
 * @param targetText - archive text the page's replacements address
 *
 * @param l - logger the guard's findings reach
 *
 * @returns The artifact to write
 *
 * @example
 * ```ts
 * const artifact = settledPageArtifact({ entryId, tip, pipelineDigest, durationMs, prepared, lanes, contestSlices, consolidateSlices, targetText, l, },);
 * ```
 */
export function settledPageArtifact(
  {
    entryId,
    tip,
    pipelineDigest,
    durationMs,
    prepared,
    lanes,
    contestSlices,
    consolidateSlices,
    targetText,
    l,
  }: {
    readonly entryId: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly durationMs: number;
    readonly prepared: PreparedDocumentPair;
    readonly lanes: DocumentLanesResult;
    readonly contestSlices: Extract<ArtifactLaneSelection, { readonly kind: 'contested'; }>['slices'];
    readonly consolidateSlices: Extract<ArtifactConsolidation, { readonly kind: 'settled'; }>['slices'];
    readonly targetText: string;
    readonly l: Logger;
  },
): SettledArtifact {
  /**
   * The artifact as the stages composed it, before the guard.
   */
  const composed = settledEntryArtifact({
    entryId,
    tip,
    pipelineDigest,
    durationMs,
    prepared,
    lanes,
    contestSlices,
    consolidateSlices,
    pageAssembly: NO_PAGE_ASSEMBLY,
  },);
  /**
   * What the guard made of the page that artifact would ship.
   */
  const pageAssembly = guardPageAssembly({
    artifact: composed,
    slices: prepared.slices,
    targetText,
  },);
  for (const finding of pageAssembly.findings)
    l.warn(`page assembly: ${finding}`,);
  /**
   * Slices the guard trimmed.
   */
  const trimmedCount = pageAssembly.trimmed
    .length;
  /**
   * Slices the guard took back.
   */
  const withdrawnCount = pageAssembly.withdrawn
    .length;
  if ((trimmedCount > 0) || (withdrawnCount > 0)) {
    l.warn(
      `page assembly trimmed ${String(trimmedCount,)} slices and withdrew ${
        String(withdrawnCount,)
      }; the findings say why`,
    );
  }
  return settledEntryArtifact({
    entryId,
    tip,
    pipelineDigest,
    durationMs,
    prepared,
    lanes,
    contestSlices,
    consolidateSlices,
    pageAssembly,
  },);
}

//endregion Pass page assembly
