import { tagged, } from '@monochromatic-dev/module-logger/ts';

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
  }: {
    readonly region: RepairRegion;
    readonly expectation: string;
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
    issues: [],
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-sensitivity', },),
  },);

  /**
   * Screened tally of the single region.
   */
  const tally = report.regions[0];

  console.log(
    `SENSITIVITY ${region.envelopeId} expected=${expectation} heard=${
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
  // Sequential rather than concurrent: three regions is nothing next to a
  // running corpus pass, and serializing keeps this from competing with it for
  // the per-model stream slots.
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
  ])
    await probeOne(probe,);
  /* oxlint-enable no-await-in-loop */

  console.log(
    'NOTE a probe that reports no claims on the two damaged regions is deaf '
      + 'rather than conservative, and a round of zeros from it would mean '
      + 'nothing. Claims on the clean region mean the opposite problem.',
  );
}

await main();

//endregion Probe sensitivity
