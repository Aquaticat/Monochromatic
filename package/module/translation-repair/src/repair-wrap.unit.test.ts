/**
 * Tests for wrapping what the repair lane produced.
 *
 * WHAT THESE PIN is which outcomes are touched. `assembleRepair` builds the
 * replacements AND the lane wordings out of one outcome list, and the delivery
 * invariant splices the ledger's rows over the archive and demands the result
 * equal the document the lane returned, byte for byte. Wrapping one consumer
 * and not the other breaks that, so the list is wrapped once before either
 * reads it.
 *
 * The second thing they pin is the demotion. A passage differing from the
 * archive only in its wrapping becomes the archive once wrapped, and an outcome
 * still claiming a change there fails `assertReplacementsChange` and the
 * coherence rule that a replacement's wording may not be the archive's own. No
 * slice in the pool settled 2026-08-18 does this, so the case is constructed
 * here rather than observed.
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
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type ChunkPair,
  wrapRepairOutcomes,
} from '../dist/final/node/index.mjs';

/**
 * Logger these hand to the lane, whose output is not what is under test.
 */
const l = tagged({ tag: 'repair-wrap-test', },);

/**
 * Builds one prepared pair carrying the archive's wording at an index.
 *
 * @param chunkIndex - slice index
 *
 * @param incumbentText - archive wording there
 *
 * @returns Pair shaped as preparation produces one
 *
 * @example
 * ```ts
 * const pair = pairOf({ chunkIndex: 0, incumbentText: 'The cat naps.', },);
 * ```
 */
function pairOf(
  {
    chunkIndex,
    incumbentText,
  }: {
    readonly chunkIndex: number;
    readonly incumbentText: string;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 1,
      text: `source of slice ${String(chunkIndex,)}`,
    },
    target: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: incumbentText.length,
      text: incumbentText,
    },
  } as ChunkPair;
}

/**
 * Builds one settled repair outcome.
 *
 * MINIMAL BY DESIGN: the wrap reads three fields and carries the rest through
 * untouched, so a fixture carrying the whole contract would test the spread
 * rather than the decision.
 *
 * @param chunkIndex - slice index
 *
 * @param repairedText - wording this lane produced
 *
 * @param changed - whether it claims to differ from the archive
 *
 * @returns Outcome shaped as the lane settles one
 *
 * @example
 * ```ts
 * const outcome = outcomeOf({ chunkIndex: 0, repairedText: 'It naps.', changed: true, },);
 * ```
 */
function outcomeOf(
  {
    chunkIndex,
    repairedText,
    changed,
  }: {
    readonly chunkIndex: number;
    readonly repairedText: string;
    readonly changed: boolean;
  },
): Parameters<typeof wrapRepairOutcomes>[0]['outcomes'][number] {
  return {
    chunkIndex,
    repairedText,
    changed,
    issues: [],
    resolvedIssueIds: [],
    claimAttributions: [],
  } as unknown as Parameters<typeof wrapRepairOutcomes>[0]['outcomes'][number];
}

await describe({
  name: wrapRepairOutcomes.name,
  children: [
    it({
      name: 'WRAPS WORDING THE LANE PRODUCED, which is the reason this exists: a model returns a '
        + 'passage as one line and the archive it replaces was wrapped',
      fn: async () => {
        /**
         * One changed outcome, flat as a model wrote it.
         */
        const wrapped = wrapRepairOutcomes({
          slices: [pairOf({
            chunkIndex: 0,
            incumbentText: 'The cat sleeps on the sill.',
          },),],
          outcomes: [outcomeOf({
            chunkIndex: 0,
            repairedText: 'The tabby naps on the sill. It wakes at dusk.',
            changed: true,
          },),],
          l,
        },);

        expect(wrapped[0]?.repairedText,).toBe('The tabby naps on the sill.\nIt wakes at dusk.',);
        expect(wrapped[0]?.changed,).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES AN UNCHANGED OUTCOME BYTE-IDENTICAL, because it carries the archive’s own '
        + 'wording: wrapping a retention would report a change nobody decided on, and both the '
        + 'assembly assertion and the delivery coherence rule refuse exactly that',
      fn: async () => {
        /**
         * Archive wording that the rule WOULD break, were it asked to.
         */
        const incumbentText = 'The cat sleeps on the sill. It wakes at dusk.';

        const wrapped = wrapRepairOutcomes({
          slices: [pairOf({
            chunkIndex: 0,
            incumbentText,
          },),],
          outcomes: [outcomeOf({
            chunkIndex: 0,
            repairedText: incumbentText,
            changed: false,
          },),],
          l,
        },);

        expect(wrapped[0]?.repairedText,).toBe(incumbentText,);
        expect(wrapped[0]?.changed,).toBe(false,);
      },
    },),

    it({
      name: 'DEMOTES TO A RETENTION when wrapping is all that separated the wording from the '
        + 'archive. An outcome still claiming a change there fails the assembly assertion, so the '
        + 'flag is re-derived from the wrapped text rather than carried forward',
      fn: async () => {
        /**
         * Archive wording, already written as the rule would write it.
         */
        const incumbentText = 'It naps.\nIt wakes.';

        const wrapped = wrapRepairOutcomes({
          slices: [pairOf({
            chunkIndex: 0,
            incumbentText,
          },),],
          outcomes: [outcomeOf({
            chunkIndex: 0,
            repairedText: 'It naps. It wakes.',
            changed: true,
          },),],
          l,
        },);

        expect(wrapped[0]?.repairedText,).toBe(incumbentText,);
        expect(wrapped[0]?.changed,).toBe(false,);
      },
    },),

    it({
      name: 'KEEPS A SLICE THE ARCHIVE NEVER TRANSLATED as a change, since filling an empty '
        + 'passage differs from it however the filling is wrapped',
      fn: async () => {
        const wrapped = wrapRepairOutcomes({
          slices: [pairOf({
            chunkIndex: 0,
            incumbentText: '',
          },),],
          outcomes: [outcomeOf({
            chunkIndex: 0,
            repairedText: 'The tabby naps. It wakes.',
            changed: true,
          },),],
          l,
        },);

        expect(wrapped[0]?.changed,).toBe(true,);
        expect(wrapped[0]?.repairedText,).toBe('The tabby naps.\nIt wakes.',);
      },
    },),

    it({
      name: 'RETURNS AN EMPTY LEDGER as no outcomes rather than failing, since a lane that '
        + 'produced nothing is an ordinary run',
      fn: async () => {
        expect(wrapRepairOutcomes({
          slices: [],
          outcomes: [],
          l,
        },).length,).toBe(0,);
      },
    },),
  ],
},);
