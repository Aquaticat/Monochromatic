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
          name: 'LOCATES THE CORE OF A QUOTE that carries its closing punctuation, keeping the quote as given',
          fn: async () => {
            const withStop = `${QUOTE_ONE}.`;
            const count = countOver({
              voices: threeAlike({ over: { quotes: [{ label: 'OCCURRENCE 1', quote: withStop, },], }, },),
            },);
            expect(count.renderings[0],).toEqual({
              kind: 'located',
              quote: withStop,
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
              quote: 'So this cat must be a chubby little treasure.',
              core: 'So this cat must be a chubby little treasure',
              start: 42,
              slot: 'chubby',
              slotStart: 22,
            },);
          },
        },),
        it({
          name: 'LEAVES A FRAME\'S PLACE UNLOCATED when its slot has no majority, is empty, is not in the quote or is in it twice',
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
            expect([
              slotted({}).renderings[0],
              slotted({ slot: '', }).renderings[0],
              slotted({ slot: 'happy', }).renderings[0],
              slotted({ slot: 'e', }).renderings[0],
            ],).toEqual([
              { kind: 'unlocated', reason: 'slot-no-agreement', },
              { kind: 'unlocated', reason: 'slot-empty', },
              { kind: 'unlocated', reason: 'slot-not-found', },
              { kind: 'unlocated', reason: 'slot-ambiguous', },
            ],);
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
          name: 'LEAVES A LEADING SPACE OF A QUOTE OUT OF THE WORDS A REPLACEMENT TAKES OR GIVES, the offset naming the first '
            + 'visible character',
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
              quote: ' sunny window put the kitten to sleep',
              core: 'sunny window put the kitten to sleep',
              start: 4,
            },);
          },
        },),
        it({
          name: 'COUNTS A SLOT ONLY AMONG THE BALLOTS THAT GAVE THE AGREED QUOTE, so a slot a majority gave beside other '
            + 'quotes is no slot of this one',
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
            expect(count.renderings[0],).toEqual({ kind: 'unlocated', reason: 'slot-no-agreement', },);
          },
        },),
        it({
          name: 'LEAVES A FRAME\'S PLACE UNLOCATED WHEN ITS SLOT IS THE WHOLE OF ITS QUOTE, since no word of the frame '
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
            expect(count.renderings[0],).toEqual({ kind: 'unlocated', reason: 'slot-whole', },);
          },
        },),
        it({
          name: 'LEAVES A FRAME\'S PLACE UNLOCATED WHEN ITS SLOT CUTS MARKUP INSIDE A QUOTE THAT HOLDS ITS MARKUP IN PAIRS',
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
            expect(count.renderings[0],).toEqual({ kind: 'unlocated', reason: 'markup', },);
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
