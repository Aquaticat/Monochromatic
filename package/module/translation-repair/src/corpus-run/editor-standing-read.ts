import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { errorName, } from '../error-name.ts';
import { producerStandings, } from '../producer-standing.ts';
import {
  rankStandings,
  standingLine,
} from '../producer-standing-report.ts';
import {
  EDITOR_ROUND_STAGES,
  REFINER_ROUND_STAGES,
  selectionRoundsFor,
} from '../repair-selection-rounds.ts';
import type { SelectionRound, } from '../self-preference.ts';
import { OffRosterModelError, } from './artifact-producer-read.ts';
import {
  type DigestGroup,
  groupByDigest,
} from './digest-group.ts';
import { readRepairRounds, } from './artifact-rounds-read.ts';
import { parseSettledArtifactV2, } from './artifact-v2-read.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Editor standing read
// THE EDITOR STANDING THAT COSTS NOTHING, read off work already paid for.
//
// `editor-calibrate.ts` buys a controlled measurement: every model in every
// seat on every slice. This reads the record instead. Every settled artifact's
// repair chunks carry `rounds`, each with the slate judges were shown, each
// candidate's producer, and every ballot cast, which is exactly what
// `producerStandings` counts. That telemetry was being written and never read.
//
// IT IS OBSERVATIONAL, AND THAT BOUNDS WHAT IT CAN SAY. Only models that held
// a seat ever wrote a candidate, so it ranks whoever was seated against each
// other and is silent about everyone else. A model that never held the seat is
// not last here; it is absent. That survivorship is the exact thing the
// controlled calibration exists to defeat, so this corroborates it and cannot
// replace it.
//
// NEVER POOLED ACROSS PIPELINE DIGESTS. `artifact-pool.ts` refuses to pool
// results whose built output differs, and a standing is a result. Each digest
// is reported alone, with its entry count beside its round count: rounds inside
// one entry are correlated, so entries are the denominator that matters.
//
// PRINTS IDS, DIGESTS AND COUNTS. Never a passage, and never a parse-refusal
// message, which quotes the text it disagrees about.

/**
 * Exit code left behind when no artifact carried a round at all.
 */
const NOTHING_RECORDED = 1;

/**
 * Directory under a run directory holding one settled artifact per entry.
 */
const ARTIFACTS_DIR = 'artifacts';

/**
 * Suffix every settled artifact file carries.
 */
const ARTIFACT_SUFFIX = '.json';

/**
 * One artifact's rounds, kept grouped by the chunk that produced them.
 */
type ArtifactReading = {
  /**
   * Built output that produced it, which is what may be pooled.
   */
  readonly digest: string;

  /**
   * Corpus entry, so entries can be counted rather than inferred.
   */
  readonly entryId: string;

  /**
   * Editor rounds, one list per chunk, empty where a chunk had nothing to edit.
   */
  readonly editor: readonly (readonly SelectionRound[])[];

  /**
   * Refiner rounds, grouped the same way.
   */
  readonly refiner: readonly (readonly SelectionRound[])[];
};

/**
 * What listing one directory produced.
 *
 * A REFUSAL IS NAMED BY CLASS, NEVER QUOTED. A filesystem error carries the
 * path it failed on, and a run directory path can name a person.
 *
 * @example
 * ```ts
 * const reading: DirectoryReading = { kind: 'read', names: [], };
 * ```
 */
type DirectoryReading =
  | {
    readonly kind: 'read';

    /**
     * Everything the directory holds, in whatever order it gave them.
     */
    readonly names: readonly string[];
  }
  | {
    readonly kind: 'unreadable';

    /**
     * Class that refused the listing.
     */
    readonly refusedBy: string;
  };

/**
 * Lists one directory, reporting an absent one rather than raising.
 *
 * @param dir - directory to list
 *
 * @returns Its names, or the refusal
 *
 * @example
 * ```ts
 * const reading = await namesIn({ dir, },);
 * ```
 */
async function namesIn(
  { dir, }: { readonly dir: string; },
): Promise<DirectoryReading> {
  try {
    return {
      kind: 'read',
      names: await readdir(dir,),
    };
  } catch (error) {
    return {
      kind: 'unreadable',
      refusedBy: errorName({ error, },),
    };
  }
}

/**
 * Turns one directory's names into the artifact paths among them.
 *
 * @param dir - directory the names came from
 *
 * @param names - everything the directory holds
 *
 * @returns Full paths of the artifact files
 *
 * @example
 * ```ts
 * const paths = artifactsAmong({ dir, names, },);
 * ```
 */
function artifactsAmong(
  {
    dir,
    names,
  }: {
    readonly dir: string;
    readonly names: readonly string[];
  },
): readonly string[] {
  return names
    .filter(function isArtifact(name,): boolean {
      return name.endsWith(ARTIFACT_SUFFIX,);
    },)
    .map(function toPath(name,): string {
      return join(
        dir,
        name,
      );
    },);
}

/**
 * Lists artifact file paths under one named directory.
 *
 * TAKES A RUN DIRECTORY OR AN ARTIFACTS DIRECTORY, because both get typed. A
 * run directory holds `artifacts/`; naming that directory itself should work
 * rather than report an empty archive.
 *
 * @param path - run directory, or its artifacts directory
 *
 * @returns Full paths of every artifact file found, empty where none is
 *
 * @example
 * ```ts
 * const paths = await artifactPaths({ path, },);
 * ```
 */
async function artifactPaths(
  { path, }: { readonly path: string; },
): Promise<readonly string[]> {
  /**
   * Nested layout, which is what a pass writes.
   */
  const nested = join(
    path,
    ARTIFACTS_DIR,
  );

  /**
   * What that subdirectory held, if it is there at all.
   */
  const under = await namesIn({ dir: nested, },);

  if (under.kind === 'read')
    return artifactsAmong({
      dir: nested,
      names: under.names,
    },);

  /**
   * Flat layout, reached only when the nested one is absent.
   */
  const flat = await namesIn({ dir: path, },);

  if (flat.kind === 'read')
    return artifactsAmong({
      dir: path,
      names: flat.names,
    },);

  console.error(
    `editor-standing-read: no artifacts under ${path} (${under.refusedBy} on `
      + `${ARTIFACTS_DIR}/, ${flat.refusedBy} on the directory itself)`,
  );
  return [];
}

/**
 * What one artifact turned out to be.
 *
 * OFF-ROSTER IS ITS OWN ANSWER, not a refusal. An artifact settled before a
 * seating change names models the roster no longer holds, which says the
 * record predates the current roster and nothing bad about the record. Folding
 * it in with malformed artifacts would report a healthy archive as a broken
 * one.
 */
type ArtifactOutcome = ArtifactReading | 'off-roster' | 'refused';

/**
 * Reads one artifact into the rounds each of its seats produced.
 *
 * @param path - artifact file to read
 *
 * @returns Its rounds, that it predates the roster, or that it would not parse
 *
 * @example
 * ```ts
 * const outcome = await readOne({ path, },);
 * ```
 */
async function readOne(
  { path, }: { readonly path: string; },
): Promise<ArtifactOutcome> {
  try {
    /**
     * Whole artifact, parsed rather than trusted.
     */
    const artifact = parseSettledArtifactV2({
      value: JSON.parse(await readFile(
        path,
        'utf8',
      ),) as unknown,
    },);

    /**
     * Rounds every chunk recorded, checked here because version 2 hands the
     * lane result back unread.
     */
    const perChunk = readRepairRounds({
      raw: artifact
        .lanes
        .repair
        .raw,
      path: `${artifact.id}.lanes.repair.result`,
    },);

    return {
      digest: artifact.pipelineDigest,
      entryId: artifact.id,
      editor: perChunk.map(function editorRounds(rounds,): readonly SelectionRound[] {
        return selectionRoundsFor({
          rounds,
          stages: EDITOR_ROUND_STAGES,
        },);
      },),
      refiner: perChunk.map(function refinerRounds(rounds,): readonly SelectionRound[] {
        return selectionRoundsFor({
          rounds,
          stages: REFINER_ROUND_STAGES,
        },);
      },),
    };
  } catch (error) {
    // BOTH MESSAGES ARE SAFE TO PRINT. `ArtifactParseError` names a path and
    // the shape it wanted; `OffRosterModelError` names a path and a model id.
    // Neither quotes the value it disagrees about, so no passage can reach the
    // report through them.
    if (error instanceof OffRosterModelError) {
      console.error(`editor-standing-read: ${error.message}`,);
      return 'off-roster';
    }

    console.error(
      `editor-standing-read: ${path} refused, ${errorName({ error, },)}: `
        + `${error instanceof Error ? error.message : 'no message'}`,
    );
    return 'refused';
  }
}

/**
 * Prints one seat's standing within one digest.
 *
 * @param seat - seat the standing is about
 *
 * @param perChunk - that seat's rounds, grouped by the chunk that bought them
 *
 * @example
 * ```ts
 * reportSeat({ seat: 'EDITOR', perChunk, },);
 * ```
 */
function reportSeat(
  {
    seat,
    perChunk,
  }: {
    readonly seat: string;
    readonly perChunk: readonly (readonly SelectionRound[])[];
  },
): void {
  /**
   * Every round this seat produced under this digest.
   */
  const rounds = perChunk.flat();

  /**
   * Chunks that produced any round, which the round count alone hides: a
   * chunk carrying no accepted issue never asks an editor to write.
   */
  const paid = perChunk.filter(function contributed(chunk,): boolean {
    return chunk.length > 0;
  },);

  console.log(
    `  ${seat}: ${String(rounds.length,)} judged rounds from ${String(paid.length,)} `
      + `of ${String(perChunk.length,)} chunks`,
  );

  if (rounds.length === 0)
    return;

  for (const standing of rankStandings({ standings: producerStandings({ rounds, },), },)) {
    console.log(`      ${standingLine({ standing, },)}`,);
  }
}

/**
 * Prints both seats for one digest, with the denominator that governs them.
 *
 * @param group - readings sharing one built output
 *
 * @example
 * ```ts
 * reportGroup({ group, },);
 * ```
 */
function reportGroup(
  { group, }: { readonly group: DigestGroup<ArtifactReading>; },
): void {
  console.log(
    `\n${group.digest} over ${String(group.readings.length,)} entries`,
  );

  for (
    const seat of [
      {
        name: 'EDITOR ',
        perChunk: group.readings.flatMap(function editorOf(reading,) {
          return reading.editor;
        },),
      },
      {
        name: 'REFINER',
        perChunk: group.readings.flatMap(function refinerOf(reading,) {
          return reading.refiner;
        },),
      },
    ]
  ) {
    reportSeat({
      seat: seat.name,
      perChunk: seat.perChunk,
    },);
  }
}

/**
 * Reads every named archive and reports both seats, per digest.
 *
 * Returns nothing: the report on stdout and the exit code ARE the output.
 *
 * @example
 * ```ts
 * await reportStandings();
 * ```
 */
async function reportStandings(): Promise<void> {
  /**
   * Directories to read, named on the command line or defaulted to this run.
   */
  const roots = process
    .argv
    .slice(2,);

  /**
   * Every artifact path under every named directory.
   */
  const paths = (await Promise.all(
    (roots.length === 0
      ? [await resolveRunsDir(),]
      : roots).map(async function one(path,): Promise<readonly string[]> {
      return artifactPaths({ path, },);
    },),
  )).flat();

  /**
   * What every artifact turned out to be, read or not.
   */
  const outcomes = await Promise.all(paths.map(async function one(path,): Promise<ArtifactOutcome> {
    return readOne({ path, },);
  },),);

  /**
   * Every artifact that parsed under the current roster.
   */
  const readings = outcomes.filter(function parsed(outcome,): outcome is ArtifactReading {
    return (outcome !== 'refused') && (outcome !== 'off-roster');
  },);

  /**
   * Artifacts settled under an earlier seating, counted apart from defects.
   */
  const offRoster = outcomes.filter(function earlier(outcome,): boolean {
    return outcome === 'off-roster';
  },).length;

  /**
   * Groups carrying at least one judged round, since a group with none says
   * nothing and would otherwise fill the report.
   */
  const groups = groupByDigest({ readings, },)
    .filter(function judged(group,): boolean {
      return group
        .readings
        .some(function any(reading,): boolean {
          return (reading.editor.flat().length + reading.refiner.flat().length) > 0;
        },);
    },);

  console.log(
    `editor-standing-read: archives=${String(roots.length,)} artifacts=${String(paths.length,)} `
      + `read=${String(readings.length,)} earlierRoster=${String(offRoster,)} `
      + `digestsWithRounds=${String(groups.length,)}`,
  );
  console.log(
    '  OBSERVATIONAL. Only models that held a seat ever wrote a candidate, so an absent model '
      + 'is unmeasured rather than last. Rounds inside one entry are correlated, so read the '
      + 'entry count, not the round count. Digests are never pooled.',
  );

  if (groups.length === 0) {
    console.log(
      (offRoster > 0)
        ? `  NO ROUNDS UNDER THE CURRENT ROSTER. ${String(offRoster,)} of these artifacts name a `
          + 'model the roster no longer seats, so they were settled under an earlier one and are '
          + 'not evidence about the models seated now. This is an absent measurement, not a poor one.'
        : '  NO ROUNDS. Nothing read here recorded a judged round. Artifacts settled before the '
          + 'rounds were stored carry none, and an entry whose every chunk was left unchanged '
          + 'carries none either.',
    );
    process.exitCode = NOTHING_RECORDED;
    return;
  }

  for (const group of groups) {
    reportGroup({ group, },);
  }
}

await reportStandings();

//endregion Editor standing read
