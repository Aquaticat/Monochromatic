import type { DocumentLanesResult, } from '../document-lanes.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { buildSettledTwoLaneArtifact, } from './artifact-two-lane-build.ts';
import type { ArtifactConsolidation, } from './artifact-two-lane-consolidate.ts';
import type { ArtifactLaneSelection, } from './artifact-two-lane-contest.ts';
import type { ArtifactPageAssembly, } from './artifact-two-lane-page-assembly.ts';
import type { SettledArtifact, } from './artifact-two-lane-contract.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import {
  RUN_CALL_CONFIG,
  RUN_CORPUS_PIN,
} from './run-config.ts';

//region Pass entry artifact
// The artifact one settled entry writes, assembled from what the pass ran,
// split out of `pass-entry.ts` at its line budget.

/**
 * Builds the rich artifact for later grading; corpus-derived, hence gitignored.
 *
 * Everything derivable is derived inside the builder, so what goes in is the
 * preparation and the driver's own result rather than counts taken off them
 * here. It refuses a run whose ledgers do not describe that preparation, which
 * is why no artifact can name a slicing the lanes never ran over.
 *
 * A CONTEST THAT RAN, whatever it found: a document whose two lanes never
 * differed records an empty contest rather than the pending kind, since "the
 * roster was asked and nothing differed" and "nobody has asked" are different
 * facts, and the pending kind now means only the second. A CONSOLIDATION THAT
 * RAN is recorded the same way, for the same reason.
 *
 * @param entryId - corpus entry this covers
 *
 * @param tip - repository head recorded into the artifact
 *
 * @param pipelineDigest - identity of the built pipeline
 *
 * @param durationMs - wall time the entry took, both lanes and the contest
 * included
 *
 * @param prepared - slicing both lanes ran over
 *
 * @param lanes - what both lanes returned
 *
 * @param contestSlices - what the lane contest decided
 *
 * @param consolidateSlices - what the consolidation settled
 *
 * @returns Artifact ready to serialize
 *
 * @example
 * ```ts
 * const artifact = settledEntryArtifact({ entryId, tip, pipelineDigest, durationMs, prepared, lanes, contestSlices, consolidateSlices, },);
 * ```
 */
export function settledEntryArtifact(
  {
    entryId,
    tip,
    pipelineDigest,
    durationMs,
    prepared,
    lanes,
    contestSlices,
    consolidateSlices,
    pageAssembly,
  }: {
    readonly entryId: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly durationMs: number;
    readonly prepared: PreparedDocumentPair;
    readonly lanes: DocumentLanesResult;
    readonly contestSlices: Extract<ArtifactLaneSelection, { readonly kind: 'contested'; }>['slices'];
    readonly consolidateSlices: Extract<ArtifactConsolidation, { readonly kind: 'settled'; }>['slices'];
    readonly pageAssembly: ArtifactPageAssembly;
  },
): SettledArtifact {
  return buildSettledTwoLaneArtifact({
    entryId,
    tip,
    pipelineDigest,
    corpusSha: RUN_CORPUS_PIN.commitSha,
    callConfig: RUN_CALL_CONFIG,
    durationMs,
    prepared,
    lanes,
    laneSelection: {
      kind: 'contested',
      slices: contestSlices,
    },
    consolidation: {
      kind: 'settled',
      slices: consolidateSlices,
    },
    pageAssembly,
  },);
}

//endregion Pass entry artifact
