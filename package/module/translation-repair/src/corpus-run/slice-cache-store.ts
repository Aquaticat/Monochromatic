import { rm, } from 'node:fs/promises';
import { join, } from 'node:path';

import { isJsonRecord, } from '../json-guard.ts';
import type { BlockPair, } from '../pair-blocks-wire.ts';
import type { ChunkRepairOutcome, } from '../repair-contract.ts';
import type { SliceCache, } from '../slice-cache.ts';
import {
  TRANSLATE_SLICE_CACHE_VERSION,
  type TranslateSliceRecord,
} from '../translate-document-contract.ts';
import {
  belongsToNamespace,
  openNamespacedCache,
  readDirectoryNames,
  PAIRING_NAMESPACE,
  REPAIR_SLICE_NAMESPACE,
  TRANSLATE_SLICE_NAMESPACE,
} from './slice-cache-namespace.ts';

//region Slice cache store
// Disk-backed per-entry slice cache making a large corpus document resumable:
// every settled slice is one JSON file named by its hash, so a run aborted at
// the hard cap resumes from the last settled slice on the next attempt.
//
// TWO LANES SHARE ONE ENTRY DIRECTORY, each owning a file prefix and its own
// generation marker: see `slice-cache-namespace.ts`. This file holds what each
// lane stores and how a settled entry is dropped.

/**
 * Whether a parsed cache file is a usable repair outcome. A half-written or
 * stale file that misses these fields is treated as absent and recomputed.
 *
 * @param value - parsed JSON of a cache file
 *
 * @returns True when the value carries the outcome's own fields
 *
 * @example
 * ```ts
 * if (isChunkRepairOutcome(parsed,)) resumed.set(key, parsed,);
 * ```
 */
function isChunkRepairOutcome(value: unknown,): value is ChunkRepairOutcome {
  return isJsonRecord(value,)
    && ((typeof value.chunkIndex) === 'number')
    && ((typeof value.repairedText) === 'string')
    && ((typeof value.changed) === 'boolean')
    && ((typeof value.nonTranslationStanding) === 'boolean')
    && Array.isArray(value.issues,)
    && Array.isArray(value.resolvedIssueIds,)
    && Array.isArray(value.repairRegions,)
    && Array.isArray(value.candidateResolvedIssueIds,)
    && ((typeof value.accuracyPatchSelected) === 'boolean')
    && ((typeof value.refined) === 'boolean')
    && Array.isArray(value.claimAttributions,)
    && Array.isArray(value.heardCriticIds,)
    && Array.isArray(value.rounds,)
    && Array.isArray(value.droppedDeclaredNames,)
    && Array.isArray(value.findings,);
}

/**
 * Whether a parsed cache file is a usable translate record.
 *
 * Checks the LANE and the SCHEMA before anything else. A repair outcome carries
 * neither, so it can never be resumed as a translation however the file is
 * named, and a record written under an older schema is recomputed rather than
 * read with fields that have since changed meaning.
 *
 * @param value - parsed JSON of a cache file
 *
 * @returns True when the value is this schema's translate record
 *
 * @example
 * ```ts
 * if (isTranslateSliceRecord(parsed,)) resumed.set(key, parsed,);
 * ```
 */
function isTranslateSliceRecord(
  value: unknown,
): value is TranslateSliceRecord {
  return isJsonRecord(value,)
    && (value.kind === 'translate-slice')
    && (value.schemaVersion === TRANSLATE_SLICE_CACHE_VERSION)
    && ((typeof value.chunkIndex) === 'number')
    && ((typeof value.outputText) === 'string')
    && ((typeof value.changed) === 'boolean')
    && ((value.disposition === 'stage-result')
      || (value.disposition === 'refused-alignment')
      || (value.disposition === 'refused-quote-loss')
      || (value.disposition === 'refused-declared-name'))
    && isJsonRecord(value.stageResult,)
    && isJsonRecord(value.alignment,)
    && Array.isArray(value.findings,);
}

/**
 * Lists entries under the slice-cache root that carry at least one settled
 * slice in EITHER lane, so the pass can resume an in-flight document to
 * completion before starting fresh ones.
 *
 * A settled entry (directory discarded) or one that aborted before settling
 * anything (empty directory) contributes nothing.
 *
 * @param dir - slice-cache root holding one subdirectory per entry
 *
 * @returns Set of entry ids carrying resumable progress, empty when none
 *
 * @example
 * ```ts
 * const resumable = await listResumableEntries({ dir: sliceCacheDir, },);
 * ```
 */
export async function listResumableEntries(
  { dir, }: { readonly dir: string; },
): Promise<Set<string>> {
  /**
   * Entry ids with one or more settled slices on disk.
   */
  const resumable = new Set<string>();

  /**
   * Per-entry subdirectory names under the cache root.
   */
  const ids = await readDirectoryNames({ dir, },);
  for (const id of ids) {
    try {
      /**
       * File names inside this entry's cache directory.
       */
      /* oxlint-disable-next-line no-await-in-loop -- small one-time setup scan over per-entry dirs */
      const names = await readDirectoryNames({ dir: join(
        dir,
        id,
      ), },);
      if (names.some(function isSliceFile(name,): boolean {
        return belongsToNamespace({
          name,
          namespace: REPAIR_SLICE_NAMESPACE,
        },)
          || belongsToNamespace({
            name,
            namespace: TRANSLATE_SLICE_NAMESPACE,
          },);
      },))
        resumable.add(id,);
    }
    catch (error) {
      // A non-directory child (ENOTDIR) simply carries no resumable slices;
      // other faults are real.
      if (!(Error.isError(error,) && ('code' in error)
        && (error.code === 'ENOTDIR')))
        throw error;
    }
  }
  return resumable;
}

/**
 * Opens an entry's REPAIR slice cache.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @param generation - digest of the built pipeline this pass runs
 *
 * @returns Cache resuming settled repair slices and persisting new ones
 *
 * @example
 * ```ts
 * const sliceCache = await openSliceCache({ dir: entryCacheDir, generation, },);
 * ```
 */
export async function openSliceCache(
  {
    dir,
    generation,
  }: {
    readonly dir: string;
    readonly generation: string;
  },
): Promise<SliceCache<ChunkRepairOutcome>> {
  return await openNamespacedCache({
    dir,
    generation,
    namespace: REPAIR_SLICE_NAMESPACE,
    isValue: isChunkRepairOutcome,
  },);
}

/**
 * Whether a cached value is a usable pairing.
 *
 * SHAPE ONLY. What a pairing must satisfy against the blocks it describes is
 * `readBlockPairing`'s question, and a cached pairing is re-read through it.
 *
 * @param value - parsed cache entry
 *
 * @returns Whether it is a list of correspondences
 *
 * @example
 * ```ts
 * const ok = isCachedPairing([{ source: 0, target: 0, },],);
 * ```
 */
function isCachedPairing(value: unknown,): value is readonly BlockPair[] {
  if (!Array.isArray(value,))
    return false;
  return value.every(function isPair(entry: unknown,): boolean {
    if ((typeof entry) !== 'object')
      return false;
    if (entry === null)
      return false;
    if (!('source' in entry))
      return false;
    if (!('target' in entry))
      return false;

    /**
     * Candidate indices, still unknown in type.
     */
    const {
      source,
      target,
    } = entry;
    return Number.isInteger(source,) && Number.isInteger(target,);
  },);
}

/**
 * Opens an entry's block-pairing cache.
 *
 * PAIRING IS BOUGHT ONCE PER DOCUMENT PAIR AND NEVER AGAIN. Without this a
 * resumed entry that buys nothing else still spends a round per section, which
 * `pass-entry`'s own test caught: it asserts a fully cached resume makes no
 * calls at all.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @param generation - digest of the built pipeline this pass runs
 *
 * @returns Cache resuming settled pairings and persisting new ones
 *
 * @example
 * ```ts
 * const pairingCache = await openPairingCache({ dir: entryCacheDir, generation, },);
 * ```
 */
export async function openPairingCache(
  {
    dir,
    generation,
  }: {
    readonly dir: string;
    readonly generation: string;
  },
): Promise<SliceCache<readonly BlockPair[]>> {
  return await openNamespacedCache({
    dir,
    generation,
    namespace: PAIRING_NAMESPACE,
    isValue: isCachedPairing,
  },);
}

/**
 * Opens an entry's TRANSLATE slice cache, beside the repair one.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @param generation - digest of the built pipeline this pass runs
 *
 * @returns Cache resuming settled translate slices and persisting new ones
 *
 * @example
 * ```ts
 * const translateCache = await openTranslateSliceCache({ dir: entryCacheDir, generation, },);
 * ```
 */
export async function openTranslateSliceCache(
  {
    dir,
    generation,
  }: {
    readonly dir: string;
    readonly generation: string;
  },
): Promise<SliceCache<TranslateSliceRecord>> {
  return await openNamespacedCache({
    dir,
    generation,
    namespace: TRANSLATE_SLICE_NAMESPACE,
    isValue: isTranslateSliceRecord,
  },);
}

/**
 * Discards a settled entry's whole slice cache, bounding the cache directory to
 * documents still in flight.
 *
 * Takes the DIRECTORY rather than one lane, because it runs when the entry is
 * finished: every lane is done with it, and leaving one lane's files behind
 * would keep the entry listed as resumable forever.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @example
 * ```ts
 * await discardSliceCache({ dir: entryCacheDir, },);
 * ```
 */
export async function discardSliceCache(
  { dir, }: { readonly dir: string; },
): Promise<void> {
  await rm(
    dir,
    {
      recursive: true,
      force: true,
    },
  );
}

//endregion Slice cache store
