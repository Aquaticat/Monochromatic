import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { resolveRunsDir, } from './run-config.ts';
import { printProbeScore, } from './score-probe-run.ts';

//region Score probe
// Wiring only: the runs directory comes from the environment here, and the
// report itself is `score-probe-run.ts`.

/**
 Reads a run's artifacts and prints the probe summary.

 @param line - the probe's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await main({ line, },);
 ```
 */
async function main({ line, }: { readonly line: CommandLineOf<'score-probe'>; },): Promise<void> {
  await printProbeScore({
    runsDir: await resolveRunsDir(),
    line,
  },);
}

// Guarded so this runs only when INVOKED. This comment used to claim every
// sibling task script was guarded too; it was not, and ten of them ran on
// import until 2026-08-14. Unguarded, this ran on IMPORT, so
// anything that pulled this module into the package bundle made importing the
// library scan a corpus directory and print to stdout.
if (import.meta.main)
  await reportingRefusals({
    what: 'score-probe',
    argv: process.argv,
    env: process.env,
    run: main,
  },);

//endregion Score probe
