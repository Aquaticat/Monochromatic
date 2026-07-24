import type {
  ChunkPair,
  DocumentChunk,
} from './chunk-document.ts';
import type { DocumentNode, } from './document-node.ts';

//region Paragraph slicing
// Section-scale units under-report: on real corpus entries critics emit
// ten to fourteen claims per call regardless of defect density (Anilovr:
// 13.6 claims per critic against a human-visible defect count an order of
// magnitude higher), and measured convergence collapses to 67 to 84
// percent singleton issues. Small units fix both: on a DarlinChit-scale
// unit the ensemble produced a 28-member agreement cluster. Slices are
// paragraph-bound, never sentence-bound (user decision): sentence windows
// would reward mechanical one-to-one rendering over translation of meaning
// and emotion, so a block node is never split and the budget only groups
// small adjacent nodes.

/**
 * Target-side character budget one slice aims for.
 * Derivation: DarlinChit-scale units (~1.4 KB whole documents) measured
 * excellent thoroughness and convergence, while Anilovr's ~800-char
 * sections still under-reported against human-visible density; a few
 * hundred characters groups short quote-line paragraphs while letting an
 * ordinary prose paragraph stand alone.
 */
export const SLICE_CHAR_BUDGET = 400;

/**
 * Groups one side's nodes into paragraph-bound runs within budget.
 * A node longer than the budget forms its own run; nodes never split.
 *
 * @param nodes - block nodes of one side in document order
 *
 * @param budget - characters one run aims for
 *
 * @returns Node runs partitioning input order without splitting any node
 *
 * @example
 * ```ts
 * const runs = groupNodes({ nodes: chunk.nodes, budget: 400, },);
 * ```
 */
function groupNodes(
  {
    nodes,
    budget,
  }: {
    readonly nodes: readonly DocumentNode[];
    readonly budget: number;
  },
): readonly (readonly DocumentNode[])[] {
  /**
   * Completed runs in document order.
   */
  const runs: DocumentNode[][] = [];

  /**
   * Characters accumulated in the open run.
   */
  let openChars = 0;
  for (const node of nodes) {
    /**
     * Span length of this node in document characters.
     */
    const nodeChars = node.endOffset - node.startOffset;

    /**
     * Currently open run, when any node was grouped already.
     */
    const open = runs.at(-1,);
    if ((open === undefined) || ((openChars + nodeChars) > budget)) {
      runs.push([node,],);
      openChars = nodeChars;
      continue;
    }
    open.push(node,);
    openChars += nodeChars;
  }
  return runs;
}

/**
 * Builds one chunk spanning a node run, slicing text from its document.
 *
 * @param run - node run backing this chunk
 *
 * @param documentText - owning document's text for byte-exact slicing
 *
 * @param chunkIndex - global slice index stamped onto both sides
 *
 * @returns Chunk spanning exactly this run's offsets
 *
 * @example
 * ```ts
 * const chunk = runToChunk({ run, documentText, chunkIndex: 3, },);
 * ```
 */
function runToChunk(
  {
    run,
    documentText,
    chunkIndex,
  }: {
    readonly run: readonly DocumentNode[];
    readonly documentText: string;
    readonly chunkIndex: number;
  },
): DocumentChunk {
  /**
   * First node of the run, guaranteed by construction.
   */
  const [first,] = run;

  /**
   * Last node of the run, guaranteed by construction.
   */
  const last = run.at(-1,);
  if ((first === undefined) || (last === undefined))
    throw new Error('unreachable: node runs always carry at least one node',);
  return {
    chunkIndex,
    nodes: run,
    startOffset: first.startOffset,
    endOffset: last.endOffset,
    text: documentText.slice(
      first.startOffset,
      last.endOffset,
    ),
  };
}

/**
 * Sums span characters across node runs for proportional pacing.
 *
 * @param runs - node runs whose spans accumulate
 *
 * @returns Total span characters across the runs
 *
 * @example
 * ```ts
 * const total = totalRunChars({ runs, },);
 * ```
 */
function totalRunChars(
  { runs, }: { readonly runs: readonly (readonly DocumentNode[])[]; },
): number {
  return runs.reduce(
    function addRun(
      sum,
      run,
    ) {
      /**
       * First node of the run for its opening offset.
       */
      const [first,] = run;

      /**
       * Last node of the run for its closing offset.
       */
      const last = run.at(-1,);
      return sum + ((last?.endOffset ?? 0) - (first?.startOffset ?? 0));
    },
    0,
  );
}

/**
 * Groups two equal-length node lists in lockstep, extending a slice to the
 * next shared index only while BOTH sides stay within their budgets.
 * Equal node counts mean the section's paragraphs already correspond one
 * to one -- the alignment established that -- so grouping the sides
 * together preserves the correspondence exactly. Grouping each side
 * independently (different budgets) instead lets the run counts diverge and
 * the pairing drift: the Arita off-by-one, where a tiny heading node
 * merged with its body on the dense original but isolated on the longer
 * translation, shifted every later slice by one and read as whole-document
 * non-translation. Neither run ever splits a node; the budgets only group
 * small adjacent nodes, and a single node over budget forms its own slice.
 *
 * @param sourceNodes - original-side block nodes in document order
 *
 * @param targetNodes - translation-side block nodes, one per source node
 *
 * @param sourceBudget - characters an original-side run aims for
 *
 * @param targetBudget - characters a translation-side run aims for
 *
 * @returns Paired node runs partitioning both sides in shared index windows
 *
 * @example
 * ```ts
 * const runs = groupNodesLockstep({
 *   sourceNodes: pair.source.nodes,
 *   targetNodes: pair.target.nodes,
 *   sourceBudget: 150,
 *   targetBudget: 400,
 * },);
 * ```
 */
function groupNodesLockstep(
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
): readonly {
  readonly sourceRun: readonly DocumentNode[];
  readonly targetRun: readonly DocumentNode[];
}[] {
  /**
   * Completed paired runs in document order.
   */
  const runs: {
    sourceRun: DocumentNode[];
    targetRun: DocumentNode[];
  }[] = [];

  /**
   * Original-side characters accumulated in the open run.
   */
  let openSourceChars = 0;

  /**
   * Translation-side characters accumulated in the open run.
   */
  let openTargetChars = 0;
  for (const [index, sourceNode,] of sourceNodes.entries()) {
    /**
     * Translation node sharing this index, present by equal length.
     */
    const targetNode = targetNodes[index];
    /* v8 ignore next 2 -- @preserve equal lengths guarantee a partner */
    if (targetNode === undefined)
      throw new Error('unreachable: lockstep runs over equal node counts',);

    /**
     * Original-side span length of this node.
     */
    const sourceChars = sourceNode.endOffset - sourceNode.startOffset;

    /**
     * Translation-side span length of this node.
     */
    const targetChars = targetNode.endOffset - targetNode.startOffset;

    /**
     * Currently open paired run, when any index was grouped already.
     */
    const open = runs.at(-1,);
    if (
      (open === undefined)
      || ((openSourceChars + sourceChars) > sourceBudget)
        || ((openTargetChars + targetChars) > targetBudget)
    ) {
      runs.push({
        sourceRun: [sourceNode,],
        targetRun: [targetNode,],
      },);
      openSourceChars = sourceChars;
      openTargetChars = targetChars;
      continue;
    }
    open.sourceRun
      .push(sourceNode,);
    open.targetRun
      .push(targetNode,);
    openSourceChars += sourceChars;
    openTargetChars += targetChars;
  }
  return runs;
}

/**
 * Subdivides one aligned section pair into paragraph-bound slice pairs.
 * When both sides carry the same node count their paragraphs correspond
 * one to one, so the sides group in lockstep and pair by shared index,
 * never drifting. Only a genuine paragraph-count mismatch falls back to
 * independent budget grouping with the wider side merged greedily by
 * cumulative character fraction (the same Gale-Church-style pacing section
 * alignment uses). Paragraph-count mismatch within a section is ordinary
 * translation freedom, so subdivision emits no findings.
 *
 * @param pair - aligned section pair to subdivide
 *
 * @param sourceText - whole original document text for slice extraction
 *
 * @param targetText - whole translation document text for slice extraction
 *
 * @param baseIndex - global slice index of this pair's first slice
 *
 * @param budget - target-side characters one slice aims for;
 * defaults to {@link SLICE_CHAR_BUDGET}
 *
 * @returns Slice pairs covering both sides of the section completely
 *
 * @example
 * ```ts
 * const slices = subdivideChunkPair({
 *   pair,
 *   sourceText,
 *   targetText,
 *   baseIndex: 0,
 * },);
 * ```
 */
export function subdivideChunkPair(
  {
    pair,
    sourceText,
    targetText,
    baseIndex,
    budget = SLICE_CHAR_BUDGET,
  }: {
    readonly pair: ChunkPair;
    readonly sourceText: string;
    readonly targetText: string;
    readonly baseIndex: number;
    readonly budget?: number;
  },
): readonly ChunkPair[] {
  /**
   * Source-side budget scaled by its character share, so a denser
   * original (zh runs shorter than en) slices at matching granularity
   * instead of collapsing the pairing back to section scale.
   */
  const sourceBudget = Math.max(
    1,
    Math.round(
      budget
        * (pair.source
          .text
          .length
          / Math.max(
            1,
            pair.target
              .text
              .length,
          )),
    ),
  );
  if (
    (pair.source
      .nodes
      .length
      === pair.target
      .nodes
      .length)
    && (pair.source
      .nodes
      .length
      > 0)
  ) {
    return groupNodesLockstep({
      sourceNodes: pair.source
        .nodes,
      targetNodes: pair.target
        .nodes,
      sourceBudget,
      targetBudget: budget,
    },)
      .map(function toSlice(
        run,
        sliceOffset,
      ): ChunkPair {
        return {
          source: runToChunk({
            run: run.sourceRun,
            documentText: sourceText,
            chunkIndex: baseIndex + sliceOffset,
          },),
          target: runToChunk({
            run: run.targetRun,
            documentText: targetText,
            chunkIndex: baseIndex + sliceOffset,
          },),
        };
      },);
  }

  /**
   * Source-side node runs within the scaled budget.
   */
  const sourceRuns = groupNodes({
    nodes: pair.source
      .nodes,
    budget: sourceBudget,
  },);

  /**
   * Target-side node runs within budget.
   */
  const targetRuns = groupNodes({
    nodes: pair.target
      .nodes,
    budget,
  },);
  if ((sourceRuns.length === 0) || (targetRuns.length === 0))
    return [pair,];

  /**
   * Whether the source side frames the pairing (fewer or equal runs).
   */
  const sourceIsFrame = sourceRuns.length <= targetRuns.length;

  /**
   * Framing side: one run per slice pair.
   */
  const frame = sourceIsFrame
    ? sourceRuns
    : targetRuns;

  /**
   * Wider side whose runs merge to keep pace with the frame.
   */
  const wide = sourceIsFrame
    ? targetRuns
    : sourceRuns;

  /**
   * Total span characters of the framing side.
   */
  const frameTotal = totalRunChars({ runs: frame, },);

  /**
   * Total span characters of the wider side.
   */
  const wideTotal = totalRunChars({ runs: wide, },);

  /**
   * Slice pairs accumulated in document order.
   */
  const slices: ChunkPair[] = [];

  /**
   * Frame characters consumed so far.
   */
  let frameConsumed = 0;

  /**
   * Wide characters consumed so far.
   */
  let wideConsumed = 0;

  /**
   * Next unconsumed wide run.
   */
  let cursor = 0;
  for (const [sliceOffset, frameRun,] of frame.entries()) {
    frameConsumed += totalRunChars({ runs: [frameRun,], },);

    /**
     * Fraction of the frame consumed through this slice.
     */
    const frameFraction = frameConsumed / frameTotal;

    /**
     * Start of this slice's wide run window.
     */
    const runStart = cursor;
    wideConsumed += totalRunChars({ runs: [wide[cursor] ?? [],], },);
    cursor += 1;
    while (
      ((wide.length - cursor) > (frame.length - sliceOffset
        - 1))
      && ((sliceOffset === (frame.length - 1))
        || ((wideConsumed / wideTotal) < frameFraction))
    ) {
      wideConsumed += totalRunChars({ runs: [wide[cursor] ?? [],], },);
      cursor += 1;
    }

    /**
     * Wide-side nodes of this slice, flattened across its run window.
     */
    const wideNodes = wide
      .slice(
        runStart,
        cursor,
      )
      .flat();

    /**
     * Frame-side chunk of the slice.
     */
    const frameChunk = runToChunk({
      run: frameRun,
      documentText: sourceIsFrame ? sourceText : targetText,
      chunkIndex: baseIndex + sliceOffset,
    },);

    /**
     * Wide-side chunk of the slice.
     */
    const wideChunk = runToChunk({
      run: wideNodes,
      documentText: sourceIsFrame ? targetText : sourceText,
      chunkIndex: baseIndex + sliceOffset,
    },);
    slices.push(
      sourceIsFrame
        ? {
          source: frameChunk,
          target: wideChunk,
        }
        : {
          source: wideChunk,
          target: frameChunk,
        },
    );
  }
  return slices;
}

//endregion Paragraph slicing
