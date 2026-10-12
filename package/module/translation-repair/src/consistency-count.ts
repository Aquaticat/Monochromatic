import { locateWords, } from './consistency-fold.ts';
import { carriesOrCutsMarkup, } from './consistency-markup.ts';
import {
  agreedSlotWordsOf,
  agreedWordsOf,
  isKeptByMajority,
  majorityChoiceOf,
  tiedForFirstOf,
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
// BALLOTS AGREE ON A PLACE WHEN THEIR QUOTES LOCATE THE SAME SPAN OF THE PLACE'S
// OWN ENGLISH (`consistency-fold.ts`): a line break written as a space, a curly
// apostrophe written straight, the closing full stop kept or left off and a run
// of spaces do not make two quotes two texts. A STRICT MAJORITY OF THE USABLE
// BALLOTS must name one span, and that span must stand exactly once in the
// English; the place then carries the words the English holds there, never a
// judge's string. A ballot whose quote stands nowhere or twice is one of the
// usable ballots that did not agree. Otherwise the place is unlocated and stays
// as it stands. THE CHOICE WINS ON A STRICT MAJORITY and only with the quorum
// the gather closed on, and only if its own span is located; two or more labels
// tied for first are named as the finalists of a run-off, which the pass asks
// once (`finalists`). A PLACE IS KEPT when a strict majority list it.
//
// A SLOT IS NO CONDITION OF A SPAN. A frame's slot words are agreed the same way
// inside the span, and a place whose slot is not agreed (or is all of the span,
// or stands twice, or cuts markup) is still located, only without a slot, which
// leaves the code splice unavailable for it and the writers to carry the slot.
//
// A SPAN THAT CANNOT BE MOVED WHOLE STAYS WHERE IT IS: one that cuts markup or
// carries a footnote mark (`consistency-markup.ts`), and two places of one slice
// whose words overlap, are left unlocated.
//
// NOTHING HERE WRITES TEXT. The words a replacement carries are words the
// English holds, and the splice (`consistency-splice.ts`) only moves them.

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
 The slot words a strict majority gave inside a located span, as the English
 holds them.

 @param voices - usable ballots

 @param label - the place's label

 @param words - the folded words the span was agreed by

 @param span - the English's own words of the span

 @returns The slot as the span holds it and its offset in the span, as a list of
 zero or one; none when the ballots do not agree on a slot, it shows a reader
 nothing, it does not stand once inside the span, it is all of the span, or it
 cuts markup

 @example
 ```ts
 const [slot,] = slotInSpan({ voices, label: 'OCCURRENCE 1', words: 'so she was a girl, wasn\'t she', span: 'So she was a girl, wasn’t she', },);
 ```
 */
export function slotInSpan(
  {
    voices,
    label,
    words,
    span,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly label: string;
    readonly words: string;
    readonly span: string;
  },
): readonly {
  readonly slot: string;
  readonly slotStart: number;
}[] {
  /**
   The slot words a strict majority gave beside the agreed words.
   */
  const [slotWords,] = agreedSlotWordsOf({
    voices,
    label,
    words,
  },);
  if ((slotWords === undefined) || rendersAsNothing({ text: slotWords, },))
    return [];
  /**
   Where the slot words stand in the span.
   */
  const inside = locateWords({
    haystack: span,
    words: slotWords,
  },);
  if (inside.kind !== 'once')
    return [];
  /**
   The slot as the span holds it.
   */
  const slot = span.slice(
    inside.start,
    inside.end,
  );
  if ((slot === span) || carriesOrCutsMarkup({ text: slot, },))
    return [];
  return [
    {
      slot,
      slotStart: inside.start,
    },
  ];
}

/**
 Locates the span a strict majority of the usable ballots named for one place,
 and the slot inside it that they agreed on.

 @param voices - usable ballots

 @param label - the place's label

 @param english - the place's English

 @param framed - whether the group is a frame with a slot

 @returns The located rendering, carrying the words the English holds, or why it is not

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
   The folded words a strict majority of the usable ballots quoted.
   */
  const [words,] = agreedWordsOf({
    voices,
    label,
  },);
  if (words === undefined) {
    return {
      kind: 'unlocated',
      reason: 'no-agreement',
    };
  }
  if (rendersAsNothing({ text: words, },)) {
    return {
      kind: 'unlocated',
      reason: 'empty',
    };
  }
  /**
   Where the words stand in the English.
   */
  const found = locateWords({
    haystack: english.text,
    words,
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
  /**
   The English's own words of the span.
   */
  const span = english.text
    .slice(
    found.start,
    found.end,
  );
  if (carriesOrCutsMarkup({ text: span, },)) {
    return {
      kind: 'unlocated',
      reason: 'markup',
    };
  }
  if (!framed) {
    return {
      kind: 'located',
      quote: span,
      core: span,
      start: found.start,
    };
  }
  /**
   The slot inside the span, none when the ballots did not pin one down.
   */
  const [inSpan,] = slotInSpan({
    voices,
    label,
    words,
    span,
  },);
  return {
    kind: 'located',
    quote: span,
    core: span,
    start: found.start,
    ...inSpan,
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
    finalists: ((usableVoices.length === 0) || (usableVoices.length < quorum))
      ? []
      : tiedForFirstOf({
        voices: usableVoices,
        labels,
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
