import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { isJsonRecord, } from '../json-guard.ts';
import type { ChunkRepairOutcome, } from '../repair-contract.ts';
import type { SliceCache, } from '../repair-translation.ts';

//region Slice cache store
// Disk-backed per-entry slice cache making a large corpus document resumable:
// every finished slice is one JSON file named by its hash, so a run aborted at
// the hard cap resumes from the last finished slice on the next attempt. A
// settled entry drops its whole directory. The cache stores repairChunk
// OUTCOMES, so a pipeline change invalidates it -- wipe this directory whenever
// artifacts are wiped for a restart.

/**
 * File suffix of one persisted slice outcome.
 */
const JSON_SUFFIX = '.json';

/**
 * Whether a parsed cache file is a usable slice outcome. A half-written or
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
    && ((typeof value.accuracyPatchSelected) === 'boolean')
    && Array.isArray(value.findings,);
}

/**
 * Loads an entry's finished slice outcomes into a resume map keyed by slice
 * hash, tolerating a missing directory and half-written files.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @returns Map of slice hash to finished outcome, empty when none exist
 *
 * @example
 * ```ts
 * const resumed = await loadResumedSlices({ dir: entryCacheDir, },);
 * ```
 */
async function loadResumedSlices(
  { dir, }: { readonly dir: string; },
): Promise<Map<string, ChunkRepairOutcome>> {
  /**
   * Finished slice outcomes keyed by hash.
   */
  const resumed = new Map<string, ChunkRepairOutcome>();

  /**
   * Cache file names present under the directory.
   */
  let names: readonly string[] = [];
  try {
    names = await readdir(dir,);
  }
  catch (error) {
    // An absent directory (ENOENT) means no prior progress; anything else
    // is a real fault and must surface.
    if (!(Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT')))
      throw error;
  }

  for (const name of names) {
    if (!name.endsWith(JSON_SUFFIX,))
      continue;
    try {
      /**
       * Parsed JSON of this cache file, checked before it is trusted.
       */
      /* oxlint-disable-next-line no-await-in-loop -- small per-entry cache read sequentially at setup */
      const parsed: unknown = JSON.parse(await readFile(
        join(
          dir,
          name,
        ),
        'utf8',
      ),);
      if (isChunkRepairOutcome(parsed,))
        resumed.set(
          name.slice(
            0,
            -JSON_SUFFIX.length,
          ),
          parsed,
        );
    }
    catch (error) {
      // A half-written file (SyntaxError) is recomputed; other faults surface.
      if (!(error instanceof SyntaxError))
        throw error;
    }
  }
  return resumed;
}

/**
 * Lists entries under the slice-cache root that carry at least one finished
 * slice, so the pass can resume an in-flight document to completion before
 * starting fresh ones. A settled entry (directory discarded) or one that
 * aborted before finishing any slice (empty directory) contributes nothing.
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
   * Entry ids with one or more finished slices on disk.
   */
  const resumable = new Set<string>();

  /**
   * Per-entry subdirectory names under the cache root.
   */
  let ids: readonly string[] = [];
  try {
    ids = await readdir(dir,);
  }
  catch (error) {
    // An absent cache root (ENOENT) means no in-flight documents; anything
    // else is a real fault and must surface.
    if (!(Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT')))
      throw error;
    return resumable;
  }

  for (const id of ids) {
    try {
      /**
       * File names inside this entry's cache directory.
       */
      /* oxlint-disable-next-line no-await-in-loop -- small one-time setup scan over per-entry dirs */
      const names = await readdir(join(
        dir,
        id,
      ),);
      if (names.some(function isSliceFile(name,) {
        return name.endsWith(JSON_SUFFIX,);
      },))
        resumable.add(id,);
    }
    catch (error) {
      // A non-directory child (ENOTDIR) or one removed mid-scan (ENOENT)
      // simply carries no resumable slices; other faults are real.
      if (!(Error.isError(error,) && ('code' in error)
        && ((error.code === 'ENOENT') || (error.code === 'ENOTDIR'))))
        throw error;
    }
  }
  return resumable;
}

/**
 * Opens an entry's slice cache: ensures its directory exists, loads any
 * finished slices, and returns a write-through cache for the pipeline.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @returns Cache resuming finished slices and persisting new ones
 *
 * @example
 * ```ts
 * const sliceCache = await openSliceCache({ dir: entryCacheDir, },);
 * ```
 */
export async function openSliceCache(
  { dir, }: { readonly dir: string; },
): Promise<SliceCache> {
  await mkdir(
    dir,
    { recursive: true, },
  );

  /**
   * Slices this entry already finished on earlier runs.
   */
  const resumed = await loadResumedSlices({ dir, },);

  return {
    resumed,
    persist: async function persistSlice(
      key,
      serialized,
    ) {
      await writeFile(
        join(
          dir,
          `${key}${JSON_SUFFIX}`,
        ),
        `${serialized}\n`,
      );
    },
  };
}

/**
 * Discards a settled entry's slice cache, bounding the cache directory to
 * documents still in flight.
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
