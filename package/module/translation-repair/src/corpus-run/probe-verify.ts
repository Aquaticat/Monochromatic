import { reportingRefusals, } from './cli-refusal.ts';
import { gatherRelabelCases, } from './probe-relabel-case.ts';
import { gatherControlCases, } from './probe-relabel-control.ts';
import { runProbeVerify, } from './probe-verify-run.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_CORPUS_PIN,
} from './run-config.ts';

//region Probe verify
// Runs the unlabelled probe over damaged and control regions alike, keeps every
// region it flags, and writes one blind sheet asking a human whether each flag
// is real.
//
// This is the measurement the relabel runs could not make. Withholding the
// accepted issues flags every damaged region and roughly four in ten unflagged
// ones, and nothing establishes what those four are, because unflagged only
// ever meant that nobody read them. A claim on a control region is either
// damage the reader never saw, which makes the probe a detector, or an
// invention, which caps its precision near half.
//
// Reads corpus text through git at the pinned commit. The sheet it writes
// quotes that text and lands outside the repository.

/**
 Hands the run's directory, pin and client builder to the verification.

 @example
 ```ts
 await main();
 ```
 */
async function main(): Promise<void> {
  await runProbeVerify({
    dir: await resolveRunsDir(),
    pin: RUN_CORPUS_PIN,
    newClient: createRunClient,
    gather: {
      damaged: gatherRelabelCases,
      controls: gatherControlCases,
    },
  },);
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await reportingRefusals({
    what: 'probe-verify',
    argv: process.argv,
    run: main,
  },);

//endregion Probe verify
