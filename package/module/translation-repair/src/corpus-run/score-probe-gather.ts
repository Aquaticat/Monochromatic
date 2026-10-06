import { join, } from 'node:path';

import {
  type ArtifactProbeReading,
  readArtifactProbe,
} from '../artifact-probe-read.ts';
import { textsInCodePointOrder, } from '../code-points.ts';
import { indexReadingsByIssue, } from '../probe-issue-index.ts';
import { readRunJson, } from '../run-json-read.ts';
import { summarizeStageRoster, } from '../stage-roster.ts';
import {
  keepEligible,
  resolvePool,
} from './artifact-pool.ts';
import { listArtifactFiles, } from './artifact-file-name.ts';
import type { GatheredProbe, } from './probe-telemetry-report.ts';

//region Score probe gather
// Reads every settled artifact of a run into the probe readings and coverage
// counts the `score-probe` report prints.

/**
 One artifact's probe reading, kept beside the file name it came from.
 */
type NamedProbeReading = {
  readonly name: string;
  readonly reading: ArtifactProbeReading;
};

/**
 Reads every settled artifact of a run.

 @param artifactsDir - directory the pass writes entries into

 @returns Readings and coverage counts across every artifact

 @throws {@link ArtifactParseError} when a present probe field is malformed,
 because a count nobody can trust is worse than no count

 @example
 ```ts
 const gathered = await gatherProbeReadings({ artifactsDir, },);
 ```
 */
export async function gatherProbeReadings(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<GatheredProbe> {
  /**
   One directory listing, shared with the census.

   Taken once and threaded through, because the accumulation writes into this
   directory continuously: a second listing inside the census would classify a
   different set of files from the one this reader goes on to read.
   */
  const listed = textsInCodePointOrder({ texts: (await listArtifactFiles({ artifactsDir, },)), },);

  /**
   Artifact file names, JSON only.
   */
  const names = keepEligible({
    names: listed,
    eligible: await resolvePool({
      artifactsDir,
      names: listed,
    },),
  },);

  /**
   One reading set per artifact, read concurrently and kept beside the name
   it came from, so no later step pairs the two by position.

   Every parse failure carries the artifact path it came from, so a malformed
   file names itself regardless of read order. Which of several malformed
   files reports first is not fixed, since `Promise.all` rejects with whichever
   rejected soonest rather than the earliest in the sorted list.
   */
  const perEntry = await Promise.all(names.map(async function toReading(name,): Promise<NamedProbeReading> {
    return {
      name,
      reading: readArtifactProbe({
        value: await readRunJson({
          path: join(
            artifactsDir,
            name,
          ),
        },),
        path: name,
      },),
    };
  },),);

  /**
   Every reading paired with its owning issue, across every artifact.
   */
  const owned = perEntry.flatMap(function toOwned({ reading, },) {
    return reading.owned;
  },);

  /**
   Stage findings, one list per artifact.
   */
  const findingsPerEntry = perEntry.map(function toFindings({ reading, },) {
    return reading.findings;
  },);

  return {
    // Grouped rather than flattened, because envelope ids are derived from the
    // text they cover and so repeat across documents that share a paragraph.
    // Flattening let the summary collapse two entries' unrelated regions into
    // one.
    readings: perEntry.map(function toGroup({
      name,
      reading,
    },) {
      return {
        entryId: name,
        readings: reading.readings,
      };
    },),
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
    refinementReadings: perEntry.map(function toRefinementGroup({
      name,
      reading,
    },) {
      return {
        entryId: name,
        readings: reading.refinementReadings,
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
      .filter(function rewroteSomething({ reading, },) {
        return reading.hasRewrites;
      },)
      .length,
    entries: perEntry.length,
    repairShippedRecords: perEntry.reduce(
      function addShipped(
        sum,
        { reading, },
      ) {
        return sum + reading.repairShippedRecords;
      },
      0,
    ),
    repairUnprobedRecords: perEntry.reduce(
      function addUnprobed(
        sum,
        { reading, },
      ) {
        return sum + reading.repairUnprobedRecords;
      },
      0,
    ),
  };
}

//endregion Score probe gather
