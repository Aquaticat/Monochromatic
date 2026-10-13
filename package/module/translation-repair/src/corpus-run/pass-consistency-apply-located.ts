import { standsOf, } from '../consistency-fold.ts';
import { consistencyLabel, } from '../consistency-wire.ts';
import { isKeptOutcome, } from './pass-consistency-carry-units.ts';
import type {
  PendingEdit,
  SettledGroup,
} from './pass-consistency-types.ts';

//region Pass consistency apply located
// A BLOCK REPLACEMENT MUST NOT CHANGE THE WORDS ANOTHER GROUP LOCATED IN IT. A
// writer's block is written for one group, with the words of the other groups
// listed as words to keep, and the candidate is withheld when it loses them. The
// groups settle at the same time, though, and a writer is only asked to keep, so
// the replacement is checked again where all the groups' replacements meet: a
// block replacement that covers a located place of another group and changes
// its words is left out. The test reads the English as it stood when the pass
// began and the located words of every group, so it does not depend on the order
// the groups come in.
//
// A CODE SPLICE IS HELD TO THE PLACES ANOTHER GROUP KEEPS. It replaces the words
// of its own receiving places, so it can change another group's words only where
// they overlap, and where the other group's place is a receiving place too the
// earlier group wins (`pass-consistency-apply.ts`). Where the other group's place
// is one that group keeps (its chosen place, a place the majority keeps for its
// context, a place that already reads as the chosen one), no group's replacement
// is meant to change it, so the splice that does is left out.

/**
 A replacement left out for changing words another group located, with the
 place whose words it changes.

 @example
 ```ts
 const left: LeftOutEdit = { group: 0, edit, other: { group: 1, label: 'OCCURRENCE 3', }, };
 ```
 */
export type LeftOutEdit = {
  /**
   Position of the replacement's group on the page, from zero.
   */
  readonly group: number;

  /**
   The replacement.
   */
  readonly edit: PendingEdit;

  /**
   The place of another group whose words it changes.
   */
  readonly other: {
    /**
     Position of that group on the page, from zero.
     */
    readonly group: number;

    /**
     Label of the place.
     */
    readonly label: string;

    /**
     Offset in the slice's English where the place's located words start.
     */
    readonly start: number;
  };
};

/**
 Whether a replacement changes located words: it covers part of them, or
 covers all of them and holds them fewer times than the text it replaces.

 @param edit - the replacement

 @param english - the slice's English as it stood when the pass began

 @param words - the located words, with where they start

 @returns Whether the replacement changes them

 @example
 ```ts
 const changes = changesWords({ edit, english, words: { start: 4, core: 'The cat naps', }, },);
 ```
 */
function changesWords(
  {
    edit,
    english,
    words,
  }: {
    readonly edit: PendingEdit;
    readonly english: string;
    readonly words: {
      readonly start: number;
      readonly core: string;
    };
  },
): boolean {
  /**
   Where the located words start, and the words.
   */
  const {
    start,
    core,
  } = words;
  /**
   Exclusive offset where the located words end.
   */
  const end = start + core.length;
  if ((edit.end <= start) || (end <= edit.start))
    return false;
  if ((start < edit.start) || (edit.end < end))
    return true;
  return standsOf({
    haystack: edit.text,
    words: core,
  },) < standsOf({
    haystack: english.slice(
      edit.start,
      edit.end,
    ),
    words: core,
  },);
}

/**
 The places of one other group, in a slice, whose located words a replacement
 changes.

 @param edit - the replacement

 @param other - the other group

 @param otherPosition - position of that group on the page, from zero

 @param sliceIndex - the slice

 @param english - the slice's English as it stood when the pass began

 @returns The places, in the order of the group's places

 @example
 ```ts
 const places = placesChangedBy({ edit, other, otherPosition: 1, sliceIndex: 2, english, },);
 ```
 */
function placesChangedBy(
  {
    edit,
    other,
    otherPosition,
    sliceIndex,
    english,
  }: {
    readonly edit: PendingEdit;
    readonly other: SettledGroup;
    readonly otherPosition: number;
    readonly sliceIndex: number;
    readonly english: string;
  },
): readonly LeftOutEdit['other'][] {
  return other.places
    .flatMap(function changedPlace(
      place,
      position,
    ): readonly LeftOutEdit['other'][] {
      /**
       This place's rendering.
       */
      const rendering = other.renderings[position];
      /**
       This place's provisional outcome.
       */
      const outcome = other.outcomes[position];
      if (rendering?.kind !== 'located')
        return [];
      /**
       The slice the place stands in.
       */
      const placeSlice = place.slice
        .sliceIndex;
      if (placeSlice !== sliceIndex)
        return [];
      // A splice is held only to the places its group keeps; a receiving place of another group is arbitrated by order.
      if ((edit.kind === 'splice') && ((outcome === undefined) || (!isKeptOutcome({ outcome, },))))
        return [];
      /**
       Whether the replacement changes this place's words.
       */
      const changes = changesWords({
        edit,
        english,
        words: {
          start: rendering.start,
          core: rendering.core,
        },
      },);
      return changes
        ? [
          {
            group: otherPosition,
            label: consistencyLabel({ position, },),
            start: rendering.start,
          },
        ]
        : [];
    },);
}

/**
 The replacements of a slice that change the located words of a place of another
 group: a block replacement against any located place, a code splice against a
 place its group keeps.

 @param settled - the groups in page order, with their pending replacements

 @param sliceIndex - the slice

 @param english - the slice's English as it stood when the pass began

 @returns Each such replacement once, with the first place it changes in page order, in the order of the groups

 @example
 ```ts
 const leftOut = editsChangingLocatedWords({ settled, sliceIndex: 2, english, },);
 ```
 */
export function editsChangingLocatedWords(
  {
    settled,
    sliceIndex,
    english,
  }: {
    readonly settled: readonly SettledGroup[];
    readonly sliceIndex: number;
    readonly english: string;
  },
): readonly LeftOutEdit[] {
  return settled.flatMap(function leftOutOf(
    group,
    groupPosition,
  ): readonly LeftOutEdit[] {
    return group.edits
      .filter(function isHere(edit,): boolean {
        return edit.sliceIndex === sliceIndex;
      },)
      .flatMap(function changedBy(edit,): readonly LeftOutEdit[] {
        /**
         The places of the other groups, in this slice, whose located words the replacement changes.
         */
        const changed = settled.flatMap(function placesOf(
          other,
          otherPosition,
        ): readonly LeftOutEdit['other'][] {
          return (otherPosition === groupPosition)
            ? []
            : placesChangedBy({
              edit,
              other,
              otherPosition,
              sliceIndex,
              english,
            },);
        },);
        /**
         The first of them in page order.
         */
        const [first,] = changed.toSorted(function inPageOrder(
          left,
          right,
        ): number {
          return (left.start - right.start) || (left.group - right.group);
        },);
        return (first === undefined)
          ? []
          : [
            {
              group: groupPosition,
              edit,
              other: first,
            },
          ];
      },);
  },);
}

//endregion Pass consistency apply located
