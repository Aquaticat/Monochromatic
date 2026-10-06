import { reportingRefusals, } from './cli-refusal.ts';
import { resolveRunsDir, } from './run-config.ts';
import { printAttribution, } from './score-attribution-run.ts';

//region Score attribution
// Wiring only: the runs directory comes from the environment here, and the
// report itself is `score-attribution-run.ts`.

/**
 Reads a run's artifacts and prints per-critic calibration.

 @example
 ```ts
 await main();
 ```
 */
async function main(): Promise<void> {
  await printAttribution({ runsDir: await resolveRunsDir(), },);
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await reportingRefusals({
    what: 'score-attribution',
    argv: process.argv,
    run: main,
  },);

//endregion Score attribution
