import { randomUUID, } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, } from 'node:path';

import { acquireManifestLock, } from './staleness-manifest-lock.ts';
import { caughtErrorHasCode, } from './staleness-manifest-error.ts';
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

/**
 * Disposable file descriptor used for synchronous durability helpers.
 */
type DisposableFileDescriptor = Disposable & Readonly<{
  /**
   * Open file descriptor.
   */
  readonly fd: number;
}>;

//region Atomic write constants

/**
 * Suffix appended to manifest path for atomic-write temp files.
 */
const TEMP_FILE_SUFFIX = '.tmp';

//endregion Atomic write constants

//region File descriptor durability helpers

/**
 * Error codes meaning directory fsync is unsupported by platform or filesystem.
 */
const UNSUPPORTED_DIRECTORY_FSYNC_ERROR_CODES = [
  'EACCES',
  'EINVAL',
  'EISDIR',
  'ENOSYS',
  'ENOTSUP',
  'EPERM',
] as const;

/**
 * Returns whether caught error means directory fsync is unsupported.
 *
 * @param error - Unknown caught value from directory open or fsync.
 *
 * @returns Whether directory fsync should degrade to best effort.
 *
 * @example
 * ```ts
 * const unsupported = directoryFsyncUnsupported(error);
 * ```
 */
function directoryFsyncUnsupported(error: unknown,): boolean {
  return UNSUPPORTED_DIRECTORY_FSYNC_ERROR_CODES.some(function errorCodeMatches(code,): boolean {
    return caughtErrorHasCode({
      error,
      code,
    },);
  },);
}

/**
 * Wraps file descriptor in disposable close handle.
 *
 * @param fd - Open file descriptor.
 *
 * @returns Disposable file descriptor wrapper.
 *
 * @example
 * ```ts
 * using file = disposableFileDescriptor({ fd });
 * ```
 */
function disposableFileDescriptor({ fd, }: { readonly fd: number; },): DisposableFileDescriptor {
  return {
    fd,
    [Symbol.dispose](): void {
      closeSync(fd,);
    },
  };
}

/**
 * Opens writable file as disposable descriptor.
 *
 * @param path - Path to open for writing.
 *
 * @returns Disposable writable descriptor.
 *
 * @example
 * ```ts
 * using file = openWritableFile('/tmp/manifest.tmp');
 * ```
 */
function openWritableFile(path: string,): DisposableFileDescriptor {
  return disposableFileDescriptor({
    fd: openSync(
      path,
      'w',
    ),
  },);
}

/**
 * Writes and fsyncs manifest temp file before rename.
 *
 * @param tempPath - Same-directory temp path.
 *
 * @param manifest - Manifest to serialize.
 *
 * @example
 * ```ts
 * writeManifestTempFile({ tempPath, manifest });
 * ```
 */
function writeManifestTempFile(
  {
    tempPath,
    manifest,
  }: {
    readonly manifest: PersistableStalenessManifest;
    readonly tempPath: string;
  },
): void {
  {
    /**
     * Writable temp-file descriptor fsynced before rename.
     */
    using tempFile = openWritableFile(tempPath,);
    writeFileSync(
      tempFile.fd,
      serializeManifest(manifest,),
    );
    fsyncSync(tempFile.fd,);
  }
}

/**
 * Fsyncs directory containing renamed manifest to persist directory entry.
 *
 * @param directoryPath - Directory path to fsync.
 *
 * @example
 * ```ts
 * fsyncDirectory('/tmp/cache');
 * ```
 */
function fsyncDirectory(directoryPath: string,): void {
  try {
    /**
     * Directory descriptor fsynced after manifest rename.
     */
    using directory = disposableFileDescriptor({
      fd: openSync(
        directoryPath,
        'r',
      ),
    },);
    fsyncSync(directory.fd,);
  }
  catch (directoryFsyncError: unknown) {
    if (directoryFsyncUnsupported(directoryFsyncError,))
      return;

    throw directoryFsyncError;
  }
}

//endregion File descriptor durability helpers

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
  /**
   * Directory containing manifest and same-directory temp files.
   */
  const manifestDirectory = dirname(manifestPath,);
  mkdirSync(
    manifestDirectory,
    { recursive: true, },
  );
  /**
   * Same-directory temp path used for atomic replacement.
   */
  const tempPath = `${manifestPath}.${String(process.pid,)}.${randomUUID()}${TEMP_FILE_SUFFIX}`;
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
  writeManifestTempFile({
    tempPath,
    manifest,
  },);
  renameSync(
    tempPath,
    manifestPath,
  );
  fsyncDirectory(manifestDirectory,);
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
