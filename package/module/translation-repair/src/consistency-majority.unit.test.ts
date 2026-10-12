/**
 Tests for what a strict majority of a group's usable ballots agree on: a
 quote, a slot, a choice, a kept place. Strict means more than half of the
 usable ballots, so a tie agrees on nothing and a ballot that gave nothing
 counts against whatever the others gave.

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
  agreedQuoteOf,
  agreedSlotOf,
  type ConsistencyVoice,
  consistencyLabels,
  isKeptByMajority,
  majorityChoiceOf,
  usableVoicesOf,
} from '../dist/final/node/index.mjs';

/**
 Fields of a ballot a case replaces.
 */
type VoiceOverrides = {
  readonly reason?: string;
  readonly quotes?: ConsistencyVoice['quotes'];
  readonly choice?: string;
  readonly keep?: readonly string[];
};

/**
 Builds one heard ballot over two places.

 @param seat - seat that answered

 @param over - fields this case replaces

 @returns Ballot with its seat

 @example
 ```ts
 const voice = voiceOf({ seat: 'a', over: { choice: 'OCCURRENCE 2', }, },);
 ```
 */
function voiceOf(
  {
    seat,
    over = {},
  }: {
    readonly seat: string;
    readonly over?: VoiceOverrides;
  },
): ConsistencyVoice {
  return {
    seat,
    reason: 'The first rendering is the more faithful.',
    quotes: [{ label: 'OCCURRENCE 1', quote: 'the cat naps', slot: 'naps', },],
    choice: 'OCCURRENCE 1',
    keep: [],
    ...over,
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: agreedQuoteOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE QUOTE MORE THAN HALF OF THE USABLE BALLOTS GAVE, and none when no text has more than half',
          fn: async () => {
            const same = [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', },), voiceOf({ seat: 'c', over: { quotes: [], }, },),];
            const split = [
              voiceOf({ seat: 'a', },),
              voiceOf({ seat: 'b', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'the cat dozes', },], }, },),
            ];
            expect([
              agreedQuoteOf({ voices: same, label: 'OCCURRENCE 1', },),
              agreedQuoteOf({ voices: split, label: 'OCCURRENCE 1', },),
              agreedQuoteOf({ voices: same, label: 'OCCURRENCE 2', },),
              agreedQuoteOf({ voices: [], label: 'OCCURRENCE 1', },),
            ],).toEqual([['the cat naps',], [], [], [],],);
          },
        },),
      ],
    },),
    describe({
      name: agreedSlotOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE SLOT MORE THAN HALF OF THE USABLE BALLOTS GAVE, a ballot that quoted no slot counting against it',
          fn: async () => {
            const slotted = [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', },), voiceOf({ seat: 'c', },),];
            const mostlyBare = [
              voiceOf({ seat: 'a', },),
              voiceOf({ seat: 'b', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'the cat naps', },], }, },),
              voiceOf({ seat: 'c', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'the cat naps', },], }, },),
            ];
            expect([
              agreedSlotOf({ voices: slotted, label: 'OCCURRENCE 1', },),
              agreedSlotOf({ voices: mostlyBare, label: 'OCCURRENCE 1', },),
            ],).toEqual([['naps',], [],],);
          },
        },),
      ],
    },),
    describe({
      name: majorityChoiceOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE PLACE MORE THAN HALF OF THE BALLOTS CHOSE, and none for a tie or a plurality',
          fn: async () => {
            const two = [
              voiceOf({ seat: 'a', },),
              voiceOf({ seat: 'b', },),
              voiceOf({ seat: 'c', over: { choice: 'OCCURRENCE 2', }, },),
            ];
            const tied = [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', over: { choice: 'OCCURRENCE 2', }, },),];
            expect([majorityChoiceOf({ voices: two, },), majorityChoiceOf({ voices: tied, },), majorityChoiceOf({ voices: [], },),],)
              .toEqual([['OCCURRENCE 1',], [], [],],);
          },
        },),
      ],
    },),
    describe({
      name: isKeptByMajority.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'KEEPS A PLACE ONLY WHEN MORE THAN HALF OF THE BALLOTS LIST IT, a tie keeping nothing',
          fn: async () => {
            const keeping = (count: number,): readonly ConsistencyVoice[] => ['a', 'b', 'c',].map(function oneSeat(
              seat,
              at,
            ): ConsistencyVoice {
              return voiceOf({ seat, over: { keep: (at < count) ? ['OCCURRENCE 2',] : [], }, },);
            },);
            expect([
              isKeptByMajority({ voices: keeping(3,), label: 'OCCURRENCE 2', },),
              isKeptByMajority({ voices: keeping(2,), label: 'OCCURRENCE 2', },),
              isKeptByMajority({ voices: keeping(1,), label: 'OCCURRENCE 2', },),
              isKeptByMajority({ voices: keeping(0,), label: 'OCCURRENCE 2', },),
              isKeptByMajority({ voices: [], label: 'OCCURRENCE 2', },),
            ],).toEqual([true, true, false, false, false,],);
          },
        },),
      ],
    },),
    describe({
      name: usableVoicesOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'SELECTS THE BALLOTS THAT COUNT against the places shown, leaving out a blank reason and a place never shown',
          fn: async () => {
            const labels = consistencyLabels({ count: 2, },);
            const voices = [
              voiceOf({ seat: 'a', },),
              voiceOf({ seat: 'b', over: { reason: '', }, },),
              voiceOf({ seat: 'c', over: { keep: ['OCCURRENCE 9',], }, },),
              voiceOf({ seat: 'd', over: { keep: ['OCCURRENCE 2',], }, },),
            ];
            expect(usableVoicesOf({ voices, labels, },).map(function seatOf(voice,): string {
              return voice.seat;
            },),).toEqual(['a', 'd',],);
          },
        },),
      ],
    },),
  ],
},);
