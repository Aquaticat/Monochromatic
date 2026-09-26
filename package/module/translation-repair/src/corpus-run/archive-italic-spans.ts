import type { ChunkPair, } from '../chunk-document.ts';

//region Archive italic spans
// The words the archive sets in single-star italics, read for class one
// hundred seventy-three's title restore. A line cut at every star leaves the
// italic words at the odd pieces; a bold span's two stars make an empty piece
// on each side, so its words fall at an even piece and are never read as
// italics. A list item's opening star is cut off first so it does not shift
// the count.

/**
 Opening of a list item written with a star.
 */
const STAR_ITEM = '* ';

/**
 Whether a span reads as a title: no space at either edge and a capital Latin
 letter first, as a work's name opens.

 @param span - words between two stars

 @returns Whether the span can name a work

 @example
 ```ts
 titleLike({ span: 'Long Nap', },); // true
 ```
 */
function titleLike({ span, }: { readonly span: string; },): boolean {
  /**
   First character of the span.
   */
  const first = span.charAt(0,);
  return (span.length > 0)
    && (span.trim() === span)
    && (first >= 'A')
    && (first <= 'Z');
}

/**
 Italic spans of one line.

 @param line - one line of archive text

 @returns Words the line sets in single-star italics

 @example
 ```ts
 lineItalics({ line: 'She loved *Long Nap* and **Nap Time**.', },); // ['Long Nap']
 ```
 */
function lineItalics({ line, }: { readonly line: string; },): readonly string[] {
  /**
   Line without a list item's opening star.
   */
  const body = line.trimStart()
    .startsWith(STAR_ITEM,)
    ? line.trimStart()
      .slice(STAR_ITEM.length,)
    : line;
  return body
    .split('*',)
    .filter(function italic(
      span,
      index,
    ): boolean {
      return ((index % 2) === 1) && titleLike({ span, },);
    },);
}

/**
 Every span the archive's body sets in single-star italics.

 @param slices - prepared pairs, whose target text is the archive's

 @returns Italic spans, once each

 @example
 ```ts
 archiveItalicSpans({ slices, },); // Set { 'Long Nap' }
 ```
 */
export function archiveItalicSpans(
  { slices, }: { readonly slices: readonly ChunkPair[]; },
): ReadonlySet<string> {
  return new Set(slices
    .filter(function isBody(slice,): boolean {
      return slice.syntax !== 'front-matter';
    },)
    .flatMap(function readSlice(slice,): readonly string[] {
      return slice.target
        .text
        .split('\n',)
        .flatMap(function readLine(line,): readonly string[] {
          return lineItalics({ line, },);
        },);
    },),);
}

//endregion Archive italic spans
