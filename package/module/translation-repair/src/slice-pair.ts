import type {
  ChunkPair,
  ContentChunk,
} from './chunk-document.ts';
import {
  isInsertionChunk,
  makeInsertionChunk,
} from './chunk-placement.ts';
import type { DocumentNode, } from './document-node.ts';
import { groupNodesAligned, } from './group-aligned.ts';
import { blockPairingToSteps, } from './pair-blocks-steps.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import { groupNodes, } from './group-nodes.ts';

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

export { groupNodes, } from './group-nodes.ts';

/**
 * Builds one chunk spanning a node run, slicing text from its document.
 *
 * @param run - node run backing this chunk
 *
 * @param documentText - owning document's text for byte-exact slicing
 *
 * @param sliceIndex - global slice index stamped onto both sides
 *
 * @returns Chunk spanning exactly this run's offsets
 *
 * @example
 * ```ts
 * const chunk = runToChunk({ run, documentText, sliceIndex: 3, },);
 * ```
 */
function runToChunk(
  {
    run,
    documentText,
    sliceIndex,
  }: {
    readonly run: readonly DocumentNode[];
    readonly documentText: string;
    readonly sliceIndex: number;
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
    sliceIndex,
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
 * Subdivides one aligned section pair into paragraph-bound slice pairs.
 * Whenever both sides carry blocks, a monotone alignment decides which block
 * partners which, and may leave a block unpartnered rather than force it onto
 * a neighbour. Pairing by shared index was tried and is wrong: equal node
 * counts do NOT imply one-to-one correspondence, so a translation that drops
 * one block and gains another elsewhere kept its total while every pairing
 * after the drop compared a block against its neighbour. A section whose
 * target is an insertion is sliced by the source alone, one slice per budget
 * run, all written at the insertion boundary; any other pair with a side that
 * has no blocks stays one slice, re-indexed. Paragraph-count mismatch within a
 * section is ordinary translation freedom, so subdivision emits no findings.
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
    blockPairing,
  }: {
    readonly pair: ChunkPair;
    readonly sourceText: string;
    readonly targetText: string;
    readonly baseIndex: number;
    readonly budget?: number;
    readonly blockPairing?: readonly BlockPair[];
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
      // A ROSTER'S PAIRING WHEN THE CALLER HAS ONE, and the scorer otherwise.
      // Indices are chunk-local, which is what the caller asked about. Spread
      // rather than passed as undefined, since `exactOptionalPropertyTypes`
      // separates an absent option from one explicitly unset.
      ...((blockPairing === undefined)
        ? {}
        : {
          steps: blockPairingToSteps({
            pairs: blockPairing,
            sourceCount: pair.source
              .nodes
              .length,
            targetCount: pair.target
              .nodes
              .length,
          },),
        }),
    },)
      .map(function toSlice(
        run,
        sliceOffset,
      ): ChunkPair {
        /**
         * Original side, built the same way whichever kind of run this is.
         */
        const source = runToChunk({
          run: run.sourceRun,
          documentText: sourceText,
          sliceIndex: baseIndex + sliceOffset,
        },);

        // `#100` landing 4: a run of originals nothing rendered gets a PLACE on
        // the translation side rather than blocks, so the lane can write there.
        // `runToChunk` would throw on the empty run this used to be handed,
        // which is why the fold this replaces existed at all.
        if (run.kind === 'insertion')
          return {
            source,
            target: makeInsertionChunk({
              sliceIndex: baseIndex + sliceOffset,
              offset: run.targetOffset,
            },),
          };

        return {
          source,
          target: runToChunk({
            run: run.targetRun,
            documentText: targetText,
            sliceIndex: baseIndex + sliceOffset,
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
  // AN INSERTION HAS NO TARGET RUNS TO FRAME BY, so it is sliced by the SOURCE.
  //
  // This used to return the whole section as ONE slice, on the reasoning that a
  // section whose target side is empty has a single zero-length span to splice
  // every slice of it back into. `spliceSlices` gained the ability to write
  // into a zero-length span and to order several insertions at one offset by
  // slice index in `610ea11b9`, so the reason is spent.
  //
  // WHAT IT COST WHILE IT STOOD, measured on `XingZ60` under the pairing the
  // roster really returned: two insertion slices of 915 and 1459 source
  // characters against a budget of 400, holding 6 and 23 blocks whose largest
  // member is 384 characters. Nothing had to be split to slice them; they were
  // one slice only because the side that frames subdivision was empty.
  if ((sourceRuns.length > 0) && isInsertionChunk(pair.target,))
    return sourceRuns.map(function toInsertionSlice(
      run,
      sliceOffset,
    ): ChunkPair {
      return {
        source: runToChunk({
          run,
          documentText: sourceText,
          sliceIndex: baseIndex + sliceOffset,
        },),

        // EVERY SLICE AT THE SAME BOUNDARY, in slice order, which is the shape
        // `spliceSlices` orders. The section has one place to be written, and
        // its slices go there one after another.
        target: makeInsertionChunk({
          sliceIndex: baseIndex + sliceOffset,
          offset: pair.target
            .startOffset,
        },),
      };
    },);
  // ONE SIDE HAS NO BLOCKS FROM HERE ON: both-sided pairs took
  // `groupNodesAligned`, a run list is empty exactly when its side has no
  // nodes, and an insertion returned just now. The proportional merge that
  // once followed (the wider side merged greedily by cumulative character
  // fraction) could therefore never run, and it was deleted rather than kept
  // as the fallback its TSDoc promised.
  //
  // RE-INDEXED, because the pair arrived carrying its SECTION index and
  // every other path stamps the global one. Returning it untouched let two
  // slices of one document share an index once any earlier section
  // subdivided, and slice identity is what the cache key and the splice both
  // rest on.
  //
  // STILL ONE SLICE where the target carries a span but no blocks, which is
  // not an insertion: several pairs would have to replace one span rather
  // than be written into a boundary, and that is a different question from
  // the one above.
  return [
    {
      source: {
        ...pair.source,
        sliceIndex: baseIndex,
      },
      target: {
        ...pair.target,
        sliceIndex: baseIndex,
      },
    },
  ];
}

//endregion Paragraph slicing
