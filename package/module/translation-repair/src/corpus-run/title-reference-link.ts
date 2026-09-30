import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { TitleLocation, } from './title-reference-scope.ts';

//region Title reference link
// A TITLE REFERENCE THE ORIGINAL WRITES AS A LINK (`《[title](url)》`),
// found on the page by the link's destination: the page's link at the title
// link's place among the links to that destination, its text read on the
// destination's line.

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
 Characters no link text holds: a newline, and the closing bracket of
 another link's text.
 */
const LINK_TEXT_BREAKS: ReadonlySet<string> = new Set([
  '\n',
  ']',
],);

/**
 The link the original wraps a title in: its destination, and the offset of
 its `](`; none where the original links no such title or the link never
 closes.
 */
export type TitleLink = {
  readonly kind: 'link';
  readonly destination: string;
  readonly middle: number;
} | { readonly kind: 'none'; };

/**
 The link the original wraps a title in.

 @param sourceText - original text of the slice

 @param title - Han title

 @returns Destination and middle of the title's link, or none

 @example
 ```ts
 titleLink({ sourceText: '《[猫](https://example.test/cat)》', title: '猫', },); // destination 'https://example.test/cat', middle 3
 ```
 */
export function titleLink(
  {
    sourceText,
    title,
  }: {
    readonly sourceText: string;
    readonly title: string;
  },
): TitleLink {
  /**
   Link text opening the original writes.
   */
  const opening = `${LINK_OPEN}${title}${LINK_MIDDLE}`;
  /**
   Offset of the link text opening, -1 for none.
   */
  const open = sourceText.indexOf(opening,);
  if (open === (-1))
    return { kind: 'none', };
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
    return { kind: 'none', };
  return {
    kind: 'link',
    destination: sourceText.slice(
      from,
      close,
    ),
    middle: from - LINK_MIDDLE.length,
  };
}

/**
 Offsets of the middle of every link to a destination in a text, in order.

 @param text - original or page text of the slice

 @param destination - link destination

 @returns Offset of each link's `](`

 @example
 ```ts
 linkMiddles({ text: '[a](u) [b](u)', destination: 'u', },); // [2, 9]
 ```
 */
function linkMiddles(
  {
    text,
    destination,
  }: {
    readonly text: string;
    readonly destination: string;
  },
): readonly number[] {
  /**
   Middle and destination of a link to it.
   */
  const needle = `${LINK_MIDDLE}${destination}${LINK_CLOSE}`;
  /**
   Offsets found so far.
   */
  const middles: number[] = [];
  for (
    let at = text.indexOf(needle,);
    at !== (-1);
    at = text.indexOf(
      needle,
      at + needle.length,
    )
  )
    middles.push(at,);
  return middles;
}

/**
 Link text ending at a link's middle, read leftward to the nearest `[`; none
 where a newline or another link's `]` comes first, or no `[` does.

 A LINK'S TEXT STANDS ON ITS DESTINATION'S LINE AND HOLDS NO BRACKET (ledger
 B57). Read back to the nearest `[` with no bound, a page link that lost its
 opening bracket took an earlier footnote line or another link with it, and
 the rewrite replaced them with the title; such a line renders no link.

 @param pageText - page text of the slice

 @param middle - offset of the `](` that ends the text

 @returns Located link text, or none

 @example
 ```ts
 linkTextBefore({ pageText: 'From [The Cat](https://example.test/cat)', middle: 13, },); // link 6 to 13
 ```
 */
function linkTextBefore(
  {
    pageText,
    middle,
  }: {
    readonly pageText: string;
    readonly middle: number;
  },
): TitleLocation {
  for (let at = middle - 1; at >= 0; at -= 1) {
    /**
     Character read leftward from the middle.
     */
    const character = pageText.charAt(at,);
    if (character === LINK_OPEN) {
      return {
        kind: 'link',
        start: at + LINK_OPEN.length,
        end: middle,
      };
    }
    if (LINK_TEXT_BREAKS.has(character,))
      return { kind: 'none', };
  }
  return { kind: 'none', };
}

/**
 Where the page renders the original's title link: the text of the page's
 link at the title link's place among the links to its destination.

 THE PAGE LINK AT THE TITLE LINK'S PLACE (ledger B59). The original may link
 the destination from other words as well as the title (`[这里](url)` and
 `《[title](url)》`), so the page's first link to it need not be the title's.
 Where the page links the destination as often as the original, the link at
 the same place is; where it links it a different number of times, which
 one is cannot be read.

 @param sourceText - original text of the slice

 @param pageText - page text of the slice

 @param link - the original's link around the title

 @returns Located link text, ambiguous, or none

 @example
 ```ts
 locateLink({ sourceText: '《[猫](u)》', pageText: 'From [The Cat](u)', link, },); // link 6 to 13
 ```
 */
export function locateLink(
  {
    sourceText,
    pageText,
    link,
  }: {
    readonly sourceText: string;
    readonly pageText: string;
    readonly link: Extract<TitleLink, { readonly kind: 'link'; }>;
  },
): TitleLocation {
  /**
   The page's links to the destination.
   */
  const pageMiddles = linkMiddles({
    text: pageText,
    destination: link.destination,
  },);
  if (pageMiddles.length === 0)
    return { kind: 'none', };
  /**
   The original's links to the destination, the title's among them.
   */
  const sourceMiddles = linkMiddles({
    text: sourceText,
    destination: link.destination,
  },);
  if (pageMiddles.length !== sourceMiddles.length)
    return { kind: 'ambiguous', };
  // The title's link closes at its destination's first `)`, so its middle is
  // one of the original's, and the page has a link at every place the
  // original has one.
  return linkTextBefore({
    pageText,
    middle: nonNullishOrThrow(pageMiddles[sourceMiddles.indexOf(link.middle,)],),
  },);
}

//endregion Title reference link
