/**
 Tracked paths a policy adds to a commit, and their worktree completion after the commit lands.

 A policy patch that targets a tracked file outside the candidate set adds that path.
 The path must be unchanged everywhere (real index, private commit index, and worktree all hold its `HEAD` blob),
 so rewriting its worktree copy after the commit lands discards nothing.

 @module
 */
import { randomUUID, } from 'node:crypto';
import {
  lstat,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { GitObjectId, } from '../api/policy-types.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import {
  loadHeadTreeEntries,
  loadIndexEntries,
} from './commit-transaction-candidate-batch.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';
import { TRACKED_TARGET_PREFIX, } from './commit-transaction-tracked-files.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Git mode of an ordinary file.
 */
const REGULAR_GIT_MODE = '100644';

/**
 Git mode of an executable file.
 */
const EXECUTABLE_GIT_MODE = '100755';

/**
 Worktree permission bits for an ordinary file.
 */
const REGULAR_FILE_MODE = 0o644;

/**
 Worktree permission bits for an executable file.
 */
const EXECUTABLE_FILE_MODE = 0o755;

/**
 Owner-execute permission bit, which Git uses to decide the executable mode.
 */
const OWNER_EXECUTE_BIT = 0o100;

/**
 One path a policy added to a commit, recorded before real Git runs.
 */
export type AddedPathRecord = Readonly<{
  /**
   Repository-relative path.
   */
  path: string;
  /**
   Git mode shared by the original and intended blobs.
   */
  gitMode: typeof REGULAR_GIT_MODE | typeof EXECUTABLE_GIT_MODE;
  /**
   Blob at `HEAD`, in the real index, and in the worktree before the commit.
   */
  originalOid: GitObjectId;
  /**
   Blob the commit lands and the worktree receives.
   */
  intendedOid: GitObjectId;
}>;

/**
 Thrown when a policy targets a tracked path that cannot join the commit without discarding local changes.
 */
export class AddedPathPreconditionError extends Error {
  /**
   Creates an error naming the path, the reason, and the remedies.

   @param path - repository path the policy targeted

   @param reason - which state differs from `HEAD`
   */
  constructor({
    path,
    reason,
  }: Readonly<{
    path: string;
    reason: string;
  }>,) {
    super(`A policy fix needs to add ${path} to this commit, but ${reason}. Stage ${path} so the fix applies to the staged copy, or restore it to match HEAD (git restore --staged --worktree -- ${path}), then commit again.`,);
    this.name = 'AddedPathPreconditionError';
  }
}

/**
 Splits a tracked target ID into its object ID and path.

 @param targetId - opaque target ID from a policy patch

 @returns object ID and path, or nothing for a non-tracked target

 @example
 ```ts
 parseTrackedTargetId('tracked:abc:package.json');
 // => [{ oid: 'abc', path: 'package.json' }]
 ```
 */
export function parseTrackedTargetId(targetId: string,): readonly Readonly<{
  oid: GitObjectId;
  path: string;
}>[] {
  if (!targetId.startsWith(TRACKED_TARGET_PREFIX,))
    return [];
  /**
   Text after the prefix: object ID, colon, path.
   */
  const rest = targetId.slice(TRACKED_TARGET_PREFIX.length,);
  /**
   Separator between object ID and path; object IDs never contain a colon.
   */
  const separator = rest.indexOf(':',);
  return separator <= 0
    ? []
    : [{
      oid: rest.slice(
        0,
        separator,
      ),
      path: rest.slice(separator + 1,),
    },];
}

/**
 Verifies that a tracked path is unchanged in the real index, the private commit index, and the worktree.

 @param gitPath - resolved Git executable

 @param cwd - effective repository directory

 @param repositoryRoot - worktree root

 @param realIndexPath - original real index snapshot

 @param commitIndexPath - private commit index

 @param path - repository path

 @param oid - blob the policy patch was computed against

 @returns Git mode of the unchanged ordinary file

 @throws AddedPathPreconditionError when any copy differs from `HEAD`
 */
export async function assertAddablePath({
  gitPath,
  cwd,
  repositoryRoot,
  realIndexPath,
  commitIndexPath,
  path,
  oid,
}: Readonly<{
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  realIndexPath: string;
  commitIndexPath: string;
  path: string;
  oid: GitObjectId;
}>,): Promise<AddedPathRecord['gitMode']> {
  /**
   `HEAD`, real index, and private index records for the path.
   */
  const [headEntries, realEntries, commitEntries,] = await Promise.all([
    loadHeadTreeEntries({
      gitPath,
      cwd,
      paths: [path,],
    },),
    loadIndexEntries({
      gitPath,
      cwd,
      indexPath: realIndexPath,
      paths: [path,],
    },),
    loadIndexEntries({
      gitPath,
      cwd,
      indexPath: commitIndexPath,
      paths: [path,],
    },),
  ],);
  /**
   Baseline record.
   */
  const head = headEntries.get(path,);
  if ((head === undefined) || (head.oid !== oid)
    || ((head.modeText !== REGULAR_GIT_MODE) && (head.modeText !== EXECUTABLE_GIT_MODE)))
    throw new AddedPathPreconditionError({
      path,
      reason: 'HEAD does not hold it as the ordinary file the fix was computed against',
    },);
  for (const [label, entry,] of [
    ['it has staged changes', realEntries.get(path,),],
    ['this commit already changes it', commitEntries.get(path,),],
  ] as const) {
    if ((entry === undefined) || (entry.stage !== '0')
      || (entry.oid !== head.oid)
      || (entry.modeText !== head.modeText))
      throw new AddedPathPreconditionError({
        path,
        reason: label,
      },);
  }
  /**
   Worktree file metadata, without following symlinks.
   */
  const metadata = await lstat(join(
    repositoryRoot,
    path,
  ),);
  /**
   Whether the worktree executable bit matches the recorded mode.
   */
  const executableMatches = ((metadata.mode & OWNER_EXECUTE_BIT) !== 0) === (head.modeText === EXECUTABLE_GIT_MODE);
  /**
   `HEAD` blob bytes.
   */
  const headBytes = (await loadBlobBatch({
    gitPath,
    cwd,
    oids: [head.oid,],
    createError: function toGitError(message,) {
      return new CommitTransactionGitError(message,);
    },
  },)).get(head.oid,);
  if ((!metadata.isFile()) || (!executableMatches) || (headBytes === undefined)
    || (!Buffer.from(await readFile(join(
      repositoryRoot,
      path,
    ),),)
      .equals(headBytes,)))
    throw new AddedPathPreconditionError({
      path,
      reason: 'its worktree copy has unstaged changes',
    },);
  return head.modeText;
}

/**
 Writes one worktree file atomically through a same-directory temporary file.

 @param destination - absolute worktree path

 @param bytes - intended content

 @param gitMode - Git mode deciding permission bits
 */
async function replaceWorktreeFile({
  destination,
  bytes,
  gitMode,
}: Readonly<{
  destination: string;
  bytes: Uint8Array;
  gitMode: AddedPathRecord['gitMode'];
}>,): Promise<void> {
  /**
   Same-directory temporary path, so rename stays on one filesystem.
   */
  const prepared = join(
    dirname(destination,),
    `.cli-git-added-${randomUUID()}`,
  );
  try {
    await writeFile(
      prepared,
      bytes,
      {
        mode: gitMode === EXECUTABLE_GIT_MODE ? EXECUTABLE_FILE_MODE : REGULAR_FILE_MODE,
        flag: 'wx',
      },
    );
    await rename(
      prepared,
      destination,
    );
  }
  catch (error: unknown) {
    l.error(`added-path worktree install failed for ${destination}: ${String(error,)}`,);
    await rm(
      prepared,
      { force: true, },
    );
    throw error;
  }
}

/**
 Brings each added path's worktree copy to the landed content.

 A copy that already holds the intended bytes is left alone, which makes recovery idempotent.

 @param gitPath - resolved Git executable

 @param cwd - effective repository directory

 @param repositoryRoot - worktree root

 @param records - added paths recorded before real Git ran

 @param createConflictError - error factory for a copy holding neither original nor intended bytes

 @returns paths whose worktree copy was rewritten

 @throws the created conflict error when a worktree copy changed after the precondition check
 */
export async function installAddedWorktreeFiles({
  gitPath,
  cwd,
  repositoryRoot,
  records,
  createConflictError,
}: Readonly<{
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  records: readonly AddedPathRecord[];
  createConflictError: (message: string) => Error;
}>,): Promise<readonly string[]> {
  if (records.length === 0)
    return [];
  /**
   Original and intended blob bytes for every record.
   */
  const blobs = await loadBlobBatch({
    gitPath,
    cwd,
    oids: records.flatMap(function recordOids(record,) {
      return [
        record.originalOid,
        record.intendedOid,
      ];
    },),
    createError: function toGitError(message,) {
      return new CommitTransactionGitError(message,);
    },
  },);
  /**
   Paths rewritten so far.
   */
  const rewritten: string[] = [];
  for (const record of records) {
    /**
     Absolute worktree path.
     */
    const destination = join(
      repositoryRoot,
      record.path,
    );
    /**
     Current worktree bytes.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each path is compared and replaced before the next, so a conflict stops with earlier paths already complete.
    const current = Buffer.from(await readFile(destination,),);
    /**
     Landed content.
     */
    const intended = blobs.get(record.intendedOid,);
    /**
     Pre-commit content.
     */
    const original = blobs.get(record.originalOid,);
    if ((intended === undefined) || (original === undefined))
      throw new CommitTransactionGitError(`Git blob batch omitted an added-path object for ${record.path}.`,);
    if (current.equals(intended,))
      continue;
    if (!current.equals(original,))
      throw createConflictError(`Worktree copy of ${record.path} changed while cli-git committed a policy fix to it; the commit landed with the fix, so compare the file with HEAD and keep the version you want.`,);
    // oxlint-disable-next-line no-await-in-loop -- Replacement order follows record order for deterministic partial recovery.
    await replaceWorktreeFile({
      destination,
      bytes: intended,
      gitMode: record.gitMode,
    },);
    rewritten.push(record.path,);
  }
  return rewritten;
}
