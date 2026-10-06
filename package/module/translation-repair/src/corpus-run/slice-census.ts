import { reportingRefusals, } from './cli-refusal.ts';
import {
  resolveRunsDir,
  RUN_CORPUS_PIN,
} from './run-config.ts';
import { readSettledRecipe, } from './settled-carve.ts';
import { reportSliceCensus, } from './slice-census-report.ts';

//region Slice census
// What the corpus looks like AFTER slicing, as a command: the wiring only. The
// report is `slice-census-report.ts`, which says what it answers; the pin and
// the runs directory are what only a real process has.

// Guarded so this runs only when INVOKED, never as an import side effect.
if (import.meta.main)
  await reportingRefusals({
    what: 'slice-census',
    argv: process.argv,
    run: function runSliceCensus(): Promise<void> {
      return reportSliceCensus({
        pin: RUN_CORPUS_PIN,
        resolveRuns: resolveRunsDir,
        readRecipe: readSettledRecipe,
      },);
    },
  },);

//endregion Slice census
