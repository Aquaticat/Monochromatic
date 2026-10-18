import {
  codePointAt,
  codePointBefore,
  isSpacedScriptWordCharacter,
} from '@monochromatic-dev/translation-repair-markup/ts';

//region Consistency contains words
// WHETHER ONE QUOTE, READ IN THE FOLD, STANDS INSIDE ANOTHER AT THE EDGES OF WORDS. Two readings of the judges' quotes ask it: the
// spans a strict majority of the ballots' quotes contain (`consistency-span-agreement.ts`) and the slot words given beside any quote
// that contains the located words (`consistency-majority.ts`), so both read one test and a place is located and its slot agreed by
// the same notion of containment.

/**
 Whether the words stand in the text at the edges of words, not inside a longer word.

 @param outer - folded words of the quote that may contain them

 @param inner - folded words that may be contained

 @returns Whether `inner` stands in `outer` with no letter, digit or combining mark of a spaced script beside it on either side;
 an empty `inner` stands only in an empty `outer`

 @example
 ```ts
 const contained = containsWords({ outer: 'wanted to stay', inner: 'to stay', },); // true
 ```
 */
export function containsWords(
  {
    outer,
    inner,
  }: {
    readonly outer: string;
    readonly inner: string;
  },
): boolean {
  // An empty text is found at every offset and once more past the last, so the search never runs out of finds; a blank
  // quote is contained only in another blank one.
  if (inner === '')
    return outer === '';
  for (let from = outer.indexOf(inner,); from >= 0; from = outer.indexOf(
    inner,
    from + 1,
  )) {
    /**
     The character before the match, empty at the start of the quote.
     */
    const before = codePointBefore({
      text: outer,
      at: from,
    },);
    /**
     The character after the match, empty at the end of the quote.
     */
    const after = codePointAt({
      text: outer,
      at: from + inner.length,
    },);
    // A word runs on through a letter, a digit or a combining mark of a spaced script, as it does for the locator
    // (`consistency-shown-edge.ts`): a decomposed accent after the match makes it part of a longer word.
    if ((!isSpacedScriptWordCharacter({ character: before, },)) && (!isSpacedScriptWordCharacter({ character: after, },)))
      return true;
  }
  return false;
}

//endregion Consistency contains words
