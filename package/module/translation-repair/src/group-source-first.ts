import {
  alignBlocks,
  type AlignmentStep,
} from './align-blocks-walk.ts';
import type { DocumentNode, } from './document-node.ts';
import { groupNodes, } from './slice-pair.ts';

//region Source-first grouping
// Grouping that keeps every source block, including the ones the translation
// never rendered.
//
// WHAT IT REPLACES, and why the replacement is not a patch. The existing
// grouper folds a run that ended up one-sided into its neighbour, so a source
// paragraph nobody translated is carried inside a slice about a different
// passage: the lane sees it, and has nowhere to put a rendering of it, because
// the slice it belongs to already covers text that is there. Source coverage is
// the invariant this is built around, so a source run with no counterpart
// becomes its own unit, carrying the BOUNDARY where its translation belongs.
//
// TARGET INTERVALS ARE CONTIGUOUS BY CONSTRUCTION. A paired unit's target side
// is every block from its first supported index to its last, taken as a slice
// of the whole target sequence rather than as the list of blocks the alignment
// happened to pair. Filtering would leave a block inside the emitted offsets
// and outside the run, which reads correctly at every later stage and is
// replaced at assembly by a decision that never saw it; `span-contiguity.ts`
// refuses that shape, and this is what keeps it from arising.
//
// A TARGET-ONLY RUN JOINS A NEIGHBOUR rather than becoming a gap nothing
// covers. It is text the archive has and the original does not, so no slice
// NEEDS it; leaving it uncovered would still be safe for assembly, since
// nothing writes there, and it would drop the block out of review entirely. It
// joins the paired unit before it where one exists and the one after it
// otherwise, which is where today's grouping puts it too.
//
// MANY-TO-ONE CANNOT ARISE HERE, which is worth stating because the design this
// implements guards against it. Every step of `alignBlocks` consumes at most one
// index per side, so no target block is paired with two source blocks and no
// interval can be claimed twice.

/**
 * One slice's worth of blocks, either paired with existing text or anchored at
 * the boundary where its translation belongs.
 *
 * @example
 * ```ts
 * const unit: SourceFirstUnit = { kind: 'anchored', sourceRun, boundaryIndex: 4, };
 * ```
 */
export type SourceFirstUnit = {
  /**
   * Both sides carry blocks, and the target side is a contiguous interval.
   */
  readonly kind: 'paired';

  /**
   * Original-side blocks, in document order.
   */
  readonly sourceRun: readonly DocumentNode[];

  /**
   * Translation-side blocks, contiguous in the whole target sequence.
   */
  readonly targetRun: readonly DocumentNode[];
} | {
  /**
   * Original-side blocks the translation never rendered.
   */
  readonly kind: 'anchored';

  /**
   * Original-side blocks, in document order.
   */
  readonly sourceRun: readonly DocumentNode[];

  /**
   * Index of the target block this unit's translation belongs BEFORE.
   *
   * Equal to the target block count when it belongs after everything, which is
   * what a trailing untranslated passage looks like. The caller turns this into
   * an offset, since only it knows where the enclosing section ends.
   */
  readonly boundaryIndex: number;
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
 * Reads the blocks a list of indices names, dropping any the sequence lacks.
 *
 * @param indices - positions in document order
 *
 * @param nodes - whole block sequence they index into
 *
 * @returns Blocks at those positions, in the order given
 *
 * @example
 * ```ts
 * const run = nodesAt({ indices: group.sourceIndices, nodes: sourceNodes, },);
 * ```
 */
function nodesAt(
  {
    indices,
    nodes,
  }: {
    readonly indices: readonly number[];
    readonly nodes: readonly DocumentNode[];
  },
): readonly DocumentNode[] {
  /**
   * Blocks gathered so far.
   */
  const run: DocumentNode[] = [];
  for (const index of indices) {
    /**
     * Block at this position, absent when the caller named one the sequence
     * does not hold.
     */
    const node = nodes[index];
    if (node === undefined)
      continue;
    run.push(node,);
  }
  return run;
}

/**
 * Character span of the block at one position, or none when there is none.
 *
 * @param index - position in the sequence
 *
 * @param nodes - whole block sequence
 *
 * @returns Span length in characters, zero where the sequence is shorter
 *
 * @example
 * ```ts
 * const chars = charsAt({ index: step.sourceIndex, nodes: sourceNodes, },);
 * ```
 */
function charsAt(
  {
    index,
    nodes,
  }: {
    readonly index: number;
    readonly nodes: readonly DocumentNode[];
  },
): number {
  /**
   * Block at that position, absent when the caller named one the sequence does
   * not hold.
   */
  const node = nodes[index];
  if (node === undefined)
    return 0;
  return nodeChars(node,);
}

/**
 * Group under construction, before its target interval is materialized.
 */
type OpenGroup = {
  /**
   * Original-side block indices gathered so far.
   */
  readonly sourceIndices: number[];

  /**
   * Lowest target index this group supports, meaningless until it supports one.
   */
  lowIndex: number;

  /**
   * Highest target index it supports, meaningless until it supports one.
   */
  highIndex: number;

  /**
   * Whether any target block has joined it yet.
   */
  supported: boolean;
};

/**
 * Opens an empty group.
 *
 * @returns Group carrying nothing yet
 *
 * @example
 * ```ts
 * const group = emptyGroup();
 * ```
 */
function emptyGroup(): OpenGroup {
  return {
    sourceIndices: [],
    lowIndex: 0,
    highIndex: 0,
    supported: false,
  };
}

/**
 * Attaches target blocks no source block accounts for to a neighbour.
 *
 * A group can close with translation blocks and no original ones: a target-only
 * run following an untranslated passage starts a fresh group, and nothing pairs
 * with it. Such a group cannot be a slice, since every stage compares an
 * original against a translation, so its blocks join the paired unit BEFORE it
 * where one exists and the one after it otherwise.
 *
 * CONTIGUITY SURVIVES because groups partition the target indices into
 * consecutive ranges: every index is consumed by exactly one step, in order, so
 * an orphan run sits immediately after the previous unit's interval and
 * immediately before the next one's.
 *
 * @param units - units as grouped, possibly including source-less ones
 *
 * @returns Units that all carry original blocks
 *
 * @example
 * ```ts
 * const usable = reflowOrphans({ units, },);
 * ```
 */
function reflowOrphans(
  { units, }: { readonly units: readonly SourceFirstUnit[]; },
): readonly SourceFirstUnit[] {
  /**
   * Units that carry original blocks, rebuilt as orphans are attached.
   */
  const kept: SourceFirstUnit[] = [];

  /**
   * Translation blocks waiting for a unit to belong to.
   */
  const held: DocumentNode[] = [];
  for (const unit of units) {
    if (unit.kind === 'anchored') {
      kept.push(unit,);
      continue;
    }
    if (unit.sourceRun
      .length
      === 0) {
      held.push(...unit.targetRun,);
      continue;
    }
    kept.push({
      kind: 'paired',
      sourceRun: unit.sourceRun,
      targetRun: [
        ...held.splice(0,),
        ...unit.targetRun,
      ],
    },);
  }
  if (held.length === 0)
    return kept;

  /**
   * Position of the last unit able to carry what is still held.
   */
  const tailIndex = kept.findLastIndex(function isPaired(unit,): boolean {
    return unit.kind === 'paired';
  },);
  return kept.map(function toAttached(
    unit,
    position,
  ): SourceFirstUnit {
    if (position !== tailIndex)
      return unit;
    if (unit.kind !== 'paired')
      return unit;
    return {
      kind: 'paired',
      sourceRun: unit.sourceRun,
      targetRun: [
        ...unit.targetRun,
        ...held,
      ],
    };
  },);
}

/**
 * Groups a monotone alignment into units, source-first.
 *
 * SEPARATE FROM THE ALIGNING, because they fail differently and are read
 * differently. Which block pairs with which is a judgement the aligner makes
 * from similarity; what a unit covers, where an anchor sits and whether an
 * interval is contiguous are consequences of the steps alone. A test of the
 * grouping that had to guess the aligner's judgement would be a test of the
 * aligner.
 *
 * @param steps - monotone alignment steps, in document order
 *
 * @param sourceNodes - original blocks of this section, in order
 *
 * @param targetNodes - translation blocks of this section, in order
 *
 * @param sourceBudget - original characters one slice aims for
 *
 * @param targetBudget - translation characters one slice aims for
 *
 * @returns Units in document order, each either paired or anchored
 *
 * @example
 * ```ts
 * const units = groupAlignedSteps({ steps, sourceNodes, targetNodes, sourceBudget, targetBudget, },);
 * ```
 */
export function groupAlignedSteps(
  {
    steps,
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
  }: {
    readonly steps: readonly AlignmentStep[];
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
    readonly sourceBudget: number;
    readonly targetBudget: number;
  },
): readonly SourceFirstUnit[] {
  /**
   * Units closed so far, in document order.
   */
  const units: SourceFirstUnit[] = [];

  /**
   * Everything the walk carries between steps: the open group, what it has
   * spent, and the untranslated blocks waiting for a boundary.
   */
  const state = {
    group: emptyGroup(),
    sourceChars: 0,
    targetChars: 0,
    pendingSource: [] as number[],
  };

  /**
   * Closes the open group into the unit list.
   *
   * A group with blocks on neither side closes to nothing, which is what the
   * first step of a walk finds.
   *
   * @example
   * ```ts
   * flushGroup();
   * ```
   */
  function flushGroup(): void {
    /**
     * Original blocks this group gathered.
     */
    const sourceRun = nodesAt({
      indices: state.group
        .sourceIndices,
      nodes: sourceNodes,
    },);

    /**
     * Translation blocks it covers, as a contiguous interval rather than as the
     * paired ones alone: a block the alignment left unpartnered inside the
     * interval belongs to this slice, since the slice's offsets contain it.
     */
    const closing = state.group;

    /**
     * Where its interval ends, exclusive.
     */
    const closingEnd = closing.highIndex + 1;

    /**
     * Blocks it covers, or none when no target block joined it.
     */
    const targetRun = closing.supported
      ? targetNodes.slice(
        closing.lowIndex,
        closingEnd,
      )
      : [];
    state.group = emptyGroup();
    state.sourceChars = 0;
    state.targetChars = 0;
    if ((sourceRun.length === 0) && (targetRun.length === 0))
      return;
    units.push({
      kind: 'paired',
      sourceRun,
      targetRun,
    },);
  }

  /**
   * Closes the waiting untranslated blocks at a boundary.
   *
   * SPLIT BY BUDGET, ALL AT ONE BOUNDARY. Several consecutive untranslated
   * paragraphs are one passage with one place to go, and a passage larger than
   * a slice is still translated a slice at a time. Assembly composes fragments
   * sharing a boundary in slice order, so the split costs nothing in the
   * document.
   *
   * @param boundaryIndex - target block their translation belongs before
   *
   * @example
   * ```ts
   * flushPending({ boundaryIndex: step.targetIndex, },);
   * ```
   */
  function flushPending({ boundaryIndex, }: { readonly boundaryIndex: number; },): void {
    /**
     * Blocks the waiting indices name.
     */
    const waiting = nodesAt({
      indices: state.pendingSource,
      nodes: sourceNodes,
    },);
    state.pendingSource = [];
    for (const run of groupNodes({
      nodes: waiting,
      budget: sourceBudget,
    },)) {
      units.push({
        kind: 'anchored',
        sourceRun: run,
        boundaryIndex,
      },);
    }
  }

  for (const step of steps) {
    if (step.kind === 'source-only') {
      // A HARD BOUNDARY. This block has no counterpart, so it cannot join a
      // paired group: doing so is what made an untranslated passage invisible,
      // since the group it joined already covers text that is there and has
      // nowhere to put a rendering.
      flushGroup();
      state.pendingSource
        .push(step.sourceIndex,);
      continue;
    }

    /**
     * Target block this step contributes, present for both remaining kinds.
     */
    const { targetIndex, } = step;
    // The waiting blocks belong before the first target block that follows
    // them, which is this one.
    flushPending({ boundaryIndex: targetIndex, },);

    /**
     * Characters this step adds on either side.
     */
    const added = {
      source: (step.kind === 'paired')
        ? charsAt({
          index: step.sourceIndex,
          nodes: sourceNodes,
        },)
        : 0,
      target: charsAt({
        index: targetIndex,
        nodes: targetNodes,
      },),
    };

    /**
     * Whether the open group is still empty, which is the one case that must
     * accept whatever comes: a block larger than the budget still has to live
     * somewhere, and closing an empty group would loop.
     */
    const groupIsEmpty = (state.group
      .sourceIndices
      .length
      === 0)
      && (!state.group
        .supported);

    /**
     * Whether adding this step would spend past either budget.
     */
    const overBudget = ((state.sourceChars + added.source) > sourceBudget)
      || ((state.targetChars + added.target) > targetBudget);
    if ((!groupIsEmpty) && overBudget)
      flushGroup();
    if (step.kind === 'paired') {
      state.group
        .sourceIndices
        .push(step.sourceIndex,);
    }
    if (state.group
      .supported) {
      state.group
        .lowIndex = Math.min(
          state.group
            .lowIndex,
          targetIndex,
        );
      state.group
        .highIndex = Math.max(
          state.group
            .highIndex,
          targetIndex,
        );
    }
    else {
      state.group
        .lowIndex = targetIndex;
      state.group
        .highIndex = targetIndex;
      state.group
        .supported = true;
    }
    state.sourceChars += added.source;
    state.targetChars += added.target;
  }
  flushGroup();
  // TRAILING UNTRANSLATED BLOCKS belong after everything, which the block count
  // names: there is no target block for them to precede.
  flushPending({ boundaryIndex: targetNodes.length, },);

  return reflowOrphans({ units, },);
}

/**
 * Groups one section pair source-first, keeping every source block.
 *
 * @param sourceNodes - original blocks of this section, in order
 *
 * @param targetNodes - translation blocks of this section, in order
 *
 * @param sourceBudget - original characters one slice aims for
 *
 * @param targetBudget - translation characters one slice aims for
 *
 * @returns Units in document order, each either paired or anchored
 *
 * @example
 * ```ts
 * const units = groupSourceFirst({ sourceNodes, targetNodes, sourceBudget, targetBudget, },);
 * ```
 */
export function groupSourceFirst(
  {
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
  }: {
    readonly sourceNodes: readonly DocumentNode[];
    readonly targetNodes: readonly DocumentNode[];
    readonly sourceBudget: number;
    readonly targetBudget: number;
  },
): readonly SourceFirstUnit[] {
  return groupAlignedSteps({
    steps: alignBlocks({
      sourceNodes,
      targetNodes,
    },),
    sourceNodes,
    targetNodes,
    sourceBudget,
    targetBudget,
  },);
}

/**
 * Total original characters one unit carries.
 *
 * @param unit - unit to measure
 *
 * @returns Span length in characters
 *
 * @example
 * ```ts
 * const chars = unitSourceChars({ unit, },);
 * ```
 */
export function unitSourceChars(
  { unit, }: { readonly unit: SourceFirstUnit; },
): number {
  return unit.sourceRun
    .reduce(
      function addChars(
        sum,
        node,
      ): number {
        return sum + nodeChars(node,);
      },
      0,
    );
}

//endregion Source-first grouping
