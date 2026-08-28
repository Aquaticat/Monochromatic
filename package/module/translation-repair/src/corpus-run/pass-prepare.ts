import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import {
  type PairedPreparation,
  prepareDocumentPairWithRoster,
} from '../prepare-with-pairing.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import {
  openPairingCache,
  openSectionPairingCache,
} from './slice-cache-store.ts';
import { assertArchiveReviewed, } from './unreviewed-archive.ts';

//region Pass preparation
// Corpus-specific shell owns pairing cache namespaces and refuses inherited
// blocks outside source claims before any later quality-stage purchase.

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
 * @throws {@link UnreviewedArchiveError} when pairing leaves archive blocks outside source claims
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
  /**
   * Preparation built from cache-backed roster pairing.
   */
  const paired = await prepareDocumentPairWithRoster({
    client,
    modelIds,
    // BOUGHT ONCE PER DOCUMENT PAIR. Without this a resumed entry that buys
    // nothing else still spends a pairing round per section.
    pairingCache: await openPairingCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
    // THE SECTION ROUND IS BOUGHT FIRST and cached apart, because it decides
    // what aligned section block rounds are asked about.
    sectionCache: await openSectionPairingCache({
      dir: entryCacheDir,
      generation: pipelineDigest,
    },),
    sourceText,
    targetText,
    signal,
    exchangeTimeoutMs,
    l,
  },);
  /**
   * Preparation carrying structured unclaimed-block evidence.
   */
  const { prepared, } = paired;
  assertArchiveReviewed({
    entryId,
    blocks: prepared.unclaimedTargetBlocks,
  },);
  return paired;
}

//endregion Pass preparation
