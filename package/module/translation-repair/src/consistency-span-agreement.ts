import { compareCodePoints, } from './code-points.ts';
import { foldedWordsOf, } from './consistency-fold.ts';
import {
  type QuotesByLabel,
  quotesByLabelOf,
} from './consistency-majority.ts';
import type { ConsistencyVoice, } from './consistency-count-types.ts';

//region Consistency span agreement
// WHICH WORDS OF A PLACE THE JUDGES' QUOTES AGREE ON, when they quoted different spans of it (the lead's ruling of 2026-10-15 on
// the run of TianqiChen66625, group 2: three judges quoted three nested spans of the chosen place, and no one text was a strict
// majority of the quotes, so the chosen place was located by none and the group was lost to `chosen-unlocated`).
//
// A QUOTE IS EVIDENCE FOR EVERY QUOTE THAT CONTAINS IT. A candidate span is one of the place's quotes, read in the fold
// (`consistency-fold.ts`), that a strict majority of the usable ballots' quotes of that place contain, itself included, at the
// edges of words; a ballot that gave no quote of the place counts against every candidate, as it did when one text had to be
// given by a strict majority of the usable ballots. The place is located by the longest candidate that stands exactly once in its English; a candidate that stands
// nowhere or more than once is passed over for the next longest. THE RISK, which the owner may veto: the span located is the
// longest one a majority can stand behind, so it can be SHORTER than the words a judge meant to carry (group 2's first place
// is located from "wanted", leaving out the "She also" a judge's quote began with), and a splice of it then moves fewer words
// than that judge named. Two candidates of one length are told apart by their code points, so the same ballots always give the
// same span.

/**
 Whether a character is part of a word, for the edges at which a quote's words are contained in another quote's.
 */
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/**
 Whether the words stand in the text at the edges of words, not inside a longer word.

 @param outer - folded words of the quote that may contain them
 @param inner - folded words that may be contained

 @returns Whether `inner` stands in `outer` with no word character beside it on either side

 @example
 ```ts
 const contained = containsWords({ outer: 'wanted to stay', inner: 'to stay', },); // true
 ```
 */
function containsWords(
  {
    outer,
    inner,
  }: {
    readonly outer: string;
    readonly inner: string;
  },
): boolean {
  for (let from = outer.indexOf(inner,); from >= 0; from = outer.indexOf(
    inner,
    from + 1,
  )) {
    /**
     The character before the match, empty at the start of the quote.
     */
    const before = [...outer.slice(
      0,
      from,
    ),].at(-1,) ?? '';
    /**
     The character after the match, empty at the end of the quote.
     */
    const after = [...outer.slice(from + inner.length,),][0] ?? '';
    if ((!WORD_CHARACTER.test(before,)) && (!WORD_CHARACTER.test(after,)))
      return true;
  }
  return false;
}

/**
 The folded words of the quotes a strict majority of the quotes naming a place contain, longest first.

 @param voices - usable ballots
 @param label - the place's label
 @param quotesByLabel - the quote entries of these ballots by label, which a caller that asks many places reads once for the
 group; read from the ballots where absent

 @returns The candidate spans, longest first and by code points among those of one length; none when the ballots quoted nothing
 for the place or no quote is contained in the quotes of more than half of the ballots; a blank quote is a candidate only when
 a strict majority of the ballots gave a blank one

 @example
 ```ts
 const candidates = containedQuoteWordsOf({ voices, label: 'OCCURRENCE 1', },);
 ```
 */
export function containedQuoteWordsOf(
  {
    voices,
    label,
    quotesByLabel = quotesByLabelOf({ voices, },),
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
    readonly quotesByLabel?: QuotesByLabel;
  },
): readonly string[] {
  /**
   Every quote naming the place, in the fold.
   */
  const quoted = (quotesByLabel.get(label,) ?? [])
    .map(function foldedOf(entry,): string {
      return foldedWordsOf({ text: entry.quote, },);
    },);
  return [...new Set(quoted,),]
    .filter(function isContainedByMajority(candidate,): boolean {
      /**
       How many of the quotes contain the candidate.
       */
      const containing = quoted.filter(function contains(outer,): boolean {
        return containsWords({
          outer,
          inner: candidate,
        },);
      },).length;
      return (containing * 2) > voices.length;
    },)
    .toSorted(function longestFirst(
      left,
      right,
    ): number {
      return ([...right,].length - [...left,].length) || compareCodePoints({
        left,
        right,
      },);
    },);
}

//endregion Consistency span agreement
