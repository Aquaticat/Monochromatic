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
// opening quote.

/**
 * Right single quotation mark, used as an apostrophe in the corpus.
 */
const CURLY_APOSTROPHE = '\u{2019}';

/**
 * Left double quotation mark.
 */
const CURLY_OPEN_DOUBLE = '\u{201C}';

/**
 * Right double quotation mark.
 */
const CURLY_CLOSE_DOUBLE = '\u{201D}';

/**
 * Whether a character can sit beside an apostrophe inside one word.
 *
 * Restricted to letters and digits so a straight quote acting as a QUOTE, which
 * has a space or punctuation on at least one side, is never mistaken for an
 * apostrophe inside a contraction.
 *
 * @param character - character beside the quote, empty at a text boundary
 *
 * @returns Whether it binds the quote into a word
 *
 * @example
 * ```ts
 * const binds = bindsWord({ character: 't', },);
 * ```
 */
function bindsWord({ character, }: { readonly character: string; },): boolean {
  if (character === '')
    return false;

  return (character.toLowerCase() !== character.toUpperCase())
    || ((character >= '0') && (character <= '9'));
}

/**
 * Counts straight double quotes without building a character array.
 *
 * @param text - text to scan
 *
 * @returns How many straight double quotes it holds
 *
 * @example
 * ```ts
 * countStraightDoubles({ text: 'a "b" c', },);
 * ```
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
     * Straight doubles seen so far.
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
 * Counts straight single quotes shaped like an opening quote: a non-word
 * character before, a word character after.
 *
 * One such quote anywhere in the replacement means a trailing straight quote
 * elsewhere may be closing it, so the trailing rule then leaves every one
 * alone rather than curl half of a quoted phrase.
 *
 * @param text - text to scan
 *
 * @param mask - which units are prose
 *
 * @returns How many opening-shaped singles it holds
 *
 * @example
 * ```ts
 * countOpeningSingles({ text: "rock 'n' roll", mask, },);
 * ```
 */
function countOpeningSingles(
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
     * Opening-shaped singles seen so far.
     */
    let seen = 0;
    for (let index = 0; index < text.length; index += 1) {
      /**
       * Whether this unit is a prose straight single quote.
       */
      const single = (mask[index] === true)
        && (text.charAt(index,) === '\'');
      if (!single)
        continue;

      /**
       * Whether a word character precedes it.
       */
      const boundBefore = bindsWord({ character: text.charAt(index - 1,), },);

      /**
       * Whether a word character follows it.
       */
      const boundAfter = bindsWord({ character: text.charAt(index + 1,), },);
      if (boundBefore)
        continue;
      if (boundAfter)
        seen += 1;
    }
    return seen;
  })();
}

/**
 * Restores the quote style the replaced text used.
 *
 * Only ever converts straight to curly, and only where the replaced text or the
 * surrounding document shows that convention, so a document written with
 * straight quotes throughout is left alone. An apostrophe converts only between
 * word characters; a double
 * quote converts only when the replacement's straight doubles are balanced, and
 * then in open-close order, since an odd count means the quote is doing
 * something this rule cannot read.
 *
 * Text inside a backtick span or a tag is never touched, because a straight
 * quote there is code or markup rather than prose. A trailing apostrophe, a
 * word character before it and none after, converts only when the replacement
 * holds no straight single quote shaped like an opening one. The ellipsis form
 * follows the same reading through `restoreEllipsis`.
 *
 * @param replacement - text the editor wrote
 *
 * @param replaced - text it replaces
 *
 * @param convention - wider text whose quote style the replacement should
 * match, ordinarily the whole document being repaired
 *
 * @returns Replacement with the document's quote style restored
 *
 * @example
 * ```ts
 * restoreTypography({
 *   replacement: "didn't",
 *   replaced: 'did not know',
 *   convention: documentText,
 * },);
 * ```
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
   * Whether curly apostrophes are this text's convention.
   *
   * Asked of the REPLACED region and of the wider document alike, because the
   * region alone answers the wrong question. Editor regions run to a median of
   * 75 characters, so most hold no quote at all, while English prose is full of
   * apostrophes; a region-only test therefore stays silent exactly when the
   * editor writes a fresh contraction into a curly-quoted document.
   *
   * Measured over 56 settled entries before this was widened: 40 of the 51
   * whose input carried curly quotes came out worse, 99 curly characters lost
   * against 163 straight ones gained.
   */
  const wantsCurlyApostrophe = replaced.includes(CURLY_APOSTROPHE,)
    || convention.includes(CURLY_APOSTROPHE,);

  /**
   * Same question for double quotes.
   */
  const wantsCurlyDouble = replaced.includes(CURLY_OPEN_DOUBLE,)
    || replaced.includes(CURLY_CLOSE_DOUBLE,)
    || convention.includes(CURLY_OPEN_DOUBLE,)
    || convention.includes(CURLY_CLOSE_DOUBLE,);

  /**
   * Which units of the replacement are prose rather than code or markup.
   */
  const mask = proseMask({ text: replacement, },);

  /**
   * Straight doubles in the prose of the replacement, which must pair up to be
   * convertible.
   *
   * Counted by scanning rather than by building a character array. Splitting a
   * string into characters is what the two lint rules here disagree about, and
   * the disagreement has no correct answer at the surface: one forbids
   * spreading a string, the other prefers spread over `Array.from`. Not
   * building the array at all settles it, and index scanning is safe because
   * every character this function compares or writes is ASCII, so a surrogate
   * half is only ever copied through untouched.
   */
  const straightDoubles = countStraightDoubles({
    text: replacement,
    mask,
  },);

  /**
   * Whether double quotes may be converted at all.
   */
  const convertDoubles = wantsCurlyDouble && ((straightDoubles % 2) === 0);

  /**
   * Whether a trailing straight single quote may be read as an apostrophe.
   */
  const convertTrailing = wantsCurlyApostrophe
    && (countOpeningSingles({
      text: replacement,
      mask,
    },) === 0);

  return (function scan(): string {
    /**
     * Characters emitted so far.
     */
    const rebuilt: string[] = [];

    /**
     * Whether the next convertible double quote opens rather than closes.
     */
    let doubleOpens = true;
    for (let index = 0; index < replacement.length; index += 1) {
      /**
       * Character under the cursor.
       */
      const character = replacement.charAt(index,);
      if (mask[index] !== true) {
        rebuilt.push(character,);
        continue;
      }
      if ((character === '\'') && wantsCurlyApostrophe) {
        /**
         * Whether the character before binds this quote into a word.
         */
        const boundBefore = bindsWord({ character: replacement.charAt(index - 1,), },);

        /**
         * Whether the character after does.
         */
        const boundAfter = bindsWord({ character: replacement.charAt(index + 1,), },);

        /**
         * Whether the quote reads as an apostrophe: inside a word, or trailing
         * a word with nothing that could pair with it.
         */
        const apostrophe = boundBefore && (boundAfter || convertTrailing);
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
    // silence where the document shows both forms.
    return restoreEllipsis({
      replacement: rebuilt.join('',),
      replaced,
      convention,
    },);
  })();
}

//endregion Typography restoration
