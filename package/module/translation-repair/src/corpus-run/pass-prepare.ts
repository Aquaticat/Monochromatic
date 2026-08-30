import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import {
  type PairedPreparation,
  prepareDocumentPairWithRoster,
} from '../prepare-with-pairing.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { TranslationRepairInterruptedError, } from '../translation-repair-interrupted-error.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import {
  openPairingCache,
  openSectionPairingCache,
} from './slice-cache-store.ts';
import { repairArchiveBlocks, } from './archive-block-repair.ts';
import { archiveBlockSourceContexts, } from './archive-block-source-context.ts';

//region Pass preparation
// Corpus-specific shell owns pairing cache namespaces and reviews inherited
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
   * Archive carrying every selected preparation-stage correction.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Stage-local revision advances archive until every unclaimed block is licensed.
  let currentTargetText = targetText;
  /**
   * Operation-only archive review audit trail.
   */
  const archiveFindings: string[] = [];
  /**
   * Exact archive states already prepared in this invocation.
   */
  const attemptedPreparations = new Set<string>();
  while (!signal.aborted) {
    if (attemptedPreparations.has(currentTargetText,)) {
      throw new TranslationRepairInterruptedError({
        reason: 'archive-block-unresolved',
        findings: archiveFindings,
      },);
    }
    attemptedPreparations.add(currentTargetText,);
    /**
     * Preparation over latest corrected archive.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each preparation depends on prior archive correction offsets.
    const paired = await prepareDocumentPairWithRoster({
      client,
      modelIds,
      pairingCache,
      sectionCache,
      sourceText,
      targetText: currentTargetText,
      signal,
      exchangeTimeoutMs,
      l,
    },);
    /**
     * Unclaimed blocks not already licensed unchanged.
     */
    const pending = paired.prepared
      .unclaimedTargetBlocks;
    if (pending.length === 0) {
      return {
        prepared: paired.prepared,
        findings: [
          ...paired.findings,
          ...archiveFindings,
        ],
      };
    }
    /**
     * Selected corrections and retained licenses from this preparation.
     */
    // oxlint-disable-next-line no-await-in-loop -- Repair consumes current preparation offsets before next parse.
    const repaired = await repairArchiveBlocks({
      client,
      modelIds,
      targetText: currentTargetText,
      sourceContexts: archiveBlockSourceContexts({ prepared: paired.prepared, }),
      blocks: pending,
      signal,
      exchangeTimeoutMs,
      l,
    },);
    archiveFindings.push(...repaired.findings,);
    if (repaired.targetText === currentTargetText) {
      return {
        prepared: paired.prepared,
        findings: [
          ...paired.findings,
          ...archiveFindings,
        ],
      };
    }
    currentTargetText = repaired.targetText;
  }
  signal.throwIfAborted();
  throw new Error(`entry ${entryId} preparation stopped without abort reason`,);
}

//endregion Pass preparation
