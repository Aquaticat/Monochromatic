/**
 Tests for checking the places of a recorded group beside the kind of repeat
 and the slices the comparison names: labels in order, slices that exist, slot
 offsets and a slot in the rendering on the places of a frame alone, and a
 bench that was not asked meaning every place says so.

 What the ballots say is the coherence check's question
 (`artifact-two-lane-read-consistency-coherence.unit.test.ts`).

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
  type ArtifactConsistencyGroup,
  type ArtifactConsistencyOccurrence,
  assertGroupFits,
} from '../../dist/final/node/index.mjs';
import {
  frameGroup,
  napsGroup,
  withPlace,
  withPlaceReplaced,
} from './consistency-group.test-fixture.ts';
import { refusalTextOf, } from './consistency-refusal.test-fixture.ts';

/**
 Slices the cat page's comparison names.
 */
const SLICES: ReadonlySet<number> = new Set([0, 1, 2,],);

/**
 The text of the refusal the fit check raises for a group.

 @param group - the group read

 @param sliceIndexes - slices the comparison names

 @returns The refusal as text

 @example
 ```ts
 const text = fitRefusal({ group: napsGroup(), sliceIndexes: SLICES, },);
 ```
 */
function fitRefusal(
  {
    group,
    sliceIndexes = SLICES,
  }: {
    readonly group: ArtifactConsistencyGroup;
    readonly sliceIndexes?: ReadonlySet<number>;
  },
): string {
  return refusalTextOf({
    read: function checksFit(): unknown {
      return assertGroupFits({
        group,
        path: 'cat.groups[0]',
        sliceIndexes,
      },);
    },
  },);
}

/**
 What the fit check makes of a group it accepts.

 @param group - the group read

 @returns Nothing, since the check only refuses

 @example
 ```ts
 const nothing = fitRead({ group: napsGroup(), },);
 ```
 */
function fitRead({ group, }: { readonly group: ArtifactConsistencyGroup; },): unknown {
  return assertGroupFits({
    group,
    path: 'cat.groups[0]',
    sliceIndexes: SLICES,
  },);
}

/**
 A place without its slot offsets, as a maximal repeat's place is written.

 @param place - the place

 @returns The place with no slot offset

 @example
 ```ts
 const bare = withoutSlotOffsets({ place: frameGroup().occurrences[0], },);
 ```
 */
function withoutSlotOffsets(
  { place, }: { readonly place: ArtifactConsistencyOccurrence; },
): ArtifactConsistencyOccurrence {
  return {
    label: place.label,
    sliceIndex: place.sliceIndex,
    startOffset: place.startOffset,
    endOffset: place.endOffset,
    line: place.line,
    rendering: place.rendering,
    outcome: place.outcome,
  };
}

/**
 The group a bench was not asked about, every place saying so.

 @param reason - why the bench was not asked

 @param outcome - the outcome every place carries

 @param places - how many places the group has

 @returns The recorded group

 @example
 ```ts
 const group = unaskedGroup({ reason: 'consistent', outcome: 'consistent', places: 2, },);
 ```
 */
function unaskedGroup(
  {
    reason,
    outcome,
    places,
  }: {
    readonly reason: 'too-few-placed' | 'no-english' | 'consistent';
    readonly outcome: 'consistent' | 'untouched';
    readonly places: number;
  },
): ArtifactConsistencyGroup {
  /**
   The asked group, whose places the unasked group keeps in number.
   */
  const asked = napsGroup();
  return {
    ...asked,
    occurrences: asked.occurrences
      .slice(
        0,
        places,
      )
      .map(function saysNotAsked(place,): ArtifactConsistencyOccurrence {
        return {
          ...place,
          rendering: { kind: 'unlocated', reason: 'not-asked', },
          outcome,
        };
      },),
    verdict: { kind: 'not-asked', reason, },
  };
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: assertGroupFits.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'ACCEPTS A REPEATED SENTENCE IN THREE PLACES AND A REFRAIN WITH A SLOT IN EACH, the bench asked about both',
          fn: async () => {
            expect([napsGroup(), frameGroup(),].map(function fits(group,): unknown {
              return fitRead({ group, },);
            },),).toEqual([undefined, undefined,],);
          },
        },),
        it({
          name: 'REFUSES A PLACE LABELLED OUT OF ORDER, naming the label its position carries',
          fn: async () => {
            expect(fitRefusal({
              group: withPlace({ group: napsGroup(), position: 1, over: { label: 'OCCURRENCE 3', }, },),
            },),).toBe(
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1].label: '
              + 'expected the label OCCURRENCE 2, since the places are labelled in order.',
            );
          },
        },),
        it({
          name: 'REFUSES A PLACE IN A SLICE THE COMPARISON DOES NOT NAME',
          fn: async () => {
            expect(fitRefusal({ group: napsGroup(), sliceIndexes: new Set([0, 1,],), },),).toBe(
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[2].sliceIndex: '
              + 'expected a slice the comparison names.',
            );
          },
        },),
        it({
          name: 'REFUSES A PLACE OF A FRAME WITHOUT BOTH SLOT OFFSETS, whether it has neither, only the start or only the end',
          fn: async () => {
            /**
             The frame's second place with only the start of its slot, and with only its end.
             */
            const [, second,] = frameGroup().occurrences;
            const bareSecond = withoutSlotOffsets({ place: nonNullishOrThrow(second,), },);
            const startOnly = {
              ...bareSecond,
              slotStartOffset: 25,
            };
            const endOnly = {
              ...bareSecond,
              slotEndOffset: 27,
            };
            expect([
              fitRefusal({
                group: {
                  ...frameGroup(),
                  occurrences: frameGroup().occurrences
                    .map(function bare(place,): ArtifactConsistencyOccurrence {
                      return withoutSlotOffsets({ place, },);
                    },),
                },
              },),
              fitRefusal({ group: withPlaceReplaced({ group: frameGroup(), position: 1, place: startOnly, },), },),
              fitRefusal({ group: withPlaceReplaced({ group: frameGroup(), position: 1, place: endOnly, },), },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[0]: '
              + 'expected slot offsets on a place of a frame, and on no other.',
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1]: '
              + 'expected slot offsets on a place of a frame, and on no other.',
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1]: '
              + 'expected slot offsets on a place of a frame, and on no other.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A PLACE OF A REPEATED RUN CARRYING BOTH SLOT OFFSETS',
          fn: async () => {
            expect(fitRefusal({
              group: withPlace({ group: napsGroup(), position: 1, over: { slotStartOffset: 1, slotEndOffset: 2, }, },),
            },),).toBe(
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1]: '
              + 'expected slot offsets on a place of a frame, and on no other.',
            );
          },
        },),
        it({
          name: 'REFUSES A PLACE OF A REPEATED RUN CARRYING ONLY THE START OF A SLOT OR ONLY ITS END',
          fn: async () => {
            expect([
              { slotStartOffset: 1, },
              { slotEndOffset: 2, },
            ].map(function refusedFor(over,): string {
              return fitRefusal({ group: withPlace({ group: napsGroup(), position: 1, over, }), },);
            },),).toEqual([
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1]: '
              + 'expected slot offsets on a place of a frame, and on no other.',
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1]: '
              + 'expected slot offsets on a place of a frame, and on no other.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A LOCATED RENDERING OF A FRAME WITH NO SLOT AND A LOCATED RENDERING OF A REPEATED RUN WITH ONE',
          fn: async () => {
            expect([
              fitRefusal({
                group: withPlace({
                  group: frameGroup(),
                  position: 1,
                  over: { rendering: { kind: 'located', quote: 'So this cat must be a chubby little treasure.', }, },
                }),
              },),
              fitRefusal({
                group: withPlace({
                  group: napsGroup(),
                  position: 1,
                  over: { rendering: { kind: 'located', quote: 'The kitten naps', slot: 'kitten', }, },
                }),
              },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1].rendering: '
              + 'expected a slot in the rendering of a place of a frame, and in no other.',
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1].rendering: '
              + 'expected a slot in the rendering of a place of a frame, and in no other.',
            ],);
          },
        },),
        it({
          name: 'ACCEPTS AN UNLOCATED RENDERING OF A FRAME WITH NO SLOT, since there is nothing located to hold one',
          fn: async () => {
            expect(fitRead({
              group: withPlace({
                group: frameGroup(),
                position: 1,
                over: { rendering: { kind: 'unlocated', reason: 'not-found', }, outcome: 'unlocated', },
              }),
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'ACCEPTS A BENCH NOT ASKED WHEN EVERY PLACE SAYS SO: consistent places for a group that read alike, untouched '
            + 'places for a group with no English and a group of too few places',
          fn: async () => {
            expect([
              unaskedGroup({ reason: 'consistent', outcome: 'consistent', places: 3, }),
              unaskedGroup({ reason: 'no-english', outcome: 'untouched', places: 3, }),
              unaskedGroup({ reason: 'too-few-placed', outcome: 'untouched', places: 1, }),
              unaskedGroup({ reason: 'too-few-placed', outcome: 'untouched', places: 0, }),
            ].map(function fits(group,): unknown {
              return fitRead({ group, },);
            },),).toEqual([undefined, undefined, undefined, undefined,],);
          },
        },),
        it({
          name: 'REFUSES A GROUP WITH FEWER THAN TWO PLACES THAT THE BENCH WAS ASKED ABOUT OR SKIPPED FOR ANOTHER REASON THAN '
            + 'TOO FEW, since a group with fewer is skipped for too few',
          fn: async () => {
            const refusal = 'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences: '
              + 'expected at least two places, since a group with fewer is skipped for too few.';
            expect([
              { ...napsGroup(), occurrences: napsGroup().occurrences.slice(0, 1,), },
              unaskedGroup({ reason: 'consistent', outcome: 'consistent', places: 1, }),
              unaskedGroup({ reason: 'no-english', outcome: 'untouched', places: 1, }),
              unaskedGroup({ reason: 'no-english', outcome: 'untouched', places: 0, }),
            ].map(function refusedFor(group,): string {
              return fitRefusal({ group, },);
            },),).toEqual([refusal, refusal, refusal, refusal,],);
          },
        },),
        it({
          name: 'ACCEPTS A GROUP WHOSE HANDLING FAILED WITH NO PLACE AT ALL, as the reader has always read one',
          fn: async () => {
            expect(fitRead({
              group: {
                ...unaskedGroup({ reason: 'too-few-placed', outcome: 'untouched', places: 0, }),
                verdict: { kind: 'failed', detail: 'refused by ConsistencyInvariantError', },
              },
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'ACCEPTS A GROUP WHOSE HANDLING FAILED WHEN EVERY PLACE IS UNTOUCHED AND SAYS THE BENCH WAS NOT ASKED',
          fn: async () => {
            expect(fitRead({
              group: {
                ...unaskedGroup({ reason: 'too-few-placed', outcome: 'untouched', places: 3, }),
                verdict: { kind: 'failed', detail: 'refused by ConsistencyInvariantError', },
              },
            },),).toBeUndefined();
          },
        },),
        it({
          name: 'REFUSES A PLACE OF A BENCH NOT ASKED THAT SAYS MORE THAN SO: another outcome, a located rendering, or another '
            + 'reason for no rendering',
          fn: async () => {
            const consistent = unaskedGroup({ reason: 'consistent', outcome: 'consistent', places: 3, });
            const untouched = unaskedGroup({ reason: 'no-english', outcome: 'untouched', places: 3, });
            expect([
              fitRefusal({ group: withPlace({ group: consistent, position: 1, over: { outcome: 'untouched', }, }), },),
              fitRefusal({ group: withPlace({ group: untouched, position: 2, over: { outcome: 'consistent', }, }), },),
              fitRefusal({
                group: withPlace({
                  group: untouched,
                  position: 0,
                  over: { rendering: { kind: 'located', quote: 'The cat naps.', }, },
                }),
              },),
              fitRefusal({
                group: withPlace({
                  group: untouched,
                  position: 0,
                  over: { rendering: { kind: 'unlocated', reason: 'no-english', }, },
                }),
              },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[1]: expected a place with outcome '
              + 'consistent and no rendering looked for, since the bench was not asked.',
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[2]: expected a place with outcome '
              + 'untouched and no rendering looked for, since the bench was not asked.',
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[0]: expected a place with outcome '
              + 'untouched and no rendering looked for, since the bench was not asked.',
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[0]: expected a place with outcome '
              + 'untouched and no rendering looked for, since the bench was not asked.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A PLACE OF A FAILED GROUP THAT CLAIMS THE PLACES READ ALIKE',
          fn: async () => {
            expect(fitRefusal({
              group: {
                ...unaskedGroup({ reason: 'consistent', outcome: 'consistent', places: 3, }),
                verdict: { kind: 'failed', detail: 'refused by ConsistencyInvariantError', },
              },
            },),).toBe(
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences[0]: expected a place with outcome '
              + 'untouched and no rendering looked for, since the bench was not asked.',
            );
          },
        },),
        it({
          name: 'REFUSES A GROUP SKIPPED FOR TOO FEW PLACES THAT HAS TWO, and reads the same count in a group skipped for '
            + 'another reason',
          fn: async () => {
            expect(fitRefusal({
              group: unaskedGroup({ reason: 'too-few-placed', outcome: 'untouched', places: 2, }),
            },),).toBe(
              'ArtifactParseError: artifact parse failed at cat.groups[0].occurrences: '
              + 'expected fewer than two places, since the group was skipped for too few.',
            );
            expect(fitRead({
              group: unaskedGroup({ reason: 'no-english', outcome: 'untouched', places: 2, }),
            },),).toBeUndefined();
          },
        },),
      ],
    },),
  ],
},);
