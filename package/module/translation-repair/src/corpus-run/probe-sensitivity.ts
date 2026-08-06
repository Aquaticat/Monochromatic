import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { AdjudicatedIssue, } from '../adjudicate-model.ts';
import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import type { RepairRegion, } from '../repair-region.ts';
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
// The fixtures are cat-themed invention. NO corpus text, licensed or otherwise,
// takes part in this check, and it writes nothing.

/**
 * Region whose replacement fixes the stated defect and introduces nothing.
 *
 * The control. A probe that flags this is over-eager, which is the failure this
 * prompt was built to avoid, and finding it here would be as informative as
 * finding the opposite.
 */
const CLEAN_REGION: RepairRegion = {
  envelopeId: 'envelope/clean',
  issueIds: ['adjudicated/tense',],
  before: 'The cat is doing the sleeping on the windowsill.',
  editorAfter: 'The cat sleeps on the windowsill.',
};

/**
 * Region whose replacement fixes the tense and DROPS the second clause.
 *
 * Omission is the damage class the screen was widened for, and the one a
 * forward-only quote requirement could never anchor.
 */
const OMITTING_REGION: RepairRegion = {
  envelopeId: 'envelope/omitting',
  issueIds: ['adjudicated/tense',],
  before: 'The cat is doing the sleeping on the windowsill, and she wakes when the sun moves.',
  editorAfter: 'The cat sleeps on the windowsill.',
};

/**
 * Region whose replacement fixes the tense and inverts the meaning.
 *
 * Blatant on purpose: the source says the cat likes butterflies and the
 * replacement says she hates them. A reviewer shown both texts cannot miss it
 * without failing at the task entirely.
 */
const CONTRADICTING_REGION: RepairRegion = {
  envelopeId: 'envelope/contradicting',
  issueIds: ['adjudicated/tense',],
  before: 'The cat is doing the chasing of butterflies, which she loves.',
  editorAfter: 'The cat chases butterflies, which she hates.',
};

/**
 * Original the regions are judged against.
 */
const SOURCE_TEXT = `猫猫在窗台上睡觉，太阳移动时她会醒来。
猫猫追蝴蝶，她很喜欢蝴蝶。`;

/**
 * Translation before any replacement.
 */
const BASELINE_TEXT = `The cat is doing the sleeping on the windowsill, and she wakes when the sun moves.
The cat is doing the chasing of butterflies, which she loves.`;

/**
 * Accepted issue every region was cut for, rendered into the sheet exactly as
 * production renders it.
 *
 * Its summary names the progressive gloss, which IS present in each region's
 * before text and IS fixed by each replacement. That is the point: a prober
 * tempted to report the region's known defect has one sitting in front of it,
 * labelled as not a finding.
 */
const PRIOR_ISSUE: AdjudicatedIssue = {
  issueId: 'adjudicated/tense',
  status: 'accepted',
  severity: 'major',
  claims: [
    {
      claimId: 'claim/tense',
      claim: {
        category: 'style/awkward-phrasing',
        severity: 'major',
        summary: 'Progressive gloss "is doing the" reads as machine output.',
        spans: [],
      },
    },
  ],
  tallies: {},
};

/**
 * Runs the probe over one deliberately shaped region and reports what it said.
 *
 * @param region - region under test
 *
 * @param expectation - what a working probe should conclude, for the verdict
 * line only; nothing branches on it
 *
 * @example
 * ```ts
 * await probeOne({ region: OMITTING_REGION, expectation: 'damage', },);
 * ```
 */
async function probeOne(
  {
    region,
    expectation,
    issues,
    condition,
  }: {
    readonly region: RepairRegion;
    readonly expectation: string;
    readonly issues: readonly AdjudicatedIssue[];
    readonly condition: string;
  },
): Promise<void> {
  /**
   * Report for this single region.
   */
  const report = await runIntroducedDefectProbe({
    client: createRunClient(),
    proberModelIds: RUN_MODELS.checkerModelIds,
    sourceText: SOURCE_TEXT,
    baselineText: BASELINE_TEXT,
    regions: [region,],
    issues,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-sensitivity', },),
  },);

  /**
   * Screened tally of the single region.
   */
  const tally = report.regions[0];

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
  /* oxlint-enable no-await-in-loop */

  console.log(
    'NOTE compare each region\'s two lines. A stage that claims damage with '
      + 'prior=absent and goes quiet with prior=shown is one the production '
      + 'prompt silences, and its zeros in a real run would mean nothing.',
  );
}

await main();

//endregion Probe sensitivity
