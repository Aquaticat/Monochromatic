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
  type GatheredProbe,
  reportProbeTelemetry,
} from './probe-telemetry-report.ts';
import {
  type StageRosterCoverage,
  summarizeStageRoster,
} from '../stage-roster.ts';
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
import {
  keepEligible,
  resolvePool,
} from './artifact-pool.ts';

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
): Promise<GatheredProbe> {
  /**
   * Artifact file names, JSON only.
   */
  const names = keepEligible({
    names: (await readdir(artifactsDir,))
      .filter(function isArtifact(name,) {
        return name.endsWith('.json',);
      },)
      .toSorted(),
    eligible: await resolvePool({ artifactsDir, },),
  },);

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
   * Readings grouped by the artifact that carried them.
   *
   * Grouped rather than flattened, because envelope ids are derived from the
   * text they cover and so repeat across documents that share a paragraph.
   * Flattening let the summary collapse two entries' unrelated regions into
   * one.
   */
  const readings = names.map(function toGroup(
    name,
    index,
  ) {
    return {
      entryId: name,
      readings: perEntry[index]
        ?.readings
        ?? [],
    };
  },);

  /**
   * Every reading paired with its owning issue, across every artifact.
   */
  const owned = perEntry.flatMap(function toOwned(entry,) {
    return entry.owned;
  },);

  /**
   * Stage findings, one list per artifact.
   */
  const findingsPerEntry = perEntry.map(function toFindings(entry,) {
    return entry.findings;
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
    refinementReadings: names.map(function toRefinementGroup(
      name,
      index,
    ) {
      return {
        entryId: name,
        readings: perEntry[index]
          ?.refinementReadings
          ?? [],
      };
    },),
    editorRoster: summarizeStageRoster({
      entries: findingsPerEntry,
      stage: 'editor',
    },),
    refineRoster: summarizeStageRoster({
      entries: findingsPerEntry,
      stage: 'refine',
    },),
    entriesWithRewrites: perEntry
      .filter(function rewroteSomething(entry,) {
        return entry.hasRewrites;
      },)
      .length,
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

  // NAMES THE RUN IT READ, first line, always. `resolveRunsDir` falls back to a
  // default when TRANSLATION_REPAIR_RUNS_DIR is unset, so a report can describe
  // a different run than the reader has in mind and every count below will look
  // like an answer about theirs. Pointing this at the wrong directory produced a
  // clean set of zeros that read as "nothing to report" rather than as "wrong
  // run", which is the failure this whole project keeps rediscovering.
  console.log(`SOURCE ${artifactsDir}`,);

  /**
   * Readings across every settled artifact.
   */
  const gathered = await gatherReadings({ artifactsDir, },);

  reportProbeTelemetry({ gathered, },);
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
