import type { AlignmentStep, } from './align-blocks-walk.ts';
import type { DocumentNode, } from './document-node.ts';
import { blockPairingToSteps, } from './pair-blocks-steps.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';

//region Declined target blocks
// Translation blocks the roster's pairing accounted for NOWHERE, kept out of
// every slice instead of being swept into whichever one sits beside them.
//
// WHAT THIS EXISTS TO STOP, measured on `Zha_Ke` and recorded in
// `doc/planning/one-sided-pairing-census.md`. Its English page carries a letter
// its Chinese page does not, 2909 dense characters of it. The roster paired all
// four source blocks correctly and left the letter's two blocks unpaired, which
// is exactly the refusal `#71` asked for. Grouping then closed the run on
// budget, `mergeOneSidedRuns` folded the target-only run BACKWARDS into its
// neighbour, and the slice reached the judges as 41 characters of source
// against 3875 characters of standing English. Ninety-three percent of what
// they compared was text the pairing had already declined. Shown that, a panel
// correctly reports the standing text as unsupported, and a consolidation
// deleted the letter.
//
// WHY FILTERING THE RUN LIST IS NOT THE FIX. A run's text is the span from its
// first offset to its last, so dropping a block from the LIST leaves its bytes
// inside the range and changes only the record. `span-contiguity.ts` refuses
// that shape and is right to. The block has to leave the run's SPAN, which
// means the run has to close before it.
//
// UNCOVERED IS NOT DELETED. `splice-slices.ts` writes replacements over slice
// spans in offset-descending order and never touches text between them, so a
// block in no slice survives byte for byte. What it costs is review: no lane
// reads it, so nothing improves it and nothing checks it. For a letter the
// source never mentions, preserving it is the job and improving it is not.
//
// ONLY WHEN THE ROSTER SPOKE. `alignBlocks`, the scorer fallback, also emits
// `target-only` steps, and those are not a decline: the scorer always returns
// an answer and has no way to abstain. Skipping its target blocks would hide
// content on the strength of a heuristic. So the caller supplies steps only
// when a pairing came back from the roster, and only then does a target-only
// step mean nobody claimed this.
//
// ONLY A PAIRING THAT PLACED EVERY ORIGINAL DECLINES ANYTHING. A reply that
// leaves an original block unaccounted for did not finish reading the pair, and
// its silences are gaps rather than decisions. The empty pairing is the case
// that forces this: `pairBlocksAcrossRoster` returns no pairs when no voice was
// usable, the caller passes that straight through, and without this gate EVERY
// translation block would count as declined and the whole section would leave
// review at once.
//
// WHAT IT COSTS is that an entry with a genuinely untranslated passage gets no
// declines at all, since that passage arrives as a `source-only` step. The fix
// simply does not apply there. That is the conservative direction: the harm
// this exists to stop is a memorial letter being deleted, and the harm of not
// applying it is a slice staying as wide as it is today.
//
// A SPLIT RENDERING IS NOT THIS. `readBlockPairing` permits repeats on both
// sides precisely so one original rendered as two translation blocks can say
// so, and the second block then arrives as a `target-only` step carrying
// `continuesPairing`. Those continue their pairing and are never declined here,
// which is why no size threshold is needed to tell the two apart.

/**
 * Reads the translation blocks a supplied pairing accounted for nowhere.
 *
 * A block qualifies when the only step naming it is `target-only` AND that step
 * does not continue an earlier pairing, so a split rendering's later halves are
 * excluded by construction rather than by size.
 *
 * @param steps - alignment steps built from a roster pairing, never the scorer's
 *
 * @param targetNodes - translation blocks in document order, indexed by step
 *
 * @returns Blocks no original claims, in document order
 *
 * @example
 * ```ts
 * const declined = declinedTargetBlocks({ steps, targetNodes, },);
 * ```
 */
export function declinedTargetBlocks(
  {
    steps,
    targetNodes,
  }: {
    readonly steps: readonly AlignmentStep[];
    readonly targetNodes: readonly DocumentNode[];
  },
): readonly DocumentNode[] {
  // A pairing that left an original block unplaced did not finish reading the
  // pair, so nothing here is a decision about the translation side.
  if (steps.some(function leavesOriginal(step,): boolean {
    return step.kind === 'source-only';
  },))
    return [];

  // Nor does a pairing that placed nothing at all decline everything.
  if (!steps.some(function pairsSomething(step,): boolean {
    return step.kind === 'paired';
  },))
    return [];

  /**
   * Indices reached by a step that continues a pairing or pairs outright, so a
   * later `target-only` step naming the same block cannot decline it.
   */
  const claimed = new Set<number>(
    steps
      .filter(function isClaiming(step,): boolean {
        return (step.kind !== 'target-only') || (step.continuesPairing === true);
      },)
      .flatMap(function toTargetIndex(step,): readonly number[] {
        return (step.kind === 'source-only')
          ? []
          : [ step.targetIndex, ];
      },),
  );

  return steps
    .filter(function isDeclined(step,): boolean {
      return (step.kind === 'target-only')
        && (step.continuesPairing !== true)
        && (!claimed.has(step.targetIndex,));
    },)
    .flatMap(function toNode(step,): readonly DocumentNode[] {
      /**
       * Block the step names, absent when the step indexes past the sequence.
       */
      const node = (step.kind === 'target-only')
        ? targetNodes[step.targetIndex]
        : undefined;
      return (node === undefined)
        ? []
        : [ node, ];
    },);
}

/**
 * Reads the ids of blocks a supplied pairing accounted for nowhere.
 *
 * Separate from {@link declinedTargetBlocks} because grouping needs identity to
 * decide which runs to drop, while the artifact and the coverage exemption need
 * the blocks themselves.
 *
 * @param steps - alignment steps built from a roster pairing, never the scorer's
 *
 * @param targetNodes - translation blocks in document order, indexed by step
 *
 * @returns Ids of blocks no original claims
 *
 * @example
 * ```ts
 * const ids = declinedTargetIds({ steps, targetNodes, },);
 * ```
 */
export function declinedTargetIds(
  {
    steps,
    targetNodes,
  }: {
    readonly steps: readonly AlignmentStep[];
    readonly targetNodes: readonly DocumentNode[];
  },
): ReadonlySet<string> {
  return new Set(
    declinedTargetBlocks({
      steps,
      targetNodes,
    },)
      .map(function toId(node,): string {
        return node.id;
      },),
  );
}


/**
 * Reads the declined block ids straight from a roster pairing.
 *
 * Exists so grouping and the coverage assertion derive the SAME set from the
 * same inputs rather than each rebuilding the steps, since a disagreement
 * between them reads as a coverage fault at a place neither one caused.
 *
 * @param pairs - correspondences the roster returned for this chunk
 *
 * @param sourceNodes - original blocks in document order
 *
 * @param targetNodes - translation blocks in document order
 *
 * @returns Ids of translation blocks no original claims
 *
 * @example
 * ```ts
 * const ids = declinedTargetIdsOfPairing({ pairs, sourceNodes, targetNodes, },);
 * ```
 */
export function declinedTargetIdsOfPairing(
  {
    pairs,
    sourceNodes,
    targetNodes,
  }: {
    readonly pairs: readonly BlockPair[];
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
  },
): ReadonlySet<string> {
  return declinedTargetIds({
    steps: blockPairingToSteps({
      pairs,
      sourceCount: sourceNodes.length,
      targetCount: targetNodes.length,
    },),
    targetNodes,
  },);
}

//endregion Declined target blocks
