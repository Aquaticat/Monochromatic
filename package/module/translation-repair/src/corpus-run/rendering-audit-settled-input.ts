import {
  readdir,
  readFile,
} from 'node:fs/promises';
import {
  basename,
  join,
} from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import {
  type CorpusPin,
  readCorpusFile,
} from '../corpus-source.ts';
import {
  prepareDocumentPair,
  type PreparedDocumentPair,
} from '../document-preparation.ts';
import { refusalText, } from '../refusal-text.ts';
import { readRunJson, } from '../run-json-read.ts';
import { verifyArtifactAgainstPreparation, } from './artifact-two-lane-corpus-verify.ts';
import { parseSettledTwoLaneArtifact, } from './artifact-two-lane-read.ts';
import type { ParsedTwoLaneArtifact, } from './artifact-two-lane-read-contract.ts';
import {
  identityOf,
  type SettledAuditSubject,
  type SettledIdentity,
  subjectsOf,
} from './rendering-audit-settled-subject.ts';

//region Settled audit input
// Turns an archive of settled version 2 artifacts into audit subjects, without
// asking a single model anything.
//
// WHY THIS IS ITS OWN MODULE. Everything here is free, and everything in the
// driver costs quota. Splitting them means the whole population, the
// retained-versus-replaced split and the provenance check can be read, tested
// and re-read at no cost, and a mistake in them is found before any roster is
// woken up.
//
// WHERE THE TEXT COMES FROM, which is the decision that shaped this module. The
// artifact carries `sourceText` on every delivery row and `acceptedText` on
// every decided outcome, so the audit reads the two texts STRAIGHT OUT OF THE
// ARTIFACT and never re-slices to obtain them. That is not a shortcut:
// auditing re-sliced text would audit a different input than the one the judges
// actually saw, and the question is what the audit says about the decisions
// that were really made.
//
// SO WHY RE-PREPARE AT ALL. Two things live only in the preparation:
//
// -   `identityContext`, the declared names and handles from both sides' front
//     matter. The producing judges had it, and both archived entries carry a
//     real one: `玖月折耳猫` is declared as `Zheermao September`, `柠檬酸` as
//     `Citric Acid`. An auditor shown the rendering WITHOUT that block sees a
//     name it cannot derive from the source and has every reason to call it a
//     fabrication. That is the defect `#36` was opened for, and rediscovering
//     it as "defects" would poison every name-bearing slice.
// -   Provenance. `verifyArtifactAgainstPreparation` is the only check that
//     the recorded preparation identity describes these two documents, since
//     the artifact stores measurements of the pair rather than the pair.
//
// A REFUSAL IS A FINDING, NOT A STOP. Verification answering no would say the
// slicing moved under a settled artifact, which is worth recording loudly; it
// does not make that artifact's rows unreadable, because they are what the run
// actually judged. So it is carried as a value.
//
// THE PIN COMES FROM THE ARTIFACT, never from `RUN_CORPUS_PIN`. The run pin can
// move; a file naming its own corpus commit answers for itself forever. The
// read goes through the commit object rather than the working tree, so a dirty
// clone cannot change the answer either.

/**
 * Whether the recorded preparation identity still describes the pair.
 *
 * @example
 * ```ts
 * const verification: SettledVerification = { kind: 'verified', };
 * ```
 */
export type SettledVerification = {
  /**
   * Preparation recomputed from the corpus matched what the artifact recorded.
   */
  readonly kind: 'verified';
} | {
  /**
   * It did not, which says the slicing moved under a settled artifact.
   */
  readonly kind: 'refused';

  /**
   * What the check objected to, kept as text since nothing reads it by field.
   */
  readonly detail: string;
};

/**
 * One artifact, read.
 *
 * @example
 * ```ts
 * const reading: SettledArtifactReading = { runSet, entryId, verification, subjects, };
 * ```
 */
export type SettledArtifactReading = {
  /**
   * Archive subdirectory it was found in.
   */
  readonly runSet: string;

  /**
   * File name within that subdirectory.
   */
  readonly artifactFile: string;

  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Built output that produced it.
   */
  readonly artifactDigest: string;

  /**
   * Provenance answer, carried rather than thrown.
   */
  readonly verification: SettledVerification;

  /**
   * Every slice this artifact offers the audit.
   */
  readonly subjects: readonly SettledAuditSubject[];
};

/**
 * Where one artifact sits inside the archive.
 *
 * @example
 * ```ts
 * const at: ArtifactLocation = { runSet: 'two-lane-cost-2026-08-16', artifactFile: 'Aniloviraw.json', };
 * ```
 */
type ArtifactLocation = {
  /**
   * Subdirectory to look in, EMPTY when the artifact sits at the archive root.
   *
   * SEPARATE FROM `runSet`, which it used to be the same field as, and the two
   * came apart the moment a flat layout was accepted: the path segment must be
   * empty for an artifact at the root, while the label must still name
   * something a reader can trace. One field cannot be both, and a test caught
   * it doing neither.
   */
  readonly runSetDir: string;

  /**
   * What every row calls this settlement.
   *
   * For a nested archive this is the subdirectory. For a flat one it is the
   * archive's own name, because the directory IS the settlement there.
   */
  readonly runSet: string;

  /**
   * File name within it.
   */
  readonly artifactFile: string;
};

/**
 * Runs the provenance check and turns its refusal into a value.
 *
 * @param artifact - parsed artifact
 *
 * @param prepared - preparation recomputed from the corpus
 *
 * @returns Answer, never a throw
 *
 * @example
 * ```ts
 * const verification = verifySettled({ artifact, prepared, },);
 * ```
 */
function verifySettled(
  {
    artifact,
    prepared,
  }: {
    readonly artifact: ParsedTwoLaneArtifact;
    readonly prepared: PreparedDocumentPair;
  },
): SettledVerification {
  try {
    verifyArtifactAgainstPreparation({
      artifact,
      prepared,
    },);
    return { kind: 'verified', };
  }
  catch (error) {
    return {
      kind: 'refused',
      detail: refusalText({ error, },),
    };
  }
}

/**
 * Reads one settled artifact into audit subjects.
 *
 * @param archiveDir - directory holding run-set subdirectories
 *
 * @param runSet - subdirectory this artifact lives in
 *
 * @param artifactFile - file name within it
 *
 * @param cloneDir - corpus clone the artifact's own commit is read from
 *
 * @returns Everything that artifact offers, provenance included
 *
 * @throws {@link ArtifactParseError} when the file is not a settled version 2
 * artifact, which is a defect in what was archived rather than a finding
 *
 * @example
 * ```ts
 * const reading = await readArtifactSubjects({ archiveDir, runSet, artifactFile, cloneDir, },);
 * ```
 */
export async function readArtifactSubjects(
  {
    archiveDir,
    runSetDir,
    runSet,
    artifactFile,
    cloneDir,
  }: {
    readonly archiveDir: string;
    readonly runSetDir: string;
    readonly runSet: string;
    readonly artifactFile: string;
    readonly cloneDir: string;
  },
): Promise<SettledArtifactReading> {
  /**
   * Artifact as written, untyped until parsed.
   */
  const raw: unknown = await readRunJson({
    path: join(
      archiveDir,
      runSetDir,
      artifactFile,
    ),
  },);

  /**
   * Artifact checked against the version 2 read contract.
   */
  const artifact = parseSettledTwoLaneArtifact({ value: raw, },);

  /**
   * Corpus pin taken from the artifact, so the file answers for itself even
   * after the run pin moves.
   */
  const pin: CorpusPin = {
    cloneDir,
    commitSha: artifact.corpusSha,
  };

  /**
   * Pair as it stood at that commit.
   */
  const [sourceText, targetText,] = await Promise.all([
    readCorpusFile({
      pin,
      relPath: `people/${artifact.id}/page.md`,
    },),
    readCorpusFile({
      pin,
      relPath: `people/${artifact.id}/page.en.md`,
    },),
  ],);

  /**
   * Preparation recomputed from that pair, wanted for its identity block and
   * for the provenance check, NOT for slice text.
   */
  const prepared = prepareDocumentPair({
    sourceText,
    targetText,
  },);

  return {
    runSet,
    artifactFile,
    entryId: artifact.id,
    artifactDigest: artifact.pipelineDigest,
    verification: verifySettled({
      artifact,
      prepared,
    },),
    subjects: subjectsOf({
      artifact,
      runSet,
      identity: identityOf({ prepared, },),
    },),
  };
}

/**
 * Lists every artifact under an archive directory, in a stable order.
 *
 * TAKES TWO LAYOUTS, because two exist and only one was accepted before.
 *
 * NESTED, `archive/<run set>/<entry>.json`, which is what the hand-built
 * archive at `~/translation-repair-v2-archive/` carries: each subdirectory is
 * one settlement of the corpus and its name is the run set.
 *
 * FLAT, `<runs dir>/artifacts/<entry>.json`, which is what `corpus-pass`
 * ACTUALLY WRITES. A pass produces exactly one settlement, so it has no reason
 * to invent a subdirectory for it, and the four archived artifacts read today
 * only because somebody copied them into run-set directories by hand. Pointing
 * this reader at a pass's own output found nothing and the audit refused with
 * "no artifacts under", which reads like an empty pass rather than like a
 * layout it cannot see.
 *
 * REFUSES A DIRECTORY CARRYING BOTH rather than choosing. A directory with
 * artifacts at its root AND in subdirectories is either two populations or a
 * half-finished move, and reading one while ignoring the other would report a
 * population smaller than the archive holds without saying so. That is the
 * defect this whole instrument keeps finding in other places.
 *
 * @param archiveDir - directory of run sets, or of artifacts
 *
 * @returns Locations sorted by run set then file
 *
 * @throws {@link Error} when artifacts sit at both levels
 *
 * @example
 * ```ts
 * const located = await locateSettledArtifacts({ archiveDir, },);
 * ```
 */
async function locateSettledArtifacts(
  { archiveDir, }: { readonly archiveDir: string; },
): Promise<readonly ArtifactLocation[]> {
  /**
   * Everything the archive directory holds, read once.
   */
  const entries = await readdir(
    archiveDir,
    { withFileTypes: true, },
  );

  /**
   * Run-set subdirectories, sorted.
   */
  const runSets = entries
    .filter(function isRunSet(entry,): boolean {
      return entry.isDirectory();
    },)
    .map(function named(entry,): string {
      return entry.name;
    },)
    .toSorted();

  /**
   * Artifacts sitting at the archive root, which is the layout a pass writes.
   */
  const loose = entries
    .filter(function isLooseArtifact(entry,): boolean {
      /**
       * Whether this entry is a file at all.
       */
      const isFile = entry.isFile();

      /**
       * Whether it is named like an artifact.
       */
      const isJson = entry.name
        .endsWith('.json',);

      return isFile && isJson;
    },)
    .map(function named(entry,): string {
      return entry.name;
    },)
    .toSorted();

  if ((loose.length > 0) && (runSets.length > 0))
    throw new Error(
      `${archiveDir} carries artifacts at its root AND in subdirectories`
        + ` (${String(loose.length,)} loose, ${String(runSets.length,)} run sets).`
        + ` Reading one and ignoring the other would report a smaller population than`
        + ` the archive holds. Move them together, then re-run.`,
    );

  if (loose.length > 0)
    return loose.map(function atRoot(artifactFile,): ArtifactLocation {
      return {
        runSetDir: '',
        // The archive is itself the one settlement, so it names the run set.
        // Its own basename rather than a placeholder, because that name lands
        // in every row and a reader tracing a row back wants the directory.
        runSet: basename(archiveDir,),
        artifactFile,
      };
    },);

  return (await Promise.all(runSets.map(
    async function within(runSet,): Promise<readonly ArtifactLocation[]> {
      return (await readdir(join(
        archiveDir,
        runSet,
      ),))
        .filter(function isArtifact(name,): boolean {
          return name.endsWith('.json',);
        },)
        .toSorted()
        .map(function at(artifactFile,): ArtifactLocation {
          return {
            runSetDir: runSet,
            runSet,
            artifactFile,
          };
        },);
    },
  ),))
    .flat();
}

/**
 * Reads every settled artifact under an archive directory.
 *
 * ORDER IS DETERMINISTIC, sorted by run set then file, so two invocations
 * produce rows in the same order and a capped run always buys the same prefix.
 *
 * @param archiveDir - directory whose subdirectories are run sets
 *
 * @param cloneDir - corpus clone every artifact's own commit is read from
 *
 * @returns One reading per artifact, in archive order
 *
 * @example
 * ```ts
 * const readings = await readArchiveSubjects({ archiveDir, cloneDir, },);
 * ```
 */
export async function readArchiveSubjects(
  {
    archiveDir,
    cloneDir,
  }: {
    readonly archiveDir: string;
    readonly cloneDir: string;
  },
): Promise<readonly SettledArtifactReading[]> {
  /**
   * Every artifact path, flattened in archive order.
   */
  const located = await locateSettledArtifacts({ archiveDir, },);

  return await Promise.all(located.map(
    async function read(at,): Promise<SettledArtifactReading> {
      return await readArtifactSubjects({
        archiveDir,
        runSetDir: at.runSetDir,
        runSet: at.runSet,
        artifactFile: at.artifactFile,
        cloneDir,
      },);
    },
  ),);
}

//endregion Settled audit input
