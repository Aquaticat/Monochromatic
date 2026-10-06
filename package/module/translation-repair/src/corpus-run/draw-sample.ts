import { readCorpusFile, } from '../corpus-source.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { drawGradingSample, } from './draw-sample-run.ts';
import {
  RUN_CORPUS_PIN,
  resolveRunsDir,
} from './run-config.ts';

//region Draw sample
// Draws the stratified precision sample over every settled artifact and writes
// the grading sheets outside the repo: `draw-sample-pool.ts` reads the pool,
// `draw-sample-bands.ts` says how it divides, `draw-sample-sheets.ts` writes
// the three files and `draw-sample-run.ts` is the procedure.

/**
 Draws over the runs directory of the environment and the pinned corpus.

 @param line - the draw's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await drawSample({ line, },);
 ```
 */
async function drawSample({ line, }: { readonly line: CommandLineOf<'draw-sample'>; },): Promise<void> {
  await drawGradingSample({
    line,
    runsDir: await resolveRunsDir(),
    pin: RUN_CORPUS_PIN,
    readSource: readCorpusFile,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'draw-sample',
    argv: process.argv,
    env: process.env,
    run: drawSample,
  },);

//endregion Draw sample
