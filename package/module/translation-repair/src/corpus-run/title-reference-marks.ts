import type {
  Span,
  TitleLocation,
} from './title-reference-scope.ts';

//region Title reference marks
// A TITLE FOUND BETWEEN MARKS: title brackets or quotes, read by index scan
// on one line, a tag attribute's quoted value skipped, and several spans
// settled by the one that already carries the heading's rendering.

/**
 Newline, which no span crosses.
 */
const LINE_END = '\n';

/**
 Separator before a tag attribute's quoted value, which no title stands in.
 */
const ATTRIBUTE_EQUALS = '=';

/**
 Every span between an opening and a closing mark on one line.

 @param pageText - page text of the slice

 @param open - opening mark

 @param close - closing mark

 @returns Inner spans in order

 @example
 ```ts
 spansBetween({ pageText: '《Cat》', open: '《', close: '》', },); // [{ start: 1, end: 4, }]
 ```
 */
function spansBetween(
  {
    pageText,
    open,
    close,
  }: {
    readonly pageText: string;
    readonly open: string;
    readonly close: string;
  },
): readonly Span[] {
  /**
   Spans read so far.
   */
  const spans: Span[] = [];
  for (
    let at = pageText.indexOf(open,);
    at !== (-1);
    at = pageText.indexOf(
      open,
      at + 1,
    )
  ) {
    /**
     Offset of the closing mark, -1 for none.
     */
    const closeAt = pageText.indexOf(
      close,
      at + open.length,
    );
    if (closeAt === (-1))
      break;
    /**
     Inner span.
     */
    const inner = pageText.slice(
      at + open.length,
      closeAt,
    );
    /**
     Whether the opening mark stands in prose, not after an attribute's equals sign.
     */
    const prose = pageText.charAt(at - 1,) !== ATTRIBUTE_EQUALS;
    /**
     Whether the span stays on one line.
     */
    const oneLine = !inner.includes(LINE_END,);
    if (oneLine && prose)
      spans.push({
        start: at + open.length,
        end: closeAt,
      },);
    at = closeAt;
  }
  return spans;
}

/**
 Where the page renders the title inside one kind of marks: the one span
 where there is one, ambiguous where there are more.

 @param pageText - page text of the slice

 @param pairs - opening and closing marks to read

 @param kind - shape to report

 @param rendering - heading's rendering, which settles several spans where
 one already carries it

 @returns Located span, ambiguous, or none

 @example
 ```ts
 locateMarked({ pageText: '《Cat》', pairs: [['《', '》']], kind: 'bracket', },);
 ```
 */
export function locateMarked(
  {
    pageText,
    pairs,
    kind,
    rendering,
  }: {
    readonly pageText: string;
    readonly pairs: readonly (readonly [
      string,
      string,
    ])[];
    readonly kind: 'bracket' | 'quote';
    readonly rendering: string;
  },
): TitleLocation {
  /**
   Every span of every pair.
   */
  const spans = pairs.flatMap(function spansOf([
    open,
    close,
  ],): readonly Span[] {
    return spansBetween({
      pageText,
      open,
      close,
    },);
  },);
  if (spans.length === 0)
    return { kind: 'none', };
  /**
   Spans that already carry the heading's rendering.
   */
  const carrying = spans.filter(function carries(span,): boolean {
    return pageText.slice(
      span.start,
      span.end,
    )
      .startsWith(rendering,);
  },);
  if ((spans.length > 1) && (carrying.length !== 1))
    return { kind: 'ambiguous', };
  /**
   The one span, or the one carrying the heading.
   */
  const [span,] = (spans.length > 1) ? carrying : spans;
  if (span === undefined)
    return { kind: 'none', };
  return {
    kind,
    ...span,
  };
}

//endregion Title reference marks
