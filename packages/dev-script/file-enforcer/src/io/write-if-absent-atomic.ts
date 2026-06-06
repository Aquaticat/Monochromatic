import { randomUUID, } from 'node:crypto';
import {
  linkSync,
  mkdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, } from 'node:path';

import { caughtErrorHasCode, } from './error.ts';
import {
  fsyncDirectory,
  writeTempFileDurably,
} from './write-atomic.ts';
import type { AtomicTempFileWriter, } from './write-atomic.ts';

//region Atomic create-if-absent constants and types

/**
 * Suffix appended to same-directory temp files used for no-clobber creation.
 */
const TEMP_FILE_SUFFIX = '.tmp';

/**
 * Sentinel returned when final destination already exists at create time.
 */
export const FILE_ALREADY_EXISTS: unique symbol = Symbol('file-enforcer/io/write-if-absent-atomic: file already exists',);

/**
 * Result from atomic create-if-absent destination writes.
 */
export type WriteFileIfAbsentAtomicallyResult = number | typeof FILE_ALREADY_EXISTS;

//endregion Atomic create-if-absent constants and types

//region Destination existence helpers

/**
 * Returns whether caught error means final destination already existed.
 *
 * @param error - Unknown caught value from hard-link creation.
 *
 * @returns Whether no-clobber creation should skip instead of replacing.
 *
 * @example
 * ```ts
 * const exists = destinationAlreadyExists(error);
 * ```
 */
function destinationAlreadyExists(error: unknown,): boolean {
  return caughtErrorHasCode({
    error,
    code: 'EEXIST',
  },);
}

//endregion Destination existence helpers

//region Atomic create-if-absent destination writes

/**
 * Writes file content through same-directory temp file and creates destination
 * only if no directory entry exists at final path.
 *
 * The temp file is fsynced before a hard link creates the destination name.
 * Hard-link creation fails with `EEXIST` when another process or a dangling
 * symlink already owns the final path, preserving that entry instead of
 * replacing it.
 *
 * @param filePath - Destination file path to create.
 *
 * @param content - Destination content to persist.
 *
 * @param tempFileWriter - Optional writer seam for fault-injection tests.
 *
 * @returns Destination mtime in whole milliseconds, or {@link FILE_ALREADY_EXISTS}.
 *
 * @throws Non-existence filesystem failures from temp writing, linking, cleanup, or stat.
 *
 * @example
 * ```ts
 * const result = writeFileIfAbsentAtomically({ filePath: './defaults.json', content: '{}' });
 * ```
 */
export function writeFileIfAbsentAtomically(
  {
    filePath,
    content,
    tempFileWriter = writeTempFileDurably,
  }: {
    readonly content: string;
    readonly filePath: string;
    readonly tempFileWriter?: AtomicTempFileWriter;
  },
): WriteFileIfAbsentAtomicallyResult {
  /**
   * Directory containing final destination and same-directory temp file.
   */
  const destinationDirectory = dirname(filePath,);
  mkdirSync(
    destinationDirectory,
    { recursive: true, },
  );
  /**
   * Same-directory temp path used as durable source for final hard link.
   */
  const tempPath = `${filePath}.${String(process.pid,)}.${randomUUID()}${TEMP_FILE_SUFFIX}`;
  /**
   * Cleanup handle for temp file when write, link, or cleanup fsync fails.
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
  try {
    linkSync(
      tempPath,
      filePath,
    );
  }
  catch (linkError: unknown) {
    if (destinationAlreadyExists(linkError,))
      return FILE_ALREADY_EXISTS;

    throw linkError;
  }
  rmSync(
    tempPath,
    { force: true, },
  );
  fsyncDirectory(destinationDirectory,);
  /**
   * Actual post-link mtime used by watch echo suppression.
   */
  const destinationStat = statSync(filePath,);
  return Math.floor(destinationStat.mtimeMs,);
}

//endregion Atomic create-if-absent destination writes
