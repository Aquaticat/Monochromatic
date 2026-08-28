import {
  alignDocumentSections,
  type ChunkPair,
  chunkByHeadings,
  describeAlignmentAttachment,
} from './chunk-document.ts';
import { declaredNameForms, } from './declared-name-survival.ts';
import {
  collectIdentityLines,
  extractDeclaredIdentity,
} from './identity-context.ts';
import {
  type ChunkGovernance,
  type ChunkSlice,
  governedSliceIndices,
} from './line-structure-inherit.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';
import type { SectionPair, } from './pair-sections-wire.ts';
import {
  type SectionBlockPairing,
  sectionPairingsOf,
} from './section-pairing.ts';
import { parseDocument, } from './parse-document.ts';
import { frontMatterSlice, } from './front-matter-slice.ts';
import { assertPlacementLayout, } from './placement-layout.ts';
import { assertContainerIntegrity, } from './container-integrity.ts';
import { declinedTargetIdsOfPairing, } from './declined-target-runs.ts';
import { assertSliceCoverage, } from './slice-coverage.ts';
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
 * Target block pairing roster left without source claim.
 *
 * @example
 * ```ts
 * const block: UnclaimedTargetBlock = {
 *   location: { kind: 'aligned-pair', pairIndex: 0, },
 *   blockId: 'block/2',
 *   startOffset: 41,
 *   endOffset: 73,
 * };
 * ```
 */
export type UnclaimedTargetBlock = {
  /**
   * Alignment location whose source claim is absent.
   */
  readonly location: {
    /**
     * Block sits inside aligned section pair.
     */
    readonly kind: 'aligned-pair';

    /**
     * Aligned pair index.
     */
    readonly pairIndex: number;
  } | {
    /**
     * Whole target section sits outside alignment.
     */
    readonly kind: 'target-section';

    /**
     * Target section index.
     */
    readonly sectionIndex: number;
  };

  /**
   * Stable parser id within target document.
   */
  readonly blockId: string;

  /**
   * First target-text offset owned by block.
   */
  readonly startOffset: number;

  /**
   * Target-text boundary immediately after block.
   */
  readonly endOffset: number;
};

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
   * Marks body-only slicing rebuilt for artifact generations before five.
   *
   * Current preparations omit it and use metadata-aware identity scheme.
   */
  readonly legacyIdentity?: true;

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
   * Declared name forms as the TRANSLATION side spells them.
   *
   * SEPARATE FROM `identityContext`, which is prose for a prompt. These are the
   * strings a guard compares, and the guard exists because asking a model to
   * keep a name does not work: probed on the repair lane's own judge sheet,
   * six of six judges preferred the candidate that dropped a declared alias.
   *
   * TRANSLATION SIDE ONLY, because the text being guarded is English.
   */
  readonly declaredNames: readonly string[];

  /**
   * Alignment findings in scorecard-stable wording.
   */
  readonly alignmentFindings: readonly string[];

  /**
   * Archive blocks pairing roster deliberately left outside every source claim.
   *
   * STRUCTURED APART FROM `alignmentFindings` so publication safety never parses
   * diagnostic prose to decide whether unreviewed archive wording exists.
   */
  readonly unclaimedTargetBlocks: readonly UnclaimedTargetBlock[];

  /**
   * Entries in the aligned unit list, which is the count worth logging beside
   * the slice count: a document with far more slices than units subdivided
   * heavily.
   *
   * INSERTIONS ARE INCLUDED, and they are not section PAIRS: an insertion names
   * a place in the translation where an untranslated original belongs, so it
   * has an original on one side and a boundary on the other. The name predates
   * insertions existing and is kept because settled version 2 artifacts record
   * it, and because every consumer wants exactly this number: it is the bound
   * `parseBlockPairing` refuses a section index against, and a real-pair
   * count there would falsely refuse a block pairing filed after an insertion.
   *
   * WHICH entries are insertions is reported by
   * {@link PreparedDocumentPair.alignmentFindings}, where each one names its
   * source section and either the boundary it was placed at or the refusal that
   * stopped it. That is the separate report, rather than a second count here.
   */
  readonly alignmentPairCount: number;

  /**
   * Pairing this slicing was built on, echoed back so what gets recorded is the
   * object slicing consumed rather than a second copy assembled beside it.
   *
   * ABSENT WHEN NOBODY WAS ASKED, present and possibly empty when somebody was.
   * A section missing from a present list had no pairing consumed for it, and
   * which of the several reasons applies is legible from
   * {@link PreparedDocumentPair.alignmentFindings}, not from here.
   */
  readonly blockPairing?: readonly SectionBlockPairing[];

  /**
   * Section pairing this alignment was built on, echoed back the same way and
   * for the same reason as {@link PreparedDocumentPair.blockPairing}: the
   * artifact records the value slicing consumed, not a copy assembled beside it.
   *
   * ABSENT WHEN THE DETERMINISTIC ALIGNER DECIDED THE SECTIONS, present when a
   * supplied pairing did. The roster shell supplies one only when its section
   * round agreed on at least one pair, so a present list is non-empty in
   * production; a direct caller's empty list is echoed as consumed rather than
   * normalised away, because an empty supplied pairing aligns nothing and the
   * deterministic path aligns by shape, and those are different slicings.
   */
  readonly sectionPairing?: readonly SectionPair[];
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
 * @param includeFrontMatter - whether visible metadata becomes explicit slice;
 * false only when rebuilding pre-generation-5 artifacts
 *
 * @param blockPairings - correspondences a roster agreed on WITHIN each aligned
 * section, keyed by section index
 *
 * @param sectionPairing - correspondences a roster agreed on BETWEEN the two
 * sides' sections, which decides what the aligned sections are in the first
 * place. Kept apart from `blockPairings` because the two answer different
 * questions and are bought in that order: which sections correspond, and then
 * which blocks within one do.
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
    includeFrontMatter = true,
    blockPairings,
    sectionPairing,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly sliceCharBudget?: number;
    readonly includeFrontMatter?: boolean;
    readonly blockPairings?: ReadonlyMap<number, readonly BlockPair[]>;
    readonly sectionPairing?: readonly SectionPair[];
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
   * Declared name forms a guard compares against English text.
   */
  const declaredNames = declaredNameForms({
    identity: extractDeclaredIdentity({
      data: targetDocument.frontMatter
        ?.data,
    },),
  },);

  /**
   * Aligned chunk pairs covering both documents totally.
   */
  const alignment = alignDocumentSections({
    source: sourceDocument,
    target: targetDocument,
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
  },);

  /**
   * Alignment findings in scorecard-stable wording.
   */
  const sectionFindings = alignment.findings
    .map(function toText(finding,): string {
      return `alignment ${finding.kind} (${
        describeAlignmentAttachment({ attachedTo: finding.attachedTo, },)
      }: ${finding.detail})`;
    },);

  /**
   * One finding per chunk whose pairing accounted for translation blocks
   * nowhere, so the decision is legible from the artifact alone.
   *
   * `Zha_Ke` settled with this list EMPTY while two of its six English blocks,
   * 2943 characters of dense text between them, had been declined.
   * Reconstructing that took the pairing cache and the parser. Recording it
   * here is what `#135` asks for, at the one place that already knows both the
   * pairing and the blocks.
   *
   * The finding itself counts OFFSET SPANS, which run wider than dense text
   * because they carry the markdown a block is written in.
   */
  const declinedFindings: string[] = [];

  /**
   * Target node ids gathered from aligned sections.
   */
  const alignedTargetIdRows = alignment.pairs
    .flatMap(function toTargetIds(pair,): readonly string[] {
      /**
       * Target nodes this aligned pair owns.
       */
      const { nodes, } = pair.target;
      return nodes.map(function toId(node,): string {
        return node.id;
      },);
    },);
  /**
   * Target node ids belonging to some aligned section.
   */
  const alignedTargetIds = new Set(alignedTargetIdRows,);
  /**
   * Target heading chunks across whole archive.
   */
  const targetChunks = chunkByHeadings({ document: targetDocument, },);
  /**
   * Target blocks outside every aligned section, which no slice can review.
   */
  const unclaimedTargetBlocks: UnclaimedTargetBlock[] = targetChunks
    .flatMap(function outsideAlignment(
      chunk,
      sectionIndex,
    ): readonly UnclaimedTargetBlock[] {
      /**
       * Nodes belonging to this target section.
       */
      const { nodes, } = chunk;
      return nodes
        .filter(function isOutside(node,): boolean {
          return !alignedTargetIds.has(node.id,);
        },)
        .map(function toUnclaimed(node,): UnclaimedTargetBlock {
          return {
            location: {
              kind: 'target-section',
              sectionIndex,
            },
            blockId: node.id,
            startOffset: node.startOffset,
            endOffset: node.endOffset,
          };
        },);
    },);

  /**
   * Slice pairs accumulated across front matter and aligned body sections.
   */
  const slices: ChunkPair[] = [];
  /**
   * Visible localized metadata excluded from Markdown nodes.
   */
  const metadataSlice = includeFrontMatter
    ? frontMatterSlice({
      ...(sourceDocument.frontMatter === undefined ? {} : { source: sourceDocument.frontMatter, }),
      ...(targetDocument.frontMatter === undefined ? {} : { target: targetDocument.frontMatter, }),
    },)
    : { kind: 'none' as const, };
  if (metadataSlice.kind === 'paired')
    slices.push(metadataSlice.slice,);

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
  for (
    const [pairIndex, pair,] of alignment
      .pairs
      .entries()
  ) {
    /**
     * Correspondences the roster agreed for this chunk, ABSENT when it agreed
     * none.
     *
     * ABSENCE HAS TO STAY ABSENCE all the way to subdivision. A section the
     * roster could not pair is left OUT of the map, and `prepare-with-pairing`
     * says what it means by that: it records `fell back to scoring` and logs
     * "keeping the deterministic aligner". Reading the miss as an EMPTY pairing
     * says something else entirely, because `blockPairingToSteps` reads zero
     * pairs as every block unpartnered on both sides, every run then comes out
     * one-sided, `mergeOneSidedRuns` folds them all together, and the section
     * becomes ONE slice. Measured on `Zha_Ke`: four slices become one, 262
     * characters of original against 4340 of translation, which is the largest
     * slice in the document at exactly the section nobody could pair.
     */
    const blockPairing = blockPairings?.get(pairIndex,);

    /**
     * Slices carved from this chunk.
     */
    const carved = subdivideChunkPair({
      pair,
      sourceText,
      targetText,
      baseIndex: slices.length,
      budget: sliceCharBudget,
      ...((blockPairing === undefined) ? {} : { blockPairing, }),
    },);

    /**
     * Translation blocks this chunk's pairing accounted for nowhere.
     *
     * Derived here rather than returned by subdivision, from the same pairing
     * subdivision was handed, so the assertion and the carving cannot drift.
     */
    const declined = (blockPairing === undefined)
      ? new Set<string>()
      : declinedTargetIdsOfPairing({
        pairs: blockPairing,
        sourceNodes: pair.source
          .nodes,
        targetNodes: pair.target
          .nodes,
      },);
    if (declined.size > 0) {
      /**
       * Declined blocks of this chunk, for the characters they hold.
       */
      const blocks = pair.target
        .nodes
        .filter(function isDeclined(node,): boolean {
          return declined.has(node.id,);
        },);
      unclaimedTargetBlocks.push(...blocks.map(function toUnclaimedTargetBlock(
        node,
      ): UnclaimedTargetBlock {
        return {
          location: {
            kind: 'aligned-pair',
            pairIndex,
          },
          blockId: node.id,
          startOffset: node.startOffset,
          endOffset: node.endOffset,
        };
      },),);
      declinedFindings.push(
        `alignment target-unclaimed (pair ${String(pairIndex,)}: ${
          String(blocks.length,)
        } translation blocks no original claims, ${
          String(blocks.reduce(
            function addChars(
              sum,
              node,
            ): number {
            return sum + (node.endOffset - node.startOffset);
          },
            0,
          ),)
        } characters: ${blocks.map(function toId(node,): string {
          return node.id;
        },)
          .join(', ',)})`,
      );
    }

    // BEFORE ANYTHING READS THEM. A block that reached no slice leaves the
    // document silently, and every later check works from the slices, so this
    // is the last point where the blocks it was given are still in hand.
    // A DECLINED block is the one exception, and it is passed in rather than
    // inferred so the assertion still fails on every block that went missing
    // without a decision behind it.
    assertSliceCoverage({
      pair,
      carved,
      declined,
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
        slicePosition: slices.length + offset,
      },);
    },);
    governance.push({
      sourceText: pair.source
        .text,
      slices: stamped.map(function toSlice(stampedSlice,): ChunkSlice {
        return {
          index: stampedSlice.target
            .sliceIndex,
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

  // AND THAT EVERY CONTAINER TAG IS STILL OWNED BY A BLOCK, which none of the
  // checks above can reach. Dissolving a container leaves its opening and
  // closing tags belonging to no block, and `container-extents.ts` hands each of
  // them to the block beside it so that ranges minted from block offsets cannot
  // cut one. This asks whether that still happened.
  assertContainerIntegrity({
    slices,
    containers: targetDocument.containers,
    blocks: targetDocument.nodes,
  },);

  return {
    ...(!includeFrontMatter ? { legacyIdentity: true as const, } : {}),
    sourceText,
    targetText,
    slices,
    lineStructuredSliceIndices: governedSliceIndices({ chunks: governance, },),
    // Omitted rather than empty, so spreading this into a prompt cannot emit a
    // heading with nothing under it.
    ...(identityLines.length === 0
      ? {}
      : { identityContext: identityLines.join('\n',), }),
    declaredNames,
    alignmentFindings: [
      ...sectionFindings,
      ...declinedFindings,
    ],
    unclaimedTargetBlocks,
    alignmentPairCount: alignment.pairs
      .length,

    // OMITTED WHEN NO PAIRING WAS SUPPLIED, because a caller that asked nobody
    // and a roster that agreed nothing are different facts, and both would read
    // as an empty list if absence were spelled that way.
    ...((blockPairings === undefined) ? {} : { blockPairing: sectionPairingsOf({ blockPairings, },), }),

    // ECHOED AS CONSUMED, for the rebuild an artifact reader performs: with
    // this and the block pairing, `prepareDocumentPair` over the same two
    // texts reproduces this exact slicing, and without it a reader can only
    // guess whether the aligner or a roster chose the sections.
    ...((sectionPairing === undefined) ? {} : { sectionPairing, }),
  };
}

//endregion Document preparation
