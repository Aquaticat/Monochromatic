import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { AdjudicationConfig, } from './adjudicate-model.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import type { BenchmarkEntry, } from './prepare-entry.ts';
import type { RepairModels, } from './repair-chunk.ts';
import {
  repairTranslation,
  type RepairStatus,
  type RepairTranslationResult,
} from './repair-translation.ts';
import { applySeededErrors, } from './seeded-error.ts';

//region Repair benchmark
// Milestone-two exit harness: plant omission seeds into real translations,
// run the whole repair loop, and measure how much of the deleted content
// came back. Ground truth is exact because we planted the deletion; the
// editor re-translates from the original, so restoration is graded on the
// distinctive vocabulary the deletion removed, never on byte equality.

/**
 * Logger root for the repair benchmark shell.
 */
const l = tagged({ tag: 'translation-repair-repair-benchmark', },);

/**
 * Minimum content-word length that counts as distinctive vocabulary;
 * shorter words recur everywhere and prove nothing about restoration.
 */
const CONTENT_WORD_MIN_CHARS = 4;

/**
 * Fraction of disappeared content words that must return for a seed to
 * grade as restored. Editors re-translate rather than recall the original
 * wording, so half of the distinctive vocabulary returning marks the
 * sentence as back; calibratable once repair runs accumulate.
 */
export const RESTORATION_WORD_THRESHOLD: number = 1 / 2;

/**
 * Budget floor under which no new entry dispatches;
 * a sliver of remaining budget cannot fit a whole repair run.
 */
export const MIN_REPAIR_DISPATCH_BUDGET_MS = 120_000;

/**
 * Distinct lowercase content words of one text,
 * by linear scan over alphanumeric runs; no regex needed.
 *
 * @param text - text whose vocabulary is collected
 *
 * @returns Distinct words at least {@link CONTENT_WORD_MIN_CHARS} long
 *
 * @example
 * ```ts
 * contentWords({ text: 'The cat naps.', },);
 * ```
 */
export function contentWords(
  { text, }: { readonly text: string; },
): ReadonlySet<string> {
  /**
   * Lowercased input for case-free comparison.
   */
  const lowered = text.toLowerCase();

  /**
   * Distinct words collected by the scan.
   */
  const words = new Set<string>();

  /**
   * Start of the run currently being scanned; -1 outside a run.
   */
  let runStart = -1;
  // Code-unit scan: every word character tested below is ASCII, so
  // surrogate halves and combining marks simply read as non-word
  // separators, which is exactly what vocabulary collection wants.
  for (let index = 0; index < lowered.length; index += 1) {
    /**
     * Code unit under the cursor.
     */
    const character = lowered.charAt(index,);

    /**
     * Whether this character continues a word run.
     */
    const isWordChar = ((character >= 'a') && (character <= 'z'))
      || ((character >= '0') && (character <= '9'))
      || (character === '\'');
    if (isWordChar && (runStart === (-1))) {
      runStart = index;
      continue;
    }
    if ((!isWordChar) && (runStart !== (-1))) {
      if ((index - runStart) >= CONTENT_WORD_MIN_CHARS)
        words.add(lowered.slice(
          runStart,
          index,
        ),);
      runStart = -1;
    }
  }
  if ((runStart !== (-1)) && ((lowered.length - runStart) >= CONTENT_WORD_MIN_CHARS))
    words.add(lowered.slice(runStart,),);

  return words;
}

/**
 * Restoration grade of one planted deletion.
 *
 * @example
 * ```ts
 * const grade: SeedRestoration = {
 *   measurable: true,
 *   disappearedWords: 8,
 *   returnedWords: 6,
 *   restored: true,
 * };
 * ```
 */
export type SeedRestoration = {
  /**
   * Whether the deletion removed any distinctive vocabulary at all;
   * a needle whose every word survives elsewhere cannot be graded.
   */
  readonly measurable: boolean;

  /**
   * Content words the deletion removed from the seeded text.
   */
  readonly disappearedWords: number;

  /**
   * Disappeared words present again in the repaired text.
   */
  readonly returnedWords: number;

  /**
   * Whether returned reaches {@link RESTORATION_WORD_THRESHOLD} of
   * disappeared; always false for unmeasurable seeds.
   */
  readonly restored: boolean;
};

/**
 * Grades one planted deletion against the repaired text.
 * Only vocabulary the deletion actually removed counts:
 * a word surviving elsewhere in the seeded text proves nothing.
 *
 * @param needle - deleted sentence exactly as planted
 *
 * @param seededText - translation after planting, before repair
 *
 * @param repairedText - pipeline output under grading
 *
 * @returns Restoration grade as data
 *
 * @example
 * ```ts
 * const grade = measureSeedRestoration({ needle, seededText, repairedText, },);
 * ```
 */
export function measureSeedRestoration(
  {
    needle,
    seededText,
    repairedText,
  }: {
    readonly needle: string;
    readonly seededText: string;
    readonly repairedText: string;
  },
): SeedRestoration {
  /**
   * Vocabulary surviving in the seeded text.
   */
  const seededWords = contentWords({ text: seededText, },);

  /**
   * Needle vocabulary the deletion actually removed.
   */
  const disappeared = [...contentWords({ text: needle, },),]
    .filter(function isGone(word,) {
      return !seededWords.has(word,);
    },);
  if (disappeared.length === 0) {
    return {
      measurable: false,
      disappearedWords: 0,
      returnedWords: 0,
      restored: false,
    };
  }

  /**
   * Vocabulary of the repaired text.
   */
  const repairedWords = contentWords({ text: repairedText, },);

  /**
   * Disappeared words the repair brought back.
   */
  const returned = disappeared.filter(function cameBack(word,) {
    return repairedWords.has(word,);
  },);

  return {
    measurable: true,
    disappearedWords: disappeared.length,
    returnedWords: returned.length,
    restored: (returned.length / disappeared.length) >= RESTORATION_WORD_THRESHOLD,
  };
}

/**
 * One graded repair attempt over one entry.
 *
 * @example
 * ```ts
 * const record: RepairAttemptRecord = {
 *   entryId: 'whiskers',
 *   outcomeKind: 'ok',
 *   status: 'repaired',
 *   seedGrades: { 'seed/omission-0': grade, },
 *   issueCount: 3,
 *   resolvedIssueCount: 2,
 * };
 * ```
 */
export type RepairAttemptRecord = {
  /**
   * Entry under repair.
   */
  readonly entryId: string;

  /**
   * Whether the run dispatched, was cut by the budget, or threw.
   */
  readonly outcomeKind: 'ok' | 'skipped' | 'error';

  /**
   * Pipeline completion status; absent when the run never produced one.
   */
  readonly status?: RepairStatus;

  /**
   * Restoration grade per planted seed id.
   */
  readonly seedGrades: Readonly<Record<string, SeedRestoration>>;

  /**
   * Adjudicated issues the run reported.
   */
  readonly issueCount: number;

  /**
   * Issues the checkers confirmed fixed in the shipped text.
   */
  readonly resolvedIssueCount: number;

  /**
   * Failure or skip detail in scorecard-stable wording.
   */
  readonly detail: string;
};

/**
 * Milestone-two scorecard.
 *
 * @example
 * ```ts
 * const scorecard = computeRepairScorecard({ records, },);
 * ```
 */
export type RepairScorecard = {
  /**
   * Entries dispatched (not skipped).
   */
  readonly dispatchedEntries: number;

  /**
   * Fraction of entries dispatched before the budget cut.
   */
  readonly coverage: number;

  /**
   * Measurable seeds across dispatched entries.
   */
  readonly seedUniverse: number;

  /**
   * Measurable seeds graded restored.
   */
  readonly restoredSeeds: number;

  /**
   * THE go/no-go number: restored over measurable seeds.
   */
  readonly seededRepairRate: number;

  /**
   * Runs per completion status.
   */
  readonly statusCounts: Readonly<Record<string, number>>;
};

/**
 * Aggregates graded repair attempts into the milestone-two scorecard.
 *
 * @param records - graded attempts in run order
 *
 * @returns Scorecard over dispatched attempts with honest coverage
 *
 * @example
 * ```ts
 * const scorecard = computeRepairScorecard({ records, },);
 * ```
 */
export function computeRepairScorecard(
  { records, }: { readonly records: readonly RepairAttemptRecord[]; },
): RepairScorecard {
  /**
   * Attempts that actually dispatched.
   */
  const dispatched = records.filter(function isDispatched(record,) {
    return record.outcomeKind !== 'skipped';
  },);

  /**
   * Measurable seed grades across dispatched attempts.
   */
  const grades = dispatched.flatMap(function toGrades(record,) {
    return Object
      .values(record.seedGrades,)
      .filter(function isMeasurable(grade,) {
        return grade.measurable;
      },);
  },);

  /**
   * Grades that reached the restoration threshold.
   */
  const restored = grades.filter(function isRestored(grade,) {
    return grade.restored;
  },);

  /**
   * Runs per completion status.
   */
  const statusCounts: Record<string, number> = {};
  for (const record of dispatched) {
    if (record.status === undefined)
      continue;
    statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
  }

  return {
    dispatchedEntries: dispatched.length,
    coverage: records.length === 0 ? 1 : dispatched.length / records.length,
    seedUniverse: grades.length,
    restoredSeeds: restored.length,
    seededRepairRate: grades.length === 0 ? 0 : restored.length / grades.length,
    statusCounts,
  };
}

/**
 * Whole repair benchmark result.
 *
 * @example
 * ```ts
 * const { records, scorecard, } = await runRepairBenchmark({ ... },);
 * ```
 */
export type RepairBenchmarkResult = {
  /**
   * Graded attempts in entry order.
   */
  readonly records: readonly RepairAttemptRecord[];

  /**
   * Aggregate scorecard.
   */
  readonly scorecard: RepairScorecard;
};

/**
 * Runs the milestone-two benchmark: every entry gets its seeds planted,
 * the whole repair loop runs on the seeded pair, and restoration grades
 * against the known deletions. Entries run sequentially inside the run
 * budget; what the budget cannot fit records as skipped, and the
 * scorecard reports the resulting coverage.
 *
 * @param client - injected model client
 *
 * @param entries - corpus entries with derived seeds
 *
 * @param models - role roster for every repair run
 *
 * @param adjudicationConfig - tally thresholds and weights
 *
 * @param signal - abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param runBudgetMs - wall budget for the whole benchmark
 *
 * @param repair - repair driver seam; tests inject a scripted one
 *
 * @returns Graded attempts plus the aggregate scorecard
 *
 * @example
 * ```ts
 * const { scorecard, } = await runRepairBenchmark({ client, entries, models, signal, },);
 * console.log(scorecard.seededRepairRate,);
 * ```
 */
export async function runRepairBenchmark(
  {
    client,
    entries,
    models,
    adjudicationConfig,
    signal,
    perCallTimeoutMs,
    runBudgetMs,
    repair = repairTranslation,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly entries: readonly BenchmarkEntry[];
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs?: number;
    readonly runBudgetMs?: number;
    readonly repair?: typeof repairTranslation;
  }>,
): Promise<RepairBenchmarkResult> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: runRepairBenchmark.name,
    l,
  },);

  /**
   * Clock start the run budget counts from.
   */
  const runStartedAt = Date.now();

  /**
   * Graded attempts in entry order.
   */
  const records: RepairAttemptRecord[] = [];
  for (const entry of entries) {
    /**
     * Run budget left at dispatch time; unbounded without a budget.
     */
    const remaining = runBudgetMs === undefined
      ? Number.POSITIVE_INFINITY
      : runBudgetMs - (Date.now() - runStartedAt);
    if (remaining < MIN_REPAIR_DISPATCH_BUDGET_MS) {
      rl.warn(`${entry.entryId}: run budget exhausted, skipping`,);
      records.push({
        entryId: entry.entryId,
        outcomeKind: 'skipped',
        seedGrades: {},
        issueCount: 0,
        resolvedIssueCount: 0,
        detail: 'run-budget-exhausted',
      },);
      continue;
    }

    /**
     * Seeded pair for this entry.
     */
    const { seededText, } = applySeededErrors({
      text: entry.targetText,
      specs: entry.seeds,
    },);
    try {
      /* oxlint-disable no-await-in-loop -- sequential by design: each repair run already fans out one call per model per stage, and aggregate concurrency beyond that collapses throughput on this plan */
      /**
       * Whole-pipeline result over the seeded pair.
       */
      const result: RepairTranslationResult = await repair({
        client,
        sourceText: entry.sourceText,
        targetText: seededText,
        models,
        ...(adjudicationConfig === undefined ? {} : { adjudicationConfig, }),
        signal,
        ...(perCallTimeoutMs === undefined ? {} : { perCallTimeoutMs, }),
      },);
      /* oxlint-enable no-await-in-loop */
      records.push({
        entryId: entry.entryId,
        outcomeKind: 'ok',
        status: result.status,
        seedGrades: Object.fromEntries(entry.seeds
          .map(function gradeSeed(seed,) {
          return [
            seed.id,
            measureSeedRestoration({
              needle: seed.needle,
              seededText,
              repairedText: result.repairedText,
            },),
          ];
        },),),
        issueCount: result.issues
          .length,
        resolvedIssueCount: result.issues
          .filter(function isResolved(record,) {
          return record.resolved;
        },)
          .length,
        detail: '',
      },);
    }
    catch (error) {
      // Aborts must always win so user steering can stop the benchmark.
      if (signal.aborted)
        throw error;
      rl.warn(`${entry.entryId}: repair threw ${String(error,)}`,);
      records.push({
        entryId: entry.entryId,
        outcomeKind: 'error',
        seedGrades: {},
        issueCount: 0,
        resolvedIssueCount: 0,
        detail: String(error,),
      },);
    }
  }

  return {
    records,
    scorecard: computeRepairScorecard({ records, },),
  };
}

//endregion Repair benchmark
