/**
 Tests for grouping the receiving places of a group by the stretch of English
 that holds them: the words of the group's other places that stay as they are,
 the English a place's slice carries, the slice and the labels a unit names, and
 the units themselves, one for each block and one for words that lie in no
 single block.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CarryBlock,
  type CarryReceiver,
  ConsistencyInvariantError,
  englishOf,
  englishOfUnit,
  type HeldReceiver,
  isKeptOutcome,
  keptWordsOf,
  settleAsked,
  sliceOfUnit,
  unitLabelsOf,
  unitsOf,
} from '../../dist/final/node/index.mjs';
import { firstPlaceBallot, } from './consistency-group.test-fixture.ts';
import { placeIn, } from './consistency-settle.test-fixture.ts';

/**
 The English of the receiving slice, two paragraphs.
 */
const ENGLISH = 'The kitten naps.\n\nThe kitten purrs. The kitten naps.';

/**
 The first paragraph of that English.
 */
const FIRST_BLOCK: CarryBlock = { start: 0, end: 16, text: 'The kitten naps.', };

/**
 The second paragraph of that English.
 */
const SECOND_BLOCK: CarryBlock = { start: 18, end: 52, text: 'The kitten purrs. The kitten naps.', };

/**
 A receiving place of the group, in the slice that carries that English.

 @param label - its label

 @param position - its position in the group

 @param sliceIndex - the slice it stands in

 @returns The receiving place, whose plan moves nothing

 @example
 ```ts
 const receiver = receiverIn({ label: 'OCCURRENCE 2', position: 1, sliceIndex: 1, },);
 ```
 */
function receiverIn(
  {
    label,
    position,
    sliceIndex,
  }: {
    readonly label: string;
    readonly position: number;
    readonly sliceIndex: number;
  },
): CarryReceiver {
  /**
   A place of the slice, whose English is the two paragraphs.
   */
  const place = placeIn({ position: sliceIndex, english: ENGLISH, },);
  return {
    place,
    rendering: { kind: 'located', quote: 'The kitten naps', core: 'The kitten naps', start: 0, },
    plan: { kind: 'unavailable', },
    position,
    label,
  };
}

/**
 A receiving place held by a block.

 @param receiver - the receiving place

 @param block - the block that holds it, none where its words lie in no single block

 @returns The held receiver

 @example
 ```ts
 const held = heldIn({ receiver, block: [FIRST_BLOCK,], },);
 ```
 */
function heldIn(
  {
    receiver,
    block,
    spliceOnlyIn = [],
  }: {
    readonly receiver: CarryReceiver;
    readonly block: readonly CarryBlock[];
    readonly spliceOnlyIn?: HeldReceiver['spliceOnlyIn'];
  },
): HeldReceiver {
  return { receiver, block, spliceOnlyIn, };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: isKeptOutcome.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'KEEPS THE WORDS OF THE CHOSEN PLACE, A PLACE KEPT FOR ITS CONTEXT AND A PLACE THAT ALREADY AGREES, and no other',
          fn: async () => {
            expect(['chosen', 'kept-context', 'consistent', 'replaced', 'kept-current', 'untouched',].map(
              function keeps(outcome,): boolean {
                return isKeptOutcome({ outcome, },);
              },
            ),).toEqual([true, true, true, false, false, false,],);
          },
        },),
      ],
    },),
    describe({
      name: keptWordsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LISTS THE WORDS OF THE CHOSEN PLACE AND OF EVERY PLACE THAT ALREADY READS AS IT DOES, in page order, and '
            + 'not the words of a receiving place',
          fn: async () => {
            const quotes = [
              { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
              { label: 'OCCURRENCE 2', quote: 'the kitten naps', },
              { label: 'OCCURRENCE 3', quote: 'The cat naps', },
            ];
            const decided = settleAsked({
              repeat: { kind: 'maximal', wording: '小猫打盹', },
              places: [
                placeIn({ position: 0, english: 'The cat naps. It is warm.', },),
                placeIn({ position: 1, english: 'Later the kitten naps in the sun.', },),
                placeIn({ position: 2, english: 'Evening: The cat naps in the dark.', },),
              ],
              unplaced: [],
              asked: {
                quorum: 2,
                resumed: false,
                findings: [],
                voices: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotOf(seat,) {
                  return firstPlaceBallot({ seat, quotes, },);
                },),
              },
            },);
            expect(keptWordsOf({ decided, },),).toEqual([
              { sliceIndex: 0, start: 0, core: 'The cat naps', },
              { sliceIndex: 2, start: 9, core: 'The cat naps', },
            ],);
          },
        },),
        it({
          name: 'LISTS BESIDE THEM THE LOCATED WORDS OF EVERY PLACE OF EVERY OTHER GROUP, whatever became of the place, in page '
            + 'order, whichever order the other groups come in',
          fn: async () => {
            /**
             A group of two or three places that three judges quote alike and the first place wins.
             */
            function groupOf(
              { englishes, quotes, }: {
                readonly englishes: readonly (readonly [number, string])[];
                readonly quotes: readonly { readonly label: string; readonly quote: string; }[];
              },
            ): ReturnType<typeof settleAsked> {
              return settleAsked({
                repeat: { kind: 'maximal', wording: '小猫打盹', },
                places: englishes.map(function placeOf([position, english,],) {
                  return placeIn({ position, english, },);
                },),
                unplaced: [],
                asked: {
                  quorum: 2,
                  resumed: false,
                  findings: [],
                  voices: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotOf(seat,) {
                    return firstPlaceBallot({ seat, quotes, },);
                  },),
                },
              },);
            }
            const decided = groupOf({
              englishes: [
                [0, 'The cat naps. It is warm.',],
                [1, 'Later the kitten naps in the sun.',],
                [2, 'Evening: The cat naps in the dark.',],
              ],
              quotes: [
                { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
                { label: 'OCCURRENCE 2', quote: 'the kitten naps', },
                { label: 'OCCURRENCE 3', quote: 'The cat naps', },
              ],
            },);
            const sunny = groupOf({
              englishes: [[1, 'Later the kitten naps in the sun.',], [3, 'Dusk: the kitten purrs in the sun.',],],
              quotes: [
                { label: 'OCCURRENCE 1', quote: 'in the sun', },
                { label: 'OCCURRENCE 2', quote: 'in the sun', },
              ],
            },);
            const dark = groupOf({
              englishes: [[2, 'Evening: The cat naps in the dark.',], [4, 'Night: the kitten purrs.',],],
              quotes: [
                { label: 'OCCURRENCE 1', quote: 'in the dark', },
                { label: 'OCCURRENCE 2', quote: 'the kitten sleeps', },
              ],
            },);
            const expected = [
              { sliceIndex: 0, start: 0, core: 'The cat naps', },
              { sliceIndex: 1, start: 22, core: 'in the sun', },
              { sliceIndex: 2, start: 9, core: 'The cat naps', },
              { sliceIndex: 2, start: 22, core: 'in the dark', },
              { sliceIndex: 3, start: 23, core: 'in the sun', },
            ];
            expect([
              keptWordsOf({ decided, others: [sunny, dark,], },),
              keptWordsOf({ decided, others: [dark, sunny,], },),
            ],).toEqual([expected, expected,],);
          },
        },),
        it({
          name: 'LISTS NOTHING FOR A GROUP THAT NO PLACE WON, since no rendering was chosen to keep',
          fn: async () => {
            const decided = settleAsked({
              repeat: { kind: 'maximal', wording: '小猫打盹', },
              places: [
                placeIn({ position: 0, english: 'The cat naps. It is warm.', },),
                placeIn({ position: 1, english: 'Later the kitten naps in the sun.', },),
              ],
              unplaced: [],
              asked: { quorum: 2, resumed: false, findings: [], voices: [], },
            },);
            expect(keptWordsOf({ decided, },),).toEqual([],);
          },
        },),
      ],
    },),
    describe({
      name: englishOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'GIVES THE ENGLISH OF A SLICE THAT CARRIES ANY, and refuses a slice that carries none, since a rendering is '
            + 'located only in English',
          fn: async () => {
            const place = placeIn({ position: 1, english: ENGLISH, });
            const absent = { ...place, slice: { ...place.slice, current: { kind: 'absent', }, }, } as const;
            expect(englishOf({ place, },),).toBe(ENGLISH,);
            const refusal = caught(function readsAbsent(): unknown {
              return englishOf({ place: absent, },);
            },);
            expect(refusal,).toBeInstanceOf(ConsistencyInvariantError,);
            expect(String(refusal,),).toBe(
              'ConsistencyInvariantError: unreachable: slice 1 carries no English, and a rendering is located only in English',
            );
          },
        },),
      ],
    },),
    describe({
      name: `${sliceOfUnit.name}, ${englishOfUnit.name} and ${unitLabelsOf.name}`,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE SLICE, THE ENGLISH AND THE LABELS OF A UNIT FROM ITS RECEIVING PLACES, the labels joined by and',
          fn: async () => {
            const first = receiverIn({ label: 'OCCURRENCE 2', position: 1, sliceIndex: 1, });
            const second = receiverIn({ label: 'OCCURRENCE 3', position: 2, sliceIndex: 1, });
            const unit = { block: FIRST_BLOCK, writable: true, spliceOnlyIn: [], receivers: [first, second,], keeping: [], };
            expect({
              slice: sliceOfUnit({ unit, },).sliceIndex,
              english: englishOfUnit({ unit, },),
              labels: unitLabelsOf({ unit, },),
              one: unitLabelsOf({ unit: { ...unit, receivers: [first,], }, },),
            },).toEqual({
              slice: 1,
              english: ENGLISH,
              labels: 'OCCURRENCE 2 and OCCURRENCE 3',
              one: 'OCCURRENCE 2',
            },);
          },
        },),
        it({
          name: 'REFUSES A UNIT WITH NO RECEIVING PLACE, since a unit is made from a group of receivers',
          fn: async () => {
            const empty = { block: FIRST_BLOCK, writable: true, spliceOnlyIn: [], receivers: [], keeping: [], };
            expect([
              String(caught(function slices(): unknown {
                return sliceOfUnit({ unit: empty, },);
              },),),
              String(caught(function englishes(): unknown {
                return englishOfUnit({ unit: empty, },);
              },),),
            ],).toEqual([
              'ConsistencyInvariantError: unreachable: a unit has at least one receiving place, and a unit is made from a '
              + 'group of receivers',
              'ConsistencyInvariantError: unreachable: a unit has at least one receiving place, and a unit is made from a '
              + 'group of receivers',
            ],);
          },
        },),
      ],
    },),
    describe({
      name: unitsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'MAKES ONE UNIT OF TWO RECEIVING PLACES IN ONE BLOCK and one of a place in another block of the same slice, '
            + 'in the page order of the first place of each',
          fn: async () => {
            const first = receiverIn({ label: 'OCCURRENCE 2', position: 1, sliceIndex: 1, });
            const second = receiverIn({ label: 'OCCURRENCE 3', position: 2, sliceIndex: 1, });
            const third = receiverIn({ label: 'OCCURRENCE 4', position: 3, sliceIndex: 1, });
            const units = unitsOf({
              held: [
                heldIn({ receiver: first, block: [FIRST_BLOCK,], },),
                heldIn({ receiver: second, block: [FIRST_BLOCK,], },),
                heldIn({ receiver: third, block: [SECOND_BLOCK,], },),
              ],
              kept: [],
            },);
            expect(units,).toEqual([
              { block: FIRST_BLOCK, writable: true, spliceOnlyIn: [], receivers: [first, second,], keeping: [], },
              { block: SECOND_BLOCK, writable: true, spliceOnlyIn: [], receivers: [third,], keeping: [], },
            ],);
          },
        },),
        it({
          name: 'MAKES A UNIT OF THE WHOLE ENGLISH, NOT WRITABLE, FOR WORDS IN NO SINGLE BLOCK, apart from a place of the same '
            + 'slice that a block holds',
          fn: async () => {
            const first = receiverIn({ label: 'OCCURRENCE 2', position: 1, sliceIndex: 1, });
            const second = receiverIn({ label: 'OCCURRENCE 3', position: 2, sliceIndex: 1, });
            expect(unitsOf({
              held: [
                heldIn({ receiver: first, block: [], },),
                heldIn({ receiver: second, block: [FIRST_BLOCK,], },),
              ],
              kept: [],
            },),).toEqual([
              {
                block: { start: 0, end: ENGLISH.length, text: ENGLISH, },
                writable: false,
                spliceOnlyIn: [],
                receivers: [first,],
                keeping: [],
              },
              { block: FIRST_BLOCK, writable: true, spliceOnlyIn: [], receivers: [second,], keeping: [], },
            ],);
          },
        },),
        it({
          name: 'MAKES A UNIT OF THE WHOLE ENGLISH, NOT WRITABLE, FOR EACH KIND OF BLOCK NO PARAGRAPH REWRITE CAN CARRY, naming '
            + 'the kind, apart from the places that stand in no block and from a place a paragraph holds',
          fn: async () => {
            const first = receiverIn({ label: 'OCCURRENCE 2', position: 1, sliceIndex: 1, });
            const second = receiverIn({ label: 'OCCURRENCE 3', position: 2, sliceIndex: 1, });
            const third = receiverIn({ label: 'OCCURRENCE 4', position: 3, sliceIndex: 1, });
            const fourth = receiverIn({ label: 'OCCURRENCE 5', position: 4, sliceIndex: 1, });
            const fifth = receiverIn({ label: 'OCCURRENCE 6', position: 5, sliceIndex: 1, });
            const whole: CarryBlock = { start: 0, end: ENGLISH.length, text: ENGLISH, };
            expect(unitsOf({
              held: [
                heldIn({ receiver: first, block: [], spliceOnlyIn: ['table',], },),
                heldIn({ receiver: second, block: [], spliceOnlyIn: ['code block',], },),
                heldIn({ receiver: third, block: [], },),
                heldIn({ receiver: fourth, block: [], spliceOnlyIn: ['table',], },),
                heldIn({ receiver: fifth, block: [FIRST_BLOCK,], },),
              ],
              kept: [],
            },),).toEqual([
              {
                block: whole,
                writable: false,
                spliceOnlyIn: ['table',],
                receivers: [first, fourth,],
                keeping: [],
              },
              { block: whole, writable: false, spliceOnlyIn: ['code block',], receivers: [second,], keeping: [], },
              { block: whole, writable: false, spliceOnlyIn: [], receivers: [third,], keeping: [], },
              { block: FIRST_BLOCK, writable: true, spliceOnlyIn: [], receivers: [fifth,], keeping: [], },
            ],);
          },
        },),
        it({
          name: 'KEEPS WITH A UNIT THE WORDS OF OTHER PLACES THAT STAND INSIDE ITS BLOCK AND IN ITS SLICE, and not words in '
            + 'another slice, outside the block or crossing its edge',
          fn: async () => {
            const receiver = receiverIn({ label: 'OCCURRENCE 2', position: 1, sliceIndex: 1, });
            const [unit,] = unitsOf({
              held: [heldIn({ receiver, block: [SECOND_BLOCK,], },),],
              kept: [
                { sliceIndex: 1, start: 18, core: 'The kitten purrs', },
                { sliceIndex: 1, start: 0, core: 'The kitten naps', },
                { sliceIndex: 2, start: 18, core: 'The kitten purrs', },
                { sliceIndex: 1, start: 40, core: 'The kitten naps. And more', },
                { sliceIndex: 1, start: 36, core: 'The kitten naps.', },
              ],
            },);
            expect(unit?.keeping,).toEqual(['The kitten purrs', 'The kitten naps.',],);
          },
        },),
        it({
          name: 'REFUSES A SLICE THAT CARRIES NO ENGLISH when its place has no block, since the whole English is then the block',
          fn: async () => {
            const place = placeIn({ position: 1, english: ENGLISH, });
            const receiver: CarryReceiver = {
              ...receiverIn({ label: 'OCCURRENCE 2', position: 1, sliceIndex: 1, }),
              place: { ...place, slice: { ...place.slice, current: { kind: 'absent', }, }, },
            };
            const refusal = caught(function unitsOfAbsent(): unknown {
              return unitsOf({ held: [heldIn({ receiver, block: [], },),], kept: [], },);
            },);
            expect(String(refusal,),).toBe(
              'ConsistencyInvariantError: unreachable: slice 1 carries no English, and a rendering is located only in English',
            );
          },
        },),
        it({
          name: 'MAKES NO UNIT FROM NO RECEIVING PLACE',
          fn: async () => {
            expect(unitsOf({ held: [], kept: [], },),).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
