import {
  alignDocumentSections,
  type ChunkPair,
} from './chunk-document.ts';
import { collectIdentityLines, } from './identity-context.ts';
import {
  type ChunkGovernance,
  type ChunkSlice,
  governedSliceIndices,
} from './line-structure-inherit.ts';
import { parseDocument, } from './parse-document.ts';
import { assertPlacementLayout, } from './placement-layout.ts';
import { assertSpanContiguity, } from './span-contiguity.ts';
import {
  assertSliceIndexing,
  reindexSlicePair,
} from './slice-indexing.ts';
import {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from './slice-pair.ts';

//region Document preparation
// Everything a lane needs to know about a document PAIR before any model is
// asked anything: how it parses, how its sections pair up, where the slice
// boundaries fall, which slices inherit the line-structure rule, and what names
// both sides declare.
//
// Shared because it is lane-neutral and must be IDENTICAL across lanes. Two
// lanes preparing separately would drift the moment either changed a budget or
// a governance rule, and the drift would be invisible: each lane would report
// slices that look right on their own, while the same document produced two
// different slicings and no artifact recorded which one a result came from.
//
// Spends no quota and takes no client, roster, config, signal or cache. That
// exclusion is the boundary: anything needing one of those is lane work.

/**
 * A document pair reduced to the slices both lanes run over.
 *
 * @example
 * ```ts
 * const prepared = prepareDocumentPair({ sourceText, targetText, },);
 * ```
 */
export type PreparedDocumentPair = {
  /**
   * Original document this preparation was made from.
   */
  readonly sourceText: string;

  /**
   * Translation the target spans and offsets index into.
   *
   * Carried so a lane assembles against the document it was prepared from. A
   * driver handed a preparation and an unrelated translation would splice at
   * offsets that mean nothing there, and produce plausible-looking text.
   */
  readonly targetText: string;

  /**
   * Paragraph-bound slice pairs across every aligned section, indexed globally
   * in document order.
   */
  readonly slices: readonly ChunkPair[];

  /**
   * Slice indexes the line-structure rule governs, inherited from the enclosing
   * chunk rather than decided per slice.
   */
  readonly lineStructuredSliceIndices: ReadonlySet<number>;

  /**
   * Declared names and handles from both sides' front matter, joined into the
   * block a prompt carries.
   *
   * Absent rather than empty when neither side declares anything, so a caller
   * spreading it into a prompt never emits a heading with nothing under it.
   */
  readonly identityContext?: string;

  /**
   * Alignment findings in scorecard-stable wording.
   */
  readonly alignmentFindings: readonly string[];

  /**
   * Aligned section pairs, which is the count worth logging beside the slice
   * count: a document with far more slices than pairs subdivided heavily.
   */
  readonly alignmentPairCount: number;
};

/**
 * Parses, aligns and subdivides a document pair.
 *
 * @param sourceText - whole original document
 *
 * @param targetText - whole translation as it stands
 *
 * @param sliceCharBudget - target characters a slice may carry; defaults to
 * {@link SLICE_CHAR_BUDGET}
 *
 * @returns Slices, governance, declared names and alignment findings
 *
 * @example
 * ```ts
 * const { slices, lineStructuredSliceIndices, } = prepareDocumentPair({ sourceText, targetText, },);
 * ```
 */
export function prepareDocumentPair(
  {
    sourceText,
    targetText,
    sliceCharBudget = SLICE_CHAR_BUDGET,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly sliceCharBudget?: number;
  },
): PreparedDocumentPair {
  /**
   * Whole original document, parsed once and reused for both alignment and the
   * identity block chunk text cannot supply.
   */
  const sourceDocument = parseDocument({ text: sourceText, },);

  /**
   * Whole translation document, parsed once for the same two uses.
   */
  const targetDocument = parseDocument({ text: targetText, },);

  /**
   * Declared names and handles from both sides' front matter. Front matter is
   * document-level while stages see slice text, so this is the only path by
   * which a declared correspondence reaches them. Empty when neither side
   * declares anything.
   */
  const identityLines = collectIdentityLines({
    sourceData: sourceDocument.frontMatter
      ?.data,
    targetData: targetDocument.frontMatter
      ?.data,
  },);

  /**
   * Aligned chunk pairs covering both documents totally.
   */
  const alignment = alignDocumentSections({
    source: sourceDocument,
    target: targetDocument,
  },);

  /**
   * Alignment findings in scorecard-stable wording.
   */
  const alignmentFindings = alignment.findings
    .map(function toText(finding,): string {
      return `alignment ${finding.kind} (pair ${String(finding.pairIndex,)}: ${finding.detail})`;
    },);

  /**
   * Slice pairs accumulated across every aligned section.
   */
  const slices: ChunkPair[] = [];

  /**
   * Slices whose enclosing CHUNK's original is line-structured.
   *
   * Decided on the chunk and inherited by its slices, because the predicate
   * needs at least five blocks and subdivision routinely leaves fewer. Measured
   * on `Toka_ls`: the verse chunk trips at 21 blocks, median 22, then
   * subdivides into seven slices of which one still trips, while four more sit
   * at medians 20, 22, 23 and 29 and fail only for want of a fifth block.
   * Deciding per slice therefore dropped the instruction on most of the verse
   * it exists for.
   */
  const governance: ChunkGovernance[] = [];
  for (const pair of alignment.pairs) {
    /**
     * Slices carved from this chunk.
     */
    const carved = subdivideChunkPair({
      pair,
      sourceText,
      targetText,
      baseIndex: slices.length,
      budget: sliceCharBudget,
    },);

    /**
     * Those slices renamed by where they actually landed.
     *
     * Subdivision was handed a base index and added its own offset, which is
     * the same answer this produces today. It stops being the same answer the
     * moment a section contributes a slice the base index did not count, which
     * is exactly what `#100`'s insertions do, so the preparation stamps the
     * final name itself rather than trusting arithmetic it handed out.
     */
    const stamped = carved.map(function toStamped(
      carvedSlice,
      offset,
    ): ChunkPair {
      return reindexSlicePair({
        slice: carvedSlice,
        sliceIndex: slices.length + offset,
      },);
    },);
    governance.push({
      sourceText: pair.source
        .text,
      slices: stamped.map(function toSlice(stampedSlice,): ChunkSlice {
        return {
          index: stampedSlice.target
            .chunkIndex,
          sourceText: stampedSlice.source
            .text,
        };
      },),
    },);
    slices.push(...stamped,);
  }

  // BELT OVER BRACES, and worth the line. The restamp above already makes this
  // true from this path, so it can only fail if that restamp is changed or
  // removed. What it pins is the property everything downstream reads: the
  // lanes, the assembly and the cross-lane comparison are all further from the
  // stamping than this, and none of them could tell a mis-stamped preparation
  // from a strange document.
  assertSliceIndexing({ slices, },);

  // AND WHERE THEY POINT, which indexing says nothing about. Every span here
  // comes from a disjoint run of nodes, so this holds by construction today and
  // stops doing so the moment `#100` adds a slice that covers no nodes at all.
  assertPlacementLayout({
    slices,
    targetText,
  },);

  // AND WHAT THEY COVER, which the layout says nothing about either. A span's
  // text is sliced from its own offsets, so a block lying between two of its
  // nodes but missing from the run is inside the range, agrees with the text
  // byte for byte, and is replaced at assembly by a decision that never saw it.
  // Only the document's whole node sequence can see that, and this is the last
  // place holding it.
  assertSpanContiguity({
    slices,
    targetNodes: targetDocument.nodes,
  },);

  return {
    sourceText,
    targetText,
    slices,
    lineStructuredSliceIndices: governedSliceIndices({ chunks: governance, },),
    // Omitted rather than empty, so spreading this into a prompt cannot emit a
    // heading with nothing under it.
    ...(identityLines.length === 0
      ? {}
      : { identityContext: identityLines.join('\n',), }),
    alignmentFindings,
    alignmentPairCount: alignment.pairs
      .length,
  };
}

//endregion Document preparation
