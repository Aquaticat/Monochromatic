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

 Capture order decides first
 (`commit-capture-order-decision.ts`):
 a path the prepared commit and every landed commit that changed it captured from this worktree
 takes the later capture's entry exactly,
 mode included,
 by setting the synthetic base entry to the other side's entry;
 only the remaining paths go through the subsumption rules.

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
  sidesOf,
} from './commit-replay-shared-paths.ts';
import { subsumedTextPaths, } from './commit-replay-subsumption-text.ts';
import type { CaptureOrderDecision, } from './commit-capture-order-decision.ts';

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
   Paths whose prepared entries replay as they are, in Git order:
   subsumed ones and those the prepared commit captured later.
   */
  subsumedPaths: readonly string[];
  /**
   Paths whose landed entries stay because a landed commit captured them later, in Git order.
   */
  keptLandedPaths: readonly string[];
}>;

/**
 How the synthetic base settles one path.
 */
type BaseEdit = Readonly<{
  /**
   Shared path.
   */
  shared: SharedPath;
  /**
   Subsumed, or the side whose entry the capture order keeps.
   */
  rule: 'subsumed' | 'prepared' | 'landed';
}>;

/**
 One `update-index --index-info` record setting a subsumed path to its landed content.
 A regular file keeps the base's mode, so a mode change still merges three-way;
 a path the landed side deleted is removed with mode `0`.

 @param shared - subsumed path

 @returns NUL-terminated record
 */
function subsumedRecord(shared: SharedPath,): string {
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
 One `update-index --index-info` record setting a path exactly to one side's entry,
 so `git merge-tree` sees no change on that side and takes the other side's entry wholesale.

 @param path - shared path

 @param entry - entry the synthetic base takes

 @param width - object ID width of the repository

 @returns NUL-terminated record
 */
function exactRecord({
  path,
  entry,
  width,
}: Readonly<{
  path: string;
  entry: SharedPath['base'];
  width: number;
}>,): string {
  return entry === ABSENT_ENTRY ? `0 ${'0'.repeat(width,)}\t${path}\0` : `${entry.mode} ${entry.oid}\t${path}\0`;
}

/**
 Object ID width of a shared path's present entries.

 @param shared - shared path, of which at least one entry is present

 @returns hexadecimal object ID length
 */
function oidWidth(shared: SharedPath,): number {
  /**
   Object ID lengths of the present entries.
   */
  const widths = sidesOf(shared,)
    .flatMap(function widthOf(entry,): readonly number[] {
    return entry === ABSENT_ENTRY ? [] : [entry.oid
      .length,];
  },);
  return widths[0] ?? 0;
}

/**
 The synthetic base record of one edit:
 a capture-ordered path takes the entry of the side that shows no change,
 so the later capture's entry lands.

 @param edit - path and rule

 @returns NUL-terminated record
 */
function baseRecord(edit: BaseEdit,): string {
  if (edit.rule === 'subsumed')
    return subsumedRecord(edit.shared,);
  return exactRecord({
    path: edit.shared
      .path,
    entry: edit.rule === 'prepared' ? edit.shared
      .landed : edit.shared
        .prepared,
    width: oidWidth(edit.shared,),
  },);
}

/**
 Writes the synthetic merge base:
 the preparation base with each subsumed path set to its landed content
 and each capture-ordered path set to the entry of the side whose change it drops.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param directory - transaction directory receiving the private index

 @param replay - replay number naming the private index

 @param mergeBase - preparation base commit

 @param subsumed - subsumed and capture-ordered paths

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
  subsumed: readonly BaseEdit[];
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

 @param orderPaths - capture-order decisions for the shared paths; a path it leaves out is unordered

 @returns effective merge base, the paths whose prepared entries land, and the paths whose landed entries stay

 @throws {@link CommitTransactionGitError} when a Git command fails

 @example
 ```ts
 await subsumeLandedChanges({ gitPath: '/usr/bin/git', shadowPath, objectDirectory, cwd: '/repo', directory, replay: 1, mergeBase, current, prepared, orderPaths: async () => new Map() });
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
  orderPaths,
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
  orderPaths: (paths: readonly string[]) => Promise<ReadonlyMap<string, CaptureOrderDecision>>;
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
   Capture-order decision per shared path.
   */
  const order = shared.length === 0 ? new Map<string, CaptureOrderDecision>() : await orderPaths(shared.map(function pathOf(entry,): string {
    return entry.path;
  },),);
  /**
   Paths capture order leaves to subsumption.
   */
  const unordered = shared.filter(function isUnordered(entry,): boolean {
    return (order.get(entry.path,) ?? 'unordered') === 'unordered';
  },);
  /**
   Paths whose prepared entry equals the landed one.
   */
  const identical: ReadonlySet<SharedPath> = new Set(unordered.filter(function same(entry,): boolean {
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
    candidates: unordered.filter(function needsText(entry,): boolean {
      return isTextCandidate(entry,) && (!identical.has(entry,));
    },),
  },),);
  /**
   Every synthetic base edit in Git order.
   */
  const edits = shared.flatMap(function editOf(entry,): readonly BaseEdit[] {
    /**
     Capture-order rule of the path.
     */
    const rule = order.get(entry.path,) ?? 'unordered';
    if (rule !== 'unordered')
      return [{
        shared: entry,
        rule,
      },];
    return identical.has(entry,) || text.has(entry,) ? [{
      shared: entry,
      rule: 'subsumed',
    },] : [];
  },);
  /**
   Paths whose prepared entries land.
   */
  const preparedPaths = edits.flatMap(function keepsPrepared(edit,): readonly string[] {
    return edit.rule === 'landed' ? [] : [edit.shared
      .path,];
  },);
  /**
   Paths whose landed entries stay.
   */
  const landedPaths = edits.flatMap(function keepsLanded(edit,): readonly string[] {
    return edit.rule === 'landed' ? [edit.shared
      .path,] : [];
  },);
  rl.debug(`${String(shared.length,)} paths changed on both sides; ${String(edits.length,)} settle before the merge: prepared ${JSON.stringify(preparedPaths,)}, landed ${JSON.stringify(landedPaths,)}`,);
  if (edits.length === 0)
    return {
      mergeBase,
      subsumedPaths: [],
      keptLandedPaths: [],
    };
  return {
    mergeBase: await writeSubsumedBase({
      gitPath,
      shadowPath,
      directory,
      replay,
      mergeBase,
      subsumed: edits,
    },),
    subsumedPaths: preparedPaths,
    keptLandedPaths: landedPaths,
  };
}
