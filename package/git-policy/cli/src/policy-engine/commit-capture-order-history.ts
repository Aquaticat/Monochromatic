/**
 First-parent history a replay moves over:
 each commit landed since the preparation base with the paths it changed.

 Two processes,
 whatever the history length:
 `git rev-list --first-parent <current> ^<base>` lists the commits,
 and one `git diff-tree --stdin` prints each commit's raw changes against its first parent
 (a root commit against the empty tree).
 Commits that change nothing are left out.
 Paths are Latin-1 decoded,
 as replay's shared-path listing decodes them.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { decodeLatin1, } from './commit-replay-patch.ts';
import type { PreparationBase, } from './commit-transaction-capture.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 One landed commit and the paths it changed against its first parent.
 */
export type LandedChange = Readonly<{
  /**
   Commit ID.
   */
  commit: string;
  /**
   Changed paths, Latin-1 decoded.
   */
  paths: ReadonlySet<string>;
}>;

/**
 Parses `git diff-tree --stdin -r -z --raw` output:
 each commit ID NUL-terminated,
 then its raw records,
 each a `:`-prefixed header and a path,
 both NUL-terminated.

 @param output - Latin-1 decoded output

 @returns changes in output order

 @example
 ```ts
 parseCommitChanges('abc\0:100644 100644 1 2 M\0a.txt\0'); // [{ commit: 'abc', paths: Set(['a.txt']) }]
 ```
 */
export function parseCommitChanges(output: string,): readonly LandedChange[] {
  /**
   NUL-separated tokens.
   */
  const tokens = output.split('\0',);
  /**
   Commits with their mutable path sets, built in one pass.
   */
  const commits: {
    commit: string;
    paths: Set<string>;
  }[] = [];
  /**
   Index of the next unread token.
   */
  const cursor = { next: 0, };
  while (cursor.next < tokens.length) {
    /**
     Current token.
     */
    const token = tokens[cursor.next] ?? '';
    cursor.next += 1;
    if (token.startsWith(':',)) {
      /**
       Path following the header.
       */
      const path = tokens[cursor.next];
      cursor.next += 1;
      /**
       Commit the record belongs to.
       */
      const owner = commits.at(-1,);
      if ((path === undefined) || (owner === undefined))
        throw new TypeError('git diff-tree printed a raw record without a commit or a path.',);
      owner.paths
        .add(path,);
    }
    else if (token !== '')
      commits.push({
        commit: token,
        paths: new Set(),
      },);
  }
  return commits;
}

/**
 Lists the commits landed since the preparation base on the first-parent line, oldest last,
 with the paths each changed.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository, whose alternates reach the real objects

 @param base - preparation base; an unborn base lists every commit of `current`

 @param current - target that won

 @returns landed changes

 @throws {@link CommitTransactionGitError} when Git fails

 @example
 ```ts
 await listLandedChanges({ gitPath: '/usr/bin/git', shadowPath, base, current });
 ```
 */
export async function listLandedChanges({
  gitPath,
  shadowPath,
  base,
  current,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  base: PreparationBase;
  current: string;
}>,): Promise<readonly LandedChange[]> {
  /**
   Commits since the base, newest first.
   */
  const commits = (await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'rev-list',
      '--first-parent',
      current,
      ...(base.kind === 'commit' ? [`^${base.oid}`,] : []),
      '--',
    ],
  },)).stdout;
  if (commits.length === 0)
    return [];
  /**
   Each commit's raw changes against its first parent.
   */
  const changes = parseCommitChanges(decodeLatin1((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'diff-tree',
      '--stdin',
      '--root',
      '-r',
      '-z',
      '--raw',
      '--no-renames',
      '--no-abbrev',
      '-m',
      '--first-parent',
    ],
    input: commits,
  },)).stdout,),);
  l.debug(`${String(changes.length,)} commits changed paths between the base and ${current}`,);
  return changes;
}
