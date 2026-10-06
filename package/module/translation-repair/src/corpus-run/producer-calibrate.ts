import {
  type BenchSlice,
  sampleBenchSlices,
} from './bench-sample.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { runProducerCalibrate, } from './producer-calibrate-run.ts';
import {
  createRunClient,
  readHeadSha,
  RUN_CORPUS_PIN,
} from './run-config.ts';

//region Producer calibrate
// The producer calibration, as a command: the wiring only. Which models write
// and why is in `producer-calibrate-run.ts`; what one slice does is in
// `producer-calibrate-round.ts`. This file names what only a real process has:
// the run client, the pinned corpus and the repository's head.

/**
 Draws the slices every model writes from the pinned corpus.

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
 Hands the real process's client, corpus and head to the calibration.

 @param line - the calibration's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await main({ line, },);
 ```
 */
function main({ line, }: { readonly line: CommandLineOf<'producer-calibrate'>; },): Promise<void> {
  return runProducerCalibrate({
    line,
    newClient: createRunClient,
    drawSlices: drawPinned,
    readHead: readHeadSha,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'producer-calibrate',
    argv: process.argv,
    env: process.env,
    run: main,
  },);

//endregion Producer calibrate
