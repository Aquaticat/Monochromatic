import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { readArtifactProbe, } from '../artifact-probe-read.ts';
import type { IssueProbeReading, } from '../repair-record.ts';
import { summarizeProbeTelemetry, } from '../probe-telemetry.ts';
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
  readonly readings: readonly IssueProbeReading[];
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
   * One reading set per artifact, read sequentially so a malformed file names
   * itself before any later one is opened.
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

  return {
    readings: perEntry.flatMap(function toReadings(entry,) {
      return entry.readings;
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
  console.log(
    'NOTE majorityIntroduced counts regions a gate WOULD have blocked, not '
      + 'regions that were damaged; pair it with the graded repair sheet before '
      + 'reading it as precision.',
  );
}

await main();

//endregion Score probe
