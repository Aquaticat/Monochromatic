import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { reportingRefusals, } from './cli-refusal.ts';
import type { AdjudicatedIssue, } from '../adjudicate-model.ts';
import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import {
  type PriorIssueDisclosure,
  PRODUCTION_PRIOR_ISSUE_DISCLOSURE,
} from '../introduced-defect-wire.ts';
import type { RepairRegion, } from '../repair-region.ts';
import {
  gatherRelabelCases,
  type RelabelCase,
} from './probe-relabel-case.ts';
import { gatherControlCases, } from './probe-relabel-control.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Probe relabel
// Asks the introduced-defect probe about regions a HUMAN read as damaged, three
// times each: under the disclosure production sends, under the other prompt,
// and with no accepted issue known at all.
//
// The cat fixtures established that the probe reports damage 3/3 on a deleted
// clause the source supports, loses one voice of three when a false accepted
// issue names that clause, and stays correctly silent when the deletion really
// is licensed. So the instrument works and the labelling effect is modest,
// which leaves the corpus result unexplained: 2438 of 2571 prober verdicts
// found nothing, including on every one of these regions.
//
// The first run answered that: withholding the list took the damaged regions
// from 0 of 15 prober verdicts raising anything to 7 of 15, with every region
// drawing at least one admissible claim. The fixture understated the effect
// because it carried ONE prior issue and these regions carry six to seventeen.
//
// That run was made while the probe still rendered the list by default.
// Production has since withheld it and moved the excusing to the screen
// (`introduced-defect-wire.ts`), and for a while the two arms here relied on
// that default, so both sent the same prompt and differed only in the screen,
// under labels that said otherwise (`#247`). Every arm now names its
// disclosure, and the third arm, no list at all, separates the screen's effect
// from the prompt's.
//
// That alone proves nothing, which is why the control arm exists. Every damaged
// region is damaged by construction, so no claim raised there could be wrong,
// and an unlabelled prober reporting the PRE-EXISTING defect would look exactly
// like one finding the damage. Regions from the same entries that the reader did
// NOT flag separate the two: a withheld arm equally loud there is re-reporting
// old defects and the finding collapses.
//
// Reads corpus text through git at the pinned commit and writes nothing.

/**
 * Disclosure production does not send, for the arm that measures the other prompt.
 */
const OTHER_DISCLOSURE: PriorIssueDisclosure = (PRODUCTION_PRIOR_ISSUE_DISCLOSURE === 'rendered')
  ? 'withheld'
  : 'rendered';

/**
 * Runs one probe call over one region and returns a printable tally.
 *
 * @param region - region under test
 *
 * @param issues - accepted issues the region was cut for; empty when nothing is known
 *
 * @param disclosure - whether the list is written into the prompt or only known to the screen
 *
 * @param sourceText - slice original
 *
 * @param baselineText - slice translation before replacement
 *
 * @returns One line of counts
 *
 * @example
 * ```ts
 * const line = await probeOnce({ region, issues: [], disclosure: 'withheld', sourceText, baselineText, },);
 * ```
 */
async function probeOnce(
  {
    region,
    issues,
    disclosure,
    sourceText,
    baselineText,
  }: {
    readonly region: RepairRegion;
    readonly issues: readonly AdjudicatedIssue[];
    readonly disclosure: PriorIssueDisclosure;
    readonly sourceText: string;
    readonly baselineText: string;
  },
): Promise<string> {
  /**
   * Report for this single region.
   */
  const report = await runIntroducedDefectProbe({
    client: createRunClient(),
    proberModelIds: RUN_MODELS.checkerModelIds,
    sourceText,
    baselineText,
    regions: [region,],
    issues,
    disclosure,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-relabel', },),
  },);

  /**
   * Screened tally of the single region.
   */
  const [tally,] = report.regions;

  // Which prober spoke is printed rather than only how many did, because the
  // corpus telemetry shows the three disagree by more than an order of
  // magnitude about how often an edit is worth a claim, 0.095 against 0.006,
  // and `#68` cannot be settled from counts that hide the speaker.
  for (const claim of tally?.claims ?? [])
    console.log(`    ${claim.modelId} ${claim.admissibility} (${claim.category})`,);

  return `heard=${String(report.heardProbers,)}/${
    String(report.configuredProbers,)
  } corroborated=${String(tally?.corroborated ?? 0,)} removal=${
    String(tally?.removalCorroborated ?? 0,)
  } contradicted=${String(tally?.contradicted ?? 0,)} unanchored=${
    String(tally?.unanchored ?? 0,)
  } preExisting=${
    String(tally?.preExisting ?? 0,)
  } none=${String(tally?.noneFound ?? 0,)} uncertain=${
    String(tally?.uncertain ?? 0,)
  }`;
}

/**
 * Probes one case under both conditions and prints the pair.
 *
 * @param relabelCase - rebuilt damaged-region case
 *
 * @example
 * ```ts
 * await probePair({ relabelCase, },);
 * ```
 */
async function probePair(
  { relabelCase, }: { readonly relabelCase: RelabelCase; },
): Promise<void> {
  /**
   * Header naming the edit under test and what the run said about it.
   */
  const header = `RELABEL ${relabelCase.entryId} positions=${
    relabelCase.positions
      .join('+',)
  } issuesServed=${
    String(relabelCase.issues
      .length,)
  } beforeChars=${
    String(relabelCase.region
      .before
      .length,)
  } afterChars=${
    String(relabelCase.region
      .editorAfter
      .length,)
  }`;
  console.log(header,);
  console.log(`  run-recorded  ${relabelCase.recorded}`,);

  /**
   * Production condition: the list under the disclosure the pass sends.
   */
  const production = await probeOnce({
    region: relabelCase.region,
    issues: relabelCase.issues,
    disclosure: PRODUCTION_PRIOR_ISSUE_DISCLOSURE,
    sourceText: relabelCase.sourceText,
    baselineText: relabelCase.baselineText,
  },);
  console.log(`  issues-${PRODUCTION_PRIOR_ISSUE_DISCLOSURE} ${production}`,);

  /**
   * The other prompt: the same list under the disclosure production does not send.
   */
  const otherPrompt = await probeOnce({
    region: relabelCase.region,
    issues: relabelCase.issues,
    disclosure: OTHER_DISCLOSURE,
    sourceText: relabelCase.sourceText,
    baselineText: relabelCase.baselineText,
  },);
  console.log(`  issues-${OTHER_DISCLOSURE} ${otherPrompt}`,);

  /**
   * Counterfactual: nothing known, so nothing rendered and nothing screened.
   */
  const absent = await probeOnce({
    region: relabelCase.region,
    issues: [],
    disclosure: PRODUCTION_PRIOR_ISSUE_DISCLOSURE,
    sourceText: relabelCase.sourceText,
    baselineText: relabelCase.baselineText,
  },);
  console.log(`  issues-absent ${absent}`,);
}

/**
 * Rebuilds every damaged-region case and probes each under both conditions.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Run artifact root for this checkout.
   */
  const dir = await resolveRunsDir();

  /**
   * Damaged regions rebuilt from the round-three draw.
   */
  const cases = await gatherRelabelCases({
    manifestPath:
      `${dir}/sample-manifest-milestone-three-precision-round-three.json`,
  },);
  console.log(
    `RELABEL rebuilt ${String(cases.length,)} distinct damaged regions`,
  );

  /**
   * Regions from the same entries that the reader did NOT flag.
   *
   * The arm that decides whether the damaged result means anything: every
   * damaged region is damaged by construction, so no claim raised there could
   * be wrong, and only unflagged regions can show whether the withheld arm is
   * detecting damage or re-reporting the defect the region was cut for.
   */
  const controls = await gatherControlCases({
    manifestPath:
      `${dir}/sample-manifest-milestone-three-precision-round-three.json`,
    damaged: cases,
  },);
  console.log(
    `RELABEL gathered ${String(controls.length,)} unflagged control regions`,
  );

  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const relabelCase of cases)
    await probePair({ relabelCase, },);
  for (const relabelCase of controls)
    await probePair({ relabelCase, },);
  /* oxlint-enable no-await-in-loop */

  console.log(
    `NOTE production sends issues-${PRODUCTION_PRIOR_ISSUE_DISCLOSURE}. Compare it against `
      + `issues-${OTHER_DISCLOSURE} on each region: a region that reports damage under one prompt `
      + 'only is one the other prompt talks the probe out of. Compare it against issues-absent: a '
      + 'region that reports damage only with no list known is one whose claims the screen '
      + 'dismisses as restating a prior issue. A region dark under all three exonerates the label '
      + 'and indicts the difficulty of the judgement.',
  );
  console.log(
    'NOTE a control line prints positions= empty. Read the issues-absent arm across controls '
      + 'against the issues-absent arm across damaged regions: similar rates mean the unlabelled '
      + 'prober is re-reporting pre-existing defects and the damaged result proves nothing, and a '
      + 'much lower control rate means the issue list is suppressing real detections.',
  );
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await reportingRefusals({
    what: 'probe-relabel',
    run: main,
  },);

//endregion Probe relabel
