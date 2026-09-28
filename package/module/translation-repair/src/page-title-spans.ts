import { carriesHan, } from './han-only-text.ts';
import { pairedPageNames, } from './page-name-glossary.ts';
import { visibleText, } from './page-visible-text.ts';

//region Page title spans
// LEDGER H16 (2026-09-28). Each slice is written and judged alone, and where
// the archive renders a passage its English anchors the slice; where it does
// not, a title the page repeats reaches every slice's bench with nothing
// saying how the others rendered it. XingZ60's partial archive shipped one
// section title in three forms: its heading, its attribution and a footnote
// naming it. The page-name glossary (`page-name-glossary.ts`) carries the
// titles and names the archive pairs; these are the ones it leaves, which the
// preparation settles once per page (`corpus-run/pass-page-titles.ts`).
//
// A TITLE IS A MARKED SPAN: heading text (Markdown or HTML), 《…》, 【…】, or
// 「…」 where the same words stand in one of those elsewhere on the page, since
// 「」 alone marks quotations and dialogue far more often than titles.

/**
 Longest span read as a title, in code points; a longer one is a sentence.
 */
const LONGEST_TITLE = 24;

/**
 Highest HTML heading level.
 */
const DEEPEST_HEADING = 6;

/**
 One title the page repeats and the archive leaves unpaired.

 @example
 ```ts
 const span: RepeatedTitleSpan = { source: '猫之歌', occurrences: 3, };
 ```
 */
export type RepeatedTitleSpan = {
  /**
   Title as the original writes it.
   */
  readonly source: string;

  /**
   Marked places it stands on the page.
   */
  readonly occurrences: number;
};

/**
 Link text of a span written as a Markdown link, the span itself otherwise.

 @param span - text inside the markers

 @returns Text a reader sees

 @example
 ```ts
 shownText({ span: '[猫之歌](https://example.invalid/song)', },); // '猫之歌'
 ```
 */
function shownText({ span, }: { readonly span: string; },): string {
  /**
   Span without surrounding space.
   */
  const trimmed = span.trim();
  /**
   Where the link's text closes, -1 for no link.
   */
  const close = trimmed.indexOf('](',);
  return (trimmed.startsWith('[',) && (close !== (-1))) ? trimmed.slice(
    1,
    close,
  ) : trimmed;
}

/**
 Texts between an opening and a closing marker, by one linear scan.

 @param text - page text

 @param open - opening marker

 @param close - closing marker

 @returns Each span's shown text, in order

 @example
 ```ts
 spansBetween({ text: '《猫》与《狗》', open: '《', close: '》', },); // ['猫', '狗']
 ```
 */
function spansBetween(
  {
    text,
    open,
    close,
  }: {
    readonly text: string;
    readonly open: string;
    readonly close: string;
  },
): readonly string[] {
  /**
   Spans found.
   */
  const spans: string[] = [];
  for (
    let at = text.indexOf(open,);
    at !== (-1);
    at = text.indexOf(
      open,
      at + open.length,
    )
  ) {
    /**
     Where this span closes.
     */
    const end = text.indexOf(
      close,
      at + open.length,
    );
    if (end === (-1))
      break;
    spans.push(shownText({ span: text.slice(
      at + open.length,
      end,
    ), },),);
  }
  return spans;
}

/**
 Markdown heading texts, the markers off.

 @param text - page text

 @returns Every ATX heading's text

 @example
 ```ts
 markdownHeadings({ text: '## 猫之歌\n\n喵。', },); // ['猫之歌']
 ```
 */
function markdownHeadings({ text, }: { readonly text: string; },): readonly string[] {
  return text
    .split('\n',)
    .flatMap(function toHeading(line,): readonly string[] {
      // The markers are single ASCII units, so an index walks them.
      for (let depth = 0; depth < line.length; depth += 1) {
        if (line.charAt(depth,) === '#')
          continue;
        if ((depth === 0) || (depth > DEEPEST_HEADING)
          || (line.charAt(depth,) !== ' '))
          return [];
        return [line.slice(depth,)
          .trim(),];
      }
      return [];
    },);
}

/**
 HTML heading texts (`<h1>` to `<h6>`), where the heading holds no nested tag.

 @param text - page text

 @returns Every such heading's text

 @example
 ```ts
 htmlHeadings({ text: '<h3 align="center">猫之歌</h3>', },); // ['猫之歌']
 ```
 */
function htmlHeadings({ text, }: { readonly text: string; },): readonly string[] {
  /**
   Headings found.
   */
  const headings: string[] = [];
  for (
    let at = text.indexOf('<h',);
    at !== (-1);
    at = text.indexOf(
      '<h',
      at + 1,
    )
  ) {
    /**
     Heading level, NaN where `<h` opens another tag.
     */
    const level = Math.trunc(
      Number(text.charAt(at + 2,),),
    );
    if (!((level >= 1) && (level <= DEEPEST_HEADING)))
      continue;
    /**
     End of the opening tag.
     */
    const opened = text.indexOf(
      '>',
      at,
    );
    /**
     Start of the closing tag.
     */
    const closing = text.indexOf(
      `</h${String(level,)}>`,
      opened,
    );
    if ((opened === (-1)) || (closing === (-1)))
      break;
    /**
     Heading content.
     */
    const inner = text.slice(
      opened + 1,
      closing,
    );
    if (!inner.includes('<',))
      headings.push(inner.trim(),);
  }
  return headings;
}

/**
 Code points in a text, counted by walking it.

 @param text - text to count

 @returns Code points

 @example
 ```ts
 codePointCount({ text: '猫😺', },); // 2
 ```
 */
function codePointCount({ text, }: { readonly text: string; },): number {
  /**
   Code points seen.
   */
  const seen = { count: 0, };
  for (const character of text) {
    if (character !== '')
      seen.count += 1;
  }
  return seen.count;
}

/**
 Titles a page repeats that the archive leaves unpaired: each title-marked span
 carrying Han that stands in two or more marked places on what the page shows,
 minus the source texts the page-name glossary pairs.

 @param sourceText - whole original document

 @param targetText - whole archive document

 @returns Repeated titles in order of first appearance

 @example
 ```ts
 const spans = repeatedTitleSpans({ sourceText, targetText, },);
 ```
 */
export function repeatedTitleSpans(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): readonly RepeatedTitleSpan[] {
  /**
   What the original shows.
   */
  const shown = visibleText({ text: sourceText, },);
  /**
   Spans the page marks as titles in their own right.
   */
  const titled = [
    ...markdownHeadings({ text: shown, },),
    ...htmlHeadings({ text: shown, },),
    ...spansBetween({
      text: shown,
      open: '《',
      close: '》',
    },),
    ...spansBetween({
      text: shown,
      open: '【',
      close: '】',
    },),
  ];
  /**
   Those spans, for the quotation rule.
   */
  const titles = new Set(titled,);
  /**
   Quoted spans that repeat a title.
   */
  const quoted = spansBetween({
    text: shown,
    open: '「',
    close: '」',
  },)
    .filter(function repeatsTitle(span,): boolean {
      return titles.has(span,);
    },);
  /**
   Titles the page-name glossary already carries.
   */
  const paired = pairedPageNames({
    sourceText,
    targetText,
  },);
  /**
   Marked places per title, in order of first appearance.
   */
  const counts = [
    ...titled,
    ...quoted,
  ].reduce(
    function tally(
      seen,
      span,
    ) {
      seen.set(
        span,
        (seen.get(span,) ?? 0) + 1,
      );
      return seen;
    },
    new Map<string, number>(),
  );
  return [...counts.entries(),]
    .filter(function repeatedAndUnpaired([span, occurrences,],): boolean {
      return (occurrences >= 2)
        && carriesHan({ text: span, },)
        && (codePointCount({ text: span, },) <= LONGEST_TITLE)
        && (!paired.has(span,));
    },)
    .map(function toSpan([source, occurrences,],): RepeatedTitleSpan {
      return {
        source,
        occurrences,
      };
    },);
}

//endregion Page title spans
