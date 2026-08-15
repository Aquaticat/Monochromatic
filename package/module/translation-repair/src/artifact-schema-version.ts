import {
  ArtifactParseError,
  requireCount,
} from './artifact-guard.ts';

//region Artifact schema version
// What generation a settled artifact belongs to, stated by the writer instead
// of guessed by every reader from which fields happen to be there.
//
// Its own file because the constant is the one thing a WRITER needs from this
// subject and the reading is the one thing a READER needs, and the two are
// imported from opposite ends of the package. Keeping the version history here
// also gives it the same shape the slice cache key's history has, which is the
// only reason that one has stayed honest.

/**
 * Schema generation the pass writes today.
 *
 * VERSION HISTORY, and the rule that comes with it: every bump records what
 * changed and why a reader could not have worked it out from the fields alone.
 * A version that does NOT move on a shape change is the failure this field
 * exists to end, so say so here when a field is added compatibly.
 *
 * Version 1 is the first version there has ever been, which makes its own
 * history the important part. THREE UNVERSIONED GENERATIONS precede it, and a
 * reader meeting one has only field presence to go on:
 *
 * -   Before 2026-08-14: no `pipelineDigest`, no `sourceBytes`, and no index
 *     sets. Every artifact settled to date is one of these, measured over the
 *     164 artifact files on disk on 2026-08-15.
 * -   From 2026-08-14: `pipelineDigest` and `sourceBytes`, still no index sets.
 * -   From 2026-08-15: `shippedChunkIndices` and `withdrawnChunkIndices`, with
 *     no `sliceCount` to bound them and no version to announce them.
 *
 * The middle two generations are EMPTY populations today, since no pass has run
 * since either landed. They are named anyway, because a reader that meets one
 * must not read it as the generation before.
 *
 * @example
 * ```ts
 * const artifact = { artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION, };
 * ```
 */
export const SETTLED_ARTIFACT_SCHEMA_VERSION = 1;

/**
 * What an artifact says about which generation it belongs to.
 *
 * A UNION RATHER THAN AN OPTIONAL NUMBER, deliberately. Absence is the whole
 * difficulty this field was added to remove, and an optional field hands the
 * difficulty straight back: a consumer writes `version ?? 0` and an unversioned
 * artifact becomes a versioned one nobody notices.
 *
 * @example
 * ```ts
 * const reading: ArtifactSchemaReading = { kind: 'unversioned', };
 * ```
 */
export type ArtifactSchemaReading = {
  /**
   * Artifact names a generation this reader knows.
   */
  readonly kind: 'versioned';

  /**
   * Generation it names.
   */
  readonly version: number;
} | {
  /**
   * Artifact predates the field, so its generation is legible only from which
   * fields it carries.
   */
  readonly kind: 'unversioned';
};

/**
 * Reads an artifact's schema generation.
 *
 * AN UNKNOWN VERSION IS REFUSED, not tolerated. A reader meeting a generation
 * written after it was compiled knows exactly one thing about that artifact:
 * that it does not know its shape. Carrying on would parse a field whose
 * meaning may have moved, which is how a measurement instrument reports a
 * number that is wrong rather than missing.
 *
 * @param artifact - artifact record, freshly parsed
 *
 * @param path - dotted path for error messages
 *
 * @returns Generation it names, or a named absence
 *
 * @throws {@link ArtifactParseError} when the field is present but is not a
 * count, or names a generation this reader does not know
 *
 * @example
 * ```ts
 * const reading = readArtifactSchemaVersion({ artifact, path: id, },);
 * ```
 */
export function readArtifactSchemaVersion(
  {
    artifact,
    path,
  }: {
    readonly artifact: Readonly<Record<string, unknown>>;
    readonly path: string;
  },
): ArtifactSchemaReading {
  if (
    !Object.hasOwn(
      artifact,
      'artifactSchemaVersion',
    )
  ) return { kind: 'unversioned', };

  /**
   * Generation the artifact names, checked as a count first so a string or a
   * fraction is refused here rather than compared numerically below.
   */
  const version = requireCount({
    value: artifact.artifactSchemaVersion,
    path: `${path}.artifactSchemaVersion`,
  },);
  if (version !== SETTLED_ARTIFACT_SCHEMA_VERSION)
    throw new ArtifactParseError({
      path: `${path}.artifactSchemaVersion`,
      reason: `schema version ${String(SETTLED_ARTIFACT_SCHEMA_VERSION,)}, which is the newest this reader knows`,
    },);

  return {
    kind: 'versioned',
    version,
  };
}

//endregion Artifact schema version
