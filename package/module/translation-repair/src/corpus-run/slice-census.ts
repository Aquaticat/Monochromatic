import { alignBlocks, } from '../align-blocks-walk.ts';
import { alignDocumentSections, } from '../chunk-document.ts';
import {
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { parseDocument, } from '../parse-document.ts';
import {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from '../slice-pair.ts';
import {
  describeSpread,
  REPORTED_PERCENTILES,
} from './census-spread.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Slice census
// What the corpus looks like AFTER slicing, measured rather than assumed, and
// spending no quota.
//
// Three questions need this and none of them could be answered from the code:
//
//   How many calls a translate lane costs, which is slices times producers, and
//   how large the largest of them is. `RUN_PER_CALL_TIMEOUT_MS` was tuned
//   against repair envelopes averaging 72 characters, and this lane sends whole
//   slices.
//
//   How much of the corpus reaches the lane as a section only ONE side carries,
//   which subdivision returns whole. Those are the calls that time out.
//
//   How much text sits in TARGET-ONLY blocks, the class where the English
//   carries something the Chinese markdown does not, letters held as images
//   being the known case. A translator working from the source has no source for
//   it, so whether it can be detected deterministically decides whether it can
//   be protected.

/**
 * Size at which a translate call is known to be at risk.
 *
 * The translate probe asked for a 4641-character section in one call and lost
 * two voices of three: one timed out at six minutes, one returned
 * schema-invalid output. That is the only measured point on this curve, so it
 * is the threshold rather than a round number.
 */
const PROBE_TIMEOUT_CHARS = 4_641;


/**
 * One entry with the largest single slice it produced.
 *
 * Named rather than inferred, because an inferred object literal carries
 * writable properties and the comparator that sorts these then takes mutable
 * parameters it never mutates.
 *
 * @example
 * ```ts
 * const widest: WidestSlice = { entryId: 'shihai4h', largest: 10_959, };
 * ```
 */
type WidestSlice = Readonly<{
  /**
   * Corpus id.
   */
  entryId: string;

  /**
   * Characters in its largest slice, on either side.
   */
  largest: number;
}>;

/**
 * One entry's measured shape.
 *
 * @example
 * ```ts
 * const row: EntryCensus = { entryId, sliceCount: 12, ... };
 * ```
 */
type EntryCensus = {
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
   * Sections subdivision returned whole because one side carried no blocks.
   */
  readonly onesidedSections: number;

  /**
   * Characters of source in those sections, which is what one call would carry.
   */
  readonly onesidedSourceChars: number;

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
async function censusEntry(
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
   * Aligned section pairs, exactly as the pipeline cuts them.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  },);

  /**
   * Counters accumulated across this entry's sections.
   */
  const totals = {
    onesidedSections: 0,
    onesidedSourceChars: 0,
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
    if ((sourceNodes.length === 0) || (targetNodes.length === 0)) {
      totals.onesidedSections += 1;
      totals.onesidedSourceChars += pair.source
        .text
        .length;
    }
    else {
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

  return {
    entryId,
    sliceSourceChars,
    sliceTargetChars,
    onesidedSections: totals.onesidedSections,
    onesidedSourceChars: totals.onesidedSourceChars,
    targetOnlyBlocks: totals.targetOnlyBlocks,
    targetOnlyChars: totals.targetOnlyChars,
    targetOnlyBlockChars,
  };
}

/**
 * Measures every complete pair at the pin and prints the census.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Every corpus id at the pinned commit.
   */
  const entryIds = await listCorpusPeople({ pin: RUN_CORPUS_PIN, },);

  /**
   * Entries that carry both sides, measured.
   */
  const rows: EntryCensus[] = [];

  /**
   * Ids missing one side, which is ordinary rather than a fault.
   */
  const incomplete: string[] = [];
  for (const entryId of entryIds) {
    try {
      /* oxlint-disable-next-line no-await-in-loop -- sequential by design: this reads git at a pinned commit and a fan-out would only contend for the same object store */
      rows.push(await censusEntry({ entryId, },),);
    }
    catch (error) {
      // A missing translation is the ordinary shape of an incomplete pair, and
      // the corpus has them. Anything else keeps propagating.
      if (!(error instanceof CorpusReadError))
        throw error;
      incomplete.push(entryId,);
    }
  }

  /**
   * Every slice's source characters, corpus-wide.
   */
  const sourceChars = rows.flatMap(function toSourceChars(row,) {
    return [...row.sliceSourceChars,];
  },);

  /**
   * Every slice's target characters.
   */
  const targetChars = rows.flatMap(function toTargetChars(row,) {
    return [...row.sliceTargetChars,];
  },);
  console.log(
    `CENSUS ${String(rows.length,)} complete pairs, ${
      String(incomplete.length,)
    } incomplete, ${String(sourceChars.length,)} slices`,
  );
  console.log(describeSpread({
    label: 'CENSUS slice source chars',
    values: sourceChars,
  },),);
  console.log(describeSpread({
    label: 'CENSUS slice target chars',
    values: targetChars,
  },),);

  /**
   * Entries carrying a section subdivision returns whole.
   */
  const onesided = rows.filter(function hasOnesided(row,) {
    return row.onesidedSections > 0;
  },);
  console.log(
    `CENSUS one-sided sections: ${
      String(onesided.reduce(
        function addSections(
        sum,
        row,
      ) {
        return sum + row.onesidedSections;
      },
        0,
      ),)
    } across ${String(onesided.length,)} entries, ${
      String(onesided.reduce(
        function addChars(
        sum,
        row,
      ) {
        return sum + row.onesidedSourceChars;
      },
        0,
      ),)
    } source chars, largest single section ${
      String(Math.max(
        0,
        ...onesided.map(function toChars(row,) {
          return row.onesidedSourceChars;
        },),
      ),)
    }`,
  );

  /**
   * Entries carrying blocks only the translation has.
   */
  const targetOnly = rows
    .filter(function hasTargetOnly(row,) {
      return row.targetOnlyBlocks > 0;
    },)
    .toSorted(function byChars(
      left,
      right,
    ) {
      return right.targetOnlyChars - left.targetOnlyChars;
    },);
  console.log(
    `CENSUS target-only blocks: ${
      String(targetOnly.reduce(
        function addBlocks(
        sum,
        row,
      ) {
        return sum + row.targetOnlyBlocks;
      },
        0,
      ),)
    } across ${String(targetOnly.length,)} entries, ${
      String(targetOnly.reduce(
        function addChars(
        sum,
        row,
      ) {
        return sum + row.targetOnlyChars;
      },
        0,
      ),)
    } chars`,
  );
  for (const row of targetOnly.slice(
    0,
    REPORTED_PERCENTILES.length,
  )) {
    console.log(
      `CENSUS   ${row.entryId}: ${String(row.targetOnlyBlocks,)} blocks, ${
        String(row.targetOnlyChars,)
      } chars`,
    );
  }
  console.log(describeSpread({
    label: 'CENSUS target-only block chars',
    values: rows.flatMap(function toBlockChars(row,) {
      return [...row.targetOnlyBlockChars,];
    },),
  },),);

  /**
   * Entries ordered by their largest slice, since the tail is what a per-call
   * deadline meets first and a percentile hides which entry owns it.
   */
  const widest = rows
    .map(function toWidest(row,): WidestSlice {
      return {
        entryId: row.entryId,
        largest: Math.max(
          0,
          ...row.sliceTargetChars,
          ...row.sliceSourceChars,
        ),
      };
    },)
    .toSorted(function byLargest(
      left,
      right,
    ) {
      return right.largest - left.largest;
    },);

  /**
   * Slices carrying more than the whole-section call the translate probe
   * already saw time out at six minutes.
   */
  const oversized = rows.flatMap(function toOversized(row,) {
    return row.sliceTargetChars
      .filter(function isLarge(chars,) {
      return chars > PROBE_TIMEOUT_CHARS;
    },);
  },);
  console.log(
    `CENSUS slices over ${String(PROBE_TIMEOUT_CHARS,)} target chars: ${
      String(oversized.length,)
    } of ${String(targetChars.length,)}`,
  );
  for (const row of widest.slice(
    0,
    REPORTED_PERCENTILES.length,
  )) {
    console.log(
      `CENSUS   widest ${row.entryId}: ${String(row.largest,)} chars in one slice`,
    );
  }
}

// Guarded so this runs only when INVOKED, never as an import side effect.
if (import.meta.main)
  await main();

//endregion Slice census
