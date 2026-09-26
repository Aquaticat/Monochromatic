import {
  bindsWord,
  codePointAt,
  codePointBefore,
} from './quote-neighbours.ts';

//region Nested single quotes
// CLASS ONE HUNDRED FORTY-SEVEN (XingZ6013, 2026-09-26). The butterfly speech
// quotes a law inside its own quotation and the page shipped the inner pair
// straight ('to be awake is to keep living.') inside curly doubles on a page
// every other mark of which is curly. The restoration read a straight single
// quote only as an apostrophe. The corpus writes a nested quotation ‘…’ on
// every page that has one (13 marks over 6 archive pages) and never straight.
// A straight single quote that opens after a space or an opening mark, with a
// word after it, pairs with the next straight single quote on its line that
// closes after a non-space with no word after it; each pair is a quotation.

/**
 Straight single quote.
 */
const STRAIGHT_SINGLE = '\'';

/**
 Newline, which no quotation pair crosses.
 */
const LINE_END = '\n';

/**
 Marks a quotation may open right after, besides a space or the text's start.
 */
const OPENING_CONTEXT: ReadonlySet<string> = new Set([
  '“',
  '‘',
  '"',
  '(',
  '[',
  '—',
  '–',
],);

/**
 Offsets of the straight single quotes that open and close a quotation.
 */
export type NestedSinglePairs = {
  /**
   Offsets of opening marks.
   */
  readonly openings: ReadonlySet<number>;

  /**
   Offsets of closing marks.
   */
  readonly closings: ReadonlySet<number>;
};

/**
 Whether a character can stand right before a quotation's opening mark: the
 text's start, a space, or an opening mark.

 @param character - code point before the quote, empty at the text's start

 @returns True where a quotation may open

 @example
 ```ts
 opensAfter({ character: ' ', },); // true
 ```
 */
function opensAfter({ character, }: { readonly character: string; },): boolean {
  if (character.trim() === '')
    return true;
  return OPENING_CONTEXT.has(character,);
}

/**
 How a straight single quote at an offset reads by its neighbours: opening a
 quotation, closing one, or neither (an apostrophe or unreadable).

 @param text - text being read

 @param at - offset of the quote

 @returns Shape of the quote

 @example
 ```ts
 singleShape({ text: "says 'nap.'", at: 5, },); // 'opening'
 ```
 */
function singleShape(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): 'opening' | 'closing' | 'neither' {
  /**
   Code point before the quote.
   */
  const before = codePointBefore({
    text,
    at,
  },);
  /**
   Whether a word follows the quote.
   */
  const boundAfter = bindsWord({ character: codePointAt({
    text,
    at: at + 1,
  },), },);
  if (boundAfter)
    return ((!bindsWord({ character: before, },)) && opensAfter({ character: before, },)) ? 'opening' : 'neither';
  return (before.trim() === '') ? 'neither' : 'closing';
}

/**
 Every straight single quotation pair in a text's prose: an opening mark
 paired with the next closing mark on its line, a later opening mark before
 any closing one taking the earlier one's place.

 @param text - text being read

 @param mask - which units of the text are prose

 @returns Offsets of paired opening and closing marks

 @example
 ```ts
 nestedSinglePairs({ text: "says 'nap.'", mask, },); // openings {5}, closings {10}
 ```
 */
export function nestedSinglePairs(
  {
    text,
    mask,
  }: {
    readonly text: string;
    readonly mask: readonly boolean[];
  },
): NestedSinglePairs {
  /**
   Paired opening offsets.
   */
  const openings = new Set<number>();
  /**
   Paired closing offsets.
   */
  const closings = new Set<number>();
  (function scan(): void {
    /**
     Offset of the opening mark waiting for its partner, -1 for none.
     */
    let open = -1;
    for (let index = 0; index < text.length; index += 1) {
      /**
       Unit under the scan.
       */
      const character = text.charAt(index,);
      if (character === LINE_END)
        open = -1;
      if ((mask[index] !== true) || (character !== STRAIGHT_SINGLE))
        continue;
      /**
       How the quote reads.
       */
      const shape = singleShape({
        text,
        at: index,
      },);
      if (shape === 'opening')
        open = index;
      if ((shape === 'closing') && (open !== (-1))) {
        openings.add(open,);
        closings.add(index,);
        open = -1;
      }
    }
  })();
  return {
    openings,
    closings,
  };
}

//endregion Nested single quotes
