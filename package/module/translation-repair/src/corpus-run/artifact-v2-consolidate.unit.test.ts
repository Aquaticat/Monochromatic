/**
 * Tests for the record one consolidated slice leaves behind.
 *
 * WHAT THESE PIN is the field that decides what reaches the reader. The stage
 * can settle six different ways and exactly one of them produces wording an
 * assembly should write; the other five leave the slice with whatever the lane
 * contest put there. A record that carried a bare text field per slice would
 * make those indistinguishable, and one of the five, `no-standing-text`,
 * carries the EMPTY STRING, so an assembly reading it naively would delete
 * every slice whose contest named neither lane.
 *
 * The named-absence half is therefore the half with teeth: these assert that a
 * settlement which changes nothing offers NO text to write, rather than
 * offering text that happens to match.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ConsolidationSettlement,
  type ConsolidationTerminal,
  describeConsolidateSlice,
} from '../../dist/final/node/index.mjs';

/**
 * Builds a settlement that left the stage the way a case needs.
 *
 * ONLY THE FIELDS THE RECORD READS are real here. The floor and the judged
 * round are whole objects in production and neither is projected into the
 * record, so building them would assert nothing this file is about.
 *
 * @param terminal - how the slice left the stage
 *
 * @param text - wording the settlement carries, whatever the terminal
 *
 * @returns Settlement shaped as the stage returns one
 *
 * @example
 * ```ts
 * const settlement = settledAs({ terminal: 'consolidated', text: 'The cat naps.', },);
 * ```
 */
function settledAs(
  {
    terminal,
    text,
  }: {
    readonly terminal: ConsolidationTerminal;
    readonly text: string;
  },
): ConsolidationSettlement {
  return {
    terminal,
    text,
    floor: {
      kind: 'proposals',
      validModelIds: ['hf:cat/Cat-A',],
    },
    verdicts: [],
    rewrapped: false,
    demoted: false,
  } as ConsolidationSettlement;
}

/**
 * One passage as a consolidation that won would carry it.
 */
const CONSOLIDATED_TEXT = 'The cat naps in the window.\nShe wakes at four.';

/**
 * Wording already in place, which several terminals hand back unchanged.
 */
const STANDING_TEXT = 'A cat sleeps by the window, and wakes in the afternoon.';

await describe({
  name: describeConsolidateSlice.name,
  children: [
    it({
      name: 'CARRIES THE WORDING TO WRITE when a consolidation won both rounds, which is the whole '
        + 'point of the stage: a third rendering that reached neither the record nor the document '
        + 'would be a round of calls bought to change nothing',
      fn: async () => {
        const slice = describeConsolidateSlice({
          chunkIndex: 4,
          settlement: settledAs({ terminal: 'consolidated', text: CONSOLIDATED_TEXT, },),
        },);

        expect(slice.chunkIndex,).toBe(4,);
        expect(slice.shipped.kind,).toBe('consolidated',);
        if (slice.shipped.kind !== 'consolidated')
          throw new Error('consolidated by construction',);
        expect(slice.shipped.text,).toBe(CONSOLIDATED_TEXT,);
      },
    },),

    it({
      name: 'OFFERS NO TEXT AT ALL FOR A DECLINED CONTEST, which is the case that would delete a '
        + 'slice: the contest named neither lane, so nothing stands, and the settlement carries the '
        + 'empty string as its text. A record with a bare text field would hand an assembly an empty '
        + 'string to write over a passage nobody decided to remove',
      fn: async () => {
        const slice = describeConsolidateSlice({
          chunkIndex: 0,
          settlement: settledAs({ terminal: 'no-standing-text', text: '', },),
        },);

        expect(slice.terminal,).toBe('no-standing-text',);
        expect(slice.shipped.kind,).toBe('unchanged',);
        expect(Object.hasOwn(slice.shipped, 'text',),).toBe(false,);
      },
    },),

    it({
      name: 'OFFERS NO TEXT FOR EVERY TERMINAL THAT KEPT WHAT STOOD, whichever round stopped it. The '
        + 'floor, the judges, the gate and the wrap all end with the standing text in hand, and a '
        + 'record that offered it back would report a decision to change nothing as a change',
      fn: async () => {
        /**
         * Every way the stage can end without producing a replacement.
         */
        const keptStanding: readonly ConsolidationTerminal[] = [
          'incumbent-only',
          'slate-kept-standing',
          'gate-kept-standing',
          'wrap-erased-difference',
        ];

        for (const terminal of keptStanding) {
          const slice = describeConsolidateSlice({
            chunkIndex: 1,
            settlement: settledAs({ terminal, text: STANDING_TEXT, },),
          },);

          expect(slice.terminal,).toBe(terminal,);
          expect(slice.shipped.kind,).toBe('unchanged',);
        }
      },
    },),

    it({
      name: 'READS THE TERMINAL RATHER THAN COMPARING TEXT, so a consolidation that agreed with the '
        + 'standing text everywhere but was still settled as a change is recorded as one. Deriving '
        + 'this from a string comparison would re-decide at the record what the wrap already decided, '
        + 'and the two could disagree',
      fn: async () => {
        const slice = describeConsolidateSlice({
          chunkIndex: 2,
          settlement: settledAs({ terminal: 'consolidated', text: STANDING_TEXT, },),
        },);

        expect(slice.shipped.kind,).toBe('consolidated',);
      },
    },),

    it({
      name: 'NAMES A GATE THAT WAS NEVER ASKED rather than omitting the key, because a missing field '
        + 'and a round deliberately not bought look identical in JSON, and a census of this stage is '
        + 'counting exactly that difference',
      fn: async () => {
        const slice = describeConsolidateSlice({
          chunkIndex: 3,
          settlement: settledAs({ terminal: 'incumbent-only', text: STANDING_TEXT, },),
        },);

        expect(slice.gate.kind,).toBe('not-asked',);
      },
    },),
  ],
},);
