/**
 Landed-capture records: the capture metadata of every commit that landed from this worktree,
 kept while a transaction may still replay over it.

 A landing writes `<git-dir>/cli-git-captures/landed/<landed oid>.json` right after its compare-and-swap,
 from its `captured.json`,
 with the next capture sequence number read after the compare-and-swap.
 Recovery writes the same record for a crashed landing it finds landed,
 before any other landing can take the landing lock,
 so a commit on the branch lacks its record only when it landed without capture order.

 Pruning keeps a record while any published transaction may need it.
 A transaction reads the next sequence number after publishing its directory and before reading its preparation base,
 so a commit that landed after that base was read recorded a next number no smaller than the transaction's.
 A record is removed when every published transaction recorded a larger next number before its base,
 when it belongs to another store generation,
 or when it is malformed;
 a published transaction that has not captured yet keeps every record.
 With no transaction left,
 every record is removed.

 @module
 */
import { readdir, } from 'node:fs/promises';
import { join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  isMissingPath,
  syncDirectory,
  writePrivateFile,
} from '../trust/registry-io.ts';
import {
  CAPTURED_ABSENT,
  type CapturedRecord,
  CaptureOrderRecordError,
  parseObject,
  pathsField,
  positiveField,
  readCapturedRecord,
  stringField,
} from './commit-capture-order-journal.ts';
import {
  type CaptureStamp,
  captureStorePath,
  ensureCaptureStore,
  readNextCaptureSequence,
  readStoreFile,
  WORKTREE_ID_FILENAME,
} from './commit-capture-order-store.ts';
import { ensureTransactionRoot, } from './commit-transaction-registry.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Landed-record directory name inside the store.
 */
export const LANDED_DIRECTORY_NAME = 'landed';

/**
 Landed-record filename suffix.
 */
export const LANDED_RECORD_SUFFIX = '.json';

/**
 Landed-record schema version.
 */
const LANDED_SCHEMA_VERSION = 1;

/**
 Capture metadata of one commit landed from this worktree.
 */
export type LandedCaptureRecord = CaptureStamp & Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 1;
  /**
   Landed commit.
   */
  commit: string;
  /**
   Transaction that landed it.
   */
  transactionId: string;
  /**
   Next capture sequence number read after the compare-and-swap.
   */
  nextSequenceAfterLanding: number;
  /**
   Paths whose bytes the landing transaction captured from the worktree, Latin-1 decoded.
   */
  worktreePaths: readonly string[];
}>;

/**
 Landed-record directory of a worktree.

 @param gitDir - absolute Git directory of the owning worktree

 @returns absolute directory

 @example
 ```ts
 landedRecordDirectory('/repo/.git'); // '/repo/.git/cli-git-captures/landed'
 ```
 */
export function landedRecordDirectory(gitDir: string,): string {
  return join(
    captureStorePath(gitDir,),
    LANDED_DIRECTORY_NAME,
  );
}

/**
 Parses one landed record.

 @param text - record text

 @param name - record name used in diagnostics

 @returns validated record

 @throws {@link CaptureOrderRecordError} for any malformed field

 @example
 ```ts
 parseLandedCaptureRecord({ text, name: 'landed/abc.json' });
 ```
 */
export function parseLandedCaptureRecord({
  text,
  name,
}: Readonly<{
  text: string;
  name: string;
}>,): LandedCaptureRecord {
  /**
   Parsed object.
   */
  const value = parseObject({
    text,
    name,
  },);
  if (Reflect.get(
    value,
    'schemaVersion',
  ) !== LANDED_SCHEMA_VERSION)
    throw new CaptureOrderRecordError(`${name} is not a schema-version-1 landed-capture record.`,);
  /**
   Field reader arguments shared by every field.
   */
  const source = {
    value,
    name,
  };
  return {
    schemaVersion: LANDED_SCHEMA_VERSION,
    commit: stringField({
      ...source,
      key: 'commit',
    },),
    transactionId: stringField({
      ...source,
      key: 'transactionId',
    },),
    worktreeId: stringField({
      ...source,
      key: 'worktreeId',
    },),
    sequence: positiveField({
      ...source,
      key: 'sequence',
    },),
    nextSequenceAfterLanding: positiveField({
      ...source,
      key: 'nextSequenceAfterLanding',
    },),
    worktreePaths: pathsField({
      ...source,
      key: 'worktreePaths',
    },),
  };
}

/**
 Builds the landed record of a transaction's capture.

 @param captured - the transaction's `captured.json`

 @param commit - landed commit

 @param transactionId - landing transaction

 @param nextSequenceAfterLanding - next sequence number read after the compare-and-swap

 @returns record
 */
function landedRecordOf({
  captured,
  commit,
  transactionId,
  nextSequenceAfterLanding,
}: Readonly<{
  captured: CapturedRecord;
  commit: string;
  transactionId: string;
  nextSequenceAfterLanding: number;
}>,): LandedCaptureRecord {
  return {
    schemaVersion: LANDED_SCHEMA_VERSION,
    commit,
    transactionId,
    worktreeId: captured.worktreeId,
    sequence: captured.sequence,
    nextSequenceAfterLanding,
    worktreePaths: captured.worktreePaths,
  };
}

/**
 Records the capture metadata of a commit that just landed, or that recovery found landed.
 Call only after the compare-and-swap succeeded.
 A transaction without `captured.json` records nothing,
 and an existing record is kept,
 so recovery may repeat the call.

 @param gitDir - absolute Git directory of the owning worktree

 @param transactionDirectory - landing transaction directory

 @param transactionId - landing transaction

 @param landedOid - landed commit

 @returns whether a record exists afterwards

 @throws {@link CaptureOrderRecordError} when `captured.json` is malformed

 @example
 ```ts
 await recordLandedCapture({ gitDir: '/repo/.git', transactionDirectory, transactionId, landedOid });
 ```
 */
export async function recordLandedCapture({
  gitDir,
  transactionDirectory,
  transactionId,
  landedOid,
}: Readonly<{
  gitDir: string;
  transactionDirectory: string;
  transactionId: string;
  landedOid: string;
}>,): Promise<boolean> {
  /**
   Tagged record logger.
   */
  const rl = tagged({
    tag: recordLandedCapture.name,
    l,
  },);
  /**
   The transaction's capture.
   */
  const captured = await readCapturedRecord(transactionDirectory,);
  if (captured === CAPTURED_ABSENT) {
    rl.debug(`transaction ${transactionId} captured without capture order; ${landedOid} gets no landed record`,);
    return false;
  }
  await ensureCaptureStore(gitDir,);
  /**
   Record directory.
   */
  const directory = landedRecordDirectory(gitDir,);
  await ensureTransactionRoot(directory,);
  /**
   Record of this landing.
   */
  const record = landedRecordOf({
    captured,
    commit: landedOid,
    transactionId,
    nextSequenceAfterLanding: await readNextCaptureSequence(gitDir,),
  },);
  try {
    await writePrivateFile({
      path: join(
        directory,
        `${landedOid}${LANDED_RECORD_SUFFIX}`,
      ),
      bytes: new TextEncoder().encode(`${JSON.stringify(record,)}\n`,),
    },);
    await syncDirectory(directory,);
    rl.debug(`recorded capture ${String(record.sequence,)} for landed ${landedOid}`,);
  }
  catch (error: unknown) {
    if (!(Error.isError(error,) && ('code' in error)
      && (error.code === 'EEXIST')))
      throw error;
    rl.debug(`landed record of ${landedOid} already exists: ${error.message}`,);
  }
  return true;
}

/**
 The store has no identity yet.
 */
export const WORKTREE_ID_ABSENT: unique symbol = Symbol('capture store identity absent',);

/**
 Reads the current store identity without creating one.

 @param gitDir - absolute Git directory of the owning worktree

 @returns identity, or {@link WORKTREE_ID_ABSENT}

 @example
 ```ts
 await readWorktreeId('/repo/.git');
 ```
 */
export async function readWorktreeId(gitDir: string,): Promise<string | typeof WORKTREE_ID_ABSENT> {
  try {
    return (await readStoreFile(join(
      captureStorePath(gitDir,),
      WORKTREE_ID_FILENAME,
    ),)).trim();
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    l.debug(`no capture store identity in ${gitDir}`,);
    return WORKTREE_ID_ABSENT;
  }
}

/**
 Reads the landed records of the given commits.
 A commit without a readable record is left out,
 so replay treats its paths as landed without capture order;
 a malformed record is reported and left out the same way.

 @param gitDir - absolute Git directory of the owning worktree

 @param commits - landed commits replay may compare against

 @returns records by commit

 @example
 ```ts
 await readLandedCaptures({ gitDir: '/repo/.git', commits: ['abc'] });
 ```
 */
export async function readLandedCaptures({
  gitDir,
  commits,
}: Readonly<{
  gitDir: string;
  commits: readonly string[];
}>,): Promise<ReadonlyMap<string, LandedCaptureRecord>> {
  /**
   Record directory.
   */
  const directory = landedRecordDirectory(gitDir,);
  /**
   One record read per commit.
   */
  const read = await Promise.all(commits.map(async function readOne(commit,): Promise<readonly (readonly [
    string,
    LandedCaptureRecord
  ])[]> {
    /**
     Record name used in diagnostics.
     */
    const name = join(
      directory,
      `${commit}${LANDED_RECORD_SUFFIX}`,
    );
    try {
      /**
       Parsed record.
       */
      const record = parseLandedCaptureRecord({
        text: await readStoreFile(name,),
        name,
      },);
      if (record.commit !== commit)
        throw new CaptureOrderRecordError(`${name} names another commit, ${record.commit}.`,);
      return [[
        commit,
        record,
      ],];
    }
    catch (error: unknown) {
      if (isMissingPath(error,))
        return [];
      l.warn(`ignoring unreadable landed-capture record; its paths replay without capture order: ${caughtValueText(error,)}`,);
      return [];
    }
  },),);
  return new Map(read.flat(),);
}

/**
 Lists landed-record filenames.

 @param gitDir - absolute Git directory of the owning worktree

 @returns filenames, empty when the directory does not exist

 @example
 ```ts
 await listLandedRecordNames('/repo/.git');
 ```
 */
export async function listLandedRecordNames(gitDir: string,): Promise<readonly string[]> {
  try {
    return await readdir(landedRecordDirectory(gitDir,),);
  }
  catch (error: unknown) {
    if (!isMissingPath(error,))
      throw error;
    l.debug(`no landed-capture records in ${gitDir}`,);
    return [];
  }
}

/**
 Records the capture metadata of a landed commit as `recordLandedCapture` does,
 but reports a failure instead of throwing it:
 the commit already landed,
 and a missing record only sends its paths through subsumption in later replays.

 @param gitDir - absolute Git directory of the owning worktree

 @param transactionDirectory - landing transaction directory

 @param transactionId - landing transaction

 @param landedOid - landed commit

 @returns whether a record exists afterwards

 @example
 ```ts
 await recordLandedCaptureOrWarn({ gitDir: '/repo/.git', transactionDirectory, transactionId, landedOid });
 ```
 */
export async function recordLandedCaptureOrWarn({
  gitDir,
  transactionDirectory,
  transactionId,
  landedOid,
}: Readonly<{
  gitDir: string;
  transactionDirectory: string;
  transactionId: string;
  landedOid: string;
}>,): Promise<boolean> {
  try {
    return await recordLandedCapture({
      gitDir,
      transactionDirectory,
      transactionId,
      landedOid,
    },);
  }
  catch (error: unknown) {
    l.warn(`could not record the capture of landed ${landedOid}; later replays over it use subsumption: ${caughtValueText(error,)}`,);
    return false;
  }
}
