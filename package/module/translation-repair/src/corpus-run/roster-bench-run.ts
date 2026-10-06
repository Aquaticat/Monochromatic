import type { SyntheticClient, } from '../chat-contract.ts';
import { wordForCount, } from '../count-word.ts';
import type { RosterModelId, } from '../roster-id.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { readAskedCount, } from './asked-count.ts';
import type { BenchSlice, } from './bench-sample.ts';
import {
  BenchReportError,
  benchWidths,
  summarizeBench,
  type writeBenchReport,
} from './bench-report.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { runBenchRow, } from './roster-bench-round.ts';
import type { BenchRow, } from './roster-bench-row.ts';

//region Roster bench run
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
 Slices drawn when the caller names no count.
 */
const DEFAULT_SLICES = 10;

/**
 Reads the widths a roster supports, refusing as the command's own words a
 roster too narrow to vary.

 `BenchReportError` IS NOT MARKED AS A STATED REFUSAL, so left to escape it
 printed as a fault in the command with stack frames and exit 5, for a message
 that names only a count and says what to fix.

 @param roster - models the widths are cut from

 @returns Every width and the one run twice

 @throws {@link StatedRefusalError} when the roster is too small to vary at
 all, with the report's own error as its cause

 @example
 ```ts
 const { widths, repeated, } = widthsOrRefusal({ roster, },);
 ```
 */
function widthsOrRefusal(
  { roster, }: { readonly roster: readonly RosterModelId[]; },
): ReturnType<typeof benchWidths> {
  try {
    return benchWidths({ roster, },);
  } catch (error) {
    // THE SENTENCE IS WRITTEN HERE FROM THE ROSTER'S SIZE rather than copied
    // out of the caught error, which is not marked as free of quoted content.
    if (error instanceof BenchReportError)
      throw new StatedRefusalError({
        says: `a roster of ${String(roster.length,)} cannot be benched: nothing to vary`,
        cause: error,
      },);
    throw new Error(
      'unreachable: benchWidths threw something other than its own report error, which is all it raises',
      { cause: error, },
    );
  }
}

/**
 Runs the whole bench and writes its report.

 @param line - the bench's command line, read whole by `reportingRefusals`

 @param roster - models the widths are cut from, which also judge

 @param newClient - builds the client one row's exchanges go through; called
 once per row, since the client answers a repeated prompt from the stored
 reply of the same client, so a row must not meet the previous row's replies

 @param drawSlices - draws the slices every width sees; the pinned corpus in a
 run, a script in a case

 @param readHead - reads the pipeline commit the rows were produced by

 @param writeReport - keeps the rows so far, which the run calls after every
 row so a killed bench leaves everything it bought

 @param clock - source of the instants each row's duration is read from

 @throws {@link StatedRefusalError} when the slice count is not a count of at
 least one or the roster is too narrow to vary, both before the corpus is
 drawn; and whatever building a row's client refuses with, such as a missing
 provider key

 @example
 ```ts
 await runRosterBench({ line, roster, newClient: createRunClient, drawSlices, readHead, writeReport: writeBenchReport, clock: performance, },);
 ```
 */
export async function runRosterBench(
  {
    line,
    roster,
    newClient,
    drawSlices,
    readHead,
    writeReport,
    clock,
  }: {
    readonly line: CommandLineOf<'roster-bench'>;
    readonly roster: readonly RosterModelId[];
    readonly newClient: () => SyntheticClient;
    readonly drawSlices: (input: { readonly count: number; },) => Promise<readonly BenchSlice[]>;
    readonly readHead: () => Promise<string>;
    readonly writeReport: typeof writeBenchReport;
    readonly clock: { readonly now: () => number; };
  },
): Promise<void> {
  /**
   Slices asked for on the command line, or the default.
   */
  const wanted = readAskedCount({
    line,
    fallback: DEFAULT_SLICES,
    asks: 'slices',
  },);

  /**
   Widths this roster supports, and which of them is run twice.
   */
  const {
    widths,
    repeated,
  } = widthsOrRefusal({ roster, },);

  /**
   Slices every width sees.
   */
  const sample = await drawSlices({ count: wanted, },);
  console.log(
    `BENCH ${String(sample.length,)} ${
      wordForCount({
        count: sample.length,
        one: 'slice',
        many: 'slices',
      },)
    }, widths ${
      widths.join(', ',)
    }, width ${String(repeated,)} run twice, roster of ${
      String(roster.length,)
    }`,
  );

  /**
   Every row, accumulated as they finish so a killed run still has a report.
   */
  const rows: BenchRow[] = [];

  /**
   Pipeline commit these rows were produced by.
   */
  const headSha = await readHead();

  /**
   Every run this bench will make, width inner so each width meets the same
   provider weather rather than its own hour of the night.
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
    /* oxlint-disable no-await-in-loop -- sequential by design: each benchmark row is written before the next starts so a killed bench keeps every complete purchase; provider capacity is not the reason */
    /**
     What this slice decided at this width.
     */
    const row = await runBenchRow({
      ...run,
      roster,
      client: newClient(),
      clock,
    },);
    rows.push(row,);
    console.log(
      `BENCH ${row.entryId}#${String(row.index,)} w${String(row.width,)}p${
        String(row.pass,)
      }: ${row.decision}, ${
        row.keptIncumbent ? 'kept' : 'replaced'
      }, weight ${String(row.voteWeight,)}, ${
        String(row.calls
          .length,)
      } ${
        wordForCount({
          count: row.calls
            .length,
          one: 'call',
          many: 'calls',
        },)
      }, ${String(Math.round(row.ms,),)}ms`,
    );
    await writeReport({
      rows,
      headSha,
      widths,
      repeated,
      roster,
    },);
    /* oxlint-enable no-await-in-loop */
  }

  summarizeBench({ rows, },);
}

//endregion Roster bench run
