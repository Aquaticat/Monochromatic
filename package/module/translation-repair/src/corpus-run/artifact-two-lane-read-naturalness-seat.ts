import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import { rosterQuorumSize, } from '../roster-quorum-size.ts';
import type {
  ArtifactNaturalnessFinding,
  ArtifactNaturalnessReviewRound,
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

/**
 * Tests exact ordered equality between located finding lists.
 *
 * @param left - first list
 *
 * @param right - second list
 *
 * @returns Whether same findings occupy same positions
 *
 * @example
 * ```ts
 * sameNaturalnessFindings({ left, right, });
 * ```
 */
export function sameNaturalnessFindings(
  {
    left,
    right,
  }: {
    readonly left: readonly ArtifactNaturalnessFinding[];
    readonly right: readonly ArtifactNaturalnessFinding[];
  },
): boolean {
  return (left.length === right.length) && left.every(function same(
    value,
    index,
  ): boolean {
    /**
     * Finding at same stored position.
     */
    const candidate = right[index];
    return (candidate !== undefined)
      && (candidate.paragraph === value.paragraph)
      && (candidate.problem === value.problem);
  },);
}

/**
 * Deduplicates exact located findings in first occurrence order.
 *
 * @param findings - roster-ordered findings
 *
 * @returns First copy of each exact finding
 *
 * @example
 * ```ts
 * const unique = uniqueNaturalnessFindings({ findings, });
 * ```
 */
export function uniqueNaturalnessFindings(
  { findings, }: { readonly findings: readonly ArtifactNaturalnessFinding[]; },
): readonly ArtifactNaturalnessFinding[] {
  return findings.filter(function firstOccurrence(
    finding,
    index,
  ): boolean {
    return findings.findIndex(function same(candidate,): boolean {
      return (candidate.paragraph === finding.paragraph)
        && (candidate.problem === finding.problem);
    },) === index;
  },);
}

/**
 * Derives fail-closed verdict from accounted seats.
 *
 * @param seats - every requested reviewer seat
 *
 * @returns Verdict implied by quorum and rejection
 *
 * @example
 * ```ts
 * const verdict = naturalnessVerdictOf({ seats, });
 * ```
 */
export function naturalnessVerdictOf(
  { seats, }: { readonly seats: readonly ArtifactNaturalnessReviewSeat[]; },
): ArtifactNaturalnessReviewRound['verdict'] {
  /**
   * Seats carrying usable verdict.
   */
  const usable = seats.filter(function usableSeat(seat,): boolean {
    return seat.status !== 'unusable';
  },);
  /**
   * Same exact-half quorum runtime used for requested roster.
   */
  const quorumNeeded = rosterQuorumSize({ rosterSize: seats.length, },);
  if (usable.length < quorumNeeded)
    return 'quorum-not-met';
  if (usable.some(function rejects(seat,): boolean {
    return seat.status === 'unacceptable';
  },))
    return 'unacceptable';
  return 'acceptable';
}

//endregion Artifact absolute naturalness seat read
