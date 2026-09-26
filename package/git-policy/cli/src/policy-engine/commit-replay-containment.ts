/**
 Context-tolerant half of replay's subsumption check:
 whether the prepared change of a region is the landed change extended by the prepared commit's own edit on one side.

 Strict reverse application (`commit-replay-reverse-apply.ts`) rejects the case subsumption exists for:
 a prepared file that holds the landed edit plus its own edit directly next to it,
 because that own edit sits in the landed hunk's context lines.
 Git's own `git apply --reverse -C0` accepts it only by dropping all context,
 which also accepts a landed deletion the prepared bytes never made.

 This check reads both changes as zero-context hunks in base coordinates
 (`git diff-tree -p --unified=0` from the base).
 Every landed hunk must lie inside one prepared hunk,
 and within each prepared hunk the landed hunks it covers,
 joined by the unchanged base lines between them,
 must be a prefix of the prepared hunk's new text when the prepared hunk starts where the first landed hunk starts,
 or a suffix when it ends where the last landed hunk ends:
 the prepared commit's own edit or insertion sits on one side only.
 When the prepared hunk covers exactly the landed range,
 the landed lines may also appear in order with own lines inserted between them,
 as long as the prepared text starts with the first landed line or ends with the last;
 a landed file addition read against an empty base is this case.
 A prepared hunk anchored at neither end,
 an own edit on both sides,
 is not subsumed and merges three-way instead,
 and so is a landed deletion whose lines the prepared commit rewrote in place,
 a modify/delete conflict.

 @module
 */
import type { PatchHunk, } from './commit-replay-patch.ts';

/**
 One zero-context hunk in base line coordinates.
 */
type BaseChange = Readonly<{
  /**
   First replaced base line, zero-based; for an insertion, the line it goes before.
   */
  start: number;
  /**
   Line after the last replaced base line.
   */
  end: number;
  /**
   New lines.
   */
  added: readonly string[];
}>;

/**
 Converts a zero-context hunk to base coordinates.
 A unified range with count `0` names the line after which lines are inserted,
 which is the zero-based index the insertion goes before.

 @param hunk - zero-context hunk

 @returns base change
 */
function baseChange(hunk: PatchHunk,): BaseChange {
  /**
   Removed base line count.
   */
  const removed = hunk.lines
    .filter(function isRemoval(line,): boolean {
      return line.op === '-';
    },)
    .length;
  /**
   Zero-based first line.
   */
  const start = removed === 0 ? hunk.oldStart : hunk.oldStart - 1;
  return {
    start,
    end: start + removed,
    added: hunk.lines
      .filter(function isAddition(line,): boolean {
        return line.op === '+';
      },)
      .map(function text(line,): string {
        return line.text;
      },),
  };
}

/**
 Whether two line lists are equal.

 @param left - first list

 @param right - second list

 @returns element-wise equality
 */
function sameLines({
  left,
  right,
}: Readonly<{
  left: readonly string[];
  right: readonly string[];
}>,): boolean {
  return (left.length === right.length) && left.every(function equal(
    line,
    index,
  ): boolean {
    return line === right[index];
  },);
}

/**
 Whether every line appears in order within another list.

 @param lines - lines that must all appear

 @param within - list searched

 @returns whether `lines` is a subsequence of `within`
 */
function isSubsequence({
  lines,
  within,
}: Readonly<{
  lines: readonly string[];
  within: readonly string[];
}>,): boolean {
  /**
   Lines of `lines` matched so far, advanced by one greedy pass over `within`.
   */
  const matched = within.reduce(
    function advance(
      count,
      line,
    ): number {
    return (count < lines.length) && (lines[count] === line) ? count + 1 : count;
  },
    0,
  );
  return matched === lines.length;
}

/**
 Whether one prepared hunk's new text is the covered landed hunks extended on at most one side.

 @param prepared - prepared hunk

 @param landed - landed hunks it covers, in order, at least one

 @param base - base lines

 @returns whether the prepared text contains the landed change
 */
function regionContains({
  prepared,
  landed,
  base,
}: Readonly<{
  prepared: BaseChange;
  landed: readonly BaseChange[];
  base: readonly string[];
}>,): boolean {
  /**
   First and last covered landed hunks.
   */
  const [first, last,] = [
    landed.at(0,),
    landed.at(-1,),
  ];
  if ((first === undefined) || (last === undefined))
    return false;
  /**
   Landed text of the region: each landed hunk's lines, joined by the base lines between them.
   */
  const expected = landed.flatMap(function withGap(
    change,
    index,
  ): readonly string[] {
    /**
     Next covered landed hunk.
     */
    const next = landed[index + 1];
    return next === undefined ? change.added : [
      ...change.added,
      ...base.slice(
        change.end,
        next.start,
      ),
    ];
  },);
  /**
   Whether the prepared hunk starts and ends where the landed hunks do.
   */
  const [anchoredStart, anchoredEnd,] = [
    prepared.start === first.start,
    prepared.end === last.end,
  ];
  // A landed deletion replaced by other text over exactly its lines is a modify/delete conflict, not an extension.
  if ((expected.length === 0) && anchoredStart
    && anchoredEnd)
    return prepared.added
      .length
      === 0;
  if (expected.length
    > prepared.added
    .length)
    return false;
  // Over exactly the landed range, own lines may also sit between landed lines, as long as one end stays the landed one.
  if (anchoredStart && anchoredEnd)
    return ((prepared.added[0] === expected[0]) || (prepared.added
      .at(-1,)
      === expected.at(-1,)))
      && isSubsequence({
        lines: expected,
        within: prepared.added,
      },);
  return (anchoredStart && sameLines({
    left: prepared.added
      .slice(
        0,
        expected.length,
      ),
    right: expected,
  },)) || (anchoredEnd && sameLines({
    left: prepared.added
      .slice(prepared.added
        .length
        - expected.length,),
    right: expected,
  },));
}

/**
 Reports whether the prepared change contains the landed change region by region.

 @param landed - zero-context hunks from the base to the landed bytes

 @param prepared - zero-context hunks from the base to the prepared bytes

 @param base - base lines, each with its newline

 @returns whether every landed hunk lies in a prepared hunk that extends it on at most one side

 @example
 ```ts
 containsLandedChange({ landed, prepared, base: ['a\n', 'b\n'] });
 ```
 */
export function containsLandedChange({
  landed,
  prepared,
  base,
}: Readonly<{
  landed: readonly PatchHunk[];
  prepared: readonly PatchHunk[];
  base: readonly string[];
}>,): boolean {
  /**
   Prepared changes in base coordinates.
   */
  const preparedChanges = prepared.map(baseChange,);
  /**
   Landed changes, each with the index of the prepared change covering it, `-1` when none does.
   */
  const covered = landed.map(baseChange,)
    .map(function cover(change,): readonly [
      number,
      BaseChange
    ] {
      return [
        preparedChanges.findIndex(function covers(candidate,): boolean {
        return (candidate.start <= change.start) && (change.end <= candidate.end);
      },),
        change,
      ];
    },);
  if (covered.some(function uncovered([index,],): boolean {
    return index === (-1);
  },))
    return false;
  return preparedChanges.every(function containsCovered(
    change,
    index,
  ): boolean {
    /**
     Landed changes this prepared change covers.
     */
    const inside = covered.filter(function coveredHere([coveringIndex,],): boolean {
      return coveringIndex === index;
    },)
      .map(function changeOf([, landedChange,],): BaseChange {
        return landedChange;
      },);
    return (inside.length === 0) || regionContains({
      prepared: change,
      landed: inside,
      base,
    },);
  },);
}
