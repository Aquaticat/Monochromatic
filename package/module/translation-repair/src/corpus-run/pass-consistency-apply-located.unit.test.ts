/**
 Tests for finding the replacements that change the words another group located:
 a block that still holds the words is not one, a block that drops or cuts them
 is, a code splice is one only against a place its group keeps, a group's own
 places never count, and the result is the same whichever order the groups come
 in.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  editsChangingLocatedWords,
  type PendingEdit,
  type SettledGroup,
  settleAsked,
} from '../../dist/final/node/index.mjs';
import { firstPlaceBallot, } from './consistency-group.test-fixture.ts';
import { placeIn, } from './consistency-settle.test-fixture.ts';

/**
 The English of the second slice.
 */
const SECOND = 'Later the kitten naps in the sun.';

/**
 The English of the fourth slice.
 */
const FOURTH = 'Dusk: the kitten purrs in the sun.';

/**
 A group whose first place wins and whose places are settled in the slices it names.

 @param places - the slice and the English of each place, with the quote the judges give for it

 @returns The group, with no pending replacement

 @example
 ```ts
 const group = groupIn({ places: [{ slice: 1, english: SECOND, quote: 'in the sun', },], });
 ```
 */
function groupIn(
  { places, }: {
    readonly places: readonly {
      readonly slice: number;
      readonly english: string;
      readonly quote: string;
    }[];
  },
): SettledGroup {
  return settleAsked({
    repeat: { kind: 'maximal', wording: '小猫打盹', },
    places: places.map(function placeOf({ slice, english, },) {
      return placeIn({ position: slice, english, },);
    },),
    unplaced: [],
    asked: {
      quorum: 2,
      resumed: false,
      findings: [],
      voices: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotOf(seat,) {
        return firstPlaceBallot({
          seat,
          quotes: places.map(function quoteOf({ quote, }, position,) {
            return { label: `OCCURRENCE ${String(position + 1,)}`, quote, };
          },),
        },);
      },),
    },
  },);
}

/**
 The group with one pending replacement.

 @param group - the group

 @param edit - the replacement

 @returns The group that would make it

 @example
 ```ts
 const pending = withEdit({ group, edit, },);
 ```
 */
function withEdit({ group, edit, }: { readonly group: SettledGroup; readonly edit: PendingEdit; },): SettledGroup {
  return { ...group, edits: [edit,], };
}

/**
 A replacement of the second slice's whole English.

 @param kind - what the replacement is

 @param start - where the replaced text starts

 @param text - the text that goes in

 @returns The replacement, naming the second place of the group

 @example
 ```ts
 const edit = secondSliceEdit({ kind: 'block', start: 0, text: 'Later the kitten sleeps.', },);
 ```
 */
function secondSliceEdit(
  { kind, start, text, }: { readonly kind: PendingEdit['kind']; readonly start: number; readonly text: string; },
): PendingEdit {
  return { kind, placePositions: [1,], sliceIndex: 1, start, end: SECOND.length, text, };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: editsChangingLocatedWords.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES A BLOCK REPLACEMENT THAT DROPS OR CUTS THE WORDS ANOTHER GROUP LOCATED, with the group and the place, '
            + 'and none that still holds them; names a splice only against a place its group keeps',
          fn: async () => {
            const mine = groupIn({
              places: [
                { slice: 0, english: 'The cat naps. It is warm.', quote: 'The cat naps.', },
                { slice: 1, english: SECOND, quote: 'the kitten naps', },
              ],
            },);
            const other = groupIn({
              places: [
                { slice: 1, english: SECOND, quote: 'in the sun', },
                { slice: 3, english: FOURTH, quote: 'in the sun', },
              ],
            },);
            const receiving = groupIn({
              places: [
                { slice: 3, english: 'Dusk: the kitten purrs by the fire.', quote: 'by the fire', },
                { slice: 1, english: SECOND, quote: 'in the sun', },
              ],
            },);
            /**
             What the replacement of the second slice leaves out, for a replacement of mine beside another group.
             */
            function leftOutBy(
              { edit, beside = other, }: { readonly edit: PendingEdit; readonly beside?: SettledGroup; },
            ): unknown {
              return editsChangingLocatedWords({
                settled: [withEdit({ group: mine, edit, },), beside,],
                sliceIndex: 1,
                english: SECOND,
              },);
            }
            const dropping = secondSliceEdit({ kind: 'block', start: 0, text: 'Later the kitten sleeps.', },);
            const cutting = secondSliceEdit({ kind: 'block', start: 10, text: 'kitten sleeps', },);
            expect({
              dropping: leftOutBy({ edit: dropping, },),
              cutting: leftOutBy({ edit: { ...cutting, end: 25, }, },),
              holding: leftOutBy({
                edit: secondSliceEdit({ kind: 'block', start: 0, text: 'Later the kitten sleeps in the sun.', },),
              },),
              spliceAgainstKept: leftOutBy({ edit: { ...dropping, kind: 'splice', }, },),
              spliceAgainstReceiving: leftOutBy({ edit: { ...dropping, kind: 'splice', }, beside: receiving, },),
              blockAgainstReceiving: leftOutBy({ edit: dropping, beside: receiving, },),
            },).toEqual({
              dropping: [{ group: 0, edit: dropping, other: { group: 1, label: 'OCCURRENCE 1', start: 22, }, },],
              cutting: [
                {
                  group: 0,
                  edit: { ...cutting, end: 25, },
                  other: { group: 1, label: 'OCCURRENCE 1', start: 22, },
                },
              ],
              holding: [],
              spliceAgainstKept: [
                {
                  group: 0,
                  edit: { ...dropping, kind: 'splice', },
                  other: { group: 1, label: 'OCCURRENCE 1', start: 22, },
                },
              ],
              spliceAgainstReceiving: [],
              blockAgainstReceiving: [{ group: 0, edit: dropping, other: { group: 1, label: 'OCCURRENCE 2', start: 22, }, },],
            },);
          },
        },),
        it({
          name: 'NEVER COUNTS A GROUP\'S OWN PLACES OR A PLACE IN ANOTHER SLICE, and gives the same replacement whichever '
            + 'order the groups come in',
          fn: async () => {
            const mine = groupIn({ places: [{ slice: 1, english: SECOND, quote: 'in the sun', },], },);
            const other = groupIn({ places: [{ slice: 3, english: FOURTH, quote: 'in the sun', },], },);
            const edit = secondSliceEdit({ kind: 'block', start: 0, text: 'Later the kitten sleeps.', },);
            const pending = withEdit({ group: mine, edit, },);
            const sibling = groupIn({ places: [{ slice: 1, english: SECOND, quote: 'the kitten naps', },], },);
            expect({
              ownAndElsewhere: editsChangingLocatedWords({ settled: [pending, other,], sliceIndex: 1, english: SECOND, },),
              forward: editsChangingLocatedWords({ settled: [pending, sibling,], sliceIndex: 1, english: SECOND, },),
              backward: editsChangingLocatedWords({ settled: [sibling, pending,], sliceIndex: 1, english: SECOND, },),
            },).toEqual({
              ownAndElsewhere: [],
              forward: [{ group: 0, edit, other: { group: 1, label: 'OCCURRENCE 1', start: 6, }, },],
              backward: [{ group: 1, edit, other: { group: 0, label: 'OCCURRENCE 1', start: 6, }, },],
            },);
          },
        },),
        it({
          name: 'NAMES THE FIRST OF SEVERAL PLACES IT CHANGES in page order, once for the replacement',
          fn: async () => {
            const mine = groupIn({ places: [{ slice: 1, english: SECOND, quote: 'Later the kitten', },], },);
            const first = groupIn({ places: [{ slice: 1, english: SECOND, quote: 'in the sun', },], },);
            const second = groupIn({ places: [{ slice: 1, english: SECOND, quote: 'the kitten naps', },], },);
            const edit = secondSliceEdit({ kind: 'block', start: 0, text: 'Evening.', },);
            expect(editsChangingLocatedWords({
              settled: [withEdit({ group: mine, edit, },), first, second,],
              sliceIndex: 1,
              english: SECOND,
            },),).toEqual([{ group: 0, edit, other: { group: 2, label: 'OCCURRENCE 1', start: 6, }, },],);
          },
        },),
      ],
    },),
  ],
},);
