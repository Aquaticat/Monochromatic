import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import {
  PRODUCTION_LIST,
  SENSITIVITY_ARMS,
  type SensitivityArm,
} from './probe-sensitivity-arms.ts';
import { SOURCE_TEXT, } from './probe-sensitivity-input.ts';
import {
  createRunClient,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Probe sensitivity
// Asks whether the introduced-defect probe can detect damage AT ALL.
//
// Run 007 reported no claims of any kind across its first eight regions: every
// prober cast an explicit negative and nothing was corroborated, contradicted,
// or even unanchored. Two readings fit that. The repairs may genuinely be
// clean, having already passed an editor ensemble, a judge selection, and a
// checker stage. Or the three defenses built into the prompt against reporting
// the pre-existing defect may have over-corrected into an instrument that never
// claims anything, in which case a whole round of zeros would be
// indistinguishable from a stage that is silently broken.
//
// Waiting for the round to end does not separate those. Injecting damage does:
// a probe that misses an obvious fabrication is not conservative, it is deaf.
//
// Probe inputs live in `probe-sensitivity-input.ts` and are cat-themed invention.
// NO corpus text, licensed or otherwise, takes part, and this writes nothing.
//
// THE ARMS LIVE IN `probe-sensitivity-arms.ts`, as data with a test, since
// `#247`: this file once built its arms inline, and its `prior=shown` arm sent
// the same prompt as its `prior=absent` arm because it relied on a default
// that had flipped. Every arm now names the list it sends, and the test holds
// the name to the value before a run spends anything.

/**
 * Runs one arm and prints what the probe said about it.
 *
 * @param arm - region, list, issue, and framing to send
 *
 * @param client - client shared by every arm
 *
 * @example
 * ```ts
 * await probeOne({ arm: SENSITIVITY_ARMS[0], client, },);
 * ```
 */
async function probeOne(
  {
    arm,
    client,
  }: {
    readonly arm: SensitivityArm;
    readonly client: ReturnType<typeof createRunClient>;
  },
): Promise<void> {
  /**
   * Report for this single region.
   */
  const report = await runIntroducedDefectProbe({
    client,
    proberModelIds: RUN_MODELS.checkerModelIds,
    sourceText: SOURCE_TEXT,
    baselineText: arm.baselineText,
    regions: [arm.region,],
    issues: arm.issues,
    editKind: arm.editKind,
    disclosure: arm.disclosure,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-sensitivity', },),
  },);

  /**
   * Screened tally of the single region.
   */
  const [tally,] = report.regions;

  /**
   * Region the line names.
   */
  const { region, } = arm;

  console.log(
    `SENSITIVITY ${region.envelopeId} list=${arm.list} issue=${arm.issue} expected=${
      arm.expectation
    } heard=${
      String(report.heardProbers,)
    }/${String(report.configuredProbers,)} corroborated=${
      String(tally?.corroborated ?? 0,)
    } removal=${String(tally?.removalCorroborated ?? 0,)} contradicted=${
      String(tally?.contradicted ?? 0,)
    } unanchored=${String(tally?.unanchored ?? 0,)} preExisting=${
      String(tally?.preExisting ?? 0,)
    } noneFound=${
      String(tally?.noneFound ?? 0,)
    } uncertain=${String(tally?.uncertain ?? 0,)}`,
  );
  for (const claim of tally?.claims ?? [])
    console.log(`  claim ${claim.admissibility} (${claim.category}/${claim.severity})`,);
}

/**
 * Runs every arm in order and prints how to read the lines.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * One client for the whole instrument, counted on the run-wide seat tally.
   */
  const client = createRunClient();

  console.log(
    `SENSITIVITY production sends list=${PRODUCTION_LIST}; ${
      String(SENSITIVITY_ARMS.length,)
    } arms follow`,
  );

  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const arm of SENSITIVITY_ARMS)
    await probeOne({
      arm,
      client,
    },);
  /* oxlint-enable no-await-in-loop */

  console.log(
    `NOTE compare each accuracy region's three lines. list=none against list=withheld differ only `
      + 'in the deterministic screen, which dismisses a claim restating the prior issue; '
      + 'list=withheld against list=rendered differ only in the prompt, and rendered is the prompt '
      + 'production abandoned because it silenced the stage. A region that reports damage with '
      + 'list=none and goes quiet with list=withheld is one whose claims merely restate the prior '
      + 'issue; one that goes quiet only with list=rendered is one the rendered prompt silences, '
      + `and its zeros would mean nothing in a run that rendered. Production sends list=${
        PRODUCTION_LIST
      }.`,
  );
  console.log(
    'NOTE the refinement/* lines test the naturalness framing under production\'s list. Its '
      + 'control is refinement/clean: a claim there means the probe reads mere rephrasing as '
      + 'damage, which would flag every refinement the lane ever ships.',
  );
  console.log(
    'NOTE the deletion/* lines vary what the issue list SAYS, under both lists that carry one. '
      + 'With list=rendered the prober reads the label; with list=withheld only the screen does. '
      + 'deletion/unlabelled and deletion/mislabelled delete identical source-supported text; a '
      + 'gap between them under list=rendered measures how far a false accepted issue can talk '
      + 'the probe out of seeing real damage, and under list=withheld how far the screen dismisses '
      + 'a real claim as restating it. deletion/licensed is the negative control, where silence '
      + 'is correct.',
  );
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await reportingRefusals({
    what: 'probe-sensitivity',
    run: main,
  },);

//endregion Probe sensitivity
