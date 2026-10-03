/**
 Tracked paths a policy adds to a commit, and their worktree completion after the commit lands.

 A policy patch that targets a tracked file outside the candidate set adds that path.
 The path must be unchanged everywhere (real index, private commit index, and worktree all hold its `HEAD` blob),
 so rewriting its worktree copy after the commit lands discards nothing.

 @module
 */
import { Buffer, } from 'node:buffer';
import type { Stats, } from 'node:fs';
import {
  lstat,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { GitObjectId, } from '../api/policy-types.ts';
import { loadBlobBatch, } from './blob-batch.ts';
import {
  loadHeadTreeEntries,
  loadIndexEntries,
} from './commit-transaction-candidate-batch.ts';
import { CommitTransactionGitError, } from './commit-transaction-git.ts';
import { TRACKED_TARGET_PREFIX, } from './commit-transaction-tracked-files.ts';
import { inspectWorktreeFile, } from './commit-transaction-worktree-check.ts';
import { replaceWorktreeFile, } from './commit-transaction-worktree-replace.ts';

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
 Owner-execute permission bit, which Git uses to decide the executable mode.
 */
const OWNER_EXECUTE_BIT = 0o100;

/**
 Creates the transaction-domain error for failed or malformed Git blob output.

 @param message - safe failure explanation

 @returns private-state failure
 */
function addedPathGitError(message: string,): Error {
  return new CommitTransactionGitError(message,);
}

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
 Lifecycle adding a tracked path: a commit transaction, or `git cli-git fix` rewriting worktree files only.
 */
export type AddedPathLifecycle = 'commit' | 'direct-fix';

/**
 Diagnostic builders per lifecycle, so each names the remedy that lifecycle accepts.
 */
const ADDED_PATH_MESSAGES: Readonly<Record<AddedPathLifecycle, (details: Readonly<{
  path: string;
  reason: string;
}>) => string>> = {
  'commit': function commitMessage({
    path,
    reason,
  },) {
    return `A policy fix needs to add ${path} to this commit, but ${reason}. Stage ${path} so the fix applies to the staged copy, or restore it to match HEAD (git restore --staged --worktree -- ${path}), then commit again.`;
  },
  'direct-fix': function directFixMessage({
    path,
    reason,
  },) {
    return `A policy fix needs to change ${path}, which this fix did not select, but ${reason}. Include ${path} in the fix pathspecs so the fix applies to its worktree copy, or restore it to match HEAD (git restore --staged --worktree -- ${path}), then run the fix again.`;
  },
};

/**
 Thrown when a policy targets a tracked path that cannot join the candidate set without discarding local changes.
 */
export class AddedPathPreconditionError extends Error {
  /**
   Creates an error naming the path, the reason, and the remedies for the lifecycle.

   @param path - repository path the policy targeted

   @param reason - which state differs from `HEAD`

   @param lifecycle - operation adding the path, which decides the remedy text
   */
  constructor({
    path,
    reason,
    lifecycle,
  }: Readonly<{
    path: string;
    reason: string;
    lifecycle: AddedPathLifecycle;
  }>,) {
    super(ADDED_PATH_MESSAGES[lifecycle]({
      path,
      reason,
    },),);
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
 Reads worktree metadata for a path a policy wants to add, without following symlinks.
 
 @param repositoryRoot - worktree root
 
 @param path - repository path
 
 @param lifecycle - operation adding the path, which decides the remedy text
 
 @returns file metadata
 
 @throws AddedPathPreconditionError when the worktree copy is missing
 */
async function worktreeMetadata({
  repositoryRoot,
  path,
  lifecycle,
}: Readonly<{
  repositoryRoot: string;
  path: string;
  lifecycle: AddedPathLifecycle;
}>,): Promise<Stats> {
  try {
    return await lstat(join(
      repositoryRoot,
      path,
    ),);
  }
  catch (error: unknown) {
    l.debug(`added-path worktree lstat failed for ${path}: ${String(error,)}`,);
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      throw new AddedPathPreconditionError({
        path,
        reason: 'its worktree copy is missing',
        lifecycle,
      },);
    throw error;
  }
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

 @param lifecycle - operation adding the path, which decides the remedy text

 @param baseRevision - baseline commit the path must match; live `HEAD` when absent

 @returns Git mode of the unchanged ordinary file

 @throws AddedPathPreconditionError when any copy differs from `HEAD`

 @example
 ```ts
 await assertAddablePath({ gitPath: '/usr/bin/git', cwd: '/repo', repositoryRoot: '/repo', realIndexPath: '/tmp/original.index', commitIndexPath: '/tmp/commit.index', path: 'package.json', oid: 'abc', lifecycle: 'commit' });
 // => '100644'
 ```
 */
export async function assertAddablePath({
  gitPath,
  cwd,
  repositoryRoot,
  realIndexPath,
  commitIndexPath,
  path,
  oid,
  lifecycle,
  baseRevision = 'HEAD',
}: Readonly<{
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  realIndexPath: string;
  commitIndexPath: string;
  path: string;
  oid: GitObjectId;
  lifecycle: AddedPathLifecycle;
  baseRevision?: string;
}>,): Promise<AddedPathRecord['gitMode']> {
  /**
   `HEAD`, real index, and private index records for the path.
   */
  const [headEntries, realEntries, commitEntries,] = await Promise.all([
    loadHeadTreeEntries({
      gitPath,
      cwd,
      paths: [path,],
      revision: baseRevision,
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
      lifecycle,
    },);
  for (const [label, entry,] of [
    [
      'it has staged changes',
      realEntries.get(path,),
    ],
    [
      'this commit already changes it',
      commitEntries.get(path,),
    ],
  ] as const) {
    if ((entry === undefined) || (entry.stage !== '0')
      || (entry.oid !== head.oid)
      || (entry.modeText !== head.modeText))
      throw new AddedPathPreconditionError({
        path,
        reason: label,
        lifecycle,
      },);
  }
  /**
   Worktree file metadata, without following symlinks.
   */
  const metadata = await worktreeMetadata({
    repositoryRoot,
    path,
    lifecycle,
  },);
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
    createError: addedPathGitError,
  },)).get(head.oid,);
  if ((!metadata.isFile()) || (!executableMatches)
    || (headBytes === undefined)
    || (!Buffer.from(
      await readFile(join(
      repositoryRoot,
      path,
    ),),
    )
      .equals(headBytes,)))
    throw new AddedPathPreconditionError({
      path,
      reason: 'its worktree copy has unstaged changes',
      lifecycle,
    },);
  return head.modeText === EXECUTABLE_GIT_MODE ? EXECUTABLE_GIT_MODE : REGULAR_GIT_MODE;
}

/**
 Worktree completion outcome for added paths.
 */
export type AddedWorktreeInstallResult = Readonly<{
  /**
   Paths whose worktree copy now holds the landed bytes because this call wrote them.
   */
  rewritten: readonly string[];
  /**
   Paths left untouched because their worktree copy changed after the precondition check.
   */
  conflicted: readonly string[];
}>;

/**
 Brings each added path's worktree copy to the landed content.

 A copy that already holds the intended bytes is left alone, which makes recovery idempotent.
 A copy holding neither the original nor the intended bytes was edited while the commit ran;
 it is kept and reported, because the commit has already landed and overwriting would lose that edit.

 @param gitPath - resolved Git executable

 @param cwd - effective repository directory

 @param repositoryRoot - worktree root

 @param records - added paths recorded before real Git ran

 @param objectDirectory - store holding blobs that never landed, such as a pre-correction original in the transaction's shadow store; the real store when absent

 @returns rewritten and conflicted paths

 @throws CommitTransactionGitError when Git cannot supply a recorded blob

 @example
 ```ts
 await installAddedWorktreeFiles({ gitPath: '/usr/bin/git', cwd: '/repo', repositoryRoot: '/repo', records: [] });
 // => { rewritten: [], conflicted: [] }
 ```
 */
export async function installAddedWorktreeFiles({
  gitPath,
  cwd,
  repositoryRoot,
  records,
  objectDirectory,
}: Readonly<{
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  records: readonly AddedPathRecord[];
  objectDirectory?: string;
}>,): Promise<AddedWorktreeInstallResult> {
  if (records.length === 0)
    return {
      rewritten: [],
      conflicted: [],
    };
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
    createError: addedPathGitError,
    ...(objectDirectory === undefined ? {} : { objectDirectory, }),
  },);
  /**
   Paths rewritten so far.
   */
  const rewritten: string[] = [];
  /**
   Paths kept because they changed concurrently.
   */
  const conflicted: string[] = [];
  for (const record of records) {
    /**
     Absolute worktree path.
     */
    const destination = join(
      repositoryRoot,
      record.path,
    );
    /**
     Landed content.
     */
    const intended = blobs.get(record.intendedOid,);
    /**
     Pre-commit content.
     */
    const original = blobs.get(record.originalOid,);
    if ((intended === undefined) || (original === undefined))
      throw new CommitTransactionGitError(`Git blob batch omitted a worktree completion object for ${record.path}.`,);
    /**
     Descriptor-bound current worktree state, including deletion as a conflict.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each path is checked immediately before its own replacement.
    const current = await inspectWorktreeFile({
      destination,
      gitMode: record.gitMode,
      original,
      intended,
    },);
    if (current.kind === 'intended')
      continue;
    if (current.kind === 'conflict') {
      l.warn(`Worktree copy of ${record.path} changed or disappeared while cli-git completed the commit; the committed bytes remain in HEAD and your worktree state was kept. Compare it with HEAD (git diff HEAD -- ${record.path}).`,);
      conflicted.push(record.path,);
      continue;
    }
    /**
     Installation outcome after final descriptor-bound revalidation.
     */
    // oxlint-disable-next-line no-await-in-loop -- Replacement order follows record order for deterministic partial recovery.
    const installed = await replaceWorktreeFile({
      destination,
      bytes: intended,
      mode: current.identity
        .mode,
      gitMode: record.gitMode,
      original,
      identity: current.identity,
    },);
    if (!installed) {
      l.warn(`Worktree copy of ${record.path} changed while its replacement was prepared; the committed bytes remain in HEAD and your edit was kept. Compare it with HEAD (git diff HEAD -- ${record.path}).`,);
      conflicted.push(record.path,);
      continue;
    }
    rewritten.push(record.path,);
  }
  return {
    rewritten,
    conflicted,
  };
}
