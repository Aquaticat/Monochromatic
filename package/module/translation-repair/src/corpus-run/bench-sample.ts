import { alignDocumentSections, } from '../chunk-document.ts';
import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { isLineStructured, } from '../line-structure.ts';
import { parseDocument, } from '../parse-document.ts';
import { subdivideChunkPair, } from '../slice-pair.ts';
import { pickSpreadSample, } from './bench-draw.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Bench sample
// The slices a roster-width bench runs, drawn the same way every time.
//
// Deterministic because the whole point is comparing widths: if each width saw
// a different sample, the decline rates would differ by sample and nothing
// could be read off the comparison. The draw is a stride over slices ordered by
// SOURCE SIZE, which spreads the sample across the size range rather than
// concentrating it wherever the corpus happens to be dense.
//
// Spends no quota. Reads the pinned corpus only.

/**
 * Characters of a read failure kept when an entry is skipped, enough to name
 * the missing side without printing a stack per entry.
 */
const SKIP_DETAIL_CHARS = 80;

/**
 * One slice the bench translates, with the facts a stage call needs.
 *
 * @example
 * ```ts
 * const slice: BenchSlice = { entryId: 'Mittens', index: 3, ... };
 * ```
 */
export type BenchSlice = {
  /**
   * Entry this slice was cut from.
   */
  readonly entryId: string;

  /**
   * Position within that entry's slices, so a row can be traced back.
   */
  readonly index: number;

  /**
   * Original passage to render.
   */
  readonly sourceText: string;

  /**
   * Translation as it stands, blank when the archive has none here.
   */
  readonly incumbentText: string;

  /**
   * Whether the line-structure rule governs this slice, inherited from its
   * chunk exactly as `repairTranslation` inherits it.
   */
  readonly lineStructured: boolean;
};

/**
 * Cuts one entry into slices, or returns none when either side is unreadable.
 *
 * @param entryId - corpus entry
 *
 * @returns Every slice of that entry
 *
 * @example
 * ```ts
 * const slices = await sliceEntry({ entryId: 'Mittens', },);
 * ```
 */
async function sliceEntry(
  { entryId, }: { readonly entryId: string; },
): Promise<readonly BenchSlice[]> {
  /**
   * Both sides at the pin; an entry missing either is simply not sampled.
   */
  const [sourceText, targetText,] = await Promise.all([
    readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${entryId}/page.md`,
    },),
    readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${entryId}/page.en.md`,
    },),
  ],);

  /**
   * Aligned sections, exactly as the pipeline pairs them.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  },);

  /**
   * Slices accumulated across this entry's sections.
   */
  const slices: BenchSlice[] = [];
  for (const pair of alignment.pairs) {
    /**
     * Whether the whole section reads as line-structured, which its slices
     * inherit.
     */
    const chunkGoverns = isLineStructured({ text: pair.source
      .text, },);
    for (
      const slice of subdivideChunkPair({
        pair,
        sourceText,
        targetText,
        baseIndex: slices.length,
      },)
    ) {
      slices.push({
        entryId,
        index: slices.length,
        sourceText: slice.source
          .text,
        incumbentText: slice.target
          .text,
        lineStructured: chunkGoverns
          || isLineStructured({ text: slice.source
            .text, },),
      },);
    }
  }

  return slices;
}

/**
 * Draws the bench sample across the whole pinned corpus.
 *
 * @param count - slices wanted; fewer come back only when the corpus holds
 * fewer
 *
 * @returns Sample ordered by source size, smallest first
 *
 * @example
 * ```ts
 * const sample = await sampleBenchSlices({ count: 12, },);
 * ```
 */
export async function sampleBenchSlices(
  { count, }: { readonly count: number; },
): Promise<readonly BenchSlice[]> {
  /**
   * Entries at the pin, in the order the corpus lists them.
   */
  const entryIds = await listCorpusPeople({ pin: RUN_CORPUS_PIN, },);

  /**
   * Every entry sliced, or reported as unreadable.
   *
   * An entry missing one side is not a bench failure: the census reports the
   * same gap, and refusing to draw a sample over it would make the bench depend
   * on corpus completeness it does not need.
   */
  const sliced = await Promise.all(
    entryIds.map(async function sliceOne(entryId,): Promise<readonly BenchSlice[]> {
      try {
        return await sliceEntry({ entryId, },);
      }
      catch (error) {
        /**
         * Why this entry could not be sliced, trimmed for one log line.
         */
        const detail = String(error,)
          .slice(
            0,
            SKIP_DETAIL_CHARS,
          );
        console.log(`BENCH skipping ${entryId}: ${detail}`,);
        return [];
      }
    },),
  );

  /**
   * Every slice of every readable entry.
   */
  const all = sliced.flat();
  if (all.length === 0)
    throw new Error('bench sample found no slices in the pinned corpus',);

  return pickSpreadSample({
    slices: all,
    count,
  },);
}

//endregion Bench sample
