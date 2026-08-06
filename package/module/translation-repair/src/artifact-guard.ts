import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';

//region Artifact guards
// The shape checks every artifact reader shares. They live apart from
// `artifact-read.ts` because the repair reader needs the same primitives, and
// having it reach back into the issue reader for them would tie two independent
// parsers together through their least interesting parts.
//
// Every one of these THROWS rather than returning a fallback. That is the whole
// doctrine of this layer: these parsers feed a precision measurement, and a
// silently skipped accepted issue shrinks the denominator without leaving a
// trace anyone would notice.

/**
 * Thrown when an artifact, or a value within it, is structurally malformed.
 * Aborting loudly is deliberate: a skipped accepted issue would bias the
 * precision denominator without a trace.
 */
export class ArtifactParseError extends Error {
  /**
   * Builds failure naming the malformed path.
   *
   * @param path - dotted path to malformed value
   *
   * @param reason - what value was expected to be
   *
   * @example
   * ```ts
   * throw new ArtifactParseError({ path: 'Kitten issues[3].issue.status', reason: 'a string', },);
   * ```
   */
  public constructor(
    {
      path,
      reason,
    }: {
      readonly path: string;
      readonly reason: string;
    },
  ) {
    super(`artifact parse failed at ${path}: expected ${reason}.`,);
    this.name = 'ArtifactParseError';
  }
}

/**
 * Reads a required string, throwing when the value is any other shape.
 *
 * @param value - value to check
 *
 * @param path - dotted path for error message
 *
 * @returns Value as a string
 *
 * @throws {@link ArtifactParseError} when the value is not a string
 *
 * @example
 * ```ts
 * const id = requireString({ value: artifact.id, path: 'artifact.id', },);
 * ```
 */
export function requireString(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): string {
  if ((typeof value) !== 'string')
    throw new ArtifactParseError({
      path,
      reason: 'a string',
    },);
  return value;
}

/**
 * Reads a required boolean, throwing when the value is any other shape.
 *
 * @param value - value to check
 *
 * @param path - dotted path for error message
 *
 * @returns Value as a boolean
 *
 * @throws {@link ArtifactParseError} when the value is not a boolean
 *
 * @example
 * ```ts
 * const refined = requireBoolean({ value: record.refined, path: 'refined', },);
 * ```
 */
export function requireBoolean(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): boolean {
  if ((typeof value) !== 'boolean')
    throw new ArtifactParseError({
      path,
      reason: 'a boolean',
    },);
  return value;
}

/**
 * Reads a required record, throwing when the value is any other shape.
 *
 * @param value - value to check
 *
 * @param path - dotted path for error message
 *
 * @returns Value as a record
 *
 * @throws {@link ArtifactParseError} when the value is not an object
 *
 * @example
 * ```ts
 * const issue = requireRecord({ value: record.issue, path: 'issue', },);
 * ```
 */
export function requireRecord(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): Record<string, unknown> {
  if (!isJsonRecord(value,))
    throw new ArtifactParseError({
      path,
      reason: 'an object',
    },);
  return value;
}

/**
 * Reads a required array, throwing when the value is any other shape.
 *
 * @param value - value to check
 *
 * @param path - dotted path for error message
 *
 * @returns Value as an array
 *
 * @throws {@link ArtifactParseError} when the value is not an array
 *
 * @example
 * ```ts
 * const spans = requireArray({ value: claim.spans, path: 'claim.spans', },);
 * ```
 */
export function requireArray(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly unknown[] {
  if (!isJsonArray(value,))
    throw new ArtifactParseError({
      path,
      reason: 'an array',
    },);
  return value;
}

//endregion Artifact guards
