import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { ArchiveDispute, } from '../archive-dispute.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import type { PairedReading, } from '../image-reading-pair.ts';
import type { StageSettings, } from '../stage-settings.ts';
import type { ArtifactConsolidateSlice, } from './artifact-two-lane-consolidate.ts';
import type { ArtifactConsistency, } from './artifact-two-lane-consistency.ts';
import type { ArtifactContestSlice, } from './artifact-two-lane-contest.ts';
import type { ProjectedLanes, } from './artifact-two-lane-derive.ts';
import { runPassConsolidation, } from './pass-consolidate.ts';
import { runPassConsistency, } from './pass-consistency.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import type { RunClient, } from './run-client-contract.ts';

//region Pass settlement
// THE TWO STAGES THAT SETTLE WHAT THE PAGE SAYS, in the order they run: the
// third rendering and final naturalness decisions slice by slice
// (`pass-consolidate.ts`), then the page-level consistency of the settled
// slices (`pass-consistency.ts`). One call, so the entry pipeline reads them
// as one step and hands the page composition both results by name.

/**
 What the settling stages decided.

 @example
 ```ts
 const settlement: PassSettlement = { consolidateSlices, consistency, };
 ```
 */
export type PassSettlement = {
  /**
   What the third rendering settled per slice.
   */
  readonly consolidateSlices: readonly ArtifactConsolidateSlice[];

  /**
   What the page-level consistency pass did to the settled slices.
   */
  readonly consistency: ArtifactConsistency;
};

/**
 Runs the consolidation and then the consistency pass for one entry.

 @param client - shared provider client

 @param prepared - shared source-target preparation

 @param projected - both lane ledgers and comparison

 @param contests - lane contest records

 @param archiveDisputes - slices whose archive rendering the repair lane disputed

 @param frontMatterSlices - syntax-bearing metadata positions

 @param pictureReadings - paired OCR evidence

 @param entryCacheDir - per-entry cache root

 @param pipelineDigest - generation stamp for cache

 @param signal - entry cancellation

 @param overlap - most slices in flight

 @param l - entry logger

 @param stageSettings - straggler windows and contest ledger the entry file
 read for this launch

 @returns The consolidation records and the consistency record

 @example
 ```ts
 const { consolidateSlices, consistency, } = await runPassSettlement({ client, prepared, projected, contests, archiveDisputes, frontMatterSlices, pictureReadings, entryCacheDir, pipelineDigest, signal, overlap, l, stageSettings, },);
 ```
 */
export async function runPassSettlement(
  {
    client,
    prepared,
    projected,
    contests,
    archiveDisputes,
    frontMatterSlices,
    pictureReadings,
    entryCacheDir,
    pipelineDigest,
    signal,
    overlap,
    l,
    stageSettings,
  }: {
    readonly client: RunClient;
    readonly prepared: PreparedDocumentPair;
    readonly projected: ProjectedLanes;
    readonly contests: readonly ArtifactContestSlice[];
    readonly archiveDisputes: ReadonlyMap<number, ArchiveDispute>;
    readonly frontMatterSlices: ReadonlySet<number>;
    readonly pictureReadings: ReadonlyMap<string, PairedReading>;
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly signal: AbortSignal;
    readonly overlap: number;
    readonly l: Logger;
    readonly stageSettings: StageSettings;
  },
): Promise<PassSettlement> {
  /**
   What the third rendering settled per slice.
   */
  const consolidateSlices = await runPassConsolidation({
    client,
    prepared,
    projected,
    contests,
    archiveDisputes,
    frontMatterSlices,
    pictureReadings,
    entryCacheDir,
    pipelineDigest,
    signal,
    overlap,
    l,
    stageSettings,
  },);
  return {
    consolidateSlices,
    consistency: await runPassConsistency({
      client,
      prepared,
      projected,
      contestSlices: contests,
      consolidateSlices,
      archiveDisputes,
      entryCacheDir,
      pipelineDigest,
      signal,
      overlap,
      l,
      stageSettings,
    },),
  };
}

//endregion Pass settlement
