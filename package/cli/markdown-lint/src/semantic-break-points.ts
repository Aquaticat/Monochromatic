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
 * Forward-scan outcome for a stretch of text: an existing line break, further
 * content, or the text exhausted with only whitespace seen.
 */
type ScanResult = 'broken' | 'content' | 'exhausted';

/**
 * Parameters for {@link scanForward}.
 */
type ScanForwardParams = {
  /**
   * Text to scan.
   */
  readonly text: string;
  /**
   * Index to start scanning from.
   */
  readonly from: number;
};

/**
 * Scan `text` forward from `from`, skipping spaces and tabs: `broken` at the
 * first newline, `content` at the first other character, `exhausted` when only
 * whitespace remained to the end.
 *
 * @param text - text to scan
 *
 * @param from - index to start scanning from
 *
 * @returns break, content, or exhausted classification
 */
function scanForward({
  text,
  from,
}: ScanForwardParams,): ScanResult {
  for (let cursor = from; cursor < text.length; cursor += 1) {
    /**
     * Character under the forward cursor.
     */
    const ch = text[cursor] ?? '';
    if ((ch === ' ') || (ch === '\t')) {
      continue;
    }
    if (ch === '\n') {
      return 'broken';
    }
    return 'content';
  }
  return 'exhausted';
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
  /**
   * Source immediately after the text node, consulted only when the node's own
   * slice is exhausted. A newline that a parser places just past the node
   * boundary (rather than inside the node) then still reads as an existing
   * break, making the classification independent of where a parser ends a text
   * node.
   */
  readonly trailing: string;
};

/**
 * Classify what follows a break-point character: an existing line break, the
 * tail of the prose (only whitespace remains, in the node and the source just
 * past it), or further content. The trailing source is scanned only after the
 * node's own slice is exhausted, so a break-point at the node boundary sees the
 * real next character rather than falsely reading as the node's tail.
 *
 * @param slice - text being scanned
 *
 * @param afterIndex - index just past the break-point character
 *
 * @param trailing - source immediately after the node, for boundary lookahead
 *
 * @returns `broken`, `tail`, or `content`
 */
function followStatus({
  slice,
  afterIndex,
  trailing,
}: FollowStatusParams,): 'broken' | 'tail' | 'content' {
  /**
   * Outcome from the node's own slice.
   */
  const inSlice = scanForward({
    text: slice,
    from: afterIndex,
  },);
  if (inSlice !== 'exhausted') {
    return inSlice;
  }
  /**
   * Outcome from the source just past the node, reached only when the slice
   * held nothing but whitespace after the break-point.
   */
  const inTrailing = scanForward({
    text: trailing,
    from: 0,
  },);
  return inTrailing === 'exhausted'
    ? 'tail'
    : inTrailing;
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
   * Source immediately after the text node (up to the paragraph's end),
   * consulted for boundary lookahead when a break-point sits at the slice end.
   */
  readonly trailing: string;
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
 * @param trailing - source just past the node, for boundary lookahead
 *
 * @param isParagraphTail - whether the node is its paragraph's last child
 *
 * @returns insertion offsets within the slice, ascending
 *
 * @example
 * ```ts
 * breakOffsets({ slice: 'a, b. c', trailing: '', isParagraphTail: true }); // [2, 5]
 * ```
 */
export function breakOffsets({
  slice,
  trailing,
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
      trailing,
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
