import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import type { DocumentLanesResult, } from '../document-lanes.ts';
import { contestDocumentLanes, } from '../lane-contest-driver.ts';
import { damageClaimLinesBySlice, } from '../repair-damage-evidence.ts';
import type { ArtifactContestSlice, } from './artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './artifact-two-lane-derive.ts';
import { openLaneContestCache, } from './lane-contest-cache-store.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';
import { readJudgeSeats, } from './run-seats.ts';

//region Corpus pass lane contest

/**
 * Runs the lane contest for one entry: what the late judges said at every
 * slice the two lanes worded differently.
 *
 * THE SEAM BESIDE `runPassConsolidation`, for the same reason: the judges, the
 * cache, the evidence and the window are assembled here so the entry driver
 * makes one call.
 *
 * READS ITS OWN BENCH off Synthetic's meter as it stands when the contest
 * starts, not the lanes' reading: XIEPT2 on 2026-09-03 read wet at the lanes,
 * ran Synthetic dry seven minutes later, and sat the Hyper-slow judge through
 * the contest and the consolidation on Hyper (`run-seats.ts`).
 *
 * @param client - shared provider client
 *
 * @param lanes - both lanes as they returned, read for the repair lane's
 * probe reports
 *
 * @param projected - both lane ledgers and the comparison the contest reads
 *
 * @param frontMatterSlices - syntax-bearing metadata positions
 *
 * @param identityContext - declared names both documents carry, when any
 *
 * @param entryCacheDir - per-entry cache root
 *
 * @param pipelineDigest - generation stamp for the cache
 *
 * @param signal - entry cancellation
 *
 * @param overlap - most slices in flight
 *
 * @param l - entry logger
 *
 * @returns Contest records in comparison order
 *
 * @example
 * ```ts
 * const contests = await runPassContest({ client, lanes, projected, frontMatterSlices, entryCacheDir, pipelineDigest, signal, overlap, l, },);
 * ```
 */
export async function runPassContest(
  {
    client,
    lanes,
    projected,
    frontMatterSlices,
    identityContext,
    entryCacheDir,
    pipelineDigest,
    signal,
    overlap,
    l,
  }: {
    readonly client: SyntheticClient;
    readonly lanes: DocumentLanesResult;
    readonly projected: ProjectedLanes;
    readonly frontMatterSlices: ReadonlySet<number>;
    readonly identityContext?: string;
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly signal: AbortSignal;
    readonly overlap: number;
    readonly l: Logger;
  },
): Promise<readonly ArtifactContestSlice[]> {
  /**
   * This phase's judge benches, read now.
   */
  const seats = await readJudgeSeats({
    client,
    phase: 'lane contest',
    signal,
    l,
  },);
  return await contestDocumentLanes({
    client,
    projected,
    // JUDGES ONLY: the roster less GLM-5.3-Flash since 2026-09-02 (the reason
    // on `WIDE_SEAT_DROPPED` in `run-config.ts`), less the Hyper-slow judge
    // while Synthetic is dry (`run-seats.ts`).
    modelIds: seats.lateJudges,
    frontMatterSlices,
    // The probe's corroborated claims, shown to the judges and acted on by
    // nobody (`repair-damage-evidence.ts`).
    damageClaimsBySlice: damageClaimLinesBySlice({ lane: lanes.repair, },),
    ...((identityContext === undefined) ? {} : { identityContext, }),
    cache: await openLaneContestCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
    signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    overlap,
    l,
  },);
}

//endregion Corpus pass lane contest
