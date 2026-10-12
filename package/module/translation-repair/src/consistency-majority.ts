import type { ConsistencyVoice, } from './consistency-count-types.ts';
import { foldedWordsOf, } from './consistency-fold.ts';
import {
  type ConsistencyQuoteWire,
  isUsableConsistencyBallot,
} from './consistency-wire.ts';

//region Consistency majority
// What a strict majority of a group's usable ballots agree on: a quote, a
// slot, a choice, a kept place. Strict means more than half of the usable
// ballots, so a tie agrees on nothing.

/**
 The text a strict majority of usable ballots gave, as a list of zero or one.

 @param given - the texts the ballots that gave one gave

 @param of - usable ballots, whether or not they gave a text

 @returns The text more than half of the usable ballots gave, or no text when
 no text is given by more than half

 @example
 ```ts
 const agreed = majorityText({ given: ['a', 'a',], of: 3, },); // ['a']
 ```
 */
function majorityText(
  {
    given,
    of,
  }: {
    readonly given: readonly string[];
    readonly of: number;
  },
): readonly string[] {
  /**
   Ballots per text.
   */
  const tally = new Map<string, number>();
  for (const text of given) {
    tally.set(
      text,
      (tally.get(text,) ?? 0) + 1,
    );
  }
  return [...tally.entries(),]
    .filter(function isMajority([, ballots,],): boolean {
      return (ballots * 2) > of;
    },)
    .map(function textOf([text,],): string {
      return text;
    },);
}

/**
 What each ballot that quoted a place quoted.

 @param voices - usable ballots

 @param label - the place's label

 @returns The place's quote entries, one per ballot that gave one

 @example
 ```ts
 const quoted = quotesOfPlace({ voices, label: 'OCCURRENCE 1', },);
 ```
 */
function quotesOfPlace(
  {
    voices,
    label,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
  },
): readonly ConsistencyQuoteWire[] {
  return voices.flatMap(function quotesOf(voice,): readonly ConsistencyQuoteWire[] {
    return voice.quotes
      .filter(function namesPlace(entry,): boolean {
        return entry.label === label;
      },);
  },);
}

/**
 The quote a strict majority of the usable ballots gave for a place, as a list
 of zero or one.

 @param voices - usable ballots

 @param label - the place's label

 @returns The agreed quote, or none

 @example
 ```ts
 const [quote,] = agreedQuoteOf({ voices, label: 'OCCURRENCE 1', },);
 ```
 */
export function agreedQuoteOf(
  {
    voices,
    label,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
  },
): readonly string[] {
  return majorityText({
    given: quotesOfPlace({
      voices,
      label,
    },)
      .map(function textOf(entry,): string {
        return entry.quote;
      },),
    of: voices.length,
  },);
}

/**
 The words a strict majority of the usable ballots quoted for a place, read in
 the fold (`consistency-fold.ts`), as a list of zero or one. Two quotes that
 differ only in what the fold ignores are one text, so ballots that quoted one
 span of the place's English with a line break written as a space, a curly
 apostrophe written straight or the closing full stop left off agree.

 @param voices - usable ballots

 @param label - the place's label

 @returns The folded words more than half of the usable ballots quoted, or none

 @example
 ```ts
 const [words,] = agreedWordsOf({ voices, label: 'OCCURRENCE 1', },);
 ```
 */
export function agreedWordsOf(
  {
    voices,
    label,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
  },
): readonly string[] {
  return majorityText({
    given: quotesOfPlace({
      voices,
      label,
    },)
      .map(function wordsOf(entry,): string {
        return foldedWordsOf({ text: entry.quote, },);
      },),
    of: voices.length,
  },);
}

/**
 The slot words a strict majority of the usable ballots gave for a place beside
 the agreed quote, read in the fold, as a list of zero or one. Only the ballots
 whose quote is the agreed words count, against all the usable ballots.

 @param voices - usable ballots

 @param label - the place's label

 @param words - the folded words the quotes agreed on

 @returns The folded slot words more than half of the usable ballots gave beside them, or none

 @example
 ```ts
 const [slot,] = agreedSlotWordsOf({ voices, label: 'OCCURRENCE 1', words: 'so she was a girl', },);
 ```
 */
export function agreedSlotWordsOf(
  {
    voices,
    label,
    words,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
    readonly words: string;
  },
): readonly string[] {
  return majorityText({
    given: quotesOfPlace({
      voices,
      label,
    },)
      .filter(function besideTheWords(entry,): boolean {
        return foldedWordsOf({ text: entry.quote, },) === words;
      },)
      .flatMap(function slotOf(entry,): readonly string[] {
        return (entry.slot === undefined) ? [] : [foldedWordsOf({ text: entry.slot, },),];
      },),
    of: voices.length,
  },);
}

/**
 The slot a strict majority of the usable ballots gave for a place, as a list
 of zero or one. A slot belongs to the quote it was given beside, so when the
 quote a majority agreed on is named, only the ballots that gave that quote
 count, against all the usable ballots.

 @param voices - usable ballots

 @param label - the place's label

 @param quote - the quote a majority agreed on, when the slot is asked beside it

 @returns The agreed slot, or none

 @example
 ```ts
 const [slot,] = agreedSlotOf({ voices, label: 'OCCURRENCE 1', quote: 'the cat naps', },);
 ```
 */
export function agreedSlotOf(
  {
    voices,
    label,
    quote,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
    readonly quote?: string;
  },
): readonly string[] {
  return majorityText({
    given: quotesOfPlace({
      voices,
      label,
    },)
      .filter(function besideTheQuote(entry,): boolean {
        return (quote === undefined) || (entry.quote === quote);
      },)
      .flatMap(function slotOf(entry,): readonly string[] {
        return (entry.slot === undefined) ? [] : [entry.slot,];
      },),
    of: voices.length,
  },);
}

/**
 The label a strict majority of usable ballots chose, as a list of zero or one.
 Any ballot that only chooses is counted the same way: a first-round ballot, a
 run-off's or a carry's.

 @param voices - usable ballots

 @returns The chosen label, or none

 @example
 ```ts
 const [chosen,] = majorityChoiceOf({ voices, },); // 'OCCURRENCE 2'
 ```
 */
export function majorityChoiceOf(
  { voices, }: { readonly voices: readonly { readonly choice: string; }[]; },
): readonly string[] {
  return majorityText({
    given: voices.map(function choiceOf(voice,): string {
      return voice.choice;
    },),
    of: voices.length,
  },);
}

/**
 The labels that tie for first among the usable ballots' choices: two or more
 labels share the highest count and no label has more than half of the ballots.
 A unique plurality without a majority is no tie, and neither is a majority.

 @param voices - usable ballots

 @param labels - labels the sheet showed, in sheet order

 @returns The tied labels in sheet order, none when no two labels share the top count or a label has a majority

 @example
 ```ts
 const finalists = tiedForFirstOf({ voices, labels: ['OCCURRENCE 1', 'OCCURRENCE 2',], },);
 ```
 */
export function tiedForFirstOf(
  {
    voices,
    labels,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly labels: readonly string[];
  },
): readonly string[] {
  /**
   Ballots per label, in sheet order.
   */
  const counts = labels.map(function countOf(label,): number {
    return voices.filter(function chooses(voice,): boolean {
      return voice.choice === label;
    },)
      .length;
  },);
  /**
   The highest count any label has.
   */
  const top = Math.max(
    0,
    ...counts,
  );
  if ((top === 0) || ((top * 2) > voices.length))
    return [];
  /**
   Labels with the highest count.
   */
  const tied = labels.filter(function isTop(
    _label,
    position,
  ): boolean {
    return counts[position] === top;
  },);
  return (tied.length >= 2) ? tied : [];
}

/**
 The ballots that can be counted against the places a sheet showed.

 @param voices - every heard ballot with its seat

 @param labels - labels the sheet showed

 @returns The usable ballots

 @example
 ```ts
 const usable = usableVoicesOf({ voices, labels, },);
 ```
 */
export function usableVoicesOf(
  {
    voices,
    labels,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly labels: readonly string[];
  },
): readonly ConsistencyVoice[] {
  return voices.filter(function counts(voice,): boolean {
    return isUsableConsistencyBallot({
      ballot: voice,
      labels,
    },);
  },);
}

/**
 Whether a strict majority of the usable ballots keep a place.

 @param voices - usable ballots

 @param label - the place's label

 @returns Whether more than half of them list the label in their kept places

 @example
 ```ts
 const kept = isKeptByMajority({ voices, label: 'OCCURRENCE 2', },);
 ```
 */
export function isKeptByMajority(
  {
    voices,
    label,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
  },
): boolean {
  return (voices.filter(function keeps(voice,): boolean {
    return voice.keep
      .includes(label,);
  },)
    .length
    * 2) > voices.length;
}

//endregion Consistency majority
