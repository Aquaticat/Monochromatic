import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { nowAsIso, } from './probe-run-clock.ts';
import { runRecallBenchmark, } from './recall-benchmark-run.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CORPUS_PIN,
} from './run-config.ts';

//region Recall benchmark
// The recall benchmark, as a command: the wiring only. How entries are chosen
// and seeded is in `recall-benchmark-choose.ts` and `recall-benchmark-entry.ts`,
// what is printed in `recall-benchmark-report.ts`, and the run itself in
// `recall-benchmark-run.ts`. This file names what only a real process has: the
// runs directory, the pinned corpus, the repository's head, the run client
// and the clock.
//
// Run with `mise run //package/module/translation-repair:recall-benchmark`
// (append `-- --plan` for a zero-quota setup check).

/**
 Hands the real process's places and client to the benchmark.

 @param line - the benchmark's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await main({ line, },);
 ```
 */
async function main({ line, }: { readonly line: CommandLineOf<'recall-benchmark'>; },): Promise<void> {
  return runRecallBenchmark({
    line,
    runsDir: await resolveRunsDir(),
    readTip: readHeadSha,
    pin: RUN_CORPUS_PIN,
    newClient: createRunClient,
    now: nowAsIso,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'recall-benchmark',
    argv: process.argv,
    run: main,
  },);

//endregion Recall benchmark
