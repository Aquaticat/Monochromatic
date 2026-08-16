import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import {
  type DocumentDisplacement,
  readDisplacement,
} from '../displacement-ratio.ts';
import { prepareDocumentPair, } from '../document-preparation.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Displacement probe
// `#107`: how much of the corpus carries a passage the translator MOVED across
// a section boundary, which a per-slice judge cannot tell from a fabrication.
//
// COSTS NOTHING AND DECIDES NOTHING. It reads two files per entry, counts
// characters, and prints. No model is asked, no artifact is written, and no lane
// reads its output. It exists so Question 5's replacement rate can be read
// against how much of the archive is laid out differently rather than written
// worse.
//
// WHAT A ROW MEANS. A HIGH slice took on more text than its own document's
// median expansion explains; a MOVED PAIR is such a slice next to one below the
// median, which is what a relocated passage looks like from both ends.

/**
 * One entry's reading.
 */
type EntryDisplacement = {
  /**
   * Corpus entry this describes.
   */
  readonly entryId: string;

  /**
   * Slices long enough to read.
   */
  readonly readable: number;

  /**
   * This document's own expansion.
   */
  readonly median: number;

  /**
   * Slices well above it.
   */
  readonly highIndices: readonly number[];

  /**
   * High slices beside a below-median neighbour.
   */
  readonly movedPairs: readonly {
    readonly high: number;
    readonly low: number;
  }[];
};

/**
 * Both sides of one entry, or the fact that it has only one.
 */
type PairRead = {
  /**
   * Both files were there.
   */
  readonly kind: 'read';

  /**
   * Original document text.
   */
  readonly source: string;

  /**
   * Translation document text.
   */
  readonly target: string;
} | {
  /**
   * One side is absent, which is an incomplete entry rather than a fault.
   */
  readonly kind: 'missing';
};

/**
 * Reads one entry's two sides, or reports that it has only one.
 *
 * @param entryId - corpus entry to read
 *
 * @returns Both texts, or that one side is absent
 *
 * @example
 * ```ts
 * const texts = await readPair({ entryId, },);
 * ```
 */
async function readPair({ entryId, }: { readonly entryId: string; },): Promise<PairRead> {
  try {
    return {
      kind: 'read',
      source: await readCorpusFile({
        pin: RUN_CORPUS_PIN,
        relPath: `people/${entryId}/page.md`,
      },),
      target: await readCorpusFile({
        pin: RUN_CORPUS_PIN,
        relPath: `people/${entryId}/page.en.md`,
      },),
    };
  }
  catch (error) {
    // An entry with one side is an ordinary state of this corpus rather than a
    // fault, so the reason is recorded and the walk continues.
    tagged({ tag: 'displacement-probe', },)
      .info(`${entryId}: skipped, ${String(error,)}`,);
    return { kind: 'missing', };
  }
}

/**
 * Reads one entry's slice sizes.
 *
 * @param entryId - corpus entry to read
 *
 * @param source - original document text
 *
 * @param target - translation document text
 *
 * @returns What the screen made of it
 *
 * @example
 * ```ts
 * const reading = readEntry({ entryId, source, target, },);
 * ```
 */
function readEntry(
  {
    entryId,
    source,
    target,
  }: {
    readonly entryId: string;
    readonly source: string;
    readonly target: string;
  },
): EntryDisplacement {
  /**
   * Slices exactly as the lanes would see them.
   */
  const prepared = prepareDocumentPair({
    sourceText: source,
    targetText: target,
  },);

  /**
   * Sizes of both sides per slice.
   */
  const reading: DocumentDisplacement = readDisplacement({
    slices: prepared.slices
      .map(function toSizes(slice,) {
        return {
          sourceChars: slice.source
            .text
            .length,
          targetChars: slice.target
            .text
            .length,
        };
      },),
  },);
  return {
    entryId,
    readable: reading.ratios
      .length,
    median: reading.median,
    highIndices: reading.highIndices,
    movedPairs: reading.movedPairs,
  };
}

/**
 * Walks the pinned corpus and reports where a passage appears to have moved.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Logger tagged for this probe.
   */
  const log = tagged({ tag: 'displacement-probe', },);

  /**
   * Every entry at the pin.
   */
  const entryIds = await listCorpusPeople({ pin: RUN_CORPUS_PIN, },);

  /**
   * Readings for every complete pair.
   */
  const rows = (await Promise.all(entryIds.map(async function toRow(entryId,) {
    /**
     * Both sides, or nothing when this entry lacks one.
     */
    const texts = await readPair({ entryId, },);
    if (texts.kind === 'missing')
      return undefined;
    return readEntry({
      entryId,
      source: texts.source,
      target: texts.target,
    },);
  },),))
    .filter(function wasRead(row,): row is EntryDisplacement {
      return row !== undefined;
    },);

  /**
   * Entries carrying at least one moved pair.
   */
  const withMoved = rows.filter(function hasMoved(row,) {
    return row.movedPairs
      .length
      > 0;
  },);

  /**
   * Slices read across the corpus.
   */
  const readable = rows.reduce(
    function addReadable(
      total,
      row,
    ) {
      return total + row.readable;
    },
    0,
  );

  /**
   * Moved pairs across the corpus.
   */
  const moved = rows.reduce(
    function addMoved(
      total,
      row,
    ) {
      /**
       * Pairs this entry carries.
       */
      const here = row.movedPairs
        .length;
      return total + here;
    },
    0,
  );

  /**
   * High slices across the corpus, moved or not.
   */
  const high = rows.reduce(
    function addHigh(
      total,
      row,
    ) {
      /**
       * High slices this entry carries.
       */
      const here = row.highIndices
        .length;
      return total + here;
    },
    0,
  );
  log.info(`complete pairs: ${String(rows.length,)}`,);
  log.info(`slices read: ${String(readable,)}`,);
  log.info(`high slices: ${String(high,)}`,);
  log.info(`moved pairs: ${String(moved,)}`,);
  log.info(`entries carrying at least one: ${String(withMoved.length,)}`,);
  for (const row of withMoved) {
    /**
     * This entry's pairs, written as high to low.
     */
    const pairs = row.movedPairs
      .map(function toText(pair,) {
        return `${String(pair.high,)}->${String(pair.low,)}`;
      },)
      .join(' ',);

    /**
     * This document's own expansion, to two places.
     */
    const rate = row.median
      .toFixed(2,);
    log.info(`  ${row.entryId}: median ${rate}, pairs ${pairs}`,);
  }
  process.stdout
    .write(`${
      JSON.stringify(
        { rows, },
        undefined,
        2,
      )
    }\n`,);
}

if (import.meta.main)
  await main();

//endregion Displacement probe
