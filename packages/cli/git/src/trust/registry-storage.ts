/**
 * Atomic trust record preparation, installation, and removal.
 *
 * @module
 */
import { randomUUID, } from 'node:crypto';
import {
  lstat,
  mkdir,
  rename,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import {
  readPrivateFile,
  readRecord,
  validateTrustRecord,
} from './record-validation.ts';
import {
  assertSafeRegistryDirectory,
  DIRECTORY_MODE,
  ensureRegistryRoot,
  isMissingPath,
  protectPath,
  syncDirectory,
  TrustStorageError,
  writePrivateFile,
} from './registry-io.ts';
import { recordDirectory, } from './registry-path.ts';
import type {
  TrustCandidate,
  TrustRecord,
} from './types.ts';

/**
 * Snapshot location for MJS entry.
 */
const MJS_SNAPSHOT_FILE = 'snapshots/config.mjs';

export { TrustStorageError, } from './registry-io.ts';

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
}: Readonly<{
  candidate: TrustCandidate;
  recordedAt: string;
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
    recursiveChildren: false,
    authorizingRoots: [],
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
}: Readonly<{
  registryRoot: string;
  candidate: TrustCandidate;
  recordedAt: string;
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
  await mkdir(
    parentDirectory,
    {
      recursive: true,
      mode: DIRECTORY_MODE,
    },
  );
  await assertSafeRegistryDirectory({
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
  await protectPath({
    path: lockDirectory,
    directory: true,
  },);

  /**
   * Private complete candidate sibling.
   */
  const temporaryDirectory = `${finalDirectory}.tmp-${randomUUID()}`;
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
  /**
   * Mutable lifecycle isolated behind disposable object.
   */
  const state = {
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

  return {
    record: validatedRecord,
    executablePath: join(
      temporaryDirectory,
      validatedRecord.executableSnapshotFile,
    ),
    commit: async function commitPreparedRecord(): Promise<void> {
      /**
       * Sibling holding replaced record until candidate validates in final location.
       */
      const backupDirectory = `${finalDirectory}.old-${randomUUID()}`;
      /**
       * Replacement state used for rollback without function-root mutable binding.
       */
      const replacement = { backupCreated: false, };
      try {
        /**
         * Existing record directory metadata before exchange.
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
        state.committed = true;
        await syncDirectory(parentDirectory,);
        await readRecord({
          registryRoot,
          directory: finalDirectory,
        },);
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
        if (replacement.backupCreated && (!state.committed))
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
    },
    async [Symbol.asyncDispose](): Promise<void> {
      if (!state.committed)
        await rm(
          temporaryDirectory,
          {
            recursive: true,
            force: true,
          },
        );
      await releaseLock();
    },
  };
}

export {
  loadRecord,
  removeRecord,
} from './registry-record-ops.ts';
