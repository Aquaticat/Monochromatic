/**
 * Atomic trust record preparation, installation, and removal.
 *
 * @module
 */
import type { ReadonlyDeep, } from 'type-fest';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
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
import type {
  TrustCandidate,
  TrustRecord,
} from './types.ts';

/**
 * Snapshot location for MJS entry.
 */
const MJS_SNAPSHOT_FILE = 'snapshots/config.mjs';

export { TrustStorageError, } from './registry-io.ts';

export type { PreparedTrustRecord, } from './registry-prepared-record.ts';

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
   * Parsed unknown JSON kept behind runtime validation.
   */
  const parsed: unknown = (function parseCandidateRecord() {
    try {
      /**
       * JSON parser output held as unknown.
       */
      const jsonValue: unknown = JSON.parse(new TextDecoder(
        'utf-8',
        { fatal: true, },
      ).decode(bytes,),);
      return jsonValue;
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
 * Builds schema-version-one record for one MJS candidate.
 *
 * @param candidate - exact source candidate
 *
 * @param recordedAt - RFC 3339 audit timestamp
 *
 * @returns immutable record metadata
 */
function buildMjsRecord({
  candidate,
  recordedAt,
  recursiveChildren,
  authorizingRoots,
}: Readonly<{
  candidate: TrustCandidate;
  recordedAt: string;
  recursiveChildren: boolean;
  authorizingRoots: readonly TrustRecord['identity'][];
}>,): TrustRecord {
  return {
    schemaVersion: 1,
    identity: candidate.identity,
    repositoryRoot: candidate.discovered
      .repositoryRoot,
    format: 'mjs',
    sources: [{
      canonicalPath: candidate.discovered
        .configPath,
      snapshotFile: MJS_SNAPSHOT_FILE,
      size: candidate.size,
      mtimeNanoseconds: candidate.mtimeNanoseconds,
    },],
    executableSnapshotFile: MJS_SNAPSHOT_FILE,
    executableSize: candidate.size,
    recursiveChildren,
    authorizingRoots,
    recordedAt,
  };
}

/**
 * Prepares complete private MJS record without installing trust.
 *
 * @param registryRoot - complete registry root
 *
 * @param candidate - exact live candidate
 *
 * @param recordedAt - RFC 3339 UTC audit timestamp
 *
 * @param recursiveChildren - persisted descendant authority
 *
 * @param authorizingRoots - explicit and inherited provenance
 *
 * @mutates candidate through handle.writeFile native-boundary access to candidate.bytes
 *
 * @returns disposable candidate with explicit commit operation
 *
 * @example
 * ```ts
 * await using prepared = await prepareMjsRecord({ registryRoot, candidate, recordedAt });
 * ```
 */
export async function prepareMjsRecord({
  registryRoot,
  candidate,
  recordedAt,
  recursiveChildren = false,
  authorizingRoots = [],
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
  recordedAt: string;
  recursiveChildren?: boolean;
  authorizingRoots?: readonly TrustRecord['identity'][];
}>,): Promise<PreparedTrustRecord> {
  await ensureRegistryRoot(registryRoot,);
  /**
   * Permanent exact identity directory.
   */
  const finalDirectory = recordDirectory({
    registryRoot,
    identity: candidate.identity,
  },);
  /**
   * Existing parent path containing writer lock and candidate sibling.
   */
  const parentDirectory = dirname(finalDirectory,);
  await ensurePrivateRegistryDirectory({
    registryRoot,
    targetDirectory: parentDirectory,
  },);

  /**
   * Exclusive sibling writer lock directory.
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
    await mkdir(
    join(
      temporaryDirectory,
      'snapshots',
    ),
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
    path: join(
      temporaryDirectory,
      'snapshots',
    ),
    directory: true,
  },);

  /**
   * Exact persistent metadata.
   */
  const record = buildMjsRecord({
    candidate,
    recordedAt,
    recursiveChildren,
    authorizingRoots,
  },);
  await writePrivateFile({
    path: join(
      temporaryDirectory,
      MJS_SNAPSHOT_FILE,
    ),
    bytes: candidate.bytes,
  },);
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
  await syncDirectory(join(
    temporaryDirectory,
    'snapshots',
  ),);
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
    /**
     * Every pre-return private artifact cleanup result.
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
      .filter(function isCleanupFailure(
        result: ReadonlyDeep<(typeof cleanupResults)[number]>,
      ) {
        return result.status === 'rejected';
      },)
      .map(
        /**
         * Preserves one cleanup rejection reason.
         *
         * @param result - Rejected cleanup result.
         *
         * @returns diagnostic reason text.
         *
         * @mutates result - `caughtValueText` may invoke hooks on rejection reason.
         */
        function cleanupFailureReason(result,) {
          return caughtValueText(result.reason,);
        },
      );
    throw new TrustStorageError(
      cleanupFailures.length === 0
        ? 'Unable to prepare private trust record.'
        : `Unable to prepare private trust record; cleanup also failed: ${cleanupFailures.join('; ',)}`,
      { cause: error, },
    );
  }
}

export {
  loadRecord,
  removeRecord,
} from './registry-record-ops.ts';
