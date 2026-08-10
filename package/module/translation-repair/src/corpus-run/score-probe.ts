import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { readArtifactProbe, } from '../artifact-probe-read.ts';
import {
  type ProbeAgreementItem,
  scoreProbeAgainstGrades,
} from '../probe-agreement.ts';
import { indexReadingsByIssue, } from '../probe-issue-index.ts';
import {
  type RefineCoverage,
  summarizeRefineCoverage,
} from '../refine-coverage.ts';
import { summarizeProbeTelemetry, } from '../probe-telemetry.ts';
import {
  parseGradedRepairSheet,
  readSheetIdentity,
} from '../repair-grade-read.ts';
import type { TelemetryProbeReading, } from '../probe-attribution.ts';
import { parseSampleManifest, } from '../sample-manifest.ts';
import {
  assertSheetMatchesManifest,
  HEADER_ONLY_BINDING_NOTE,
} from '../sheet-binding.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Score probe
// Reports what the shadow-mode introduced-defect probe found across a run's
// settled artifacts, so the gate question can be answered with a measurement.
//
// Prints COUNTS ONLY. Artifacts quote UNLICENSED corpus text, and this output
// is meant to be pasteable into a verdict or a message, so nothing it emits
// carries a quote, a claim, or an envelope id.
//
// This number is NOT a precision on its own. It says how often the probe would
// have blocked a repair; whether it was RIGHT to needs the human repair grades
// beside it, which is the comparison this exists to enable.


/**
 * Reads every settled artifact of a run.
 *
 * @param artifactsDir - directory the pass writes entries into
 *
 * @returns Readings and coverage counts across every artifact
 *
 * @throws {@link ArtifactParseError} when a present probe field is malformed,
 * because a count nobody can trust is worse than no count
 *
 * @example
 * ```ts
 * const gathered = await gatherReadings({ artifactsDir, },);
 * ```
 */
async function gatherReadings(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<{
  readonly readings: readonly TelemetryProbeReading[];
  readonly byIssueId: ReadonlyMap<string, TelemetryProbeReading>;
  readonly refinedIssueIds: ReadonlySet<string>;
  readonly refinementReadings: readonly TelemetryProbeReading[];
  readonly coverage: RefineCoverage;
  readonly entries: number;
  readonly shippedRecords: number;
  readonly unprobedRecords: number;
}> {
  /**
   * Artifact file names, JSON only.
   */
  const names = (await readdir(artifactsDir,))
    .filter(function isArtifact(name,) {
      return name.endsWith('.json',);
    },)
    .toSorted();

  /**
   * One reading set per artifact, read concurrently.
   *
   * Every parse failure carries the artifact path it came from, so a malformed
   * file names itself regardless of read order. Which of several malformed
   * files reports first is not fixed, since `Promise.all` rejects with whichever
   * rejected soonest rather than the earliest in the sorted list.
   */
  const perEntry = await Promise.all(names.map(async function toReading(name,) {
    return readArtifactProbe({
      value: JSON.parse(
        await readFile(
          join(
            artifactsDir,
            name,
          ),
          'utf8',
        ),
      ),
      path: name,
    },);
  },),);

  /**
   * Every reading across every artifact.
   */
  const readings = perEntry.flatMap(function toReadings(entry,) {
    return entry.readings;
  },);

  /**
   * Every reading paired with its owning issue, across every artifact.
   */
  const owned = perEntry.flatMap(function toOwned(entry,) {
    return entry.owned;
  },);

  return {
    readings,
    byIssueId: indexReadingsByIssue({ owned, },),
    // Issues whose slice the naturalness lane rewrote after the probe ran, so
    // the probe's verdict is about wording that did not ship.
    refinedIssueIds: new Set(owned
      .filter(function wasRefined(entry,) {
        return entry.refined;
      },)
      .map(function toIssueId(entry,) {
        return entry.issueId;
      },),),
    refinementReadings: perEntry.flatMap(function toRefinement(entry,) {
      return entry.refinementReadings;
    },),
    coverage: summarizeRefineCoverage({
      entries: perEntry.map(function toCoverageEntry(entry,) {
        return {
          findings: entry.findings,
          hasRewrites: entry.hasRewrites,
        };
      },),
    },),
    entries: perEntry.length,
    shippedRecords: perEntry.reduce(
      function addShipped(
      sum,
      entry,
    ) {
      return sum + entry.shippedRecords;
    },
      0,
    ),
    unprobedRecords: perEntry.reduce(
      function addUnprobed(
      sum,
      entry,
    ) {
      return sum + entry.unprobedRecords;
    },
      0,
    ),
  };
}

/**
 * Reads one command-line option's value.
 *
 * @param flag - long-form flag, including leading dashes
 *
 * @returns Value following the flag; empty when absent, which is also how a
 * flag left blank is treated, since neither names a file
 *
 * @example
 * ```ts
 * const sheet = optionValue({ flag: '--repair-sheet', },);
 * ```
 */
function optionValue({ flag, }: { readonly flag: string; },): string {
  /**
   * Where the flag sits among the arguments.
   */
  const at = process.argv
    .indexOf(flag,);
  if (at === (-1))
    return '';
  return process.argv[at + 1] ?? '';
}

/**
 * Reads a run's artifacts and prints the probe summary.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Directory this run wrote artifacts into.
   */
  const artifactsDir = join(
    await resolveRunsDir(),
    'artifacts',
  );

  /**
   * Readings across every settled artifact.
   */
  const gathered = await gatherReadings({ artifactsDir, },);

  /**
   * Summary over distinct shipped regions.
   */
  const summary = summarizeProbeTelemetry({ readings: gathered.readings, },);

  console.log(
    `PROBE entries=${String(gathered.entries,)} shippedRecords=${
      String(gathered.shippedRecords,)
    } unprobedRecords=${String(gathered.unprobedRecords,)} regions=${
      String(summary.regions,)
    } majorityIntroduced=${String(summary.majorityIntroduced,)} minorityIntroduced=${
      String(summary.minorityIntroduced,)
    } noneIntroduced=${String(summary.noneIntroduced,)}`,
  );
  console.log(
    `CLAIMS added=${String(summary.corroborated,)} dropped=${
      String(summary.removalCorroborated,)
    } contradicted=${String(summary.contradicted,)} unanchored=${
      String(summary.unanchored,)
    } degradedRosterRegions=${String(summary.degradedRosterRegions,)}`,
  );

  /**
   * Summary over the naturalness lane's own rewrites.
   *
   * Reported on its own line rather than folded into the accuracy figures,
   * because the two audit different edits against different baselines. Its
   * region count is rewritten SLICES, not replaced envelopes, so the two are
   * not comparable as rates either.
   */
  const refinement = summarizeProbeTelemetry({
    readings: gathered.refinementReadings,
  },);
  console.log(
    `REFINEMENT rewrittenSlices=${String(refinement.regions,)} majorityIntroduced=${
      String(refinement.majorityIntroduced,)
    } minorityIntroduced=${String(refinement.minorityIntroduced,)} noneIntroduced=${
      String(refinement.noneIntroduced,)
    } added=${String(refinement.corroborated,)} dropped=${
      String(refinement.removalCorroborated,)
    } contradicted=${String(refinement.contradicted,)} unanchored=${
      String(refinement.unanchored,)
    }`,
  );
  console.log(
    `LANE slicesOffered=${String(gathered.coverage.slicesOffered,)} slicesSilent=${
      String(gathered.coverage.slicesSilent,)
    } entriesWithRewrites=${
      String(gathered.coverage.entriesWithRewrites,)
    }/${String(gathered.entries,)}`,
  );
  if (gathered.coverage.slicesSilent > 0)
    console.log(
      `NOTE slicesSilent counts slices where NO refiner answered, so the lane `
        + `could not run there. One model refines, and a roster of one has no `
        + `quorum to lose, so its failure shows up nowhere else: the audit `
        + `below simply does not grow, which is also what a run with nothing `
        + `worth rewriting looks like.`,
    );
  if (refinement.regions === 0)
    console.log(
      'NOTE rewrittenSlices=0 means no artifact here carries a refinement '
        + 'audit. That is what artifacts written before the lane was audited '
        + 'look like, and it is NOT evidence the lane rewrote nothing: read '
        + 'the LANE line to tell the two apart.',
    );
  /**
   * Graded repair sheet and its draw manifest, when both were passed.
   */
  const joinPaths = {
    sheet: optionValue({ flag: '--repair-sheet', },),
    manifest: optionValue({ flag: '--manifest', },),
  };
  if ((joinPaths.sheet === '') || (joinPaths.manifest === '')) {
    console.log(
      'NOTE majorityIntroduced counts regions a gate WOULD have blocked, not '
        + 'regions that were damaged. Pass --repair-sheet PATH --manifest PATH '
        + 'to score it against the human grades.',
    );
    return;
  }

  /**
   * Draw manifest, the only record of which issue sat at which position.
   */
  const manifest = parseSampleManifest({
    value: JSON.parse(
      await readFile(
        joinPaths.manifest,
        'utf8',
      ),
    ),
  },);

  /**
   * Sheet contents, read once and used for both identity and verdicts.
   */
  const sheetText = await readFile(
    joinPaths.sheet,
    'utf8',
  );

  /**
   * How firmly the sheet is tied to this manifest; refuses if it is not.
   */
  const binding = assertSheetMatchesManifest({
    identity: readSheetIdentity({ text: sheetText, },),
    manifest,
    sheetLabel: 'repair sheet',
  },);
  if (binding === 'header-only')
    console.log(HEADER_ONLY_BINDING_NOTE,);

  /**
   * Human verdicts in sheet order.
   */
  const graded = parseGradedRepairSheet({ text: sheetText, },);
  if (graded.length
    !== manifest.items
    .length) {
    throw new Error(
      `sheet and manifest disagree about the draw: sheet has ${
        String(graded.length,)
      } items, manifest has ${String(manifest.items
        .length,)}. Joining them by position would mislabel every verdict after `
        + `the first divergence.`,
    );
  }

  /**
   * Graded issues paired with the probe reading of the same issue.
   */
  const items: readonly ProbeAgreementItem[] = manifest.items
    .map(function toItem(
      entry,
      index,
    ): ProbeAgreementItem {
    /**
     * Probe reading covering this issue, absent when unprobed.
     */
    const reading = gathered.byIssueId
      .get(entry.issueId,);
    return {
      verdict: graded[index]
        ?.verdict
        ?? 'unscored',
      ...(reading === undefined ? {} : { reading, }),
    };
  },);

  /**
   * Joint counts across both instruments.
   */
  const agreement = scoreProbeAgainstGrades({ items, },);

  /**
   * Joined positions whose slice the naturalness lane rewrote after probing.
   *
   * Reported rather than silently folded in. The probe runs inside the accuracy
   * stage and the lane runs after it, so on these positions the probe judged
   * one text while the repair sheet asked the human to grade another. Every
   * cell of the agreement table treats the two as being about the same wording,
   * which is true everywhere except here.
   */
  const refinedJoined = manifest.items
    .filter(function wasRefined(entry,) {
      return gathered.refinedIssueIds
        .has(entry.issueId,);
    },)
    .length;

  console.log(
    `AGREEMENT joined=${String(agreement.joined,)} probeFlagged=${
      String(agreement.probeFlagged,)
    } refutedByHuman=${String(agreement.refutedByHuman,)} sharedWithHuman=${
      String(agreement.sharedWithHuman,)
    } flaggedUnscored=${String(agreement.flaggedUnscored,)} unflaggedFailures=${
      String(agreement.unflaggedFailures,)
    } refinedJoined=${String(refinedJoined,)}`,
  );
  if (refinedJoined > 0)
    console.log(
      `NOTE refinedJoined counts positions where the naturalness lane rewrote `
        + `the slice AFTER the probe ran. There the probe judged the accuracy `
        + `stage's wording while the repair sheet asked the human to grade the `
        + `RETURNED wording, so those rows compare two different texts and `
        + `belong in neither column as evidence about the probe. Read the other `
        + `counts over the remaining ${String(agreement.joined - refinedJoined,)}.`,
    );
  console.log(
    'NOTE refutedByHuman is the clean number: the human read the same wording '
      + 'and said it breaks nothing nearby, so each one is a correct repair a '
      + 'gate would have discarded. sharedWithHuman is NOT confirmation, since '
      + 'the sheet\'s N fires both for a repair that did not fix its target and '
      + 'for one that broke something.',
  );
}

// Guarded like every sibling task script. Unguarded, this ran on IMPORT, so
// anything that pulled this module into the package bundle made importing the
// library scan a corpus directory and print to stdout.
if (import.meta.main)
  await main();

//endregion Score probe
