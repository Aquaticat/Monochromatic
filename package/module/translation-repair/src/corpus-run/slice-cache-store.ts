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
import type { SliceCache, } from '../slice-cache.ts';

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
    && Array.isArray(value.candidateResolvedIssueIds,)
    && ((typeof value.accuracyPatchSelected) === 'boolean')
    && ((typeof value.refined) === 'boolean')
    && Array.isArray(value.claimAttributions,)
    && Array.isArray(value.heardCriticIds,)
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
 * File recording which pipeline produced the slices in a cache directory.
 *
 * Deliberately not a `.json` slice name, so {@link loadResumedSlices} cannot
 * mistake it for a finished slice.
 */
const GENERATION_MARKER = 'generation.txt';

/**
 * Reads the pipeline a cache directory was filled by.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @returns Recorded pipeline digest, or empty when the cache predates
 * stamping or has never been written
 *
 * @example
 * ```ts
 * const cached = await readCacheGeneration({ dir, },);
 * ```
 */
async function readCacheGeneration(
  { dir, }: { readonly dir: string; },
): Promise<string> {
  try {
    /**
     * Raw marker text, including its trailing newline.
     */
    const text = await readFile(
      join(
        dir,
        GENERATION_MARKER,
      ),
      'utf8',
    );
    return text.trim();
  }
  catch (error) {
    // Absent is the ordinary state for a cache written before stamping
    // existed, and for a directory that has never been used. Logged rather
    // than swallowed so a permission fault is visible instead of reading as a
    // routine miss.
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return '';
    console.log(`SLICE cache generation unreadable in ${dir}: ${String(error,)}`,);
    return '';
  }
}

/**
 * Opens an entry's slice cache: ensures its directory exists, loads any
 * finished slices produced by THIS pipeline, and returns a write-through cache.
 *
 * A cache filled by a different pipeline is DISCARDED rather than resumed.
 * Resuming it is the one generation defect no reader can catch: the settled
 * artifact records a single digest, so an entry built half from cached slices
 * and half from current code looks like ordinary work to every filter
 * downstream, while being internally mixed. Cross-artifact mixing is at least
 * visible in a census; this is not visible anywhere.
 *
 * An UNSTAMPED cache is discarded for the same reason. It cannot prove which
 * pipeline filled it, and an unprovable cache is exactly the case the stamp
 * exists to remove.
 *
 * @param dir - per-entry slice-cache directory
 *
 * @param generation - digest of the built pipeline this pass runs
 *
 * @returns Cache resuming finished slices and persisting new ones
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
  await mkdir(
    dir,
    { recursive: true, },
  );

  /**
   * Pipeline that filled this cache, empty when it never said.
   */
  const cached = await readCacheGeneration({ dir, },);

  /**
   * Slices this entry already finished on earlier runs, kept only when the
   * pipeline that produced them is the one running now.
   */
  const resumed = (cached === generation)
    ? await loadResumedSlices({ dir, },)
    : new Map<string, ChunkRepairOutcome>();

  if (cached !== generation) {
    /**
     * Slices about to be thrown away, counted before the directory is cleared.
     */
    const discarded = await loadResumedSlices({ dir, },);
    if (discarded.size > 0)
      console.log(
        `SLICE discarding ${String(discarded.size,)} cached slices in ${dir}: `
          + `filled by ${cached === '' ? '(unstamped)' : cached}, `
          + `running ${generation}`,
      );
    await rm(
      dir,
      {
        recursive: true,
        force: true,
      },
    );
    await mkdir(
      dir,
      { recursive: true, },
    );
  }

  // Written after any discard, so the marker always describes what the
  // directory now holds. A torn write reads as a mismatch on the next open,
  // which discards rather than resumes, so the failure direction is safe.
  await writeFile(
    join(
      dir,
      GENERATION_MARKER,
    ),
    `${generation}\n`,
  );

  return {
    resumed,
    persist: async function persistSlice({
      key,
      serialized,
    },): Promise<void> {
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
