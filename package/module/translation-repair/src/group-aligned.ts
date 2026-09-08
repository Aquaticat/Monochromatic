import {
  alignBlocks,
  type AlignmentStep,
} from './align-blocks-walk.ts';
import { declinedTargetIds, } from './declined-target-runs.ts';
import type { DocumentNode, } from './document-node.ts';
import {
  mergeOneSidedRuns,
  NOT_AN_INSERTION,
  type OpenRun,
} from './group-merge.ts';
import { reanchorInsertions, } from './group-run-anchor.ts';
import { anchorOffsets, } from './group-source-anchor.ts';

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
//
// SEALED BLOCKS ARE THE ONE DELIBERATE ABSENCE, added 2026-09-08 for the
// owner's rule that a span the archive's note calls the English original ships
// as it stands (`archive-original-note.ts`). A sealed translation block and the
// original paired with it (the back-translation) form a run of their own that
// no neighbour may absorb and no slice is made from; it is dropped once the
// runs are settled. It is KEPT UNTIL THEN on purpose: the anchors of the
// originals either side of it are read off its span, so a footnote definition
// the source carries after a sealed letter is written after the letter rather
// than folded into the passage before it.

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
 * A run of translation blocks the archive's note seals, with the originals
 * paired to them, which stands between the runs beside it while anchors are
 * read and is dropped before any slice is made.
 *
 * @example
 * ```ts
 * const run: SealedRun = { kind: 'sealed', sourceRun: [node,], targetRun: [node,], };
 * ```
 */
export type SealedRun = {
  /**
   * Names the run as sealed: no slice, no lane, the archive's bytes stand.
   */
  readonly kind: 'sealed';

  /**
   * Originals paired to the sealed blocks, in document order; the
   * back-translation, which no lane reads.
   */
  readonly sourceRun: readonly DocumentNode[];

  /**
   * Sealed translation blocks, in document order.
   */
  readonly targetRun: readonly DocumentNode[];
};

/**
 * A run as it stands between grouping and the slices: shippable, or sealed.
 *
 * @example
 * ```ts
 * const runs: GroupedRun[] = [ { kind: 'sealed', sourceRun, targetRun, }, ];
 * ```
 */
export type GroupedRun = AlignedRun | SealedRun;

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
 * Walks the steps into open runs, closing on budget, on a decline, on a change
 * of kind and on either side of a sealed block.
 *
 * @param sourceNodes - original blocks in document order
 *
 * @param targetNodes - translation blocks in document order
 *
 * @param sourceBudget - original-side character budget per slice
 *
 * @param targetBudget - translation-side character budget per slice
 *
 * @param walk - steps in document order
 *
 * @param supplied - whether the walk came from a roster, which is the one
 * case a target-only step declines and a source-only step is an absence
 *
 * @param sealed - ids of translation blocks the archive's note seals
 *
 * @returns Open runs in document order, sealed ones marked
 *
 * @example
 * ```ts
 * const runs = walkIntoRuns({ sourceNodes, targetNodes, sourceBudget, targetBudget, walk, supplied: true, sealed, },);
 * ```
 */
function walkIntoRuns(
  {
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
    walk,
    supplied,
    sealed,
  }: {
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
    readonly sourceBudget: number;
    readonly targetBudget: number;
    readonly walk: readonly AlignmentStep[];
    readonly supplied: boolean;
    readonly sealed: ReadonlySet<string>;
  },
): readonly OpenRun[] {
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

  /**
   * Blocks no original claims, EMPTY when the scorer produced the walk.
   *
   * The scorer cannot abstain, so its `target-only` steps report where its
   * heuristic ran out rather than a decision that nothing renders this block.
   * Dropping those would hide content on the strength of length and token
   * overlap, which is the evidence `llm-assisted-block-pairing.md` found
   * insufficient in the first place.
   */
  const declined = supplied
    ? declinedTargetIds({
      steps: walk,
      targetNodes,
    },)
    : new Set<string>();
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
   *
   * READ OVER THE WHOLE WALK, sealed steps included, so an original behind a
   * sealed block is anchored at the sealed block's end rather than at the end
   * of whatever precedes the seal.
   */
  const anchors = supplied
    ? anchorOffsets({
      walk,
      targetNodes,
    },)
    : new Map<number, number>();
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
     * Whether the run being filled is a sealed one.
     */
    const openIsSealed = (current !== undefined) && current.sealed;

    /**
     * Whether this step belongs to a sealed block: it names one, or it
     * continues the rendering of the sealed run being built.
     */
    const sealsHere = targetNode.some(function isSealed(node,): boolean {
      return sealed.has(node.id,);
    },)
      || (cohesive && openIsSealed);
    if (sealsHere) {
      if (cohesive && openIsSealed) {
        current.sourceRun
          .push(...sourceNode,);
        current.targetRun
          .push(...targetNode,);
        continue;
      }
      runs.push({
        sourceRun: [ ...sourceNode, ],
        targetRun: [ ...targetNode, ],
        anchor: NOT_AN_INSERTION,
        sealed: true,
      },);
      open.sourceChars = 0;
      open.targetChars = 0;
      continue;
    }

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
     * page". A SEALED RUN is closed the same way from the other side.
     */
    const sameKindAsOpen = (current !== undefined)
      && (current.anchor === anchor)
      && (!current.sealed);
    if (afterDecline.has(at,)
      || (!sameKindAsOpen)
      || ((!cohesive) && overBudget)) {
      runs.push({
        sourceRun: [ ...sourceNode, ],
        targetRun: [ ...targetNode, ],
        anchor,
        sealed: false,
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
  return runs;
}

/**
 * Groups an aligned block pair into budget-bounded runs, keeping the blocks the
 * archive's note seals out of every run.
 *
 * @param sourceNodes - original blocks in document order
 *
 * @param targetNodes - translation blocks in document order
 *
 * @param sourceBudget - original-side character budget per slice
 *
 * @param targetBudget - translation-side character budget per slice
 *
 * @param steps - roster's pairing as steps, when the caller has one
 *
 * @param sealed - ids of translation blocks that ship as they stand
 *
 * @returns Runs covering every unsealed block on both sides exactly once,
 * beside the ids of the originals the sealed blocks took with them
 *
 * @example
 * ```ts
 * const { runs, sealedSourceIds, } = groupNodesSealed({
 *   sourceNodes,
 *   targetNodes,
 *   sourceBudget: 900,
 *   targetBudget: 1600,
 *   sealed: new Set(['block/7',],),
 * },);
 * ```
 */
export function groupNodesSealed(
  {
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
    steps,
    sealed,
  }: {
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
    readonly sourceBudget: number;
    readonly targetBudget: number;
    readonly steps?: readonly AlignmentStep[];
    readonly sealed: ReadonlySet<string>;
  },
): {
  readonly runs: readonly AlignedRun[];
  readonly sealedSourceIds: ReadonlySet<string>;
} {
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
   * Runs as walked, sealed ones marked.
   */
  const open = walkIntoRuns({
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
    walk,
    supplied: steps !== undefined,
    sealed,
  },);
  // ANCHORS COME LAST, because merging is what invalidates them: folding an
  // unclaimed translation into a neighbour stretches that run's span over it,
  // and an anchor naming that block's start then points inside a passage.
  /**
   * Settled runs, sealed ones still standing where they were for the anchors.
   */
  const settled = reanchorInsertions({ runs: mergeOneSidedRuns({ runs: open, },), },);
  return {
    runs: settled.filter(function ships(run,): run is AlignedRun {
      return run.kind !== 'sealed';
    },),
    sealedSourceIds: new Set(
      settled
        .filter(function isSealed(run,): run is SealedRun {
          return run.kind === 'sealed';
        },)
        .flatMap(function toSourceIds(run,): readonly string[] {
          return run.sourceRun
            .map(function toId(node,): string {
              return node.id;
            },);
        },),
    ),
  };
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
  return groupNodesSealed({
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
    ...((steps === undefined) ? {} : { steps, }),
    sealed: new Set<string>(),
  },)
    .runs;
}

//endregion Aligned run grouping
