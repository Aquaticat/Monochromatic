import type { CarryBlock, } from '../consistency-carry.ts';
import { ConsistencyInvariantError, } from '../consistency-invariant-error.ts';
import type { ConsistencyPlace, } from './pass-consistency-group.ts';
import type { ConsistencySliceFacts, } from './pass-consistency-slices.ts';
import type {
  CarryReceiver,
  CarryUnit,
  DecidedGroup,
} from './pass-consistency-types.ts';

//region Pass consistency carry units
// WHICH RECEIVING PLACES ARE CARRIED TO TOGETHER. A rewrite of a block carries
// every receiving place the block holds, and the splice of the chosen words
// moves every one of them, so receiving places are grouped by the stretch of
// English that holds them: the innermost block, or, for words that lie in no
// single block, the whole English of the slice, where only the code splice and
// the current English stand for the place. A place of the group that is not a
// receiving place (the chosen place, a place the majority keeps for its context,
// a place that already reads as the chosen place does) keeps its words inside a
// block that is rewritten: they are listed with the unit, and a rewrite that
// changes them is withheld.

/**
 A receiving place with the block of its English that holds its words.

 @example
 ```ts
 const held: HeldReceiver = { receiver, block: [], };
 ```
 */
export type HeldReceiver = {
  /**
   The receiving place.
   */
  readonly receiver: CarryReceiver;

  /**
   The innermost block of its English that holds its words, as a list of zero
   or one: none where the words lie in no single block.
   */
  readonly block: readonly CarryBlock[];
};

/**
 Words of another place of the group, with where they stand.

 @example
 ```ts
 const kept: KeptWords = { sliceIndex: 0, start: 4, core: 'The cat naps', };
 ```
 */
export type KeptWords = {
  /**
   Slice whose English holds the words.
   */
  readonly sliceIndex: number;

  /**
   Offset in that English where the words start.
   */
  readonly start: number;

  /**
   The words.
   */
  readonly core: string;
};

/**
 Provisional outcomes of a place whose words a carry must leave as they are.
 */
const KEPT_OUTCOMES: ReadonlySet<string> = new Set([
  'chosen',
  'kept-context',
  'consistent',
],);

/**
 The words of the group's places that a carry must leave as they are: the
 chosen place, the places the majority keeps for their context and the places
 that already read as the chosen place does, each as its located rendering.

 @param decided - the group with its renderings and provisional outcomes

 @returns The words with their slice and offset, in page order

 @example
 ```ts
 const kept = keptWordsOf({ decided, },);
 ```
 */
export function keptWordsOf({ decided, }: { readonly decided: DecidedGroup; },): readonly KeptWords[] {
  return decided.places
    .flatMap(function keptOf(
      place,
      position,
    ): readonly KeptWords[] {
      /**
       This place's rendering.
       */
      const rendering = decided.renderings[position];
      /**
       This place's provisional outcome.
       */
      const outcome = decided.outcomes[position];
      if (rendering === undefined)
        return [];
      if (rendering.kind !== 'located')
        return [];
      if (outcome === undefined)
        return [];
      if (!KEPT_OUTCOMES.has(outcome,))
        return [];
      return [
        {
          sliceIndex: place.slice
            .sliceIndex,
          start: rendering.start,
          core: rendering.core,
        },
      ];
    },);
}

/**
 The English of a place's slice, which a located place has.

 @param place - the place

 @returns The slice's English

 @throws {@link ConsistencyInvariantError} when the slice carries none, since a rendering is located only in English

 @example
 ```ts
 const english = englishOf({ place, },);
 ```
 */
export function englishOf({ place, }: { readonly place: ConsistencyPlace; },): string {
  if (place.slice
    .current
    .kind
    === 'absent') {
    throw new ConsistencyInvariantError({ invariant:
      `slice ${String(place.slice
        .sliceIndex,)} carries no English, and a rendering is located only in English`, },);
  }
  return place.slice
    .current
    .text;
}

/**
 The slice that holds the receiving places of a unit, which they share.

 @param unit - the unit

 @returns The slice's facts

 @throws {@link ConsistencyInvariantError} when the unit has no receiving place

 @example
 ```ts
 const facts = sliceOfUnit({ unit, },);
 ```
 */
export function sliceOfUnit({ unit, }: { readonly unit: CarryUnit; },): ConsistencySliceFacts {
  /**
   The first receiving place, whose slice every other shares.
   */
  const [first,] = unit.receivers;
  if (first === undefined) {
    throw new ConsistencyInvariantError({ invariant:
      'a unit has at least one receiving place, and a unit is made from a group of receivers', },);
  }
  return first.place
    .slice;
}

/**
 The English of the slice that holds the receiving places of a unit.

 @param unit - the unit

 @returns The slice's English

 @throws {@link ConsistencyInvariantError} when the unit has no receiving place or its slice carries no English

 @example
 ```ts
 const english = englishOfUnit({ unit, },);
 ```
 */
export function englishOfUnit({ unit, }: { readonly unit: CarryUnit; },): string {
  /**
   The first receiving place, whose slice every other shares.
   */
  const [first,] = unit.receivers;
  if (first === undefined) {
    throw new ConsistencyInvariantError({ invariant:
      'a unit has at least one receiving place, and a unit is made from a group of receivers', },);
  }
  return englishOf({ place: first.place, },);
}

/**
 The labels of the receiving places of a unit, for the findings that name them.

 @param unit - the unit

 @returns The labels joined by `and`, in page order

 @example
 ```ts
 const named = unitLabelsOf({ unit, },); // 'OCCURRENCE 2 and OCCURRENCE 3'
 ```
 */
export function unitLabelsOf({ unit, }: { readonly unit: CarryUnit; },): string {
  return unit.receivers
    .map(function labelOf({ label, },): string {
      return label;
    },)
    .join(' and ',);
}

/**
 The name a stretch of English is grouped under: its slice and its offsets, or
 its slice alone for the whole English.

 @param held - a receiving place with its block

 @returns The grouping key

 @example
 ```ts
 const key = unitKeyOf({ held, },); // '1:0:34'
 ```
 */
function unitKeyOf({ held, }: { readonly held: HeldReceiver; },): string {
  /**
   The slice that holds the place.
   */
  const slice = String(held.receiver
    .place
    .slice
    .sliceIndex,);
  /**
   The block, none where the words lie in no single block.
   */
  const [block,] = held.block;
  return (block === undefined) ? `${slice}:whole` : `${slice}:${String(block.start,)}:${String(block.end,)}`;
}

/**
 The stretch of English a group of held receivers is carried to.

 @param members - the receivers of one stretch, in page order

 @returns The block of their English, and whether a writer can be given it

 @throws {@link ConsistencyInvariantError} when the receivers' slice carries no English

 @example
 ```ts
 const { block, writable, } = stretchOf({ members, },);
 ```
 */
function stretchOf(
  { members, }: { readonly members: readonly HeldReceiver[]; },
): {
  readonly block: CarryBlock;
  readonly writable: boolean;
} {
  /**
   The first receiver, whose slice and block every member shares.
   */
  const [first,] = members;
  if (first === undefined) {
    throw new ConsistencyInvariantError({ invariant:
      'a stretch of English is carried to at least one receiving place, and a unit is made from a group of receivers', },);
  }
  /**
   The block, none where the words lie in no single block.
   */
  const [block,] = first.block;
  if (block !== undefined) {
    return {
      block,
      writable: true,
    };
  }
  /**
   The whole English of the receivers' slice.
   */
  const english = englishOf({
    place: first.receiver
      .place,
  },);
  return {
    block: {
      start: 0,
      end: english.length,
      text: english,
    },
    writable: false,
  };
}

/**
 Groups the receiving places of a group by the stretch of English that holds
 them.

 @param held - every receiving place with its block, in page order

 @param kept - the words of the group's other places that must stay as they are

 @returns One unit for each stretch, in the page order of its first receiving place

 @throws {@link ConsistencyInvariantError} when a slice carries no English

 @example
 ```ts
 const units = unitsOf({ held, kept: [], },);
 ```
 */
export function unitsOf(
  {
    held,
    kept,
  }: {
    readonly held: readonly HeldReceiver[];
    readonly kept: readonly KeptWords[];
  },
): readonly CarryUnit[] {
  /**
   Receivers of each stretch, keyed by the stretch, in the order the stretches are first met.
   */
  const stretches = new Map<string, HeldReceiver[]>();
  for (const entry of held) {
    /**
     The stretch this receiver's words stand in.
     */
    const key = unitKeyOf({ held: entry, },);
    /**
     The receivers already met in this stretch.
     */
    const members = stretches.get(key,);
    if (members === undefined) {
      stretches.set(
        key,
        [entry,],
      );
    }
    else {
      members.push(entry,);
    }
  }
  return [...stretches.values(),]
    .map(function unitOf(members,): CarryUnit {
      /**
       The stretch the members are carried to.
       */
      const {
        block,
        writable,
      } = stretchOf({ members, },);
      /**
       The slice the members stand in.
       */
      const sliceIndex = members[0]
        ?.receiver
        .place
        .slice
        .sliceIndex;
      return {
        block,
        writable,
        receivers: members.map(function receiverOf({ receiver, },): CarryReceiver {
          return receiver;
        },),
        keeping: kept
          .filter(function standsInBlock(
            {
              sliceIndex: wordsSlice,
              start: wordsStart,
              core,
            },
          ): boolean {
            return (wordsSlice === sliceIndex) && (block.start <= wordsStart)
              && ((wordsStart + core.length) <= block.end);
          },)
          .map(function coreOf({ core, },): string {
            return core;
          },),
      };
    },);
}

//endregion Pass consistency carry units
