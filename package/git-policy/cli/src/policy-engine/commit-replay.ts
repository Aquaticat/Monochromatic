/**
 Replay of a prepared commit onto a moved target, run in the shadow repository outside both landing locks.

 The tree comes from `git merge-tree --write-tree --merge-base`;
 an unsigned commit is rebuilt by rewriting its raw object,
 and a signed one through `git commit-tree -S` under its original identities and dates.
 Every object replay writes stays in the shadow store until the next landing migrates it.

 @module
 */
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { writePrivateFile, } from '../trust/registry-io.ts';
import type { PreparationBase, } from './commit-transaction-capture.ts';
import {
  CommitTransactionGitError,
  runTransactionGit,
} from './commit-transaction-git.ts';
import {
  droppedReplayHeaders,
  identityEnvironment,
  type RawCommit,
  rewriteCommitObject,
} from './commit-replay-object.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 UTF-8 encoder for synthesized objects.
 */
const ENCODER = new TextEncoder();

/**
 `git merge-tree` exit status reporting conflicts; a tree ID still prints.
 */
const MERGE_CONFLICT_EXIT = 1;

/**
 Keeps pathspec magic active, so `:(top,literal)` names concrete paths even when the caller disabled magic.
 */
const MAGIC_PATHSPECS = { GIT_LITERAL_PATHSPECS: '0', } as const;

/**
 Outcome of merging the prepared change onto the current target.
 */
export type ReplayMerge =
  | Readonly<{
    /**
     The change applies cleanly.
     */
    kind: 'merged';
    /**
     Merged tree, in the shadow store.
     */
    treeOid: string;
  }>
  | Readonly<{
    /**
     The change conflicts with the target.
     */
    kind: 'conflict';
    /**
     Conflicting paths in Git path byte order.
     */
    paths: readonly string[];
  }>;

/**
 Commit to use as `--merge-base`:
 the preparation base,
 or for an unborn base a root commit of the empty tree,
 because Git 2.40 accepts only a commit there.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param base - preparation base

 @param emptyTreeOid - empty tree of the repository's object format

 @returns merge-base commit

 @example
 ```ts
 await replayMergeBase({ gitPath: '/usr/bin/git', shadowPath, base, emptyTreeOid });
 ```
 */
export async function replayMergeBase({
  gitPath,
  shadowPath,
  base,
  emptyTreeOid,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  base: PreparationBase;
  emptyTreeOid: string;
}>,): Promise<string> {
  if (base.kind === 'commit')
    return base.oid;
  return DECODER.decode((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'hash-object',
      '-t',
      'commit',
      '-w',
      '--stdin',
    ],
    input: ENCODER.encode(`tree ${emptyTreeOid}\nauthor cli-git <cli-git@localhost> 0 +0000\ncommitter cli-git <cli-git@localhost> 0 +0000\n\ncli-git replay base for an unborn branch\n`,),
  },)).stdout,)
    .trim();
}

/**
 Sorts paths in Git path byte order.

 @param paths - paths

 @returns sorted copy
 */
function byteOrdered(paths: readonly string[],): readonly string[] {
  return paths.toSorted(function byteOrder(
    left,
    right,
  ): number {
    return Buffer.compare(
      Buffer.from(
        left,
        'utf8',
      ),
      Buffer.from(
        right,
        'utf8',
      ),
    );
  },);
}

/**
 Merges the prepared change onto the current target in the shadow.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param mergeBase - preparation base commit, see {@link replayMergeBase}

 @param current - current target commit

 @param prepared - prepared commit

 @param worktreeRoot - worktree root, where Git reports conflicted paths from the repository root

 @returns merged tree or conflicting paths

 @throws {@link CommitTransactionGitError} when `git merge-tree` fails for another reason than conflicts, such as a Git without `--merge-base`

 @example
 ```ts
 await mergeReplayTree({ gitPath: '/usr/bin/git', shadowPath, mergeBase, current, prepared });
 ```
 */
export async function mergeReplayTree({
  gitPath,
  shadowPath,
  mergeBase,
  current,
  prepared,
  worktreeRoot,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  mergeBase: string;
  current: string;
  prepared: string;
  worktreeRoot: string;
}>,): Promise<ReplayMerge> {
  /**
   Tagged merge logger.
   */
  const rl = tagged({
    tag: mergeReplayTree.name,
    l,
  },);
  /**
   Merge outcome: `<tree>NUL`, then on conflict each conflicted path NUL-terminated, an empty record, and messages.
   */
  const result = await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'merge-tree',
      '--write-tree',
      '--name-only',
      '-z',
      `--merge-base=${mergeBase}`,
      current,
      prepared,
    ],
    allowFailure: true,
    cwd: worktreeRoot,
  },);
  if ((result.exitCode !== 0) && (result.exitCode !== MERGE_CONFLICT_EXIT))
    throw new CommitTransactionGitError(`git merge-tree could not replay ${prepared} onto ${current} (exit ${String(result.exitCode,)}): ${result.stderr
      .trim()}`,);
  /**
   NUL-separated records.
   */
  const [treeOid = '', ...rest] = DECODER.decode(result.stdout,)
    .split('\0',);
  if (result.exitCode === 0) {
    rl.debug(`replayed ${prepared} onto ${current} as tree ${treeOid}`,);
    return {
      kind: 'merged',
      treeOid,
    };
  }
  /**
   Conflicted paths before the empty record that opens the messages.
   */
  const end = rest.indexOf('',);
  /**
   Unique conflicted paths.
   */
  const paths = byteOrdered([
    ...new Set(end === (-1) ? rest : rest.slice(
      0,
      end,
    ),),
  ],);
  rl.debug(`replay of ${prepared} onto ${current} conflicts in ${paths.join(', ',)}`,);
  return {
    kind: 'conflict',
    paths,
  };
}

/**
 Earliest commit after the preparation base that touches any of the paths, the commit a conflict lost to.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param base - preparation base

 @param current - current target

 @param paths - conflicting paths

 @returns winning commit, the current target when no commit touches the paths

 @example
 ```ts
 await firstCommitTouching({ gitPath: '/usr/bin/git', cwd: '/repo', base, current, paths: ['a.txt'] });
 ```
 */
export async function firstCommitTouching({
  gitPath,
  cwd,
  base,
  current,
  paths,
}: Readonly<{
  gitPath: string;
  cwd: string;
  base: PreparationBase;
  current: string;
  paths: readonly string[];
}>,): Promise<string> {
  /**
   Commits after the base touching the paths, oldest first.
   */
  const listed = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'rev-list',
      '--reverse',
      current,
      ...(base.kind === 'commit' ? [`^${base.oid}`,] : []),
      '--',
      ...paths.map(function fromRoot(path,): string {
        return `:(top,literal)${path}`;
      },),
    ],
    environment: MAGIC_PATHSPECS,
  },)).stdout,)
    .split('\n',)
    .find(function nonempty(line,): boolean {
      return line.length > 0;
    },);
  return listed ?? current;
}

/**
 A replayed commit written to the shadow store.
 */
export type ReplayedCommit = Readonly<{
  /**
   Replayed commit.
   */
  oid: string;
  /**
   Custom headers a signed rebuild dropped, empty for an unsigned rewrite.
   */
  droppedHeaders: readonly string[];
}>;

/**
 Writes the prepared commit onto a new tree and parent in the shadow store.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param directory - transaction directory receiving the message file of a signed rebuild

 @param attempt - landing attempt number naming the message file

 @param commit - parsed prepared commit

 @param treeOid - new tree

 @param parentOid - new parent

 @param signingKey - key ID the invocation passed to `-S`; absent signs with the configured key

 @param globalArgs - caller's kept global options, which may configure signing

 @returns replayed commit

 @example
 ```ts
 await writeReplayedCommit({ gitPath: '/usr/bin/git', shadowPath, directory, attempt: 1, commit, treeOid, parentOid, globalArgs: [] });
 ```
 */
export async function writeReplayedCommit({
  gitPath,
  shadowPath,
  directory,
  attempt,
  commit,
  treeOid,
  parentOid,
  signingKey,
  globalArgs,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  directory: string;
  attempt: number;
  commit: RawCommit;
  treeOid: string;
  parentOid: string;
  signingKey?: string;
  globalArgs: readonly string[];
}>,): Promise<ReplayedCommit> {
  if (!commit.signed)
    return {
      oid: DECODER.decode((await runShadowGit({
        gitPath,
        shadowPath,
        args: [
          'hash-object',
          '-t',
          'commit',
          '-w',
          '--stdin',
        ],
        input: rewriteCommitObject({
          commit,
          treeOid,
          parentOid,
        },),
      },)).stdout,)
        .trim(),
      droppedHeaders: [],
    };
  /**
   Exact message bytes for `-F`.
   */
  const messagePath = join(
    directory,
    `replay-message-${String(attempt,)}`,
  );
  await writePrivateFile({
    path: messagePath,
    bytes: commit.message,
  },);
  /**
   Re-signed commit under the prepared commit's identities and dates.
   */
  const signed = await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      ...globalArgs,
      '-c',
      `i18n.commitEncoding=${commit.encoding ?? 'utf8'}`,
      'commit-tree',
      treeOid,
      '-p',
      parentOid,
      `-S${signingKey ?? ''}`,
      '-F',
      messagePath,
    ],
    environment: {
      ...identityEnvironment({
        commit,
        role: 'author',
      },),
      ...identityEnvironment({
        commit,
        role: 'committer',
      },),
    },
  },);
  return {
    oid: DECODER.decode(signed.stdout,)
      .trim(),
    droppedHeaders: droppedReplayHeaders(commit,),
  };
}
