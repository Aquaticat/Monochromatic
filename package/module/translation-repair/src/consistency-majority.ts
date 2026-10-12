import type { ConsistencyVoice, } from './consistency-count-types.ts';
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
 The slot a strict majority of the usable ballots gave for a place, as a list
 of zero or one.

 @param voices - usable ballots

 @param label - the place's label

 @returns The agreed slot, or none

 @example
 ```ts
 const [slot,] = agreedSlotOf({ voices, label: 'OCCURRENCE 1', },);
 ```
 */
export function agreedSlotOf(
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
      .flatMap(function slotOf(entry,): readonly string[] {
        return (entry.slot === undefined) ? [] : [entry.slot,];
      },),
    of: voices.length,
  },);
}

/**
 The label a strict majority of usable ballots chose, as a list of zero or one.

 @param voices - usable ballots

 @returns The chosen label, or none

 @example
 ```ts
 const [chosen,] = majorityChoiceOf({ voices, },); // 'OCCURRENCE 2'
 ```
 */
export function majorityChoiceOf(
  { voices, }: { readonly voices: readonly ConsistencyVoice[]; },
): readonly string[] {
  return majorityText({
    given: voices.map(function choiceOf(voice,): string {
      return voice.choice;
    },),
    of: voices.length,
  },);
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
