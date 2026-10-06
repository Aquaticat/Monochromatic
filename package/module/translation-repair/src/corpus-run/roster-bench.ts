import { writeBenchReport, } from './bench-report.ts';
import {
  type BenchSlice,
  sampleBenchSlices,
} from './bench-sample.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { runRosterBench, } from './roster-bench-run.ts';
import {
  createRunClient,
  readHeadSha,
  RUN_CORPUS_PIN,
  RUN_ROSTER,
} from './run-config.ts';

//region Roster bench
// The roster width bench, as a command: the wiring only. What it asks and
// what it prints is in `roster-bench-run.ts`, one slice at one width is in
// `roster-bench-round.ts`, and the row it records is in `roster-bench-row.ts`.
// This file names what only a real process has: the run client, the pinned
// corpus, the roster, the repository's head and the clock.
//
// SPENDS QUOTA. Point `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.

/**
 Draws the slices every width sees from the pinned corpus.

 @param count - slices wanted

 @returns The drawn slices

 @example
 ```ts
 const sample = await drawPinned({ count: 10, },);
 ```
 */
function drawPinned({ count, }: { readonly count: number; },): Promise<readonly BenchSlice[]> {
  return sampleBenchSlices({
    count,
    pin: RUN_CORPUS_PIN,
  },);
}

/**
 Hands the real process's client, corpus, roster and clock to the bench.

 @param line - the bench's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await main({ line, },);
 ```
 */
function main({ line, }: { readonly line: CommandLineOf<'roster-bench'>; },): Promise<void> {
  return runRosterBench({
    line,
    roster: RUN_ROSTER,
    newClient: createRunClient,
    drawSlices: drawPinned,
    readHead: readHeadSha,
    writeReport: writeBenchReport,
    clock: performance,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'roster-bench',
    argv: process.argv,
    run: main,
  },);

//endregion Roster bench
