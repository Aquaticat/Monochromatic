/**
 * Tests for source-first grouping, which keeps every source block including
 * the ones the translation never rendered.
 *
 * The existing grouper folds a one-sided run into its neighbour, so an
 * untranslated paragraph rides inside a slice about a different passage and has
 * nowhere to put a rendering. What these pin is the opposite: such a run
 * becomes its own unit, carrying the boundary its translation belongs at.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type AlignmentStep,
  groupAlignedSteps,
  groupSourceFirst,
  parseDocument,
  type SourceFirstUnit,
} from '../dist/final/node/index.mjs';

/**
 * Budget wide enough that nothing splits for size alone.
 */
const WIDE_BUDGET = 10_000;

/**
 * Blocks of a document, in order.
 *
 * @param text - document to parse
 *
 * @returns Its block-level nodes
 *
 * @example
 * ```ts
 * const nodes = blocksOf({ text: '猫猫在睡觉。', },);
 * ```
 */
function blocksOf({ text, }: { readonly text: string; },) {
  return parseDocument({ text, },).nodes;
}

/**
 * Kinds of the units in order, which is what most cases assert on.
 *
 * @param units - grouping result
 *
 * @returns One kind per unit
 *
 * @example
 * ```ts
 * const kinds = kindsOf({ units, },);
 * ```
 */
function kindsOf(
  { units, }: { readonly units: readonly SourceFirstUnit[]; },
): readonly string[] {
  return units.map(function toKind(unit,): string {
    return unit.kind;
  },);
}

await describe({
  name: groupSourceFirst.name,
  children: [
    it({
      name: 'pairs blocks that pair, which is every slice of a document whose translation covers it: '
        + 'nothing anchors, and each unit carries both sides',
      fn: async () => {
        /** Two paragraphs, both translated. */
        const units = groupSourceFirst({
          sourceNodes: blocksOf({ text: '猫猫在窗台上睡觉。\n\n她在看鸟。\n', },),
          targetNodes: blocksOf({ text: 'The cat sleeps on the windowsill.\n\nShe watches the birds.\n', },),
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);
        expect(kindsOf({ units, },)
          .every(function isPaired(kind,): boolean {
            return kind === 'paired';
          },),).toBe(true,);

        /** Source blocks across every unit. */
        const covered = units.reduce(
          function addCount(
            sum,
            unit,
          ): number {
            return sum + unit.sourceRun
              .length;
          },
          0,
        );
        expect(covered,).toBe(2,);
      },
    },),
    it({
      name: 'gives an UNTRANSLATED middle paragraph its own unit, anchored before the translation of '
        + 'what follows it. Folded into a neighbour, as the old grouping does, it rides inside a slice '
        + 'that already covers text and has nowhere to put a rendering',
      fn: async () => {
        /** Three source paragraphs whose middle one was never translated. */
        const sourceNodes = blocksOf({
          text: '猫猫在窗台上睡觉。\n\n猫猫也喜欢晒太阳。\n\n她在看鸟。\n',
        },);

        /** Translation of the first and last only. */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill.\n\nShe watches the birds.\n',
        },);

        /**
         * Alignment saying exactly which block went untranslated.
         *
         * WRITTEN OUT rather than aligned here, because which block pairs with
         * which is the aligner's judgement and this is a test of the grouping.
         */
        const steps: readonly AlignmentStep[] = [
          {
            kind: 'paired',
            sourceIndex: 0,
            targetIndex: 0,
          },
          {
            kind: 'source-only',
            sourceIndex: 1,
          },
          {
            kind: 'paired',
            sourceIndex: 2,
            targetIndex: 1,
          },
        ];
        const units = groupAlignedSteps({
          steps,
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);
        // Split BY the untranslated passage rather than spanning it, so no
        // slice covers text on both sides of a gap.
        expect(kindsOf({ units, },),).toEqual([
          'paired',
          'anchored',
          'paired',
        ],);

        /** The unit naming a place rather than covering text. */
        const [, anchored,] = units;
        if ((anchored === undefined) || (anchored.kind !== 'anchored'))
          throw new Error('expected the middle unit to be anchored',);
        expect(anchored.sourceRun
          .length,).toBe(1,);
        // Anchored BEFORE the second translated block, which is where the
        // missing rendering belongs in document order.
        expect(anchored.boundaryIndex,).toBe(1,);
      },
    },),
    it({
      name: 'anchors a TRAILING untranslated passage after everything, which the block count names: '
        + 'there is no later block for it to precede',
      fn: async () => {
        const units = groupAlignedSteps({
          steps: [
            {
              kind: 'paired',
              sourceIndex: 0,
              targetIndex: 0,
            },
            {
              kind: 'source-only',
              sourceIndex: 1,
            },
          ],
          sourceNodes: blocksOf({ text: '猫猫在窗台上睡觉。\n\n猫猫也喜欢晒太阳。\n', },),
          targetNodes: blocksOf({ text: 'The cat sleeps on the windowsill.\n', },),
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);

        /** Last unit, which is where the untranslated passage lands. */
        const last = units.at(-1,);
        if ((last === undefined) || (last.kind !== 'anchored'))
          throw new Error('expected a trailing anchored unit',);
        expect(last.boundaryIndex,).toBe(1,);
      },
    },),
    it({
      name: 'anchors EVERY block of a section the translation never touched at its start, which is what '
        + 'a section present in one document and absent from the other looks like',
      fn: async () => {
        const units = groupSourceFirst({
          sourceNodes: blocksOf({ text: '猫猫在窗台上睡觉。\n\n她在看鸟。\n', },),
          targetNodes: [],
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);
        expect(kindsOf({ units, },),).toEqual(['anchored',],);

        /** The one unit, carrying both blocks at the only boundary there is. */
        const [only,] = units;
        if ((only === undefined) || (only.kind !== 'anchored'))
          throw new Error('expected one anchored unit',);
        expect(only.sourceRun
          .length,).toBe(2,);
        expect(only.boundaryIndex,).toBe(0,);
      },
    },),
    it({
      name: 'keeps a TARGET-ONLY block inside the interval that encloses it, so the slice`s nodes and '
        + 'its offsets describe the same passage. A run built from the paired blocks alone would leave '
        + 'that block inside the range and outside the record of what the slice covers',
      fn: async () => {
        /** Two source paragraphs. */
        const sourceNodes = blocksOf({ text: '猫猫在窗台上睡觉。\n\n她在看鸟。\n', },);

        /** Translation carrying a third paragraph of its own in the middle. */
        const targetNodes = blocksOf({
          text: 'The cat sleeps on the windowsill.\n\nEditor`s note: the sill is warm.\n\nShe watches the birds.\n',
        },);
        const units = groupSourceFirst({
          sourceNodes,
          targetNodes,
          sourceBudget: WIDE_BUDGET,
          targetBudget: WIDE_BUDGET,
        },);

        /** Every target block any unit carries. */
        const carried = units.flatMap(function toNodes(unit,) {
          return (unit.kind === 'paired') ? unit.targetRun : [];
        },);
        expect(carried.length,).toBe(targetNodes.length,);

        /** Whether every unit's target side is a contiguous run of the whole. */
        const contiguous = units.every(function isContiguous(unit,): boolean {
          if (unit.kind !== 'paired')
            return true;

          /** This unit's first block, which a paired unit always has. */
          const [opening,] = unit.targetRun;
          if (opening === undefined)
            return true;

          /** Where it sits in the document. */
          const first = targetNodes.indexOf(opening,);
          return unit.targetRun
            .every(function isNext(
              node,
              offset,
            ): boolean {
              return targetNodes[first + offset] === node;
            },);
        },);
        expect(contiguous,).toBe(true,);
      },
    },),
    it({
      name: 'SPLITS an untranslated passage larger than the budget into several units at ONE boundary, '
        + 'since a passage bigger than a slice is still translated a slice at a time and assembly '
        + 'composes fragments sharing a boundary in slice order',
      fn: async () => {
        /** Three untranslated paragraphs, each over a tiny budget. */
        const units = groupSourceFirst({
          sourceNodes: blocksOf({
            text: '猫猫在窗台上睡觉。\n\n猫猫也喜欢晒太阳。\n\n她在看鸟。\n',
          },),
          targetNodes: [],
          sourceBudget: 12,
          targetBudget: WIDE_BUDGET,
        },);
        expect(units.length,).toBeGreaterThan(1,);
        expect(units.every(function isAnchored(unit,): boolean {
          return unit.kind === 'anchored';
        },),).toBe(true,);
        expect(units.every(function sharesBoundary(unit,): boolean {
          return (unit.kind === 'anchored') && (unit.boundaryIndex === 0);
        },),).toBe(true,);
      },
    },),
  ],
},);
