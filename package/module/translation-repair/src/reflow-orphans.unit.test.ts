/**
 * Tests for what becomes of translation blocks no original block accounts for
 * when an anchor stands between them and the next unit that could take them.
 *
 * WHY THIS FILE EXISTS. `reflowOrphans` holds such blocks until a paired unit
 * can carry them, and CLEARS what it holds at every anchored unit. That
 * clearing is the rule the module exists to enforce: an anchor names a boundary
 * between two translation blocks, a paired unit covers a span of them, and
 * attaching a held block to a unit beyond an anchor stretches that span past
 * the boundary. The anchor then sits inside a span that comes before it in
 * slice order, and `assertPlacementLayout` refuses the whole preparation,
 * because the two placements disagree about where the untranslated text goes.
 *
 * Measured on 2026-08-25 by removing the clearing, rebuilding and running the
 * package suite: nothing failed. The pairing tests execute that arm and none of
 * them asserts what it decides.
 *
 * BOTH CHILDREN HAND OVER THE SAME HELD BLOCK and differ only in whether an
 * anchor stands before the paired unit. That is what makes the second one a
 * control: it shows the block does travel when its region allows it, so the
 * first one is measuring the anchor rather than a fixture that never held
 * anything.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
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
  parseDocument,
  reflowOrphans,
  type SourceFirstUnit,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Original side, three blocks the translation was meant to carry.
 */
const SOURCE_PAGE = `## Naptime

Mittens slept on the sill until noon.

Whiskers counted the birds outside.
`;

/**
 * Translation side, where the middle paragraph answers to no original block and
 * is therefore the orphan both children reflow.
 */
const TARGET_PAGE = `## Naptime

Her brother brought her a feather.

Whiskers counted the birds outside.
`;

/**
 * Original blocks in document order.
 */
const SOURCE_NODES = parseDocument({ text: SOURCE_PAGE, },).nodes;

/**
 * Translation blocks in document order.
 */
const TARGET_NODES = parseDocument({ text: TARGET_PAGE, },).nodes;

/**
 * Translation block no original accounts for.
 */
const ORPHAN_BLOCK = nonNullishOrThrow(TARGET_NODES.at(1,),);

/**
 * Translation block the last original block pairs with.
 */
const PAIRED_BLOCK = nonNullishOrThrow(TARGET_NODES.at(2,),);

/**
 * Anchored unit standing before the orphan, so no paired unit precedes it and
 * the orphan has to be held rather than attached backwards.
 */
const OPENING_ANCHOR = {
  kind: 'anchored',
  sourceRun: [nonNullishOrThrow(SOURCE_NODES.at(0,),),],
  boundary: {
    kind: 'before-block',
    block: ORPHAN_BLOCK,
  },
} as const satisfies SourceFirstUnit;

/**
 * Unit carrying the orphan and no original blocks at all.
 */
const ORPHAN_UNIT = {
  kind: 'paired',
  sourceRun: [],
  targetRun: [ORPHAN_BLOCK,],
} as const satisfies SourceFirstUnit;

/**
 * Anchor between the orphan and the unit that would otherwise take it, which is
 * the region end under test.
 */
const DIVIDING_ANCHOR = {
  kind: 'anchored',
  sourceRun: [nonNullishOrThrow(SOURCE_NODES.at(1,),),],
  boundary: {
    kind: 'before-block',
    block: PAIRED_BLOCK,
  },
} as const satisfies SourceFirstUnit;

/**
 * Paired unit that takes held blocks whenever one region holds both.
 */
const RECEIVING_UNIT = {
  kind: 'paired',
  sourceRun: [nonNullishOrThrow(SOURCE_NODES.at(2,),),],
  targetRun: [PAIRED_BLOCK,],
} as const satisfies SourceFirstUnit;

/**
 * Reads which translation blocks the returned units cover, in order.
 *
 * @param units - units as the reflow returned them
 *
 * @returns Block identifiers, flattened across every unit
 *
 * @example
 * ```ts
 * const covered = targetIdsOf({ units: reflowOrphans({ units, },), },);
 * ```
 */
function targetIdsOf(
  { units, }: { readonly units: readonly SourceFirstUnit[]; },
): readonly string[] {
  return units.flatMap(function toIds(unit,): readonly string[] {
    if (unit.kind !== 'paired')
      return [];
    return unit.targetRun.map(function toId(node,): string {
      return node.id;
    },);
  },);
}

//endregion Fixtures

await describe({
  name: reflowOrphans.name,
  children: [
    it({
      name: 'DROPS a block held before an anchor instead of attaching it to the paired unit beyond, '
        + 'whose span would then cover a boundary standing earlier in slice order, which the placement '
        + 'check refuses outright',
      fn: async () => {
        /**
         * Units the reflow kept, all of which carry original blocks.
         */
        const kept = reflowOrphans({
          units: [
            OPENING_ANCHOR,
            ORPHAN_UNIT,
            DIVIDING_ANCHOR,
            RECEIVING_UNIT,
          ],
        },);

        expect(kept,).toHaveLength(3,);
        // The orphan stays uncovered on purpose: no slice needs it, assembly
        // writes nothing there, and the document keeps it byte for byte.
        expect(targetIdsOf({ units: kept, },),).toEqual([PAIRED_BLOCK.id,],);
      },
    },),
    it({
      name: 'ATTACHES that same held block to a paired unit inside its own region, so the case above '
        + 'measures the anchor rather than a fixture that never held anything',
      fn: async () => {
        /**
         * Units the reflow kept once no anchor divides the two.
         */
        const kept = reflowOrphans({
          units: [
            OPENING_ANCHOR,
            ORPHAN_UNIT,
            RECEIVING_UNIT,
          ],
        },);

        expect(kept,).toHaveLength(2,);
        expect(targetIdsOf({ units: kept, },),).toEqual([
          ORPHAN_BLOCK.id,
          PAIRED_BLOCK.id,
        ],);
      },
    },),
  ],
},);
