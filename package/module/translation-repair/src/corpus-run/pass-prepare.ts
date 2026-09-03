import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import {
  type PairedPreparation,
  prepareDocumentPairWithRoster,
} from '../prepare-with-pairing.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { lookupCacheDir, } from '../lookup-cache.ts';
import { workTitleLookupLines, } from '../work-title-lookup.ts';
import { EXA_API_KEY_VAR, } from '../work-title-search.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import {
  openPairingCache,
  openSectionPairingCache,
} from './slice-cache-store.ts';
import { repairArchiveBlocks, } from './archive-block-repair.ts';
import { archiveBlockSourceContexts, } from './archive-block-source-context.ts';
import { passArchiveText, } from './pass-archive.ts';

//region Pass preparation
// Corpus-specific shell owns pairing cache namespaces and reviews inherited
// blocks outside source claims before any later quality-stage purchase.
//
// LINEAR TWO-STEP BY DESIGN: one preparation, at most one archive correction
// round, one re-preparation over the corrected archive. The second
// preparation is the structural consequence of having edited the archive,
// not a rejection-driven re-ask; blocks still unclaimed after it become
// findings (doc/planning/translation-repair-no-loop-design.md).

/**
 * The clock a lookup record is stamped with.
 *
 * @returns Now
 *
 * @example
 * ```ts
 * const stamped = wallClock().toISOString();
 * ```
 */
function wallClock(): Date {
  return new Date();
}

/**
 * Prepares one pass entry with cached roster pairing and publication safety.
 *
 * @param client - shared provider client
 *
 * @param entryId - corpus entry being settled
 *
 * @param entryCacheDir - entry cache root
 *
 * @param pipelineDigest - cache generation
 *
 * @param modelIds - pairing roster
 *
 * @param sourceText - source page
 *
 * @param targetText - archive page
 *
 * @param signal - entry deadline
 *
 * @param exchangeTimeoutMs - per-call ceiling
 *
 * @param l - entry logger
 *
 * @returns Prepared slices and pairing findings
 *
 * @example
 * ```ts
 * const paired = await preparePassEntry({ client, entryId, entryCacheDir, pipelineDigest, modelIds, sourceText, targetText, signal, exchangeTimeoutMs, l, });
 * ```
 */
export async function preparePassEntry(
  {
    client,
    entryId,
    entryCacheDir,
    pipelineDigest,
    modelIds,
    sourceText,
    targetText,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly entryId: string;
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly modelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<PairedPreparation> {
  l.debug(`${preparePassEntry.name}: preparing entry ${entryId}`,);
  /**
   * Archive bytes both deciders judge, normalized before preparation so
   * spans, candidates, artifact and published page all describe the same
   * visible text (`pass-archive.ts`).
   */
  const archiveText = passArchiveText({
    text: targetText,
    l,
  },);
  /**
   * Cache for block-pairing rounds across revised archive preparations.
   */
  const pairingCache = await openPairingCache({
    dir: entryCacheDir,
    generation: pipelineDigest,
  },);
  /**
   * Cache for section-pairing rounds across revised archive preparations.
   */
  const sectionCache = await openSectionPairingCache({
    dir: entryCacheDir,
    generation: pipelineDigest,
  },);
  /**
   * Web-lookup evidence for the works the original names, bought once per
   * title and cached durably (the owner's rule of 2026-09-02), the same lines
   * for both preparations so a corrected archive does not change what the
   * sheets are told about a title.
   */
  const contextLines = await workTitleLookupLines({
    sourceText,
    apiKey: process.env[EXA_API_KEY_VAR] ?? '',
    dir: lookupCacheDir({ env: process.env, },),
    signal,
    fetchFn: fetch,
    now: wallClock,
    logger: l,
  },);
  /**
   * Preparation over the archive as inherited.
   */
  const firstPaired = await prepareDocumentPairWithRoster({
    client,
    modelIds,
    pairingCache,
    sectionCache,
    sourceText,
    targetText: archiveText,
    signal,
    exchangeTimeoutMs,
    l,
    contextLines,
  },);
  /**
   * Unclaimed blocks not already licensed unchanged.
   */
  const pending = firstPaired.prepared
    .unclaimedTargetBlocks;
  if (pending.length === 0)
    return firstPaired;
  /**
   * Selected corrections and retained licenses from the single review round.
   */
  const repaired = await repairArchiveBlocks({
    client,
    modelIds,
    targetText: archiveText,
    sourceContexts: archiveBlockSourceContexts({ prepared: firstPaired.prepared, }),
    blocks: pending,
    signal,
    exchangeTimeoutMs,
    l,
  },);
  if (repaired.targetText === archiveText) {
    return {
      prepared: firstPaired.prepared,
      findings: [
        ...firstPaired.findings,
        ...repaired.findings,
      ],
    };
  }
  /**
   * Re-preparation over the corrected archive, whose offsets the correction moved.
   */
  const secondPaired = await prepareDocumentPairWithRoster({
    client,
    modelIds,
    pairingCache,
    sectionCache,
    sourceText,
    targetText: repaired.targetText,
    signal,
    exchangeTimeoutMs,
    l,
    contextLines,
  },);
  /**
   * Blocks the single correction round could not claim.
   */
  const remaining = secondPaired.prepared
    .unclaimedTargetBlocks;
  return {
    prepared: secondPaired.prepared,
    findings: [
      ...secondPaired.findings,
      ...repaired.findings,
      ...(remaining.length === 0
        ? []
        : [`unclaimed archive blocks remain after the single correction round: ${String(remaining.length,)}`,]),
    ],
  };
}

//endregion Pass preparation
