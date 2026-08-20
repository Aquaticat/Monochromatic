import {
  alignBlocks,
  type AlignmentStep,
} from './align-blocks-walk.ts';
import type { DocumentNode, } from './document-node.ts';

//region Aligned run grouping
// Turns a monotone block alignment into budget-bounded slice runs. This
// replaces pairing by shared index, which assumed equal node counts implied
// one-to-one correspondence and drifted silently whenever a translation
// dropped or folded a block.
//
// Unpartnered blocks are NOT dropped. A block the counterpart lacks joins the
// run being built, so the slice still covers it and a critic still reads it in
// context. Dropping it would hide whatever it contains, trading a false
// positive for a silent false negative, which is the worse failure: the run's
// text is sliced from first to last offset, so leaving a block out of the run
// would not even remove it from the text, only from the record of what the
// slice was built from.

/**
 * One slice's paired node runs.
 *
 * @example
 * ```ts
 * const run: AlignedRun = { sourceRun: [node,], targetRun: [node,], };
 * ```
 */
export type AlignedRun = {
  /**
   * Original-side blocks of this slice, in document order.
   */
  readonly sourceRun: readonly DocumentNode[];

  /**
   * Translation-side blocks of this slice, in document order.
   */
  readonly targetRun: readonly DocumentNode[];
};

/**
 * Mutable run under construction, plus the character counts deciding when it
 * closes.
 */
type OpenRun = {
  /**
   * Original-side blocks gathered so far.
   */
  readonly sourceRun: DocumentNode[];

  /**
   * Translation-side blocks gathered so far.
   */
  readonly targetRun: DocumentNode[];
};

/**
 * Character span of one block.
 *
 * @param node - block to measure
 *
 * @returns Span length in characters
 *
 * @example
 * ```ts
 * const chars = nodeChars(node,);
 * ```
 */
function nodeChars(node: DocumentNode,): number {
  return node.endOffset - node.startOffset;
}

/**
 * Folds runs that ended up with nothing on one side into a neighbour. A run of
 * purely unpartnered blocks has no counterpart to compare against, and every
 * later stage requires both sides to be non-empty, so it joins the run beside
 * it rather than becoming a slice that cannot be reviewed. It merges backwards
 * when a previous run exists and forwards otherwise, which keeps a leading run
 * of skips attached to the first reviewable slice.
 *
 * @param runs - runs as grouped, possibly one-sided
 *
 * @returns Runs that all carry blocks on both sides
 *
 * @example
 * ```ts
 * const usable = mergeOneSidedRuns({ runs, },);
 * ```
 */
function mergeOneSidedRuns(
  { runs, }: { readonly runs: readonly AlignedRun[]; },
): readonly AlignedRun[] {
  /**
   * Runs that carry both sides, each replaced wholesale when it absorbs a
   * one-sided neighbour so no run is ever mutated in place.
   */
  const merged: AlignedRun[] = [];

  /**
   * Blocks from leading one-sided runs, waiting for the first run that can
   * carry them.
   */
  const heldSource: DocumentNode[] = [];

  /**
   * Translation-side counterpart of the held blocks.
   */
  const heldTarget: DocumentNode[] = [];
  for (const run of runs) {
    /**
     * Whether this run can stand as a slice of its own.
     */
    const twoSided = (run.sourceRun
      .length
      > 0)
      && (run.targetRun
        .length
        > 0);

    /**
     * Previous complete run, which absorbs a one-sided run when one exists.
     */
    const previous = merged.at(-1,);
    if ((!twoSided) && (previous !== undefined)) {
      merged[merged.length - 1] = {
        sourceRun: [
          ...previous.sourceRun,
          ...run.sourceRun,
        ],
        targetRun: [
          ...previous.targetRun,
          ...run.targetRun,
        ],
      };
      continue;
    }
    if (!twoSided) {
      heldSource.push(...run.sourceRun,);
      heldTarget.push(...run.targetRun,);
      continue;
    }

    // Held blocks have no earlier neighbour, so they prepend to this run.
    merged.push({
      sourceRun: [
        ...heldSource,
        ...run.sourceRun,
      ],
      targetRun: [
        ...heldTarget,
        ...run.targetRun,
      ],
    },);
    heldSource.length = 0;
    heldTarget.length = 0;
  }

  // ANYTHING STILL HELD BELONGS TO A SECTION WHOSE RUNS WERE ALL ONE-SIDED,
  // which is NOT the same as a section with an empty side. The caller only
  // reaches here when both sides carry blocks, so this is what a supplied
  // pairing that pairs nothing produces once the budget splits the unpaired
  // blocks into separate runs: source-only and target-only runs, alternating,
  // and never a two-sided one to flush into.
  //
  // Discarding them dropped the whole section. It was silent, because every
  // later reader works from the runs, and it took `assertSliceCoverage` to see
  // it: 10 of 920 randomised in-range pairings over the corpus lost a section
  // this way.
  //
  // BOTH SIDES, NOT EITHER. When only one side is held the section genuinely
  // has an empty side, which is the module's stated exception: a one-sided run
  // is a slice nobody can review, so the caller's fallback owns that case and
  // this still returns nothing.
  if ((heldSource.length > 0) && (heldTarget.length > 0))
    return [
      ...merged,
      {
        sourceRun: [ ...heldSource, ],
        targetRun: [ ...heldTarget, ],
      },
    ];
  return merged;
}

/**
 * Groups an aligned block pair into budget-bounded runs. A run closes when
 * either side would exceed its budget, so slices stay comparable in size on
 * both sides even though the two languages differ in density.
 *
 * @param sourceNodes - original blocks in document order
 *
 * @param targetNodes - translation blocks in document order
 *
 * @param sourceBudget - original-side character budget per slice
 *
 * @param targetBudget - translation-side character budget per slice
 *
 * @returns Runs covering every block on both sides exactly once
 *
 * @example
 * ```ts
 * const runs = groupNodesAligned({
 *   sourceNodes,
 *   targetNodes,
 *   sourceBudget: 900,
 *   targetBudget: 1600,
 * },);
 * ```
 */
export function groupNodesAligned(
  {
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
    steps,
  }: {
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
    readonly sourceBudget: number;
    readonly targetBudget: number;
    readonly steps?: readonly AlignmentStep[];
  },
): readonly AlignedRun[] {
  /**
   * Completed and in-progress runs in document order.
   */
  const runs: OpenRun[] = [];

  /**
   * Characters accumulated in the run currently accepting blocks, one named
   * record rather than two loose counters.
   */
  const open = {
    sourceChars: 0,
    targetChars: 0,
  };
  // A SUPPLIED PAIRING WINS, because it came from models that read both texts
  // while `alignBlocks` scores kind, script-neutral tokens and length. On this
  // corpus those three are exhausted: kind is constant across paragraphs,
  // Chinese and English prose share no Latin tokens, and length alone reaches
  // four correct pairings in eight on `saurikissa` and goes no further.
  // `doc/decision/llm-assisted-block-pairing.md` decides it; the scorer remains
  // the fallback when the roster cannot be reached or cannot agree.
  for (
    const step of (steps ?? alignBlocks({
      sourceNodes,
      targetNodes,
    },))
  ) {
    /**
     * Original block this step contributes, when it contributes one.
     */
    const sourceNode = step.kind === 'target-only'
      ? []
      : [ sourceNodes[step.sourceIndex], ].filter(function isPresent(node,) {
        return node !== undefined;
      },);

    /**
     * Translation block this step contributes, when it contributes one.
     */
    const targetNode = step.kind === 'source-only'
      ? []
      : [ targetNodes[step.targetIndex], ].filter(function isPresent(node,) {
        return node !== undefined;
      },);

    /**
     * Characters this step adds on the original side.
     */
    const sourceChars = sourceNode.reduce(
      function addChars(
        sum,
        node,
      ) {
        return sum + nodeChars(node,);
      },
      0,
    );

    /**
     * Characters this step adds on the translation side.
     */
    const targetChars = targetNode.reduce(
      function addChars(
        sum,
        node,
      ) {
        return sum + nodeChars(node,);
      },
      0,
    );

    /**
     * Run currently accepting blocks, absent before the first step.
     */
    const current = runs.at(-1,);

    /**
     * Whether this step may not be cut away from the one before it.
     *
     * A continuation renders the SAME original as the step before it, so
     * starting a new run here would hand the critics a passage with no source
     * beside it. Cohesion outranks the budget, which is a sizing heuristic
     * rather than a correctness bound, and the overrun is one block wide.
     */
    const cohesive = (step.kind !== 'paired')
      && (step.continuesPairing === true)
      && (current !== undefined);
    /**
     * Whether this step no longer fits the run being filled.
     */
    const overBudget = (current === undefined)
      || ((open.sourceChars + sourceChars) > sourceBudget)
      || ((open.targetChars + targetChars) > targetBudget);
    if ((!cohesive) && overBudget) {
      runs.push({
        sourceRun: [ ...sourceNode, ],
        targetRun: [ ...targetNode, ],
      },);
      open.sourceChars = sourceChars;
      open.targetChars = targetChars;
      continue;
    }
    current.sourceRun
      .push(...sourceNode,);
    current.targetRun
      .push(...targetNode,);
    open.sourceChars += sourceChars;
    open.targetChars += targetChars;
  }
  return mergeOneSidedRuns({ runs, },);
}

//endregion Aligned run grouping
