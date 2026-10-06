import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import { singleRegionTally, } from './probe-single-tally.ts';
import type {
  PriorIssueList,
  SensitivityArm,
} from './probe-sensitivity-arms.ts';
import { SOURCE_TEXT, } from './probe-sensitivity-input.ts';
import {
  sensitivityArmLines,
  sensitivityNotes,
  sensitivityOpening,
} from './probe-sensitivity-print.ts';
import {
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Probe sensitivity run
// Asks the roster about every arm in order and prints what it said, which is
// the whole of the probe sensitivity runner once the process has handed it a
// client.

/**
 Runs one arm and prints what the probe said about it.

 @param arm - region, list, issue, and framing to send

 @param client - client shared by every arm

 @example
 ```ts
 await probeOne({ arm: SENSITIVITY_ARMS[0], client, },);
 ```
 */
async function probeOne(
  {
    arm,
    client,
  }: {
    readonly arm: SensitivityArm;
    readonly client: SyntheticClient;
  },
): Promise<void> {
  /**
   Report for this single region.
   */
  const report = await runIntroducedDefectProbe({
    client,
    proberModelIds: RUN_MODELS.checkerModelIds,
    sourceText: SOURCE_TEXT,
    baselineText: arm.baselineText,
    regions: [arm.region,],
    issues: arm.issues,
    identityContext: '',
    editKind: arm.editKind,
    disclosure: arm.disclosure,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-sensitivity', },),
  },);

  for (
    const line of sensitivityArmLines({
      arm,
      report,
      tally: singleRegionTally({ report, },),
    },)
  )
    console.log(line,);
}

/**
 Runs every arm in order and prints how to read the lines.

 @param client - one client for the whole instrument, counted on the run-wide
 seat tally

 @param arms - arms to ask about, in the order they run

 @param production - list production sends, which the opening and the closing
 notes name

 @example
 ```ts
 await runSensitivity({ client, arms: SENSITIVITY_ARMS, production: PRODUCTION_LIST, },);
 ```
 */
export async function runSensitivity(
  {
    client,
    arms,
    production,
  }: {
    readonly client: SyntheticClient;
    readonly arms: readonly SensitivityArm[];
    readonly production: PriorIssueList;
  },
): Promise<void> {
  console.log(
    sensitivityOpening({
      production,
      armCount: arms.length,
    },),
  );

  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const arm of arms)
    await probeOne({
      arm,
      client,
    },);
  /* oxlint-enable no-await-in-loop */

  for (const note of sensitivityNotes({ production, },))
    console.log(note,);
}

//endregion Probe sensitivity run
