import { alignBlocks, } from '../align-blocks-walk.ts';
import {
  alignDocumentSections,
  chunkByHeadings,
} from '../chunk-document.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { parseDocument, } from '../parse-document.ts';
import {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from '../slice-pair.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Slice census entry
// One corpus entry, measured after slicing.
//
// Split from the reporting driver at the line budget, and the boundary is a
// real one: this file answers what an entry IS, and `slice-census.ts` answers
// what the corpus looks like across all of them.


/**
 * One entry's measured shape.
 *
 * @example
 * ```ts
 * const row: EntryCensus = { entryId, sliceCount: 12, ... };
 * ```
 */
export type EntryCensus = {
  /**
   * Corpus id.
   */
  readonly entryId: string;

  /**
   * Source characters of every slice, in document order.
   */
  readonly sliceSourceChars: readonly number[];

  /**
   * Target characters of every slice.
   */
  readonly sliceTargetChars: readonly number[];

  /**
   * Sections the aligner REFUSED to pair, which therefore reach no slice.
   *
   * Counted from the aligner's own output rather than from the pairs it
   * produced. Only a forced pairing becomes a pair, so a refused section is
   * absent from `alignment.pairs` entirely rather than present with an empty
   * side, and a counter that walks the pairs can only ever report zero. That is
   * what the earlier `onesidedSections` did, and it read as an answer.
   */
  readonly unpairedSourceSections: number;

  /**
   * Characters of source in those sections, which is what translating them
   * would carry and what no lane spends today.
   */
  readonly unpairedSourceChars: number;

  /**
   * Translation sections no source section partnered, which reach no slice for
   * the same reason from the other side.
   */
  readonly unpairedTargetSections: number;

  /**
   * Characters of translation in those sections.
   */
  readonly unpairedTargetChars: number;

  /**
   * Blocks the translation carries that no source block partnered.
   */
  readonly targetOnlyBlocks: number;

  /**
   * Characters in those blocks.
   */
  readonly targetOnlyChars: number;

  /**
   * Size of every target-only block, so a transcription can be told from an
   * ordinary paragraph split.
   *
   * The transcribed-image class is the case where a Chinese page holds a letter
   * as a picture and the English page transcribes and translates it. MEASURED
   * 2026-08-15: that picture is nowhere in the markdown this pipeline reads.
   * Only 2 of 92 source pages mention `img` at all, and the entry with the most
   * target-only text mentions none, so no image-adjacency test can find the
   * class. Size is the signal that remains: a transcription runs long and a
   * split paragraph does not.
   */
  readonly targetOnlyBlockChars: readonly number[];
};

/**
 * Measures one corpus entry.
 *
 * @param entryId - corpus id
 *
 * @returns That entry's shape after slicing
 *
 * @throws {@link CorpusReadError} when either side is absent
 *
 * @example
 * ```ts
 * const row = await censusEntry({ entryId: 'Toka_ls', },);
 * ```
 */
export async function censusEntry(
  { entryId, }: { readonly entryId: string; },
): Promise<EntryCensus> {
  /**
   * Original document at the pin.
   */
  const sourceText = await readCorpusFile({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${entryId}/page.md`,
  },);

  /**
   * Translation at the same commit.
   */
  const targetText = await readCorpusFile({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${entryId}/page.en.md`,
  },);

  /**
   * Original, parsed once and kept so its sections can be counted against the
   * pairs the aligner committed to.
   */
  const sourceDocument = parseDocument({ text: sourceText, },);

  /**
   * Translation, parsed for the same two uses.
   */
  const targetDocument = parseDocument({ text: targetText, },);

  /**
   * Aligned section pairs, exactly as the pipeline cuts them.
   */
  const alignment = alignDocumentSections({
    source: sourceDocument,
    target: targetDocument,
  },);

  /**
   * Every section of the original, paired or not.
   */
  const sourceSections = chunkByHeadings({ document: sourceDocument, },);

  /**
   * Every section of the translation.
   */
  const targetSections = chunkByHeadings({ document: targetDocument, },);

  /**
   * Counters accumulated across this entry's sections.
   */
  const totals = {
    targetOnlyBlocks: 0,
    targetOnlyChars: 0,
  };

  /**
   * Size of every target-only block this entry carries.
   */
  const targetOnlyBlockChars: number[] = [];

  /**
   * Source characters of every slice.
   */
  const sliceSourceChars: number[] = [];

  /**
   * Target characters of every slice.
   */
  const sliceTargetChars: number[] = [];
  for (const pair of alignment.pairs) {
    /**
     * Blocks each side carries.
     */
    const sourceNodes = pair.source
      .nodes;

    /**
     * Translation blocks, which may be none.
     */
    const targetNodes = pair.target
      .nodes;
    for (const step of alignBlocks({
      sourceNodes,
      targetNodes,
    },)) {
      if (step.kind !== 'target-only')
        continue;
      /**
       * Characters this target-only block carries.
       */
      const blockChars = targetNodes[step.targetIndex]
        ?.text
        .length
        ?? 0;
      totals.targetOnlyBlocks += 1;
      totals.targetOnlyChars += blockChars;
      targetOnlyBlockChars.push(blockChars,);
    }
    for (
      const slice of subdivideChunkPair({
        pair,
        sourceText,
        targetText,
        baseIndex: sliceSourceChars.length,
        budget: SLICE_CHAR_BUDGET,
      },)
    ) {
      sliceSourceChars.push(slice.source
        .text
        .length,);
      sliceTargetChars.push(slice.target
        .text
        .length,);
    }
  }

  /**
   * Source characters the pairs cover, which is every character a slice can
   * come from.
   */
  const pairedSourceChars = alignment.pairs
    .reduce(
      function addSource(
      running,
      pair,
    ): number {
      /**
       * Characters this pair's original carries.
       */
      const sectionChars = pair.source
        .text
        .length;
      return running + sectionChars;
    },
      0,
    );

  /**
   * Translation characters the pairs cover.
   */
  const pairedTargetChars = alignment.pairs
    .reduce(
      function addTarget(
      running,
      pair,
    ): number {
      /**
       * Characters this pair's translation carries.
       */
      const sectionChars = pair.target
        .text
        .length;
      return running + sectionChars;
    },
      0,
    );

  /**
   * Every source character the document holds inside a section.
   */
  const allSourceChars = sourceSections.reduce(
    function addSection(
    running,
    section,
  ): number {
    /**
     * Characters this section carries.
     */
    const sectionChars = section.text
      .length;
    return running + sectionChars;
  },
    0,
  );

  /**
   * Every translation character the document holds inside a section.
   */
  const allTargetChars = targetSections.reduce(
    function addSection(
    running,
    section,
  ): number {
    /**
     * Characters this section carries.
     */
    const sectionChars = section.text
      .length;
    return running + sectionChars;
  },
    0,
  );

  // One pair consumes one section on each side, so the shortfall IS the refusal
  // count. Read from the sections rather than from the aligner's findings,
  // which name a section without saying how much text it holds.
  /**
   * Sections the aligner committed to, counted once for both sides.
   */
  const pairedSections = alignment.pairs
    .length;

  return {
    entryId,
    sliceSourceChars,
    sliceTargetChars,
    unpairedSourceSections: sourceSections.length - pairedSections,
    unpairedSourceChars: allSourceChars - pairedSourceChars,
    unpairedTargetSections: targetSections.length - pairedSections,
    unpairedTargetChars: allTargetChars - pairedTargetChars,
    targetOnlyBlocks: totals.targetOnlyBlocks,
    targetOnlyChars: totals.targetOnlyChars,
    targetOnlyBlockChars,
  };
}

//endregion Slice census entry
