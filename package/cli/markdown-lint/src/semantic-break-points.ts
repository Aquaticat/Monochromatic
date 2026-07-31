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
 * Characters that end a written word, so a line break may stand where one of
 * them stands. A break-point character followed by anything else is glued to
 * what comes next and is therefore inside a token (`crates.io`, `Node.js`,
 * `9.0.0-rc.3`, `checker.TupleType`) or immediately before a closing delimiter
 * (`concept."`, `catches.)`), neither of which is a prose boundary. The empty
 * string stands for the prose running out, which ends a word too.
 */
const WORD_SEPARATORS: ReadonlySet<string> = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  '',
],);

/**
 * Characters that close something the sentence opened, so the sentence has not
 * finished being written until they are. A break belongs after the run of them
 * rather than in front of it: `He called it "done." Then` breaks after the
 * quote, and breaking before it would leave the quote heading the next line
 * with nothing to close.
 *
 * Emphasis delimiters are deliberately absent. A break at a text node's end is
 * already moved past those by the rule, which knows from the tree which span is
 * closing and cannot mistake a literal asterisk for one.
 */
const CLOSING_DELIMITERS: ReadonlySet<string> = new Set([
  '"',
  '\'',
  ')',
  ']',
  '}',
  '”',
  '’',
  '»',
  '›',
],);

/**
 * Answer from {@link breakOffsetAfter} when nothing at or past the break-point
 * character ends a written word, so no break belongs there.
 */
const NO_BREAK_OFFSET = -1;

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
  /**
   * Index to stop before, so a scan of the source can be held to one
   * paragraph without copying it.
   */
  readonly to: number;
};

/**
 * Whether a character ends a line. A document written with CRLF puts `\r`
 * where a line ends, and reading it as ordinary content makes an already
 * broken sentence look unbroken: the fixer then writes a second newline in
 * front of the existing one and splits the paragraph in two.
 *
 * @param ch - single character
 *
 * @returns whether the character ends a line
 */
function isLineEnding(ch: string,): boolean {
  return (ch === '\n') || (ch === '\r');
}

/**
 * Scan `text` forward over `[from, to)`, skipping spaces and tabs: `broken` at
 * the first line ending, `content` at the first other character, `exhausted`
 * when only whitespace remained within the range.
 *
 * @param text - text to scan
 *
 * @param from - index to start scanning from
 *
 * @param to - index to stop before
 *
 * @returns break, content, or exhausted classification
 */
function scanForward({
  text,
  from,
  to,
}: ScanForwardParams,): ScanResult {
  for (let cursor = from; cursor < to; cursor += 1) {
    /**
     * Character under the forward cursor.
     */
    const ch = text[cursor] ?? '';
    if ((ch === ' ') || (ch === '\t')) {
      continue;
    }
    if (isLineEnding(ch,)) {
      return 'broken';
    }
    return 'content';
  }
  return 'exhausted';
}

/**
 * Where to look for what follows a text node: the original source, plus the
 * half-open range between the node's tail and its paragraph's end. A range
 * rather than a copied slice, because inter-node whitespace has no length
 * limit. A slice would have to guess one, and a guess that fell short read an
 * existing break as absent and made the fixer write a second newline in front
 * of it, splitting the paragraph. Scanning the source stops at the first
 * character that is not a space or a tab, so it costs the whitespace run
 * rather than the paragraph.
 */
export type TrailingSource = {
  /**
   * Original source the node was parsed from.
   */
  readonly source: string;
  /**
   * Offset just past the node, seen through any closing inline delimiters.
   */
  readonly tailEnd: number;
  /**
   * Offset the enclosing paragraph ends at, bounding the scan.
   */
  readonly paragraphEnd: number;
};

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
   * Source past the text node, consulted only when the node's own slice is
   * exhausted. A newline that a parser places just past the node boundary
   * (rather than inside the node) then still reads as an existing break,
   * making the classification independent of where a parser ends a text node.
   */
  readonly trailing: TrailingSource;
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
 * @param trailing - source past the node, for boundary lookahead
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
    to: slice.length,
  },);
  if (inSlice !== 'exhausted') {
    return inSlice;
  }
  /**
   * Outcome from the source just past the node, reached only when the slice
   * held nothing but whitespace after the break-point.
   */
  const inTrailing = scanForward({
    text: trailing.source,
    from: trailing.tailEnd,
    to: trailing.paragraphEnd,
  },);
  return inTrailing === 'exhausted'
    ? 'tail'
    : inTrailing;
}

/**
 * Parameters for {@link followingCharacter}.
 */
type FollowingCharacterParams = {
  /**
   * Text being scanned.
   */
  readonly slice: string;
  /**
   * Index of the break-point character.
   */
  readonly index: number;
  /**
   * Source past the text node, holding the next character when the break-point
   * character ends the slice.
   */
  readonly trailing: TrailingSource;
};

/**
 * Character written immediately after a break-point character, reaching into
 * the source just past the node when the break-point character is the slice's
 * last one. Unlike {@link followStatus} this skips nothing: whether a break may
 * stand here is a question about the very next character, and a scan that
 * skipped spaces would answer a different question and report the character
 * after them.
 *
 * @param slice - text being scanned
 *
 * @param index - index of the break-point character
 *
 * @param trailing - source past the node, for boundary lookahead
 *
 * @returns next written character, empty when the prose runs out
 */
function followingCharacter({
  slice,
  index,
  trailing,
}: FollowingCharacterParams,): string {
  if ((index + 1) < slice.length) {
    return slice[index + 1] ?? '';
  }
  return trailing.tailEnd < trailing.paragraphEnd
    ? trailing.source[trailing.tailEnd] ?? ''
    : '';
}

/**
 * Parameters for {@link breakOffsetAfter}.
 */
type BreakOffsetAfterParams = {
  /**
   * Text being scanned.
   */
  readonly slice: string;
  /**
   * Index of the break-point character.
   */
  readonly index: number;
  /**
   * Source past the text node, for boundary lookahead.
   */
  readonly trailing: TrailingSource;
};

/**
 * Offset within the slice at which a break after this break-point character
 * belongs, or {@link NO_BREAK_OFFSET} when none does.
 *
 * The offset walks past any closing delimiters written straight after the
 * break-point character, because the sentence is not finished until they are.
 * What has to end a word is then the character past that run, not the one
 * touching the break-point character: `catches.)` breaks after the paren, while
 * `crates.io` and `rule?",` break nowhere here, the second because its comma is
 * its own break point and gets its own offset.
 *
 * @param slice - text being scanned
 *
 * @param index - index of the break-point character
 *
 * @param trailing - source past the node, for boundary lookahead
 *
 * @returns insertion offset within the slice, or {@link NO_BREAK_OFFSET}
 */
function breakOffsetAfter({
  slice,
  index,
  trailing,
}: BreakOffsetAfterParams,): number {
  /**
   * Cursor advanced past each closing delimiter. A record so every mutable
   * value stays a number.
   */
  const cursor = { at: index + 1, };
  while ((cursor.at < slice.length)
    && CLOSING_DELIMITERS.has(slice[cursor.at] ?? '',)) {
    cursor.at += 1;
  }
  /**
   * Character past the delimiter run, from the source beyond the node when the
   * run reached the slice's end.
   */
  const following = followingCharacter({
    slice,
    index: cursor.at - 1,
    trailing,
  },);
  return WORD_SEPARATORS.has(following,)
    ? cursor.at
    : NO_BREAK_OFFSET;
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
   * Source past the text node (up to the paragraph's end), consulted for
   * boundary lookahead when a break-point sits at the slice end.
   */
  readonly trailing: TrailingSource;
  /**
   * Whether this text node is the last child of its paragraph, so a trailing
   * break-point (nothing but whitespace after it) is the paragraph's final
   * punctuation and must not be broken.
   */
  readonly isParagraphTail: boolean;
};

/**
 * Offsets within the slice at which to insert a line break: one for each
 * break-point character that ends a written word, is not already followed by a
 * break, is not the paragraph's final punctuation, and is not the last dot of
 * an ellipsis or part of an abbreviation. The offset sits past any closing
 * delimiters, so it is not always one past the break-point character.
 *
 * Ending a written word is what keeps a decimal, a thousands separator, a
 * version segment, a time, a dotted filename and a qualified name whole, so
 * each needs no guard of its own: every one of them writes a digit or a letter
 * straight after the break-point character. Declining a break is always safe;
 * inserting one inside a token is not.
 *
 * @param slice - source text of one prose text node
 *
 * @param trailing - source past the node, for boundary lookahead
 *
 * @param isParagraphTail - whether the node is its paragraph's last child
 *
 * @returns insertion offsets within the slice, ascending
 *
 * @example
 * ```ts
 * const trailing = { source: 'a, b. c', tailEnd: 7, paragraphEnd: 7 };
 * breakOffsets({ slice: 'a, b. c', trailing, isParagraphTail: true }); // [2, 5]
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
     * Where a break after this break-point character would go, past any
     * closing delimiters, or {@link NO_BREAK_OFFSET} when none belongs there.
     */
    const breakAt = breakOffsetAfter({
      slice,
      index,
      trailing,
    },);
    if (breakAt === NO_BREAK_OFFSET) {
      continue;
    }
    /**
     * What follows the place the break would go. Measured from there rather
     * than from the break-point character, so a document already broken after
     * a closing quote reads as broken rather than as missing a break in front
     * of the quote.
     */
    const status = followStatus({
      slice,
      afterIndex: breakAt,
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
    if (ch === '.') {
      if (prev === '.') {
        continue;
      }
      if (withinAbbreviation({
        ranges,
        index,
      },)) {
        continue;
      }
    }
    offsets.push(breakAt,);
  }
  return offsets;
}
