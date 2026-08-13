import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { AdjudicatedIssue, } from '../adjudicate-model.ts';
import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import type { RepairRegion, } from '../repair-region.ts';
import {
  gatherRelabelCases,
  type RelabelCase,
} from './probe-relabel-case.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Probe relabel
// Asks the introduced-defect probe about regions a HUMAN read as damaged, twice
// each: once with the accepted issues the run showed it, once with none.
//
// The cat fixtures established that the probe reports damage 3/3 on a deleted
// clause the source supports, loses one voice of three when a false accepted
// issue names that clause, and stays correctly silent when the deletion really
// is licensed. So the instrument works and the labelling effect is modest,
// which leaves the corpus result unexplained: 2438 of 2571 prober verdicts
// found nothing, including on every one of these regions.
//
// Two readings remain, and one paired run separates them. If withholding the
// issue list lights these regions up, the list is doing far more damage on real
// text than on a fixture, and the probe prompt is the thing to change. If both
// arms stay dark, the label is exonerated and production damage is simply
// harder to see than any fixture yet built, which makes the deterministic
// preservation check the only credible safety gate.
//
// Reads corpus text through git at the pinned commit and writes nothing.

/**
 * Runs one probe call over one region and returns a printable tally.
 *
 * @param region - region under test
 *
 * @param issues - accepted issues to render as pre-existing, empty to withhold
 *
 * @param sourceText - slice original
 *
 * @param baselineText - slice translation before replacement
 *
 * @returns One line of counts
 *
 * @example
 * ```ts
 * const line = await probeOnce({ region, issues: [], sourceText, baselineText, },);
 * ```
 */
async function probeOnce(
  {
    region,
    issues,
    sourceText,
    baselineText,
  }: {
    readonly region: RepairRegion;
    readonly issues: readonly AdjudicatedIssue[];
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
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-relabel', },),
  },);

  /**
   * Screened tally of the single region.
   */
  const [tally,] = report.regions;

  return `heard=${String(report.heardProbers,)}/${
    String(report.configuredProbers,)
  } corroborated=${String(tally?.corroborated ?? 0,)} removal=${
    String(tally?.removalCorroborated ?? 0,)
  } contradicted=${String(tally?.contradicted ?? 0,)} unanchored=${
    String(tally?.unanchored ?? 0,)
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
   * Production condition: the issue list is shown.
   */
  const shown = await probeOnce({
    region: relabelCase.region,
    issues: relabelCase.issues,
    sourceText: relabelCase.sourceText,
    baselineText: relabelCase.baselineText,
  },);
  console.log(`  issues-shown  ${shown}`,);

  /**
   * Counterfactual: the same region with nothing labelled pre-existing.
   */
  const withheld = await probeOnce({
    region: relabelCase.region,
    issues: [],
    sourceText: relabelCase.sourceText,
    baselineText: relabelCase.baselineText,
  },);
  console.log(`  issues-withheld ${withheld}`,);
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

  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const relabelCase of cases)
    await probePair({ relabelCase, },);
  /* oxlint-enable no-await-in-loop */

  console.log(
    'NOTE compare issues-shown against issues-withheld on each region. A '
      + 'region that reports damage only when the issue list is withheld is one '
      + 'the production prompt talks the probe out of. A region dark under both '
      + 'exonerates the label and indicts the difficulty of the judgement.',
  );
}

await main();

//endregion Probe relabel
