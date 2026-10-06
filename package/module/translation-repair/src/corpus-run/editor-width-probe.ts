import { sampleBenchSlices, } from './bench-sample.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { widthControlHolds, } from './editor-width-control.ts';
import { gatherWidthInput, } from './editor-width-input.ts';
import { runEditorWidthProbe, } from './editor-width-probe-run.ts';
import { writeWidthReport, } from './editor-width-report.ts';
import { runWidthSlice, } from './editor-width-slice.ts';
import {
  createRunClient,
  readHeadSha,
  RUN_CORPUS_PIN,
} from './run-config.ts';

//region Editor width probe
// Does seating more EDITORS buy a better repair, with the judging panel held
// fixed: the narrow arm seats what the run configuration seats as editors, the
// wide arm the whole roster, and the command writes its report into the runs
// directory. `editor-width-probe-run.ts` holds the whole account.
//
// SPENDS QUOTA. Point `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.

/**
 Hands the run what only a real process has: the client, the pinned corpus,
 the commit read and the stages that ask a model or write to the runs
 directory.

 @param line - the probe's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await main({ line, },);
 ```
 */
function main({ line, }: { readonly line: CommandLineOf<'editor-width-probe'>; },): Promise<void> {
  return runEditorWidthProbe({
    line,
    client: createRunClient(),
    drawSample: sampleBenchSlices,
    pin: RUN_CORPUS_PIN,
    readHeadSha,
    controlHolds: widthControlHolds,
    gather: gatherWidthInput,
    runSlice: runWidthSlice,
    writeReport: writeWidthReport,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'editor-width-probe',
    argv: process.argv,
    run: main,
  },);

//endregion Editor width probe
