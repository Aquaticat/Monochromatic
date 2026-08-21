/**
 * Tests that a translation block no original claims reaches no slice.
 *
 * WHAT THIS FILE EXISTS TO STOP, measured on `Zha_Ke` and recorded in
 * `doc/planning/one-sided-pairing-census.md`. Its English page carries a letter
 * its Chinese page does not. The roster paired all four source blocks and left
 * the letter unpaired, exactly as asked. Grouping then folded the unpaired run
 * into its neighbour, and the slice reached the judges as 41 characters of
 * source against 3875 characters of standing English, 93 percent of which the
 * pairing had already declined. A consolidation deleted the letter.
 *
 * THE SPAN IS THE POINT, not the node list. A run's text is cut from its first
 * offset to its last, so skipping a declined block without CLOSING the run
 * leaves its bytes inside the span and changes only the record. Every case here
 * asserts offsets rather than counts for that reason.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  blockPairingToSteps,
  declinedTargetBlocks,
  type DocumentNode,
  groupNodesAligned,
  parseDocument,
} from '../dist/final/node/index.mjs';

/**
 * Budget wide enough that nothing splits on size alone, so any run boundary
 * these cases show was placed by a decline rather than by the budget.
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
 * Original side: four paragraphs, none of them mentioning the long letter.
 */
const SOURCE_TEXT = 'Mochi sleeps by the window.\n\n'
  + 'A note about the tin.\n\n'
  + 'Mochi answers to two names.\n\n'
  + 'The vet visit went well, and she forgave us by evening.\n';

/**
 * Translation side: the same four, plus a short aside and a long letter that
 * the original never mentions, sitting together in the middle.
 */
const TARGET_TEXT = 'Mochi sleeps in the window seat.\n\n'
  + 'A note about the biscuit tin, which she opens herself.\n\n'
  + 'Written by a neighbour.\n\n'
  + `> ${'She waited at the gate every afternoon for a year. '.repeat(20,)}\n\n`
  + 'Mochi answers to two names.\n\n'
  + 'The trip to the vet went well, and she had forgiven us by evening.\n';

await describe({
  name: 'declined target runs',
  children: [
    it({
      name: 'KEEPS a declined block out of every run, and out of every span',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);
        expect(sourceNodes.length,).toBe(4,);
        expect(targetNodes.length,).toBe(6,);

        // The pairing `Zha_Ke`'s roster returned: every original placed, the
        // aside and the letter claimed by none of them.
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps: blockPairingToSteps({
            pairs: [
              { source: 0, target: 0, },
              { source: 1, target: 1, },
              { source: 2, target: 4, },
              { source: 3, target: 5, },
            ],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
        },);

        /**
         * Ids of every translation block any run carries.
         */
        const carried = new Set(runs.flatMap(function toIds(run,): readonly string[] {
          return run.targetRun
            .map(function toId(node,): string {
              return node.id;
            },);
        },),);
        expect(carried.has(targetNodes[2].id,),).toBe(false,);
        expect(carried.has(targetNodes[3].id,),).toBe(false,);
        expect(carried.has(targetNodes[1].id,),).toBe(true,);
        expect(carried.has(targetNodes[4].id,),).toBe(true,);

        // THE SPAN CHECK. Some run must end at the paired block before the
        // letter, and the next must begin at the paired block after it, or the
        // letter's bytes are still inside a slice.
        /**
         * Every run's translation-side span, in document order.
         */
        const spans = runs
          .filter(function hasTarget(run,): boolean {
            return run.targetRun
              .length
              > 0;
          },)
          .map(function toSpan(run,): { readonly start: number; readonly end: number; } {
            return {
              start: run.targetRun[0].startOffset,
              end: run.targetRun[run.targetRun.length - 1].endOffset,
            };
          },);
        /**
         * Whether any span covers a byte the letter occupies.
         */
        const overlapsLetter = spans.some(function covers(span,): boolean {
          return (span.start < targetNodes[3].endOffset)
            && (span.end > targetNodes[3].startOffset);
        },);
        expect(overlapsLetter,).toBe(false,);
      },
    },),

    it({
      name: 'KEEPS a block that continues a pairing, because a split rendering is not a decline',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        // Original 1 rendered as BOTH the tin note and the neighbour aside,
        // which `readBlockPairing` allows by repeating the source.
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps: blockPairingToSteps({
            pairs: [
              { source: 0, target: 0, },
              { source: 1, target: 1, },
              { source: 1, target: 2, },
              { source: 2, target: 4, },
              { source: 3, target: 5, },
            ],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
        },);

        /**
         * Ids of every translation block any run carries.
         */
        const carried = new Set(runs.flatMap(function toIds(run,): readonly string[] {
          return run.targetRun
            .map(function toId(node,): string {
              return node.id;
            },);
        },),);
        expect(carried.has(targetNodes[2].id,),).toBe(true,);
        expect(carried.has(targetNodes[3].id,),).toBe(false,);
      },
    },),

    it({
      name: 'KEEPS every block when the scorer produced the walk, since a scorer cannot decline',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        // No steps supplied, so `alignBlocks` scores it. Its skips report where
        // a heuristic ran out, not a decision that nothing renders a block.
        const runs = groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);

        /**
         * Ids of every translation block any run carries.
         */
        const carried = new Set(runs.flatMap(function toIds(run,): readonly string[] {
          return run.targetRun
            .map(function toId(node,): string {
              return node.id;
            },);
        },),);
        for (const node of targetNodes)
          expect(carried.has(node.id,),).toBe(true,);
      },
    },),

    it({
      name: 'KEEPS every block when the pairing left an original unplaced',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        // Original 3 is placed nowhere, so this reply did not finish reading
        // the pair and its silence about the letter is a gap, not a decision.
        const declined = declinedTargetBlocks({
          steps: blockPairingToSteps({
            pairs: [
              { source: 0, target: 0, },
              { source: 1, target: 1, },
              { source: 2, target: 4, },
            ],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
          targetNodes,
        },);
        expect(declined,).toStrictEqual([],);
      },
    },),

    it({
      name: 'KEEPS every block when the pairing placed nothing at all',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        // What `pairBlocksAcrossRoster` returns when no voice was usable. The
        // caller passes it straight through, so this is a live shape.
        const declined = declinedTargetBlocks({
          steps: blockPairingToSteps({
            pairs: [],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
          targetNodes,
        },);
        expect(declined,).toStrictEqual([],);
      },
    },),

    it({
      name: 'NAMES exactly the blocks no original claims',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        const declined = declinedTargetBlocks({
          steps: blockPairingToSteps({
            pairs: [
              { source: 0, target: 0, },
              { source: 1, target: 1, },
              { source: 2, target: 4, },
              { source: 3, target: 5, },
            ],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
          targetNodes,
        },);

        expect(declined.map(function toId(node,): string {
          return node.id;
        },),).toStrictEqual([
          targetNodes[2].id,
          targetNodes[3].id,
        ],);
      },
    },),

    it({
      name: 'KEEPS a block sandwiched between two halves of one rendering',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        // One original rendered as TWO translation blocks, with a third block
        // nobody claims sitting between them. Declining that middle block would
        // ask grouping to close a run inside a rendering, and the span would
        // then cover the declined bytes anyway or cut the original away from
        // half its own translation.
        const pairs = [
          { source: 0, target: 0, },
          { source: 1, target: 1, },
          { source: 1, target: 3, },
          { source: 2, target: 4, },
          { source: 3, target: 5, },
        ];
        const steps = blockPairingToSteps({
          pairs,
          sourceCount: sourceNodes.length,
          targetCount: targetNodes.length,
        },);

        expect(declinedTargetBlocks({ steps, targetNodes, },),).toStrictEqual([],);

        /**
         * Ids of every translation block any run carries.
         */
        const carried = new Set(groupNodesAligned({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps,
        },).flatMap(function toIds(run,): readonly string[] {
          return run.targetNodes.map(function toId(node,): string {
            return node.id;
          },);
        },),);
        expect(carried.has(targetNodes[2].id,),).toBe(true,);
      },
    },),

    it({
      name: 'NAMES declined blocks when the pairing MERGES two originals',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);

        // A merge arrives as a `source-only` step carrying `continuesPairing`,
        // and that original IS placed. Reading it as an unplaced original would
        // switch the decline off for every entry that merges anywhere.
        const declined = declinedTargetBlocks({
          steps: blockPairingToSteps({
            pairs: [
              { source: 0, target: 0, },
              { source: 1, target: 1, },
              { source: 2, target: 1, },
              { source: 3, target: 5, },
            ],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
          targetNodes,
        },);

        expect(declined.map(function toId(node,): string {
          return node.id;
        },),).toStrictEqual([
          targetNodes[2].id,
          targetNodes[3].id,
          targetNodes[4].id,
        ],);
      },
    },),
  ],
},);
