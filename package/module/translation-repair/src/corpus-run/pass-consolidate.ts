import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { consolidateDocument, } from '../consolidate-driver.ts';
import { consolidationPolishConfiguration, } from '../consolidation-polish-config.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { sliceNeighbourContexts, } from '../fidelity-window.ts';
import type { PairedReading, } from '../image-reading-pair.ts';
import { slicePictureContexts, } from '../slice-pictures.ts';
import type { ArtifactConsolidateSlice, } from './artifact-two-lane-consolidate.ts';
import type { ArtifactContestSlice, } from './artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './artifact-two-lane-derive.ts';
import { openConsolidateCache, } from './consolidate-cache-store.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import {
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import type { JudgeSeats, } from './run-seats.ts';

//region Corpus pass consolidation

/**
 * Runs production consolidation and final naturalness polish for one entry.
 *
 * MODEL ROLES, WINDOWS, CACHE AND DOCUMENT FACTS ARE ASSEMBLED HERE so pass
 * orchestration makes one call rather than duplicating stage interface details.
 * This is same seam at which all four positional maps are simultaneously known.
 *
 * @param client - shared provider client
 *
 * @param prepared - shared source-target preparation
 *
 * @param projected - both lane ledgers and comparison
 *
 * @param contests - lane contest records
 *
 * @param frontMatterSlices - syntax-bearing metadata positions
 *
 * @param pictureReadings - paired OCR evidence
 *
 * @param entryCacheDir - per-entry cache root
 *
 * @param pipelineDigest - generation stamp for cache
 *
 * @param signal - entry cancellation
 *
 * @param overlap - most slices in flight
 *
 * @param seats - this entry's judge benches, read once off Synthetic's meter
 * (`run-seats.ts`)
 *
 * @param l - entry logger
 *
 * @returns Consolidation records in comparison order
 *
 * @example
 * ```ts
 * const slices = await runPassConsolidation({ client, prepared, projected, contests, frontMatterSlices, pictureReadings, entryCacheDir, pipelineDigest, signal, overlap, seats, l, });
 * ```
 */
export async function runPassConsolidation(
  {
    client,
    prepared,
    projected,
    contests,
    frontMatterSlices,
    pictureReadings,
    entryCacheDir,
    pipelineDigest,
    signal,
    overlap,
    seats,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly prepared: PreparedDocumentPair;
    readonly projected: ProjectedLanes;
    readonly contests: readonly ArtifactContestSlice[];
    readonly frontMatterSlices: ReadonlySet<number>;
    readonly pictureReadings: ReadonlyMap<string, PairedReading>;
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly signal: AbortSignal;
    readonly overlap: number;
    readonly seats: JudgeSeats;
    readonly l: Logger;
  },
): Promise<readonly ArtifactConsolidateSlice[]> {
  /**
   * Production naturalness roles and document guard facts.
   */
  const polish = consolidationPolishConfiguration({
    prepared,
    models: seats.repairModels,
    gateModelIds: seats.lateJudges,
  },);
  return await consolidateDocument({
    client,
    projected,
    contests,
    // THE WHOLE ROSTER WRITES, the late judges judge and gate: GLM-5.3-Flash
    // keeps its writing seats and left every judge seat on 2026-09-02, the
    // reason on `WIDE_SEAT_DROPPED` in `run-config.ts`; the Hyper-slow judge
    // sits only while Synthetic serves it (`run-seats.ts`).
    modelIds: RUN_ROSTER,
    judgeModelIds: seats.lateJudges,
    ...((polish.kind === 'configured') ? { polishConfig: polish.config, } : {}),
    frontMatterSlices,
    lineStructuredSlices: prepared.lineStructuredSliceIndices,
    pictureContextBySlice: slicePictureContexts({
      slices: prepared.slices,
      readings: pictureReadings,
    },),
    neighbourContextBySlice: sliceNeighbourContexts({
      slices: prepared.slices,
    },),
    ...((prepared.identityContext === undefined)
      ? {}
      : { identityContext: prepared.identityContext, }),
    cache: await openConsolidateCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    overlap,
    l,
  },);
}

//endregion Corpus pass consolidation
