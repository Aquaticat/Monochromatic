import {
  agreedQuoteOf,
  agreedSlotOf,
  isKeptByMajority,
  majorityChoiceOf,
  usableVoicesOf,
} from './consistency-majority.ts';
import type {
  ConsistencyCount,
  ConsistencyRendering,
  ConsistencyVoice,
  ConsistencyWinner,
} from './consistency-count-types.ts';
import type { ConsistencyEnglish, } from './consistency-wire.ts';
import { rendersAsNothing, } from './renders-as-nothing.ts';

//region Consistency count
// Counting a repeated wording's ballots, deterministically and from usable
// ballots only (the owner's ruling of 2026-10-11, with the lead's design).
//
// A QUOTE IS LOCATED WHEN A STRICT MAJORITY OF USABLE BALLOTS GIVE THE SAME
// TEXT and that text occurs exactly once in the place's English; a slot the
// same way inside the located quote. Otherwise the place is unlocated and
// stays as it stands, for the reason `locate-quote.ts` refuses an empty, a
// missing and an ambiguous quote. THE CHOICE WINS ON A STRICT MAJORITY and
// only with the quorum the gather closed on, and only if its own quote is
// located; otherwise the group stays as it stands, as the consolidation gate
// keeps the standing on a tie. A PLACE IS KEPT when a strict majority list it.
//
// NOTHING HERE WRITES TEXT. The words a replacement carries are words a
// judge quoted from the page, and the splice (`consistency-splice.ts`) only
// moves them.

/**
 Characters that close a sentence or a clause, taken off the end of a quote
 before it is compared or replaced, so a quote that carries the punctuation
 beside one that does not still agree.
 */
const CLOSING_PUNCTUATION = '.,;:!?…。！？，；：、';

/**
 A quote without the punctuation that closes it.

 @param quote - words as a judge quoted them

 @returns The quote up to its last character that is not closing punctuation
 or space

 @example
 ```ts
 const core = quoteCore({ quote: 'the cat naps.', },); // 'the cat naps'
 ```
 */
export function quoteCore({ quote, }: { readonly quote: string; },): string {
  /**
   Index one past the last character the core keeps.
   */
  const bounds = { end: quote.length, };
  while ((bounds.end > 0) && (CLOSING_PUNCTUATION.includes(quote.charAt(bounds.end - 1,),)
    || rendersAsNothing({ text: quote.charAt(bounds.end - 1,), },)))
    bounds.end -= 1;
  return quote.slice(
    0,
    bounds.end,
  );
}

/**
 Where a text stands inside another.

 @example
 ```ts
 const found: QuoteOccurrences = { kind: 'once', at: 4, };
 ```
 */
export type QuoteOccurrences =
  | {
    /**
     The text stands nowhere in the other.
     */
    readonly kind: 'none';
  }
  | {
    /**
     The text stands exactly once.
     */
    readonly kind: 'once';

    /**
     Offset of that one occurrence.
     */
    readonly at: number;
  }
  | {
    /**
     The text stands more than once, overlaps included.
     */
    readonly kind: 'many';
  };

/**
 Where a text stands inside another: nowhere, once, or more than once,
 overlaps included.

 @param haystack - text searched

 @param needle - text looked for, never empty

 @returns That it is absent, the offset of its one occurrence, or that it
 occurs more than once

 @example
 ```ts
 const found = occurrencesOf({ haystack: 'aaa', needle: 'aa', },); // { kind: 'many' }
 ```
 */
export function occurrencesOf(
  {
    haystack,
    needle,
  }: {
    readonly haystack: string;
    readonly needle: string;
  },
): QuoteOccurrences {
  if (!haystack.includes(needle,))
    return { kind: 'none', };
  /**
   Offset of the first occurrence.
   */
  const at = haystack.indexOf(needle,);
  if (haystack.includes(
    needle,
    at + 1,
  ))
    return { kind: 'many', };
  return {
    kind: 'once',
    at,
  };
}

/**
 Locates the quote and slot a strict majority gave for one place.

 @param voices - usable ballots

 @param label - the place's label

 @param english - the place's English

 @param framed - whether the group is a frame with a slot

 @returns The located rendering, or why it is not

 @example
 ```ts
 const rendering = locatedRendering({ voices, label: 'OCCURRENCE 1', english, framed: false, },);
 ```
 */
function locatedRendering(
  {
    voices,
    label,
    english,
    framed,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
    readonly english: ConsistencyEnglish;
    readonly framed: boolean;
  },
): ConsistencyRendering {
  if (english.kind === 'absent') {
    return {
      kind: 'unlocated',
      reason: 'no-english',
    };
  }
  /**
   The quote a strict majority gave.
   */
  const [quote,] = agreedQuoteOf({
    voices,
    label,
  },);
  if (quote === undefined) {
    return {
      kind: 'unlocated',
      reason: 'no-agreement',
    };
  }
  /**
   The words the quote keeps.
   */
  const core = quoteCore({ quote, },);
  if (rendersAsNothing({ text: core, },)) {
    return {
      kind: 'unlocated',
      reason: 'empty',
    };
  }
  /**
   Where the quote stands in the English.
   */
  const found = occurrencesOf({
    haystack: english.text,
    needle: quote,
  },);
  if (found.kind === 'none') {
    return {
      kind: 'unlocated',
      reason: 'not-found',
    };
  }
  if (found.kind === 'many') {
    return {
      kind: 'unlocated',
      reason: 'ambiguous',
    };
  }
  if (!framed) {
    return {
      kind: 'located',
      quote,
      core,
      start: found.at,
    };
  }
  /**
   The slot a strict majority gave.
   */
  const [slot,] = agreedSlotOf({
    voices,
    label,
  },);
  if (slot === undefined) {
    return {
      kind: 'unlocated',
      reason: 'slot-no-agreement',
    };
  }
  if (rendersAsNothing({ text: slot, },)) {
    return {
      kind: 'unlocated',
      reason: 'slot-empty',
    };
  }
  /**
   Where the slot stands in the core.
   */
  const inCore = occurrencesOf({
    haystack: core,
    needle: slot,
  },);
  if (inCore.kind === 'none') {
    return {
      kind: 'unlocated',
      reason: 'slot-not-found',
    };
  }
  if (inCore.kind === 'many') {
    return {
      kind: 'unlocated',
      reason: 'slot-ambiguous',
    };
  }
  return {
    kind: 'located',
    quote,
    core,
    start: found.at,
    slot,
    slotStart: inCore.at,
  };
}

/**
 Counts the ballots of one group.

 @param voices - every heard ballot with its seat

 @param places - label and English of each place, in page order

 @param framed - whether the group is a frame with a slot

 @param quorum - voices the gather closed on, which the usable ballots must reach

 @returns What the usable ballots come to

 @example
 ```ts
 const count = countConsistency({ voices, places, framed: false, quorum: 2, },);
 ```
 */
export function countConsistency(
  {
    voices,
    places,
    framed,
    quorum,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly places: readonly {
      readonly label: string;
      readonly english: ConsistencyEnglish;
    }[];
    readonly framed: boolean;
    readonly quorum: number;
  },
): ConsistencyCount {
  /**
   Labels the sheet showed.
   */
  const labels = places.map(function labelOf(place,): string {
    return place.label;
  },);
  /**
   Ballots that can be counted.
   */
  const usableVoices = usableVoicesOf({
    voices,
    labels,
  },);
  /**
   Each place's rendering.
   */
  const renderings = places.map(function renderingOf(place,): ConsistencyRendering {
    return locatedRendering({
      voices: usableVoices,
      label: place.label,
      english: place.english,
      framed,
    },);
  },);
  /**
   Whether a strict majority keeps each place.
   */
  const kept = places.map(function isKept(place,): boolean {
    return isKeptByMajority({
      voices: usableVoices,
      label: place.label,
    },);
  },);
  /**
   The place a strict majority chose, as a list of zero or one.
   */
  const chosen = majorityChoiceOf({ voices: usableVoices, },);
  return {
    usable: usableVoices.length,
    renderings,
    kept,
    winner: winnerOf({
      usable: usableVoices.length,
      quorum,
      chosen,
      labels,
      renderings,
    },),
  };
}

/**
 Decides the group's winner from the facts the ballots gave.

 @param usable - usable ballots

 @param quorum - voices the gather closed on

 @param chosen - label a strict majority chose, as a list of zero or one

 @param labels - labels of the places, in order

 @param renderings - each place's rendering, in order

 @returns The winner, or why there is none

 @example
 ```ts
 const winner = winnerOf({ usable: 3, quorum: 2, chosen: ['OCCURRENCE 1',], labels, renderings, },);
 ```
 */
export function winnerOf(
  {
    usable,
    quorum,
    chosen,
    labels,
    renderings,
  }: {
    readonly usable: number;
    readonly quorum: number;
    readonly chosen: readonly string[];
    readonly labels: readonly string[];
    readonly renderings: readonly ConsistencyRendering[];
  },
): ConsistencyWinner {
  if ((usable === 0) || (usable < quorum)) {
    return {
      kind: 'none',
      reason: 'no-quorum',
    };
  }
  /**
   The label a strict majority chose, if any.
   */
  const [label,] = chosen;
  if (label === undefined) {
    return {
      kind: 'none',
      reason: 'no-majority',
    };
  }
  if (renderings[labels.indexOf(label,)]
    ?.kind
    !== 'located') {
    return {
      kind: 'none',
      reason: 'chosen-unlocated',
    };
  }
  return {
    kind: 'chosen',
    label,
  };
}

//endregion Consistency count
