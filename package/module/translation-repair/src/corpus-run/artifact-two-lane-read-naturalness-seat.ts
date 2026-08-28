import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import type {
  ArtifactNaturalnessFinding,
  ArtifactNaturalnessReviewSeat,
} from './artifact-two-lane-consolidate.ts';

//region Artifact absolute naturalness seat read

/**
 * Reads paragraph-located finding.
 *
 * @param value - unknown finding
 *
 * @param path - artifact path
 *
 * @returns Validated finding
 *
 * @example
 * ```ts
 * const finding = parseFinding({ value, path, });
 * ```
 */
function parseFinding(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactNaturalnessFinding {
  /**
   * Finding under exact schema-eight shape.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'paragraph',
      'problem',
    ],
    path,
  },);
  /**
   * One-based paragraph position.
   */
  const paragraph = requireCount({
    value: record.paragraph,
    path: `${path}.paragraph`,
  },);
  if (paragraph < 1) {
    throw new ArtifactParseError({
      path: `${path}.paragraph`,
      reason: 'one-based paragraph number',
    },);
  }
  /**
   * Concise actionable problem.
   */
  const problem = requireString({
    value: record.problem,
    path: `${path}.problem`,
  },);
  if (problem === '') {
    throw new ArtifactParseError({
      path: `${path}.problem`,
      reason: 'non-empty actionable defect',
    },);
  }
  return {
    paragraph,
    problem,
  };
}

/**
 * Reads finding list in stored order.
 *
 * @param value - unknown list
 *
 * @param path - artifact path
 *
 * @returns Validated findings
 *
 * @example
 * ```ts
 * const findings = parseFindings({ value: [], path: 'review.findings', });
 * ```
 */
export function parseNaturalnessFindings(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly ArtifactNaturalnessFinding[] {
  return requireArray({
    value,
    path,
  },)
    .map(function readOne(
      entry,
      at,
    ): ArtifactNaturalnessFinding {
      return parseFinding({
        value: entry,
        path: `${path}[${String(at,)}]`,
      },);
    },);
}

/**
 * Reads one accounted reviewer seat and cross-validates status fields.
 *
 * @param value - unknown seat
 *
 * @param path - artifact path
 *
 * @returns Validated seat
 *
 * @example
 * ```ts
 * const seat = parseNaturalnessReviewSeat({ value, path, });
 * ```
 */
export function parseNaturalnessReviewSeat(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactNaturalnessReviewSeat {
  /**
   * Seat under exact schema-eight shape.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'modelId',
      'status',
      'findings',
      'reason',
    ],
    path,
  },);
  if ((record.status !== 'acceptable')
    && (record.status !== 'unacceptable')
    && (record.status !== 'unusable')) {
    throw new ArtifactParseError({
      path: `${path}.status`,
      reason: 'one of acceptable, unacceptable, unusable',
    },);
  }
  /**
   * Findings under status consistency check.
   */
  const findings = parseNaturalnessFindings({
    value: record.findings,
    path: `${path}.findings`,
  },);
  /**
   * Explanation under status consistency check.
   */
  const reason = requireString({
    value: record.reason,
    path: `${path}.reason`,
  },);
  if ((record.status === 'acceptable') && (findings.length > 0)) {
    throw new ArtifactParseError({
      path: `${path}.findings`,
      reason: 'empty findings for acceptable seat',
    },);
  }
  if ((record.status === 'unacceptable') && (findings.length === 0)) {
    throw new ArtifactParseError({
      path: `${path}.findings`,
      reason: 'at least one finding for unacceptable seat',
    },);
  }
  if ((record.status === 'unusable') && ((findings.length > 0) || (reason !== ''))) {
    throw new ArtifactParseError({
      path,
      reason: 'unusable seat with empty findings and reason',
    },);
  }
  return {
    modelId: requireString({
      value: record.modelId,
      path: `${path}.modelId`,
    },),
    status: record.status,
    findings,
    reason,
  };
}

//endregion Artifact absolute naturalness seat read
