import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { deriveOmissionSeeds, } from '../derive-seeds.ts';
import { splitFrontMatter, } from '../front-matter.ts';
import type { BenchmarkEntry, } from '../prepare-entry.ts';
import { runRepairBenchmark, } from '../repair-benchmark.ts';
import { bandOf, } from './band-order.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CALL_CONFIG,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Recall benchmark
// Measures what precision cannot see: of the defects that ARE present, how many
// does the pipeline find, and how many does it actually repair.
//
// Precision is measured on the pipeline's own output, so a pipeline that
// accepts almost nothing scores beautifully and repairs nothing. This runner
// plants known omissions into a clean translation, runs the whole repair loop
// on the seeded pair, and grades restoration against the deletions it made, so
// the denominator is defects that certainly exist rather than defects the
// pipeline chose to report.
//
// Run with `mise run //package/module/translation-repair:recall-benchmark`
// (append `-- --plan` for a zero-quota setup check).

/**
 * Entries drawn from each size band. Nine entries keeps a run inside a few
 * hours at the measured per-entry cost while still covering every band.
 */
const ENTRIES_PER_BAND = 3;

/**
 * Seeds planted per entry. Each is a whole deleted sentence, so a handful per
 * document gives a usable denominator without turning the translation into
 * something no reviewer would call a translation.
 */
const SEEDS_PER_ENTRY = 3;

/**
 * Milliseconds in one second.
 */
const MS_PER_SECOND = 1_000;

/**
 * Seconds in one minute.
 */
const SECONDS_PER_MINUTE = 60;

/**
 * Minutes in one hour.
 */
const MINUTES_PER_HOUR = 60;

/**
 * Hours the whole benchmark may run.
 */
const BUDGET_HOURS = 4;

/**
 * Wall budget for the whole benchmark; entries the budget cannot fit record as
 * skipped and the scorecard reports the resulting coverage honestly.
 */
const RUN_BUDGET_MS = BUDGET_HOURS
  * MINUTES_PER_HOUR
  * SECONDS_PER_MINUTE
  * MS_PER_SECOND;

/**
 * Decimal places rates are reported to.
 */
const RATE_DECIMALS = 3;

/**
 * Bands in report order.
 */
const BANDS = [
  'small',
  'medium',
  'large',
] as const;

/**
 * Outcome of trying to seed one corpus id. A discriminated result rather than
 * a nullish return, because "this entry cannot be seeded" is an ordinary,
 * expected answer that the caller must branch on, not an absence.
 */
type SeedOutcome =
  | {
    readonly kind: 'seeded';
    readonly entry: BenchmarkEntry;
    readonly band: string;
  }
  | {
    readonly kind: 'skipped';
    readonly reason: string;
  };

/**
 * Builds the seeded benchmark entry for one corpus id, reporting why when it
 * cannot be seeded.
 *
 * @param id - corpus person id
 *
 * @param sizer - shared encoder measuring source bytes for banding
 *
 * @returns Seeded entry with its band, or the reason it was skipped
 *
 * @example
 * ```ts
 * const outcome = await buildEntry({ id: 'Whiskers', sizer, },);
 * ```
 */
async function buildEntry(
  {
    id,
    sizer,
  }: {
    readonly id: string;
    readonly sizer: TextEncoder;
  },
): Promise<SeedOutcome> {
  try {
    /**
     * Original zh page, front matter included: the repair loop reads it whole.
     */
    const sourceText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${id}/page.md`,
    },);

    /**
     * Clean en translation, the text seeds are planted into.
     */
    const targetText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${id}/page.en.md`,
    },);

    /**
     * Body only. Seeds must come from prose, never from front matter, whose
     * deletion would break identity rather than plant an omission.
     */
    const { body, } = splitFrontMatter({ text: targetText, },);

    /**
     * Deletions to plant, longest sentences first.
     */
    const seeds = deriveOmissionSeeds({
      text: body,
      maxSeeds: SEEDS_PER_ENTRY,
    },);
    if (seeds.length === 0) {
      return {
        kind: 'skipped',
        reason: 'no seedable sentence',
      };
    }

    return {
      kind: 'seeded',
      band: bandOf({
        sourceBytes: sizer.encode(sourceText,)
          .length,
      },),
      entry: {
        entryId: id,
        sourceText,
        targetText,
        seeds,
      },
    };
  }
  catch (error) {
    // A missing side is an expected non-pair; anything else is a real fault.
    if (!(error instanceof CorpusReadError))
      throw error;
    return {
      kind: 'skipped',
      reason: 'incomplete pair',
    };
  }
}

/**
 * Runs the recall benchmark over a band-stratified corpus sample and writes its
 * scorecard beside the other run artifacts.
 *
 * @throws {@link Error} when the API key env var is unset
 *
 * @example
 * ```ts
 * await runRecallBenchmark();
 * ```
 */
async function runRecallBenchmark(): Promise<void> {
  /**
   * Durable, gitignored output root.
   */
  const runsDir = await resolveRunsDir();
  await mkdir(
    runsDir,
    { recursive: true, },
  );

  /**
   * Pipeline tip recorded into the scorecard.
   */
  const tip = await readHeadSha();

  /**
   * Every person id at the pinned commit.
   */
  const people = await listCorpusPeople({ pin: RUN_CORPUS_PIN, },);

  /**
   * Encoder measuring page-source bytes for banding.
   */
  const sizer = new TextEncoder();

  /**
   * Seeded entries chosen per band, filled in corpus order so the selection is
   * deterministic for a given pin.
   */
  const chosen: BenchmarkEntry[] = [];

  /**
   * How many entries each band has contributed so far.
   */
  const perBand: Record<string, number> = {
    small: 0,
    medium: 0,
    large: 0,
  };
  for (const id of people) {
    if (chosen.length >= (ENTRIES_PER_BAND * BANDS.length))
      break;

    /**
     * This id's seeding outcome, carrying its band when it is usable.
     */
    /* oxlint-disable-next-line no-await-in-loop -- corpus reads are sequential git shows and this selection runs once at setup */
    const outcome = await buildEntry({
      id,
      sizer,
    },);
    if (outcome.kind === 'skipped')
      continue;
    if ((perBand[outcome.band] ?? 0) >= ENTRIES_PER_BAND)
      continue;
    chosen.push(outcome.entry,);
    perBand[outcome.band] = (perBand[outcome.band] ?? 0) + 1;
  }

  /**
   * Total seeds this run will plant, the detection denominator.
   */
  const plannedSeeds = chosen.reduce(
    function addSeeds(
      sum,
      entry,
    ) {
      return sum
        + entry.seeds
        .length;
    },
    0,
  );
  console.log(
    `START tip=${tip} entries=${String(chosen.length,)} seeds=${String(plannedSeeds,)} `
    + `perBand=${JSON.stringify(perBand,)} budget=${String(RUN_BUDGET_MS,)}ms`,
  );

  /**
   * Shared client; per-model concurrency defaults to one, which the measured
   * per-model serialization says is correct.
   */
  const client = createRunClient();

  if (process.argv
    .includes('--plan',)) {
    console.log(
      `PLAN ok tip=${tip} client=constructed entries=${
        chosen
          .map(function toId(entry,) {
            return entry.entryId;
          },)
          .join(',',)
      }`,
    );
    return;
  }

  /**
   * Graded attempts and the aggregate scorecard.
   */
  const {
    records,
    scorecard,
  } = await runRepairBenchmark({
    client,
    entries: chosen,
    models: RUN_MODELS,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    runBudgetMs: RUN_BUDGET_MS,
  },);

  await writeFile(
    join(
      runsDir,
      'recall-scorecard.json',
    ),
    `${JSON.stringify(
      {
        tip,
        corpusSha: RUN_CORPUS_PIN.commitSha,
        callConfig: RUN_CALL_CONFIG,
        timestamp: new Date().toISOString(),
        entriesPerBand: ENTRIES_PER_BAND,
        seedsPerEntry: SEEDS_PER_ENTRY,
        scorecard,
        records,
      },
      undefined,
      2,
    )}\n`,
  );

  console.log(
    `SCORECARD dispatched=${String(scorecard.dispatchedEntries,)} coverage=${
      scorecard.coverage
        .toFixed(RATE_DECIMALS,)
    } planted=${String(scorecard.plantedSeeds,)} detected=${
      String(scorecard.detectedSeeds,)
    } detectionRate=${
      scorecard.seedDetectionRate
        .toFixed(RATE_DECIMALS,)
    }`,
  );
  console.log(
    `REPAIR judged=${String(scorecard.judgedSeeds,)} restored=${
      String(scorecard.restoredSeeds,)
    } partial=${String(scorecard.partialSeeds,)} strict=${
      scorecard.seededRepairRate
        .toFixed(RATE_DECIMALS,)
    } lenient=${
      scorecard.seededRepairRateLenient
        .toFixed(RATE_DECIMALS,)
    }`,
  );
}

if (import.meta.main)
  await runRecallBenchmark();

//endregion Recall benchmark
