import { placeClosingPunctuation, } from './closing-punctuation.ts';
import { codePointAt, } from './code-points.ts';
import {
  nestedSinglePairs,
  opensBeforeMarkup,
} from './nested-single-quotes.ts';
import {
  bindsWord,
  closesSpan,
  isElisionPairEnd,
  isLeadingElision,
  precedesClosingMark,
  sequenceBefore,
} from './quote-neighbours.ts';
import { restoreEllipsis, } from './restore-ellipsis.ts';
import { proseMask, } from './typography-prose-mask.ts';

//region Typography restoration
// Puts back the quote characters an editor flattened.
//
// Observed across a drawn sample: a replacement arrives with straight quotes
// where the text it replaces used curly ones, so `didn’t` becomes `didn't` and
// “Sister Yantian” becomes "Sister Yantian". Nothing is mistranslated, and
// every stage passes, but the repaired paragraph now reads differently from
// every paragraph around it, and the difference accumulates with each edit.
//
// Deterministic on purpose. A model asked to preserve typography will mostly
// comply and occasionally not, and "mostly" is what leaves a document with two
// conventions in it. This decides the question in code, from what the replaced
// text itself used, so the rule can be read rather than trusted.
//
// Two findings of 2026-09-06, from the first page the rule reached at the
// would-ship reading: a JSX string literal inside a blockquoted component line
// was curled, which no MDX grammar compiles, and a plural possessive `girls'`
// stayed straight on a curly page because its apostrophe has a space on one
// side. Markup and code are now masked out (`typography-prose-mask.ts`), and a
// trailing apostrophe converts when nothing in the replacement could be its
// opening quote. The neighbour reading lives in `quote-neighbours.ts`, shared
// with the nested quotation reading of class one hundred forty-seven.

/**
 Right single quotation mark, used as an apostrophe in the corpus and as a
 nested quotation's closing mark.
 */
const CURLY_APOSTROPHE = '\u{2019}';

/**
 Left single quotation mark, a nested quotation's opening mark.
 */
const CURLY_OPEN_SINGLE = '\u{2018}';

/**
 Left double quotation mark.
 */
const CURLY_OPEN_DOUBLE = '\u{201C}';

/**
 Right double quotation mark.
 */
const CURLY_CLOSE_DOUBLE = '\u{201D}';

/**
 Whether the text from an offset is the possessive clitic `s` and no more of
 a word, which is the one reading a straight quote after a closed span has as
 an apostrophe rather than as an opening quote.

 @param text - replacement being scanned

 @param at - offset just past the quote

 @returns Whether `'s` ends a word there

 @example
 ```ts
 const clitic = possessiveClitic({ text: "*Chorus*'s opening", at: 9, },);
 ```
 */
function possessiveClitic(
  {
    text,
    at,
  }: {
    readonly text: string;
    readonly at: number;
  },
): boolean {
  /**
   Character right after the quote, lowered.
   */
  const clitic = text.charAt(at,)
    .toLowerCase();
  if (clitic !== 's')
    return false;
  return !bindsWord({ character: codePointAt({
    text,
    at: at + 1,
  },), },);
}

/**
 Counts straight double quotes without building a character array.

 @param text - text to scan

 @param mask - which units of the text are prose rather than code or markup;
 a quote outside prose is not counted, since it is not the text's typography

 @returns How many straight double quotes its prose holds

 @example
 ```ts
 countStraightDoubles({ text: 'a "b" c', mask: proseMask({ text: 'a "b" c', },), },);
 ```
 */
function countStraightDoubles(
  {
    text,
    mask,
  }: {
    readonly text: string;
    readonly mask: readonly boolean[];
  },
): number {
  return (function count(): number {
    /**
     Straight doubles seen so far.
     */
    let seen = 0;
    for (let index = 0; index < text.length; index += 1) {
      if ((mask[index] === true) && (text.charAt(index,) === '"'))
        seen += 1;
    }
    return seen;
  })();
}

/**
 Counts straight single quotes shaped like an opening quote that no closing quote pairs with: a non-word character before, a
 word character after, no leading elision (`'tis`), which is an apostrophe and waits for no partner, and no pair. A quote
 that pairs is a quotation's opening and has its partner, elision or not.

 One such quote anywhere in the replacement means a trailing straight quote
 elsewhere may be closing it, so the trailing rule then leaves every one
 alone rather than curl half of a quoted phrase.

 @param text - text to scan

 @param mask - which units are prose

 @param paired - the offsets of the opening marks that a closing mark pairs with

 @returns How many opening-shaped singles with no partner it holds

 @example
 ```ts
 countOpeningSingles({ text: "rock 'n' roll", mask, paired: new Set(), },);
 ```
 */
function countOpeningSingles(
  {
    text,
    mask,
    paired,
  }: {
    readonly text: string;
    readonly mask: readonly boolean[];
    readonly paired: ReadonlySet<number>;
  },
): number {
  return (function count(): number {
    /**
     Opening-shaped singles seen so far.
     */
    let seen = 0;
    for (let index = 0; index < text.length; index += 1) {
      /**
       Whether this unit is a prose straight single quote.
       */
      const single = (mask[index] === true)
        && (text.charAt(index,) === '\'');
      if (!single)
        continue;

      /**
       Whether a word character precedes it.
       */
      const boundBefore = bindsWord({ character: sequenceBefore({
        text,
        at: index,
      },), },);

      /**
       Whether a word character follows it.
       */
      const boundAfter = bindsWord({ character: codePointAt({
        text,
        at: index + 1,
      },), },);
      if (boundBefore)
        continue;
      // A leading elision (`'tis`) that no closing mark pairs with is an apostrophe, not the opening of a quotation that wants
      // its partner, and a mark that is paired has its partner. A mark with markup or punctuation after it (`'(hi)`, `'*hi*`) is
      // opening-shaped like one with a word after it (`opensBeforeMarkup`, `nested-single-quotes.ts`).
      if (paired.has(index,) || (!(boundAfter || opensBeforeMarkup({
        text,
        at: index,
      },))))
        continue;
      if (!isLeadingElision({
        text,
        at: index,
      },))
        seen += 1;
    }
    return seen;
  })();
}

/**
 Restores the quote style the replaced text used.

 Only ever converts straight to curly, and only where the replaced text or the
 surrounding document shows that convention, so a document written with
 straight quotes throughout is left alone. An apostrophe converts only between
 word characters; a double
 quote converts only when the replacement's straight doubles are balanced, and
 then in open-close order, since an odd count means the quote is doing
 something this rule cannot read.

 Only the text the page parse shows as prose is touched (`typography-prose-mask.ts`): a
 straight quote in a link destination or title, an address, code of any kind,
 math, an expression, a tag or one of its attributes, a comment or front matter
 is code or markup rather than prose, and a text the grammar refuses has no
 prose at all. A quotation whose first character is markup or punctuation
 (`'(hi)'`, `'*hi*'`, `'$5'`) pairs like any other, both marks curled or neither. A trailing apostrophe, a
 word character or punctuation (a stop, a pause, a dash, a closing quotation
 mark) before it and no word after, converts only when the replacement
 holds no straight single quote shaped like an opening one, so one that no pair
 claimed curls to the closing single mark, which is the apostrophe too
 (`bowls,'`, `cats'`). A leading elision
 (`'tis`, `'em`, `'99`, `'90s`, the `'n'` between two words; `isLeadingElision`, `quote-neighbours.ts`)
 that no later straight single quote closes converts to the apostrophe, never
 to an opening quotation mark, and is no opening quote that a trailing
 apostrophe must wait for; one inside a quotation, after an opening mark that
 is waiting for its closing mark, converts to the apostrophe too and never takes
 that opening mark's place (`'give 'em hell'`). A QUOTATION THAT BEGINS WITH A
 LISTED WORD, one whose elision a later straight mark closes (`'Tis the season,'
 she said`, `'Round things are best'`, `'90s kids'`), is a quotation: the pair
 converts to the opening and the closing single mark, as any pair does, so no
 straight mark is left on a curly page. The `'n'` of `rock 'n' roll` is the
 exception, one unit of two apostrophes whose marks neither open nor close a
 quotation (`'Rock 'n' roll,' she said`). The ellipsis form follows the same
 reading through `restoreEllipsis`.

 @param replacement - text the editor wrote

 @param replaced - text it replaces

 @param convention - wider text whose quote style the replacement should
 match, ordinarily the whole document being repaired

 @returns Replacement with the document's quote style restored

 @example
 ```ts
 restoreTypography({
   replacement: "didn't",
   replaced: 'did not know',
   convention: documentText,
 },);
 ```
 */
export function restoreTypography(
  {
    replacement,
    replaced,
    convention,
  }: {
    readonly replacement: string;
    readonly replaced: string;
    readonly convention: string;
  },
): string {
  /**
   Whether curly apostrophes are this text's convention.

   Asked of the REPLACED region and of the wider document alike, because the
   region alone answers the wrong question. Editor regions run to a median of
   75 characters, so most hold no quote at all, while English prose is full of
   apostrophes; a region-only test therefore stays silent exactly when the
   editor writes a fresh contraction into a curly-quoted document.

   Measured over 56 settled entries before this was widened: 40 of the 51
   whose input carried curly quotes came out worse, 99 curly characters lost
   against 163 straight ones gained.
   */
  const wantsCurlyApostrophe = replaced.includes(CURLY_APOSTROPHE,)
    || convention.includes(CURLY_APOSTROPHE,);

  /**
   Same question for double quotes.
   */
  const wantsCurlyDouble = replaced.includes(CURLY_OPEN_DOUBLE,)
    || replaced.includes(CURLY_CLOSE_DOUBLE,)
    || convention.includes(CURLY_OPEN_DOUBLE,)
    || convention.includes(CURLY_CLOSE_DOUBLE,);

  /**
   Which units of the replacement are prose rather than code or markup.
   */
  const mask = proseMask({ text: replacement, },);

  /**
   Straight doubles in the prose of the replacement, which must pair up to be
   convertible.

   Counted by scanning rather than by building a character array. Splitting a
   string into characters is what the two lint rules here disagree about, and
   the disagreement has no correct answer at the surface: one forbids
   spreading a string, the other prefers spread over `Array.from`. Not
   building the array at all settles it, and index scanning is safe because
   every character this function compares or writes is ASCII, so a surrogate
   half is only ever copied through untouched.
   */
  const straightDoubles = countStraightDoubles({
    text: replacement,
    mask,
  },);

  /**
   Whether double quotes may be converted at all.
   */
  const convertDoubles = wantsCurlyDouble && ((straightDoubles % 2) === 0);

  /**
   Straight single quotation pairs, curled with the apostrophes they share a
   convention with (class one hundred forty-seven).
   */
  const {
    openings,
    closings,
  } = wantsCurlyApostrophe
    ? nestedSinglePairs({
      text: replacement,
      mask,
    },)
    : {
      openings: new Set<number>(),
      closings: new Set<number>(),
    };

  /**
   Whether a trailing straight single quote may be read as an apostrophe: no
   opening-shaped quote is left without its partner.
   */
  const convertTrailing = wantsCurlyApostrophe
    && (countOpeningSingles({
      text: replacement,
      mask,
      paired: openings,
    },) === 0);

  return (function scan(): string {
    /**
     Characters emitted so far.
     */
    const rebuilt: string[] = [];

    /**
     Whether the next convertible double quote opens rather than closes.
     */
    let doubleOpens = true;
    for (let index = 0; index < replacement.length; index += 1) {
      /**
       Character under the cursor.
       */
      const character = replacement.charAt(index,);
      if (mask[index] !== true) {
        rebuilt.push(character,);
        continue;
      }
      if (openings.has(index,)) {
        rebuilt.push(CURLY_OPEN_SINGLE,);
        continue;
      }
      if (closings.has(index,)) {
        rebuilt.push(CURLY_APOSTROPHE,);
        continue;
      }
      if ((character === '\'') && wantsCurlyApostrophe) {
        /**
         The character before the quote, with any combining marks on it.
         */
        const before = sequenceBefore({
          text: replacement,
          at: index,
        },);

        /**
         Whether the character before binds this quote into a word.
         */
        const boundBefore = bindsWord({ character: before, },);

        /**
         Whether the character after does.
         */
        const boundAfter = bindsWord({ character: codePointAt({
          text: replacement,
          at: index + 1,
        },), },);

        /**
         Whether a closed inline span stands before the quote.
         */
        const spanBefore = closesSpan({ character: before, },);

        /**
         Whether the quote stands in closing shape: no word after it, and a word or punctuation that a closing mark follows
         before it. The closing single mark is also the apostrophe, so one that no pair claimed curls to it
         (`bowls,'`, `cats'`) when no unpaired opening-shaped quote could be its partner.
         */
        const closingShape = (!boundAfter) && (boundBefore || precedesClosingMark({ character: before, },));

        /**
         Whether the quote is the second mark of the `'n'` of `rock 'n' roll`, an apostrophe whatever else the page holds.
         */
        const endsElisionPair = isElisionPairEnd({
          text: replacement,
          at: index,
        },);

        /**
         Whether the quote reads as an apostrophe inside or trailing a word:
         inside a word, in closing shape with nothing that could pair
         with it, or the second mark of the `'n'` of `rock 'n' roll`.
         */
        const wordApostrophe = (boundBefore && boundAfter)
          || (closingShape && convertTrailing)
          || endsElisionPair;

        /**
         Whether the quote reads as a possessive after a closed span: the
         `s` clitic follows, or nothing word-like follows and nothing could
         pair with it.
         */
        const clitic = possessiveClitic({
          text: replacement,
          at: index + 1,
        },);

        /**
         Whether the quote trails the span with nothing that could pair
         with it.
         */
        const trailsSpan = (!boundAfter) && convertTrailing;

        /**
         Whether the quote reads as a possessive after a closed span.
         */
        const spanApostrophe = spanBefore && (clitic || trailsSpan);

        /**
         Whether the quote stands for the dropped letters at the start of a word (`'tis`, `'em`, `'90s`), which curls to the
         apostrophe whether or not a later straight mark could close it as a pair.
         */
        const elision = (!boundBefore)
          && boundAfter
          && isLeadingElision({
            text: replacement,
            at: index,
          },);

        /**
         Whether the quote reads as an apostrophe either way.
         */
        const apostrophe = wordApostrophe
          || spanApostrophe
          || elision;
        rebuilt.push(apostrophe ? CURLY_APOSTROPHE : character,);
        continue;
      }
      if ((character === '"') && convertDoubles) {
        rebuilt.push(doubleOpens ? CURLY_OPEN_DOUBLE : CURLY_CLOSE_DOUBLE,);
        doubleOpens = !doubleOpens;
        continue;
      }
      rebuilt.push(character,);
    }
    // The ellipsis form is the third convention a page can mix, found on
    // 2026-09-07 after the two quote forms were settled; same inputs, same
    // silence where the document shows both forms. The closing punctuation
    // (class one hundred eighty-one) swaps units in place, so the mask still
    // reads the rebuilt text.
    return restoreEllipsis({
      replacement: placeClosingPunctuation({
        text: rebuilt.join('',),
        mask,
      },),
      replaced,
      convention,
    },);
  })();
}

//endregion Typography restoration
