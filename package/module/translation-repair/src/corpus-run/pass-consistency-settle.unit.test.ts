/**
 Tests for deciding a repeat group once the bench has spoken, and settling it
 once its receiving places are carried to: the verdict a group records, the
 rendering and provisional outcome of each place, the run-off of a tie for
 first, and the replacements the carries make before the floors have spoken.

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
  type ArtifactConsistencyRepeat,
  ConsistencyInvariantError,
  type ConsistencyAsked,
  type ConsistencyPlace,
  type ConsistencyRunOffAsked,
  type ConsistencyVoice,
  countAsked,
  type PlaceCarried,
  settleAsked,
  settleCarried,
} from '../../dist/final/node/index.mjs';
import {
  placeIn,
  runOffOf,
} from './consistency-settle.test-fixture.ts';

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
 Four voices that give the same quotes and choose the first place twice and the second twice, a tie for first.

 @returns The voices, in seat order

 @example
 ```ts
 const voices = fourSplit();
 ```
 */
function fourSplit(): readonly ConsistencyVoice[] {
  return ['hyper-cat', 'bedrock-cat', 'synthetic-cat', 'openrouter-cat',].map(function voiceFor(
    seat,
    at,
  ): ConsistencyVoice {
    return voiceOf({
      seat,
      quotes: SENTENCE_QUOTES,
      choice: (at < 2) ? 'OCCURRENCE 1' : 'OCCURRENCE 2',
    },);
  },);
}

/**
 Settles the repeated sentence in its three places from what the bench came to.

 @param asked - the ballots heard, the quorum and the gather's findings

 @param runOff - what the run-off heard, none when the choices did not tie

 @returns The decided group

 @example
 ```ts
 const decided = decideSentence({ asked: askedOf({ voices, }), },);
 ```
 */
function decideSentence(
  {
    asked,
    runOff,
  }: {
    readonly asked: ConsistencyAsked;
    readonly runOff?: ConsistencyRunOffAsked;
  },
): ReturnType<typeof settleAsked> {
  return settleAsked({
    repeat: SENTENCE,
    places: SENTENCE_PLACES,
    unplaced: [],
    asked,
    ...((runOff === undefined) ? {} : { runOff, }),
  },);
}

/**
 A carry of the second place that makes the edit it is given.

 @param edits - replacements the carry makes

 @param findings - what the carry reported

 @returns The carried place

 @example
 ```ts
 const carried = carriedOf({ edits: [], findings: [], },);
 ```
 */
function carriedOf(
  {
    edits,
    findings,
  }: {
    readonly edits: PlaceCarried['edits'];
    readonly findings: PlaceCarried['findings'];
  },
): PlaceCarried {
  return {
    carry: {
      label: 'OCCURRENCE 2',
      candidates: [
        { label: 'CANDIDATE 1', kind: 'current', writers: [], text: 'Later the kitten naps in the sun.', },
        { label: 'CANDIDATE 2', kind: 'splice', writers: [], text: 'Later the cat naps in the sun.', },
      ],
      ballots: [],
      usable: 0,
      quorum: 2,
      decision: { kind: 'none', reason: 'no-quorum', },
    },
    edits,
    findings,
  };
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
          name: 'DECIDES A GROUP THE BENCH DECIDED: the first place chosen, the second a receiver of the chosen words, the third '
            + 'already carrying them, with the verdict, renderings and receivers recorded whole and nothing replaced yet',
          fn: async () => {
            const voices = threeAlike({ quotes: SENTENCE_QUOTES, },);
            const decided = settleAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              unplaced: [],
              asked: askedOf({ voices, findings: ['page-consistency 3/3',], }),
            },);
            const renderings = [
              { kind: 'located', quote: 'The cat naps', core: 'The cat naps', start: 0, },
              { kind: 'located', quote: 'the kitten naps', core: 'the kitten naps', start: 6, },
              { kind: 'located', quote: 'The cat naps', core: 'The cat naps', start: 9, },
            ] as const;
            expect(decided,).toEqual({
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
              renderings,
              outcomes: ['chosen', 'kept-current', 'consistent',],
              edits: [],
              carries: [],
              findings: ['page-consistency 3/3',],
              chosen: [{ place: SENTENCE_PLACES[0], rendering: renderings[0], },],
              receivers: [
                {
                  place: SENTENCE_PLACES[1],
                  rendering: renderings[1],
                  position: 1,
                  label: 'OCCURRENCE 2',
                  plan: { kind: 'replace', start: 6, end: 21, text: 'the cat naps', },
                },
              ],
            },);
          },
        },),
        it({
          name: 'DECIDES A FRAME BY MAKING THE RECEIVING PLACE A RECEIVER OF THE CHOSEN PATTERN, its plan carrying its own slot '
            + 'inside the chosen frame',
          fn: async () => {
            const quotes = [
              { label: 'OCCURRENCE 1', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
              { label: 'OCCURRENCE 2', quote: 'So this cat must be a chubby little treasure.', slot: 'chubby', },
            ];
            const decided = settleAsked({
              repeat: FRAME,
              places: [
                placeIn({ position: 0, english: 'So this cat is a lazy little treasure. Sleep.', },),
                placeIn({ position: 1, english: 'Now: So this cat must be a chubby little treasure.', },),
              ],
              unplaced: [],
              asked: askedOf({ voices: threeAlike({ quotes, },), }),
            },);
            expect(decided.renderings,).toEqual([
              {
                kind: 'located',
                quote: 'So this cat is a lazy little treasure',
                core: 'So this cat is a lazy little treasure',
                start: 0,
                slot: 'lazy',
                slotStart: 17,
              },
              {
                kind: 'located',
                quote: 'So this cat must be a chubby little treasure',
                core: 'So this cat must be a chubby little treasure',
                start: 5,
                slot: 'chubby',
                slotStart: 22,
              },
            ],);
            expect(decided.receivers.map(function planOf({ plan, label, },): unknown {
              return [label, plan,];
            },),).toEqual([
              ['OCCURRENCE 2', { kind: 'replace', start: 5, end: 49, text: 'So this cat is a chubby little treasure', },],
            ],);
            expect([decided.outcomes, decided.edits,],).toEqual([['chosen', 'kept-current',], [],],);
          },
        },),
        it({
          name: 'MAKES A FRAME\'S PLACE A RECEIVER WITH NO SPLICE WHEN THE BALLOTS DID NOT AGREE ITS SLOT, the plan unavailable '
            + 'to code so only a writer can carry the pattern',
          fn: async () => {
            const quotes = [
              { label: 'OCCURRENCE 1', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
              { label: 'OCCURRENCE 2', quote: 'So this cat must be a chubby little treasure.', },
            ];
            const decided = settleAsked({
              repeat: FRAME,
              places: [
                placeIn({ position: 0, english: 'So this cat is a lazy little treasure. Sleep.', },),
                placeIn({ position: 1, english: 'Now: So this cat must be a chubby little treasure.', },),
              ],
              unplaced: [],
              asked: askedOf({ voices: threeAlike({ quotes, },), }),
            },);
            expect(decided.receivers.map(function planOf({ plan, },): unknown {
              return plan;
            },),).toEqual([{ kind: 'unavailable', },],);
            expect(decided.outcomes,).toEqual(['chosen', 'kept-current',],);
          },
        },),
        it({
          name: 'RECORDS A BALLOT\'S QUOTES WITH A SLOT ONLY WHERE THE JUDGE GAVE ONE',
          fn: async () => {
            const quotes = [
              { label: 'OCCURRENCE 1', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
              { label: 'OCCURRENCE 2', quote: 'So this cat is a chubby little treasure.', },
            ];
            const decided = settleAsked({
              repeat: FRAME,
              places: [
                placeIn({ position: 0, english: 'So this cat is a lazy little treasure.', },),
                placeIn({ position: 1, english: 'So this cat is a chubby little treasure.', },),
              ],
              unplaced: [],
              asked: askedOf({ voices: threeAlike({ quotes, },), }),
            },);
            expect(decided.verdict.kind === 'asked' ? decided.verdict.ballots[0]?.quotes : null,).toEqual(quotes,);
          },
        },),
        it({
          name: 'KEEPS A PLACE A STRICT MAJORITY LISTS, recording kept-context and making it no receiver',
          fn: async () => {
            const decided = decideSentence({
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
            expect([decided.outcomes, decided.receivers,],).toEqual([['chosen', 'kept-context', 'consistent',], [],],);
          },
        },),
        it({
          name: 'LEAVES A PLACE UNLOCATED WHEN ITS QUOTE IS NOT IN ITS ENGLISH, recording unlocated and making it no receiver',
          fn: async () => {
            const decided = decideSentence({
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
            expect([decided.outcomes, decided.receivers,],).toEqual([['chosen', 'unlocated', 'consistent',], [],],);
            expect(decided.renderings[1],).toEqual({ kind: 'unlocated', reason: 'not-found', },);
          },
        },),
        it({
          name: 'LEAVES EVERY PLACE UNTOUCHED WHEN NO PLACE WON: below the quorum, with no majority, or with a chosen place '
            + 'whose quote is not located',
          fn: async () => {
            const alike = threeAlike({ quotes: SENTENCE_QUOTES, },);
            const noQuorum = decideSentence({ asked: askedOf({ voices: alike, quorum: 4, }), },);
            const noMajority = decideSentence({
              asked: askedOf({
                voices: ['OCCURRENCE 1', 'OCCURRENCE 2', 'OCCURRENCE 3',].map(function splitChoice(choice,): ConsistencyVoice {
                  return voiceOf({
                    seat: `${choice}-cat`,
                    quotes: SENTENCE_QUOTES,
                    choice,
                  },);
                },),
              }),
              runOff: runOffOf({ choices: ['OCCURRENCE 1', 'OCCURRENCE 2', 'OCCURRENCE 3',], },),
            },);
            const chosenUnlocated = decideSentence({
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
            expect([noQuorum, noMajority, chosenUnlocated,].map(function winnerOfEach(decided,): unknown {
              return decided.verdict.kind === 'asked' ? decided.verdict.winner : null;
            },),).toEqual([
              { kind: 'none', reason: 'no-quorum', },
              { kind: 'none', reason: 'run-off-tied', },
              { kind: 'none', reason: 'chosen-unlocated', },
            ],);
            expect([noQuorum, noMajority, chosenUnlocated,].map(function outcomesOfEach(decided,): unknown {
              return [decided.outcomes, decided.receivers, decided.chosen,];
            },),).toEqual([
              [['untouched', 'untouched', 'untouched',], [], [],],
              [['untouched', 'untouched', 'untouched',], [], [],],
              [['untouched', 'untouched', 'untouched',], [], [],],
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
            const decided = decideSentence({ asked: askedOf({ voices, }), },);
            expect(decided.verdict.kind === 'asked' ? [decided.verdict.usable, decided.verdict.ballots,] : null,).toEqual([
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
        it({
          name: 'RUNS OFF A TIE FOR FIRST: the finalist the run-off\'s strict majority names is chosen, and the run-off is '
            + 'recorded whole beside the first round with its findings',
          fn: async () => {
            const voices = fourSplit();
            const decided = decideSentence({
              asked: askedOf({ voices, quorum: 3, }),
              runOff: runOffOf({
                choices: ['OCCURRENCE 2', 'OCCURRENCE 2', 'OCCURRENCE 1',],
                quorum: 2,
                findings: ['page-consistency-run-off 3/3',],
              },),
            },);
            expect({
              verdict: decided.verdict,
              outcomes: decided.outcomes,
              findings: decided.findings,
              receivers: decided.receivers.map(function labelOf({ label, },): string {
                return label;
              },),
            },).toEqual({
              verdict: {
                kind: 'asked',
                ballots: voices,
                usable: 4,
                quorum: 3,
                winner: { kind: 'chosen', label: 'OCCURRENCE 2', },
                runOff: {
                  finalists: ['OCCURRENCE 1', 'OCCURRENCE 2',],
                  ballots: [
                    { seat: 'seat-0', reason: 'It renders the original best.', choice: 'OCCURRENCE 2', },
                    { seat: 'seat-1', reason: 'It renders the original best.', choice: 'OCCURRENCE 2', },
                    { seat: 'seat-2', reason: 'It renders the original best.', choice: 'OCCURRENCE 1', },
                  ],
                  usable: 3,
                  quorum: 2,
                },
              },
              outcomes: ['kept-current', 'chosen', 'kept-current',],
              findings: ['page-consistency-run-off 3/3',],
              receivers: ['OCCURRENCE 1', 'OCCURRENCE 3',],
            },);
          },
        },),
        it({
          name: 'LEAVES THE PAGE AS IT STANDS ON A SECOND TIE OR A RUN-OFF BELOW ITS QUORUM, recorded with the run-off whole',
          fn: async () => {
            const tied = decideSentence({
              asked: askedOf({ voices: fourSplit(), quorum: 3, }),
              runOff: runOffOf({ choices: ['OCCURRENCE 1', 'OCCURRENCE 2',], },),
            },);
            const short = decideSentence({
              asked: askedOf({ voices: fourSplit(), quorum: 3, }),
              runOff: runOffOf({ choices: ['OCCURRENCE 1',], quorum: 2, },),
            },);
            expect([tied, short,].map(function summary(decided,): unknown {
              return decided.verdict.kind === 'asked'
                ? [decided.verdict.winner, decided.verdict.runOff?.usable, decided.outcomes, decided.receivers.length,]
                : null;
            },),).toEqual([
              [{ kind: 'none', reason: 'run-off-tied', }, 2, ['untouched', 'untouched', 'untouched',], 0,],
              [{ kind: 'none', reason: 'run-off-no-quorum', }, 1, ['untouched', 'untouched', 'untouched',], 0,],
            ],);
          },
        },),
        it({
          name: 'REFUSES A GROUP WHOSE TIE WAS NOT RUN OFF, and a run-off heard for choices that did not tie',
          fn: async () => {
            const tieWithoutRunOff = caught(function settleTie(): unknown {
              return decideSentence({ asked: askedOf({ voices: fourSplit(), quorum: 3, }), },);
            },);
            const runOffWithoutTie = caught(function settleMajority(): unknown {
              return decideSentence({
                asked: askedOf({ voices: threeAlike({ quotes: SENTENCE_QUOTES, },), }),
                runOff: runOffOf({ choices: ['OCCURRENCE 2', 'OCCURRENCE 2',], },),
              },);
            },);
            expect(tieWithoutRunOff,).toBeInstanceOf(ConsistencyInvariantError,);
            expect([String(tieWithoutRunOff,), String(runOffWithoutTie,),],).toEqual([
              'ConsistencyInvariantError: unreachable: the choices tied for first and the bench was not asked again, and a tie is '
              + 'run off before the group is settled',
              'ConsistencyInvariantError: unreachable: a run-off was heard for choices that did not tie for first, and the bench '
              + 'is asked again only on a tie',
            ],);
          },
        },),
      ],
    },),
    describe({
      name: countAsked.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS THE FIRST ROUND\'S BALLOTS OVER THE PLACES and names the finalists of a tie for first',
          fn: async () => {
            const tied = countAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              asked: askedOf({ voices: fourSplit(), quorum: 3, }),
            },);
            const decided = countAsked({
              repeat: SENTENCE,
              places: SENTENCE_PLACES,
              asked: askedOf({ voices: threeAlike({ quotes: SENTENCE_QUOTES, },), }),
            },);
            expect([tied.finalists, tied.winner, decided.finalists, decided.winner,],).toEqual([
              ['OCCURRENCE 1', 'OCCURRENCE 2',],
              { kind: 'none', reason: 'no-majority', },
              [],
              { kind: 'chosen', label: 'OCCURRENCE 1', },
            ],);
          },
        },),
      ],
    },),
    describe({
      name: settleCarried.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'MAKES A RECEIVER REPLACED WHEN ITS CARRY MAKES AN EDIT, and records the carries, the edits and the findings '
            + 'of the decision and of the carries',
          fn: async () => {
            const decided = decideSentence({
              asked: askedOf({ voices: threeAlike({ quotes: SENTENCE_QUOTES, },), findings: ['page-consistency 3/3',], }),
            },);
            const edit = { placePosition: 1, sliceIndex: 1, start: 6, end: 21, text: 'the cat naps', };
            const carried = carriedOf({ edits: [edit,], findings: ['consistency-candidate-refused (qwen)',], });
            const settled = settleCarried({ decided, carried: [carried,], },);
            expect({
              outcomes: settled.outcomes,
              edits: settled.edits,
              carries: settled.carries,
              findings: settled.findings,
              verdict: settled.verdict,
            },).toEqual({
              outcomes: ['chosen', 'replaced', 'consistent',],
              edits: [edit,],
              carries: [carried.carry,],
              findings: ['page-consistency 3/3', 'consistency-candidate-refused (qwen)',],
              verdict: decided.verdict,
            },);
          },
        },),
        it({
          name: 'KEEPS A RECEIVER\'S PROVISIONAL OUTCOME WHEN ITS CARRY MAKES NO EDIT: the page keeps its English',
          fn: async () => {
            const decided = decideSentence({
              asked: askedOf({ voices: threeAlike({ quotes: SENTENCE_QUOTES, },), }),
            },);
            const settled = settleCarried({ decided, carried: [carriedOf({ edits: [], findings: [], }),], },);
            expect([settled.outcomes, settled.edits,],).toEqual([['chosen', 'kept-current', 'consistent',], [],],);
          },
        },),
        it({
          name: 'SETTLES A GROUP WITH NO RECEIVER FROM NO CARRY, and refuses a count of carries that is not one per receiver',
          fn: async () => {
            const nobody = decideSentence({
              asked: askedOf({ voices: threeAlike({ quotes: SENTENCE_QUOTES, },), quorum: 4, }),
            },);
            const receiving = decideSentence({
              asked: askedOf({ voices: threeAlike({ quotes: SENTENCE_QUOTES, },), }),
            },);
            expect(settleCarried({ decided: nobody, carried: [], },).carries,).toEqual([],);
            const refusal = caught(function settleTwo(): unknown {
              return settleCarried({
                decided: receiving,
                carried: [carriedOf({ edits: [], findings: [], },), carriedOf({ edits: [], findings: [], },),],
              },);
            },);
            expect(refusal,).toBeInstanceOf(ConsistencyInvariantError,);
            expect(String(refusal,),).toBe(
              'ConsistencyInvariantError: unreachable: the pass carries to each receiving place once, and the number of '
              + 'carries differs from the number of receiving places (carried: 2, receiving: 1)',
            );
          },
        },),
      ],
    },),
  ],
},);
