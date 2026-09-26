/**
 Subsumption before replay's three-way merge.

 For every path both the prepared commit and the landed history changed since the preparation base,
 the prepared bytes already contain the landed change when that change applies in reverse to them
 (`git apply --reverse --check` semantics, emulated in `commit-replay-reverse-apply.ts`).
 Such a path takes the prepared entry as it is,
 matching what native sequential commits produce in a shared worktree;
 every other path merges from the preparation base as before.

 Replay realizes this with one `git merge-tree` call:
 the merge base becomes a synthetic commit whose tree is the preparation base
 with each subsumed path set to the landed content,
 so the merge sees no landed content change there and takes the prepared bytes,
 while a regular file keeps the base's mode so a mode change still merges three-way.

 Rules per shared path,
 with `base`, `landed`, and `prepared` entries:

 - `prepared` equals `landed` in mode and object, or both are absent:
   subsumed.
 - Any entry absent otherwise (an add, a delete, or a delete against a modify):
   not subsumed,
   because a reversed creation or deletion applies only to identical content.
 - Any entry that is not a regular file (a symbolic link or a submodule),
   or any of the three blobs binary:
   not subsumed.
 - Otherwise the landed text change is checked in reverse against the prepared bytes
   (`commit-replay-subsumption-text.ts`).

 Process count is fixed:
 two `diff-tree` runs;
 one `cat-file --batch`,
 two `mktree` runs,
 and one `diff-tree -p` when text candidates exist;
 and `read-tree`,
 `update-index`,
 `write-tree`,
 and `hash-object` when a path is subsumed.

 @module
 */
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import { decodeLatin1, } from './commit-replay-patch.ts';
import {
  ABSENT_ENTRY,
  isRegularTriple,
  isTextCandidate,
  listSharedPaths,
  type SharedPath,
  sameEntry,
} from './commit-replay-shared-paths.ts';
import { subsumedTextPaths, } from './commit-replay-subsumption-text.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Effective merge base of one replay.
 */
export type SubsumptionBase = Readonly<{
  /**
   Commit to pass as `--merge-base`.
   */
  mergeBase: string;
  /**
   Paths whose prepared entries replay as they are, in Git order.
   */
  subsumedPaths: readonly string[];
}>;

/**
 One `update-index --index-info` record setting a subsumed path to its landed content.
 A regular file keeps the base's mode, so a mode change still merges three-way;
 a path the landed side deleted is removed with mode `0`.

 @param shared - subsumed path

 @returns NUL-terminated record
 */
function baseRecord(shared: SharedPath,): string {
  if (shared.landed === ABSENT_ENTRY)
    return `0 ${'0'.repeat(shared.base === ABSENT_ENTRY ? 0 : shared.base
      .oid
      .length,)}\t${shared.path}\0`;
  /**
   Mode of the synthetic base entry.
   */
  const mode = isRegularTriple(shared,) && (shared.base !== ABSENT_ENTRY) ? shared.base
    .mode : shared.landed
      .mode;
  return `${mode} ${shared.landed
    .oid}\t${shared.path}\0`;
}

/**
 Writes the synthetic merge base: the preparation base with each subsumed path set to its landed content.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param directory - transaction directory receiving the private index

 @param replay - replay number naming the private index

 @param mergeBase - preparation base commit

 @param subsumed - subsumed paths

 @returns synthetic commit
 */
async function writeSubsumedBase({
  gitPath,
  shadowPath,
  directory,
  replay,
  mergeBase,
  subsumed,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  directory: string;
  replay: number;
  mergeBase: string;
  subsumed: readonly SharedPath[];
}>,): Promise<string> {
  /**
   Private index the base tree is edited in.
   */
  const environment = { GIT_INDEX_FILE: join(
    directory,
    `replay-base-${String(replay,)}.index`,
  ), };
  await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'read-tree',
      mergeBase,
    ],
    environment,
  },);
  await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'update-index',
      '-z',
      '--index-info',
    ],
    environment,
    input: Buffer.from(
      subsumed.map(baseRecord,)
        .join('',),
      'latin1',
    ),
  },);
  /**
   Base tree with the landed content at every subsumed path.
   */
  const tree = decodeLatin1((await runShadowGit({
    gitPath,
    shadowPath,
    args: ['write-tree',],
    environment,
  },)).stdout,)
    .trim();
  return decodeLatin1((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'hash-object',
      '-t',
      'commit',
      '-w',
      '--stdin',
    ],
    input: new TextEncoder().encode(`tree ${tree}\nauthor cli-git <cli-git@localhost> 0 +0000\ncommitter cli-git <cli-git@localhost> 0 +0000\n\ncli-git replay base with subsumed landed changes\n`,),
  },)).stdout,)
    .trim();
}

/**
 Computes the merge base replay uses:
 the preparation base,
 or a synthetic base under which every path whose prepared bytes contain the landed change takes the prepared entry.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param objectDirectory - shadow object store

 @param cwd - owning worktree directory

 @param directory - transaction directory

 @param replay - replay number

 @param mergeBase - preparation base commit, see `replayMergeBase`

 @param current - target that won

 @param prepared - prepared commit

 @returns effective merge base and the subsumed paths

 @throws {@link CommitTransactionGitError} when a Git command fails

 @example
 ```ts
 await subsumeLandedChanges({ gitPath: '/usr/bin/git', shadowPath, objectDirectory, cwd: '/repo', directory, replay: 1, mergeBase, current, prepared });
 ```
 */
export async function subsumeLandedChanges({
  gitPath,
  shadowPath,
  objectDirectory,
  cwd,
  directory,
  replay,
  mergeBase,
  current,
  prepared,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  objectDirectory: string;
  cwd: string;
  directory: string;
  replay: number;
  mergeBase: string;
  current: string;
  prepared: string;
}>,): Promise<SubsumptionBase> {
  /**
   Tagged subsumption logger.
   */
  const rl = tagged({
    tag: subsumeLandedChanges.name,
    l,
  },);
  /**
   Paths both sides changed.
   */
  const shared = await listSharedPaths({
    gitPath,
    shadowPath,
    mergeBase,
    current,
    prepared,
  },);
  /**
   Paths whose prepared entry equals the landed one.
   */
  const identical: ReadonlySet<SharedPath> = new Set(shared.filter(function same(entry,): boolean {
    return sameEntry({
      left: entry.prepared,
      right: entry.landed,
    },);
  },),);
  /**
   Paths the text check subsumes.
   */
  const text: ReadonlySet<SharedPath> = new Set(await subsumedTextPaths({
    gitPath,
    shadowPath,
    cwd,
    objectDirectory,
    candidates: shared.filter(function needsText(entry,): boolean {
      return isTextCandidate(entry,) && (!identical.has(entry,));
    },),
  },),);
  /**
   Every subsumed path in Git order.
   */
  const subsumed = shared.filter(function isSubsumed(entry,): boolean {
    return identical.has(entry,) || text.has(entry,);
  },);
  rl.debug(`${String(shared.length,)} paths changed on both sides; ${String(subsumed.length,)} already contain the landed change`,);
  if (subsumed.length === 0)
    return {
      mergeBase,
      subsumedPaths: [],
    };
  return {
    mergeBase: await writeSubsumedBase({
      gitPath,
      shadowPath,
      directory,
      replay,
      mergeBase,
      subsumed,
    },),
    subsumedPaths: subsumed.map(function pathOf(entry,): string {
      return entry.path;
    },),
  };
}
