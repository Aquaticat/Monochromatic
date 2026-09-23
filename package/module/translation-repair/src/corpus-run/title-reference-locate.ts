import { locateMarked, } from './title-reference-marks.ts';
import {
  referenceScope,
  type TitleLocation,
} from './title-reference-scope.ts';

export type {
  LocatedTitle,
  TitleLocation,
} from './title-reference-scope.ts';

//region Title reference locate
// WHERE A RENDERING OF A BRACKETED TITLE STANDS IN A SLICE'S PAGE TEXT. The
// original brackets a section title as a link (`《[title](url)》`), in
// title brackets (`《title》`) or in corner brackets (`「title」篇`); the
// bench renders it as a link with the same destination, as the English
// with the Han in parentheses after it, in title brackets, or in quotes.
// Each shape is found by index scan, the link by its destination, and a
// slice that offers two spans of the same shape is reported ambiguous
// rather than guessed at.

/**
 Opening of a Markdown link's text.
 */
const LINK_OPEN = '[';

/**
 Separator between a Markdown link's text and its destination.
 */
const LINK_MIDDLE = '](';

/**
 Closing of a Markdown link's destination.
 */
const LINK_CLOSE = ')';

/**
 Opening title bracket.
 */
const TITLE_OPEN = '《';

/**
 Closing title bracket.
 */
const TITLE_CLOSE = '》';

/**
 Opening parenthesis of a gloss.
 */
const GLOSS_OPEN = '(';

/**
 Closing parenthesis of a gloss.
 */
const GLOSS_CLOSE = ')';

/**
 Newline, which no span crosses.
 */
const LINE_END = '\n';

/**
 Quote pairs a title may stand in, opening then closing.
 */
const QUOTE_PAIRS: readonly (readonly [
  string,
  string,
])[] = [
  [
    '“',
    '”',
  ],
  [
    '"',
    '"',
  ],
];

/**
 Characters that end a gloss's English run when read leftward.
 */
const RUN_BOUNDARIES: ReadonlySet<string> = new Set([
  ',',
  ';',
  ':',
  '“',
  '”',
  '"',
  '‘',
  '’',
  '《',
  '》',
  '【',
  '】',
  '「',
  '」',
  '『',
  '』',
  '(',
  ')',
  '—',
  '–',
  LINE_END,
],);

/**
 Destination of the link the original wraps a title in, empty where the
 original links no such title.

 @param sourceText - original text of the slice

 @param title - Han title

 @returns Link destination

 @example
 ```ts
 linkDestination({ sourceText: '《[猫](https://example.test/cat)》', title: '猫', },); // 'https://example.test/cat'
 ```
 */
function linkDestination(
  {
    sourceText,
    title,
  }: {
    readonly sourceText: string;
    readonly title: string;
  },
): string {
  /**
   Link text opening the original writes.
   */
  const opening = `${LINK_OPEN}${title}${LINK_MIDDLE}`;
  /**
   Offset of the link text opening, -1 for none.
   */
  const open = sourceText.indexOf(opening,);
  if (open === (-1))
    return '';
  /**
   Offset of the destination's first character.
   */
  const from = open + opening.length;
  /**
   Offset of the destination's close, -1 for none.
   */
  const close = sourceText.indexOf(
    LINK_CLOSE,
    from,
  );
  if (close === (-1))
    return '';
  return sourceText.slice(
    from,
    close,
  );
}

/**
 Where the page renders a link to a destination: its link text.

 @param pageText - page text of the slice

 @param destination - link destination the original names

 @returns Located link text, or none

 @example
 ```ts
 locateLink({ pageText: 'From [The Cat](https://example.test/cat)', destination: 'https://example.test/cat', },);
 ```
 */
function locateLink(
  {
    pageText,
    destination,
  }: {
    readonly pageText: string;
    readonly destination: string;
  },
): TitleLocation {
  /**
   Offset of the link's middle before the destination, -1 for none.
   */
  const middle = pageText.indexOf(`${LINK_MIDDLE}${destination}${LINK_CLOSE}`,);
  if (middle === (-1))
    return { kind: 'none', };
  /**
   Offset of the link text's opening, -1 for none.
   */
  const open = pageText.lastIndexOf(
    LINK_OPEN,
    middle,
  );
  if (open === (-1))
    return { kind: 'none', };
  return {
    kind: 'link',
    start: open + LINK_OPEN.length,
    end: middle,
  };
}

/**
 Where the page renders the title as English with the Han in parentheses
 after it: the English run before the parenthesis.

 @param pageText - page text of the slice

 @param title - Han title

 @returns Located run, or none

 @example
 ```ts
 locateGlossed({ pageText: '—— Yumao, Caged Cat (笼中猫)', title: '笼中猫', },);
 ```
 */
function locateGlossed(
  {
    pageText,
    title,
  }: {
    readonly pageText: string;
    readonly title: string;
  },
): TitleLocation {
  /**
   Offset of the gloss's opening parenthesis, -1 for none.
   */
  const open = pageText.indexOf(`${GLOSS_OPEN}${title}${GLOSS_CLOSE}`,);
  if (open === (-1))
    return { kind: 'none', };
  /**
   Offset just past the run, before the spaces ahead of the parenthesis.
   */
  const end = trimmedEnd({
    pageText,
    from: open,
  },);
  /**
   Offset of the run's first character.
   */
  const start = runStart({
    pageText,
    end,
  },);
  if (start >= end)
    return { kind: 'none', };
  return {
    kind: 'gloss',
    start,
    end,
  };
}

/**
 Offset just past the last non-space character before an offset.

 @param pageText - page text of the slice

 @param from - offset the spaces end at

 @returns Offset just past the run

 @example
 ```ts
 trimmedEnd({ pageText: 'Cat  (猫)', from: 5, },); // 3
 ```
 */
function trimmedEnd(
  {
    pageText,
    from,
  }: {
    readonly pageText: string;
    readonly from: number;
  },
): number {
  for (let at = from; at > 0; at -= 1) {
    if (pageText.charAt(at - 1,) !== ' ')
      return at;
  }
  return 0;
}

/**
 Offset of the first character of the run that ends at an offset, read
 leftward to a boundary character or the line's start, spaces trimmed.

 @param pageText - page text of the slice

 @param end - offset just past the run

 @returns Offset of the run's first non-space character

 @example
 ```ts
 runStart({ pageText: '—— Yumao, Caged Cat (笼中猫)', end: 19, },); // 10
 ```
 */
function runStart(
  {
    pageText,
    end,
  }: {
    readonly pageText: string;
    readonly end: number;
  },
): number {
  /**
   Offset of the boundary the run stops at.
   */
  const boundary = boundaryBefore({
    pageText,
    end,
  },);
  for (let at = boundary; at < end; at += 1) {
    if (pageText.charAt(at,) !== ' ')
      return at;
  }
  return end;
}

/**
 Offset just past the nearest boundary character before an offset, zero
 for none.

 @param pageText - page text of the slice

 @param end - offset the leftward read starts at

 @returns Offset just past the boundary

 @example
 ```ts
 boundaryBefore({ pageText: 'a, b', end: 4, },); // 2
 ```
 */
function boundaryBefore(
  {
    pageText,
    end,
  }: {
    readonly pageText: string;
    readonly end: number;
  },
): number {
  for (let at = end; at > 0; at -= 1) {
    if (RUN_BOUNDARIES.has(pageText.charAt(at - 1,),))
      return at;
  }
  return 0;
}

/**
 Location moved by an offset, so a span found inside a scope is reported
 against the whole text.

 @param location - location inside the scope

 @param by - offset of the scope's first character

 @returns Location against the whole text

 @example
 ```ts
 shifted({ location: { kind: 'quote', start: 1, end: 4, }, by: 10, },); // 11 to 14
 ```
 */
function shifted(
  {
    location,
    by,
  }: {
    readonly location: TitleLocation;
    readonly by: number;
  },
): TitleLocation {
  if ((location.kind === 'none') || (location.kind === 'ambiguous'))
    return location;
  return {
    kind: location.kind,
    start: location.start + by,
    end: location.end + by,
  };
}

/**
 Where a slice's page text renders a title the original brackets: by the
 link's destination first, then by the Han gloss after the English, then
 by title brackets, then by quotes, the bracket and quote searches held to
 the page's definition line where the original references the title in a
 footnote definition.

 @param sourceText - original text of the slice, comments cut

 @param pageText - page text of the slice

 @param title - Han title as the original writes it

 @param rendering - heading's rendering the reference should carry

 @returns Located rendering, ambiguous, or none

 @example
 ```ts
 locateTitleRendering({ sourceText: '《猫》', pageText: '《Cat》', title: '猫', },); // bracket 1 to 4
 ```
 */
export function locateTitleRendering(
  {
    sourceText,
    pageText,
    title,
    rendering,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
    readonly title: string;
    readonly rendering: string;
  },
): TitleLocation {
  /**
   Destination the original links the title to, if it does.
   */
  const destination = linkDestination({
    sourceText,
    title,
  },);
  /**
   Link text, where the page links the same destination.
   */
  const linked = (destination === '')
    ? { kind: 'none', } as const
    : locateLink({
      pageText,
      destination,
    },);
  if (linked.kind !== 'none')
    return linked;
  /**
   English run before the Han gloss, where the page glosses.
   */
  const glossed = locateGlossed({
    pageText,
    title,
  },);
  if (glossed.kind !== 'none')
    return glossed;
  /**
   Span the bracket and quote searches read.
   */
  const scope = referenceScope({
    sourceText,
    pageText,
    title,
  },);
  /**
   Page text inside the scope.
   */
  const scoped = pageText.slice(
    scope.start,
    scope.end,
  );
  /**
   Title-bracketed span, where the page brackets.
   */
  const bracketed = locateMarked({
    pageText: scoped,
    pairs: [
      [
        TITLE_OPEN,
        TITLE_CLOSE,
      ],
    ],
    kind: 'bracket',
    rendering,
  },);
  if (bracketed.kind !== 'none')
    return shifted({
      location: bracketed,
      by: scope.start,
    },);
  return shifted({
    location: locateMarked({
      pageText: scoped,
      pairs: QUOTE_PAIRS,
      kind: 'quote',
      rendering,
    },),
    by: scope.start,
  },);
}

//endregion Title reference locate
