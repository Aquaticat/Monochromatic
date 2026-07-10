/**
 * Prepared trust-record commit and disposal lifecycle. @module
 */
import { randomUUID, } from 'node:crypto';
import {
  lstat,
  rename,
  rm,
} from 'node:fs/promises';
import {
  isMissingPath,
  syncDirectory,
  TrustStorageError,
} from './registry-io.ts';
import { readRecord, } from './record-validation.ts';
import type { TrustRecord, } from './types.ts';

/**
 * Prepared private record awaiting validated installation.
 */
export type PreparedTrustRecord = Readonly<{
  /**
   * Candidate record metadata.
   */
  record: TrustRecord;
  /**
   * Executable path inside private candidate directory.
   */
  executablePath: string;
  /**
   * Atomically installs validated candidate.
   */
  commit: () => Promise<void>;
  /**
   * Removes private state and releases writer lock.
   */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;
/**
 * Mutable lifecycle hidden inside prepared record closure.
 */
type PreparedRecordState = {
  /**
   * Whether validated final record is installed.
   */
  committed: boolean;
  /**
   * Whether exclusive writer lock was removed.
   */
  lockReleased: boolean;
};

/**
 * Creates disposable lifecycle around fully written candidate directory.
 *
 * @param record - validated candidate metadata
 *
 * @param executablePath - executable candidate snapshot
 *
 * @param registryRoot - complete registry root
 *
 * @param finalDirectory - permanent exact-identity directory
 *
 * @param temporaryDirectory - private candidate sibling
 *
 * @param parentDirectory - replacement parent
 *
 * @param lockDirectory - exclusive writer lock
 *
 * @returns prepared record lifecycle
 *
 * @example
 * ```ts
 * const prepared = createPreparedTrustRecord(input);
 * ```
 */
export function createPreparedTrustRecord({
  record,
  executablePath,
  registryRoot,
  finalDirectory,
  temporaryDirectory,
  parentDirectory,
  lockDirectory,
}: Readonly<{
  record: TrustRecord;
  executablePath: string;
  registryRoot: string;
  finalDirectory: string;
  temporaryDirectory: string;
  parentDirectory: string;
  lockDirectory: string;
}>,): PreparedTrustRecord {
  /**
   * Mutable lifecycle isolated behind returned operations.
   */
  const state: PreparedRecordState = {
    committed: false,
    lockReleased: false,
  };

  /**
   * Releases writer lock once.
   */
  async function releaseLock(): Promise<void> {
    if (state.lockReleased)
      return;
    await rm(
      lockDirectory,
      {
        recursive: true,
        force: true,
      },
    );
    state.lockReleased = true;
  }

  /**
   * Installs prepared record with rollback before validation settles.
   */
  async function commitRecord(): Promise<void> {
    /**
     * Sibling holding replaced record until candidate validates.
     */
    const backupDirectory = `${finalDirectory}.old-${randomUUID()}`;
    /**
     * Replacement phases needed for safe rollback.
     */
    const replacement = {
      backupCreated: false,
      candidateInstalled: false,
    };
    try {
      /**
       * Existing record metadata before exchange.
       */
      const currentMetadata = await lstat(finalDirectory,);
      if ((!currentMetadata.isDirectory()) || currentMetadata.isSymbolicLink())
        throw new TrustStorageError('Existing trust record directory is unsafe.',);
      await rename(
        finalDirectory,
        backupDirectory,
      );
      replacement.backupCreated = true;
    }
    catch (error: unknown) {
      if (!isMissingPath(error,)) {
        await releaseLock();
        throw error;
      }
    }
    try {
      await rename(
        temporaryDirectory,
        finalDirectory,
      );
      replacement.candidateInstalled = true;
      await syncDirectory(parentDirectory,);
      await readRecord({
        registryRoot,
        directory: finalDirectory,
      },);
      state.committed = true;
      if (replacement.backupCreated)
        await rm(
          backupDirectory,
          {
            recursive: true,
            force: true,
          },
        );
      await releaseLock();
    }
    catch (error: unknown) {
      if ((!state.committed) && replacement.candidateInstalled)
        await rm(
          finalDirectory,
          {
            recursive: true,
            force: true,
          },
        );
      if ((!state.committed) && replacement.backupCreated)
        await rename(
          backupDirectory,
          finalDirectory,
        );
      await releaseLock();
      throw new TrustStorageError(
        'Unable to install trust record atomically.',
        { cause: error, },
      );
    }
  }

  /**
   * Removes uncommitted candidate and writer lock.
   */
  async function disposeRecord(): Promise<void> {
    if (!state.committed)
      await rm(
        temporaryDirectory,
        {
          recursive: true,
          force: true,
        },
      );
    await releaseLock();
  }

  return {
    record,
    executablePath,
    commit: commitRecord,
    [Symbol.asyncDispose]: disposeRecord,
  };
}
