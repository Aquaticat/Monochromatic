/**
 * Tests for grouping with sealed blocks: the blocks the archive's note seals
 * reach no run, take their paired originals with them, and stand as
 * boundaries for the originals either side of them.
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
  blockPairingToSteps,
  type DocumentNode,
  groupNodesAligned,
  groupNodesSealed,
  parseDocument,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Budget wide enough that nothing closes on size.
 */
const WIDE_BUDGET = 100_000;

/**
 * Four originals: an intro, a letter, a closing line and a footnote definition
 * the archive never rendered.
 */
const SOURCE_TEXT = '她留下了一封信。\n\n> 我其实未曾离去\n\n是时候说晚安了。\n\n[^1]: 即 Google App Engine\n';

/**
 * Three renderings: the intro, the letter and the closing line.
 */
const TARGET_TEXT = 'She left a letter.\n\n> I am never gone,\n\nTime to say goodnight.\n';

/**
 * Blocks of a text.
 *
 * @param text - document
 *
 * @returns Its top-level blocks
 *
 * @example
 * ```ts
 * const nodes = blocksOf({ text: SOURCE_TEXT, },);
 * ```
 */
function blocksOf({ text, }: { readonly text: string; },): readonly DocumentNode[] {
  return parseDocument({ text, },).nodes;
}

/**
 * Node at a position, or a thrown absence.
 *
 * @param nodes - blocks
 *
 * @param at - position
 *
 * @returns The block
 *
 * @example
 * ```ts
 * const letter = nodeAt({ nodes: targetNodes, at: 1, },);
 * ```
 */
function nodeAt(
  {
    nodes,
    at,
  }: {
    readonly nodes: readonly DocumentNode[];
    readonly at: number;
  },
): DocumentNode {
  /**
   * The block.
   */
  const node = nodes[at];
  if (node === undefined)
    throw new Error(`no block at ${String(at,)}`,);
  return node;
}

/**
 * Ids a list of runs carries on the translation side, in order.
 *
 * @param runs - settled runs
 *
 * @returns Target ids
 *
 * @example
 * ```ts
 * const ids = targetIdsOf({ runs, },);
 * ```
 */
function targetIdsOf({ runs, }: { readonly runs: readonly AlignedRun[]; },): readonly string[] {
  return runs.flatMap(function toIds(run,): readonly string[] {
    return (run.kind === 'insertion')
      ? []
      : run.targetRun
        .map(function toId(node,): string {
          return node.id;
        },);
  },);
}

/**
 * Ids a list of runs carries on the original side, in order.
 *
 * @param runs - settled runs
 *
 * @returns Source ids
 *
 * @example
 * ```ts
 * const ids = sourceIdsOf({ runs, },);
 * ```
 */
function sourceIdsOf({ runs, }: { readonly runs: readonly AlignedRun[]; },): readonly string[] {
  return runs.flatMap(function toIds(run,): readonly string[] {
    return run.sourceRun
      .map(function toId(node,): string {
        return node.id;
      },);
  },);
}

//endregion Fixtures

await describe({
  name: groupNodesSealed.name,
  children: [
    it({
      name: 'with nothing sealed, groups exactly as groupNodesAligned does',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);
        /**
         * The roster's pairing: intro, letter and closing paired; the
         * footnote definition unpaired.
         */
        const steps = blockPairingToSteps({
          pairs: [
            {
              source: 0,
              target: 0,
            },
            {
              source: 1,
              target: 1,
            },
            {
              source: 2,
              target: 2,
            },
          ],
          sourceCount: sourceNodes.length,
          targetCount: targetNodes.length,
        },);
        expect(groupNodesSealed({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps,
          sealed: new Set<string>(),
        },),).toStrictEqual({
          runs: groupNodesAligned({
            sourceNodes,
            targetNodes,
            sourceBudget: WIDE_BUDGET,
            targetBudget: WIDE_BUDGET,
            steps,
          },),
          sealedSourceIds: new Set<string>(),
        },);
      },
    },),

    it({
      name: 'drops a sealed block with the original paired to it, keeps the runs either side apart, and '
        + 'writes an original behind the seal at the seal end rather than before it',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);
        /**
         * The letter and the closing line, sealed.
         */
        const letter = nodeAt({
          nodes: targetNodes,
          at: 1,
        },);
        const closing = nodeAt({
          nodes: targetNodes,
          at: 2,
        },);
        const {
          runs,
          sealedSourceIds,
        } = groupNodesSealed({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps: blockPairingToSteps({
            pairs: [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
              {
                source: 2,
                target: 2,
              },
            ],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
          sealed: new Set([
            letter.id,
            closing.id,
          ],),
        },);
        // THE INTRO IS THE ONE PAIRED RUN; the footnote definition is an
        // insertion at the END of the sealed closing line, not after the intro.
        expect(targetIdsOf({ runs, },),).toStrictEqual([ nodeAt({
          nodes: targetNodes,
          at: 0,
        },).id, ],);
        expect(sourceIdsOf({ runs, },),).toStrictEqual([
          nodeAt({
            nodes: sourceNodes,
            at: 0,
          },).id,
          nodeAt({
            nodes: sourceNodes,
            at: 3,
          },).id,
        ],);
        /**
         * The insertion run.
         */
        const insertion = runs.find(function isInsertion(run,): boolean {
          return run.kind === 'insertion';
        },);
        if ((insertion === undefined) || (insertion.kind !== 'insertion'))
          throw new Error('expected an insertion run for the footnote definition',);
        expect(insertion.targetOffset,).toBe(closing.endOffset,);
        expect([ ...sealedSourceIds, ],).toStrictEqual([
          nodeAt({
            nodes: sourceNodes,
            at: 1,
          },).id,
          nodeAt({
            nodes: sourceNodes,
            at: 2,
          },).id,
        ],);
      },
    },),

    it({
      name: 'seals one block in the middle and keeps the blocks either side in separate runs',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);
        const letter = nodeAt({
          nodes: targetNodes,
          at: 1,
        },);
        const { runs, } = groupNodesSealed({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          steps: blockPairingToSteps({
            pairs: [
              {
                source: 0,
                target: 0,
              },
              {
                source: 1,
                target: 1,
              },
              {
                source: 2,
                target: 2,
              },
            ],
            sourceCount: sourceNodes.length,
            targetCount: targetNodes.length,
          },),
          sealed: new Set([ letter.id, ],),
        },);
        /**
         * Paired runs, which must not have merged across the seal.
         */
        const paired = runs.filter(function isPaired(run,): boolean {
          return run.kind === 'paired';
        },);
        expect(paired.length,).toBe(2,);
        expect(targetIdsOf({ runs, },),).toStrictEqual([
          nodeAt({
            nodes: targetNodes,
            at: 0,
          },).id,
          nodeAt({
            nodes: targetNodes,
            at: 2,
          },).id,
        ],);
      },
    },),

    it({
      name: 'seals under the scorer walk too, when no roster pairing was supplied',
      fn: async () => {
        const sourceNodes = blocksOf({ text: SOURCE_TEXT, },);
        const targetNodes = blocksOf({ text: TARGET_TEXT, },);
        const letter = nodeAt({
          nodes: targetNodes,
          at: 1,
        },);
        const { runs, } = groupNodesSealed({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
          sealed: new Set([ letter.id, ],),
        },);
        /**
         * Every translation id the runs carry.
         */
        const ids = targetIdsOf({ runs, },);
        expect(ids,).not
          .toContain(letter.id,);
        expect(ids,).toContain(nodeAt({
          nodes: targetNodes,
          at: 0,
        },).id,);
        expect(ids,).toContain(nodeAt({
          nodes: targetNodes,
          at: 2,
        },).id,);
      },
    },),
  ],
},);
