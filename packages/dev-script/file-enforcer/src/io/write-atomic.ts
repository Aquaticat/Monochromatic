import { randomUUID, } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, } from 'node:path';

import { caughtErrorHasCode, } from './error.ts';

//region Atomic write constants and types

/**
 * Suffix appended to same-directory temp files used for destination replacement.
 */
const TEMP_FILE_SUFFIX = '.tmp';

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
 * Disposable file descriptor used for synchronous durability helpers.
 */
type DisposableFileDescriptor = Disposable & Readonly<{
  /**
   * Open file descriptor.
   */
  readonly fd: number;
}>;

/**
 * Writes content to same-directory temp file before atomic rename.
 */
export type AtomicTempFileWriter = (
  args: {
    /**
     * Same-directory temp path that will be renamed into place after writing.
     */
    readonly tempPath: string;

    /**
     * Destination content to persist.
     */
    readonly content: string;
  },
) => void;

//endregion Atomic write constants and types

//region File descriptor durability helpers

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
export function directoryFsyncUnsupported(error: unknown,): boolean {
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
 * using file = openWritableFile('/tmp/output.tmp');
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
 * Writes and fsyncs destination temp file before rename.
 *
 * @param tempPath - Same-directory temp path.
 *
 * @param content - Destination content to write.
 *
 * @example
 * ```ts
 * writeTempFileDurably({ tempPath, content });
 * ```
 */
export function writeTempFileDurably(
  {
    tempPath,
    content,
  }: {
    readonly content: string;
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
      content,
    );
    fsyncSync(tempFile.fd,);
  }
}

/**
 * Fsyncs directory containing renamed destination to persist directory entry.
 *
 * @param directoryPath - Directory path to fsync.
 *
 * @example
 * ```ts
 * fsyncDirectory('/tmp/output-directory');
 * ```
 */
export function fsyncDirectory(directoryPath: string,): void {
  try {
    /**
     * Directory descriptor fsynced after destination rename.
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

//region Atomic destination replacement

/**
 * Writes file content through same-directory temp file and atomic rename.
 *
 * @param filePath - Destination file path to replace.
 *
 * @param content - Destination content to persist.
 *
 * @param tempFileWriter - Optional writer seam for fault-injection tests.
 *
 * @returns Destination mtime in whole milliseconds after rename.
 *
 * @example
 * ```ts
 * writeFileAtomically({ filePath: './CLAUDE.md', content: '# Generated' });
 * ```
 */
export function writeFileAtomically(
  {
    filePath,
    content,
    tempFileWriter = writeTempFileDurably,
  }: {
    readonly content: string;
    readonly filePath: string;
    readonly tempFileWriter?: AtomicTempFileWriter;
  },
): number {
  /**
   * Directory containing final destination and same-directory temp file.
   */
  const destinationDirectory = dirname(filePath,);
  mkdirSync(
    destinationDirectory,
    { recursive: true, },
  );
  /**
   * Same-directory temp path used for atomic replacement.
   */
  const tempPath = `${filePath}.${String(process.pid,)}.${randomUUID()}${TEMP_FILE_SUFFIX}`;
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
  tempFileWriter({
    tempPath,
    content,
  },);
  renameSync(
    tempPath,
    filePath,
  );
  fsyncDirectory(destinationDirectory,);
  /**
   * Actual post-rename mtime used by watch echo suppression.
   */
  const destinationStat = statSync(filePath,);
  return Math.floor(destinationStat.mtimeMs,);
}

//endregion Atomic destination replacement
