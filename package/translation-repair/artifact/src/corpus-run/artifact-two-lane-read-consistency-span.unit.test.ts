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

import type { ConsistencyWinner, } from '@monochromatic-dev/translation-repair-consistency';
import {
  type ArtifactConsistencyBallot,
  type ArtifactConsistencyCarry,
  type ArtifactConsistencyGroup,
  type ArtifactConsistencyOccurrence,
  assertSpanGroupCoherent,
} from '../../dist/final/node/index.mjs';
import { refusalTextOf, } from './consistency-refusal.test-fixture.ts';

/**
 Where the group sits in the section, for the refusals.
 */
const GROUP = 'cat.consistency.groups[0]';

/**
 The refusal of a splice candidate for the second place of a generation seventeen group, which code could not have moved.
 */
const NO_SPLICE_FOR_OCCURRENCE_TWO = `ArtifactParseError: artifact parse failed at ${GROUP}.carries: `
  + 'expected no splice candidate for OCCURRENCE 2, whose words code cannot move: the frame or the chosen frame has no '
  + 'slot to move them by, a single mark beside the words differs between the two places, the quotation marks '
  + 'inside the words differ, the two hold a different number of block breaks (a blank line, or a line break the '
  + 'Markdown parse reads as a new block), or a single mark stands beside the words and the chosen words end on that '
  + 'side in another class of character than the receiving words, a letter or a digit against anything else.';

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

 @param generation - generation the section was written under, which says whether the marks beside the words were recorded

 @returns The refusal as text

 @example
 ```ts
 const text = coherenceRefusal({ group: groupOf(), },);
 ```
 */
function coherenceRefusal(
  {
    group,
    generation = 17,
  }: {
    readonly group: AskedGroup;
    readonly generation?: 16 | 17;
  },
): string {
  return refusalTextOf({
    read: function recounts(): unknown {
      return assertSpanGroupCoherent({
        group,
        path: GROUP,
        generation,
      },);
    },
  },);
}

/**
 A group of three places in which the chosen words are carried to two places by one bench record: the second place
 holds an apostrophe the chosen place does not, so code cannot move the words there, and the third holds none.

 @param outcomes - what became of the second and the third place

 @returns The group, the carries one for each of the two places and both the same record

 @example
 ```ts
 const group = partlyCarriedGroup({ outcomes: ['kept-current', 'replaced',], },);
 ```
 */
function partlyCarriedGroup(
  { outcomes, }: { readonly outcomes: readonly [ArtifactConsistencyOccurrence['outcome'], ArtifactConsistencyOccurrence['outcome'],]; },
): AskedGroup {
  return groupOf({
    over: {
      verdict: verdictWith({
        ballots: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotFor(seat,): ArtifactConsistencyBallot {
          return ballotOf({
            seat,
            over: {
              quotes: [
                { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
                { label: 'OCCURRENCE 2', quote: 'the kitten naps', },
                { label: 'OCCURRENCE 3', quote: 'the kitten naps', },
              ],
            },
          },);
        },),
      },),
      occurrences: [
        placeOf({ position: 0, },),
        placeOf({
          position: 1,
          over: {
            rendering: { kind: 'located', quote: 'the kitten naps', start: 6, markAfter: '\'', },
            outcome: outcomes[0],
          },
        },),
        {
          ...placeOf({ position: 1, },),
          label: 'OCCURRENCE 3',
          sliceIndex: 2,
          rendering: { kind: 'located', quote: 'the kitten naps', start: 6, },
          outcome: outcomes[1],
          // A place the splice would move, left as it was, records why.
          ...((outcomes[1] === 'kept-current') ? { keptBecause: 'edge-reading-changes' as const, } : {}),
        },
      ],
      carries: [CARRY, { ...CARRY, label: 'OCCURRENCE 3', },],
    },
  });
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
            expect(assertSpanGroupCoherent({
              group: groupOf(),
              path: GROUP,
              generation: 17,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'RECOUNTS BALLOTS THAT COPIED A MARK BESIDE THEIR WORDS BY THE WORDS ALONE, the same in generation sixteen, which '
            + 'recorded no marks, and in generation seventeen, whether or not the marks the English holds were recorded',
          fn: async () => {
            const copying = [ballotOf({ seat: 'hyper-cat', over: { quotes: [
              { label: 'OCCURRENCE 1', quote: '‘The cat naps’', },
              { label: 'OCCURRENCE 2', quote: '‘the kitten naps’', },
            ], }, },), ballotOf({ seat: 'bedrock-cat', over: { quotes: [
              { label: 'OCCURRENCE 1', quote: '‘The cat naps', },
              { label: 'OCCURRENCE 2', quote: 'the kitten naps’', },
            ], }, },), ballotOf({ seat: 'synthetic-cat', over: { quotes: [
              { label: 'OCCURRENCE 1', quote: 'The cat naps', },
              { label: 'OCCURRENCE 2', quote: 'the kitten naps', },
            ], }, },),];
            const bare = groupOf({ over: { verdict: verdictWith({ ballots: copying, },), }, },);
            const marked = groupOf({
              over: {
                verdict: verdictWith({ ballots: copying, },),
                occurrences: [
                  placeOf({
                    position: 0,
                    over: { rendering: { kind: 'located', quote: 'The cat naps', start: 0, markBefore: '‘', markAfter: '’', }, },
                  },),
                  placeOf({
                    position: 1,
                    over: { rendering: { kind: 'located', quote: 'the kitten naps', start: 6, markBefore: '‘', markAfter: '’', }, },
                  },),
                ],
              },
            },);
            expect([
              assertSpanGroupCoherent({ group: bare, path: GROUP, generation: 16, },),
              assertSpanGroupCoherent({ group: bare, path: GROUP, generation: 17, },),
              assertSpanGroupCoherent({ group: marked, path: GROUP, generation: 17, },),
            ],).toEqual([undefined, undefined, undefined,],);
          },
        },),
        it({
          name: 'READS WORDS THAT HOLD ONE APOSTROPHE AT AN EDGE FROM GENERATION SEVENTEEN, which the ballots\' folded words '
            + 'lack and a recount cannot show proven, refuses what the pass could not have put there, and reads the same '
            + 'words in generation sixteen as before',
          fn: async () => {
            /**
             The group with the first place's recorded words replaced and the second place's worded alike at its edges, so
             the splice between them is one code can make.
             */
            function groupWith({ quote, }: { readonly quote: string; },): AskedGroup {
              return groupOf({
                over: {
                  occurrences: [
                    placeOf({ position: 0, over: { rendering: { kind: 'located', quote, start: 0, }, }, },),
                    placeOf({
                      position: 1,
                      over: {
                        rendering: { kind: 'located', quote: quote.replace('The cat naps', 'the kitten naps',), start: 6, },
                      },
                    },),
                  ],
                },
              },);
            }
            const accepted = ['The cat naps’', '’The cat naps', 'The cat naps\'', 'The cat naps\u{02BC}', '’The cat naps’',];
            const refused = ['‘The cat naps', 'The cat naps‘', 'The cat naps’’', 'The cat naps ’', '’’The cat naps', '’ The cat naps',];
            const reason = 'words that hold at most one apostrophe at an edge, directly beside a letter or a digit and never '
              + 'the opening curly single mark, since the pass puts only a proven apostrophe there';
            expect({
              accepted: accepted.map(function readsIt(quote,): unknown {
                return assertSpanGroupCoherent({ group: groupWith({ quote, },), path: GROUP, generation: 17, },);
              },),
              refused: refused.map(function refusedFor(quote,): string {
                return coherenceRefusal({ group: groupWith({ quote, },), },);
              },),
              sixteen: [...accepted, ...refused,].map(function readsIt(quote,): unknown {
                return assertSpanGroupCoherent({ group: groupWith({ quote, },), path: GROUP, generation: 16, },);
              },),
            },).toEqual({
              accepted: accepted.map(function noRefusal(): undefined {
                return undefined;
              },),
              refused: refused.map(function refusal(): string {
                return `ArtifactParseError: artifact parse failed at ${GROUP}.occurrences[0].rendering: expected ${reason}.`;
              },),
              sixteen: [...accepted, ...refused,].map(function noRefusal(): undefined {
                return undefined;
              },),
            },);
          },
        },),
        it({
          name: 'STILL READS WORDS THAT START OR END WITH A LOW, REVERSED OR ANGLE SINGLE MARK, which a quote may name and the '
            + 'locator spans as loose marks of their own, though the record now stores these marks beside a span: only the '
            + 'opening curly mark and the apostrophe-like marks without a letter inside are refused at an edge',
          fn: async () => {
            /**
             The group whose ballots all quote the words with the marks at their edges, and whose places record them.
             */
            function groupWith({ quote, }: { readonly quote: string; },): AskedGroup {
              /**
               The second place's words, worded alike at its edges.
               */
              const second = quote.replace('The cat naps', 'the kitten naps',);
              return groupOf({
                over: {
                  verdict: verdictWith({
                    ballots: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotQuoting(seat,) {
                      return ballotOf({
                        seat,
                        over: {
                          quotes: [
                            { label: 'OCCURRENCE 1', quote, },
                            { label: 'OCCURRENCE 2', quote: second, },
                          ],
                        },
                      },);
                    },),
                  },),
                  occurrences: [
                    placeOf({ position: 0, over: { rendering: { kind: 'located', quote, start: 0, }, }, },),
                    placeOf({ position: 1, over: { rendering: { kind: 'located', quote: second, start: 6, }, }, },),
                  ],
                },
              },);
            }
            const quotes = [
              '‹The cat naps›',
              '\u{201A}The cat naps\u{201B}',
              '‹The cat naps',
              'The cat naps›',
              '\u{201B}The cat naps',
              'The cat naps\u{201A}',
            ];
            expect(quotes.map(function isAccepted(quote,): boolean {
              return assertSpanGroupCoherent({ group: groupWith({ quote, },), path: GROUP, generation: 17, },) === undefined;
            },),).toEqual(quotes.map(function holdsAccepted(): boolean {
              return true;
            },),);
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
          name: 'REFUSES A LOCATED RENDERING THAT IS NOT WORDS A STRICT MAJORITY OF THE QUOTES CONTAIN, though it is a '
            + 'string some ballot gave, and a reason the ballots contradict',
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
              + 'expected words that a strict majority of the quotes naming the place contain, as the place\'s English holds them.',
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
              + 'expected words that a strict majority of the quotes naming the place contain, as the place\'s English holds them.',
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
              return assertSpanGroupCoherent({
                group,
                path: GROUP,
                generation: 17,
              },);
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
              groupOf({ over: { occurrences: [placeOf({ position: 0, },), placeOf({ position: 1, over: { outcome: 'kept-context', }, },),], }, }),
            ].map(function refusedFor(group,): string {
              return coherenceRefusal({ group, },);
            },),).toEqual([
              `ArtifactParseError: artifact parse failed at ${GROUP}.carries: `
              + 'expected a carry for OCCURRENCE 2, which the chosen words are carried to.',
              `ArtifactParseError: artifact parse failed at ${GROUP}.carries: `
              + 'expected one carry for each place the chosen words are carried to, in the order of the places.',
              outcomeRefusal({ place: 1, expected: 'kept-current, for a carry that decided as recorded', }),
              outcomeRefusal({
                place: 1,
                expected: 'replaced, kept-floor, overlapped, kept-current, for a carry that decided as recorded',
              }),
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
            expect(coherenceRefusal({ group: frame, },),).toBe(NO_SPLICE_FOR_OCCURRENCE_TWO,);
            expect(coherenceRefusal({ group: frame, generation: 16, },),).toBe(
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
              generation: 17,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES A SPLICE CANDIDATE FOR A PLACE WHOSE MARKS BESIDE ITS WORDS DIFFER FROM THE CHOSEN PLACE\'S in '
            + 'generation seventeen, which recorded them, and accepts one where the marks agree',
          fn: async () => {
            /**
             The group whose second place records the given fields in its rendering.
             */
            function receivingWith({ over, }: { readonly over: Record<string, unknown>; },): AskedGroup {
              return groupOf({
                over: {
                  occurrences: [
                    placeOf({ position: 0, },),
                    placeOf({
                      position: 1,
                      over: { rendering: { kind: 'located', quote: 'the kitten naps', start: 6, ...over, }, },
                    },),
                  ],
                },
              });
            }
            expect([
              coherenceRefusal({ group: receivingWith({ over: { markAfter: '\'', }, }), },),
              coherenceRefusal({ group: receivingWith({ over: { markBefore: '‘', }, }), },),
            ],).toEqual([NO_SPLICE_FOR_OCCURRENCE_TWO, NO_SPLICE_FOR_OCCURRENCE_TWO,],);
            expect(assertSpanGroupCoherent({
              group: groupOf({
                over: {
                  occurrences: [
                    placeOf({
                      position: 0,
                      over: { rendering: { kind: 'located', quote: 'The cat naps', start: 0, markAfter: '’', }, },
                    },),
                    placeOf({
                      position: 1,
                      over: { rendering: { kind: 'located', quote: 'the kitten naps', start: 6, markAfter: '\'', }, },
                    },),
                  ],
                },
              }),
              path: GROUP,
              generation: 17,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES A SPLICE CANDIDATE FOR A PLACE WHOSE WORDS END IN EMPHASIS BESIDE THE MARK WHILE THE CHOSEN WORDS END IN '
            + 'A LETTER in generation seventeen, which would change which apostrophes a letter attaches, accepts one where '
            + 'both end in a letter, and recounts the same group of generation sixteen as before',
          fn: async () => {
            /**
             The group whose chosen place ends in a letter before an apostrophe and whose second place holds the given words
             before one.
             */
            function groupQuoting({ second, }: { readonly second: string; },): AskedGroup {
              return groupOf({
                over: {
                  verdict: verdictWith({
                    ballots: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotFor(seat,): ArtifactConsistencyBallot {
                      return ballotOf({
                        seat,
                        over: {
                          quotes: [
                            { label: 'OCCURRENCE 1', quote: 'The cats', },
                            { label: 'OCCURRENCE 2', quote: second, },
                          ],
                        },
                      },);
                    },),
                  },),
                  occurrences: [
                    placeOf({
                      position: 0,
                      over: { rendering: { kind: 'located', quote: 'The cats', start: 0, markAfter: '\'', }, },
                    },),
                    placeOf({
                      position: 1,
                      over: { rendering: { kind: 'located', quote: second, start: 6, markAfter: '\'', }, },
                    },),
                  ],
                },
              });
            }
            expect(coherenceRefusal({ group: groupQuoting({ second: 'the **kitten**', }), generation: 17, },),)
              .toBe(NO_SPLICE_FOR_OCCURRENCE_TWO,);
            expect(assertSpanGroupCoherent({
              group: groupQuoting({ second: 'the kittens', }),
              path: GROUP,
              generation: 17,
            },),).toBeUndefined();
            expect(assertSpanGroupCoherent({
              group: groupQuoting({ second: 'the **kitten**', }),
              path: GROUP,
              generation: 16,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES A SPLICE CANDIDATE FOR A PLACE WHOSE QUOTATION MARKS INSIDE ITS WORDS DIFFER FROM THE CHOSEN PLACE\'S '
            + 'in generation seventeen, and recounts the same group of generation sixteen as before, which compared none',
          fn: async () => {
            /**
             Three ballots that quote the second place with quotation marks inside its words.
             */
            const quoting = verdictWith({
              ballots: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotFor(seat,): ArtifactConsistencyBallot {
                return ballotOf({
                  seat,
                  over: {
                    quotes: [
                      { label: 'OCCURRENCE 1', quote: 'The cat naps.', },
                      { label: 'OCCURRENCE 2', quote: 'the "kitten" naps', },
                    ],
                  },
                },);
              },),
            },);
            const group = groupOf({
              over: {
                verdict: quoting,
                occurrences: [
                  placeOf({ position: 0, },),
                  placeOf({
                    position: 1,
                    over: { rendering: { kind: 'located', quote: 'the "kitten" naps', start: 6, }, },
                  },),
                ],
              },
            });
            expect(coherenceRefusal({ group, generation: 17, },),).toBe(NO_SPLICE_FOR_OCCURRENCE_TWO,);
            expect(assertSpanGroupCoherent({
              group,
              path: GROUP,
              generation: 16,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'ACCEPTS A PARTLY CARRIED UNIT IN GENERATION SEVENTEEN: a splice chosen for a carry that serves a place code can '
            + 'move and a place code cannot, the first kept-current and the second replaced',
          fn: async () => {
            expect(assertSpanGroupCoherent({
              group: partlyCarriedGroup({ outcomes: ['kept-current', 'replaced',], },),
              path: GROUP,
              generation: 17,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES, IN GENERATION SEVENTEEN, A PLACE CODE CANNOT MOVE RECORDED AS REPLACED AFTER A SPLICE WAS CHOSEN, and '
            + 'accepts a place code can move recorded as kept-current after it, since the pass may leave it as it was',
          fn: async () => {
            expect(coherenceRefusal({ group: partlyCarriedGroup({ outcomes: ['replaced', 'replaced',], },), },),).toBe(
              outcomeRefusal({ place: 1, expected: 'kept-current, for a carry that decided as recorded', }),
            );
            expect(assertSpanGroupCoherent({
              group: partlyCarriedGroup({ outcomes: ['kept-current', 'kept-current',], },),
              path: GROUP,
              generation: 17,
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES A SPLICE CANDIDATE FOR A PLACE CODE CANNOT MOVE WHEN NO PLACE THAT SHARES ITS RECORD CAN BE SPLICED, '
            + 'even in generation seventeen: the other place of the group was carried under a record of its own',
          fn: async () => {
            /**
             The partly carried unit, with the place code can move recorded under a record that is not the first place's.
             */
            const group = partlyCarriedGroup({ outcomes: ['kept-current', 'replaced',], },);
            expect(coherenceRefusal({
              group: {
                ...group,
                carries: [
                  nonNullishOrThrow(group.carries?.[0],),
                  { ...CARRY, label: 'OCCURRENCE 3', usable: 2, quorum: 1, },
                ],
              },
            },),).toBe(NO_SPLICE_FOR_OCCURRENCE_TWO,);
          },
        },),
        it({
          name: 'ACCEPTS KEPT-CURRENT FOR A PLACE A CHOSEN SPLICE WOULD GIVE AN EDGE APOSTROPHE, and for any place whose plan is '
            + 'replace, since the record holds not the page that decides it; refuses a splice candidate for words that hold '
            + 'another number of block breaks',
          fn: async () => {
            /**
             A group whose chosen place and receiving place are given as the ballots quote them and as their renderings hold them.
             */
            function gainGroup(
              { chosen, receiving, outcome, }: {
                readonly chosen: readonly [string, string];
                readonly receiving: readonly [string, string];
                readonly outcome: ArtifactConsistencyOccurrence['outcome'];
              },
            ): AskedGroup {
              return groupOf({
                over: {
                  verdict: verdictWith({
                    ballots: ['hyper-cat', 'bedrock-cat', 'synthetic-cat',].map(function ballotFor(seat,): ArtifactConsistencyBallot {
                      return ballotOf({
                        seat,
                        over: {
                          quotes: [
                            { label: 'OCCURRENCE 1', quote: chosen[0], },
                            { label: 'OCCURRENCE 2', quote: receiving[0], },
                          ],
                        },
                      },);
                    },),
                  },),
                  occurrences: [
                    placeOf({ position: 0, over: { rendering: { kind: 'located', quote: chosen[1], start: 0, }, }, },),
                    placeOf({
                      position: 1,
                      over: {
                        rendering: { kind: 'located', quote: receiving[1], start: 6, },
                        outcome,
                        // A place left as it was after the splice was chosen records why.
                        ...((outcome === 'kept-current') ? { keptBecause: 'gain-pairs' as const, } : {}),
                      },
                    },),
                  ],
                },
              });
            }
            expect([
              assertSpanGroupCoherent({
                group: gainGroup({
                  chosen: ['the parents', 'the parents’',],
                  receiving: ['the family', 'the family',],
                  outcome: 'kept-current',
                }),
                path: GROUP,
                generation: 17,
              },),
              assertSpanGroupCoherent({
                group: gainGroup({
                  chosen: ['the parents', 'the parents’',],
                  receiving: ['the family', 'the family',],
                  outcome: 'replaced',
                }),
                path: GROUP,
                generation: 17,
              },),
              assertSpanGroupCoherent({
                group: gainGroup({
                  chosen: ['the parents', 'the parents’',],
                  receiving: ['the folks', 'the folks’',],
                  outcome: 'kept-current',
                }),
                path: GROUP,
                generation: 17,
              },),
            ],).toEqual([undefined, undefined, undefined,],);
            expect(coherenceRefusal({
              group: gainGroup({
                chosen: ['the cat\n\nnaps', 'the cat\n\nnaps',],
                receiving: ['the kitten naps', 'the kitten naps',],
                outcome: 'replaced',
              }),
            },),).toBe(NO_SPLICE_FOR_OCCURRENCE_TWO,);
          },
        },),
        it({
          name: 'READS A PARTLY CARRIED UNIT OF GENERATION SIXTEEN BY THE OLD RULE, which compared no marks: the place that '
            + 'only a mark made unavailable is a place the splice replaces, so it cannot be recorded kept-current',
          fn: async () => {
            expect(coherenceRefusal({
              group: partlyCarriedGroup({ outcomes: ['kept-current', 'replaced',], },),
              generation: 16,
            },),).toBe(outcomeRefusal({
              place: 1,
              expected: 'replaced, kept-floor, overlapped, for a carry that decided as recorded',
            },),);
            // Generation sixteen recorded no marks, so a replace plan may not be kept-current there either.
            expect(coherenceRefusal({
              group: partlyCarriedGroup({ outcomes: ['kept-current', 'kept-current',], },),
              generation: 16,
            },),).toBe(outcomeRefusal({
              place: 1,
              expected: 'replaced, kept-floor, overlapped, for a carry that decided as recorded',
            },),);
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
