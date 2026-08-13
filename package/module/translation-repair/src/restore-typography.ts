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
 * Restores the quote style the replaced text used.
 *
 * Only ever converts straight to curly, and only where the replaced text shows
 * that convention, so a document written with straight quotes throughout is
 * left alone. An apostrophe converts only between word characters; a double
 * quote converts only when the replacement's straight doubles are balanced, and
 * then in open-close order, since an odd count means the quote is doing
 * something this rule cannot read.
 *
 * Text inside a backtick span is never touched, because a straight quote there
 * is part of code rather than prose.
 *
 * @param replacement - text the editor wrote
 *
 * @param replaced - text it replaces, which supplies the convention
 *
 * @returns Replacement with the replaced text's quote style restored
 *
 * @example
 * ```ts
 * restoreTypography({ replacement: "didn't", replaced: 'didn\u{2019}t know', },);
 * ```
 */
export function restoreTypography(
  {
    replacement,
    replaced,
  }: {
    readonly replacement: string;
    readonly replaced: string;
  },
): string {
  /**
   * Whether the replaced text apostrophises with a curly mark.
   */
  const wantsCurlyApostrophe = replaced.includes(CURLY_APOSTROPHE,);

  /**
   * Whether the replaced text quotes with curly doubles.
   */
  const wantsCurlyDouble = replaced.includes(CURLY_OPEN_DOUBLE,)
    || replaced.includes(CURLY_CLOSE_DOUBLE,);

  /**
   * Straight doubles in the replacement, which must pair up to be convertible.
   */
  const straightDoubles = [...replacement,]
    .filter(function isStraightDouble(character,) {
      return character === '"';
    },)
    .length;

  /**
   * Whether double quotes may be converted at all.
   */
  const convertDoubles = wantsCurlyDouble && ((straightDoubles % 2) === 0);

  /**
   * Characters of the replacement, so neighbours can be inspected.
   */
  const characters = [...replacement,];

  /**
   * Rebuilt characters, converted where the rules allow.
   */
  const rebuilt: string[] = [];

  /**
   * Whether the scan currently sits inside a backtick span.
   */
  let inCode = false;

  /**
   * Whether the next convertible double quote opens rather than closes.
   */
  let doubleOpens = true;
  for (const [index, character,] of characters.entries()) {
    if (character === '`') {
      inCode = !inCode;
      rebuilt.push(character,);
      continue;
    }
    if (inCode) {
      rebuilt.push(character,);
      continue;
    }
    if ((character === '\'') && wantsCurlyApostrophe) {
      /**
       * Character before this one, empty at the start.
       */
      const before = characters[index - 1] ?? '';

      /**
       * Character after this one, empty at the end.
       */
      const after = characters[index + 1] ?? '';
      rebuilt.push(
        (bindsWord({ character: before, },) && bindsWord({ character: after, },))
          ? CURLY_APOSTROPHE
          : character,
      );
      continue;
    }
    if ((character === '"') && convertDoubles) {
      rebuilt.push(doubleOpens ? CURLY_OPEN_DOUBLE : CURLY_CLOSE_DOUBLE,);
      doubleOpens = !doubleOpens;
      continue;
    }
    rebuilt.push(character,);
  }

  return rebuilt.join('',);
}

//endregion Typography restoration
