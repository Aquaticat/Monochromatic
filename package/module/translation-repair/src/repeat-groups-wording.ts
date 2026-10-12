import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  isCommentFinding,
  type ParseFinding,
  type RepairDocument,
} from './parse-document.ts';
import {
  BREAK,
  QUOTE_CLOSERS,
  QUOTE_OPENERS,
  TAG_LETTERS,
  URL_SCHEMES,
} from './repeat-groups-bounds.ts';
import type { WordingStream, } from './repeat-groups-types.ts';

//region Repeat groups wording
// The wording stream of a page: the characters of its body paragraphs, with
// breaks where inline markup cuts a run and where a paragraph ends. Blocks are
// read off the package's parse (`parseDocument`), so front matter, headings,
// blockquotes, footnote definitions, lists and code never reach this reading.
// The parse also reports the HTML comments it blanked before reading, and those
// are cut here too, since a reader never sees them.

/**
 Index of the first close character after a start, when no line break comes first.

 @param body - raw paragraph text

 @param from - index to search from

 @param close - character sought

 @returns Index of the close character, or minus one when a line break or the end comes first

 @example
 ```ts
 const close = closingIndex({ body: '`code`', from: 1, close: '`', },);
 ```
 */
function closingIndex(
  {
    body,
    from,
    close,
  }: {
    readonly body: string;
    readonly from: number;
    readonly close: string;
  },
): number {
  for (let index = from; index < body.length; index++) {
    /**
     Character at this index.
     */
    const char = body.charAt(index,);
    if (char === close)
      return index;
    if (char === '\n')
      return -1;
  }
  return -1;
}

/**
 Index one past the inline cut that begins at an index, or minus one when no cut begins there.

 Bare URLs, inline code, footnote references and link destinations are cut;
 each is matched the way the single-line patterns read them, so a cut never
 crosses a line break.

 @param body - raw paragraph text

 @param index - index the cut must begin at

 @returns Exclusive end of the cut, or minus one

 @example
 ```ts
 const end = cutEndAt({ body: 'see https://cat.example.invalid/x now', index: 4, },);
 ```
 */
function cutEndAt(
  {
    body,
    index,
  }: {
    readonly body: string;
    readonly index: number;
  },
): number {
  for (const scheme of URL_SCHEMES) {
    if (!body.startsWith(
      scheme,
      index,
    ))
      continue;
    /**
     End of the URL: its scheme, then every character up to a space.
     */
    let end = index + scheme.length;
    while ((end < body.length) && (body.charAt(end,)
      .trim()
      !== ''))
      end++;
    return (end > (index
      + scheme.length)) ? end : -1;
  }

  /**
   Character the cut could begin with.
   */
  const opener = body.charAt(index,);
  if (opener === '`') {
    /**
     Closing backtick of the inline code.
     */
    const close = closingIndex({
      body,
      from: index + 1,
      close: '`',
    },);
    return (close < 0) ? -1 : close + 1;
  }
  if ((opener === '[') && (body.charAt(index + 1,) === '^')) {
    /**
     Closing bracket of the footnote reference.
     */
    const close = closingIndex({
      body,
      from: index + 2,
      close: ']',
    },);
    return (close < 0) ? -1 : close + 1;
  }
  if ((opener === ']') && (body.charAt(index + 1,) === '(')) {
    /**
     Closing parenthesis of the link destination.
     */
    const close = closingIndex({
      body,
      from: index + 2,
      close: ')',
    },);
    return (close < 0) ? -1 : close + 1;
  }
  return -1;
}

/**
 Indexes of a paragraph that inline cuts cover, scanned left to right so that
 a cut consumes its own text, as a global pattern does.

 @param body - raw paragraph text

 @returns Set of covered indexes

 @example
 ```ts
 const covered = cutSetOf({ body: '猫咪`代码`', },);
 ```
 */
function cutSetOf({ body, }: { readonly body: string; },): ReadonlySet<number> {
  /**
   Indexes covered by a cut.
   */
  const covered = new Set<number>();

  /**
   Index being scanned.
   */
  let index = 0;
  while (index < body.length) {
    /**
     End of the cut beginning here, or minus one.
     */
    const cutEnd = cutEndAt({
      body,
      index,
    },);
    if (cutEnd < 0) {
      index++;
      continue;
    }
    for (let inside = index; inside < cutEnd; inside++)
      covered.add(inside,);
    index = cutEnd;
  }
  return covered;
}

/**
 Whether a paragraph carries an inline tag or an expression, which makes the
 whole paragraph markup, since its inner text is not wording apart from the tag.

 @param body - raw paragraph text

 @returns Whether a tag opens in the text or an expression brace appears

 @example
 ```ts
 const markup = hasMarkupOpener({ body: '猫咪<b>晒</b>', },);
 ```
 */
function hasMarkupOpener({ body, }: { readonly body: string; },): boolean {
  if (body.includes('{',))
    return true;
  for (let index = 0; (index + 1) < body.length; index++) {
    if (body.charAt(index,) !== '<')
      continue;
    /**
     Character after the less-than sign.
     */
    const next = body.charAt(index + 1,);
    if ((next === '/') || TAG_LETTERS.includes(next,))
      return true;
  }
  return false;
}

/**
 Indexes of a paragraph that an HTML comment covers, where the parse blanked
 the comment before reading the page.

 @param findings - the parse's comment findings, with absolute offsets

 @param startOffset - absolute offset where the paragraph begins

 @param endOffset - absolute exclusive offset where the paragraph ends

 @returns Set of covered indexes, relative to the paragraph's start

 @example
 ```ts
 const covered = commentCoverOf({ findings, startOffset: 0, endOffset: 12, },);
 ```
 */
function commentCoverOf(
  {
    findings,
    startOffset,
    endOffset,
  }: {
    readonly findings: readonly ParseFinding[];
    readonly startOffset: number;
    readonly endOffset: number;
  },
): ReadonlySet<number> {
  /**
   Indexes covered by a comment.
   */
  const covered = new Set<number>();
  for (const finding of findings) {
    if (!isCommentFinding({ finding, },))
      continue;
    for (
      let offset = Math.max(
        finding.startOffset,
        startOffset,
      );
      offset < Math.min(
        finding.endOffset,
        endOffset,
      );
      offset++
    )
      covered.add(offset - startOffset,);
  }
  return covered;
}

/**
 Absolute exclusive end offset of one character of the wording stream.

 @param wording - wording stream of the page

 @param index - stream index of a character, never a break

 @returns Offset one past the character's last UTF-16 unit

 @example
 ```ts
 const end = wordingEndAt({ wording, index: 11, },);
 ```
 */
export function wordingEndAt(
  {
    wording,
    index,
  }: {
    readonly wording: WordingStream;
    readonly index: number;
  },
): number {
  return nonNullishOrThrow(wording.offsets[index],)
    + nonNullishOrThrow(wording.chars[index],)
    .length;
}

/**
 Reads the body paragraphs of a parsed document as one wording stream.

 A paragraph carrying markup is left out whole. An inline cut, and an HTML
 comment the parse blanked, leaves a break, and so does the end of each
 paragraph. Whitespace is dropped without a break, since the rule compares
 non-space characters. A stray closing quotation mark leaves the depth at zero,
 so later quoted speech in the paragraph still reads as quoted.

 @param text - full page text, the offsets of the document's nodes index into it

 @param document - parsed page

 @returns Wording characters with their offsets and quotation depths

 @example
 ```ts
 const stream = wordingStreamOf({ text, document, },);
 ```
 */
export function wordingStreamOf(
  {
    text,
    document,
  }: {
    readonly text: string;
    readonly document: RepairDocument;
  },
): WordingStream {
  /**
   Wording characters, in page order.
   */
  const chars: string[] = [];

  /**
   Absolute offset of each wording character, minus one at a break.
   */
  const offsets: number[] = [];

  /**
   Quotation depth before each wording character.
   */
  const depths: number[] = [];

  for (const node of document.nodes) {
    if ((node.zone !== 'body') || (node.kind !== 'paragraph'))
      continue;

    /**
     Raw source text of this paragraph.
     */
    const body = text.slice(
      node.startOffset,
      node.endOffset,
    );
    if (hasMarkupOpener({ body, },))
      continue;

    /**
     Indexes of this paragraph that inline cuts cover.
     */
    const covered = new Set([
      ...cutSetOf({ body, },),
      ...commentCoverOf({
        findings: document.parseFindings,
        startOffset: node.startOffset,
        endOffset: node.endOffset,
      },),
    ],);

    /**
     Open quotation depth so far in this paragraph.
     */
    let depth = 0;

    /**
     Whether the last character pushed was a break, so that no two breaks stand together.
     */
    let broken = true;
    /**
     UTF-16 index of the character being read, which a character outside the basic plane advances by two.
     */
    let index = 0;
    for (const char of body) {
      /**
       Index this character stands at.
       */
      const here = index;
      index += char.length;
      if (covered.has(here,)) {
        if (!broken) {
          chars.push(BREAK,);
          offsets.push(-1,);
          depths.push(0,);
          broken = true;
        }
        continue;
      }
      if (char.trim() === '')
        continue;
      if (QUOTE_OPENERS.includes(char,))
        depth++;
      if (QUOTE_CLOSERS.includes(char,))
        depth = Math.max(
          0,
          depth - 1,
        );
      chars.push(char,);
      offsets.push(node.startOffset + here,);
      depths.push(depth,);
      broken = false;
    }
    if (!broken) {
      chars.push(BREAK,);
      offsets.push(-1,);
      depths.push(0,);
    }
  }

  return {
    chars,
    offsets,
    depths,
  };
}

//endregion Repeat groups wording
