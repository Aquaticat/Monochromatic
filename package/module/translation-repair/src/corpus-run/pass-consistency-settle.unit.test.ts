/**
 Tests for settling a repeat group once the bench has spoken, or was not
 asked, or failed: the verdict a group records, the rendering and provisional
 outcome of each place, and the replacements the winner would make before the
 floors have spoken.

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
  type ArtifactConsistencyRepeat,
  type ConsistencyAsked,
  type ConsistencyPlace,
  type ConsistencyVoice,
  type RepeatGroup,
  settleAsked,
  settleFailed,
  settleUnasked,
  unplacedOf,
} from '../../dist/final/node/index.mjs';

/**
 The repeated sentence, as the artifact records it.
 */
const SENTENCE: ArtifactConsistencyRepeat = {
  kind: 'maximal',
  wording: '小猫打盹',
};

/**
 The refrain, as the artifact records it.
 */
const FRAME: ArtifactConsistencyRepeat = {
  kind: 'refrain',
  prefix: '所以这只猫',
  suffix: '的小宝贝',
};

/**
 A place a slice holds whole, the slice carrying the English it is given.

 @param position - position of the place in its group, which is also its slice

 @param english - the English the place's slice carries

 @returns The place with the facts of its slice

 @example
 ```ts
 const place = placeIn({ position: 0, english: 'The cat naps.', },);
 ```
 */
function placeIn(
  {
    position,
    english,
  }: {
    readonly position: number;
    readonly english: string;
  },
): ConsistencyPlace {
  return {
    startOffset: position * 10,
    endOffset: (position * 10) + 4,
    line: position + 1,
    slice: {
      sliceIndex: position,
      sourceIndex: position,
      sourceText: '小猫打盹',
      sourceStart: position * 10,
      nodes: [],
      current: { kind: 'present', text: english, },
      lineStructured: false,
      disputedWordings: [],
    },
  };
}

/**
 The three places of the repeated sentence: the English of the second says it
 in other words after a lead-in, the third carries the first's words in the
 middle of a line.
 */
const SENTENCE_PLACES: readonly ConsistencyPlace[] = [
  placeIn({ position: 0, english: 'The cat naps. It is warm.', },),
  placeIn({ position: 1, english: 'Later the kitten naps in the sun.', },),
  placeIn({ position: 2, english: 'Evening: The cat naps in the dark.', },),
];

/**
 The quotes a judge gives for the three places of the repeated sentence.
 */
const SENTENCE_QUOTES = [
  { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
  { label: 'OCCURRENCE 2', quote: 'the kitten naps', },
  { label: 'OCCURRENCE 3', quote: 'The cat naps', },
];

/**
 One judge's voice, choosing the first place and keeping none unless told.

 @param seat - seat that answered

 @param quotes - the quotes the judge gives

 @param choice - the label the judge chooses

 @param keep - the labels the judge keeps

 @returns The voice

 @example
 ```ts
 const voice = voiceOf({ seat: 'hyper-cat', quotes: SENTENCE_QUOTES, },);
 ```
 */
function voiceOf(
  {
    seat,
    quotes,
    choice = 'OCCURRENCE 1',
    keep = [],
  }: {
    readonly seat: string;
    readonly quotes: ConsistencyVoice['quotes'];
    readonly choice?: string;
    readonly keep?: readonly string[];
  },
): ConsistencyVoice {
  return {
    seat,
    reason: 'The first place words it best.',
    quotes,
    choice,
    keep,
  };
}

/**
 What the gather of three seats came to.

 @param voices - the voices heard

 @param quorum - voices the gather closed on

 @param findings - what the gather reported

 @returns The gather as the settling reads it

 @example
 ```ts
 const asked = askedOf({ voices, },);
 ```
 */
function askedOf(
  {
    voices,
    quorum = 2,
    findings = [],
  }: {
    readonly voices: readonly ConsistencyVoice[];
    readonly quorum?: number;
    readonly findings?: readonly string[];
  },
): ConsistencyAsked {
  return {
    quorum,
    voices,
    findings,
    resumed: false,
  };
}

/**
 Three voices that give the same quotes and choose alike.

 @param quotes - the quotes every judge gives

 @returns The voices, in seat order

 @example
 ```ts
 const voices = threeAlike({ quotes: SENTENCE_QUOTES, },);
 ```
 */
function threeAlike({ quotes, }: { readonly quotes: ConsistencyVoice['quotes']; },): readonly ConsistencyVoice[] {
  return ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function voiceFor(seat,): ConsistencyVoice {
    return voiceOf({
      seat,
      quotes,
    },);
  },);
}

/**
 Settles the repeated sentence in its three places from what the bench came to.

 @param asked - the ballots heard, the quorum and the gather's findings

 @returns The settled group

 @example
 ```ts
 const settled = settleSentence({ asked: askedOf({ voices, }), },);
 ```
 */
function settleSentence({ asked, }: { readonly asked: ConsistencyAsked; },): ReturnType<typeof settleAsked> {
  return settleAsked({
    repeat: SENTENCE,
    places: SENTENCE_PLACES,
    unplaced: [],
    asked,
  },);
}

/**
 The outcomes of a settled group's places.

 @param settled - the settled group

 @returns One outcome per place

 @example
 ```ts
 const outcomes = outcomesOf({ settled, },);
 ```
 */
function outcomesOf({ settled, }: { readonly settled: ReturnType<typeof settleAsked>; },): readonly string[] {
  return settled.outcomes;
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: settleAsked.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'SETTLES A GROUP THE BENCH DECIDED: the first place chosen, the second replaced by its words, the third '
            + 'already carrying them, with the verdict, renderings and replacement recorded whole',
          fn: async () => {
            const voices = threeAlike({ quotes: SENTENCE_QUOTES, },);
            expect(settleAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              asked: askedOf({ voices, findings: ['page-consistency 3/3',], }),
            },),).toEqual({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              verdict: {
                kind: 'asked',
                ballots: voices,
                usable: 3,
                quorum: 2,
                winner: { kind: 'chosen', label: 'OCCURRENCE 1', },
              },
              renderings: [
                { kind: 'located', quote: 'The cat naps.', core: 'The cat naps', start: 0, },
                { kind: 'located', quote: 'the kitten naps', core: 'the kitten naps', start: 6, },
                { kind: 'located', quote: 'The cat naps', core: 'The cat naps', start: 9, },
              ],
              outcomes: ['chosen', 'replaced', 'consistent',],
              edits: [
                {
                  placePosition: 1,
                  sliceIndex: 1,
                  start: 6,
                  end: 21,
                  text: 'the cat naps',
                },
              ],
              findings: ['page-consistency 3/3',],
            },);
          },
        },),
        it({
          name: 'SETTLES A FRAME BY CARRYING THE CHOSEN PATTERN OVER THE RECEIVING PLACE\'S OWN SLOT',
          fn: async () => {
            const quotes = [
              { label: 'OCCURRENCE 1', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
              { label: 'OCCURRENCE 2', quote: 'So this cat must be a chubby little treasure.', slot: 'chubby', },
            ];
            const settled = settleAsked({
              repeat: FRAME,
              places: [
                placeIn({ position: 0, english: 'So this cat is a lazy little treasure. Sleep.', },),
                placeIn({ position: 1, english: 'Now: So this cat must be a chubby little treasure.', },),
              ],
              unplaced: [],
              asked: askedOf({ voices: threeAlike({ quotes, },), }),
            },);
            expect(settled.renderings,).toEqual([
              {
                kind: 'located',
                quote: 'So this cat is a lazy little treasure.',
                core: 'So this cat is a lazy little treasure',
                start: 0,
                slot: 'lazy',
                slotStart: 17,
              },
              {
                kind: 'located',
                quote: 'So this cat must be a chubby little treasure.',
                core: 'So this cat must be a chubby little treasure',
                start: 5,
                slot: 'chubby',
                slotStart: 22,
              },
            ],);
            expect(settled.edits,).toEqual([
              {
                placePosition: 1,
                sliceIndex: 1,
                start: 5,
                end: 49,
                text: 'So this cat is a chubby little treasure',
              },
            ],);
            expect(outcomesOf({ settled, },),).toEqual(['chosen', 'replaced',],);
          },
        },),
        it({
          name: 'RECORDS A BALLOT\'S QUOTES WITH A SLOT ONLY WHERE THE JUDGE GAVE ONE',
          fn: async () => {
            const quotes = [
              { label: 'OCCURRENCE 1', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
              { label: 'OCCURRENCE 2', quote: 'So this cat is a chubby little treasure.', },
            ];
            const settled = settleAsked({
              repeat: FRAME,
              places: [
                placeIn({ position: 0, english: 'So this cat is a lazy little treasure.', },),
                placeIn({ position: 1, english: 'So this cat is a chubby little treasure.', },),
              ],
              unplaced: [],
              asked: askedOf({ voices: threeAlike({ quotes, },), }),
            },);
            expect(settled.verdict.kind === 'asked' ? settled.verdict.ballots[0]?.quotes : null,).toEqual(quotes,);
          },
        },),
        it({
          name: 'KEEPS A PLACE A STRICT MAJORITY LISTS, recording kept-context and making no replacement for it',
          fn: async () => {
            const settled = settleAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              asked: askedOf({
                voices: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function voiceFor(seat,): ConsistencyVoice {
                  return voiceOf({
                    seat,
                    quotes: SENTENCE_QUOTES,
                    keep: (seat === 'synthetic-cat') ? [] : ['OCCURRENCE 2',],
                  },);
                },),
              }),
            },);
            expect(outcomesOf({ settled, },),).toEqual(['chosen', 'kept-context', 'consistent',],);
            expect(settled.edits,).toEqual([],);
          },
        },),
        it({
          name: 'LEAVES A PLACE UNLOCATED WHEN ITS QUOTE IS NOT IN ITS ENGLISH, recording unlocated and making no replacement',
          fn: async () => {
            const settled = settleAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              asked: askedOf({
                voices: threeAlike({
                  quotes: [
                    SENTENCE_QUOTES[0] ?? { label: '', quote: '', },
                    { label: 'OCCURRENCE 2', quote: 'the lamp naps', },
                    SENTENCE_QUOTES[2] ?? { label: '', quote: '', },
                  ],
                },),
              }),
            },);
            expect(outcomesOf({ settled, },),).toEqual(['chosen', 'unlocated', 'consistent',],);
            expect(settled.renderings[1],).toEqual({ kind: 'unlocated', reason: 'not-found', },);
            expect(settled.edits,).toEqual([],);
          },
        },),
        it({
          name: 'LEAVES EVERY PLACE UNTOUCHED WHEN NO PLACE WON: below the quorum, with no majority, or with a chosen place '
            + 'whose quote is not located',
          fn: async () => {
            const alike = threeAlike({ quotes: SENTENCE_QUOTES, },);
            const noQuorum = settleSentence({ asked: askedOf({ voices: alike, quorum: 4, }), },);
            const noMajority = settleSentence({
              asked: askedOf({
                voices: ['OCCURRENCE 1', 'OCCURRENCE 2', 'OCCURRENCE 3',].map(function splitChoice(choice,): ConsistencyVoice {
                  return voiceOf({
                    seat: `${choice}-cat`,
                    quotes: SENTENCE_QUOTES,
                    choice,
                  },);
                },),
              }),
            },);
            const chosenUnlocated = settleSentence({
              asked: askedOf({
                voices: threeAlike({
                  quotes: [
                    { label: 'OCCURRENCE 1', quote: 'the lamp naps', },
                    SENTENCE_QUOTES[1] ?? { label: '', quote: '', },
                    SENTENCE_QUOTES[2] ?? { label: '', quote: '', },
                  ],
                },),
              }),
            },);
            expect([noQuorum, noMajority, chosenUnlocated,].map(function winnerOfEach(settled,): unknown {
              return settled.verdict.kind === 'asked' ? settled.verdict.winner : null;
            },),).toEqual([
              { kind: 'none', reason: 'no-quorum', },
              { kind: 'none', reason: 'no-majority', },
              { kind: 'none', reason: 'chosen-unlocated', },
            ],);
            expect([noQuorum, noMajority, chosenUnlocated,].map(function outcomesOfEach(settled,): unknown {
              return [outcomesOf({ settled, },), settled.edits,];
            },),).toEqual([
              [['untouched', 'untouched', 'untouched',], [],],
              [['untouched', 'untouched', 'untouched',], [],],
              [['untouched', 'untouched', 'untouched',], [],],
            ],);
          },
        },),
        it({
          name: 'COUNTS ONLY THE BALLOTS THAT CAN BE COUNTED AGAINST THE PLACES, recording every ballot heard',
          fn: async () => {
            const voices = [
              ...threeAlike({ quotes: SENTENCE_QUOTES, },).slice(0, 2,),
              voiceOf({ seat: 'stray-cat', quotes: SENTENCE_QUOTES, choice: 'OCCURRENCE 9', },),
            ];
            const settled = settleAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              asked: askedOf({ voices, }),
            },);
            expect(settled.verdict.kind === 'asked' ? [settled.verdict.usable, settled.verdict.ballots,] : null,).toEqual([
              2,
              voices,
            ],);
          },
        },),
        it({
          name: 'CARRIES THE PLACES THE DETECTOR LEFT UNPLACED THROUGH TO THE GROUP',
          fn: async () => {
            const unplaced = [{ startOffset: 40, endOffset: 44, line: 5, reason: 'crosses-slice-end', },] as const;
            expect(settleAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced,
              asked: askedOf({ voices: threeAlike({ quotes: SENTENCE_QUOTES, },), }),
            },).unplaced,).toEqual(unplaced,);
          },
        },),
      ],
    },),
    describe({
      name: settleUnasked.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LEAVES EVERY PLACE OF A GROUP THAT READ ALIKE CONSISTENT, the bench not asked and no replacement made',
          fn: async () => {
            expect(settleUnasked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              reason: 'consistent',
            },),).toEqual({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              verdict: { kind: 'not-asked', reason: 'consistent', },
              renderings: [
                { kind: 'unlocated', reason: 'not-asked', },
                { kind: 'unlocated', reason: 'not-asked', },
                { kind: 'unlocated', reason: 'not-asked', },
              ],
              outcomes: ['consistent', 'consistent', 'consistent',],
              edits: [],
              findings: [],
            },);
          },
        },),
        it({
          name: 'LEAVES EVERY PLACE OF A GROUP WITH TOO FEW PLACES OR NO ENGLISH UNTOUCHED, naming the reason',
          fn: async () => {
            expect((['too-few-placed', 'no-english',] as const).map(function settle(reason,): unknown {
              const settled = settleUnasked({
                repeat: SENTENCE,
                places: SENTENCE_PLACES.slice(0, 2,),
                unplaced: [],
                reason,
              },);
              return [settled.verdict, settled.outcomes,];
            },),).toEqual([
              [{ kind: 'not-asked', reason: 'too-few-placed', }, ['untouched', 'untouched',],],
              [{ kind: 'not-asked', reason: 'no-english', }, ['untouched', 'untouched',],],
            ],);
          },
        },),
      ],
    },),
    describe({
      name: settleFailed.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LEAVES EVERY PLACE OF A GROUP WHOSE HANDLING FAILED UNTOUCHED, recording the detail and no replacement',
          fn: async () => {
            const unplaced = [{ startOffset: 40, endOffset: 44, line: 5, reason: 'in-no-slice', },] as const;
            expect(settleFailed({
              repeat: FRAME,
              places: SENTENCE_PLACES,
              unplaced,
              detail: 'refused by ConsistencyInvariantError',
            },),).toEqual({
              repeat: FRAME,
              places: SENTENCE_PLACES,
              unplaced,
              verdict: { kind: 'failed', detail: 'refused by ConsistencyInvariantError', },
              renderings: [
                { kind: 'unlocated', reason: 'not-asked', },
                { kind: 'unlocated', reason: 'not-asked', },
                { kind: 'unlocated', reason: 'not-asked', },
              ],
              outcomes: ['untouched', 'untouched', 'untouched',],
              edits: [],
              findings: [],
            },);
          },
        },),
      ],
    },),
    describe({
      name: unplacedOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LISTS EACH PLACE NO SLICE HOLDS WHOLE WITH ITS OFFSETS, LINE AND REASON, in the detector\'s order',
          fn: async () => {
            const group: RepeatGroup = {
              kind: 'maximal',
              length: 4,
              occurrences: [],
              unplaced: [
                { startOffset: 40, endOffset: 44, line: 5, reason: 'crosses-slice-end', },
                { startOffset: 60, endOffset: 64, line: 7, reason: 'in-no-slice', },
              ],
            };
            expect(unplacedOf({ group, },),).toEqual([
              { startOffset: 40, endOffset: 44, line: 5, reason: 'crosses-slice-end', },
              { startOffset: 60, endOffset: 64, line: 7, reason: 'in-no-slice', },
            ],);
            expect(unplacedOf({ group: { ...group, unplaced: [], }, },),).toEqual([],);
          },
        },),
      ],
    },),
  ],
},);
