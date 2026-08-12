import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { AdjudicatedIssue, } from '../adjudicate-model.ts';
import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import type { ProbedEditKind, } from '../introduced-defect-wire.ts';
import type { RepairRegion, } from '../repair-region.ts';
import {
  BASELINE_TEXT,
  CLEAN_REGION,
  COMMA_ISSUE,
  CONTRADICTING_REGION,
  LABEL_BASELINE_TEXT,
  LICENSED_DELETION_REGION,
  LICENSING_ISSUE,
  MISLABELLED_DELETION_REGION,
  MISLABELLING_ISSUE,
  OMITTING_REGION,
  PRIOR_ISSUE,
  REFINED_BASELINE_TEXT,
  REFINED_CLEAN_REGION,
  REFINED_CONTRADICTING_REGION,
  REFINED_OMITTING_REGION,
  SOURCE_TEXT,
  UNLABELLED_DELETION_REGION,
} from './probe-sensitivity-input.ts';
import {
  createRunClient,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_MODELS,
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

/**
 * Runs the probe over one deliberately shaped region and reports what it said.
 *
 * @param region - region under test
 *
 * @param expectation - what a working probe should conclude, for the verdict
 * line only; nothing branches on it
 *
 * @param issues - accepted issues rendered into the sheet as pre-existing
 *
 * @param condition - label for the arm, printed so two lines can be compared
 *
 * @param editKind - framing under test
 *
 * @param baselineText - translation the region was cut from
 *
 * @example
 * ```ts
 * await probeOne({ region: OMITTING_REGION, expectation: 'damage', issues: [], condition: 'absent', },);
 * ```
 */
async function probeOne(
  {
    region,
    expectation,
    issues,
    condition,
    editKind = 'accuracy-repair',
    baselineText = BASELINE_TEXT,
  }: {
    readonly region: RepairRegion;
    readonly expectation: string;
    readonly issues: readonly AdjudicatedIssue[];
    readonly condition: string;
    readonly editKind?: ProbedEditKind;
    readonly baselineText?: string;
  },
): Promise<void> {
  /**
   * Report for this single region.
   */
  const report = await runIntroducedDefectProbe({
    client: createRunClient(),
    proberModelIds: RUN_MODELS.checkerModelIds,
    sourceText: SOURCE_TEXT,
    baselineText,
    regions: [region,],
    issues,
    editKind,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-sensitivity', },),
  },);

  /**
   * Screened tally of the single region.
   */
  const [tally,] = report.regions;

  console.log(
    `SENSITIVITY ${region.envelopeId} prior=${condition} expected=${
      expectation
    } heard=${
      String(report.heardProbers,)
    }/${String(report.configuredProbers,)} corroborated=${
      String(tally?.corroborated ?? 0,)
    } removal=${String(tally?.removalCorroborated ?? 0,)} contradicted=${
      String(tally?.contradicted ?? 0,)
    } unanchored=${String(tally?.unanchored ?? 0,)} noneFound=${
      String(tally?.noneFound ?? 0,)
    } uncertain=${String(tally?.uncertain ?? 0,)}`,
  );
  for (const claim of tally?.claims ?? [])
    console.log(`  claim ${claim.admissibility} (${claim.category}/${claim.severity})`,);
}

/**
 * Probes a clean region and two damaged ones, in that order.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  // Each damaged region runs TWICE, and the pairing is the point.
  //
  // Production never shows a bare region: every one arrives with the accepted
  // issues it was cut for, rendered under "PRE-EXISTING DEFECTS THIS EDIT
  // TARGETED (these are NOT your findings)". That line is one of the three
  // defenses against a prober reporting the old defect, and it is therefore
  // also the likeliest thing to talk a prober out of reporting anything at all.
  // A sensitivity result measured WITHOUT it would not describe the stage that
  // actually runs.
  //
  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const probe of [
    {
      region: CLEAN_REGION,
      expectation: 'no-damage',
    },
    {
      region: OMITTING_REGION,
      expectation: 'damage-omission',
    },
    {
      region: CONTRADICTING_REGION,
      expectation: 'damage-meaning-inverted',
    },
  ]) {
    await probeOne({
      ...probe,
      issues: [],
      condition: 'absent',
    },);
    await probeOne({
      ...probe,
      issues: [PRIOR_ISSUE,],
      condition: 'shown',
    },);
  }
  // The NATURALNESS framing gets its own arm, because it is a different prompt
  // asking the same question and a working accuracy probe proves nothing about
  // it. Its control carries the weight here: the lane exists to rephrase, so a
  // prober that reads rephrasing as damage would flag every refinement the
  // pipeline makes, and that failure is invisible in production because a
  // shadow-mode stage nobody reads looks identical either way.
  for (const probe of [
    {
      region: REFINED_CLEAN_REGION,
      expectation: 'no-damage',
    },
    {
      region: REFINED_OMITTING_REGION,
      expectation: 'damage-omission',
    },
    {
      region: REFINED_CONTRADICTING_REGION,
      expectation: 'damage-meaning-inverted',
    },
  ]) {
    await probeOne({
      ...probe,
      issues: [PRIOR_ISSUE,],
      condition: 'shown',
      editKind: 'naturalness-refinement',
      baselineText: REFINED_BASELINE_TEXT,
    },);
  }
  // The LABELLING arm asks what the pre-existing issue list itself does to a
  // verdict, which the arms above cannot answer: they vary whether a list is
  // shown, never what it SAYS. Corpus-wide the probe returns no finding on
  // 94.8 percent of prober verdicts, and its raise rate barely moves with how
  // much text an edit removed, so the remaining suspect is that the list is
  // read as ground truth rather than as a claim.
  //
  // All three regions delete a trailing clause. The first two delete the SAME
  // source-supported clause and differ only in what the list says about it; the
  // third deletes content the original genuinely lacks. If the mislabelled line
  // goes quiet while the unlabelled one reports damage, the probe is believing
  // the label, and its blindness is downstream of detection precision rather
  // than a defect of its own.
  for (const probe of [
    {
      region: UNLABELLED_DELETION_REGION,
      expectation: 'damage-omission',
      issues: [COMMA_ISSUE,],
      condition: 'unrelated-issue',
    },
    {
      region: MISLABELLED_DELETION_REGION,
      expectation: 'damage-omission',
      issues: [MISLABELLING_ISSUE,],
      condition: 'false-addition-claim',
    },
    {
      region: LICENSED_DELETION_REGION,
      expectation: 'no-damage',
      issues: [LICENSING_ISSUE,],
      condition: 'true-addition-claim',
    },
  ])
    await probeOne({
      ...probe,
      baselineText: LABEL_BASELINE_TEXT,
    },);
  /* oxlint-enable no-await-in-loop */

  console.log(
    'NOTE compare each region\'s two lines. A stage that claims damage with '
      + 'prior=absent and goes quiet with prior=shown is one the production '
      + 'prompt silences, and its zeros in a real run would mean nothing.',
  );
  console.log(
    'NOTE the refinement/* lines test the naturalness framing. Its control is '
      + 'refinement/clean: a claim there means the probe reads mere rephrasing '
      + 'as damage, which would flag every refinement the lane ever ships.',
  );
  console.log(
    'NOTE the deletion/* lines vary only what the issue list SAYS. '
      + 'deletion/unlabelled and deletion/mislabelled delete identical '
      + 'source-supported text; a gap between them measures how far a false '
      + 'accepted issue can talk the probe out of seeing real damage. '
      + 'deletion/licensed is the negative control, where silence is correct.',
  );
}

await main();

//endregion Probe sensitivity
