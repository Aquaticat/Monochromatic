/**
 * Break-point characters after which a semantic line break belongs.
 */
const BREAK_POINTS: ReadonlySet<string> = new Set([
  ',',
  '.',
  ';',
  ':',
  '?',
  '!',
],);

/**
 * Break-point characters skipped when they sit between two digits (decimals,
 * thousands separators, version segments, times, ratios).
 */
const DIGIT_GUARDED: ReadonlySet<string> = new Set([
  ',',
  '.',
  ':',
],);

/**
 * Lowercased abbreviations whose internal or trailing `.` must not trigger a
 * break. A pragmatic default set; the plan leaves the exact list to be tuned
 * against the corpus.
 */
const ABBREVIATIONS: readonly string[] = [
  'e.g.',
  'i.e.',
  'etc.',
  'vs.',
  'cf.',
  'al.',
  'dr.',
  'mr.',
  'mrs.',
  'ms.',
  'st.',
  'no.',
  'fig.',
  'eq.',
  'approx.',
  'a.m.',
  'p.m.',
  'u.s.',
  'u.k.',
  'ph.d.',
];

/**
 * Whether a character is an ASCII digit.
 *
 * @param ch - single character
 *
 * @returns whether the character is `0` through `9`
 */
function isDigit(ch: string,): boolean {
  return (ch >= '0') && (ch <= '9');
}

/**
 * Whether a character is an ASCII lowercase letter, used as the word-boundary
 * test for abbreviation matches.
 *
 * @param ch - single character
 *
 * @returns whether the character is `a` through `z`
 */
function isLowerLetter(ch: string,): boolean {
  return (ch >= 'a') && (ch <= 'z');
}

/**
 * Half-open index range `[start, end)` within a string covered by an
 * abbreviation occurrence.
 */
type AbbreviationRange = {
  /**
   * Inclusive start index.
   */
  readonly start: number;
  /**
   * Exclusive end index.
   */
  readonly end: number;
};

/**
 * Index ranges within a lowercased string covered by an abbreviation
 * occurrence, so a `.` inside any range is left unbroken.
 *
 * @param lower - lowercased text to scan
 *
 * @returns abbreviation ranges
 */
function abbreviationRanges(lower: string,): readonly AbbreviationRange[] {
  /**
   * Ranges accumulated across every abbreviation.
   */
  const ranges: AbbreviationRange[] = [];
  for (const abbreviation of ABBREVIATIONS) {
    /**
     * Search cursor advanced past each match.
     */
    let from = 0;
    while (from <= lower.length) {
      /**
       * Index of the next occurrence, or -1 when none remain.
       */
      const found = lower.indexOf(
        abbreviation,
        from,
      );
      if (found === (-1)) {
        break;
      }
      /**
       * Character before the match; an abbreviation only counts at a word
       * boundary, so a letter here (as in the `st.` inside `first.`) rejects it.
       */
      const before = found === 0
        ? ''
        : lower[found - 1] ?? '';
      if (!isLowerLetter(before,)) {
        ranges.push({
          start: found,
          end: found + abbreviation.length,
        },);
      }
      from = found + 1;
    }
  }
  return ranges;
}

/**
 * Parameters for {@link withinAbbreviation}.
 */
type WithinAbbreviationParams = {
  /**
   * Abbreviation ranges to test against.
   */
  readonly ranges: readonly AbbreviationRange[];
  /**
   * Index to test.
   */
  readonly index: number;
};

/**
 * Whether an index falls inside any abbreviation range.
 *
 * @param ranges - abbreviation ranges to test against
 *
 * @param index - index to test
 *
 * @returns whether the index is within a range
 */
function withinAbbreviation({
  ranges,
  index,
}: WithinAbbreviationParams,): boolean {
  return ranges.some(function covers(range: AbbreviationRange,): boolean {
    return (range.start <= index) && (index < range.end);
  },);
}

/**
 * Parameters for {@link followStatus}.
 */
type FollowStatusParams = {
  /**
   * Text being scanned.
   */
  readonly slice: string;
  /**
   * Index just past the break-point character.
   */
  readonly afterIndex: number;
};

/**
 * Classify what follows a break-point character: an existing line break, the
 * tail of the text (only whitespace remains), or further content.
 *
 * @param slice - text being scanned
 *
 * @param afterIndex - index just past the break-point character
 *
 * @returns `broken`, `tail`, or `content`
 */
function followStatus({
  slice,
  afterIndex,
}: FollowStatusParams,): 'broken' | 'tail' | 'content' {
  for (let cursor = afterIndex; cursor < slice.length; cursor += 1) {
    /**
     * Character under the forward cursor.
     */
    const ch = slice[cursor] ?? '';
    if ((ch === ' ') || (ch === '\t')) {
      continue;
    }
    if (ch === '\n') {
      return 'broken';
    }
    return 'content';
  }
  return 'tail';
}

/**
 * Parameters for {@link breakOffsets}.
 */
export type BreakOffsetsParams = {
  /**
   * Source text of one prose `text` node.
   */
  readonly slice: string;
  /**
   * Whether this text node is the last child of its paragraph, so a trailing
   * break-point (nothing but whitespace after it) is the paragraph's final
   * punctuation and must not be broken.
   */
  readonly isParagraphTail: boolean;
};

/**
 * Offsets within the slice at which to insert a line break: one just past each
 * break-point character that is not already followed by a break, is not the
 * paragraph's final punctuation, and is not guarded as a decimal, number,
 * version, time, ellipsis, or abbreviation.
 *
 * @param slice - source text of one prose text node
 *
 * @param isParagraphTail - whether the node is its paragraph's last child
 *
 * @returns insertion offsets within the slice, ascending
 *
 * @example
 * ```ts
 * breakOffsets({ slice: 'a, b. c', isParagraphTail: true }); // [2, 5]
 * ```
 */
export function breakOffsets({
  slice,
  isParagraphTail,
}: BreakOffsetsParams,): readonly number[] {
  /**
   * Abbreviation ranges for this slice, computed once.
   */
  const ranges = abbreviationRanges(slice.toLowerCase(),);
  /**
   * Insertion offsets accumulated across the scan.
   */
  const offsets: number[] = [];
  for (let index = 0; index < slice.length; index += 1) {
    /**
     * Character at the cursor.
     */
    const ch = slice[index] ?? '';
    if (!BREAK_POINTS.has(ch,)) {
      continue;
    }
    /**
     * What follows the break-point character.
     */
    const status = followStatus({
      slice,
      afterIndex: index + 1,
    },);
    if (status === 'broken') {
      continue;
    }
    if ((status === 'tail') && isParagraphTail) {
      continue;
    }
    /**
     * Character before the break point.
     */
    const prev = slice[index - 1] ?? '';
    /**
     * Character after the break point.
     */
    const next = slice[index + 1] ?? '';
    if (DIGIT_GUARDED.has(ch,) && isDigit(prev,)
      && isDigit(next,)) {
      continue;
    }
    if (ch === '.') {
      if ((prev === '.') || (next === '.')) {
        continue;
      }
      if (withinAbbreviation({
        ranges,
        index,
      },)) {
        continue;
      }
    }
    offsets.push(index + 1,);
  }
  return offsets;
}
