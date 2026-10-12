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
  agreedSlotWordsOf,
  agreedWordsOf,
  type ConsistencyVoice,
  consistencyLabels,
  isKeptByMajority,
  majorityChoiceOf,
  tiedForFirstOf,
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
      name: agreedWordsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE FOLDED WORDS MORE THAN HALF OF THE USABLE BALLOTS QUOTED, whatever their spacing, apostrophes and '
            + 'closing marks, and none when the words split',
          fn: async () => {
            const alike = [
              voiceOf({ seat: 'a', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat wasn’t   asleep.', },], }, },),
              voiceOf({ seat: 'b', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat wasn\'t\nasleep', },], }, },),
              voiceOf({ seat: 'c', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat dozes', },], }, },),
            ];
            const split = [
              voiceOf({ seat: 'a', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat naps', },], }, },),
              voiceOf({ seat: 'b', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat dozes', },], }, },),
            ];
            expect([
              agreedWordsOf({ voices: alike, label: 'OCCURRENCE 1', },),
              agreedWordsOf({ voices: split, label: 'OCCURRENCE 1', },),
              agreedWordsOf({ voices: alike, label: 'OCCURRENCE 2', },),
              agreedWordsOf({ voices: [], label: 'OCCURRENCE 1', },),
            ],).toEqual([['The cat wasn\'t asleep',], [], [], [],],);
          },
        },),
      ],
    },),
    describe({
      name: agreedSlotWordsOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE FOLDED SLOT WORDS MORE THAN HALF OF THE USABLE BALLOTS GAVE beside the agreed words, a slot given '
            + 'beside other words or not given counting against it',
          fn: async () => {
            const voices = [
              voiceOf({ seat: 'a', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat naps', slot: 'cat', },], }, },),
              voiceOf({ seat: 'b', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat naps.', slot: 'cat', },], }, },),
              voiceOf({ seat: 'c', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat', slot: 'cat', },], }, },),
            ];
            expect([
              agreedSlotWordsOf({ voices, label: 'OCCURRENCE 1', words: 'The cat naps', },),
              agreedSlotWordsOf({ voices, label: 'OCCURRENCE 1', words: 'The cat', },),
              agreedSlotWordsOf({ voices, label: 'OCCURRENCE 1', words: 'The kitten', },),
            ],).toEqual([['cat',], [], [],],);
          },
        },),
      ],
    },),
    describe({
      name: tiedForFirstOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES THE LABELS SHARING THE HIGHEST CHOICE COUNT when two or more share it and none has more than half, in '
            + 'the order of the sheet',
          fn: async () => {
            const labels = consistencyLabels({ count: 3, },);
            /**
             Ballots that choose the labels given, one each.
             */
            function choosing({ choices, }: { readonly choices: readonly string[]; },): readonly ConsistencyVoice[] {
              return choices.map(function oneSeat(
                choice,
                at,
              ): ConsistencyVoice {
                return voiceOf({ seat: `seat-${String(at,)}`, over: { choice, }, },);
              },);
            }
            expect([
              tiedForFirstOf({ voices: choosing({ choices: ['OCCURRENCE 1', 'OCCURRENCE 2',], },), labels, },),
              tiedForFirstOf({ voices: choosing({ choices: ['OCCURRENCE 3', 'OCCURRENCE 1', 'OCCURRENCE 3', 'OCCURRENCE 1', 'OCCURRENCE 2',], },), labels, },),
              tiedForFirstOf({ voices: choosing({ choices: ['OCCURRENCE 1', 'OCCURRENCE 1', 'OCCURRENCE 2',], },), labels, },),
              tiedForFirstOf({ voices: choosing({ choices: ['OCCURRENCE 1', 'OCCURRENCE 1', 'OCCURRENCE 2', 'OCCURRENCE 3',], },), labels, },),
              tiedForFirstOf({ voices: choosing({ choices: ['OCCURRENCE 2',], },), labels, },),
              tiedForFirstOf({ voices: [], labels, },),
            ],).toEqual([
              ['OCCURRENCE 1', 'OCCURRENCE 2',],
              ['OCCURRENCE 1', 'OCCURRENCE 3',],
              [],
              [],
              [],
              [],
            ],);
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
      name: 'the strict-majority boundary',
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'AGREES ONLY WHEN MORE THAN HALF OF THE USABLE BALLOTS GIVE THE SAME CHOICE, QUOTE, SLOT OR KEPT PLACE, '
            + 'at every count from one to six, odd and even',
          fn: async () => {
            /**
             Ballots of which `agreeing` give the text everyone is asked about and the rest give another.
             */
            function splitting(
              { usable, agreeing, }: { readonly usable: number; readonly agreeing: number; },
            ): readonly ConsistencyVoice[] {
              return Array.from(
                { length: usable, },
                function oneSeat(
                  _unused,
                  at,
                ): ConsistencyVoice {
                  const agrees = at < agreeing;
                  return voiceOf({
                    seat: `seat-${String(at,)}`,
                    over: {
                      choice: agrees ? 'OCCURRENCE 1' : 'OCCURRENCE 2',
                      quotes: [{ label: 'OCCURRENCE 1', quote: agrees ? 'the cat naps' : 'the cat dozes', slot: agrees ? 'naps' : 'dozes', },],
                      keep: agrees ? ['OCCURRENCE 2',] : [],
                    },
                  },);
                },
              );
            }
            const found: Record<string, readonly boolean[]> = {};
            for (const usable of [1, 2, 3, 4, 5, 6,]) {
              found[String(usable,)] = Array.from(
                { length: usable + 1, },
                function atAgreeing(
                  _unused,
                  agreeing,
                ): boolean {
                  const voices = splitting({ usable, agreeing, },);
                  return (majorityChoiceOf({ voices, },)[0] === 'OCCURRENCE 1')
                    && (agreedQuoteOf({ voices, label: 'OCCURRENCE 1', },)[0] === 'the cat naps')
                    && (agreedSlotOf({ voices, label: 'OCCURRENCE 1', },)[0] === 'naps')
                    && isKeptByMajority({ voices, label: 'OCCURRENCE 2', },);
                },
              );
            }
            expect(found,).toEqual({
              1: [false, true,],
              2: [false, false, true,],
              3: [false, false, true, true,],
              4: [false, false, false, true, true,],
              5: [false, false, false, true, true, true,],
              6: [false, false, false, false, true, true, true,],
            },);
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
