import {
  alignBlocks,
  type AlignmentStep,
} from './align-blocks-walk.ts';
import { declinedTargetIds, } from './declined-target-runs.ts';
import type { DocumentNode, } from './document-node.ts';
import {
  anchorOffsets,
  leavesOriginalUnplaced,
} from './group-source-anchor.ts';

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
 * const run: AlignedRun = { kind: 'paired', sourceRun: [node,], targetRun: [node,], };
 * ```
 */
export type AlignedRun =
  | {
    /**
     * Both sides carry blocks, so the slice can be compared and repaired.
     */
    readonly kind: 'paired';

    /**
     * Original-side blocks of this slice, in document order.
     */
    readonly sourceRun: readonly DocumentNode[];

    /**
     * Translation-side blocks of this slice, in document order.
     */
    readonly targetRun: readonly DocumentNode[];
  }
  | {
    /**
     * Original blocks nothing rendered, and the place their rendering belongs.
     *
     * `#100` landing 4. Before this these blocks were FOLDED into a
     * neighbouring run, which put them inside that slice's span and left the
     * lane no way to tell "this passage is missing" from "this passage is part
     * of the one beside it". Folding also cannot be undone later: once the
     * span covers them, every reader downstream sees one passage.
     */
    readonly kind: 'insertion';

    /**
     * Original-side blocks, in document order.
     */
    readonly sourceRun: readonly DocumentNode[];

    /**
     * Boundary in the translation their rendering would be written at.
     */
    readonly targetOffset: number;
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

  /**
   * Where this run's rendering belongs when it holds only unplaced originals,
   * or {@link NOT_AN_INSERTION} when it is an ordinary run.
   */
  readonly anchor: number;
};

/**
 * Anchor value for a run that is not an insertion, which no document offset can
 * collide with.
 */
const NOT_AN_INSERTION = -1;

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
 * Reads the walk positions a declined block falls immediately before.
 *
 * A DECLINED BLOCK MUST CLOSE THE RUN, not merely be skipped. A run's text is
 * cut from its first offset to its last, so a run holding the blocks either
 * side of a declined one still contains the declined bytes, and
 * `span-contiguity.ts` refuses that shape for exactly this reason. Closing
 * here is what puts the block BETWEEN two slices, where `splice-slices.ts`
 * leaves it untouched.
 *
 * @param walk - steps the grouping reads, in document order
 *
 * @param targetNodes - translation blocks the steps index
 *
 * @param declined - ids of blocks no original claims
 *
 * @returns Positions that must begin a fresh run
 *
 * @example
 * ```ts
 * const afterDecline = positionsAfterDecline({ walk, targetNodes, declined, },);
 * ```
 */
function positionsAfterDecline(
  {
    walk,
    targetNodes,
    declined,
  }: {
    readonly walk: readonly AlignmentStep[];
    readonly targetNodes: readonly DocumentNode[];
    readonly declined: ReadonlySet<string>;
  },
): ReadonlySet<number> {
  /**
   * Positions that begin a fresh run.
   */
  const positions = new Set<number>();

  /**
   * Whether a declined block has been passed with no run started since.
   */
  let sawDecline = false;
  for (const [at, step,] of walk.entries()) {
    /**
     * Block this step names on the translation side, when it names one.
     */
    const node = (step.kind === 'target-only')
      ? targetNodes[step.targetIndex]
      : undefined;
    if ((node !== undefined) && declined.has(node.id,)) {
      sawDecline = true;
      continue;
    }
    if (sawDecline) {
      positions.add(at,);
      sawDecline = false;
    }
  }
  return positions;
}

/**
 * Places blocks held from one-sided runs, never emitting a run with an empty
 * side and never dropping one.
 *
 * TWO SIDES MAKE A SLICE AND ONE SIDE FOLDS. Held blocks on both sides are a
 * reviewable slice of their own. A single side is not: `runToChunk` builds a
 * span from a run's first and last node, so a run with an empty side has no
 * span and throws. Dropping it instead is the opposite failure, and it defeats
 * `declinedTargetIds` refusing to decline a block precisely so it stays in
 * review.
 *
 * THE TWO SIDES FOLD DIFFERENTLY, because an insertion run carries originals
 * and a translation OFFSET rather than translation blocks. Held translations
 * may fold back past an insertion, which contributes none of them. Held
 * originals may not: that insertion's own originals sit between, so reaching
 * past them would report the two groups out of document order. They join the
 * insertion instead, which is where the nearest place for a rendering is.
 *
 * @param merged - runs settled so far, extended in place
 *
 * @param heldSource - original blocks waiting for somewhere to go, emptied here
 *
 * @param heldTarget - translation-side counterpart, emptied here
 *
 * @example
 * ```ts
 * placeHeldRuns({ merged, heldSource, heldTarget, },);
 * ```
 */
function placeHeldRuns(
  {
    merged,
    heldSource,
    heldTarget,
  }: {
    readonly merged: AlignedRun[];
    readonly heldSource: DocumentNode[];
    readonly heldTarget: DocumentNode[];
  },
): void {
  if ((heldSource.length === 0) && (heldTarget.length === 0))
    return;
  if ((heldSource.length > 0) && (heldTarget.length > 0)) {
    merged.push({
      kind: 'paired',
      sourceRun: [ ...heldSource, ],
      targetRun: [ ...heldTarget, ],
    },);
    heldSource.length = 0;
    heldTarget.length = 0;
    return;
  }

  /**
   * Where the held blocks fold, before the last position when only
   * translations are held and an insertion closed the list.
   */
  const at = (heldTarget.length > 0)
    ? merged.findLastIndex(function isPaired(candidate,): boolean {
      return candidate.kind === 'paired';
    },)
    : merged.length - 1;

  /**
   * Run absorbing them, absent when nothing settled yet can carry them, which
   * leaves them held for a later run or for the caller's one-sided fallback.
   */
  const host = merged[at];
  if (host === undefined)
    return;
  merged[at] = (host.kind === 'paired')
    ? {
      kind: 'paired',
      sourceRun: [
        ...host.sourceRun,
        ...heldSource,
      ],
      targetRun: [
        ...host.targetRun,
        ...heldTarget,
      ],
    }
    : {
      kind: 'insertion',
      sourceRun: [
        ...host.sourceRun,
        ...heldSource,
      ],
      targetOffset: host.targetOffset,
    };
  heldSource.length = 0;
  heldTarget.length = 0;
}

/**
 * Folds runs that ended up with nothing on one side into a neighbour, EXCEPT
 * the ones holding originals nothing rendered.
 *
 * A run of purely unpartnered TRANSLATION blocks has no original to compare
 * against and nothing to write, so it joins the run beside it rather than
 * becoming a slice nobody can review. It merges backwards when a previous run
 * exists and forwards otherwise, which keeps a leading run of skips attached to
 * the first reviewable slice.
 *
 * A run of unplaced ORIGINALS is the opposite case and `#100` landing 4 stops
 * folding it. Those blocks have something to write and nowhere yet to write it;
 * folding them into a neighbour puts them inside that slice's span, where no
 * later stage can tell them apart from the passage they were folded into.
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
  { runs, }: { readonly runs: readonly OpenRun[]; },
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
    if (run.anchor !== NOT_AN_INSERTION) {
      // An insertion run stands alone by construction: it carries originals and
      // the place their rendering goes, so there is nothing to fold it into and
      // nothing it needs from a neighbour. Held blocks still settle ahead of it,
      // since they precede it in the document.
      //
      // THIS USED TO SETTLE THEM ON EITHER SIDE BEING NON-EMPTY, which emitted
      // a `paired` run with nothing on one side and threw in `runToChunk`. It
      // reached 123 of 910 randomised reader-legal pairings over the corpus.
      placeHeldRuns({
        merged,
        heldSource,
        heldTarget,
      },);
      merged.push({
        kind: 'insertion',
        sourceRun: [ ...run.sourceRun, ],
        targetOffset: run.anchor,
      },);
      continue;
    }

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
    if ((!twoSided)
      && (previous !== undefined)
      && (previous.kind === 'paired')) {
      merged[merged.length - 1] = {
        kind: 'paired',
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
      kind: 'paired',
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
  // and never a two-sided one to settle into.
  //
  // Discarding them dropped the whole section. It was silent, because every
  // later reader works from the runs, and it took `assertSliceCoverage` to see
  // it: 10 of 920 randomised in-range pairings over the corpus lost a section
  // this way.
  //
  // A ONE-SIDED REMAINDER USED TO BE DROPPED HERE TOO, on the reasoning that a
  // one-sided run is a slice nobody can review. So it is, but folding it into
  // a settled run keeps its blocks in review, and dropping them defeated
  // `declinedTargetIds`, which declines nothing unless the pairing placed every
  // original precisely so an unclaimed translation stays. 534 of 3000
  // randomised reader-legal pairings lost a block this way, and
  // `assertSliceCoverage` then refused the document.
  //
  // The module's stated exception survives as the case `placeHeldRuns` cannot
  // settle: a section with no two-sided run at all leaves the blocks held and
  // returns without them, which is the caller's one-sided fallback.
  placeHeldRuns({
    merged,
    heldSource,
    heldTarget,
  },);
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
  /**
   * Steps the grouping walks, the roster's when it supplied them.
   */
  const walk = steps ?? alignBlocks({
    sourceNodes,
    targetNodes,
  },);

  /**
   * Blocks no original claims, EMPTY when the scorer produced the walk.
   *
   * The scorer cannot abstain, so its `target-only` steps report where its
   * heuristic ran out rather than a decision that nothing renders this block.
   * Dropping those would hide content on the strength of length and token
   * overlap, which is the evidence `llm-assisted-block-pairing.md` found
   * insufficient in the first place.
   */
  const declined = (steps === undefined)
    ? new Set<string>()
    : declinedTargetIds({
      steps,
      targetNodes,
    },);
  /**
   * Walk positions a declined block falls immediately before.
   */
  const afterDecline = positionsAfterDecline({
    walk,
    targetNodes,
    declined,
  },);

  /**
   * Walk positions holding an original nothing rendered, mapped to where its
   * rendering belongs, EMPTY when the scorer produced the walk.
   *
   * `#100` landing 4. These positions each start and end a run of their own, so
   * the blocks nothing rendered become their own slice rather than riding
   * inside a neighbour's span.
   *
   * THE SCORER CANNOT TELL A MERGE FROM AN OMISSION, which is the same reason
   * its `target-only` steps decline nothing above. It scores kind, script-
   * neutral tokens and length; facing four originals rendered as one
   * translation block it reports one pairing and three bare `source-only`
   * steps, indistinguishable from three originals nobody translated. A roster
   * that read both texts marks the difference with `continuesPairing`.
   *
   * Reading the scorer's version as absence would write a SECOND rendering of a
   * passage the page already carries, merged, which is the expensive error this
   * whole question was decided around. So an insertion needs a pairing someone
   * read the texts to produce.
   */
  const anchors = (steps === undefined)
    ? new Map<number, number>()
    : anchorOffsets({
      walk,
      targetNodes,
    },);
  for (const [at, step,] of walk.entries()) {
    /**
     * Block this step would contribute on the translation side, absent when it
     * contributes none, read before anything else so a declined one can end the
     * run without entering it.
     */
    const declinedNode = (step.kind === 'target-only')
      ? targetNodes[step.targetIndex]
      : undefined;
    if ((declinedNode !== undefined) && declined.has(declinedNode.id,))
      continue;

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
    // A DECLINE OUTRANKS COHESION, because cohesion is about which slice a
    // block belongs to and this is about which bytes a slice's span covers.
    // Keeping a continuation attached across a declined block would put the
    // declined bytes back inside the span.
    /**
     * Where this step's original belongs when nothing rendered it, or
     * {@link NOT_AN_INSERTION} when something did.
     */
    const anchor = anchors.get(at,) ?? NOT_AN_INSERTION;

    /**
     * Whether this step may join the run being filled.
     *
     * AN INSERTION RUN IS SEALED IN BOTH DIRECTIONS. It may not absorb a step
     * that was rendered, and a rendered step's run may not absorb it, because
     * the whole point is that these blocks sit outside every existing span. A
     * run mixing the two would have no single answer to "is this passage on the
     * page".
     */
    const sameKindAsOpen = (current !== undefined)
      && (current.anchor === anchor);
    if (afterDecline.has(at,)
      || (!sameKindAsOpen)
      || ((!cohesive) && overBudget)) {
      runs.push({
        sourceRun: [ ...sourceNode, ],
        targetRun: [ ...targetNode, ],
        anchor,
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
