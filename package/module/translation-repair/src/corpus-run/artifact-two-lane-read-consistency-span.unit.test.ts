/**
 Tests for recounting a group of the sixteenth shape from its own ballots: the
 usable count, each place's rendering, the winner, each receiving place's carry
 and what became of each place. Each case breaks one valid group in one way and
 pins the whole refusal.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ArtifactConsistencyBallot,
  type ArtifactConsistencyCarry,
  type ArtifactConsistencyGroup,
  type ArtifactConsistencyOccurrence,
  assertSpanGroupCoherent,
  type ConsistencyWinner,
} from '../../dist/final/node/index.mjs';
import { refusalTextOf, } from './consistency-refusal.test-fixture.ts';

/**
 Where the group sits in the section, for the refusals.
 */
const GROUP = 'cat.consistency.groups[0]';

/**
 The group the cases read: a repeated sentence in two places whose three ballots choose the first.
 */
type AskedGroup = ArtifactConsistencyGroup & { readonly verdict: { readonly kind: 'asked'; }; };

/**
 One ballot, choosing the first place and quoting both with the closing full stop as a judge may.

 @param seat - seat that answered

 @param over - fields this case replaces

 @returns The ballot

 @example
 ```ts
 const ballot = ballotOf({ seat: 'hyper-cat', },);
 ```
 */
function ballotOf(
  {
    seat,
    over = {},
  }: {
    readonly seat: string;
    readonly over?: {
      readonly quotes?: ArtifactConsistencyBallot['quotes'];
      readonly choice?: string;
      readonly keep?: ArtifactConsistencyBallot['keep'];
    };
  },
): ArtifactConsistencyBallot {
  return {
    seat,
    reason: 'The first place words it best.',
    quotes: [
      { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
      { label: 'OCCURRENCE 2', quote: 'the kitten naps', },
    ],
    choice: 'OCCURRENCE 1',
    keep: [],
    ...over,
  };
}

/**
 The carry of the second place: the bench chose the chosen words moved in by code.
 */
const CARRY: ArtifactConsistencyCarry = {
  label: 'OCCURRENCE 2',
  candidates: [
    { label: 'CANDIDATE 1', kind: 'current', writers: [], text: 'Later the kitten naps in the sun.', },
    { label: 'CANDIDATE 2', kind: 'splice', writers: [], text: 'Later the cat naps in the sun.', },
  ],
  ballots: [
    { seat: 'hyper-cat', reason: 'It words the original best.', choice: 'CANDIDATE 2', },
    { seat: 'bedrock-cat', reason: 'It words the original best.', choice: 'CANDIDATE 2', },
  ],
  usable: 2,
  quorum: 2,
  decision: { kind: 'chosen', label: 'CANDIDATE 2', },
};

/**
 A place of the sentence, with the fields a case replaces.

 @param position - position of the place in the group

 @param over - fields this case replaces

 @returns The place

 @example
 ```ts
 const place = placeOf({ position: 1, over: { outcome: 'consistent', }, },);
 ```
 */
function placeOf(
  {
    position,
    over = {},
  }: {
    readonly position: number;
    readonly over?: {
      readonly rendering?: ArtifactConsistencyOccurrence['rendering'];
      readonly outcome?: ArtifactConsistencyOccurrence['outcome'];
    };
  },
): ArtifactConsistencyOccurrence {
  return (position === 0)
    ? {
      label: 'OCCURRENCE 1',
      sliceIndex: 0,
      startOffset: 6,
      endOffset: 18,
      line: 3,
      rendering: { kind: 'located', quote: 'The cat naps', start: 0, },
      outcome: 'chosen',
      ...over,
    }
    : {
      label: 'OCCURRENCE 2',
      sliceIndex: 1,
      startOffset: 30,
      endOffset: 42,
      line: 5,
      rendering: { kind: 'located', quote: 'the kitten naps', start: 6, },
      outcome: 'replaced',
      ...over,
    };
}

/**
 What the bench was asked and answered, with the fields a case replaces: three
 ballots that choose the first place, a quorum of two and the first place the winner.

 @param ballots - the ballots heard

 @param usable - how many of them can be counted

 @param quorum - voices the gather closed on

 @param winner - how the count ended

 @returns The verdict

 @example
 ```ts
 const verdict = verdictWith({ usable: 2, },);
 ```
 */
function verdictWith(
  {
    ballots = [ballotOf({ seat: 'hyper-cat', },), ballotOf({ seat: 'bedrock-cat', },), ballotOf({ seat: 'synthetic-cat', },),],
    usable = 3,
    quorum = 2,
    winner = { kind: 'chosen', label: 'OCCURRENCE 1', },
  }: {
    readonly ballots?: readonly ArtifactConsistencyBallot[];
    readonly usable?: number;
    readonly quorum?: number;
    readonly winner?: ConsistencyWinner;
  },
): AskedGroup['verdict'] {
  return {
    kind: 'asked',
    ballots,
    usable,
    quorum,
    winner,
  };
}

/**
 The coherent group, with the fields a case replaces.

 @param over - fields of the group this case replaces

 @returns The group

 @example
 ```ts
 const group = groupOf({ over: { carries: [], }, },);
 ```
 */
function groupOf(
  { over = {}, }: {
    readonly over?: {
      readonly repeat?: AskedGroup['repeat'];
      readonly occurrences?: AskedGroup['occurrences'];
      readonly verdict?: AskedGroup['verdict'];
      readonly carries?: readonly ArtifactConsistencyCarry[];
    };
  } = {},
): AskedGroup {
  return {
    repeat: { kind: 'maximal', wording: '窗台上的阳光让小猫睡着了', },
    occurrences: [placeOf({ position: 0, },), placeOf({ position: 1, },),],
    unplaced: [],
    verdict: verdictWith({},),
    carries: [CARRY,],
    ...over,
  };
}

/**
 The group with its verdict's fields replaced.

 @param over - fields of the verdict this case replaces

 @returns The group

 @example
 ```ts
 const group = withVerdict({ over: { usable: 2, }, },);
 ```
 */
function withVerdict(
  { over, }: { readonly over: Parameters<typeof verdictWith>[0]; },
): AskedGroup {
  return groupOf({ over: { verdict: verdictWith(over,), }, },);
}

/**
 The text of the refusal the recount raises for a group.

 @param group - the group, asked of the bench

 @returns The refusal as text

 @example
 ```ts
 const text = coherenceRefusal({ group: groupOf(), },);
 ```
 */
function coherenceRefusal({ group, }: { readonly group: AskedGroup; },): string {
  return refusalTextOf({
    read: function recounts(): unknown {
      return assertSpanGroupCoherent({ group, path: GROUP, },);
    },
  },);
}

/**
 The refusal for an outcome the ballots, the renderings and the carries do not give.

 @param place - position of the place

 @param expected - what the outcome should be

 @returns The refusal as text

 @example
 ```ts
 const text = outcomeRefusal({ place: 1, expected: 'consistent', },);
 ```
 */
function outcomeRefusal({ place, expected, }: { readonly place: number; readonly expected: string; },): string {
  return `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[${String(place,)}].outcome: `
    + `expected ${expected}.`;
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: assertSpanGroupCoherent.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ACCEPTS A GROUP WHOSE COUNT, RENDERINGS, WINNER, CARRY AND OUTCOMES ARE WHAT ITS BALLOTS GIVE, the closing full '
            + 'stop of a quote and the words of the place\'s English counting as one span',
          fn: async () => {
            expect(assertSpanGroupCoherent({ group: groupOf(), path: GROUP, },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES A SEAT HEARD TWICE AND A USABLE COUNT THAT IS NOT THE BALLOTS\'',
          fn: async () => {
            expect([
              withVerdict({
                over: { ballots: [ballotOf({ seat: 'hyper-cat', },), ballotOf({ seat: 'hyper-cat', },), ballotOf({ seat: 'x', },),], },
              }),
              withVerdict({ over: { usable: 2, }, }),
            ].map(function refusedFor(group,): string {
              return coherenceRefusal({ group, },);
            },),).toEqual([
              `ArtifactParseError: artifact parse failed at ${GROUP}.verdict.ballots[1].seat: `
              + 'expected a seat heard once, since a gather hears each seat once.',
              `ArtifactParseError: artifact parse failed at ${GROUP}.verdict.usable: `
              + 'expected the number of ballots that can be counted against the places.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A LOCATED RENDERING THAT IS NOT THE WORDS A STRICT MAJORITY QUOTED, though it is a string some ballot '
            + 'gave, and a reason the ballots contradict',
          fn: async () => {
            expect([
              groupOf({ over: { occurrences: [placeOf({ position: 0, },), placeOf({
                position: 1,
                over: { rendering: { kind: 'located', quote: 'the kitten dozes', start: 6, }, },
              },),], }, }),
              groupOf({ over: { occurrences: [placeOf({ position: 0, },), placeOf({
                position: 1,
                over: { rendering: { kind: 'unlocated', reason: 'no-agreement', }, outcome: 'unlocated', },
              },),], }, }),
            ].map(function refusedFor(group,): string {
              return coherenceRefusal({ group, },);
            },),).toEqual([
              `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[1].rendering: `
              + 'expected the words a strict majority of the usable ballots quoted, as the place\'s English holds them.',
              `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[1].rendering.reason: `
              + 'expected a reason the usable ballots do not contradict.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A SLOT IN A REPEATED RUN\'S RENDERING AND A WINNER THAT IS NOT THE MAJORITY\'S CHOICE',
          fn: async () => {
            expect([
              groupOf({ over: { occurrences: [placeOf({
                position: 0,
                over: { rendering: { kind: 'located', quote: 'The cat naps', start: 0, slot: 'cat', }, },
              },), placeOf({ position: 1, },),], }, }),
              withVerdict({ over: { winner: { kind: 'chosen', label: 'OCCURRENCE 2', }, }, }),
              withVerdict({ over: { winner: { kind: 'none', reason: 'no-majority', }, }, }),
            ].map(function refusedFor(group,): string {
              return coherenceRefusal({ group, },);
            },),).toEqual([
              `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[0].rendering: `
              + 'expected the slot a strict majority of the usable ballots gave inside those words, and none where they gave none.',
              `ArtifactParseError: artifact parse failed at ${GROUP}.verdict.winner: `
              + 'expected the winner a strict majority of the usable ballots, reaching the quorum, give, after the run-off when they tied.',
              `ArtifactParseError: artifact parse failed at ${GROUP}.verdict.winner: `
              + 'expected the winner a strict majority of the usable ballots, reaching the quorum, give, after the run-off when they tied.',
            ],);
          },
        },),
        it({
          name: 'REFUSES AN OUTCOME THE BALLOTS, THE RENDERINGS AND THE CARRIES DO NOT GIVE: a chosen place that is not chosen, a '
            + 'place already carrying the words that is not consistent, and a place a majority keeps that is not kept',
          fn: async () => {
            const kept = {
              ...groupOf().verdict,
              ballots: [
                ballotOf({ seat: 'hyper-cat', over: { keep: ['OCCURRENCE 2',], }, },),
                ballotOf({ seat: 'bedrock-cat', over: { keep: ['OCCURRENCE 2',], }, },),
                ballotOf({ seat: 'synthetic-cat', },),
              ],
            };
            expect([
              groupOf({ over: { occurrences: [placeOf({ position: 0, over: { outcome: 'replaced', }, },), placeOf({ position: 1, },),], }, }),
              groupOf({
                over: {
                  occurrences: [
                    placeOf({ position: 0, },),
                    placeOf({ position: 1, over: { rendering: { kind: 'located', quote: 'The cat naps', start: 6, }, }, },),
                  ],
                  carries: [],
                },
              }),
              groupOf({ over: { verdict: kept, carries: [], }, }),
            ].map(function refusedFor(group,): string {
              return coherenceRefusal({ group, },);
            },),).toEqual([
              outcomeRefusal({ place: 0, expected: 'chosen, as the ballots and the renderings give for this place', }),
              `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[1].rendering: `
              + 'expected the words a strict majority of the usable ballots quoted, as the place\'s English holds them.',
              outcomeRefusal({ place: 1, expected: 'kept-context, as the ballots and the renderings give for this place', }),
            ],);
          },
        },),
        it({
          name: 'READS A PLACE A MAJORITY KEEPS AS KEPT-CONTEXT WITH NO CARRY, a place no quote located as unlocated and every '
            + 'place untouched where no place won',
          fn: async () => {
            const kept = verdictWith({
              ballots: [
                ballotOf({ seat: 'hyper-cat', over: { keep: ['OCCURRENCE 2',], }, },),
                ballotOf({ seat: 'bedrock-cat', over: { keep: ['OCCURRENCE 2',], }, },),
                ballotOf({ seat: 'synthetic-cat', },),
              ],
            },);
            const unlocated = verdictWith({
              ballots: [
                ballotOf({ seat: 'hyper-cat', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat naps.', },], }, },),
                ballotOf({ seat: 'bedrock-cat', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat naps.', },], }, },),
                ballotOf({ seat: 'synthetic-cat', over: { quotes: [{ label: 'OCCURRENCE 1', quote: 'The cat naps.', },], }, },),
              ],
            },);
            const noWinner = verdictWith({
              usable: 1,
              ballots: [ballotOf({ seat: 'hyper-cat', },),],
              winner: { kind: 'none', reason: 'no-quorum', },
            },);
            expect([
              groupOf({
                over: {
                  verdict: kept,
                  occurrences: [placeOf({ position: 0, },), placeOf({ position: 1, over: { outcome: 'kept-context', }, },),],
                  carries: [],
                },
              }),
              groupOf({
                over: {
                  verdict: unlocated,
                  occurrences: [
                    placeOf({ position: 0, },),
                    placeOf({
                      position: 1,
                      over: { rendering: { kind: 'unlocated', reason: 'no-agreement', }, outcome: 'unlocated', },
                    },),
                  ],
                  carries: [],
                },
              }),
              groupOf({
                over: {
                  verdict: noWinner,
                  occurrences: [
                    placeOf({ position: 0, over: { outcome: 'untouched', }, },),
                    placeOf({ position: 1, over: { outcome: 'untouched', }, },),
                  ],
                  carries: [],
                },
              }),
            ].map(function recounted(group,): unknown {
              return assertSpanGroupCoherent({ group, path: GROUP, },);
            },),).toEqual([undefined, undefined, undefined,],);
          },
        },),
        it({
          name: 'REFUSES CARRIES THAT ARE NOT ONE FOR EACH RECEIVING PLACE IN ORDER, and a receiving place whose outcome its '
            + 'carry\'s decision does not allow',
          fn: async () => {
            expect([
              groupOf({ over: { carries: [], }, }),
              groupOf({ over: { carries: [CARRY, { ...CARRY, label: 'OCCURRENCE 3', },], }, }),
              groupOf({
                over: {
                  carries: [
                    {
                      ...CARRY,
                      ballots: CARRY.ballots.map(function choosesCurrent(ballot,): ArtifactConsistencyCarry['ballots'][number] {
                        return { ...ballot, choice: 'CANDIDATE 1', };
                      },),
                      decision: { kind: 'chosen', label: 'CANDIDATE 1', },
                    },
                  ],
                },
              }),
              groupOf({ over: { occurrences: [placeOf({ position: 0, },), placeOf({ position: 1, over: { outcome: 'kept-current', }, },),], }, }),
            ].map(function refusedFor(group,): string {
              return coherenceRefusal({ group, },);
            },),).toEqual([
              `ArtifactParseError: artifact parse failed at ${GROUP}.carries: `
              + 'expected a carry for OCCURRENCE 2, which the chosen words are carried to.',
              `ArtifactParseError: artifact parse failed at ${GROUP}.carries: `
              + 'expected one carry for each place the chosen words are carried to, in the order of the places.',
              outcomeRefusal({ place: 1, expected: 'kept-current, for a carry that decided as recorded', }),
              outcomeRefusal({ place: 1, expected: 'replaced, kept-floor, overlapped, for a carry that decided as recorded', }),
            ],);
          },
        },),
        it({
          name: 'REFUSES A SPLICE CANDIDATE FOR A FRAME\'S PLACE WHOSE SLOT OR WHOSE CHOSEN FRAME\'S SLOT THE BALLOTS DID NOT PIN '
            + 'DOWN, since code cannot move the words without both slots',
          fn: async () => {
            /**
             A refrain whose ballots gave no slot for either place.
             */
            const frame = groupOf({
              over: {
                repeat: { kind: 'refrain', prefix: '所以这只猫一定是', suffix: '的小宝贝', },
                occurrences: [
                  { ...placeOf({ position: 0, },), slotStartOffset: 9, slotEndOffset: 11, },
                  { ...placeOf({ position: 1, },), slotStartOffset: 33, slotEndOffset: 35, },
                ],
              },
            });
            expect(coherenceRefusal({ group: frame, },),).toBe(
              `ArtifactParseError: artifact parse failed at ${GROUP}.carries: `
              + 'expected no splice candidate for OCCURRENCE 2, whose frame or the chosen frame has no slot to move the words by.',
            );
            const alone: ArtifactConsistencyCarry = {
              ...CARRY,
              candidates: [nonNullishOrThrow(CARRY.candidates[0],),],
              ballots: [],
              usable: 0,
              quorum: 0,
              decision: { kind: 'none', reason: 'no-alternative', },
            };
            expect(assertSpanGroupCoherent({
              group: {
                ...frame,
                carries: [alone,],
                occurrences: [
                  { ...placeOf({ position: 0, },), slotStartOffset: 9, slotEndOffset: 11, },
                  { ...placeOf({ position: 1, over: { outcome: 'kept-current', }, },), slotStartOffset: 33, slotEndOffset: 35, },
                ],
              },
              path: GROUP,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES A CARRY WHOSE OWN BALLOTS DO NOT GIVE ITS DECISION, naming the carry under the group',
          fn: async () => {
            expect(coherenceRefusal({
              group: groupOf({ over: { carries: [{ ...CARRY, usable: 3, },], }, }),
            },),).toBe(
              `ArtifactParseError: artifact parse failed at ${GROUP}.carries[0].usable: `
              + 'expected the number of ballots that can be counted against the candidates.',
            );
          },
        },),
      ],
    },),
  ],
},);
