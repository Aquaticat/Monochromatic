//region Title reference scope
// THE PART OF A SLICE'S PAGE TEXT A TITLE SEARCH READS. A definitions tail
// carries several footnotes, each quoting its own title, so a whole-slice
// search for one quoted span reads ambiguous; where the original references
// the title on a footnote definition line, the search is held to the page's
// line with the same label.

/**
 Newline, which no span crosses.
 */
const LINE_END = '\n';

/**
 Opening of a footnote definition's label.
 */
const LABEL_OPEN = '[^';

/**
 Closing of a footnote definition's label.
 */
const LABEL_CLOSE = ']:';

/**
 One span of the page text.
 */
export type Span = {
  /**
   Offset of the span's first character.
   */
  readonly start: number;

  /**
   Offset just past the span.
   */
  readonly end: number;
};

/**
 Footnote label a definition line opens with, empty where the line is no
 definition.

 @param line - one line

 @returns Label from `[^` to `]:`

 @example
 ```ts
 footnoteLabel({ line: '[^6]: See the section.', },); // '[^6]:'
 ```
 */
function footnoteLabel({ line, }: { readonly line: string; },): string {
  if (!line.startsWith(LABEL_OPEN,))
    return '';
  /**
   Offset of the label's close, -1 for none.
   */
  const close = line.indexOf(LABEL_CLOSE,);
  if (close === (-1))
    return '';
  return line.slice(
    0,
    close + LABEL_CLOSE.length,
  );
}

/**
 Offset of the line in a text that opens with a label, -1 for none.

 @param pageText - page text of the slice

 @param label - footnote label

 @returns Offset of the line's first character

 @example
 ```ts
 lineStartingWith({ pageText: '[^5]: A.\n\n[^6]: B.', label: '[^6]:', },); // 10
 ```
 */
function lineStartingWith(
  {
    pageText,
    label,
  }: {
    readonly pageText: string;
    readonly label: string;
  },
): number {
  if (pageText.startsWith(label,))
    return 0;
  /**
   Offset of the newline before the labelled line, -1 for none.
   */
  const at = pageText.indexOf(`${LINE_END}${label}`,);
  return (at === (-1)) ? -1 : at + LINE_END.length;
}

/**
 Span of the page text a bracket or quote search reads: the page's
 definition line where the original references the title on a footnote
 definition line, the whole text otherwise.

 @param sourceText - original text of the slice, comments cut

 @param pageText - page text of the slice

 @param title - Han title

 @returns Span to search

 @example
 ```ts
 referenceScope({ sourceText: '[^6]: 见「猫」篇', pageText: '[^6]: See “Cat”.', title: '猫', },); // whole line
 ```
 */
export function referenceScope(
  {
    sourceText,
    pageText,
    title,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
    readonly title: string;
  },
): Span {
  for (const line of sourceText.split(LINE_END,)) {
    if (!line.includes(title,))
      continue;
    /**
     Label the referencing line opens with, if it is a definition.
     */
    const label = footnoteLabel({ line, },);
    if (label === '')
      continue;
    /**
     Offset of the page's line with the same label, -1 for none.
     */
    const start = lineStartingWith({
      pageText,
      label,
    },);
    if (start === (-1))
      continue;
    /**
     Offset of that line's end, -1 for the text's end.
     */
    const end = pageText.indexOf(
      LINE_END,
      start,
    );
    return {
      start,
      end: (end === (-1)) ? pageText.length : end,
    };
  }
  return {
    start: 0,
    end: pageText.length,
  };
}

/**
 One rendering located in the page text.
 */
export type LocatedTitle = {
  /**
   Shape the rendering stands in.
   */
  readonly kind: 'link' | 'gloss' | 'bracket' | 'quote';

  /**
   Offset of the rendering's first character.
   */
  readonly start: number;

  /**
   Offset just past the rendering.
   */
  readonly end: number;
};

/**
 Outcome of a search: a located rendering, an ambiguous slice, or none.
 */
export type TitleLocation = LocatedTitle | { readonly kind: 'ambiguous'; } | { readonly kind: 'none'; };

//endregion Title reference scope
