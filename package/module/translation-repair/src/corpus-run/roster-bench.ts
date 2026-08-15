import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { runTranslateStage, } from '../translate-stage.ts';
import {
  type BenchSlice,
  sampleBenchSlices,
} from './bench-sample.ts';
import {
  type BenchCall,
  recordingClient,
} from './bench-record.ts';
import {
  benchWidths,
  summarizeBench,
  writeBenchReport,
} from './bench-report.ts';
import {
  createRunClient,
  readHeadSha,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';

//region Roster bench
// Runs the SAME slices at several producer-roster widths, to answer the one
// question about width the corpus cannot answer: whether more candidates make
// the judges converge less.
//
// Width is the INNER loop and the slice the outer one. Running width 2 for an
// hour and then width 6 for an hour would confound width with provider weather,
// and this provider is measured to degrade by the day and to shed bursts under
// load. Interleaving means every width meets the same conditions.
//
// One width is run TWICE per slice, so the report carries a run-to-run band. A
// difference between widths smaller than the band between two runs of the same
// width is noise, and without the band there is no way to say which is which.
//
// SPENDS QUOTA. Point `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.

/**
 * Slices drawn when the caller names no count.
 */
const DEFAULT_SLICES = 10;

/**
 * One slice run at one width, with everything the report reads.
 *
 * @example
 * ```ts
 * const row: BenchRow = { width: 3, entryId: 'Mittens', ... };
 * ```
 */
export type BenchRow = {
  /**
   * Producers seated for this run.
   */
  readonly width: number;

  /**
   * Which pass over this width, so a repeat is distinguishable.
   */
  readonly pass: number;

  /**
   * Entry the slice came from.
   */
  readonly entryId: string;

  /**
   * Slice position within that entry.
   */
  readonly index: number;

  /**
   * Source characters, since decline rates may well move with size.
   */
  readonly sourceChars: number;

  /**
   * Incumbent characters, zero when the archive has no translation here.
   */
  readonly incumbentChars: number;

  /**
   * Exact seats, so a report can say who width 3 was.
   */
  readonly translators: readonly string[];

  /**
   * How the round ended.
   */
  readonly decision: string;

  /**
   * Whether the text that shipped was the one already there.
   */
  readonly keptIncumbent: boolean;

  /**
   * Weight the winner drew.
   */
  readonly voteWeight: number;

  /**
   * Judges seated, ballots cast, abstentions and self-votes.
   */
  readonly judgesAvailable: number;

  /**
   * Ballots that arrived.
   */
  readonly ballots: number;

  /**
   * Ballots naming no usable candidate.
   */
  readonly abstentions: number;

  /**
   * Ballots a judge cast for its own work.
   */
  readonly selfVotes: number;

  /**
   * Distinct proposals the judges saw.
   */
  readonly candidateCount: number;

  /**
   * Translators heard out of those seated.
   */
  readonly heardTranslators: number;

  /**
   * Everything the stage recorded, verbatim.
   */
  readonly findings: readonly string[];

  /**
   * Exchanges this row cost.
   */
  readonly calls: readonly BenchCall[];

  /**
   * Wall time of the whole stage call.
   */
  readonly ms: number;
};

/**
 * Runs one slice at one width and records what it cost.
 *
 * @param slice - slice to translate
 *
 * @param width - producers to seat, taken from the head of the roster
 *
 * @param pass - which pass over this width
 *
 * @returns Row for the report
 *
 * @example
 * ```ts
 * const row = await runOne({ slice, width: 3, pass: 1, },);
 * ```
 */
async function runOne(
  {
    slice,
    width,
    pass,
  }: {
    readonly slice: BenchSlice;
    readonly width: number;
    readonly pass: number;
  },
): Promise<BenchRow> {
  /**
   * Logger tagged for this run.
   */
  const l = tagged({ tag: `bench-w${String(width,)}p${String(pass,)}`, },);

  /**
   * Client recording every exchange this row makes.
   */
  const recorder = recordingClient({ inner: createRunClient(), },);

  /**
   * Seats for this width, from the head of the roster so the sequence is
   * nested: width 3 is width 2 plus one model.
   */
  const translators = RUN_ROSTER.slice(
    0,
    width,
  );

  /**
   * Start of the stage call.
   */
  const began = performance.now();

  /**
   * What the stage decided for this slice.
   */
  const result = await runTranslateStage({
    client: recorder.client,
    translatorModelIds: translators,
    judgeModelIds: RUN_ROSTER,
    sourceText: slice.sourceText,
    incumbentText: slice.incumbentText,
    lineStructured: slice.lineStructured,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);

  return {
    width,
    pass,
    entryId: slice.entryId,
    index: slice.index,
    sourceChars: slice.sourceText
      .length,
    incumbentChars: slice.incumbentText
      .length,
    translators: [...translators,],
    decision: result.decision,
    keptIncumbent: result.origin === 'incumbent',
    voteWeight: result.voteWeight,
    judgesAvailable: result.tally
      .judgesAvailable,
    ballots: result.tally
      .ballots,
    abstentions: result.tally
      .abstentions,
    selfVotes: result.tally
      .selfVotes,
    candidateCount: result.candidateCount,
    heardTranslators: result.heardTranslators,
    findings: result.findings,
    calls: recorder.calls,
    ms: performance.now() - began,
  };
}

/**
 * Runs the whole bench and writes its report.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Slices asked for on the command line, or the default.
   */
  const wanted = Number(
    process.argv[2]
      ?? String(DEFAULT_SLICES,),
  );

  /**
   * Widths this roster supports, and which of them is run twice.
   */
  const {
    widths,
    repeated,
  } = benchWidths({ roster: RUN_ROSTER, },);

  /**
   * Slices every width sees.
   */
  const sample = await sampleBenchSlices({ count: wanted, },);
  console.log(
    `BENCH ${String(sample.length,)} slices, widths ${
      widths.join(', ',)
    }, width ${String(repeated,)} run twice, roster of ${
      String(RUN_ROSTER.length,)
    }`,
  );

  /**
   * Every row, accumulated as they finish so a killed run still has a report.
   */
  const rows: BenchRow[] = [];

  /**
   * Pipeline commit these rows were produced by.
   */
  const headSha = await readHeadSha();

  /**
   * Every run this bench will make, width inner so each width meets the same
   * provider weather rather than its own hour of the night.
   */
  const runs = sample.flatMap(function toRuns(slice,) {
    return widths.flatMap(function toWidthRuns(width,) {
      return (width === repeated
        ? [
          1,
          2,
        ]
        : [1,])
        .map(function toRun(pass,) {
          return {
            slice,
            width,
            pass,
          };
        },);
    },);
  },);
  for (const run of runs) {
    /* oxlint-disable no-await-in-loop -- sequential by design: each stage call already fans out one call per model, and aggregate concurrency beyond one stream per model collapses throughput on this plan; the report write is ordered with them so a killed bench keeps every row it bought */
    /**
     * What this slice decided at this width.
     */
    const row = await runOne(run,);
    rows.push(row,);
    console.log(
      `BENCH ${row.entryId}#${String(row.index,)} w${String(row.width,)}p${
        String(row.pass,)
      }: ${row.decision}, ${
        row.keptIncumbent ? 'kept' : 'replaced'
      }, weight ${String(row.voteWeight,)}, ${
        String(row.calls
          .length,)
      } calls, ${String(Math.round(row.ms,),)}ms`,
    );
    await writeBenchReport({
      rows,
      headSha,
      widths,
      repeated,
      roster: RUN_ROSTER,
    },);
    /* oxlint-enable no-await-in-loop */
  }

  summarizeBench({ rows, },);
}

await main();

//endregion Roster bench
