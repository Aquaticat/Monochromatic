/**
 Exact emulation of `git apply --reverse --check` for one text file,
 the subsumption test of replay:
 a landed change is already contained in the prepared bytes
 when its patch applies in reverse to them.

 The matching follows Git's `apply.c` (`apply_one_fragment`, `find_pos`, and `match_fragment`)
 with its defaults:
 no context reduction (`p_context` is `UINT_MAX`),
 no whitespace fixing,
 and no overlapping hunks (`LINE_PATCHED`).
 Reversal swaps each hunk's sides as `reverse_patches` does:
 the new side (context and additions) must be found,
 anchored at the beginning when the new side starts at line 0 or 1
 and at the end when no context follows the last change,
 searched from the old side's start.

 @module
 */
import {
  type PatchHunk,
  splitKeepingNewlines,
} from './commit-replay-patch.ts';

/**
 One image line and whether an earlier hunk wrote it.
 */
type ImageLine = Readonly<{
  /**
   Line bytes.
   */
  text: string;
  /**
   Written by an earlier hunk, so no later hunk may match it.
   */
  patched: boolean;
}>;

/**
 A hunk's required lines appear nowhere in the image.
 */
const HUNK_REJECTED: unique symbol = Symbol('hunk does not apply in reverse',);

/**
 Search result when no candidate line matches.
 */
const NO_POSITION = -1;

/**
 Whitespace `isspace` skips in Git's `hash_line`.
 */
const HASH_WHITESPACE: readonly string[] = [
  ' ',
  '\t',
  '\n',
  '\v',
  '\f',
  '\r',
];

/**
 Line content Git's quick line hash sees.

 @param text - line bytes

 @returns bytes without whitespace
 */
function hashKey(text: string,): string {
  return HASH_WHITESPACE.reduce(
    function withoutWhitespace(
      remaining,
      whitespace,
    ): string {
    return remaining.replaceAll(
      whitespace,
      '',
    );
  },
    text,
  );
}

/**
 Compares one image line with one preimage line as Git's quick hash check and `memcmp` do together.

 Every preimage line but an incomplete last one ends with a newline,
 and so does every image line but the image's last,
 so Git's byte comparison of the joined lines is line equality,
 except that an incomplete last preimage line only has to be a prefix of its image line
 whose whitespace-free content is equal,
 and must equal it when the hunk is anchored at the end.

 @param line - image line

 @param wanted - preimage line

 @param incompleteLast - whether `wanted` is the preimage's last line and lacks a newline

 @param matchEnd - whether the hunk must end at the last image line

 @returns whether the lines match
 */
function lineMatches({
  line,
  wanted,
  incompleteLast,
  matchEnd,
}: Readonly<{
  line: ImageLine;
  wanted: string;
  incompleteLast: boolean;
  matchEnd: boolean;
}>,): boolean {
  if (line.patched)
    return false;
  if ((!incompleteLast) || matchEnd)
    return line.text === wanted;
  return line.text
    .startsWith(wanted,)
    && (hashKey(line.text,) === hashKey(wanted,));
}

/**
 Git's `match_fragment` without whitespace fixing.

 @param image - current image lines

 @param preimage - lines that must be present

 @param at - candidate first line

 @param matchBeginning - whether the hunk must match at the first line

 @param matchEnd - whether the hunk must end at the last line

 @returns whether the preimage matches there
 */
function matchesAt({
  image,
  preimage,
  at,
  matchBeginning,
  matchEnd,
}: Readonly<{
  image: readonly ImageLine[];
  preimage: readonly string[];
  at: number;
  matchBeginning: boolean;
  matchEnd: boolean;
}>,): boolean {
  /**
   Line after the preimage.
   */
  const end = preimage.length + at;
  if ((end > image.length) || (matchEnd && (end !== image.length))
    || (matchBeginning && (at !== 0)))
    return false;
  return preimage.every(function matchesLine(
    wanted,
    index,
  ): boolean {
    return lineMatches({
      line: image[at + index] ?? {
        text: '',
        patched: true,
      },
      wanted,
      incompleteLast: (index === (preimage.length - 1)) && (!wanted.endsWith('\n',)),
      matchEnd,
    },);
  },);
}

/**
 Git's `find_pos`: tries the expected line, then one line further forwards and backwards alternately.

 @param image - current image lines

 @param preimage - lines that must be present

 @param line - expected first line

 @param matchBeginning - whether the hunk must match at the first line

 @param matchEnd - whether the hunk must end at the last line

 @returns first matching line, or {@link NO_POSITION}
 */
function findPosition({
  image,
  preimage,
  line,
  matchBeginning,
  matchEnd,
}: Readonly<{
  image: readonly ImageLine[];
  preimage: readonly string[];
  line: number;
  matchBeginning: boolean;
  matchEnd: boolean;
}>,): number {
  /**
   Anchored start.
   */
  const anchored = matchBeginning ? 0 : (matchEnd ? image.length - preimage.length : line);
  /**
   First candidate, clamped to the image.
   */
  const first = Math.min(
    Math.max(
      anchored,
      0,
    ),
    image.length,
  );
  /**
   Tests one candidate.

   @param at - candidate first line

   @returns whether it matches
   */
  function matches(at: number,): boolean {
    return (at >= 0) && (at <= image.length)
      && matchesAt({
      image,
      preimage,
      at,
      matchBeginning,
      matchEnd,
    },);
  }
  if (matches(first,))
    return first;
  // Git widens the search by one line per side until it passes both ends of the image.
  for (let distance = 1; ((first + distance) <= image.length) || ((first - distance) >= 0); distance += 1) {
    if (matches(first + distance,))
      return first + distance;
    if (matches(first - distance,))
      return first - distance;
  }
  return NO_POSITION;
}

/**
 Applies one hunk in reverse to the image.

 @param image - current image lines

 @param hunk - hunk of the landed change

 @returns image after the hunk, or {@link HUNK_REJECTED} when its new side is absent
 */
function reverseHunk({
  image,
  hunk,
}: Readonly<{
  image: readonly ImageLine[];
  hunk: PatchHunk;
}>,): readonly ImageLine[] | typeof HUNK_REJECTED {
  /**
   Lines the reversed hunk requires: context and additions.
   */
  const preimage = hunk.lines
    .filter(function present(line,): boolean {
      return line.op !== '-';
    },)
    .map(function text(line,): string {
      return line.text;
    },);
  /**
   Lines the reversed hunk writes: context and removals.
   */
  const postimage = hunk.lines
    .filter(function restored(line,): boolean {
      return line.op !== '+';
    },)
    .map(function written(line,): ImageLine {
      return {
        text: line.text,
        patched: true,
      };
    },);
  /**
   Context lines after the last change.
   */
  const trailing = hunk.lines
    .length
    - 1
    - hunk.lines
    .findLastIndex(function changed(line,): boolean {
    return line.op !== ' ';
  },);
  /**
   First matching line.
   */
  const at = findPosition({
    image,
    preimage,
    line: hunk.oldStart === 0 ? 0 : hunk.oldStart - 1,
    matchBeginning: hunk.newStart <= 1,
    matchEnd: trailing === 0,
  },);
  if (at === NO_POSITION)
    return HUNK_REJECTED;
  return [
    ...image.slice(
      0,
      at,
    ),
    ...postimage,
    ...image.slice(at + preimage.length,),
  ];
}

/**
 Reports whether a landed text change applies in reverse to the prepared bytes,
 so the prepared bytes already contain it.

 @param hunks - hunks of the landed change, base to new target

 @param prepared - prepared bytes, Latin-1 decoded

 @returns whether every hunk applies in reverse in order

 @example
 ```ts
 reverseApplies({ hunks, prepared: 'a\nB\nc\nd\n' });
 ```
 */
export function reverseApplies({
  hunks,
  prepared,
}: Readonly<{
  hunks: readonly PatchHunk[];
  prepared: string;
}>,): boolean {
  /**
   Image after each hunk, the rejection once one fails.
   */
  const result = hunks.reduce<readonly ImageLine[] | typeof HUNK_REJECTED>(
    function applyNext(
      image,
      hunk,
    ) {
      return image === HUNK_REJECTED ? HUNK_REJECTED : reverseHunk({
        image,
        hunk,
      },);
    },
    splitKeepingNewlines(prepared,)
      .map(function unpatched(text,): ImageLine {
        return {
          text,
          patched: false,
        };
      },),
  );
  return result !== HUNK_REJECTED;
}
