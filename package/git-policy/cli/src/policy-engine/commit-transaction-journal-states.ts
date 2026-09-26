/**
 Schema-version-2 transaction journal records and their exclusive-create writers.

 State files are created exclusively and never rewritten,
 so a crash leaves the newest complete state readable.

 @module
 */
import { join, } from 'node:path';
import {
  syncDirectory,
  writePrivateFile,
} from '../trust/registry-io.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import type {
  ConclusionKind,
  PreparationBase,
  RefStorageFormat,
  SymbolicHeadTarget,
} from './commit-transaction-capture.ts';

/**
 Journal schema version of every per-transaction state record.
 */
export const JOURNAL_SCHEMA_VERSION = 2;

/**
 Invocation capture record filename.
 */
export const PREPARING_FILENAME = 'preparing.json';

/**
 Prepared commit record filename.
 */
export const PREPARED_FILENAME = 'prepared.json';

/**
 Landed commit record filename.
 */
export const REF_UPDATED_RECORD_FILENAME = 'ref-updated.json';

/**
 Index installation completion marker filename.
 */
export const INDEX_INSTALLED_MARKER_FILENAME = 'index-installed';

/**
 Commit selection mode.
 */
export type TransactionMode = 'explicit-path' | 'index';

/**
 File identity recorded without hashes.
 */
export type FileIdentity = Readonly<{
  /**
   Device identity.
   */
  device: string;
  /**
   Inode identity.
   */
  inode: string;
}>;

/**
 Real `index.lock` identity.
 */
export type LockIdentity = FileIdentity & Readonly<{
  /**
   Filesystem identity containing the lock.
   */
  fsId: string;
}>;

/**
 `preparing.json`: invocation capture facts written before any Git mutation.
 */
export type PreparingRecord = Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 2;
  /**
   Record discriminator.
   */
  state: 'preparing';
  /**
   Transaction ID, also the reflog nonce.
   */
  transactionId: string;
  /**
   Commit selection mode.
   */
  mode: TransactionMode;
  /**
   Target commit at invocation.
   */
  base: PreparationBase;
  /**
   Symbolic `HEAD` target at invocation.
   */
  symbolicHead: SymbolicHeadTarget;
  /**
   Ref advanced by compare-and-swap.
   */
  targetRef: string;
  /**
   Commit kind.
   */
  conclusion: ConclusionKind;
  /**
   Canonical worktree root.
   */
  repositoryRoot: string;
  /**
   Owning worktree Git directory.
   */
  gitDir: string;
  /**
   Common Git directory.
   */
  commonDir: string;
  /**
   Real index path.
   */
  realIndexPath: string;
  /**
   Real object directory.
   */
  objectDirectory: string;
  /**
   Ref storage backend.
   */
  refFormat: RefStorageFormat;
  /**
   Empty tree standing in for an unborn base.
   */
  emptyTreeOid: string;
  /**
   Shadow repository path derived from the transaction ID.
   */
  shadowPath: string;
  /**
   Pathspecs selected at invocation.
   */
  selectedPathspecs: readonly string[];
  /**
   ISO-8601 invocation start time.
   */
  invokedAt: string;
}>;

/**
 `prepared.json`: the verified prepared commit in the shadow repository.
 */
export type PreparedRecord = Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 2;
  /**
   Record discriminator.
   */
  state: 'prepared';
  /**
   Shadow repository holding the prepared commit.
   */
  shadowPath: string;
  /**
   Prepared commit.
   */
  preparedOid: string;
  /**
   Whether the prepared commit carries a signature header.
   */
  signed: boolean;
  /**
   Intended tree the prepared commit was verified against.
   */
  intendedTreeOid: string;
  /**
   Paths the commit carries, including policy-added paths.
   */
  committedPaths: readonly string[];
  /**
   Policy-added paths with original and intended blobs.
   */
  addedPaths: readonly AddedPathRecord[];
  /**
   Selected newline corrections whose worktree copies receive settled bytes.
   */
  selectedWorktreePaths: readonly AddedPathRecord[];
}>;

/**
 `index-lock-<n>.json`: identity of the real `index.lock` this transaction created,
 written immediately after creation so recovery can prove ownership before a landing record exists.
 */
export type IndexLockRecord = Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 2;
  /**
   Record discriminator.
   */
  state: 'index-locked';
  /**
   Landing attempt number.
   */
  attempt: number;
  /**
   Created lock identity.
   */
  lock: LockIdentity;
}>;

/**
 `landing-<n>.json`: one landing attempt inside the critical section.
 */
export type LandingRecord = Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 2;
  /**
   Record discriminator.
   */
  state: 'landing';
  /**
   Landing attempt number.
   */
  attempt: number;
  /**
   Landing kind: a commit, or a normalization that installs only index and worktree bytes.
   */
  operation: 'commit' | 'normalize-only';
  /**
   Expected old target value for compare-and-swap.
   */
  expectedOld: PreparationBase;
  /**
   New target value; absent for normalization.
   */
  newOid?: string;
  /**
   Tree the landing installs into the real index.
   */
  landedTreeOid: string;
  /**
   Exact pre-landing real index snapshot identity.
   */
  preLandingIndex: FileIdentity;
  /**
   Exact post-index artifact identity.
   */
  postIndex: FileIdentity;
  /**
   Real `index.lock` identity.
   */
  lock: LockIdentity;
  /**
   Migrated pack name; absent for normalization.
   */
  packName?: string;
  /**
   Policy-added path records.
   */
  addedPaths: readonly AddedPathRecord[];
  /**
   Selected newline correction records.
   */
  selectedWorktreePaths: readonly AddedPathRecord[];
}>;

/**
 `ref-updated.json`: exact landed commit.
 */
export type RefUpdatedRecord = Readonly<{
  /**
   Record schema version.
   */
  schemaVersion: 2;
  /**
   Record discriminator.
   */
  state: 'ref-updated';
  /**
   Landed commit.
   */
  landedOid: string;
}>;

/**
 Any schema-version-2 JSON record.
 */
export type JournalRecord = PreparingRecord | PreparedRecord | IndexLockRecord | LandingRecord | RefUpdatedRecord;

/**
 Pre-landing real index snapshot filename of one attempt.

 @param attempt - landing attempt number

 @returns filename

 @example
 ```ts
 preLandingIndexFilename(1); // 'pre-landing-1.index'
 ```
 */
export function preLandingIndexFilename(attempt: number,): string {
  return `pre-landing-${String(attempt,)}.index`;
}

/**
 Post-index artifact filename of one attempt.

 @param attempt - landing attempt number

 @returns filename

 @example
 ```ts
 postIndexFilename(1); // 'post-1.index'
 ```
 */
export function postIndexFilename(attempt: number,): string {
  return `post-${String(attempt,)}.index`;
}

/**
 Landing record filename of one attempt.

 @param attempt - landing attempt number

 @returns filename

 @example
 ```ts
 landingRecordFilename(1); // 'landing-1.json'
 ```
 */
export function landingRecordFilename(attempt: number,): string {
  return `landing-${String(attempt,)}.json`;
}

/**
 Index lock record filename of one attempt.

 @param attempt - landing attempt number

 @returns filename

 @example
 ```ts
 indexLockRecordFilename(1); // 'index-lock-1.json'
 ```
 */
export function indexLockRecordFilename(attempt: number,): string {
  return `index-lock-${String(attempt,)}.json`;
}

/**
 Writes one record exclusively and makes its directory entry durable.

 @param directory - transaction directory

 @param filename - record filename

 @param record - record value

 @example
 ```ts
 await writeJournalRecord({ directory, filename: PREPARING_FILENAME, record });
 ```
 */
export async function writeJournalRecord({
  directory,
  filename,
  record,
}: Readonly<{
  directory: string;
  filename: string;
  record: JournalRecord;
}>,): Promise<void> {
  await writePrivateFile({
    path: join(
      directory,
      filename,
    ),
    bytes: new TextEncoder().encode(`${JSON.stringify(record,)}\n`,),
  },);
  await syncDirectory(directory,);
}

/**
 Writes the empty index-installed marker.

 @param directory - transaction directory

 @example
 ```ts
 await writeIndexInstalledMarker('/repo/.git/cli-git-transactions/id');
 ```
 */
export async function writeIndexInstalledMarker(directory: string,): Promise<void> {
  await writePrivateFile({
    path: join(
      directory,
      INDEX_INSTALLED_MARKER_FILENAME,
    ),
    bytes: new Uint8Array(),
  },);
  await syncDirectory(directory,);
}
