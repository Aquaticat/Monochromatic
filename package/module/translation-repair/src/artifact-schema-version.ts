import {
  ArtifactParseError,
  requireCount,
} from './artifact-guard.ts';
import { ARTIFACT_SCHEMA_VERSION_V2, } from './corpus-run/artifact-v2-contract.ts';

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
 * First schema generation there has ever been.
 *
 * NOT WHAT THE PASS WRITES, which is `ARTIFACT_SCHEMA_VERSION_V2` and has been
 * since `settleEntry` moved to the two-lane artifact. This was called
 * `SETTLED_ARTIFACT_SCHEMA_VERSION` and documented as the generation the pass
 * writes, which stopped being true at that move; it is renamed rather than
 * re-documented because a caller reaching for what the pass writes reaches for
 * the name that says SETTLED, and a guard built on that name would refuse every
 * artifact this pipeline produces.
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
 * const artifact = { artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION_V1, };
 * ```
 */
export const ARTIFACT_SCHEMA_VERSION_V1 = 1;

/**
 * Generations a reader still understands.
 *
 * SEPARATE FROM WHAT THE PASS WRITES, and separate on purpose. The two are the
 * same list today and will stop being so the moment a second version exists:
 * reading the writer's constant to decide what is READABLE means that bumping
 * it turns every artifact of the previous generation into a refusal, which is
 * the opposite of what a version is for.
 *
 * EVERY BUMP DECIDES THIS EXPLICITLY. Add the outgoing version here when a
 * reader still understands it, and leave it out when it genuinely cannot. Once
 * this holds more than one entry, whatever reads a versioned field has to
 * dispatch per version rather than assume the newest shape.
 *
 * THAT MOMENT HAS ARRIVED: version 2 is here and its shape shares almost
 * nothing with version 1, which recorded one lane at the top level. Version 1
 * stays readable, because refusing a generation a reader still understands is
 * the opposite of what a version is for, and the empty population on disk is a
 * fact about this corpus rather than about the format. What changes is that
 * every reader of a versioned field now has to say which versions it handles:
 * `readArtifactChangeSets` answers with ONE singular change set per artifact
 * and refuses version 2 outright, since a two-lane artifact has no singular
 * anything for it to answer with.
 *
 * @example
 * ```ts
 * const readable = KNOWN_ARTIFACT_SCHEMA_VERSIONS.includes(version,);
 * ```
 */
export const KNOWN_ARTIFACT_SCHEMA_VERSIONS: readonly number[] = [
  ARTIFACT_SCHEMA_VERSION_V1,
  ARTIFACT_SCHEMA_VERSION_V2,
];

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
  if (!KNOWN_ARTIFACT_SCHEMA_VERSIONS.includes(version,))
    throw new ArtifactParseError({
      path: `${path}.artifactSchemaVersion`,
      reason: `one of schema versions ${
        KNOWN_ARTIFACT_SCHEMA_VERSIONS.join(', ',)
      }, which are the ones this reader knows`,
    },);

  return {
    kind: 'versioned',
    version,
  };
}

//endregion Artifact schema version
