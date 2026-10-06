import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { maskHtmlComments, } from '../mask-html-comments.ts';

//region Archive stub markers
// A PLACEHOLDER IS NOT CONTENT THE ORIGINAL CARRIES. XIEPT2's archive English
// page is a stub: front matter, the line `(To-Do)`, an HTML comment of
// translator hints, and nothing the ORIGINAL says. The pipeline translated the
// whole ORIGINAL below that and, since no slice covered the marker, published
// `(To-Do)` over a finished translation (2026-09-03; ledger A1
// records the stub). The owner: "The pipeline's job
// is to give a good result even when the originals are bad."
// (`doc/decision/translation-repair-good-result-over-bad-original.md`).
//
// MEASURED AGAINST THE PINNED CORPUS, 92 English pages: two stub markers.
// XIEPT2's `(To-Do)`, and XingZ60's ``>>> `Under Construction` `` standing
// where the original has the heading 七句破题 (ledger A1), which shipped on
// all 17 XingZ60 pages until the strip read blockquote markers and a code
// span. The token set is what the corpus shows plus the obvious English
// variants; Chinese placeholders have no instance and are not guessed at.
// "To be continued" is not one: its two instances are a person's own words
// and a translation of 未完待续.
//
// THE COMMENTS STAY. `entry-notes.ts` reads every archive HTML comment as an
// "ARCHIVE editor comment" line of the identity block, which is where the
// vocabulary and voice notes 22 of those 92 pages carry reach the translators
// and judges, and a reader never sees them. Only the reader-visible marker
// goes, and only where it stands as a paragraph of its own outside front
// matter, comments and code fences.

/**
 Tokens a placeholder paragraph consists of, lowercased and unwrapped.
 */
export const STUB_MARKER_TOKENS: ReadonlySet<string> = new Set([
  'to-do',
  'todo',
  'tbd',
  'wip',
  'under construction',
],);

/**
 One bracket pair a marker may be wrapped in.
 */
type MarkerWrap = {
  /**
   Opening bracket.
   */
  readonly open: string;

  /**
   Closing bracket.
   */
  readonly close: string;
};

/**
 Bracket pairs a marker may be wrapped in, one layer.
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
 Line that opens and closes front matter.
 */
const FRONT_MATTER_FENCE = '---';

/**
 Prefix of a fenced code block's opening and closing line.
 */
const CODE_FENCE = '```';

/**
 One marker the strip removed, for the log and the record.

 @example
 ```ts
 const marker: StrippedStubMarker = { lineNumber: 8, text: '(To-Do)', };
 ```
 */
export type StrippedStubMarker = {
  /**
   One-based line of the archive as read, before any removal.
   */
  readonly lineNumber: number;

  /**
   Line as the archive carried it.
   */
  readonly text: string;
};

/**
 Blockquote marker a placeholder may stand behind, at any depth.
 */
const QUOTE_MARKER = '>';

/**
 Delimiter of the one code span a placeholder may wear.
 */
const CODE_SPAN = '`';

/**
 Text without its leading blockquote markers, however deeply nested.

 ONE PASS over the leading characters, stopping at the first that is neither
 a marker nor the space between markers (ledger A1, a nested blockquote of
 inline code). Every character before that one is ASCII, so its code-point
 index is also its UTF-16 index and the slice is exact.

 @param text - trimmed paragraph

 @returns Text after the last leading marker, trimmed

 @example
 ```ts
 withoutQuoteMarkers({ text: '>> > TBD', },); // 'TBD'
 ```
 */
function withoutQuoteMarkers({ text, }: { readonly text: string; },): string {
  /**
   Index of the first character past the markers, or -1 when none is.
   */
  const contentStart = Array.from(text,)
    .findIndex(function isContent(character,): boolean {
      return (character !== QUOTE_MARKER) && (character !== ' ');
    },);
  return (contentStart === (-1))
    ? ''
    : text.slice(contentStart,)
      .trim();
}

/**
 Text without one code span around the whole of it.

 @param text - paragraph after its quote markers

 @returns Text inside the span, or the text unchanged when it wears none

 @example
 ```ts
 withoutCodeSpan({ text: '`WIP`', },); // 'WIP'
 ```
 */
function withoutCodeSpan({ text, }: { readonly text: string; },): string {
  /**
   Whether one span wraps the whole text with something inside it that is not
   itself a delimiter, so a double-backtick span is left as it is.
   */
  const wears = text.startsWith(CODE_SPAN,)
    && text.endsWith(CODE_SPAN,)
    && (text.length > (CODE_SPAN.length + CODE_SPAN.length))
    && (!text.startsWith(CODE_SPAN.repeat(2,),));
  return wears
    ? text
      .slice(
        CODE_SPAN.length,
        -CODE_SPAN.length,
      )
      .trim()
    : text;
}

/**
 Whether one paragraph is nothing but a placeholder token.

 @param paragraph - paragraph text; whitespace, blockquote markers at any
 depth, one code span and one layer of brackets tolerated

 @returns Whether it names no content

 @example
 ```ts
 isStubMarkerParagraph({ paragraph: '(To-Do)', },);
 ```
 */
export function isStubMarkerParagraph({ paragraph, }: { readonly paragraph: string; },): boolean {
  /**
   Paragraph without its surrounding whitespace, its blockquote markers and
   one code span.
   */
  const trimmed = withoutCodeSpan({ text: withoutQuoteMarkers({ text: paragraph.trim(), },), },);
  /**
   Paragraph without one layer of brackets, when it wore one.
   */
  const unwrapped = MARKER_WRAPS.reduce(
    function unwrap(
      text: string,
      wrap: MarkerWrap,
    ): string {
      /**
       Opening and closing bracket of this pair.
       */
      const {
        open,
        close,
      } = wrap;
      /**
       Whether the text wears this pair with something inside it.
       */
      const wears = text.startsWith(open,)
        && text.endsWith(close,)
        && (text.length > (open.length + close.length));
      if (!wears)
        return text;
      /**
       Text between the brackets.
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
 One retained normalized line with its unchanged pinned-file position.

 @example
 ```ts
 const retained: ArchiveRetainedLine = { text: 'Cat.', lineNumber: 3 };
 ```
 */
export type ArchiveRetainedLine = {
  /**
   Exact line after invisible-character normalization.
   */
  readonly text: string;
  /**
   One-based pinned-file line before any marker or adjacent blank removal.
   */
  readonly lineNumber: number;
};

/**
 Removes every paragraph that is nothing but a placeholder token.

 ONE LINEAR PASS over the lines, with HTML comments masked first so a marker
 inside a comment is left alone: the masked text keeps every newline, so its
 lines index the original's exactly. A marker paragraph is one line whose
 previous kept line is blank or absent and whose next line is blank or
 absent, outside front matter and code fences. The marker goes with one
 adjacent blank line: the following one, or the preceding one at the end of
 the document, so the page keeps single blank lines between blocks.

 @param text - archive text after the invisible-variant fold

 @returns Text without the markers, and each marker removed with its line

 @example
 ```ts
 const { text, stripped, lines, } = stripStubMarkersWithOrigins({ text: archive, },);
 ```
 */
export function stripStubMarkersWithOrigins(
  { text, }: { readonly text: string; },
): {
  readonly text: string;
  readonly stripped: readonly StrippedStubMarker[];
  readonly lines: readonly ArchiveRetainedLine[];
} {
  /**
   Original lines.
   */
  const lines = text.split('\n',);
  /**
   Same lines with every comment blanked, so a comment line differs from its
   original and a marker inside one is never read as a paragraph.
   */
  const maskedLines = maskHtmlComments({ text, },)
    .masked
    .split('\n',);
  /**
   Whether the document opens with front matter.
   */
  const opensWithFrontMatter = lines[0] === FRONT_MATTER_FENCE;

  // ONE PASS THAT APPENDS. The scan was a fold that copied every line kept so
  // far at each line, so the pass this function's summary calls linear cost
  // the square of the line count (ledger B70).
  /**
   Lines kept so far.
   */
  const kept: ArchiveRetainedLine[] = [];
  /**
   Markers removed so far.
   */
  const stripped: StrippedStubMarker[] = [];
  /**
   Where the scan stands: inside the leading front matter, inside a fenced
   code block, and whether the next line, if blank, is the blank a removed
   marker owned.
   */
  const scan = {
    inFrontMatter: opensWithFrontMatter,
    inFence: false,
    skipBlank: false,
  };
  for (const [index, line,] of lines.entries()) {
    /**
     Text and original position stay in one record through every keep or removal branch.
     */
    const retainedLine: ArchiveRetainedLine = {
      text: line,
      lineNumber: index + 1,
    };
    /**
     This line as masked, unchanged when no comment touches it.
     */
    const maskedLine = nonNullishOrThrow(maskedLines[index],);
    if (scan.inFrontMatter) {
      kept.push(retainedLine,);
      scan.inFrontMatter = !((index > 0) && (line === FRONT_MATTER_FENCE));
      continue;
    }
    if (maskedLine.trimStart()
      .startsWith(CODE_FENCE,)) {
      kept.push(retainedLine,);
      scan.inFence = !scan.inFence;
      scan.skipBlank = false;
      continue;
    }
    if (scan.inFence) {
      kept.push(retainedLine,);
      continue;
    }
    if (scan.skipBlank && (line.trim() === '')) {
      scan.skipBlank = false;
      continue;
    }
    /**
     Whether no comment covers any of this line.
     */
    const outsideComment = maskedLine === line;
    /**
     Last kept line, or nothing at the document's start.
     */
    const previous = kept
      .at(-1,)
      ?.text
      ?? '';
    /**
     Whether nothing kept stands directly above.
     */
    const previousBlank = previous.trim() === '';
    /**
     Line after this one, absent when the document ends here.
     */
    const next = lines[index + 1];
    /**
     Whether the document ends with this line.
     */
    const atEnd = next === undefined;
    /**
     Whether the paragraph ends with this line.
     */
    const nextBlank = atEnd || (next.trim() === '');
    /**
     Whether this line stands as a paragraph of its own.
     */
    const standsAlone = outsideComment
      && previousBlank
      && nextBlank;
    /**
     Whether this line is a placeholder paragraph of its own.
     */
    const isMarker = standsAlone && isStubMarkerParagraph({ paragraph: line, },);
    if (!isMarker) {
      kept.push(retainedLine,);
      scan.skipBlank = false;
      continue;
    }
    /**
     Whether the blank above goes, since no line follows to give up its
     blank instead.
     */
    const dropsBlankAbove = atEnd
      && previousBlank
      && (kept.length > 0);
    if (dropsBlankAbove)
      kept.pop();
    stripped.push({
      lineNumber: index + 1,
      text: line,
    },);
    scan.skipBlank = !atEnd;
  }
  return {
    text: kept
      .map(function lineText(line,): string {
        return line.text;
      },)
      .join('\n',),
    stripped,
    lines: kept,
  };
}

//endregion Archive stub markers
