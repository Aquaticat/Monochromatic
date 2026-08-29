import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
} from '../artifact-guard.ts';
import type {
  ArtifactNaturalnessFinding,
  ArtifactNaturalnessReview,
  ArtifactNaturalnessReviewRound,
  ArtifactNaturalnessReviewSeat,
} from './artifact-two-lane-consolidate.ts';
import {
  assertFinalNaturalnessDigests,
  assertNaturalnessCorrectionChain,
  parseNaturalnessCorrection,
  parseParagraphDigests,
  requireNaturalnessDigest,
} from './artifact-two-lane-read-naturalness-digest.ts';
import {
  naturalnessVerdictOf,
  parseNaturalnessFindings,
  parseNaturalnessReviewSeat,
  sameNaturalnessFindings,
  uniqueNaturalnessFindings,
} from './artifact-two-lane-read-naturalness-seat.ts';

//region Artifact absolute naturalness review read

/**
 * Reads one candidate-bound absolute review round.
 *
 * @param value - unknown round
 *
 * @param path - artifact path
 *
 * @param paragraphDigestsRequired - whether generation binds reviewed paragraph identities
 *
 * @returns Cross-validated review round
 */
function parseRound(
  {
    value,
    path,
    paragraphDigestsRequired,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly paragraphDigestsRequired: boolean;
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
      'paragraphCount',
      ...(paragraphDigestsRequired ? ['paragraphDigests',] : []),
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
   * Structurally correctable paragraphs reviewer was shown.
   */
  const paragraphCount = requireCount({
    value: record.paragraphCount,
    path: `${path}.paragraphCount`,
  },);
  /**
   * Reviewed paragraph identities under generation-nine shape.
   */
  const paragraphDigests = paragraphDigestsRequired
    ? parseParagraphDigests({
      value: record.paragraphDigests,
      path: `${path}.paragraphDigests`,
      paragraphCount,
    },)
    : [];
  if (seats.some(function outOfRange(seat,): boolean {
    /**
     * Findings this seat attached to reviewed paragraphs.
     */
    const { findings: seatFindings, } = seat;
    return seatFindings.some(function missingParagraph(finding,): boolean {
      return finding.paragraph > paragraphCount;
    },);
  },)) {
    throw new ArtifactParseError({
      path: `${path}.seats`,
      reason: 'findings naming existing reviewed paragraph',
    },);
  }
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
  const findings = uniqueNaturalnessFindings({
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
  if (!sameNaturalnessFindings({
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
  const verdict = naturalnessVerdictOf({ seats, },);
  if (record.verdict !== verdict) {
    throw new ArtifactParseError({
      path: `${path}.verdict`,
      reason: `${verdict}, derived from seat statuses and quorum`,
    },);
  }
  /**
   * Candidate digest under lowercase SHA-256 shape.
   */
  const candidateDigest = requireNaturalnessDigest({
    value: record.candidateDigest,
    path: `${path}.candidateDigest`,
  },);
  return {
    candidateDigest,
    paragraphCount,
    ...(paragraphDigestsRequired ? { paragraphDigests, } : {}),
    seats,
    usable,
    verdict,
    findings,
  };
}

/**
 * Reads schema-eight or schema-nine absolute review and binds final round to final text.
 *
 * @param value - unknown review field
 *
 * @param path - artifact path
 *
 * @param finalText - exact polish text artifact says ships
 *
 * @param correctionChainRequired - whether generation requires transition digests
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
    correctionChainRequired = false,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly finalText: string;
    readonly correctionChainRequired?: boolean;
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
      ...(correctionChainRequired ? ['corrections',] : []),
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
  /**
   * Maximum corrections this artifact generation can represent.
   */
  const maximumCorrections = correctionChainRequired ? 2 : 1;
  if (correctionCount > maximumCorrections) {
    throw new ArtifactParseError({
      path: `${path}.correctionCount`,
      reason: `zero to ${String(maximumCorrections,)} bounded corrections`,
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
        paragraphDigestsRequired: correctionChainRequired,
      },);
    },);
  /**
   * Correction count narrowed to artifact domain after range validation.
   */
  const boundedCorrectionCount = (correctionCount === 0)
    ? 0
    : ((correctionCount === 1) ? 1 : 2);
  if (rounds.length !== (boundedCorrectionCount + 1)) {
    throw new ArtifactParseError({
      path: `${path}.rounds`,
      reason: `${String(boundedCorrectionCount + 1,)} rounds for correction count`,
    },);
  }
  /**
   * Digest-bound correction transitions under generation-nine shape.
   */
  const corrections = correctionChainRequired
    ? requireArray({
      value: record.corrections,
      path: `${path}.corrections`,
    },)
      .map(function readCorrection(
        entry,
        at,
      ) {
        return parseNaturalnessCorrection({
          value: entry,
          path: `${path}.corrections[${String(at,)}]`,
        },);
      },)
    : [];
  if (correctionChainRequired && (corrections.length !== boundedCorrectionCount)) {
    throw new ArtifactParseError({
      path: `${path}.corrections`,
      reason: `${String(boundedCorrectionCount,)} digest-bound correction transitions`,
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
  /**
   * Reviews that each authorized one correction generation.
   */
  const priorRounds = rounds.slice(
    0,
    -1,
  );
  if (priorRounds.some(function nonRejection(round,): boolean {
    return round.verdict !== 'unacceptable';
  },)) {
    throw new ArtifactParseError({
      path: `${path}.rounds`,
      reason: 'unacceptable review before every correction',
    },);
  }
  assertNaturalnessCorrectionChain({
    corrections,
    rounds,
    path,
  },);
  if (final.verdict !== 'acceptable') {
    throw new ArtifactParseError({
      path: `${path}.rounds[${String(rounds.length - 1,)}].verdict`,
      reason: 'acceptable final absolute review',
    },);
  }
  /**
   * Path of final accepted exact-text review.
   */
  const finalPath = `${path}.rounds[${String(rounds.length - 1,)}]`;
  assertFinalNaturalnessDigests({
    final,
    finalText,
    path: finalPath,
    paragraphDigestsRequired: correctionChainRequired,
  },);
  return {
    correctionCount: boundedCorrectionCount,
    ...(correctionChainRequired ? { corrections, } : {}),
    rounds,
  };
}

//endregion Artifact absolute naturalness review read
