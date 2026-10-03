/**
 Changes a `pre-commit` hook staged into the private index, which the commit keeps as native Git does.

 A lint-staged-style hook rewrites files and re-stages them while it runs;
 native `git commit` commits whatever the hook staged.
 The commit keeps that tree,
 and landing reconciles the hook's paths in the real index and the worktree:
 each takes the committed content only while it still holds its pre-hook state,
 and a concurrent edit is kept and reported.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';

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
 Git modes whose worktree copies cli-git may rewrite.
 */
const ORDINARY_MODES: ReadonlySet<string> = new Set([
  '100644',
  '100755',
],);

/**
 Fields of one `--raw` metadata record: source mode, destination mode, source object, destination object, status.
 */
const RAW_FIELD_COUNT = 5;

/**
 Paths a hook changed and the worktree completions they need.
 */
export type HookChanges = Readonly<{
  /**
   Every path whose entry differs between the tree the hook saw and the tree it left.
   */
  paths: readonly string[];
  /**
   Modified ordinary files whose worktree copy receives the committed bytes while it still holds the pre-hook bytes.
   */
  worktreeRecords: readonly AddedPathRecord[];
}>;

/**
 No hook changed the private index.
 */
export const NO_HOOK_CHANGES: HookChanges = {
  paths: [],
  worktreeRecords: [],
};

/**
 One `diff-tree --raw` record.
 */
export type RawChange = Readonly<{
  /**
   Source mode.
   */
  fromMode: string;
  /**
   Destination mode.
   */
  toMode: string;
  /**
   Source object.
   */
  fromOid: string;
  /**
   Destination object.
   */
  toOid: string;
  /**
   Changed path.
   */
  path: string;
}>;

/**
 Parses NUL-terminated `diff-tree -r -z --raw --no-renames` output.

 @param output - Git output

 @returns changes in Git order

 @throws TypeError for a malformed record

 @example
 ```ts
 parseRawChanges(':100644 100644 a b M\0f.txt\0');
 ```
 */
export function parseRawChanges(output: string,): readonly RawChange[] {
  /**
   Alternating metadata and path fields.
   */
  const fields = output.split('\0',);
  return fields.flatMap(function toChange(
    field,
    index,
  ): readonly RawChange[] {
    if (((index % 2) !== 0) || (field === ''))
      return [];
    /**
     `:<mode> <mode> <oid> <oid> <status>`.
     */
    const metadata = field.slice(1,)
      .split(' ',);
    /**
     Path following the metadata.
     */
    const path = fields[index + 1];
    if ((metadata.length !== RAW_FIELD_COUNT) || (path === undefined))
      throw new TypeError(`git diff-tree returned a malformed record: ${JSON.stringify(field,)}`,);
    /**
     Record fields.
     */
    const [fromMode = '', toMode = '', fromOid = '', toOid = '',] = metadata;
    return [{
      fromMode,
      toMode,
      fromOid,
      toOid,
      path,
    },];
  },);
}

/**
 Describes what a hook changed between the tree it saw and the tree it left.

 @param gitPath - real Git executable

 @param cwd - owning worktree directory

 @param objectDirectory - shadow store holding both trees

 @param fromTree - tree before the hook

 @param toTree - tree the commit keeps

 @returns changed paths and worktree completions

 @example
 ```ts
 await describeHookChanges({ gitPath: '/usr/bin/git', cwd: '/repo', objectDirectory, fromTree, toTree });
 ```
 */
export async function describeHookChanges({
  gitPath,
  cwd,
  objectDirectory,
  fromTree,
  toTree,
}: Readonly<{
  gitPath: string;
  cwd: string;
  objectDirectory: string;
  fromTree: string;
  toTree: string;
}>,): Promise<HookChanges> {
  if (fromTree === toTree)
    return NO_HOOK_CHANGES;
  /**
   Entry changes between the trees.
   */
  const changes = parseRawChanges(DECODER.decode((await runTransactionGit({
    gitPath,
    cwd,
    args: [
      'diff-tree',
      '-r',
      '-z',
      '--raw',
      '--no-renames',
      '--no-abbrev',
      fromTree,
      toTree,
    ],
    objectDirectory,
  },)).stdout,),);
  l.debug(`pre-commit changed ${String(changes.length,)} staged paths; the commit keeps them as native Git does`,);
  return {
    paths: changes.map(function changedPath(change,): string {
      return change.path;
    },),
    worktreeRecords: changes.flatMap(function worktreeRecord(change,): readonly AddedPathRecord[] {
      if ((change.fromMode !== change.toMode) || (!ORDINARY_MODES.has(change.toMode,)))
        return [];
      return [{
        path: change.path,
        gitMode: change.toMode === '100755' ? '100755' : '100644',
        originalOid: change.fromOid,
        intendedOid: change.toOid,
      },];
    },),
  };
}

/**
 Joins the hook changes of successive preparations and revalidations.

 @param earlier - changes already accepted

 @param later - changes accepted afterwards

 @returns union of paths, and the later completion for a path both changed after the earlier one

 @example
 ```ts
 combineHookChanges({ earlier: NO_HOOK_CHANGES, later: changes });
 ```
 */
export function combineHookChanges({
  earlier,
  later,
}: Readonly<{
  earlier: HookChanges;
  later: HookChanges;
}>,): HookChanges {
  return {
    paths: [
      ...new Set([
        ...earlier.paths,
        ...later.paths,
      ],),
    ],
    worktreeRecords: [
      ...earlier.worktreeRecords,
      ...later.worktreeRecords,
    ],
  };
}
