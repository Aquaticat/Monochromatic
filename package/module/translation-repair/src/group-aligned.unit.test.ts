/**
 * Tests for grouping an aligned block pair into budget-bounded slice runs.
 *
 * `groupNodesAligned` had no test. Its contract is a coverage claim: the runs
 * cover every block on both sides exactly once. That claim is what makes the
 * rest of the pipeline safe, because a slice's text is cut from its first to
 * its last offset, so a block left out of a run is NOT left out of the text the
 * critics read. It is only left out of the record of what the slice was built
 * from, which means a claim anchored to it has nowhere to land.
 *
 * So the coverage invariant gets asserted on every shape below rather than
 * once, and the module's own stated exception, an entirely one-sided section,
 * is asserted as the exception it is.
 *
 * Fixtures go through `parseDocument`, so the nodes carry the offsets and text
 * the aligner really scores on rather than offsets I chose to make a case pass.
 * Cat-themed invention throughout.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type AlignedRun,
  type DocumentNode,
  groupNodesAligned,
  parseDocument,
} from '../dist/final/node/index.mjs';

/**
 * Budget large enough that nothing splits, for shape cases.
 */
const WIDE_BUDGET = 100_000;

/**
 * Parses a document and hands back its blocks.
 *
 * @param text - markdown source
 *
 * @returns Blocks in document order
 *
 * @example
 * ```ts
 * const nodes = blocksOf({ text: 'The cat naps.\n', },);
 * ```
 */
function blocksOf({ text, }: { readonly text: string; },): readonly DocumentNode[] {
  return parseDocument({ text, },).nodes;
}

/**
 * Asserts the coverage contract: every block appears exactly once, in order.
 *
 * This is the invariant worth repeating on every shape. A dropped block still
 * reaches the critics through the slice text, so its absence shows up only
 * later, as a claim that cannot anchor.
 *
 * @param runs - grouped runs under test
 *
 * @param sourceNodes - original blocks handed to grouping
 *
 * @param targetNodes - translation blocks handed to grouping
 *
 * @example
 * ```ts
 * expectCoversEveryBlockOnce({ runs, sourceNodes, targetNodes, },);
 * ```
 */
function expectCoversEveryBlockOnce(
  {
    runs,
    sourceNodes,
    targetNodes,
  }: {
    readonly runs: readonly AlignedRun[];
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
  },
): void {
  expect(
    runs.flatMap(function toSourceIds(run,) {
      return run.sourceRun
        .map(function toId(node,) {
          return node.id;
        },);
    },),
  ).toStrictEqual(sourceNodes.map(function toId(node,) {
    return node.id;
  },),);

  expect(
    runs.flatMap(function toTargetIds(run,) {
      return run.targetRun
        .map(function toId(node,) {
          return node.id;
        },);
    },),
  ).toStrictEqual(targetNodes.map(function toId(node,) {
    return node.id;
  },),);
}

/**
 * Original with four paragraphs.
 */
const SOURCE_TEXT = '猫猫在窗台上睡觉。\n\n太阳移动时她会醒来。\n\n'
  + '她追蝴蝶，很喜欢它们。\n\n晚上她在门口等着。\n';

/**
 * Translation with the same four paragraphs.
 */
const TARGET_TEXT = 'The cat sleeps on the windowsill.\n\n'
  + 'She wakes when the sun moves.\n\n'
  + 'She chases butterflies, and she loves them.\n\n'
  + 'In the evening she waits by the door.\n';

await describe({
  name: groupNodesAligned.name,
  children: [
    it({
      name: 'puts everything in one run when both budgets are generous, and '
        + 'covers every block on both sides exactly once',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation blocks.
         */
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        /**
         * Runs under a budget nothing can exceed.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);

        expect(runs.length,).toBe(1,);
        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
      },
    },),

    it({
      name: 'SPLITS into several runs under a tight budget while still '
        + 'covering every block exactly once, which is the case where a '
        + 'grouping bug would drop or duplicate a block',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation blocks.
         */
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        /**
         * Runs under a budget roughly one paragraph wide.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: 12,
          targetBudget: 40,
        },);

        expect(runs.length,).toBeGreaterThan(1,);
        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
      },
    },),

    it({
      name: 'closes a run when EITHER side would exceed its own budget, so a '
        + 'slice stays comparable in size on both sides even though the two '
        + 'languages differ in density: a generous source budget does not let '
        + 'the translation side run away',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation blocks.
         */
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        /**
         * Runs where only the translation side is constrained.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: 40,
        },);

        expect(runs.length,).toBeGreaterThan(1,);
        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
      },
    },),

    it({
      name: 'KEEPS an unpartnered block rather than dropping it. The '
        + 'translation here is missing a paragraph, and the source block it '
        + 'lacks must still land in a run: the slice text is cut from first to '
        + 'last offset, so dropping the block would not remove it from what a '
        + 'critic reads, only from the record of what the slice was built from',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation missing the butterflies paragraph entirely.
         */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill.\n\n'
            + 'She wakes when the sun moves.\n\n'
            + 'In the evening she waits by the door.\n',
        },);

        /**
         * Runs over the mismatched pair.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);

        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
      },
    },),

    it({
      name: 'covers every block even when the sides drop DIFFERENT paragraphs, '
        + 'so unpartnered blocks on both sides at once still each land '
        + 'somewhere',
      fn: async () => {
        /**
         * Original missing its second paragraph.
         */
        const sourceNodes = blocksOf({
          text: '猫猫在窗台上睡觉。\n\n她追蝴蝶，很喜欢它们。\n\n晚上她在门口等着。\n',
        },);

        /**
         * Translation missing its third paragraph instead.
         */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill.\n\n'
            + 'She wakes when the sun moves.\n\n'
            + 'In the evening she waits by the door.\n',
        },);

        /**
         * Runs over the doubly-mismatched pair.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);

        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
        for (const run of runs) {
          expect(run.sourceRun.length,).toBeGreaterThan(0,);
          expect(run.targetRun.length,).toBeGreaterThan(0,);
        }
      },
    },),

    it({
      name: 'never emits a run empty on one side, because every later stage '
        + 'needs both sides to compare and a one-sided run is a slice nobody '
        + 'can review',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation that folded four paragraphs into one.
         */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill, wakes when the sun moves, '
            + 'chases butterflies she loves, and waits by the door at evening.\n',
        },);

        for (const budget of [
          WIDE_BUDGET,
          20,
        ]) {
          /**
           * Runs at this budget.
           */
          const runs = groupNodesAligned({
            sourceNodes,
            targetNodes,
            sourceBudget: budget,
            targetBudget: budget,
          },);

          for (const run of runs) {
            expect(run.sourceRun.length,).toBeGreaterThan(0,);
            expect(run.targetRun.length,).toBeGreaterThan(0,);
          }
          expectCoversEveryBlockOnce({
            runs,
            sourceNodes,
            targetNodes,
          },);
        }
      },
    },),

    it({
      name: 'returns NO RUNS when one side has no blocks at all, the module\'s '
        + 'stated exception to coverage: nothing two-sided exists to hold the '
        + 'other side\'s blocks, and the caller\'s own fallback owns that case',
      fn: async () => {
        expect(
          groupNodesAligned({
            sourceNodes: blocksOf({ text: SOURCE_TEXT, },),
            targetNodes: [],
            sourceBudget: WIDE_BUDGET,
            targetBudget: WIDE_BUDGET,
          },),
        ).toStrictEqual([],);

        expect(
          groupNodesAligned({
            sourceNodes: [],
            targetNodes: blocksOf({ text: TARGET_TEXT, },),
            sourceBudget: WIDE_BUDGET,
            targetBudget: WIDE_BUDGET,
          },),
        ).toStrictEqual([],);
      },
    },),

    it({
      name: 'returns no runs for two empty sides rather than throwing',
      fn: async () => {
        expect(
          groupNodesAligned({
            sourceNodes: [],
            targetNodes: [],
            sourceBudget: WIDE_BUDGET,
            targetBudget: WIDE_BUDGET,
          },),
        ).toStrictEqual([],);
      },
    },),

    it({
      name: 'gives a block larger than the whole budget its own run rather '
        + 'than looping or dropping it, since a single unsplittable block '
        + 'cannot be made to fit',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation blocks.
         */
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        /**
         * Runs under a budget no single paragraph fits inside.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: 1,
          targetBudget: 1,
        },);

        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
      },
    },),
  ],
},);
