import { allInInputOrder, } from '../all-in-input-order.ts';
import { textsInCodePointOrder, } from '../code-points.ts';
import type { readCorpusFile, } from '../corpus-source.ts';
import type { GradingCandidate, } from '../sample-grading.ts';
import type { EligibleEntries, } from './artifact-eligible.ts';
import {
  type ArtifactFileName,
  artifactsDirOf,
} from './artifact-file-name.ts';
import {
  keepEligible,
  resolvePool,
} from './artifact-pool.ts';
import {
  type BandedEntry,
  loadEntry,
} from './draw-entry-load.ts';
import { listSettledNames, } from './sample-artifact-names.ts';

//region Draw sample pool
// Reads every settled artifact of a runs directory into the banded entries a
// draw samples from, and the pool of accepted issues across them.

/**
 What one runs directory holds that a draw may sample.
 */
export type DrawPool = {
  /**
   Entries the pool admitted, with the commit and pipeline each recorded.
   */
  readonly eligible: EligibleEntries;

  /**
   Artifact file names present in the run and admitted.
   */
  readonly names: readonly ArtifactFileName[];

  /**
   Every settled entry banded with its candidates.
   */
  readonly entries: readonly BandedEntry[];

  /**
   The full accepted-issue pool across every entry.
   */
  readonly pool: readonly GradingCandidate[];
};

/**
 Reads the settled artifacts of a runs directory.

 @param runsDir - runs directory a pass wrote into

 @param readSource - reads a corpus file at the pin: `readCorpusFile` in a run

 @returns The admitted entries and their pool

 @throws {@link StatedRefusalError} When the runs directory holds no artifacts
 directory, and whatever the pool and the entry reader refuse with

 @example
 ```ts
 const { entries, pool, } = await readDrawPool({ runsDir, readSource: readCorpusFile, },);
 ```
 */
export async function readDrawPool(
  {
    runsDir,
    readSource,
  }: {
    readonly runsDir: string;
    readonly readSource: typeof readCorpusFile;
  },
): Promise<DrawPool> {
  /**
   Per-entry artifact directory.
   */
  const artifactsDir = artifactsDirOf({ runsDir, },);

  /**
   One directory listing, shared with the census.

   Taken once and threaded through, because the accumulation writes into this
   directory continuously: a second listing inside the census would classify a
   different set of files from the one this draw goes on to read, so an
   artifact arriving between the two would join the census while never
   entering the candidate pool.
   */
  const listed = textsInCodePointOrder({ texts: await listSettledNames({ runsDir, },), },);

  /**
   Entries this draw may pool, with the commit each recorded.
   */
  const eligible = await resolvePool({
    artifactsDir,
    names: listed,
  },);

  /**
   Artifact file names present in the run.
   */
  const names = keepEligible({
    names: listed,
    eligible,
  },);

  /**
   Every settled entry banded with its candidates.
   */
  const entries = await allInInputOrder({
    members: names.map(function load(name,) {
      return loadEntry({
        artifactsDir,
        name,
        eligible,
        readSource,
      },);
    },),
  },);

  return {
    eligible,
    names,
    entries,
    pool: entries.flatMap(function candidates(entry,) {
      return entry.candidates;
    },),
  };
}

//endregion Draw sample pool
