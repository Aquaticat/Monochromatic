import { logger, } from '@monochromatic-dev/module-logger/ts';

import { reportingRefusals, } from './cli-refusal.ts';
import { sampleDamage, } from './damage-sample-run.ts';
import { textSettingOf, } from './env-text-setting.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Damage sample
// Draws shipped regions at random and asks a human the same source-anchored
// question the probe asks: `damage-sample-pool.ts` collects the regions,
// `damage-sample-draw.ts` draws them and `damage-sample-run.ts` is the
// procedure.

/**
 Samples damage over the runs directory and the draw seed of the environment.

 @example
 ```ts
 await sampleOverTheEnvironment();
 ```
 */
async function sampleOverTheEnvironment(): Promise<void> {
  await sampleDamage({
    runsDir: await resolveRunsDir(),
    // Draw seed, overridable so a later round can draw a fresh sample; an
    // exported-empty variable reads as unset (ledger D15).
    seed: textSettingOf({
      env: process.env,
      name: 'DAMAGE_SAMPLE_SEED',
      fallback: 'damage-round-one',
    },),
    openClient: createRunClient,
    proberModelIds: RUN_MODELS.checkerModelIds,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: logger,
  },);
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await reportingRefusals({
    what: 'damage-sample',
    argv: process.argv,
    run: sampleOverTheEnvironment,
  },);

//endregion Damage sample
