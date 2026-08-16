import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { ArtifactParseError, } from '../artifact-guard.ts';
import { readArtifactSchemaVersion, } from '../artifact-schema-version.ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { isJsonRecord, } from '../json-guard.ts';
import { readdirArtifacts, } from './artifact-placement.ts';

//region Pass schema census
// Which artifact GENERATION each settled file belongs to, as a discriminated
// answer rather than as the sentence a refusal would print.
//
// KEYING A CENSUS BY ITS OWN PROSE loses exactly what the reader of a refusal
// needs. Three unversioned generations collapse into one phrase, and a file
// that is not an artifact at all collapses with a file from a generation this
// build cannot read, so a message built from those keys can tell an operator
// their malformed file is a sound result of another generation and should be
// kept. The classification is the fact; the sentence is built from it later.

/**
 * Suffix every artifact file carries.
 */
const ARTIFACT_SUFFIX = '.json';

/**
 * What one settled file says about its generation.
 *
 * @example
 * ```ts
 * const classification: SchemaClassification = { kind: 'declared', version: 2, };
 * ```
 */
export type SchemaClassification = {
  /**
   * File names a generation this build can read.
   */
  readonly kind: 'declared';

  /**
   * Generation it names.
   */
  readonly version: number;
} | {
  /**
   * File carries no version field, so its generation is legible only from which
   * fields it holds. Three such generations exist and this does not tell them
   * apart; nothing downstream needs it to, because none of them is writable.
   */
  readonly kind: 'unversioned';
} | {
  /**
   * File names a generation this build cannot read: a version field that is not
   * a count, or a generation written after this build.
   */
  readonly kind: 'unreadable-version';

  /**
   * What the reading refused, for the message.
   */
  readonly reason: string;
} | {
  /**
   * File is not an artifact at all: not JSON, or JSON that is not a record.
   *
   * SEPARATE FROM EVERY OTHER ANSWER because its remedy is the opposite one.
   * Another generation's artifact is a sound result to keep; this is a file to
   * investigate, and the pipeline guard refuses it first with the advice that
   * fits.
   */
  readonly kind: 'malformed';

  /**
   * What reading it refused.
   */
  readonly reason: string;
};

/**
 * One settled entry and the generation its file belongs to.
 *
 * @example
 * ```ts
 * const row: SchemaCensusRow = { entryId: 'Mittens', classification: { kind: 'unversioned', }, };
 * ```
 */
export type SchemaCensusRow = {
  /**
   * Entry the file settles, which is its name without the suffix.
   */
  readonly entryId: string;

  /**
   * What that file says about its generation.
   */
  readonly classification: SchemaClassification;
};

/**
 * Classifies one artifact's generation from its parsed body.
 *
 * @param artifact - artifact as parsed JSON, of any shape
 *
 * @param entryId - entry the artifact belongs to, for the reader's error paths
 *
 * @returns Which generation it declares, or why that could not be read
 *
 * @throws Whatever a reading raised that is not a parse failure, since this
 * classifies artifacts rather than swallowing faults
 *
 * @example
 * ```ts
 * const classification = classifyArtifact({ artifact, entryId: 'Mittens', },);
 * ```
 */
function classifyArtifact(
  {
    artifact,
    entryId,
  }: {
    readonly artifact: unknown;
    readonly entryId: string;
  },
): SchemaClassification {
  if (!isJsonRecord(artifact,)) {
    return {
      kind: 'malformed',
      reason: 'a JSON object, which is what every generation of this artifact is',
    };
  }

  try {
    /**
     * Generation the artifact names, or a named absence.
     */
    const reading = readArtifactSchemaVersion({
      artifact,
      path: entryId,
    },);

    return (reading.kind === 'versioned')
      ? {
        kind: 'declared',
        version: reading.version,
      }
      : { kind: 'unversioned', };
  } catch (error) {
    if (error instanceof ArtifactParseError) {
      return {
        kind: 'unreadable-version',
        reason: caughtValueText(error,),
      };
    }

    throw error;
  }
}

/**
 * Classifies every settled entry in a directory.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns One row per artifact, in directory-sorted order so a refusal reads
 * the same twice
 *
 * @example
 * ```ts
 * const rows = await censusBySchema({ artifactsDir, },);
 * ```
 */
export async function censusBySchema(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<readonly SchemaCensusRow[]> {
  /**
   * Artifact names, sorted.
   */
  const names = (await readdirArtifacts({ artifactsDir, },))
    .filter(function isArtifact(name,): boolean {
      return name.endsWith(ARTIFACT_SUFFIX,);
    },)
    .toSorted();

  return Promise.all(names.map(async function readOne(name,): Promise<SchemaCensusRow> {
    /**
     * Entry id, which is the file name without its suffix.
     */
    const entryId = name.slice(
      0,
      -ARTIFACT_SUFFIX.length,
    );

    /**
     * Artifact text as it sits on disk.
     */
    const text = await readFile(
      join(
        artifactsDir,
        name,
      ),
      'utf8',
    );

    try {
      return {
        entryId,
        classification: classifyArtifact({
          artifact: JSON.parse(text,),
          entryId,
        },),
      };
    } catch (error) {
      // A file that is not JSON is CLASSIFIED rather than skipped or thrown
      // out of the census. The pipeline guard refuses it before this runs, so
      // reaching here means somebody called the census alone, and answering a
      // question about a directory by ignoring part of the directory is how a
      // guard reports that everything is fine.
      if (error instanceof SyntaxError) {
        return {
          entryId,
          classification: {
            kind: 'malformed',
            reason: caughtValueText(error,),
          },
        };
      }

      throw error;
    }
  },),);
}

//endregion Pass schema census
