/**
 * Characters that open a list item when a space follows.
 */
const BULLETS: ReadonlySet<string> = new Set([
  '-',
  '+',
  '*',
],);

/**
 * Characters a line can be made entirely of to become a thematic break or a
 * setext underline, either of which ends the paragraph above it.
 */
const RULE_CHARACTERS: ReadonlySet<string> = new Set([
  '-',
  '=',
  '_',
  '*',
],);

/**
 * Fence characters, three or more of which open a code block.
 */
const FENCES: ReadonlySet<string> = new Set([
  '`',
  '~',
],);

/**
 * Characters that open a block on their own, with nothing required after them:
 * a blockquote marker, an HTML block, and a table row.
 */
const LONE_OPENERS: ReadonlySet<string> = new Set([
  '>',
  '<',
  '|',
],);

/**
 * Least number of fence characters that opens a code block.
 */
const FENCE_RUN = 3;

/**
 * Most `#` characters an ATX heading may open with.
 */
const MAX_HEADING_LEVEL = 6;

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
 * Whether a character separates a block marker from what follows it, which is
 * what makes the marker a marker rather than the start of a word.
 *
 * @param ch - single character
 *
 * @returns whether the character ends the marker
 */
function marksBoundary(ch: string,): boolean {
  return (ch === ' ')
    || (ch === '\t')
    || (ch === '')
    || (ch === '\n')
    || (ch === '\r');
}

/**
 * Parameters for a scan bounded to one line of source.
 */
type LineScanParams = {
  /**
   * Source under lint.
   */
  readonly source: string;
  /**
   * Offset to start scanning from.
   */
  readonly at: number;
  /**
   * Offset the line ends at.
   */
  readonly lineEnd: number;
};

/**
 * Offset the line containing this one ends at, which is the next line ending
 * or the end of the source.
 *
 * @param source - source under lint
 *
 * @param at - offset the line runs from
 *
 * @returns offset of the line's end
 */
function lineEndFrom({
  source,
  at,
}: Omit<LineScanParams, 'lineEnd'>,): number {
  for (let index = at; index < source.length; index += 1) {
    /**
     * Character under the forward cursor.
     */
    const ch = source[index] ?? '';
    if ((ch === '\n') || (ch === '\r')) {
      return index;
    }
  }
  return source.length;
}

/**
 * Offset of the line's first written character, past its indentation.
 *
 * @param source - source under lint
 *
 * @param at - offset the line runs from
 *
 * @param lineEnd - offset the line ends at
 *
 * @returns offset of the first non-indent character
 */
function indentEnd({
  source,
  at,
  lineEnd,
}: LineScanParams,): number {
  /**
   * Cursor advanced past each indent character.
   */
  const cursor = { at, };
  while (cursor.at < lineEnd) {
    /**
     * Character under the forward cursor.
     */
    const ch = source[cursor.at] ?? '';
    if ((ch !== ' ') && (ch !== '\t')) {
      break;
    }
    cursor.at += 1;
  }
  return cursor.at;
}

/**
 * Length of the run of the character standing at this offset.
 *
 * @param source - source under lint
 *
 * @param at - offset the run starts at
 *
 * @param lineEnd - offset the line ends at
 *
 * @returns number of repetitions
 */
function runLength({
  source,
  at,
  lineEnd,
}: LineScanParams,): number {
  /**
   * Character the run is made of.
   */
  const of = source[at] ?? '';
  /**
   * Cursor advanced past each repetition.
   */
  const cursor = { at, };
  while ((cursor.at < lineEnd) && (source[cursor.at] === of)) {
    cursor.at += 1;
  }
  return cursor.at - at;
}

/**
 * Whether the line holds nothing but the character standing at this offset and
 * whitespace, which is what makes it a thematic break or a setext underline
 * rather than ordinary prose that happens to start with a dash.
 *
 * @param source - source under lint
 *
 * @param at - offset the line's content starts at
 *
 * @param lineEnd - offset the line ends at
 *
 * @returns whether the line is uniform
 */
function isUniformRuleLine({
  source,
  at,
  lineEnd,
}: LineScanParams,): boolean {
  /**
   * Character the line would be made of.
   */
  const of = source[at] ?? '';
  for (let index = at; index < lineEnd; index += 1) {
    /**
     * Character under the forward cursor.
     */
    const ch = source[index] ?? '';
    if ((ch !== of)
      && (ch !== ' ')
      && (ch !== '\t')) {
      return false;
    }
  }
  return true;
}

/**
 * Whether an ordered-list marker stands at this offset: digits, then `.` or
 * `)`, then a boundary.
 *
 * @param source - source under lint
 *
 * @param at - offset the marker would start at
 *
 * @param lineEnd - offset the line ends at
 *
 * @returns whether an ordered-list marker stands here
 */
function opensOrderedList({
  source,
  at,
  lineEnd,
}: LineScanParams,): boolean {
  /**
   * Cursor advanced past the leading digits.
   */
  const cursor = { at, };
  while ((cursor.at < lineEnd) && isDigit(source[cursor.at] ?? '',)) {
    cursor.at += 1;
  }
  if (cursor.at === at) {
    return false;
  }
  /**
   * Delimiter that would follow the number.
   */
  const delimiter = source[cursor.at] ?? '';
  return ((delimiter === '.') || (delimiter === ')'))
    && marksBoundary(source[cursor.at + 1] ?? '',);
}

/**
 * Parameters for {@link startsBlockConstruct}.
 */
export type StartsBlockConstructParams = {
  /**
   * Source under lint.
   */
  readonly source: string;
  /**
   * Offset a line break would be inserted at, so the line that would begin
   * there runs from here to the next line ending.
   */
  readonly at: number;
};

/**
 * Whether the text that would begin a new line at this offset opens a block
 * construct, which would end the paragraph it was written inside.
 *
 * An inserted line break is add-only in the source and can still change what
 * the document says, because a run of prose that was mid-line becomes
 * line-initial and CommonMark reads line-initial text as block syntax.
 * Measured: `Intro. # heading` became a paragraph and an `h1`,
 * `Intro. - item` a paragraph and a list, `Intro. > quote` a paragraph and a
 * blockquote, ``Intro. ```js`` a paragraph and a code fence, and
 * `Second para. ---` an `h2`, because a line of dashes under a paragraph is a
 * setext underline. Nine of fifteen probed markers rewrote the document.
 *
 * The test is deliberately loose. Refusing a break costs one missing line
 * break; allowing one that splits the block rewrites the document.
 *
 * @param source - source under lint
 *
 * @param at - offset a line break would be inserted at
 *
 * @returns whether a break there would open a block construct
 *
 * @example
 * ```ts
 * startsBlockConstruct({ source: 'a. # b', at: 2 }); // true
 * ```
 */
export function startsBlockConstruct({
  source,
  at,
}: StartsBlockConstructParams,): boolean {
  /**
   * Offset the new line would end at.
   */
  const lineEnd = lineEndFrom({
    source,
    at,
  },);
  /**
   * Offset the new line's first written character stands at.
   */
  const start = indentEnd({
    source,
    at,
    lineEnd,
  },);
  if (start >= lineEnd) {
    return false;
  }
  /**
   * First written character of the new line.
   */
  const first = source[start] ?? '';
  if (LONE_OPENERS.has(first,)) {
    return true;
  }
  /**
   * How many times the opening character repeats.
   */
  const run = runLength({
    source,
    at: start,
    lineEnd,
  },);
  /**
   * Character just past the opening run.
   */
  const after = source[start + run] ?? '';
  if ((first === '#')
    && (run <= MAX_HEADING_LEVEL)
    && marksBoundary(after,)) {
    return true;
  }
  if (FENCES.has(first,) && (run >= FENCE_RUN)) {
    return true;
  }
  if (BULLETS.has(first,)
    && (run === 1)
    && marksBoundary(after,)) {
    return true;
  }
  if (RULE_CHARACTERS.has(first,)
    && isUniformRuleLine({
      source,
      at: start,
      lineEnd,
    },)) {
    return true;
  }
  return opensOrderedList({
    source,
    at: start,
    lineEnd,
  },);
}
