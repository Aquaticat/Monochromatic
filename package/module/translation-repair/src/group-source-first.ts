import {
  alignBlocks,
  type AlignmentStep,
} from './align-blocks-walk.ts';
import type { DocumentNode, } from './document-node.ts';
import { groupNodes, } from './group-nodes.ts';
import { reflowOrphans, } from './reflow-orphans.ts';
import type {
  SourceFirstUnit,
  TargetBoundary,
} from './source-first-unit.ts';

export type {
  SourceFirstUnit,
  TargetBoundary,
} from './source-first-unit.ts';

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
// A TARGET-ONLY RUN JOINS A NEIGHBOUR IN ITS OWN REGION rather than becoming a
// gap nothing covers, and `reflow-orphans.ts` states the rule and why an anchor
// bounds it.
//
// AN ANCHORED UNIT DOES NOT PROVE THE PASSAGE IS UNTRANSLATED, which is the
// limit this grouping cannot lift by itself and the reason nothing wires it up
// yet. `alignBlocks` has exactly three moves: pair one with one, skip a source
// block, skip a target block. It CANNOT say that two source paragraphs were
// rendered as one, so when a translation merges a pair, the aligner spends its
// only available move and reports the second paragraph as source-only. This
// grouping then anchors it, and a lane reading that anchor would render a
// passage the translation already carries, inserting it twice. Measured on
// three source paragraphs whose translation merges the first two: the aligner
// emits `source-only` for the merged one and the walk anchors it. Telling
// omission from merging needs evidence the aligner does not produce, so `#106`
// holds the wiring until there is some.

/**
 * Thrown when alignment steps name a block their sequence does not hold.
 *
 * @example
 * ```ts
 * throw new AlignedIndexError({ message: 'source index 4 of 3 blocks', },);
 * ```
 */
export class AlignedIndexError extends Error {
  /**
   * Builds failure naming the position and the sequence it missed.
   *
   * @param message - what was named and what was there
   *
   * @example
   * ```ts
   * throw new AlignedIndexError({ message: 'target index -1', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'AlignedIndexError';
  }
}

/**
 * Reads the block one position names.
 *
 * REFUSES RATHER THAN FALLING BACK. A step naming a block that is not there is
 * a malformed alignment, and every silent answer to it is worse than a
 * diagnostic: dropping the index shortens a run that then covers a span it does
 * not carry, and treating it as the end of the sequence anchors a passage at a
 * place nothing chose.
 *
 * @param index - position in the sequence
 *
 * @param nodes - whole block sequence
 *
 * @param side - which side, for the message
 *
 * @returns Block at that position
 *
 * @throws {@link AlignedIndexError} when the sequence has no such position
 *
 * @example
 * ```ts
 * const node = nodeAt({ index: step.targetIndex, nodes: targetNodes, side: 'target', },);
 * ```
 */
function nodeAt(
  {
    index,
    nodes,
    side,
  }: {
    readonly index: number;
    readonly nodes: readonly DocumentNode[];
    readonly side: string;
  },
): DocumentNode {
  /**
   * Block at that position, absent when the alignment named one the sequence
   * does not hold.
   */
  const node = nodes[index];
  if (node === undefined) {
    throw new AlignedIndexError({
      message: `alignment names ${side} block ${String(index,)} of ${String(nodes.length,)}`,
    },);
  }
  return node;
}

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
 * Reads the blocks a list of indices names.
 *
 * @param indices - positions in document order
 *
 * @param nodes - whole block sequence they index into
 *
 * @param side - which side, for the message
 *
 * @returns Blocks at those positions, in the order given
 *
 * @throws {@link AlignedIndexError} when any position is not in the sequence
 *
 * @example
 * ```ts
 * const run = nodesAt({ indices: group.sourceIndices, nodes: sourceNodes, side: 'source', },);
 * ```
 */
function nodesAt(
  {
    indices,
    nodes,
    side,
  }: {
    readonly indices: readonly number[];
    readonly nodes: readonly DocumentNode[];
    readonly side: string;
  },
): readonly DocumentNode[] {
  return indices.map(function toNode(index,): DocumentNode {
    return nodeAt({
      index,
      nodes,
      side,
    },);
  },);
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
      side: 'source',
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
   * @param boundary - place on the target side their translation belongs at
   *
   * @example
   * ```ts
   * flushPending({ boundary: { kind: 'after-section', }, },);
   * ```
   */
  function flushPending({ boundary, }: { readonly boundary: TargetBoundary; },): void {
    /**
     * Blocks the waiting indices name.
     */
    const waiting = nodesAt({
      indices: state.pendingSource,
      nodes: sourceNodes,
      side: 'source',
    },);
    state.pendingSource = [];
    for (const run of groupNodes({
      nodes: waiting,
      budget: sourceBudget,
    },)) {
      units.push({
        kind: 'anchored',
        sourceRun: run,
        boundary,
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
    flushPending({
      boundary: {
        kind: 'before-block',
        block: nodeAt({
          index: targetIndex,
          nodes: targetNodes,
          side: 'target',
        },),
      },
    },);

    /**
     * Characters this step adds on either side.
     */
    const added = {
      source: (step.kind === 'paired')
        ? nodeChars(nodeAt({
          index: step.sourceIndex,
          nodes: sourceNodes,
          side: 'source',
        },),)
        : 0,
      target: nodeChars(nodeAt({
        index: targetIndex,
        nodes: targetNodes,
        side: 'target',
      },),),
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
  // TRAILING UNTRANSLATED BLOCKS belong after everything: there is no target
  // block for them to precede, and only the caller knows where the section ends.
  flushPending({ boundary: { kind: 'after-section', }, },);

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
