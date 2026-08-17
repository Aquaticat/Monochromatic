import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import {
  type CorpusPin,
  readCorpusFile,
} from '../corpus-source.ts';
import {
  prepareDocumentPair,
  type PreparedDocumentPair,
} from '../document-preparation.ts';
import { verifyArtifactV2AgainstPreparation, } from './artifact-v2-corpus-verify.ts';
import { parseSettledArtifactV2, } from './artifact-v2-read.ts';
import type { ParsedArtifactV2, } from './artifact-v2-read-contract.ts';
import type { ArtifactSliceDeliveryV2, } from './artifact-v2-vocabulary.ts';

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
// -   Provenance. `verifyArtifactV2AgainstPreparation` is the only check that
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
 * Declared names and handles a run licensed, or a positive statement that the
 * pair declared none.
 *
 * A TAGGED ABSENCE rather than an optional string, so a reader of a persisted
 * row can tell "this pair declared nothing" from "nobody recorded whether it
 * did". The two mean opposite things when a name-shaped finding turns up.
 *
 * @example
 * ```ts
 * const identity: SettledIdentity = { kind: 'declared', context: '- name: ...', };
 * ```
 */
export type SettledIdentity = {
  /**
   * Front matter declared at least one name, alias or location.
   */
  readonly kind: 'declared';

  /**
   * Block as the producing stages received it.
   */
  readonly context: string;
} | {
  /**
   * Front matter declared nothing to carry.
   */
  readonly kind: 'none';
};

/**
 * One slice put in front of the audit, carrying everything a later reader needs
 * to say which decision it describes.
 *
 * @example
 * ```ts
 * const subject: SettledAuditSubject = { runSet, entryId, chunkIndex, ... };
 * ```
 */
export type SettledAuditSubject = {
  /**
   * Archive subdirectory this came from, which is the only thing separating two
   * runs of one entry: both write a file named for the entry.
   */
  readonly runSet: string;

  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Built output that produced the decision, from the artifact rather than from
   * whatever is built now.
   */
  readonly artifactDigest: string;

  /**
   * Corpus commit the pair was read at.
   */
  readonly corpusSha: string;

  /**
   * Global slice index, which every join uses.
   */
  readonly chunkIndex: number;

  /**
   * What the lane's document ended up carrying here.
   */
  readonly deliveryKind: ArtifactSliceDeliveryV2['kind'];

  /**
   * Whether the text under audit is the ARCHIVE's own English rather than a
   * fresh rendering.
   *
   * SEPARATED because the instrument was built for output with no BEFORE text,
   * and a retained slice is the opposite case. Reading both in one denominator
   * would blur the first real measurement it produces.
   */
  readonly auditsArchiveText: boolean;

  /**
   * Original passage, the only standard the audit has.
   */
  readonly sourceText: string;

  /**
   * Rendering under audit, which is what the lane decided on.
   */
  readonly candidateText: string;

  /**
   * Names the producing run licensed, or a positive statement of none.
   */
  readonly identity: SettledIdentity;
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
   * Archive subdirectory.
   */
  readonly runSet: string;

  /**
   * File name within it.
   */
  readonly artifactFile: string;
};

/**
 * Names the delivery kind whose text is the archive's own wording.
 *
 * A retained slice ships the incumbent unchanged, so auditing it audits the
 * archive. Anything else ships something the lane produced.
 */
const ARCHIVE_TEXT_DELIVERY: ArtifactSliceDeliveryV2['kind'] = 'incumbent-retained';

/**
 * Reads the identity block a preparation produced into a tagged answer.
 *
 * Empty counts as none, matching what `buildCriticMessages` does with it: a
 * zero-length block is rendered as no block at all, so recording it as declared
 * would claim the stages saw something they did not.
 *
 * @param prepared - preparation recomputed from the corpus
 *
 * @returns Declared block, or a positive none
 *
 * @example
 * ```ts
 * const identity = identityOf({ prepared, },);
 * ```
 */
function identityOf({ prepared, }: { readonly prepared: PreparedDocumentPair; },): SettledIdentity {
  /**
   * Block as the preparation produced it, absent when neither side declared.
   */
  const context = prepared.identityContext;

  if (context === undefined)
    return { kind: 'none', };
  if (context.length === 0)
    return { kind: 'none', };
  return {
    kind: 'declared',
    context,
  };
}

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
    readonly artifact: ParsedArtifactV2;
    readonly prepared: PreparedDocumentPair;
  },
): SettledVerification {
  try {
    verifyArtifactV2AgainstPreparation({
      artifact,
      prepared,
    },);
    return { kind: 'verified', };
  }
  catch (error) {
    return {
      kind: 'refused',
      detail: caughtValueText(error,),
    };
  }
}

/**
 * Turns one artifact's translate-lane delivery into audit subjects.
 *
 * @param artifact - parsed artifact
 *
 * @param runSet - archive subdirectory it came from
 *
 * @param identity - names its producing run licensed
 *
 * @returns One subject per decided slice
 *
 * @throws {@link Error} when a row that passed the decided filter is not
 * decided, which cannot happen and is never swallowed if it does
 *
 * @example
 * ```ts
 * const subjects = subjectsOf({ artifact, runSet, identity, },);
 * ```
 */
function subjectsOf(
  {
    artifact,
    runSet,
    identity,
  }: {
    readonly artifact: ParsedArtifactV2;
    readonly runSet: string;
    readonly identity: SettledIdentity;
  },
): readonly SettledAuditSubject[] {
  /**
   * Rows the translate lane's document was assembled from.
   */
  const { delivery, } = artifact.lanes
    .translate;

  return delivery
    .filter(function wasDecided(row,): boolean {
      /**
       * What the lane did at this slice.
       */
      const { outcome, } = row;

      // A slice the lane never reached has no rendering to audit.
      return outcome.kind === 'decided';
    },)
    .map(function asSubject(row,): SettledAuditSubject {
      /**
       * What the lane did, and what its document carries.
       */
      const {
        outcome,
        delivery: shipped,
      } = row;

      if (outcome.kind !== 'decided')
        throw new Error(`slice ${row.chunkIndex} passed the decided filter and is not decided`,);

      return {
        runSet,
        entryId: artifact.id,
        artifactDigest: artifact.pipelineDigest,
        corpusSha: artifact.corpusSha,
        chunkIndex: row.chunkIndex,
        deliveryKind: shipped.kind,
        auditsArchiveText: shipped.kind === ARCHIVE_TEXT_DELIVERY,
        sourceText: row.sourceText,
        candidateText: outcome.acceptedText,
        identity,
      };
    },);
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
 * const reading = await readSettledArtifact({ archiveDir, runSet, artifactFile, cloneDir, },);
 * ```
 */
export async function readSettledArtifact(
  {
    archiveDir,
    runSet,
    artifactFile,
    cloneDir,
  }: {
    readonly archiveDir: string;
    readonly runSet: string;
    readonly artifactFile: string;
    readonly cloneDir: string;
  },
): Promise<SettledArtifactReading> {
  /**
   * Artifact as written, untyped until parsed.
   */
  const raw: unknown = JSON.parse(await readFile(
    join(
      archiveDir,
      runSet,
      artifactFile,
    ),
    'utf8',
  ),);

  /**
   * Artifact checked against the version 2 read contract.
   */
  const artifact = parseSettledArtifactV2({ value: raw, },);

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
 * @param archiveDir - directory whose subdirectories are run sets
 *
 * @returns Locations sorted by run set then file
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
   * Run-set subdirectories, sorted.
   */
  const runSets = (await readdir(
    archiveDir,
    { withFileTypes: true, },
  ))
    .filter(function isRunSet(entry,): boolean {
      return entry.isDirectory();
    },)
    .map(function named(entry,): string {
      return entry.name;
    },)
    .toSorted();

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
 * const readings = await readSettledArchive({ archiveDir, cloneDir, },);
 * ```
 */
export async function readSettledArchive(
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
      return await readSettledArtifact({
        archiveDir,
        runSet: at.runSet,
        artifactFile: at.artifactFile,
        cloneDir,
      },);
    },
  ),);
}

//endregion Settled audit input
