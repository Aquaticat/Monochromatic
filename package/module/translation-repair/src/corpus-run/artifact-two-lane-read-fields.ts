import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import {
  ArtifactParseError,
  requireString,
} from '../artifact-guard.ts';
import {
  assertPipelineDigest,
  type PipelineDigest,
} from './pipeline-digest.ts';

//region Artifact field readers
// Single-field readers the two-lane artifact parser leans on, kept beside it
// so the parser itself stays within the file budget. Each narrows one
// recorded value by the same check a fresh one passes, and refuses with the
// dotted path of the field rather than its content.

/**
 * Reads the digest naming the built output that ran.
 *
 * @param value - recorded digest
 *
 * @param path - dotted path for error message
 *
 * @returns Digest, narrowed by the same check a fresh one passes
 *
 * @throws {@link ArtifactParseError} when the value is not a string, or not
 * shaped like a digest
 *
 * @example
 * ```ts
 * const digest = requireDigest({ value: artifact.pipelineDigest, path, },);
 * ```
 */
export function requireDigest(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): PipelineDigest {
  /**
   * Recorded string, before it is known to be a digest.
   */
  const held = requireString({
    value,
    path,
  },);
  try {
    assertPipelineDigest(held,);
  } catch (error) {
    throw new ArtifactParseError({
      path,
      reason: `a pipeline digest: ${caughtValueText(error,)}`,
    },);
  }
  return held;
}

/**
 * Reads the recorded front matter authority, which can only be the archive's.
 *
 * @param value - recorded authority
 *
 * @param path - dotted path for error messages
 *
 * @returns The one authority a record carries
 *
 * @throws {@link ArtifactParseError} when the record carries anything else
 *
 * @example
 * ```ts
 * const authority = requireArchiveAuthority({ value: record.frontMatterAuthority, path, },);
 * ```
 */
export function requireArchiveAuthority(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): 'archive' {
  if (value === 'archive')
    return value;
  throw new ArtifactParseError({
    path,
    reason: "'archive', the one authority a preparation records",
  },);
}


//endregion Artifact field readers
