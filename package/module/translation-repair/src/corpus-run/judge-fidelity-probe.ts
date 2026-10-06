import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { readReviewedFidelityReferences, } from '../fidelity-reference-read.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { runFidelityProbe, } from './judge-fidelity-probe-run.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import { nowAsIso, } from './probe-run-clock.ts';
import { readRunnerClosure, } from './runner-closure.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Source-reviewed judge calibration
// Wiring only: the command line, the build's identity, the corpus pin, the
// reference reader, the runs directory, the client builder, the clock, the
// logger and standard output go to `judge-fidelity-probe-run.ts`, which holds
// the whole run. An unchanged archive is not automatically correct; review
// locks the reference and every intentional delta.

/**
 Hands the run what only a real process has.

 @param line - the probe's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await main({ line, },);
 ```
 */
async function main({ line, }: { readonly line: CommandLineOf<'judge-fidelity-probe'>; },): Promise<void> {
  /**
   Digest over built output, read before anything runs: the identity that
   answers for a run is the build present at startup, whatever is rebuilt
   while it is in flight.
   */
  const { digest: pipelineDigest, } = await digestPipeline({ dir: import.meta.dirname, },);
  return runFidelityProbe({
    line,
    pin: RUN_CORPUS_PIN,
    readReferences: readReviewedFidelityReferences,
    resolveRuns: resolveRunsDir,
    newClient: createRunClient,
    now: nowAsIso,
    pipelineDigest,
    runnerClosure: await readRunnerClosure({ entryPath: line.script, },),
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    log: tagged({ tag: 'judge-fidelity-probe', },),
    out: process.stdout,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'judge-fidelity-probe',
    argv: process.argv,
    env: process.env,
    run: main,
  },);

//endregion Source-reviewed judge calibration
