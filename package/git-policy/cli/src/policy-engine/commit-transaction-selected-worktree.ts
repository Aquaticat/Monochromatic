//region Selected-path worktree reconciliation
/**
 Worktree completion records for selected final-newline corrections.

 @module
 */
import { Buffer, } from 'node:buffer';
import {
  lstat,
  readFile,
  realpath,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import type { CandidateFile, } from '../api/policy-types.ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import { loadIndexEntries, } from './commit-transaction-candidate-batch.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';

/**
 Git executable mode bit in worktree metadata.
 */
const EXECUTE_BIT = 0o100;
/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Resolves actual Git worktree root for selected path reconciliation.

 @param gitPath - real Git executable

 @param cwd - effective Git directory

 @returns canonical worktree root

 @example
 ```ts
 await selectedWorktreeRoot({ gitPath: '/usr/bin/git', cwd: '/repo' });
 ```
 */
export async function selectedWorktreeRoot({
  gitPath,
  cwd,
}: Readonly<{
  gitPath: string;
  cwd: string;
}>,): Promise<string> {
  /**
   Root reported by real Git for current effective directory.
   */
  const result = await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-parse',
      '--show-toplevel',
    ],
  },);
  return realpath(DECODER.decode(result.stdout,)
    .trim(),);
}

/**
 Records selected final-newline files only when original staged bytes and
 ordinary worktree bytes match exactly. Partially staged edits cannot be
 replaced by a commit correction. Installer rechecks before replacement.

 @param gitPath - real Git executable

 @param cwd - effective Git directory

 @param repositoryRoot - canonical worktree root

 @param indexPath - settled private commit index

 @param initialCandidates - candidates before any correction

 @param newlinePaths - paths actually corrected by final-newline policy

 @returns original and intended blob identities eligible for completion

 @example
 ```ts
 await selectedWorktreeRecords({ gitPath, cwd, repositoryRoot, indexPath, initialCandidates: [], newlinePaths: new Set() });
 ```
 */
export async function selectedWorktreeRecords({
  gitPath,
  cwd,
  repositoryRoot,
  indexPath,
  initialCandidates,
  newlinePaths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  repositoryRoot: string;
  indexPath: string;
  initialCandidates: readonly CandidateFile[];
  newlinePaths: ReadonlySet<string>;
}>,): Promise<readonly AddedPathRecord[]> {
  /**
   Initial ordinary candidates actually fixed by core final-newline.
   */
  const selected = initialCandidates.filter(function selectedOrdinary(candidate,) {
    return newlinePaths.has(candidate.path,)
      && ((candidate.mode === 'regular') || (candidate.mode === 'executable'))
      && ((typeof candidate.revision) === 'string');
  },);
  /**
   Settled private-index entries for selected paths.
   */
  const settled = await loadIndexEntries({
    gitPath,
    cwd,
    indexPath,
    paths: selected.map(function selectedPath(candidate,) {
      return candidate.path;
    },),
  },);
  /**
   Worktree copies eligible for post-commit reconciliation.
   */
  const records: AddedPathRecord[] = [];
  /* oxlint-disable no-await-in-loop -- Each file needs an independent exact-byte and no-follow worktree check. */
  for (const candidate of selected) {
    if ((typeof candidate.revision) !== 'string')
      continue;
    /**
     Settled Git entry for selected candidate.
     */
    const entry = settled.get(candidate.path,);
    /**
     Git mode for original candidate.
     */
    const gitMode = candidate.mode === 'executable' ? '100755' : '100644';
    if ((entry === undefined) || (entry.modeText !== gitMode)
      || (entry.oid === candidate.revision))
      continue;
    /**
     Exact selected worktree path.
     */
    const destination = join(
      repositoryRoot,
      candidate.path,
    );
    try {
      if ((await realpath(dirname(destination,))) !== dirname(destination,))
        continue;
      /**
       No-follow selected file metadata.
       */
      const metadata = await lstat(destination,);
      if ((!metadata.isFile()) || (metadata.nlink !== 1)
        || (((metadata.mode & EXECUTE_BIT) !== 0) !== (gitMode === '100755')))
        continue;
      /**
       Exact original staged content for partial-staging comparison.
       */
      const original = Buffer.from(await candidate.bytes(),);
      if (!original.equals(await readFile(destination,)))
        continue;
    }
    catch (error: unknown) {
      if (Error.isError(error,)
        && ('code' in error)
        && (error.code === 'ENOENT'))
        continue;
      throw error;
    }
    records.push({
      path: candidate.path,
      gitMode,
      originalOid: candidate.revision,
      intendedOid: entry.oid,
    },);
  }
  /* oxlint-enable no-await-in-loop */
  return records;
}
//endregion Selected-path worktree reconciliation
