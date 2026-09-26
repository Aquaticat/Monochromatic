/**
 Concrete path listings of a private index.

 @module
 */
import { runTransactionGit, } from './commit-transaction-git.ts';

/**
 Strict Git metadata decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Returns unmerged paths from private index.
 
 @param gitPath - resolved Git executable
 
 @param cwd - repository directory
 
 @param indexPath - private index
 
 @returns unique unmerged repository paths
 
 @example
 ```ts
 await listUnmergedIndexPaths({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index' });
 ```
 */
export async function listUnmergedIndexPaths({
  gitPath,
  cwd,
  indexPath,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
}>,): Promise<readonly string[]> {
  /**
   NUL-delimited unmerged stage records.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '--unmerged',
      '-z',
    ],
  },);
  /**
   Repository paths deduplicated across conflict stages.
   */
  const paths = DECODER.decode(output.stdout,)
    .split('\0',)
    .flatMap(function recordPath(record,) {
      /**
       Metadata/path separator.
       */
      const tab = record.indexOf('\t',);
      return tab === (-1) ? [] : [record.slice(tab + 1,),];
    },);
  return [...new Set(paths,),];
}

/**
 Returns concrete paths from private index through Git pathspec semantics.
 
 @param gitPath - resolved Git executable
 
 @param cwd - effective repository cwd
 
 @param indexPath - private index path
 
 @param pathspecs - Git pathspec scope
 
 @returns ordered concrete repository paths
 
 @example
 ```ts
 await listPrivateIndexPaths({ gitPath, cwd, indexPath, pathspecs: [':/'] });
 ```
 */
export async function listPrivateIndexPaths({
  gitPath,
  cwd,
  indexPath,
  pathspecs,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  pathspecs: readonly string[];
}>,): Promise<readonly string[]> {
  /**
   NUL-delimited private-index path output.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'ls-files',
      '-z',
      '--',
      ...pathspecs,
    ],
  },);
  return DECODER.decode(output.stdout,)
    .split('\0',)
    .filter(function nonempty(path,) {
    return path.length > 0;
  },);
}

/**
 Returns staged paths from private index relative to the preparation base.
 
 @param gitPath - resolved Git executable
 
 @param cwd - repository directory
 
 @param indexPath - private index
 
 @param baseRevision - recorded base commit, or the empty tree for an unborn base
 
 @returns repository paths
 
 @example
 ```ts
 await listChangedIndexPaths({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', baseRevision });
 ```
 */
export async function listChangedIndexPaths({
  gitPath,
  cwd,
  indexPath,
  baseRevision,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  baseRevision: string;
}>,): Promise<readonly string[]> {
  /**
   NUL-delimited changed paths against the recorded base, never live `HEAD`.
   */
  const output = await runTransactionGit({
    gitPath,
    cwd,
    indexPath,
    args: [
      'diff',
      '--cached',
      '--name-only',
      '-z',
      baseRevision,
    ],
  },);
  return DECODER.decode(output.stdout,)
    .split('\0',)
    .filter(function nonempty(path,) {
    return path.length > 0;
  },);
}
