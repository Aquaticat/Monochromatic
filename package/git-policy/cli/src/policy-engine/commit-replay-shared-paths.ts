/**
 Paths both a prepared commit and the landed history changed since the preparation base,
 with the three tree entries replay's subsumption check compares.

 Paths are Latin-1 decoded from `git diff-tree -z` output,
 so every byte survives and encodes back exactly.

 @module
 */
import { runShadowGit, } from '../shadow-repository/shadow-refs.ts';
import {
  parseRawChanges,
  type RawChange,
} from './commit-hook-changes.ts';

/**
 Byte-preserving decoder for Git output that carries paths.
 */
const LATIN1 = new TextDecoder('latin1',);

/**
 Git's absent-entry mode in raw diff output.
 */
const ABSENT_MODE = '000000';

/**
 Regular file modes.
 */
const REGULAR_MODES: ReadonlySet<string> = new Set([
  '100644',
  '100755',
],);

/**
 A tree lacks the path.
 */
export const ABSENT_ENTRY: unique symbol = Symbol('path absent from tree',);

/**
 One tree entry of a shared path.
 */
export type TreeEntry = Readonly<{
  /**
   Git mode.
   */
  mode: string;
  /**
   Object ID.
   */
  oid: string;
}>;

/**
 One tree entry, or its absence.
 */
export type SideEntry = TreeEntry | typeof ABSENT_ENTRY;

/**
 One path both sides changed.
 */
export type SharedPath = Readonly<{
  /**
   Repository path, Latin-1 decoded.
   */
  path: string;
  /**
   Preparation base entry.
   */
  base: SideEntry;
  /**
   Landed entry.
   */
  landed: SideEntry;
  /**
   Prepared entry.
   */
  prepared: SideEntry;
}>;

/**
 Converts one side of a raw record into an entry.

 @param mode - raw mode

 @param oid - raw object ID

 @returns entry, absent for the all-zero mode
 */
function entryOf({
  mode,
  oid,
}: Readonly<{
  mode: string;
  oid: string;
}>,): SideEntry {
  return mode === ABSENT_MODE ? ABSENT_ENTRY : {
    mode,
    oid,
  };
}

/**
 Lists the raw changes between two commits in the shadow.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param from - older commit

 @param to - newer commit

 @returns changes per path
 */
async function rawChanges({
  gitPath,
  shadowPath,
  from,
  to,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  from: string;
  to: string;
}>,): Promise<ReadonlyMap<string, RawChange>> {
  return new Map(parseRawChanges(LATIN1.decode((await runShadowGit({
    gitPath,
    shadowPath,
    args: [
      'diff-tree',
      '-r',
      '-z',
      '--raw',
      '--no-renames',
      '--no-abbrev',
      from,
      to,
    ],
  },)).stdout,),)
    .map(function keyed(change,): readonly [
      string,
      RawChange
    ] {
      return [
        change.path,
        change,
      ];
    },),);
}

/**
 Whether two entries name the same mode and object, or are both absent.

 @param left - first entry

 @param right - second entry

 @returns equality

 @example
 ```ts
 sameEntry({ left: ABSENT_ENTRY, right: ABSENT_ENTRY }); // true
 ```
 */
export function sameEntry({
  left,
  right,
}: Readonly<{
  left: SideEntry;
  right: SideEntry;
}>,): boolean {
  if ((left === ABSENT_ENTRY) || (right === ABSENT_ENTRY))
    return left === right;
  return (left.mode === right.mode) && (left.oid === right.oid);
}

/**
 The three entries of a shared path.

 @param shared - shared path

 @returns base, landed, and prepared entries

 @example
 ```ts
 sidesOf(shared).length; // 3
 ```
 */
export function sidesOf(shared: SharedPath,): readonly SideEntry[] {
  return [
    shared.base,
    shared.landed,
    shared.prepared,
  ];
}

/**
 Whether all three entries of a shared path are regular files, so only their bytes can decide it.

 @param shared - shared path

 @returns whether the entries are regular files

 @example
 ```ts
 isRegularTriple(shared);
 ```
 */
export function isRegularTriple(shared: SharedPath,): boolean {
  return sidesOf(shared,)
    .every(function regular(entry,): boolean {
    return (entry !== ABSENT_ENTRY) && REGULAR_MODES.has(entry.mode,);
  },);
}

/**
 Object ID of a present entry.

 @param entry - entry a caller already knows is present

 @returns object ID

 @throws {@link TypeError} for an absent entry

 @example
 ```ts
 presentOid(shared.prepared);
 ```
 */
export function presentOid(entry: SideEntry,): string {
  if (entry === ABSENT_ENTRY)
    throw new TypeError('A regular-file entry of a shared replay path is absent.',);
  return entry.oid;
}

/**
 Lists the paths both the landed history and the prepared commit changed since the merge base, in Git order.

 @param gitPath - real Git executable

 @param shadowPath - shadow repository

 @param mergeBase - preparation base commit

 @param current - target that won

 @param prepared - prepared commit

 @returns shared paths with their three entries

 @example
 ```ts
 await listSharedPaths({ gitPath: '/usr/bin/git', shadowPath, mergeBase, current, prepared });
 ```
 */
export async function listSharedPaths({
  gitPath,
  shadowPath,
  mergeBase,
  current,
  prepared,
}: Readonly<{
  gitPath: string;
  shadowPath: string;
  mergeBase: string;
  current: string;
  prepared: string;
}>,): Promise<readonly SharedPath[]> {
  /**
   Changes of the landed history and of the prepared commit since the base.
   */
  const [landed, mine,] = await Promise.all([
    rawChanges({
      gitPath,
      shadowPath,
      from: mergeBase,
      to: current,
    },),
    rawChanges({
      gitPath,
      shadowPath,
      from: mergeBase,
      to: prepared,
    },),
  ],);
  return [...landed.values(),].flatMap(function both(change,): readonly SharedPath[] {
    /**
     Prepared change of the same path.
     */
    const own = mine.get(change.path,);
    return own === undefined ? [] : [{
      path: change.path,
      base: entryOf({
        mode: change.fromMode,
        oid: change.fromOid,
      },),
      landed: entryOf({
        mode: change.toMode,
        oid: change.toOid,
      },),
      prepared: entryOf({
        mode: own.toMode,
        oid: own.toOid,
      },),
    },];
  },);
}
