import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  classifyDisplacement,
  type DocumentDisplacement,
  type RelocationCandidate,
} from '../displacement-class.ts';
import { sliceSizeOf, } from '../displacement-ratio.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import {
  resolveRunsDir,
  RUN_CORPUS_PIN,
} from './run-config.ts';
import {
  carveSettled,
  listSettledEntryIds,
  recipeLabel,
  type SettledCarve,
} from './settled-carve.ts';
import { isMarkupOnly, } from './markup-slice.ts';
import { sharesMedia, } from './transcription-suspect.ts';
import { reportingRefusals, } from './cli-refusal.ts';

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
   * Relocation candidates whose high slice embeds the same media on both sides,
   * so a transcription explains the surplus at least as well as a move does.
   */
  readonly transcriptionSuspects: readonly number[];

  /**
   * Low slices whose ORIGINAL is markup rather than prose, so they sit below
   * baseline for a reason unrelated to giving a passage up and cannot be a
   * relocation donor. `#107` named this class by hand; it is reported rather
   * than suppressed so a reader knows what to subtract.
   */
  readonly markupDonors: readonly number[];

  /**
   * High slices with no neighbour that gave anything up.
   */
  readonly otherImbalances: readonly number[];
};

/**
 * Reads one entry's slice sizes.
 *
 * @param entryId - corpus entry to read
 *
 * @param prepared - slicing the lanes saw, carved through the entry's settled
 * recipe
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
    prepared,
  }: {
    readonly entryId: string;
    readonly prepared: PreparedDocumentPair;
  },
): EntryDisplacement {
  /**
   * Sizes of both sides per slice, classified.
   */
  const reading = classifyDisplacement({
    slices: prepared.slices
      .map(function toSizes(slice,) {
        return sliceSizeOf({
          sourceText: slice.source
            .text,
          targetText: slice.target
            .text,
        },);
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
    transcriptionSuspects: reading.relocationCandidates
      .filter(function embedsMedia(candidate,) {
        /**
         * Slice pair the surplus sits in.
         */
        const slice = prepared.slices[candidate.high];
        if (slice === undefined)
          return false;
        return sharesMedia({
          sourceText: slice.source
            .text,
          targetText: slice.target
            .text,
        },);
      },)
      .map(function toIndex(candidate,) {
        return candidate.high;
      },),
    markupDonors: reading.relocationCandidates
      .filter(function donorIsMarkup(candidate,) {
        /**
         * Slice the passage would have had to come FROM, which is the low side.
         *
         * THE LOW SIDE, not the high one, and that is the whole point. A
         * transcription suspect is recognised by what the HIGH slice embeds; a
         * markup donor is recognised by what the LOW slice never had.
         */
        const slice = prepared.slices[candidate.low];
        if (slice === undefined)
          return false;
        return isMarkupOnly({
          sourceText: slice.source
            .text,
        },);
      },)
      .map(function toIndex(candidate,) {
        return candidate.low;
      },),
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
   * ADJACENCIES, not slices: one high slice beside two qualifying neighbours
   * counts twice, and one donor can account for two separate highs. Anything
   * reported as a share of slices has to be counted as unique slices instead,
   * which is what the handover does.
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
   * Relocation candidates a transcription would also explain.
   */
  readonly transcriptionSuspects: number;

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
   * Relocation candidates a transcription would also explain.
   */
  const suspects = row.transcriptionSuspects
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
    transcriptionSuspects: totals.transcriptionSuspects + suspects,
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
      transcriptionSuspects: 0,
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
      transcriptionSuspects: 0,
      otherImbalances: 0,
    },
  );
}

/**
 * One entry beside its carve, or the reason it has none.
 *
 * @example
 * ```ts
 * const entry: EntryCarve = { entryId: 'whiskers', carve: { kind: 'unsettled', }, };
 * ```
 */
type EntryCarve = {
  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Its carve through the settled recipe, or why there is none.
   */
  readonly carve: SettledCarve;
};

/**
 * Walks the settled entries and reports what their size anomalies look like.
 *
 * OVER SETTLED ENTRIES ONLY, carved through the recipe each artifact records,
 * since the displacement this reads is a property of the slicing the lanes
 * judged. Its first versions carved the whole corpus with the deterministic
 * aligner and counted that aligner's own slides as translation displacement.
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
   * Runs directory whose settled artifacts name the population.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Every settled entry.
   */
  const entryIds = await listSettledEntryIds({ runsDir, },);

  /**
   * Each entry carved through its recipe, or the reason it could not be.
   */
  const carves = await Promise.all(entryIds.map(async function toCarve(entryId,): Promise<EntryCarve> {
    /**
     * Slicing the lanes saw.
     */
    const carve = await carveSettled({
      entryId,
      runsDir,
      cloneDir: RUN_CORPUS_PIN.cloneDir,
    },);
    if (carve.kind !== 'settled')
      log.info(`${entryId}: skipped, ${carve.kind} artifact records no recipe`,);
    return {
      entryId,
      carve,
    };
  },),);

  /**
   * Readings for every settled entry.
   */
  const rows = carves.flatMap(function toRow({
    entryId,
    carve,
  },): readonly EntryDisplacement[] {
    if (carve.kind !== 'settled')
      return [];
    return [readEntry({
      entryId,
      prepared: carve.prepared,
    },),];
  },);

  /**
   * Settled entries whose recipe had a defaulted half.
   */
  const defaulted = carves.filter(function wasDefaulted({ carve, },): boolean {
    if (carve.kind !== 'settled')
      return false;

    /**
     * Halves this recipe lacks.
     */
    const { unrecorded, } = carve.recipe;
    return unrecorded.length > 0;
  },);

  /**
   * Counts across every settled entry.
   */
  const totals = corpusTotals({ rows, },);
  log.info(`settled entries carved: ${String(rows.length,)} of ${String(entryIds.length,)} artifacts`,);
  log.info(`  with a defaulted recipe half: ${String(defaulted.length,)}`,);
  for (
    const {
      entryId,
      carve,
    } of defaulted
  ) {
    if (carve.kind === 'settled')
      log.info(`  ${entryId}: ${recipeLabel({ recipe: carve.recipe, },)}`,);
  }
  log.info(`slices read: ${String(totals.slices,)}`,);
  log.info(`entries falling back to the corpus baseline: ${String(totals.fellBack,)}`,);
  log.info(`relocation candidates: ${String(totals.relocationCandidates,)}`,);
  log.info(
    `  of which a transcription would also explain: ${String(totals.transcriptionSuspects,)}`,
  );
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
          'transcription suspect',
          indexList({ indices: row.transcriptionSuspects, },),
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
  await reportingRefusals({
    what: 'displacement-probe',
    run: main,
  },);

//endregion Displacement probe
