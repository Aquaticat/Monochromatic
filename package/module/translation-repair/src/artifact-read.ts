import {
  ArtifactParseError,
  requireRecord,
} from './artifact-guard.ts';
import {
  readArtifactSchemaVersion,
  ARTIFACT_SCHEMA_VERSION_V1,
} from './artifact-schema-version.ts';
import {
  type ParsedArtifact,
  parseSettledArtifact,
} from './artifact-v1-read.ts';
import { ARTIFACT_SCHEMA_VERSION_V2, } from './corpus-run/artifact-v2-contract.ts';
import type { ParsedArtifactV2, } from './corpus-run/artifact-v2-read-contract.ts';
import { parseSettledArtifactV2, } from './corpus-run/artifact-v2-read.ts';

//region Artifact dispatch
// Choosing which generation's reader an artifact belongs to, and nothing else.
//
// EVERY GENERATION GETS ITS OWN READER, and this file holds none of them. A
// single reader that tried to cover all three would have to decide, per field,
// whether a missing value means an older file or a malformed one, which is the
// reading that made version 1's optional fields ambiguous in the first place.
//
// THE RESULT IS DISCRIMINATED BY GENERATION rather than merged into one shape.
// Version 1 answers with one status, one output and one issue list; version 2
// has two lanes, no singular anything, and a comparison. Flattening the second
// into the first would pick a lane, which is the question nobody has decided,
// and a caller that cannot say which generation it is holding cannot ask a
// question either one can answer.

/**
 * One artifact, read by whichever generation's reader owns it.
 *
 * @example
 * ```ts
 * const reading: ParsedArtifactReading = readSettledArtifact({ value, },);
 * ```
 */
export type ParsedArtifactReading = {
  /**
   * Artifact predates the schema version field, so its generation is legible
   * only from which fields it carries.
   */
  readonly kind: 'legacy';

  /**
   * What the version 1 reader made of it.
   */
  readonly artifact: ParsedArtifact;
} | {
  /**
   * Artifact states version 1.
   */
  readonly kind: 'version-1';

  /**
   * What the version 1 reader made of it.
   */
  readonly artifact: ParsedArtifact;
} | {
  /**
   * Artifact states version 2, the two-lane generation.
   */
  readonly kind: 'version-2';

  /**
   * What the version 2 reader made of it, comparison recomputed.
   */
  readonly artifact: ParsedArtifactV2;
};

/**
 * Reads one artifact of any generation this reader understands.
 *
 * ACCEPTS AN EXPLICIT VERSION 1, which is not the same as there being version 1
 * artifacts on disk: a reader that understands a generation should read it, and
 * how many files of it exist is a fact about one corpus rather than about the
 * format. An unknown version is refused by the version reading itself.
 *
 * @param value - artifact JSON, freshly parsed and still untyped
 *
 * @returns Which generation it is, and what that generation's reader made of it
 *
 * @throws {@link ArtifactParseError} when the value is not a record, when it
 * names a generation this reader does not know, or when the chosen reader
 * refuses it
 *
 * @example
 * ```ts
 * const reading = readSettledArtifact({ value: JSON.parse(text,), },);
 * ```
 */
export function readSettledArtifact(
  { value, }: { readonly value: unknown; },
): ParsedArtifactReading {
  /**
   * Artifact as a record, read once here so the version can be looked at
   * before any generation's reader runs.
   */
  const artifact = requireRecord({
    value,
    path: 'artifact',
  },);

  /**
   * Which generation it states, or that it states none.
   */
  const reading = readArtifactSchemaVersion({
    artifact,
    path: 'artifact',
  },);
  if (reading.kind === 'unversioned') {
    return {
      kind: 'legacy',
      artifact: parseSettledArtifact({ value, },),
    };
  }
  if (reading.version === ARTIFACT_SCHEMA_VERSION_V1) {
    return {
      kind: 'version-1',
      artifact: parseSettledArtifact({ value, },),
    };
  }
  if (reading.version === ARTIFACT_SCHEMA_VERSION_V2) {
    return {
      kind: 'version-2',
      artifact: parseSettledArtifactV2({ value, },),
    };
  }

  // UNREACHABLE while the version reading refuses what it does not know, and
  // stated anyway: the day a generation is added to that list and forgotten
  // here, this says so instead of returning a reading for the wrong one.
  throw new ArtifactParseError({
    path: 'artifact.artifactSchemaVersion',
    reason: `a generation with a reader: version ${
      String(reading.version,)
    } is known to this build and nothing here reads it`,
  },);
}

// RE-EXPORTED under the names their callers already use. The version 1 reader
// moved to a file naming its generation; every consumer of it wanted exactly
// what it does, and a rename would have been churn on top of a move.
export {
  type ParsedAcceptedIssue,
  type ParsedArtifact,
  parseSettledArtifact,
} from './artifact-v1-read.ts';

//endregion Artifact dispatch
