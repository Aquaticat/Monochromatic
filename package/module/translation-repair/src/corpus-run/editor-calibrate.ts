import { adoptCalibrationGrace, } from '../grace-override.ts';
import { readWriterGrace, } from '../writer-grace-override.ts';
import { sampleBenchSlices, } from './bench-sample.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { runEditorCalibrate, } from './editor-calibrate-run.ts';
import {
  createRunClient,
  readRunCorpusPinSetting,
} from './run-config.ts';
import { readOverlap, } from './slice-overlap.ts';

//region Editor calibrate
// Which of the roster should edit, measured on the editor's own job: every
// model edits and judges every slice drawn from the pinned corpus, and the
// command prints the editor standing, the refiner standing and what shipped
// with no vote behind it. `editor-calibrate-run.ts` holds the whole account.
//
// SPENDS QUOTA. Point `TRANSLATION_REPAIR_RUNS_DIR` at a throwaway directory.

/**
 Hands the run what only a real process has: the overlap dial from its
 environment, the pinned corpus, the two straggler windows and the client.

 @param line - the calibration's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await main({ line, },);
 ```
 */
function main({ line, }: { readonly line: CommandLineOf<'editor-calibrate'>; },): Promise<void> {
  /**
   Corpus clone and commit this run reads, after any environment
   override, read inside the refusal boundary (ledger B302).
   */
  const { pin, } = readRunCorpusPinSetting({ env: process.env, },);
  return runEditorCalibrate({
    line,
    readOverlap,
    drawSample: sampleBenchSlices,
    pin,
    adoptGrace: adoptCalibrationGrace,
    readWriterGrace,
    newClient: createRunClient,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'editor-calibrate',
    argv: process.argv,
    env: process.env,
    run: main,
  },);

//endregion Editor calibrate
