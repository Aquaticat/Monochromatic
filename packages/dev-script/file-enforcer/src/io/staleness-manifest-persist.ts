import {
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, } from 'node:path';

import { acquireManifestLock, } from './staleness-manifest-lock.ts';
import {
  readManifestFromDisk,
  serializeManifest,
  type PersistableStalenessManifest,
} from './staleness-manifest-parse.ts';
import {
  MANIFEST_VERSION,
  type StalenessManifest,
} from './staleness-types.ts';

export { readManifestFromDisk, } from './staleness-manifest-parse.ts';

//region Atomic write constants

/**
 * Suffix appended to manifest path for atomic-write temp files.
 */
const TEMP_FILE_SUFFIX = '.tmp';

//endregion Atomic write constants

//region Atomic write and inter-process merge

/**
 * Writes manifest through same-directory temp file and atomic rename.
 *
 * @param manifestPath - Absolute manifest path.
 *
 * @param manifest - Manifest to persist.
 *
 * @example
 * ```ts
 * writeManifestAtomically({ manifestPath, manifest });
 * ```
 */
function writeManifestAtomically(
  {
    manifestPath,
    manifest,
  }: {
    readonly manifest: PersistableStalenessManifest;
    readonly manifestPath: string;
  },
): void {
  mkdirSync(
    dirname(manifestPath,),
    { recursive: true, },
  );
  /**
   * Same-directory temp path used for atomic replacement.
   */
  const tempPath = `${manifestPath}.${String(process.pid,)}.${String(Date.now(),)}${TEMP_FILE_SUFFIX}`;
  /**
   * Cleanup handle for temp file when write or rename fails.
   */
  using _tempCleanup = {
    [Symbol.dispose](): void {
      rmSync(
        tempPath,
        { force: true, },
      );
    },
  };
  writeFileSync(
    tempPath,
    serializeManifest(manifest,),
  );
  renameSync(
    tempPath,
    manifestPath,
  );
}

/**
 * Merges cached entries with latest disk state under lock, then writes atomically.
 *
 * @param manifestPath - Absolute manifest path.
 *
 * @param manifest - Cached manifest changes to persist.
 *
 * @returns Merged manifest written to disk.
 *
 * @example
 * ```ts
 * const merged = writeMergedManifest({ manifestPath, manifest });
 * ```
 */
export function writeMergedManifest(
  {
    manifestPath,
    manifest,
  }: {
    readonly manifest: PersistableStalenessManifest;
    readonly manifestPath: string;
  },
): StalenessManifest {
  /**
   * Lock handle released after merged manifest has been written.
   */
  using _lock = acquireManifestLock(manifestPath,);
  /**
   * Latest manifest state from disk while lock is held.
   */
  const existingManifest = readManifestFromDisk(manifestPath,);
  /**
   * Manifest preserving entries from disk plus this process's changes.
   */
  const mergedManifest: StalenessManifest = {
    version: MANIFEST_VERSION,
    entries: {
      ...existingManifest.entries,
      ...manifest.entries,
    },
  };
  writeManifestAtomically({
    manifestPath,
    manifest: mergedManifest,
  },);
  return mergedManifest;
}

//endregion Atomic write and inter-process merge
