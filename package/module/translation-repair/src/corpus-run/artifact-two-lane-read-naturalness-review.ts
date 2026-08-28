import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import { ABSOLUTE_NATURALNESS_REVIEW_QUORUM, } from '../absolute-naturalness-review-stage.ts';
import { hashContent, } from '../document-node.ts';
import type {
  ArtifactNaturalnessFinding,
  ArtifactNaturalnessReview,
  ArtifactNaturalnessReviewRound,
  ArtifactNaturalnessReviewSeat,
} from './artifact-two-lane-consolidate.ts';
import {
  parseNaturalnessFindings,
  parseNaturalnessReviewSeat,
} from './artifact-two-lane-read-naturalness-seat.ts';

//region Artifact absolute naturalness review read

/**
 * Character length of lowercase hexadecimal SHA-256 digest.
 */
const SHA256_HEX_LENGTH = 64;

/**
 * Characters allowed in lowercase hexadecimal digest.
 */
const LOWER_HEX_CHARACTERS = '0123456789abcdef';

/**
 * Tests exact ordered equality between located finding lists.
 *
 * @param left - first list
 *
 * @param right - second list
 *
 * @returns Whether same findings occupy same positions
 */
function sameFindings(
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
 * Checks lowercase hexadecimal SHA-256 shape without regular expression.
 *
 * @param value - candidate digest
 *
 * @returns Whether exact ASCII digest shape matches
 *
 * @example
 * ```ts
 * isLowerHexDigest({ value: '0'.repeat(SHA256_HEX_LENGTH,), });
 * ```
 */
function isLowerHexDigest(
  { value, }: { readonly value: string; },
): boolean {
  if (value.length !== SHA256_HEX_LENGTH)
    return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!LOWER_HEX_CHARACTERS.includes(value.charAt(index,),))
      return false;
  }
  return true;
}

/**
 * Deduplicates exact located findings in first occurrence order.
 *
 * @param findings - roster-ordered findings
 *
 * @returns First copy of each exact finding
 */
function uniqueFindings(
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
 */
function verdictOf(
  { seats, }: { readonly seats: readonly ArtifactNaturalnessReviewSeat[]; },
): ArtifactNaturalnessReviewRound['verdict'] {
  /**
   * Seats carrying usable verdict.
   */
  const usable = seats.filter(function usableSeat(seat,): boolean {
    return seat.status !== 'unusable';
  },);
  if (usable.length < ABSOLUTE_NATURALNESS_REVIEW_QUORUM)
    return 'quorum-not-met';
  if (usable.some(function rejects(seat,): boolean {
    return seat.status === 'unacceptable';
  },))
    return 'unacceptable';
  return 'acceptable';
}

/**
 * Reads one candidate-bound absolute review round.
 *
 * @param value - unknown round
 *
 * @param path - artifact path
 *
 * @returns Cross-validated review round
 */
function parseRound(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactNaturalnessReviewRound {
  /**
   * Round under exact schema-eight shape.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'candidateDigest',
      'seats',
      'usable',
      'verdict',
      'findings',
    ],
    path,
  },);
  /**
   * Accounted seats in roster order.
   */
  const seats = requireArray({
    value: record.seats,
    path: `${path}.seats`,
  },)
    .map(function readSeat(
      entry,
      at,
    ) {
      return parseNaturalnessReviewSeat({
        value: entry,
        path: `${path}.seats[${String(at,)}]`,
      },);
    },);
  /**
   * Model ids proving one status per seat.
   */
  const modelIds = seats.map(function modelIdOf(seat,): string {
    return seat.modelId;
  },);
  if (new Set(modelIds,).size !== modelIds.length) {
    throw new ArtifactParseError({
      path: `${path}.seats`,
      reason: 'one status per unique reviewer model id',
    },);
  }
  /**
   * Usable count recomputed from seats.
   */
  const usable = seats.filter(function usableSeat(seat,): boolean {
    return seat.status !== 'unusable';
  },)
    .length;
  /**
   * Stored usable count before equality check.
   */
  const storedUsable = requireCount({
    value: record.usable,
    path: `${path}.usable`,
  },);
  if (storedUsable !== usable) {
    throw new ArtifactParseError({
      path: `${path}.usable`,
      reason: `${String(usable,)} derived from seat statuses`,
    },);
  }
  /**
   * Aggregate findings recomputed in roster order.
   */
  const findings = uniqueFindings({
    findings: seats.flatMap(function rejected(
      seat,
    ): readonly ArtifactNaturalnessFinding[] {
      return (seat.status === 'unacceptable') ? seat.findings : [];
    },),
  },);
  /**
   * Stored aggregate findings.
   */
  const storedFindings = parseNaturalnessFindings({
    value: record.findings,
    path: `${path}.findings`,
  },);
  if (!sameFindings({
    left: findings,
    right: storedFindings,
  },)) {
    throw new ArtifactParseError({
      path: `${path}.findings`,
      reason: 'deduplicated unacceptable-seat findings in roster order',
    },);
  }
  /**
   * Verdict recomputed from seat statuses.
   */
  const verdict = verdictOf({ seats, },);
  if (record.verdict !== verdict) {
    throw new ArtifactParseError({
      path: `${path}.verdict`,
      reason: `${verdict}, derived from seat statuses and quorum`,
    },);
  }
  /**
   * Candidate digest under lowercase SHA-256 shape.
   */
  const candidateDigest = requireString({
    value: record.candidateDigest,
    path: `${path}.candidateDigest`,
  },);
  if (!isLowerHexDigest({ value: candidateDigest, })) {
    throw new ArtifactParseError({
      path: `${path}.candidateDigest`,
      reason: 'lowercase hexadecimal SHA-256 digest',
    },);
  }
  return {
    candidateDigest,
    seats,
    usable,
    verdict,
    findings,
  };
}

/**
 * Reads schema-eight absolute review and binds final round to final text.
 *
 * @param value - unknown review field
 *
 * @param path - artifact path
 *
 * @param finalText - exact polish text artifact says ships
 *
 * @returns Cross-validated review audit
 *
 * @example
 * ```ts
 * const review = parseNaturalnessReview({ value, path, finalText, });
 * ```
 */
export function parseNaturalnessReview(
  {
    value,
    path,
    finalText,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly finalText: string;
  },
): ArtifactNaturalnessReview {
  /**
   * Review under exact schema-eight shape.
   */
  const record = requireRecord({
    value,
    path,
  },);
  requireExactKeys({
    record,
    allowed: [
      'correctionCount',
      'rounds',
    ],
    path,
  },);
  /**
   * Correction count under bounded policy.
   */
  const correctionCount = requireCount({
    value: record.correctionCount,
    path: `${path}.correctionCount`,
  },);
  if ((correctionCount !== 0) && (correctionCount !== 1)) {
    throw new ArtifactParseError({
      path: `${path}.correctionCount`,
      reason: 'zero or one bounded correction',
    },);
  }
  /**
   * Initial and optional post-correction reviews.
   */
  const rounds = requireArray({
    value: record.rounds,
    path: `${path}.rounds`,
  },)
    .map(function readRound(
      entry,
      at,
    ) {
      return parseRound({
        value: entry,
        path: `${path}.rounds[${String(at,)}]`,
      },);
    },);
  if (rounds.length !== (correctionCount + 1)) {
    throw new ArtifactParseError({
      path: `${path}.rounds`,
      reason: `${String(correctionCount + 1,)} rounds for correction count`,
    },);
  }
  /**
   * Initial review, always present by length check.
   */
  const [initial,] = rounds;
  /**
   * Final review, always present by length check.
   */
  const final = rounds.at(-1,);
  if ((initial === undefined) || (final === undefined)) {
    throw new ArtifactParseError({
      path: `${path}.rounds`,
      reason: 'initial and final absolute review',
    },);
  }
  if ((correctionCount === 1) && (initial.verdict !== 'unacceptable')) {
    throw new ArtifactParseError({
      path: `${path}.rounds[0].verdict`,
      reason: 'unacceptable initial review before correction',
    },);
  }
  if (final.verdict !== 'acceptable') {
    throw new ArtifactParseError({
      path: `${path}.rounds[${String(rounds.length - 1,)}].verdict`,
      reason: 'acceptable final absolute review',
    },);
  }
  if (final.candidateDigest !== hashContent({ content: finalText, },)) {
    throw new ArtifactParseError({
      path: `${path}.rounds[${String(rounds.length - 1,)}].candidateDigest`,
      reason: 'SHA-256 of final polish text',
    },);
  }
  return {
    correctionCount,
    rounds,
  };
}

//endregion Artifact absolute naturalness review read
