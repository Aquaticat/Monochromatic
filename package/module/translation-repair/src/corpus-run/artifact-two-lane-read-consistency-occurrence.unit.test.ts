/**
 Tests for reading one place of a recorded consistency group: its label, slice,
 offsets and line, the slot offsets of a frame's place, how its rendering was
 found, and what became of it. Each is read key by key, so every case breaks
 one valid record in one way and pins the whole refusal.

 What the places say beside the kind of repeat and the slices the comparison
 names is the fit check's question
 (`artifact-two-lane-read-consistency-fit.unit.test.ts`).

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseConsistencyOccurrence, } from '../../dist/final/node/index.mjs';
import { refusalTextOf, } from './consistency-refusal.test-fixture.ts';

/**
 The count refusal's reason, which every offset, line and slice index shares.
 */
const NOT_A_COUNT = 'a non-negative integer no larger than JSON carries exactly';

/**
 The refusal text of the reason an offset pair or a line is out of order.
 */
const OUT_OF_ORDER = 'ArtifactParseError: artifact parse failed at cat.occurrences[0]: '
  + 'expected a place that ends after it starts, on a line counted from one.';

/**
 A place whose rendering was located, as the writer records it.
 */
const LOCATED = {
  label: 'OCCURRENCE 1',
  sliceIndex: 0,
  startOffset: 6,
  endOffset: 18,
  line: 3,
  rendering: { kind: 'located', quote: 'The cat naps.', },
  outcome: 'chosen',
};

/**
 A place of a frame, whose rendering was located with its slot.
 */
const FRAMED = {
  ...LOCATED,
  slotStartOffset: 9,
  slotEndOffset: 11,
  rendering: { kind: 'located', quote: 'So this cat is a lazy little treasure.', slot: 'lazy', },
};

/**
 A place whose rendering could not be pinned down.
 */
const UNLOCATED = {
  ...LOCATED,
  rendering: { kind: 'unlocated', reason: 'not-found', },
  outcome: 'unlocated',
};

/**
 Every reason a rendering can fail to be located.
 */
const UNLOCATED_REASONS = [
  'not-asked',
  'no-english',
  'no-agreement',
  'empty',
  'not-found',
  'ambiguous',
  'markup',
  'overlaps-another',
  'slot-no-agreement',
  'slot-empty',
  'slot-not-found',
  'slot-ambiguous',
  'slot-whole',
];

/**
 Every outcome a place can have.
 */
const OUTCOMES = [
  'chosen',
  'replaced',
  'consistent',
  'kept-context',
  'kept-floor',
  'overlapped',
  'unlocated',
  'untouched',
];

/**
 The text of the refusal a place raises.

 @param value - recorded place

 @returns The refusal as text

 @example
 ```ts
 const text = placeRefusal({ value: 'naps', },);
 ```
 */
function placeRefusal({ value, }: { readonly value: unknown; },): string {
  return refusalTextOf({
    read: function readsPlace(): unknown {
      return parseConsistencyOccurrence({
        value,
        path: 'cat.occurrences[0]',
      },);
    },
  },);
}

/**
 A place read as written.

 @param value - recorded place

 @returns What the reader makes of it

 @example
 ```ts
 const place = placeRead({ value: LOCATED, },);
 ```
 */
function placeRead({ value, }: { readonly value: unknown; },): unknown {
  return parseConsistencyOccurrence({
    value,
    path: 'cat.occurrences[0]',
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: parseConsistencyOccurrence.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS A PLACE LOCATED WITH NO SLOT, A PLACE OF A FRAME LOCATED WITH ITS SLOT, AND AN UNLOCATED PLACE, as written',
          fn: async () => {
            expect([LOCATED, FRAMED, UNLOCATED,].map(function read(value,): unknown {
              return placeRead({ value, },);
            },),).toEqual([LOCATED, FRAMED, UNLOCATED,],);
          },
        },),
        it({
          name: 'READS A PLACE FOR EACH REASON ITS RENDERING WAS NOT LOCATED',
          fn: async () => {
            expect(UNLOCATED_REASONS.map(function read(reason,): unknown {
              return placeRead({ value: { ...UNLOCATED, rendering: { kind: 'unlocated', reason, }, }, },);
            },),).toEqual(UNLOCATED_REASONS.map(function written(reason,): unknown {
              return { ...UNLOCATED, rendering: { kind: 'unlocated', reason, }, };
            },),);
          },
        },),
        it({
          name: 'READS A PLACE FOR EACH OUTCOME A PLACE CAN HAVE',
          fn: async () => {
            expect(OUTCOMES.map(function read(outcome,): unknown {
              return placeRead({ value: { ...LOCATED, outcome, }, },);
            },),).toEqual(OUTCOMES.map(function written(outcome,): unknown {
              return { ...LOCATED, outcome, };
            },),);
          },
        },),
        it({
          name: 'REFUSES A PLACE THAT IS NOT AN OBJECT AND A KEY THE PLACE DOES NOT HAVE, naming the path',
          fn: async () => {
            expect([
              placeRefusal({ value: 'naps', },),
              placeRefusal({ value: { ...LOCATED, slot: 'lazy', }, },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.occurrences[0]: expected an object.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].slot: expected no key here beyond label, '
              + 'sliceIndex, startOffset, endOffset, line, slotStartOffset, slotEndOffset, rendering, outcome.',
            ],);
          },
        },),
        it({
          name: 'REFUSES AN OFFSET, A LINE OR A SLICE THAT IS NOT A COUNT, whether absent, text, negative or fractional',
          fn: async () => {
            expect([
              placeRefusal({ value: { ...LOCATED, startOffset: '6', }, },),
              placeRefusal({ value: { ...LOCATED, endOffset: -1, }, },),
              placeRefusal({ value: { ...LOCATED, line: 1.5, }, },),
              placeRefusal({ value: { ...LOCATED, sliceIndex: -1, }, },),
              placeRefusal({ value: { ...LOCATED, sliceIndex: undefined, }, },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].startOffset: expected a number.',
              `ArtifactParseError: artifact parse failed at cat.occurrences[0].endOffset: expected ${NOT_A_COUNT}.`,
              `ArtifactParseError: artifact parse failed at cat.occurrences[0].line: expected ${NOT_A_COUNT}.`,
              `ArtifactParseError: artifact parse failed at cat.occurrences[0].sliceIndex: expected ${NOT_A_COUNT}.`,
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].sliceIndex: expected a number.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A PLACE THAT ENDS WHERE IT STARTS OR BEFORE IT, and a place on a line before the first',
          fn: async () => {
            expect([
              placeRefusal({ value: { ...LOCATED, endOffset: LOCATED.startOffset, }, },),
              placeRefusal({ value: { ...LOCATED, endOffset: LOCATED.startOffset - 1, }, },),
              placeRefusal({ value: { ...LOCATED, line: 0, }, },),
            ],).toEqual([OUT_OF_ORDER, OUT_OF_ORDER, OUT_OF_ORDER,],);
          },
        },),
        it({
          name: 'READS A PLACE THAT ENDS ONE CHARACTER AFTER IT STARTS ON THE FIRST LINE',
          fn: async () => {
            expect(placeRead({
              value: {
                ...LOCATED,
                startOffset: 0,
                endOffset: 1,
                line: 1,
              },
            },),).toEqual({
              ...LOCATED,
              startOffset: 0,
              endOffset: 1,
              line: 1,
            },);
          },
        },),
        it({
          name: 'REFUSES A LABEL THAT IS NOT TEXT AND SLOT OFFSETS THAT ARE NOT COUNTS',
          fn: async () => {
            expect([
              placeRefusal({ value: { ...LOCATED, label: 1, }, },),
              placeRefusal({ value: { ...FRAMED, slotStartOffset: '9', }, },),
              placeRefusal({ value: { ...FRAMED, slotEndOffset: -2, }, },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].label: expected a string.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].slotStartOffset: expected a number.',
              `ArtifactParseError: artifact parse failed at cat.occurrences[0].slotEndOffset: expected ${NOT_A_COUNT}.`,
            ],);
          },
        },),
        it({
          name: 'REFUSES A RENDERING THAT IS NOT AN OBJECT AND A KIND OUTSIDE THE VOCABULARY, naming the path',
          fn: async () => {
            expect([
              placeRefusal({ value: { ...LOCATED, rendering: 'naps', }, },),
              placeRefusal({ value: { ...LOCATED, rendering: { kind: 'maybe', }, }, },),
              placeRefusal({ value: { ...LOCATED, rendering: { kind: 3, }, }, },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering: expected an object.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.kind: '
              + 'expected one of located, unlocated.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.kind: expected a string.',
            ],);
          },
        },),
        it({
          name: 'REFUSES AN UNLOCATED RENDERING THAT CARRIES A QUOTE AND A REASON OUTSIDE THE VOCABULARY, naming every reason',
          fn: async () => {
            expect([
              placeRefusal({ value: { ...UNLOCATED, rendering: { kind: 'unlocated', reason: 'not-found', quote: 'x', }, }, },),
              placeRefusal({ value: { ...UNLOCATED, rendering: { kind: 'unlocated', reason: 'shy', }, }, },),
              placeRefusal({ value: { ...UNLOCATED, rendering: { kind: 'unlocated', }, }, },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.quote: '
              + 'expected no key here beyond kind, reason.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.reason: expected one of '
              + `${UNLOCATED_REASONS.join(', ',)}.`,
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.reason: expected a string.',
            ],);
          },
        },),
        it({
          name: 'REFUSES A LOCATED RENDERING THAT CARRIES A REASON, HAS NO QUOTE, OR HAS A QUOTE OR A SLOT THAT IS NOT TEXT',
          fn: async () => {
            expect([
              placeRefusal({
                value: { ...LOCATED, rendering: { kind: 'located', quote: 'The cat naps.', reason: 'not-found', }, },
              },),
              placeRefusal({ value: { ...LOCATED, rendering: { kind: 'located', }, }, },),
              placeRefusal({ value: { ...LOCATED, rendering: { kind: 'located', quote: 4, }, }, },),
              placeRefusal({
                value: { ...LOCATED, rendering: { kind: 'located', quote: 'The cat naps.', slot: 4, }, },
              },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.reason: '
              + 'expected no key here beyond kind, quote, slot.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.quote: expected a string.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.quote: expected a string.',
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].rendering.slot: expected a string.',
            ],);
          },
        },),
        it({
          name: 'REFUSES AN OUTCOME OUTSIDE THE VOCABULARY, naming every outcome, and an outcome that is not text',
          fn: async () => {
            expect([
              placeRefusal({ value: { ...LOCATED, outcome: 'liked', }, },),
              placeRefusal({ value: { ...LOCATED, outcome: 4, }, },),
            ],).toEqual([
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].outcome: expected one of '
              + `${OUTCOMES.join(', ',)}.`,
              'ArtifactParseError: artifact parse failed at cat.occurrences[0].outcome: expected a string.',
            ],);
          },
        },),
      ],
    },),
  ],
},);
