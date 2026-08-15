import type {
  ChunkPair,
  ContentChunk,
} from './chunk-document.ts';
import type { DocumentNode, } from './document-node.ts';
import { groupNodesAligned, } from './group-aligned.ts';

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
export function groupNodes(
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
): ContentChunk {
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
 * Subdivides one aligned section pair into paragraph-bound slice pairs.
 * Whenever both sides carry blocks, a monotone alignment decides which block
 * partners which, and may leave a block unpartnered rather than force it onto
 * a neighbour. Pairing by shared index was tried and is wrong: equal node
 * counts do NOT imply one-to-one correspondence, so a translation that drops
 * one block and gains another elsewhere kept its total while every pairing
 * after the drop compared a block against its neighbour. Only a side with no
 * blocks at all falls back to independent budget grouping, with the wider side
 * merged greedily by cumulative character fraction (the same Gale-Church-style
 * pacing section alignment uses). Paragraph-count mismatch within a section is
 * ordinary translation freedom, so subdivision emits no findings.
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
   * How much shorter the original runs than its translation, measured over
   * the WHOLE documents rather than over this section.
   *
   * Was measured per section, and that is the defect: the ratio is a fact
   * about the language pair, while a section-level estimate is driven by how
   * much of THIS section was translated. On 4000 source characters against 20
   * target characters it returned 200, so the source budget became 80_000 and
   * the section stopped being sliced at all. The worse the incumbent coverage,
   * the larger the translation call, which is exactly backwards for a lane
   * that exists to translate what nobody translated.
   *
   * Capped at one for the same reason it is computed at all: Chinese runs
   * SHORTER than its English rendering, so a ratio above one is never density.
   * It is missing translation, and the cap says so rather than acting on it.
   */
  const densityRatio = Math.min(
    1,
    sourceText.length / Math.max(
      1,
      targetText.length,
    ),
  );

  /**
   * Source-side budget at that density, so a denser original slices at
   * matching granularity instead of collapsing the pairing back to section
   * scale.
   */
  const sourceBudget = Math.max(
    1,
    Math.round(budget * densityRatio,),
  );
  if (
    (pair.source
      .nodes
      .length
      > 0)
    && (pair.target
      .nodes
      .length
      > 0)
  ) {
    return groupNodesAligned({
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
  if ((sourceRuns.length === 0) || (targetRuns.length === 0)) {
    // RE-INDEXED, because the pair arrived carrying its SECTION index and
    // every other path stamps the global one. Returning it untouched let two
    // slices of one document share an index once any earlier section
    // subdivided, and slice identity is what the cache key and the splice both
    // rest on.
    //
    // Still not SLICED, which is `#89`s work rather than an oversight: a
    // section whose target side is empty has one zero-length span to splice
    // every slice of it back into, so slicing it needs the driver that knows
    // how to insert rather than replace.
    return [
      {
        source: {
          ...pair.source,
          chunkIndex: baseIndex,
        },
        target: {
          ...pair.target,
          chunkIndex: baseIndex,
        },
      },
    ];
  }

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
