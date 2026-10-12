/**
 Tests for counting a repeated wording's ballots: which quote a strict majority
 of the usable ballots located, which place won, which places a majority keeps,
 and why a group stays as it stands.

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
  ConsistencyInvariantError,
  type ConsistencyEnglish,
  type ConsistencyVoice,
  countConsistency,
  winnerOf,
} from '../dist/final/node/index.mjs';

/**
 English of the first place.
 */
const FIRST: ConsistencyEnglish = {
  kind: 'present',
  text: 'The sunny window put the kitten to sleep. So this cat must be a chubby little treasure.',
};

/**
 English of the second place.
 */
const SECOND: ConsistencyEnglish = {
  kind: 'present',
  text: 'In the evening, the sunlight on the sill lulled the kitten to sleep, and the fish snacks smiled too.',
};

/**
 The two places of a repeated sentence.
 */
const PLACES: readonly { readonly label: string; readonly english: ConsistencyEnglish; }[] = [
  { label: 'OCCURRENCE 1', english: FIRST, },
  { label: 'OCCURRENCE 2', english: SECOND, },
];

/**
 Quote of the first place that stands once in its English.
 */
const QUOTE_ONE = 'The sunny window put the kitten to sleep';

/**
 Quote of the second place that stands once in its English.
 */
const QUOTE_TWO = 'the sunlight on the sill lulled the kitten to sleep';

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
 Builds one heard ballot, by default usable, choosing the first place with
 both quotes given.

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
    quotes: [
      { label: 'OCCURRENCE 1', quote: QUOTE_ONE, },
      { label: 'OCCURRENCE 2', quote: QUOTE_TWO, },
    ],
    choice: 'OCCURRENCE 1',
    keep: [],
    ...over,
  };
}

/**
 Three ballots alike.

 @param over - fields this case replaces in each

 @returns Three ballots from three seats

 @example
 ```ts
 const voices = threeAlike({ over: { choice: 'OCCURRENCE 2', }, },);
 ```
 */
function threeAlike({ over = {}, }: { readonly over?: VoiceOverrides; } = {},): readonly ConsistencyVoice[] {
  return ['a', 'b', 'c',].map(function oneSeat(seat,): ConsistencyVoice {
    return voiceOf({ seat, over, },);
  },);
}

/**
 Counts three alike ballots over the two places, a repeated run.

 @param voices - ballots heard

 @param quorum - voices the gather closed on

 @returns The count

 @example
 ```ts
 const count = countOver({ voices: threeAlike(), quorum: 2, },);
 ```
 */
function countOver(
  {
    voices,
    quorum = 2,
    places = PLACES,
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly quorum?: number;
    readonly places?: readonly { readonly label: string; readonly english: ConsistencyEnglish; }[];
  },
): ReturnType<typeof countConsistency> {
  return countConsistency({
    voices,
    places,
    framed: false,
    quorum,
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: countConsistency.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LOCATES A QUOTE A STRICT MAJORITY GAVE that stands once in the place\'s English, with its offset',
          fn: async () => {
            const count = countOver({
              voices: [
                voiceOf({ seat: 'a', },),
                voiceOf({ seat: 'b', },),
                voiceOf({ seat: 'c', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'something else', },], }, },),
              ],
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: QUOTE_ONE,
              core: QUOTE_ONE,
              start: 0,
            },);
            expect(count.renderings[1],).toEqual({
              kind: 'located',
              quote: QUOTE_TWO,
              core: QUOTE_TWO,
              start: 16,
            },);
          },
        },),
        it({
          name: 'LOCATES A QUOTE THAT CARRIES ITS CLOSING PUNCTUATION by its words, the place\'s own span being the quote and the core',
          fn: async () => {
            const withStop = `${QUOTE_ONE}.`;
            const count = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 1', quote: withStop, },], }, },),
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: QUOTE_ONE,
              core: QUOTE_ONE,
              start: 0,
            },);
          },
        },),
        it({
          name: 'LEAVES A PLACE UNLOCATED when no text is given by more than half of the usable ballots, a tie included',
          fn: async () => {
            const split = countOver({
              voices: [
                voiceOf({ seat: 'a', },),
                voiceOf({ seat: 'b', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'a chubby little treasure', },], }, },),
              ],
            },);
            const three = countOver({
              voices: [
                voiceOf({ seat: 'a', },),
                voiceOf({ seat: 'b', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'So this cat', },], }, },),
                voiceOf({ seat: 'c', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'a chubby little treasure', },], }, },),
              ],
            },);
            expect([split.renderings[0], three.renderings[0],],).toEqual([
              { kind: 'unlocated', reason: 'no-agreement', },
              { kind: 'unlocated', reason: 'no-agreement', },
            ],);
          },
        },),
        it({
          name: 'COUNTS A BALLOT THAT GAVE NO QUOTE against the majority, so two of three is a majority and one of three is not',
          fn: async () => {
            const noQuote = { quotes: [] as ConsistencyVoice['quotes'], };
            const twoOfThree = countOver({
              voices: [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', },), voiceOf({ seat: 'c', over: noQuote, },),],
            },);
            const oneOfThree = countOver({
              voices: [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', over: noQuote, },), voiceOf({ seat: 'c', over: noQuote, },),],
            },);
            expect([twoOfThree.renderings[0]?.kind, oneOfThree.renderings[0],],).toEqual([
              'located',
              { kind: 'unlocated', reason: 'no-agreement', },
            ],);
          },
        },),
        it({
          name: 'REFUSES AN EMPTY QUOTE, and a quote that is only closing punctuation, as an empty one',
          fn: async () => {
            const empty = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 1', quote: '', },], }, },),
            },);
            const stops = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 1', quote: '...', },], }, },),
            },);
            expect([empty.renderings[0], stops.renderings[0],],).toEqual([
              { kind: 'unlocated', reason: 'empty', },
              { kind: 'unlocated', reason: 'empty', },
            ],);
          },
        },),
        it({
          name: 'REFUSES A QUOTE THE ENGLISH DOES NOT HOLD, as a missing one',
          fn: async () => {
            const count = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The kitten slept', },], }, },),
            },);
            expect(count.renderings[0],).toEqual({ kind: 'unlocated', reason: 'not-found', },);
          },
        },),
        it({
          name: 'REFUSES A QUOTE THAT STANDS MORE THAN ONCE in the English, overlapping stands included, as an ambiguous one',
          fn: async () => {
            const twice = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'this cat', },], }, },),
              places: [
                { label: 'OCCURRENCE 1', english: { kind: 'present', text: 'this cat and this cat', }, },
                PLACES[1] as { readonly label: string; readonly english: ConsistencyEnglish; },
              ],
            },);
            const overlapping = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'aa', },], }, },),
              places: [
                { label: 'OCCURRENCE 1', english: { kind: 'present', text: 'aaa', }, },
                PLACES[1] as { readonly label: string; readonly english: ConsistencyEnglish; },
              ],
            },);
            expect([twice.renderings[0], overlapping.renderings[0],],).toEqual([
              { kind: 'unlocated', reason: 'ambiguous', },
              { kind: 'unlocated', reason: 'ambiguous', },
            ],);
          },
        },),
        it({
          name: 'LEAVES A PLACE WITHOUT ENGLISH UNLOCATED, whatever the ballots quote for it',
          fn: async () => {
            const count = countOver({
              voices: threeAlike(),
              places: [
                PLACES[0] as { readonly label: string; readonly english: ConsistencyEnglish; },
                { label: 'OCCURRENCE 2', english: { kind: 'absent', }, },
              ],
            },);
            expect(count.renderings[1],).toEqual({ kind: 'unlocated', reason: 'no-english', },);
          },
        },),
        it({
          name: 'LOCATES A FRAME\'S SLOT inside the located quote, and the slot offset is inside the quote\'s words',
          fn: async () => {
            const count = countConsistency({
              voices: threeAlike({
                over: {
                  quotes: [
                    { label: 'OCCURRENCE 1', quote: 'So this cat must be a chubby little treasure.', slot: 'chubby', },
                    { label: 'OCCURRENCE 2', quote: 'the sunlight on the sill lulled the kitten', slot: 'sill', },
                  ],
                },
              },),
              places: PLACES,
              framed: true,
              quorum: 2,
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: 'So this cat must be a chubby little treasure',
              core: 'So this cat must be a chubby little treasure',
              start: 42,
              slot: 'chubby',
              slotStart: 22,
            },);
          },
        },),
        it({
          name: 'LOCATES A FRAME\'S PLACE WITHOUT A SLOT when its slot has no majority, is empty, is not in the span or is in it '
            + 'twice, a slot being no condition of a span',
          fn: async () => {
            /**
             Counts a frame whose every ballot gives the first place this slot.
             */
            function slotted({ slot, }: { readonly slot?: string; },): ReturnType<typeof countConsistency> {
              return countConsistency({
                voices: threeAlike({
                  over: {
                    quotes: [{
                      label: 'OCCURRENCE 1',
                      quote: 'So this cat must be a chubby little treasure',
                      ...((slot === undefined) ? {} : { slot, }),
                    },],
                  },
                },),
                places: PLACES,
                framed: true,
                quorum: 2,
              },);
            }
            /**
             The located rendering of the first place, without a slot.
             */
            const bare = {
              kind: 'located',
              quote: 'So this cat must be a chubby little treasure',
              core: 'So this cat must be a chubby little treasure',
              start: 42,
            };
            expect([
              slotted({}).renderings[0],
              slotted({ slot: '', }).renderings[0],
              slotted({ slot: 'happy', }).renderings[0],
              slotted({ slot: 'e', }).renderings[0],
            ],).toEqual([bare, bare, bare, bare,],);
          },
        },),
        it({
          name: 'IGNORES SLOTS for a repeated run, whatever the ballots give',
          fn: async () => {
            const count = countOver({
              voices: threeAlike({
                over: { quotes: [{ label: 'OCCURRENCE 1', quote: QUOTE_ONE, slot: 'window', },], },
              },),
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: QUOTE_ONE,
              core: QUOTE_ONE,
              start: 0,
            },);
          },
        },),
        it({
          name: 'LOCATES A QUOTE AT THE START AND AT THE END OF ITS ENGLISH, and one holding a character beyond the first '
            + 'plane, offsets counted in the units the English is cut in',
          fn: async () => {
            const cat = String.fromCodePoint(0x1_F6_3A,);
            const places = [
              { label: 'OCCURRENCE 1', english: { kind: 'present', text: `The cat naps ${cat} all day`, }, },
              { label: 'OCCURRENCE 2', english: { kind: 'present', text: `${cat} Then the cat dozed`, }, },
            ] as const;
            const count = countConsistency({
              voices: threeAlike({
                over: {
                  quotes: [
                    { label: 'OCCURRENCE 1', quote: `The cat naps ${cat} all day`, },
                    { label: 'OCCURRENCE 2', quote: `${cat} Then the cat dozed`, },
                  ],
                },
              },),
              places,
              framed: false,
              quorum: 2,
            },);
            expect(count.renderings,).toEqual([
              {
                kind: 'located',
                quote: `The cat naps ${cat} all day`,
                core: `The cat naps ${cat} all day`,
                start: 0,
              },
              {
                kind: 'located',
                quote: `${cat} Then the cat dozed`,
                core: `${cat} Then the cat dozed`,
                start: 0,
              },
            ],);
          },
        },),
        it({
          name: 'LEAVES A LEADING SPACE OF A QUOTE OUT OF THE SPAN, the offset naming the first visible character',
          fn: async () => {
            const count = countOver({
              voices: threeAlike({
                over: {
                  quotes: [
                    { label: 'OCCURRENCE 1', quote: ' sunny window put the kitten to sleep', },
                    { label: 'OCCURRENCE 2', quote: QUOTE_TWO, },
                  ],
                },
              },),
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: 'sunny window put the kitten to sleep',
              core: 'sunny window put the kitten to sleep',
              start: 4,
            },);
          },
        },),
        it({
          name: 'COUNTS A SLOT ONLY AMONG THE BALLOTS THAT GAVE THE AGREED SPAN, so a slot a majority gave beside other '
            + 'quotes is no slot of this one, and the place is located without one',
          fn: async () => {
            /**
             Ballot quoting the first place with this quote and slot.
             */
            function quoting({ seat, quote, slot, }: { readonly seat: string; readonly quote: string; readonly slot: string; },): ConsistencyVoice {
              return voiceOf({ seat, over: { quotes: [{ label: 'OCCURRENCE 1', quote, slot, },], }, },);
            }
            const count = countConsistency({
              voices: [
                quoting({ seat: 'a', quote: 'So this cat must be a chubby little treasure', slot: 'chubby', },),
                quoting({ seat: 'b', quote: 'So this cat must be a chubby little treasure', slot: 'little', },),
                quoting({ seat: 'c', quote: 'So this cat must be a chubby', slot: 'chubby', },),
              ],
              places: PLACES,
              framed: true,
              quorum: 2,
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: 'So this cat must be a chubby little treasure',
              core: 'So this cat must be a chubby little treasure',
              start: 42,
            },);
          },
        },),
        it({
          name: 'LOCATES A FRAME\'S PLACE WITHOUT A SLOT WHEN ITS SLOT IS THE WHOLE OF ITS SPAN, since no word of the frame '
            + 'is left for the pattern to carry',
          fn: async () => {
            const count = countConsistency({
              voices: threeAlike({
                over: {
                  quotes: [{ label: 'OCCURRENCE 1', quote: 'chubby little treasure.', slot: 'chubby little treasure', },],
                },
              },),
              places: [
                {
                  label: 'OCCURRENCE 1',
                  english: { kind: 'present', text: 'So this cat is a chubby little treasure.', },
                },
                PLACES[1] as (typeof PLACES)[number],
              ],
              framed: true,
              quorum: 2,
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: 'chubby little treasure',
              core: 'chubby little treasure',
              start: 17,
            },);
          },
        },),
        it({
          name: 'LOCATES A FRAME\'S PLACE WITHOUT A SLOT WHEN ITS SLOT CUTS MARKUP INSIDE A SPAN THAT HOLDS ITS MARKUP IN PAIRS',
          fn: async () => {
            const count = countConsistency({
              voices: threeAlike({
                over: {
                  quotes: [{
                    label: 'OCCURRENCE 1',
                    quote: 'So this cat is a **chubby** little treasure',
                    slot: 'chubby** little',
                  },],
                },
              },),
              places: [
                {
                  label: 'OCCURRENCE 1',
                  english: { kind: 'present', text: 'So this cat is a **chubby** little treasure.', },
                },
                PLACES[1] as (typeof PLACES)[number],
              ],
              framed: true,
              quorum: 2,
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: 'So this cat is a **chubby** little treasure',
              core: 'So this cat is a **chubby** little treasure',
              start: 0,
            },);
          },
        },),
        it({
          name: 'REFUSES A CHOSEN LABEL THE SHEET NEVER SHOWED, since a usable ballot cannot name one and a winner at '
            + 'index minus one would read as a place',
          fn: async () => {
            const refusal = caught(function winnerOfUnknown(): unknown {
              return winnerOf({
                usable: 3,
                quorum: 2,
                chosen: ['OCCURRENCE 9',],
                labels: ['OCCURRENCE 1', 'OCCURRENCE 2',],
                renderings: [],
              },);
            },);
            expect(refusal,).toBeInstanceOf(ConsistencyInvariantError,);
            expect(String(refusal,),).toBe(
              'ConsistencyInvariantError: unreachable: the label OCCURRENCE 9 a majority chose is no label of the sheet, '
              + 'and a usable ballot chooses a label the sheet showed',
            );
          },
        },),
        it({
          name: 'NAMES THE WINNER on a strict majority of the usable ballots that reaches the quorum, whose own quote is located',
          fn: async () => {
            const count = countOver({
              voices: [
                voiceOf({ seat: 'a', },),
                voiceOf({ seat: 'b', },),
                voiceOf({ seat: 'c', over: { choice: 'OCCURRENCE 2', }, },),
              ],
            },);
            expect({ usable: count.usable, winner: count.winner, },).toEqual({
              usable: 3,
              winner: { kind: 'chosen', label: 'OCCURRENCE 1', },
            },);
          },
        },),
        it({
          name: 'KEEPS THE GROUP AS IT STANDS on a tie between two places, as the consolidation gate keeps the standing',
          fn: async () => {
            const count = countOver({
              voices: [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', over: { choice: 'OCCURRENCE 2', }, },),],
            },);
            expect(count.winner,).toEqual({ kind: 'none', reason: 'no-majority', },);
          },
        },),
        it({
          name: 'KEEPS THE GROUP AS IT STANDS when the choices have no majority, a plurality being none',
          fn: async () => {
            const count = countConsistency({
              voices: [
                voiceOf({ seat: 'a', over: { choice: 'OCCURRENCE 1', }, },),
                voiceOf({ seat: 'b', over: { choice: 'OCCURRENCE 2', }, },),
                voiceOf({ seat: 'c', over: { choice: 'OCCURRENCE 3', }, },),
                voiceOf({ seat: 'd', over: { choice: 'OCCURRENCE 3', }, },),
                voiceOf({ seat: 'e', over: { choice: 'OCCURRENCE 1', }, },),
              ],
              places: [
                ...PLACES,
                { label: 'OCCURRENCE 3', english: FIRST, },
              ],
              framed: false,
              quorum: 3,
            },);
            expect(count.winner,).toEqual({ kind: 'none', reason: 'no-majority', },);
          },
        },),
        it({
          name: 'NAMES NO WINNER BELOW THE QUORUM the gather closed on, though every usable ballot agrees',
          fn: async () => {
            const count = countOver({ voices: [voiceOf({ seat: 'a', },),], quorum: 2, },);
            expect({ usable: count.usable, winner: count.winner, },).toEqual({
              usable: 1,
              winner: { kind: 'none', reason: 'no-quorum', },
            },);
          },
        },),
        it({
          name: 'NAMES NO WINNER when nobody was heard',
          fn: async () => {
            expect(countOver({ voices: [], },).winner,).toEqual({ kind: 'none', reason: 'no-quorum', },);
          },
        },),
        it({
          name: 'NAMES NO WINNER when the place a majority chose has no located quote',
          fn: async () => {
            const count = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 2', quote: QUOTE_TWO, },], }, },),
            },);
            expect(count.winner,).toEqual({ kind: 'none', reason: 'chosen-unlocated', },);
          },
        },),
        it({
          name: 'LEAVES UNUSABLE BALLOTS OUT of the usable count, the majority and the quotes: a blank reason, an '
            + 'unknown choice and an unknown kept place',
          fn: async () => {
            const count = countOver({
              voices: [
                voiceOf({ seat: 'a', },),
                voiceOf({ seat: 'b', over: { reason: ' ', choice: 'OCCURRENCE 2', }, },),
                voiceOf({ seat: 'c', over: { choice: 'OCCURRENCE 9', }, },),
                voiceOf({ seat: 'd', over: { keep: ['OCCURRENCE 9',], }, },),
              ],
              quorum: 1,
            },);
            expect({ usable: count.usable, winner: count.winner, },).toEqual({
              usable: 1,
              winner: { kind: 'chosen', label: 'OCCURRENCE 1', },
            },);
          },
        },),
        it({
          name: 'KEEPS A PLACE only when more than half of the usable ballots list it',
          fn: async () => {
            const kept = countOver({
              voices: [
                voiceOf({ seat: 'a', over: { keep: ['OCCURRENCE 2',], }, },),
                voiceOf({ seat: 'b', over: { keep: ['OCCURRENCE 2',], }, },),
                voiceOf({ seat: 'c', },),
              ],
            },);
            const tied = countOver({
              voices: [
                voiceOf({ seat: 'a', over: { keep: ['OCCURRENCE 2',], }, },),
                voiceOf({ seat: 'b', },),
              ],
            },);
            expect([kept.kept, tied.kept,],).toEqual([[false, true,], [false, false,],],);
          },
        },),
        it({
          name: 'AGREES BY LOCATED SPAN, not by the string a judge typed: a line break written as a space, a curly apostrophe '
            + 'written straight and a closing full stop kept or left off are one span',
          fn: async () => {
            const count = countConsistency({
              voices: [
                voiceOf({
                  seat: 'a',
                  over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The kitten wasn’t asleep,\nwas it', },], },
                },),
                voiceOf({
                  seat: 'b',
                  over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The kitten wasn\'t asleep, was it?', },], },
                },),
                voiceOf({
                  seat: 'c',
                  over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The kitten  wasn\'t asleep,  was it', },], },
                },),
              ],
              places: [
                {
                  label: 'OCCURRENCE 1',
                  english: { kind: 'present', text: 'It purred.\nThe kitten wasn\'t asleep,\nwas it?\nIt blinked.', },
                },
                PLACES[1] as (typeof PLACES)[number],
              ],
              framed: false,
              quorum: 2,
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: 'The kitten wasn\'t asleep,\nwas it',
              core: 'The kitten wasn\'t asleep,\nwas it',
              start: 11,
            },);
          },
        },),
        it({
          name: 'COUNTS A BALLOT WHOSE QUOTE STANDS NOWHERE OR TWICE among the usable ballots that did not agree, so two spans '
            + 'out of four do not make a strict majority',
          fn: async () => {
            const count = countOver({
              voices: [
                voiceOf({ seat: 'a', },),
                voiceOf({ seat: 'b', },),
                voiceOf({ seat: 'c', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The kitten slept', },], }, },),
                voiceOf({ seat: 'd', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'the', },], }, },),
              ],
              quorum: 3,
            },);
            expect(count.renderings[0],).toEqual({ kind: 'unlocated', reason: 'no-agreement', },);
          },
        },),
        it({
          name: 'NAMES THE PLACES THAT TIED FOR FIRST as the finalists when the usable ballots reach the quorum and no choice '
            + 'has a strict majority, and no finalists otherwise',
          fn: async () => {
            const tiedTwo = countOver({
              voices: [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', over: { choice: 'OCCURRENCE 2', }, },),],
            },);
            const tiedThree = countConsistency({
              voices: [
                voiceOf({ seat: 'a', over: { choice: 'OCCURRENCE 1', }, },),
                voiceOf({ seat: 'b', over: { choice: 'OCCURRENCE 2', }, },),
                voiceOf({ seat: 'c', over: { choice: 'OCCURRENCE 3', }, },),
                voiceOf({ seat: 'd', over: { choice: 'OCCURRENCE 3', }, },),
                voiceOf({ seat: 'e', over: { choice: 'OCCURRENCE 1', }, },),
              ],
              places: [
                ...PLACES,
                { label: 'OCCURRENCE 3', english: FIRST, },
              ],
              framed: false,
              quorum: 3,
            },);
            const majority = countOver({
              voices: [voiceOf({ seat: 'a', },), voiceOf({ seat: 'b', },), voiceOf({ seat: 'c', over: { choice: 'OCCURRENCE 2', }, },),],
            },);
            const belowQuorum = countOver({ voices: [voiceOf({ seat: 'a', },),], quorum: 2, },);
            const plurality = countConsistency({
              voices: [
                voiceOf({ seat: 'a', over: { choice: 'OCCURRENCE 1', }, },),
                voiceOf({ seat: 'b', over: { choice: 'OCCURRENCE 1', }, },),
                voiceOf({ seat: 'c', over: { choice: 'OCCURRENCE 2', }, },),
                voiceOf({ seat: 'd', over: { choice: 'OCCURRENCE 3', }, },),
              ],
              places: [
                ...PLACES,
                { label: 'OCCURRENCE 3', english: FIRST, },
              ],
              framed: false,
              quorum: 3,
            },);
            const nobody = countOver({ voices: [], },);
            expect([
              tiedTwo.finalists,
              tiedThree.finalists,
              majority.finalists,
              belowQuorum.finalists,
              plurality.finalists,
              nobody.finalists,
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
        it({
          name: 'REPLAYS THE LIVE GROUP TWO BALLOTS (the maximal repeat): the four quotes, two with their closing full stop, '
            + 'agree on the English\'s own span, and three choices of four name the first place the winner; a recurrence of '
            + 'the straight-against-curly and trimmed-text families',
          fn: async () => {
            const wanted = 'She also wanted to stay by more people\'s side looking cute and bring sunshine to more people';
            const accompany = 'She wanted to accompany more people with her cuteness and bring sunshine to their lives';
            /**
             One live ballot: the quotes given and the place chosen.
             */
            function liveBallot(
              { seat, stop, choice, }: { readonly seat: string; readonly stop: string; readonly choice: string; },
            ): ConsistencyVoice {
              return voiceOf({
                seat,
                over: {
                  quotes: [
                    { label: 'OCCURRENCE 1', quote: `${wanted}${stop}`, },
                    { label: 'OCCURRENCE 2', quote: `${accompany}${stop}`, },
                  ],
                  choice,
                },
              },);
            }
            const count = countConsistency({
              voices: [
                liveBallot({ seat: 'qwen', stop: '', choice: 'OCCURRENCE 1', },),
                liveBallot({ seat: 'kimi', stop: '', choice: 'OCCURRENCE 1', },),
                liveBallot({ seat: 'deepseek', stop: '.', choice: 'OCCURRENCE 1', },),
                liveBallot({ seat: 'mercury', stop: '.', choice: 'OCCURRENCE 2', },),
              ],
              places: [
                {
                  label: 'OCCURRENCE 1',
                  english: {
                    kind: 'present',
                    text: 'She was not the stereotypical timid child;\nshe was a “senior” everyone could truly rely on,\n'
                      + 'and,\neven more,\na “teacher” worthy of trust.\n'
                      + `${wanted}.`,
                  },
                },
                {
                  label: 'OCCURRENCE 2',
                  english: {
                    kind: 'present',
                    text: `with every blade of grass and every shrub.\n\n${accompany}.`,
                  },
                },
              ],
              framed: false,
              quorum: 3,
            },);
            expect({
              usable: count.usable,
              winner: count.winner,
              finalists: count.finalists,
              renderings: count.renderings,
            },).toEqual({
              usable: 4,
              winner: { kind: 'chosen', label: 'OCCURRENCE 1', },
              finalists: [],
              renderings: [
                { kind: 'located', quote: wanted, core: wanted, start: 137, },
                { kind: 'located', quote: accompany, core: accompany, start: 44, },
              ],
            },);
          },
        },),
        it({
          name: 'REPLAYS THE LIVE GROUP ONE BALLOTS (the refrain): the quotes written with a line break, a space, a straight or a '
            + 'curly apostrophe and a closing mark agree on the English\'s own span, the slot spans are agreed by words, and '
            + 'the two choices that tied for first are the finalists; a recurrence of the straight-against-curly and '
            + 'trimmed-text families',
          fn: async () => {
            /**
             One live ballot: its four quotes with slots, and the place chosen.
             */
            function liveBallot(
              {
                seat,
                quotes,
                choice,
              }: {
                readonly seat: string;
                readonly quotes: readonly (readonly [string, string,])[];
                readonly choice: string;
              },
            ): ConsistencyVoice {
              return {
                seat,
                reason: 'The refrain is rendered four ways.',
                quotes: quotes.map(function quoteOf([quote, slot,], at,): ConsistencyVoice['quotes'][number] {
                  return { label: `OCCURRENCE ${String(at + 1,)}`, quote, slot, };
                },),
                choice,
                keep: [],
              };
            }
            const voices = [
              liveBallot({
                seat: 'qwen',
                quotes: [
                  ['So she must have been a girl who loved life', 'loved life',],
                  ['So she was a girl of extraordinary perseverance,\nI suppose', 'extraordinary perseverance',],
                  ['So she was a girl who could be trusted,\nwasn\'t she', 'could be trusted',],
                  ['So she was a gentle,\ntender-hearted girl,\nwasn\'t she', 'gentle,\ntender-hearted',],
                ],
                choice: 'OCCURRENCE 3',
              },),
              liveBallot({
                seat: 'kimi',
                quotes: [
                  ['So she must have been a girl who loved life', 'who loved life',],
                  ['So she was a girl of extraordinary perseverance,\nI suppose', 'of extraordinary perseverance',],
                  ['So she was a girl who could be trusted,\nwasn\'t she', 'who could be trusted',],
                  ['So she was a gentle,\ntender-hearted girl,\nwasn\'t she', 'gentle,\ntender-hearted',],
                ],
                choice: 'OCCURRENCE 3',
              },),
              liveBallot({
                seat: 'minimax',
                quotes: [
                  ['So she must have been a girl who loved life.', 'loved life',],
                  ['So she was a girl of extraordinary perseverance, I suppose.', 'of extraordinary perseverance',],
                  ['So she was a girl who could be trusted, wasn\'t she?', 'who could be trusted',],
                  ['So she was a gentle, tender-hearted girl, wasn\'t she?', 'gentle, tender-hearted',],
                ],
                choice: 'OCCURRENCE 4',
              },),
              liveBallot({
                seat: 'mercury',
                quotes: [
                  ['So she must have been a girl who loved life', 'loved life',],
                  ['So she was a girl of extraordinary perseverance,\nI suppose', 'extraordinary perseverance',],
                  ['So she was a girl who could be trusted,\nwasn’t she', 'could be trusted',],
                  ['So she was a gentle,\ntender-hearted girl,\nwasn’t she', 'gentle, tender-hearted',],
                ],
                choice: 'OCCURRENCE 4',
              },),
            ];
            const count = countConsistency({
              voices,
              places: [
                {
                  label: 'OCCURRENCE 1',
                  english: {
                    kind: 'present',
                    text: '## Wish\n\nShe wanted to share her story as her true self with more people,\n'
                      + 'and to bring joy to more people.\n\nSo she must have been a girl who loved life.\n'
                      + 'Under the lights,\nin the plainest of lives,\nshe held the most distant of dreams close to her heart.',
                  },
                },
                {
                  label: 'OCCURRENCE 2',
                  english: {
                    kind: 'present',
                    text: 'So she was a girl of extraordinary perseverance,\nI suppose.\nYou see,\namid the starry night,\n'
                      + 'in the frailest of bodies,\nshe bore the most unyielding pressure.',
                  },
                },
                {
                  label: 'OCCURRENCE 3',
                  english: {
                    kind: 'present',
                    text: 'She wanted,\nwith her warm and friendly manner,\nto look after more people and bring a faint '
                      + 'glimmer of light into more lives.\n\nSo she was a girl who could be trusted,\nwasn\'t she?\nYou see,\n'
                      + 'far across the mountains and seas,\nshe gave the clearest directions in the most complicated of situations.',
                  },
                },
                {
                  label: 'OCCURRENCE 4',
                  english: {
                    kind: 'present',
                    text: 'So she was a gentle,\ntender-hearted girl,\nwasn\'t she?\nJust look:\ninside the headpiece,\n'
                      + 'in the narrowest of spaces,\nshe held up the most perfect world.',
                  },
                },
              ],
              framed: true,
              quorum: 3,
            },);
            expect({
              usable: count.usable,
              winner: count.winner,
              finalists: count.finalists,
              renderings: count.renderings,
            },).toEqual({
              usable: 4,
              winner: { kind: 'none', reason: 'no-majority', },
              finalists: ['OCCURRENCE 3', 'OCCURRENCE 4',],
              renderings: [
                {
                  kind: 'located',
                  quote: 'So she must have been a girl who loved life',
                  core: 'So she must have been a girl who loved life',
                  start: 108,
                  slot: 'loved life',
                  slotStart: 33,
                },
                {
                  kind: 'located',
                  quote: 'So she was a girl of extraordinary perseverance,\nI suppose',
                  core: 'So she was a girl of extraordinary perseverance,\nI suppose',
                  start: 0,
                },
                {
                  kind: 'located',
                  quote: 'So she was a girl who could be trusted,\nwasn\'t she',
                  core: 'So she was a girl who could be trusted,\nwasn\'t she',
                  start: 126,
                },
                {
                  kind: 'located',
                  quote: 'So she was a gentle,\ntender-hearted girl,\nwasn\'t she',
                  core: 'So she was a gentle,\ntender-hearted girl,\nwasn\'t she',
                  start: 0,
                  slot: 'gentle,\ntender-hearted',
                  slotStart: 13,
                },
              ],
            },);
          },
        },),
      ],
    },),

    describe({
      name: winnerOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'DECIDES FROM THE FACTS ALONE: the quorum first, then the majority, then the chosen place\'s quote',
          fn: async () => {
            const labels = ['OCCURRENCE 1', 'OCCURRENCE 2',];
            const located = { kind: 'located', quote: 'x', core: 'x', start: 0, } as const;
            const lost = { kind: 'unlocated', reason: 'not-found', } as const;
            expect([
              winnerOf({ usable: 1, quorum: 2, chosen: ['OCCURRENCE 1',], labels, renderings: [located, located,], },),
              winnerOf({ usable: 2, quorum: 2, chosen: [], labels, renderings: [located, located,], },),
              winnerOf({ usable: 2, quorum: 2, chosen: ['OCCURRENCE 2',], labels, renderings: [located, lost,], },),
              winnerOf({ usable: 2, quorum: 2, chosen: ['OCCURRENCE 2',], labels, renderings: [lost, located,], },),
            ],).toEqual([
              { kind: 'none', reason: 'no-quorum', },
              { kind: 'none', reason: 'no-majority', },
              { kind: 'none', reason: 'chosen-unlocated', },
              { kind: 'chosen', label: 'OCCURRENCE 2', },
            ],);
          },
        },),
      ],
    },),

  ],
},);
