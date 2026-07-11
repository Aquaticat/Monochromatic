/**
 * Generic private trust record preparation and validation. @module
 */
import { randomUUID, } from 'node:crypto';
import {
  mkdir,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import {
  readPrivateFile,
  validateTrustRecord,
} from './record-validation.ts';
import {
  DIRECTORY_MODE,
  ensureRegistryRoot,
  protectPath,
  syncDirectory,
  TrustStorageError,
  writePrivateFile,
} from './registry-io.ts';
import { ensurePrivateRegistryDirectory, } from './registry-directory.ts';
import { recordDirectory, } from './registry-path.ts';
import {
  createPreparedTrustRecord,
  type PreparedTrustRecord,
} from './registry-prepared-record.ts';
import type { TrustRecord, } from './types.ts';

/**
 * Reads and validates private candidate metadata before installation.
 *
 * @param directory - private candidate directory
 *
 * @returns validated candidate record
 */
async function validateCandidateDirectory(directory: string,): Promise<TrustRecord> {
  /**
   * Exact candidate record bytes.
   */
  const bytes = await readPrivateFile(join(
    directory,
    'record.json',
  ),);
  /**
   * Parsed unknown JSON held behind runtime validation.
   */
  const parsed: unknown = (function parseCandidateRecord() {
    try {
      return JSON.parse(new TextDecoder(
        'utf-8',
        { fatal: true, },
      ).decode(bytes,),) as unknown;
    }
    catch (error: unknown) {
      throw new TrustStorageError(`Candidate trust record JSON is invalid: ${String(error,)}`,);
    }
  })();
  /**
   * Runtime-authoritative candidate record.
   */
  const record = validateTrustRecord(parsed,);
  /**
   * Exact executable bytes used for size agreement.
   */
  const executableBytes = await readPrivateFile(join(
    directory,
    record.executableSnapshotFile,
  ),);
  if (executableBytes.byteLength
    .toString()
    !== record.executableSize)
    throw new TrustStorageError('Candidate executable snapshot size does not match record.',);
  return record;
}

/**
 * Removes failed private candidate and writer lock.
 *
 * @param temporaryDirectory - candidate path
 *
 * @param lockDirectory - writer lock path
 *
 * @param cause - preparation failure
 */
async function preparationFailure({
  temporaryDirectory,
  lockDirectory,
  cause,
}: Readonly<{
  temporaryDirectory: string;
  lockDirectory: string;
  cause: unknown;
}>,): Promise<never> {
  /**
   * Every pre-return cleanup result.
   */
  const cleanupResults = await Promise.allSettled([
    rm(
      temporaryDirectory,
      {
        recursive: true,
        force: true,
      },
    ),
    rm(
      lockDirectory,
      {
        recursive: true,
        force: true,
      },
    ),
  ],);
  /**
   * Cleanup failures retained in preparation error.
   */
  const cleanupFailures = cleanupResults
    .filter(function isCleanupFailure(result,) { return result.status === 'rejected'; },)
    .map(function cleanupFailureReason(result,) { return String(result.reason,); },);
  throw new TrustStorageError(
    cleanupFailures.length === 0
      ? 'Unable to prepare private trust record.'
      : `Unable to prepare private trust record; cleanup also failed: ${cleanupFailures.join('; ',)}`,
    { cause, },
  );
}

/**
 * Prepares complete private record and exact snapshot files.
 *
 * @param registryRoot - complete registry root
 *
 * @param record - exact persistent metadata
 *
 * @param snapshots - record-relative snapshot bytes
 *
 * @returns disposable candidate with explicit commit operation
 *
 * @example
 * ```ts
 * await using prepared = await prepareTrustRecord({ registryRoot, record, snapshots });
 * ```
 */
export async function prepareTrustRecord({
  registryRoot,
  record,
  snapshots,
}: Readonly<{
  registryRoot: string;
  record: TrustRecord;
  snapshots: ReadonlyMap<string, Uint8Array>;
}>,): Promise<PreparedTrustRecord> {
  await ensureRegistryRoot(registryRoot,);
  /**
   * Permanent exact identity directory.
   */
  const finalDirectory = recordDirectory({
    registryRoot,
    identity: record.identity,
  },);
  /**
   * Existing parent containing lock and candidate sibling.
   */
  const parentDirectory = dirname(finalDirectory,);
  await ensurePrivateRegistryDirectory({
    registryRoot,
    targetDirectory: parentDirectory,
  },);
  /**
   * Exclusive sibling writer lock.
   */
  const lockDirectory = `${finalDirectory}.lock`;
  try {
    await mkdir(
      lockDirectory,
      { mode: DIRECTORY_MODE, },
    );
  }
  catch (error: unknown) {
    throw new TrustStorageError(
      'Another trust writer holds this record lock.',
      { cause: error, },
    );
  }
  /**
   * Private complete candidate sibling.
   */
  const temporaryDirectory = `${finalDirectory}.tmp-${randomUUID()}`;
  try {
    await protectPath({
      path: lockDirectory,
      directory: true,
    },);
    /**
     * Flat private snapshot directory.
     */
    const snapshotDirectory = join(
      temporaryDirectory,
      'snapshots',
    );
    await mkdir(
      snapshotDirectory,
      {
        recursive: true,
        mode: DIRECTORY_MODE,
      },
    );
    await protectPath({
      path: temporaryDirectory,
      directory: true,
    },);
    await protectPath({
      path: snapshotDirectory,
      directory: true,
    },);
    await Promise.all([...snapshots.entries(),].map(async function writeSnapshot([relativePath, bytes,],) {
      await writePrivateFile({
        path: join(
          temporaryDirectory,
          relativePath,
        ),
        bytes,
      },);
    },),);
    await writePrivateFile({
      path: join(
        temporaryDirectory,
        'record.json',
      ),
      bytes: Buffer.from(
        `${JSON.stringify(record,)}\n`,
        'utf8',
      ),
    },);
    await syncDirectory(snapshotDirectory,);
    await syncDirectory(temporaryDirectory,);
    /**
     * Reopened and runtime-validated candidate metadata.
     */
    const validatedRecord = await validateCandidateDirectory(temporaryDirectory,);
    return createPreparedTrustRecord({
      record: validatedRecord,
      executablePath: join(
        temporaryDirectory,
        validatedRecord.executableSnapshotFile,
      ),
      registryRoot,
      finalDirectory,
      temporaryDirectory,
      parentDirectory,
      lockDirectory,
    },);
  }
  catch (error: unknown) {
    return await preparationFailure({
      temporaryDirectory,
      lockDirectory,
      cause: error,
    },);
  }
}
