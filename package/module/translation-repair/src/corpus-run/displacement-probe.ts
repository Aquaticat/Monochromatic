import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import {
  classifyDisplacement,
  type DocumentDisplacement,
  type RelocationCandidate,
} from '../displacement-class.ts';
import { prepareDocumentPair, } from '../document-preparation.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Displacement probe
// `#107`: where the corpus carries a passage the translator MOVED across a
// section boundary, which a per-slice judge cannot tell from a fabrication,
// and what ELSE the same size reading turns up along the way.
//
// COSTS NOTHING AND DECIDES NOTHING. It reads two files per entry, counts
// characters, and prints. No model is asked, no artifact is written, and no lane
// reads its output.
//
// WHY IT REPORTS FOUR THINGS. Its first version reported one number, 44 moved
// pairs, and that number was a mixture: relocation, sections nobody translated,
// content that exists only in English, and arithmetic on slices too short to
// mean anything. Each wants a different remedy and a different ticket, so each
// is counted apart.

/**
 * One entry's reading, flattened for printing.
 */
type EntryDisplacement = {
  /**
   * Corpus entry this describes.
   */
  readonly entryId: string;

  /**
   * Slices this document offered.
   */
  readonly sliceCount: number;

  /**
   * Expansion the residuals were read against.
   */
  readonly baseline: number;

  /**
   * Whether that expansion came from this document or from the corpus.
   */
  readonly baselineFrom: DocumentDisplacement['baselineFrom'];

  /**
   * Slices whose original was left essentially unrendered.
   */
  readonly untranslated: readonly number[];

  /**
   * Slices carrying translation the original does not account for.
   */
  readonly targetOnly: readonly number[];

  /**
   * High slices whose neighbour gave up enough to account for them.
   */
  readonly relocationCandidates: readonly RelocationCandidate[];

  /**
   * High slices with no neighbour that gave anything up.
   */
  readonly otherImbalances: readonly number[];
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
 * ONLY A CORPUS READ FAILURE IS "MISSING". An earlier version caught every
 * error here, so a permission problem, a decoding fault or a broken git
 * invocation all read as an entry that simply lacks a translation, and the
 * corpus-wide counts would quietly shrink. Anything that is not a corpus read
 * failure is rethrown.
 *
 * @param entryId - corpus entry to read
 *
 * @returns Both texts, or that one side is absent
 *
 * @throws Whatever the read threw, when it was not a corpus read failure
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
    if (!(error instanceof CorpusReadError))
      throw error;
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
   * Sizes of both sides per slice, classified.
   */
  const reading = classifyDisplacement({
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
    sliceCount: reading.slices
      .length,
    baseline: reading.baseline,
    baselineFrom: reading.baselineFrom,
    untranslated: reading.untranslated,
    targetOnly: reading.targetOnly,
    relocationCandidates: reading.relocationCandidates,
    otherImbalances: reading.otherImbalances,
  };
}

/**
 * Counts across every complete pair.
 */
type CorpusTotals = {
  /**
   * Slices read.
   */
  readonly slices: number;

  /**
   * Entries whose own expansion was not believable.
   */
  readonly fellBack: number;

  /**
   * Slices whose neighbour accounts for their surplus.
   */
  readonly relocationCandidates: number;

  /**
   * Slices whose original was left essentially unrendered.
   */
  readonly untranslated: number;

  /**
   * Slices carrying translation the original does not account for.
   */
  readonly targetOnly: number;

  /**
   * Surpluses with only one end.
   */
  readonly otherImbalances: number;
};

/**
 * Adds one entry's counts to a running total.
 *
 * @param totals - counts so far
 *
 * @param row - entry to add
 *
 * @returns Counts including that entry
 *
 * @example
 * ```ts
 * const totals = addEntry({ totals: EMPTY_TOTALS, row, },);
 * ```
 */
function addEntry(
  {
    totals,
    row,
  }: {
    readonly totals: CorpusTotals;
    readonly row: EntryDisplacement;
  },
): CorpusTotals {
  /**
   * Whether this entry could not speak for itself.
   */
  const fellBack = (row.baselineFrom === 'corpus-reference') ? 1 : 0;

  /**
   * Relocation candidates this entry carries.
   */
  const relocations = row.relocationCandidates
    .length;

  /**
   * Untranslated slices this entry carries.
   */
  const untranslated = row.untranslated
    .length;

  /**
   * Target-only slices this entry carries.
   */
  const targetOnly = row.targetOnly
    .length;

  /**
   * One-ended surpluses this entry carries.
   */
  const imbalances = row.otherImbalances
    .length;
  return {
    slices: totals.slices + row.sliceCount,
    fellBack: totals.fellBack + fellBack,
    relocationCandidates: totals.relocationCandidates + relocations,
    untranslated: totals.untranslated + untranslated,
    targetOnly: totals.targetOnly + targetOnly,
    otherImbalances: totals.otherImbalances + imbalances,
  };
}

/**
 * Slice positions as one printable line, empty when there are none.
 *
 * @param indices - slice positions
 *
 * @returns Positions separated by spaces
 *
 * @example
 * ```ts
 * const line = indexList({ indices: row.untranslated, },);
 * ```
 */
function indexList({ indices, }: { readonly indices: readonly number[]; },): string {
  return indices.join(' ',);
}

/**
 * Whether one entry carries anything worth printing.
 *
 * @param row - entry to check
 *
 * @returns Whether any class named it
 *
 * @example
 * ```ts
 * if (isNotable({ row, },)) log.info(row.entryId,);
 * ```
 */
function isNotable({ row, }: { readonly row: EntryDisplacement; },): boolean {
  /**
   * Everything this entry was flagged for, however classified.
   */
  const flagged = addEntry({
    totals: {
      slices: 0,
      fellBack: 0,
      relocationCandidates: 0,
      untranslated: 0,
      targetOnly: 0,
      otherImbalances: 0,
    },
    row,
  },);
  if (flagged.relocationCandidates > 0)
    return true;
  if (flagged.untranslated > 0)
    return true;
  if (flagged.targetOnly > 0)
    return true;
  return flagged.otherImbalances > 0;
}

/**
 * Corpus-wide totals, one pass over every entry.
 *
 * @param rows - every entry's reading
 *
 * @returns Counts across the corpus
 *
 * @example
 * ```ts
 * const totals = corpusTotals({ rows, },);
 * ```
 */
function corpusTotals(
  { rows, }: { readonly rows: readonly EntryDisplacement[]; },
): CorpusTotals {
  return rows.reduce(
    function add(
      totals: CorpusTotals,
      row: EntryDisplacement,
    ): CorpusTotals {
      return addEntry({
        totals,
        row,
      },);
    },
    {
      slices: 0,
      fellBack: 0,
      relocationCandidates: 0,
      untranslated: 0,
      targetOnly: 0,
      otherImbalances: 0,
    },
  );
}

/**
 * Walks the pinned corpus and reports what its size anomalies look like.
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
   * Counts across every complete pair.
   */
  const totals = corpusTotals({ rows, },);
  log.info(`complete pairs: ${String(rows.length,)}`,);
  log.info(`slices read: ${String(totals.slices,)}`,);
  log.info(`entries falling back to the corpus baseline: ${String(totals.fellBack,)}`,);
  log.info(`relocation candidates: ${String(totals.relocationCandidates,)}`,);
  log.info(`untranslated slices: ${String(totals.untranslated,)}`,);
  log.info(`target-only slices: ${String(totals.targetOnly,)}`,);
  log.info(`other imbalances: ${String(totals.otherImbalances,)}`,);
  for (const row of rows) {
    if (!isNotable({ row, },))
      continue;

    /**
     * This entry's relocation candidates, written as high to low.
     */
    const moved = row.relocationCandidates
      .map(function toText(candidate,) {
        return `${String(candidate.high,)}->${String(candidate.low,)}(+${
          String(candidate.surplus,)
        }/-${String(candidate.deficit,)})`;
      },)
      .join(' ',);

    /**
     * Expansion this entry was read against.
     */
    const rate = row.baseline
      .toFixed(2,);
    log.info(`  ${row.entryId}: baseline ${rate} (${row.baselineFrom})`,);
    for (
      const [
        label,
        indices,
      ] of [
        [
          'relocation',
          moved,
        ],
        [
          'untranslated',
          indexList({ indices: row.untranslated, },),
        ],
        [
          'target-only',
          indexList({ indices: row.targetOnly, },),
        ],
        [
          'other imbalance',
          indexList({ indices: row.otherImbalances, },),
        ],
      ] as const
    ) {
      if (indices !== '')
        log.info(`    ${label}: ${indices}`,);
    }
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
