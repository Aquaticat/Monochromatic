import type { DocumentNode, } from './document-node.ts';
import type { SourceFirstUnit, } from './source-first-unit.ts';

//region Orphan reflow
// Where translation blocks no original block accounts for end up.
//
// A group can close with translation blocks and no original ones: a target-only
// run following an untranslated passage starts a fresh group, and nothing pairs
// with it. Such a group cannot be a slice, since every stage compares an
// original against a translation, so its blocks join a neighbouring unit.
//
// NEVER ACROSS AN ANCHOR, which is the rule this module exists to enforce and
// the one an earlier version broke. An anchored unit names a boundary between
// two target blocks; a paired unit covers a span of them. Attaching an orphan
// to a unit on the far side of an anchor stretches that span past the boundary,
// so the anchor then sits INSIDE a span that comes before it in slice order,
// and `assertPlacementLayout` refuses the preparation outright. It refuses
// correctly: the two placements disagree about where the untranslated text
// goes. Both attachment directions have the fault, so the rule is about the
// anchor rather than about the direction.
//
// ANCHORS THEREFORE PARTITION the unit list into regions, and an orphan may
// only join a paired unit in its own region. It joins the one BEFORE it where
// that exists, since that keeps the run adjacent to text it follows in the
// document, and the one after it otherwise.
//
// A REGION WITH NO PAIRED UNIT LEAVES ITS BLOCKS UNCOVERED. That is text the
// archive has and the original does not, so no slice NEEDS it: assembly writes
// nothing there and the document keeps it byte for byte. What it costs is
// review, since no lane ever reads it, and that cost is the reason the
// alternative was tried first.

/**
 * Adds blocks to a paired unit's target side.
 *
 * @param unit - paired unit gaining blocks
 *
 * @param leading - blocks joining before its own
 *
 * @param trailing - blocks joining after its own
 *
 * @returns Unit covering its own blocks plus the given ones
 *
 * @example
 * ```ts
 * const wider = extendPaired({ unit, leading: [], trailing: orphans, },);
 * ```
 */
function extendPaired(
  {
    unit,
    leading,
    trailing,
  }: {
    readonly unit: SourceFirstUnit;
    readonly leading: readonly DocumentNode[];
    readonly trailing: readonly DocumentNode[];
  },
): SourceFirstUnit {
  if (unit.kind !== 'paired')
    throw new Error('unreachable: only a paired unit carries a target run',);
  return {
    kind: 'paired',
    sourceRun: unit.sourceRun,
    targetRun: [
      ...leading,
      ...unit.targetRun,
      ...trailing,
    ],
  };
}

/**
 * Attaches target blocks no source block accounts for to a neighbour in their
 * own anchor-delimited region, dropping the ones no such neighbour exists for.
 *
 * CONTIGUITY SURVIVES because groups partition the target indices into
 * consecutive ranges: every index is consumed by exactly one step, in order, so
 * an orphan run sits immediately after the previous unit's interval and
 * immediately before the next one's.
 *
 * @param units - units as grouped, possibly including source-less ones
 *
 * @returns Units that all carry original blocks, in document order
 *
 * @example
 * ```ts
 * const usable = reflowOrphans({ units, },);
 * ```
 */
export function reflowOrphans(
  { units, }: { readonly units: readonly SourceFirstUnit[]; },
): readonly SourceFirstUnit[] {
  /**
   * Units that carry original blocks, rebuilt as orphans are attached.
   */
  const kept: SourceFirstUnit[] = [];

  /**
   * Translation blocks waiting for a paired unit later in their own region.
   */
  let held: readonly DocumentNode[] = [];
  for (const unit of units) {
    if (unit.kind === 'anchored') {
      // THE REGION ENDS HERE. Anything still held has no paired unit before it
      // in this region, since one would have taken it, and cannot reach past
      // this anchor to the next region. It stays in the document uncovered.
      held = [];
      kept.push(unit,);
      continue;
    }
    if (unit.sourceRun
      .length
      > 0) {
      kept.push(extendPaired({
        unit,
        leading: held,
        trailing: [],
      },),);
      held = [];
      continue;
    }

    /**
     * Unit immediately before this orphan run, which is in its region exactly
     * when it is paired: an anchor would have ended the region.
     */
    const previous = kept.at(-1,);
    if (previous?.kind === 'paired') {
      kept[kept.length - 1] = extendPaired({
        unit: previous,
        leading: [],
        trailing: unit.targetRun,
      },);
      continue;
    }
    held = [
      ...held,
      ...unit.targetRun,
    ];
  }
  return kept;
}

//endregion Orphan reflow
