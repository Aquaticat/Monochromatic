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

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type AlignedRun,
  blockPairingToSteps,
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

  // AN INSERTION RUN CARRIES NO TRANSLATION BLOCKS, by construction: it names
  // originals nothing rendered and the place their rendering belongs. The
  // coverage claim is unchanged by that, since every translation block still
  // appears exactly once across the runs that hold any.
  expect(
    runs.flatMap(function toTargetIds(run,) {
      return (run.kind === 'insertion')
        ? []
        : run.targetRun
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

/**
 * Stands for "no insertion run was produced", which no offset can be.
 */
const NO_RUN = -1;

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
          // No pairing was supplied here, so the scorer produced the walk and
          // no insertion may be proposed off it: the scorer cannot tell an
          // original that was merged from one that was dropped.
          expect(run.kind,).toBe('paired',);
          if (run.kind === 'paired')
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
            // A MERGE IS NOT AN OMISSION. The four originals here are rendered
            // as one translation block, which the walk reports as a pairing
            // followed by continuations, so none of them is unplaced and no
            // insertion run may appear. If one did, the lane would write a
            // second rendering of a passage the page already carries.
            expect(run.kind,).toBe('paired',);
            if (run.kind === 'paired')
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
    it({
      name: 'KEEPS a section whose every run came out one-sided, which a supplied '
        + 'pairing that pairs nothing produces once the budget splits the unpaired blocks',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation blocks.
         */
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        // NOTHING PAIRED, and a budget no block fits inside, so every run holds
        // one block and none holds both sides. The merger held those blocks
        // waiting for a two-sided run to fold them into, and none ever came, so
        // it returned nothing and the section left the document. Both sides
        // carry blocks here, so the caller's empty-side fallback never fires.
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: 1,
          targetBudget: 1,
          steps: [
            ...[ ...sourceNodes.keys(), ].map(function toSourceOnly(
              sourceIndex,
            ): { readonly kind: 'source-only'; readonly sourceIndex: number; } {
              return {
                kind: 'source-only',
                sourceIndex,
              };
            },),
            ...[ ...targetNodes.keys(), ].map(function toTargetOnly(
              targetIndex,
            ): { readonly kind: 'target-only'; readonly targetIndex: number; } {
              return {
                kind: 'target-only',
                targetIndex,
              };
            },),
          ],
        },);

        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
      },
    },),
    it({
      name: 'GIVES AN ORIGINAL NOTHING RENDERED ITS OWN RUN, anchored where the next rendered '
        + 'block begins. Folding it into a neighbour put its bytes inside that slice span, where '
        + 'no later stage could tell a missing passage from part of the one beside it',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation missing the third paragraph entirely.
         */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill.\n\n'
            + 'She wakes when the sun moves.\n\n'
            + 'In the evening she waits by the door.\n',
        },);

        /**
         * A roster pairing leaving the third original unplaced.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps: [
            {
              kind: 'paired',
              sourceIndex: 0,
              targetIndex: 0,
            },
            {
              kind: 'paired',
              sourceIndex: 1,
              targetIndex: 1,
            },
            {
              kind: 'source-only',
              sourceIndex: 2,
            },
            {
              kind: 'paired',
              sourceIndex: 3,
              targetIndex: 2,
            },
          ],
        },);

        expect(runs.map(function toKind(run,) {
          return run.kind;
        },),)
          .toStrictEqual([
            'paired',
            'insertion',
            'paired',
          ],);

        /**
         * The insertion run.
         */
        const anchored = runs.find(function isInsertion(run,) {
          return run.kind === 'insertion';
        },);

        expect((anchored?.kind === 'insertion') ? anchored.targetOffset : NO_RUN,)
          .toBe(nonNullishOrThrow(targetNodes.at(2,),).startOffset,);

        expect((anchored?.sourceRun ?? []).map(function toId(node,) {
          return node.id;
        },),)
          .toStrictEqual([ nonNullishOrThrow(sourceNodes.at(2,),).id, ],);
      },
    },),

    it({
      name: 'NEVER PROPOSES AN INSERTION FOR A MERGE, since two originals rendered as one block '
        + 'arrive as a pairing plus a continuation and the second IS on the page. Writing it in '
        + 'again would put a second rendering of that passage into a memorial document',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation folding the first two originals into one block.
         */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill, and wakes when the sun moves.\n\n'
            + 'She chases butterflies, and she loves them.\n\n'
            + 'In the evening she waits by the door.\n',
        },);

        /**
         * A pairing whose second original continues the first one's block.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps: [
            {
              kind: 'paired',
              sourceIndex: 0,
              targetIndex: 0,
            },
            {
              kind: 'source-only',
              sourceIndex: 1,
              continuesPairing: true,
            },
            {
              kind: 'paired',
              sourceIndex: 2,
              targetIndex: 1,
            },
            {
              kind: 'paired',
              sourceIndex: 3,
              targetIndex: 2,
            },
          ],
        },);

        expect(runs.every(function isPaired(run,) {
          return run.kind === 'paired';
        },),)
          .toBe(true,);
      },
    },),

    it({
      name: 'ANCHORS A TRAILING ORIGINAL AFTER THE LAST RENDERED BLOCK, since nothing follows it '
        + 'to sit before, and anchoring at the start of the last block instead would write the '
        + 'passage above the paragraph it comes after',
      fn: async () => {
        /**
         * Original blocks.
         */
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);

        /**
         * Translation missing the last paragraph.
         */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill.\n\n'
            + 'She wakes when the sun moves.\n\n'
            + 'She chases butterflies, and she loves them.\n',
        },);

        /**
         * A pairing leaving the final original unplaced.
         */
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps: [
            {
              kind: 'paired',
              sourceIndex: 0,
              targetIndex: 0,
            },
            {
              kind: 'paired',
              sourceIndex: 1,
              targetIndex: 1,
            },
            {
              kind: 'paired',
              sourceIndex: 2,
              targetIndex: 2,
            },
            {
              kind: 'source-only',
              sourceIndex: 3,
            },
          ],
        },);

        /**
         * The insertion run.
         */
        const anchored = runs.find(function isInsertion(run,) {
          return run.kind === 'insertion';
        },);

        expect((anchored?.kind === 'insertion') ? anchored.targetOffset : NO_RUN,)
          .toBe(nonNullishOrThrow(targetNodes.at(-1,),).endOffset,);
      },
    },),

  ],
},);

//region Roster-pairing disposal
// What happens to blocks a supplied pairing left one-sided, which is the path
// the deterministic scorer never produces.

/**
 * Six originals, which is the smallest count reaching every disposal site.
 */
const SIX_SOURCE_TEXT = '猫猫一号在窗台上睡觉。\n\n猫猫二号追蝴蝶。\n\n猫猫三号在门口等着。\n\n'
  + '猫猫四号喝牛奶。\n\n猫猫五号爬树。\n\n猫猫六号晒太阳。\n';

/**
 * Five translations, so two originals have no counterpart.
 */
const FIVE_TARGET_TEXT = 'Cat one sleeps on the windowsill.\n\n'
  + 'Cat two chases butterflies.\n\n'
  + 'Cat three waits by the door.\n\n'
  + 'Cat four drinks milk.\n\n'
  + 'Cat five climbs the tree.\n';

/**
 * Three translations, the shape that leaves an unclaimed one at the very end.
 */
const THREE_TARGET_TEXT = 'Cat one sleeps on the windowsill.\n\n'
  + 'Cat two chases butterflies.\n\n'
  + 'Cat three waits by the door.\n';

/**
 * Groups a document pair under a roster pairing, at a budget nothing splits.
 *
 * @param sourceText - whole original
 *
 * @param targetText - whole translation
 *
 * @param pairs - correspondences a roster agreed on
 *
 * @returns Runs, beside the blocks they were built from
 *
 * @example
 * ```ts
 * const { runs, } = groupUnderPairing({ sourceText, targetText, pairs, },);
 * ```
 */
function groupUnderPairing(
  {
    sourceText,
    targetText,
    pairs,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly pairs: readonly { readonly source: number; readonly target: number; }[];
  },
) {
  /**
   * Original blocks in document order.
   */
  const sourceNodes = blocksOf({ text: sourceText, },);

  /**
   * Translation blocks in document order.
   */
  const targetNodes = blocksOf({ text: targetText, },);
  return {
    sourceNodes,
    targetNodes,
    runs: groupNodesAligned({
      sourceNodes,
      targetNodes,
      sourceBudget: WIDE_BUDGET,
      targetBudget: WIDE_BUDGET,
      steps: blockPairingToSteps({
        pairs,
        sourceCount: sourceNodes.length,
        targetCount: targetNodes.length,
      },),
    },),
  };
}

//endregion Roster-pairing disposal

await describe({
  name: `${groupNodesAligned.name} disposing of one-sided runs`,
  children: [
    it({
      name: 'LEAVES no run empty on a side when held originals settle ahead of an insertion, since '
        + 'a run’s span is cut from its first node to its last and a run with no node on a side '
        + 'has no span to cut',
      fn: async () => {
        const {
          runs,
          sourceNodes,
          targetNodes,
        } = groupUnderPairing({
          sourceText: SIX_SOURCE_TEXT,
          targetText: FIVE_TARGET_TEXT,
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 2,
            },
            {
              source: 3,
              target: 2,
            },
          ],
        },);
        expect(runs.some(function isEmptySided(run,): boolean {
          return (run.kind === 'paired')
            && ((run.sourceRun
              .length
              === 0)
              || (run.targetRun
                .length
                === 0));
        },),).toBe(false,);
        expectCoversEveryBlockOnce({
          runs,
          sourceNodes,
          targetNodes,
        },);
      },
    },),

    it({
      name: 'KEEPS an unclaimed translation that arrives AFTER the last insertion, which has no '
        + 'two-sided run left to fold into. `declinedTargetIds` declines nothing here, because the '
        + 'pairing left originals unplaced, so the block is one review still owes a reader',
      fn: async () => {
        const {
          runs,
          sourceNodes,
          targetNodes,
        } = groupUnderPairing({
          sourceText: SIX_SOURCE_TEXT,
          targetText: THREE_TARGET_TEXT,
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 0,
            },
            {
              source: 2,
              target: 1,
            },
            {
              source: 3,
              target: 1,
            },
          ],
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
