import { carriesOrCutsMarkup, } from './consistency-markup.ts';
import { quoteBounds, } from './consistency-quote-bounds.ts';
import {
  agreedQuoteOf,
  agreedSlotOf,
  isKeptByMajority,
  majorityChoiceOf,
  usableVoicesOf,
} from './consistency-majority.ts';
import { ConsistencyInvariantError, } from './consistency-invariant-error.ts';
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
// A QUOTE THAT CANNOT BE MOVED WHOLE STAYS WHERE IT IS: one that cuts markup or
// carries a footnote mark (`consistency-markup.ts`), a slot that is all of its
// quote, and two places of one slice whose words overlap are left unlocated.
//
// NOTHING HERE WRITES TEXT. The words a replacement carries are words a
// judge quoted from the page, and the splice (`consistency-splice.ts`) only
// moves them.

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
   Where the quote's words begin and end.
   */
  const bounds = quoteBounds({ quote, },);
  /**
   The words the quote keeps.
   */
  const core = quote.slice(
    bounds.start,
    bounds.end,
  );
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
  if (carriesOrCutsMarkup({ text: quote, },)) {
    return {
      kind: 'unlocated',
      reason: 'markup',
    };
  }
  /**
   Offset in the English where the words begin, after any space the quote opens with.
   */
  const start = found.at + bounds.start;
  if (!framed) {
    return {
      kind: 'located',
      quote,
      core,
      start,
    };
  }
  /**
   The slot a strict majority gave.
   */
  const [slot,] = agreedSlotOf({
    voices,
    label,
    quote,
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
  if (slot === core) {
    return {
      kind: 'unlocated',
      reason: 'slot-whole',
    };
  }
  if (carriesOrCutsMarkup({ text: slot, },)) {
    return {
      kind: 'unlocated',
      reason: 'markup',
    };
  }
  return {
    kind: 'located',
    quote,
    core,
    start,
    slot,
    slotStart: inCore.at,
  };
}

/**
 Takes the rendering of every place whose located words overlap another place
 of the same slice, since one run of English cannot be two renderings and
 replacing the one would damage the other.

 @param places - slice of each place, in page order, where it is known

 @param renderings - each place's rendering as located, in the same order

 @returns The renderings, a place that overlaps another unlocated

 @example
 ```ts
 const separated = unlessOverlapping({ places, renderings, },);
 ```
 */
function unlessOverlapping(
  {
    places,
    renderings,
  }: {
    readonly places: readonly { readonly sliceIndex?: number; }[];
    readonly renderings: readonly ConsistencyRendering[];
  },
): readonly ConsistencyRendering[] {
  return renderings.map(function separated(
    rendering,
    position,
  ): ConsistencyRendering {
    if (rendering.kind !== 'located')
      return rendering;
    /**
     Slice this place stands in, where the caller knows it.
     */
    const sliceIndex = places[position]
      ?.sliceIndex;
    if (sliceIndex === undefined)
      return rendering;
    /**
     Whether another place of the slice has words over these.
     */
    const overlaps = renderings.some(function sharesWords(
      other,
      otherPosition,
    ): boolean {
      return (otherPosition !== position) && (other.kind === 'located')
        && (places[otherPosition]
          ?.sliceIndex
          === sliceIndex)
        && (rendering.start < (other.start
          + other.core
          .length))
        && (other.start < (rendering.start
          + rendering.core
          .length));
    },);
    return overlaps
      ? {
        kind: 'unlocated',
        reason: 'overlaps-another',
      }
      : rendering;
  },);
}

/**
 Counts the ballots of one group.

 @param voices - every heard ballot with its seat

 @param places - label and English of each place, in page order, with the slice
 it stands in where the caller knows it

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
      readonly sliceIndex?: number;
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
  const renderings = unlessOverlapping({
    places,
    renderings: places.map(function renderingOf(place,): ConsistencyRendering {
      return locatedRendering({
        voices: usableVoices,
        label: place.label,
        english: place.english,
        framed,
      },);
    },),
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

 @throws {@link ConsistencyInvariantError} when the chosen label is none of the
 sheet's labels, which a usable ballot cannot choose

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
  /**
   Position of the chosen label among the places.
   */
  const position = labels.indexOf(label,);
  if (position === (-1)) {
    throw new ConsistencyInvariantError({ invariant:
      `the label ${label} a majority chose is no label of the sheet, and a usable ballot chooses a label the sheet showed`, },);
  }
  if (renderings[position]
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
