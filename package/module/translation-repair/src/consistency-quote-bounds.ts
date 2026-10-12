import { rendersAsNothing, } from './renders-as-nothing.ts';

//region Consistency quote bounds
// WHERE A QUOTE'S WORDS BEGIN AND END. A judge quotes the words of a place's
// English with the space that happened to open them and the punctuation that
// happened to close them, and a quote that carries either beside one that does
// not still agrees. The words a replacement takes or gives are the quote
// without both, read one whole character at a time so a character beyond the
// first plane is never cut in halves.

/**
 Characters that close a sentence or a clause, taken off the end of a quote
 before it is compared or replaced, so a quote that carries the punctuation
 beside one that does not still agree.
 */
const CLOSING_PUNCTUATION = '.,;:!?…。！？，；：、';

/**
 What a search answers when it found nothing.
 */
const NOT_FOUND = -1;

/**
 First code point of the variation selectors of the basic plane.
 */
const FIRST_VARIATION_SELECTOR = 0xFE_00;

/**
 Last code point of the variation selectors of the basic plane.
 */
const LAST_VARIATION_SELECTOR = 0xFE_0F;

/**
 Whether a code point stays with the character before it when a quote is cut,
 such as a variation selector that makes the heart before it an emoji.

 @param point - one whole character

 @returns Whether it is a variation selector of the basic plane

 @example
 ```ts
 const stays = isVariationSelector({ point: String.fromCodePoint(0xFE0F,), },); // true
 ```
 */
function isVariationSelector({ point, }: { readonly point: string; },): boolean {
  /**
   Code point of the character.
   */
  const code = point.codePointAt(0,);
  return (code !== undefined)
    && (code >= FIRST_VARIATION_SELECTOR)
    && (code <= LAST_VARIATION_SELECTOR);
}

/**
 Whether a character closes a quote without being part of its words.

 @param point - one whole character

 @returns Whether it is closing punctuation, space or an invisible character,
 and no variation selector

 @example
 ```ts
 const closes = isClosing({ point: '.', },); // true
 ```
 */
export function isClosing({ point, }: { readonly point: string; },): boolean {
  if (isVariationSelector({ point, },))
    return false;
  return CLOSING_PUNCTUATION.includes(point,) || rendersAsNothing({ text: point, },);
}

/**
 An index as a position, or a stand-in where the search found nothing.

 @param index - index a search returned, minus one when it found nothing

 @param otherwise - position to use then

 @returns The index, or the stand-in

 @example
 ```ts
 const position = nonNegativeOr({ index: -1, otherwise: 4, },); // 4
 ```
 */
function nonNegativeOr(
  {
    index,
    otherwise,
  }: {
    readonly index: number;
    readonly otherwise: number;
  },
): number {
  return (index === NOT_FOUND) ? otherwise : index;
}

/**
 Where a quote's words begin and end: after the space and invisible characters
 that open it, and before the punctuation, space and invisible characters that
 close it. A variation selector stays with the character it follows.

 @param quote - words as a judge quoted them

 @returns Offsets in the quote, in UTF-16 units, of the first unit the words
 keep and one past the last

 @example
 ```ts
 const bounds = quoteBounds({ quote: ' the cat naps.', },); // { start: 1, end: 13 }
 ```
 */
export function quoteBounds(
  { quote, }: { readonly quote: string; },
): {
  readonly start: number;
  readonly end: number
} {
  /**
   The quote one whole character at a time, so a character beyond the first
   plane is never cut in halves.
   */
  const points = Array.from(quote,);
  /**
   Index of the first character the words keep, past the end when it keeps none.
   */
  const first = nonNegativeOr({
    index: points.findIndex(function isKept(point,): boolean {
      return !rendersAsNothing({ text: point, },);
    },),
    otherwise: points.length,
  },);
  /**
   Index one past the last character the words keep, the first index when it keeps none.
   */
  const last = points.findLastIndex(function isWord(
    point,
    at,
  ): boolean {
    return (at >= first) && (!isClosing({ point, },));
  },) + 1;
  /**
   UTF-16 length of the characters before an index.

   @param index - how many whole characters to count

   @returns Their length in UTF-16 units
   */
  function unitsBefore({ index, }: { readonly index: number; },): number {
    return points.slice(
      0,
      index,
    )
      .join('',)
      .length;
  }
  return {
    start: unitsBefore({ index: first, },),
    end: unitsBefore({
      index: Math.max(
        last,
        first,
      ),
    },),
  };
}

/**
 A quote without the space and invisible characters around it and the
 punctuation that closes it.

 @param quote - words as a judge quoted them

 @returns The quote from its first visible character to its last that is not
 closing punctuation, space or an invisible character

 @example
 ```ts
 const core = quoteCore({ quote: 'the cat naps.', },); // 'the cat naps'
 ```
 */
export function quoteCore({ quote, }: { readonly quote: string; },): string {
  /**
   Where the words begin and end.
   */
  const {
    start,
    end,
  } = quoteBounds({ quote, },);
  return quote.slice(
    start,
    end,
  );
}

//endregion Consistency quote bounds
