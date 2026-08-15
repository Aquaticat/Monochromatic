//region Insertion separator
// The whitespace nobody owns.
//
// A slice covers the nodes it covers; the blank line BETWEEN two blocks belongs
// to neither of them, and until now nothing had to care: every replacement went
// into a span that already sat between the right separators, so writing model
// text verbatim preserved them. An insertion has no span. Written verbatim at a
// boundary it concatenates with whatever is there, so a rendering placed before
// a heading produces `...afternoon.## Habits`, which still parses as Markdown
// and is silently wrong.
//
// THE MODEL DOES NOT DECIDE THIS. A prompt asking for correct leading and
// trailing blank lines is a hope rather than a guarantee, it fails silently,
// and it cannot be right anyway: several fragments landing at one boundary each
// carrying their own blank lines would multiply the separators between them.
// Only assembly knows what is on both sides of the boundary, how many fragments
// share it, and what the document uses to separate blocks.
//
// ADD-ONLY. Existing whitespace is preserved byte for byte and topped up to one
// blank line where an insertion creates an adjacency that had none. Nothing
// here removes a separator the archive already had.

/**
 * Two line endings, which is what separates blocks in a Markdown document.
 */
const BLOCK_SEPARATOR_LINES = 2;

/**
 * What a string search answers with when it finds nothing.
 */
const NOT_FOUND = -1;

/**
 * Reads the line ending a document uses.
 *
 * FROM THE DOCUMENT rather than from the platform. A translation written on
 * Windows carries `\r\n`, and joining its blocks with bare `\n` produces a file
 * with two conventions in it, which every later diff reports as a change to
 * lines nobody touched.
 *
 * @param targetText - document being written into
 *
 * @returns Line ending to write, defaulting to `\n` for a document that shows
 * no preference
 *
 * @example
 * ```ts
 * const eol = documentLineEnding({ targetText, },);
 * ```
 */
export function documentLineEnding(
  { targetText, }: { readonly targetText: string; },
): string {
  return targetText.includes('\r\n',) ? '\r\n' : '\n';
}

/**
 * Counts the line endings a text ends with, up to the block separator.
 *
 * @param text - text to look at the end of
 *
 * @param eol - line ending this document uses
 *
 * @returns How many trailing line endings there are, capped at
 * {@link BLOCK_SEPARATOR_LINES}
 *
 * @example
 * ```ts
 * const trailing = trailingLineEndings({ text: 'a\n\n', eol: '\n', },);
 * ```
 */
function trailingLineEndings(
  {
    text,
    eol,
  }: {
    readonly text: string;
    readonly eol: string;
  },
): number {
  /**
   * How many have been counted so far, walking backwards.
   */
  const counted = [
    0,
    1,
  ]
    .filter(function isPresent(depth,): boolean {
      return text.endsWith(eol.repeat(depth + 1,),);
    },);
  return counted.length;
}

/**
 * Counts the line endings a text begins with, up to the block separator.
 *
 * @param text - text to look at the start of
 *
 * @param eol - line ending this document uses
 *
 * @returns How many leading line endings there are, capped at
 * {@link BLOCK_SEPARATOR_LINES}
 *
 * @example
 * ```ts
 * const leading = leadingLineEndings({ text: '\n\nb', eol: '\n', },);
 * ```
 */
function leadingLineEndings(
  {
    text,
    eol,
  }: {
    readonly text: string;
    readonly eol: string;
  },
): number {
  /**
   * How many have been counted so far, walking forwards.
   */
  const counted = [
    0,
    1,
  ]
    .filter(function isPresent(depth,): boolean {
      return text.startsWith(eol.repeat(depth + 1,),);
    },);
  return counted.length;
}

/**
 * Strips the blank-line material around one fragment, and nothing else.
 *
 * INDENTATION SURVIVES. A fragment beginning with spaces on its first content
 * line is inside a list or a block quote, and cutting that would move it out of
 * the structure it belongs to. What is cut is whitespace ending in a line
 * ending, which is blank lines rather than indentation.
 *
 * @param fragment - text a lane produced for one slice
 *
 * @returns Same text without leading or trailing blank lines
 *
 * @example
 * ```ts
 * const body = fragmentBody({ fragment: '\n\n  The cat naps.\n\n', },);
 * ```
 */
export function fragmentBody(
  { fragment, }: { readonly fragment: string; },): string {
  /**
   * How much of the fragment is left once its leading whitespace is gone.
   */
  const bodyLength = fragment.trimStart()
    .length;

  /**
   * Where that whitespace run ends, which is where the fragment stops being
   * blank.
   */
  const contentStart = fragment.length - bodyLength;

  /**
   * Last line ending inside that run, which is where the blank lines stop and
   * this fragment's own indentation begins.
   */
  const lastBreak = fragment.lastIndexOf(
    '\n',
    contentStart,
  );

  /**
   * Where the body starts: after the blank lines, before any indentation.
   */
  const bodyStart = (lastBreak === NOT_FOUND) ? 0 : (lastBreak + 1);
  return fragment.slice(bodyStart,)
    .trimEnd();
}

/**
 * Builds the text to write at one insertion boundary.
 *
 * @param fragments - what the lanes produced for the slices anchored here, in
 * document order
 *
 * @param before - document text preceding the boundary
 *
 * @param after - document text following it, as it will stand
 *
 * @param eol - line ending this document uses
 *
 * @returns Text to write at that boundary, separators included
 *
 * @example
 * ```ts
 * const written = composeInsertion({ fragments, before, after, eol, },);
 * ```
 */
export function composeInsertion(
  {
    fragments,
    before,
    after,
    eol,
  }: {
    readonly fragments: readonly string[];
    readonly before: string;
    readonly after: string;
    readonly eol: string;
  },
): string {
  /**
   * Fragments reduced to their own text, joined by one blank line.
   *
   * Joined here rather than by each fragment carrying its own blank lines,
   * which would put two between every pair.
   */
  const body = fragments
    .map(function toBody(fragment,): string {
      return fragmentBody({ fragment, },);
    },)
    .filter(function saysSomething(text,): boolean {
      return text !== '';
    },)
    .join(eol.repeat(BLOCK_SEPARATOR_LINES,),);
  if (body === '')
    return '';

  /**
   * Line endings the archive already provides before this boundary, which are
   * kept and only topped up.
   */
  const kept = (before === '')
    ? BLOCK_SEPARATOR_LINES
    : trailingLineEndings({
      text: before,
      eol,
    },);

  /**
   * Line endings the archive provides after it. A boundary at the very end of
   * the document has none, and the text written there terminates the file
   * instead, which is a different question from separating two blocks.
   */
  const following = (after === '')
    ? 0
    : leadingLineEndings({
      text: after,
      eol,
    },);

  /**
   * What to write before the body, so the block ahead of it is separated.
   */
  const opening = eol.repeat(BLOCK_SEPARATOR_LINES - kept,);

  /**
   * What to write after it, which for the end of a document is the single line
   * ending a text file ends with.
   */
  const closing = (after === '')
    ? eol
    : eol.repeat(BLOCK_SEPARATOR_LINES - following,);
  return opening
    + body
    + closing;
}

//endregion Insertion separator
