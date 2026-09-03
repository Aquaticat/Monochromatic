import { maskHtmlComments, } from '../mask-html-comments.ts';

//region Archive stub markers
// A PLACEHOLDER IS NOT CONTENT THE ORIGINAL CARRIES. XIEPT2's archive English
// page is a stub: front matter, the line `(To-Do)`, an HTML comment of
// translator hints, and nothing the ORIGINAL says. The pipeline translated the
// whole ORIGINAL below that and, since no slice covered the marker, published
// `(To-Do)` over a finished translation (2026-09-03,
// `~/temp/agent/xiept2-postscript-20260903`). The owner: "The pipeline's job
// is to give a good result even when the originals are bad."
// (`doc/decision/translation-repair-good-result-over-bad-original.md`).
//
// MEASURED AGAINST THE PINNED CORPUS, 92 English pages: one stub marker, that
// one. The token set is what the corpus shows plus the obvious English
// variants; Chinese placeholders have no instance and are not guessed at.
//
// THE COMMENTS STAY. `entry-notes.ts` reads every archive HTML comment as an
// "ARCHIVE editor comment" line of the identity block, which is where the
// vocabulary and voice notes 22 of those 92 pages carry reach the translators
// and judges, and a reader never sees them. Only the reader-visible marker
// goes, and only where it stands as a paragraph of its own outside front
// matter, comments and code fences.

/**
 * Tokens a placeholder paragraph consists of, lowercased and unwrapped.
 */
export const STUB_MARKER_TOKENS: ReadonlySet<string> = new Set([
  'to-do',
  'todo',
  'tbd',
  'wip',
],);

/**
 * One bracket pair a marker may be wrapped in.
 */
type MarkerWrap = {
  /**
   * Opening bracket.
   */
  readonly open: string;

  /**
   * Closing bracket.
   */
  readonly close: string;
};

/**
 * Bracket pairs a marker may be wrapped in, one layer.
 */
const MARKER_WRAPS: readonly MarkerWrap[] = [
  {
    open: '(',
    close: ')',
  },
  {
    open: '[',
    close: ']',
  },
  {
    open: '（',
    close: '）',
  },
];

/**
 * Line that opens and closes front matter.
 */
const FRONT_MATTER_FENCE = '---';

/**
 * Prefix of a fenced code block's opening and closing line.
 */
const CODE_FENCE = '```';

/**
 * One marker the strip removed, for the log and the record.
 *
 * @example
 * ```ts
 * const marker: StrippedStubMarker = { lineNumber: 8, text: '(To-Do)', };
 * ```
 */
export type StrippedStubMarker = {
  /**
   * One-based line of the archive as read, before any removal.
   */
  readonly lineNumber: number;

  /**
   * Line as the archive carried it.
   */
  readonly text: string;
};

/**
 * Whether one paragraph is nothing but a placeholder token.
 *
 * @param paragraph - paragraph text, whitespace and one layer of brackets
 * tolerated
 *
 * @returns Whether it names no content
 *
 * @example
 * ```ts
 * isStubMarkerParagraph({ paragraph: '(To-Do)', },);
 * ```
 */
export function isStubMarkerParagraph({ paragraph, }: { readonly paragraph: string; },): boolean {
  /**
   * Paragraph without its surrounding whitespace.
   */
  const trimmed = paragraph.trim();
  /**
   * Paragraph without one layer of brackets, when it wore one.
   */
  const unwrapped = MARKER_WRAPS.reduce(
    function unwrap(
      text: string,
      wrap: MarkerWrap,
    ): string {
      /**
       * Opening and closing bracket of this pair.
       */
      const {
        open,
        close,
      } = wrap;
      /**
       * Whether the text wears this pair with something inside it.
       */
      const wears = text.startsWith(open,)
        && text.endsWith(close,)
        && (text.length > (open.length + close.length));
      if (!wears)
        return text;
      /**
       * Text between the brackets.
       */
      const inside = text.slice(
        open.length,
        text.length - close.length,
      );
      return inside.trim();
    },
    trimmed,
  );
  return STUB_MARKER_TOKENS.has(unwrapped.toLowerCase(),);
}

/**
 * Scan state carried line to line.
 */
type StripState = {
  /**
   * Lines kept so far.
   */
  readonly kept: readonly string[];

  /**
   * Markers removed so far.
   */
  readonly stripped: readonly StrippedStubMarker[];

  /**
   * Whether the scan is still inside the leading front matter.
   */
  readonly inFrontMatter: boolean;

  /**
   * Whether the scan is inside a fenced code block.
   */
  readonly inFence: boolean;

  /**
   * Whether the next line, if blank, is the blank a removed marker owned.
   */
  readonly skipBlank: boolean;
};

/**
 * Removes every paragraph that is nothing but a placeholder token.
 *
 * ONE LINEAR PASS over the lines, with HTML comments masked first so a marker
 * inside a comment is left alone: the masked text keeps every newline, so its
 * lines index the original's exactly. A marker paragraph is one line whose
 * previous kept line is blank or absent and whose next line is blank or
 * absent, outside front matter and code fences. The marker goes with one
 * adjacent blank line: the following one, or the preceding one at the end of
 * the document, so the page keeps single blank lines between blocks.
 *
 * @param text - archive text after the invisible-variant fold
 *
 * @returns Text without the markers, and each marker removed with its line
 *
 * @example
 * ```ts
 * const { text, stripped, } = stripStubMarkers({ text: archive, },);
 * ```
 */
export function stripStubMarkers(
  { text, }: { readonly text: string; },
): {
  readonly text: string;
  readonly stripped: readonly StrippedStubMarker[];
} {
  /**
   * Original lines.
   */
  const lines = text.split('\n',);
  /**
   * Same lines with every comment blanked, so a comment line differs from its
   * original and a marker inside one is never read as a paragraph.
   */
  const maskedLines = maskHtmlComments({ text, },)
    .masked
    .split('\n',);
  /**
   * Whether the document opens with front matter.
   */
  const opensWithFrontMatter = lines[0] === FRONT_MATTER_FENCE;

  /**
   * Final state after every line.
   */
  const final = lines.reduce(
    function scan(
      state: StripState,
      line: string,
      index: number,
    ): StripState {
      /**
       * This line as masked, unchanged when no comment touches it.
       */
      const maskedLine = maskedLines[index] ?? '';
      if (state.inFrontMatter) {
        return {
          ...state,
          kept: [
            ...state.kept,
            line,
          ],
          inFrontMatter: !((index > 0) && (line === FRONT_MATTER_FENCE)),
        };
      }
      if (maskedLine.trimStart()
        .startsWith(CODE_FENCE,)) {
        return {
          ...state,
          kept: [
            ...state.kept,
            line,
          ],
          inFence: !state.inFence,
          skipBlank: false,
        };
      }
      if (state.inFence) {
        return {
          ...state,
          kept: [
            ...state.kept,
            line,
          ],
        };
      }
      if (state.skipBlank && (line.trim() === '')) {
        return {
          ...state,
          skipBlank: false,
        };
      }
      /**
       * Whether no comment covers any of this line.
       */
      const outsideComment = maskedLine === line;
      /**
       * Last kept line, or nothing at the document's start.
       */
      const previous = state.kept
        .at(-1,)
        ?? '';
      /**
       * Whether nothing kept stands directly above.
       */
      const previousBlank = previous.trim() === '';
      /**
       * Line after this one, absent when the document ends here.
       */
      const next = lines[index + 1];
      /**
       * Whether the document ends with this line.
       */
      const atEnd = next === undefined;
      /**
       * Whether the paragraph ends with this line.
       */
      const nextBlank = atEnd || (next.trim() === '');
      /**
       * Whether this line stands as a paragraph of its own.
       */
      const standsAlone = outsideComment
        && previousBlank
        && nextBlank;
      /**
       * Whether this line is a placeholder paragraph of its own.
       */
      const isMarker = standsAlone && isStubMarkerParagraph({ paragraph: line, },);
      if (!isMarker) {
        return {
          ...state,
          kept: [
            ...state.kept,
            line,
          ],
          skipBlank: false,
        };
      }
      /**
       * Kept lines less the blank above the marker.
       */
      const withoutBlankAbove = state.kept
        .slice(
          0,
          -1,
        );
      /**
       * How many lines are kept so far.
       */
      const keptCount = state.kept
        .length;
      /**
       * Whether the blank above goes, since no line follows to give up its
       * blank instead.
       */
      const dropsBlankAbove = atEnd
        && previousBlank
        && (keptCount > 0);
      /**
       * Kept lines after this marker's removal.
       */
      const kept = dropsBlankAbove ? withoutBlankAbove : state.kept;
      return {
        ...state,
        kept,
        stripped: [
          ...state.stripped,
          {
            lineNumber: index + 1,
            text: line,
          },
        ],
        skipBlank: !atEnd,
      };
    },
    {
      kept: [],
      stripped: [],
      inFrontMatter: opensWithFrontMatter,
      inFence: false,
      skipBlank: false,
    },
  );
  return {
    text: final.kept
      .join('\n',),
    stripped: final.stripped,
  };
}

//endregion Archive stub markers
