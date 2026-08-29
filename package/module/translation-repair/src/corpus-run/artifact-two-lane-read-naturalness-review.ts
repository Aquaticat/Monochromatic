import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
} from '../artifact-guard.ts';
import type {
  ArtifactNaturalnessReview,
  ArtifactNaturalnessReviewRound,
} from './artifact-two-lane-consolidate.ts';
import { parseNaturalnessConfirmations, } from './artifact-two-lane-read-naturalness-confirmation.ts';
import {
  assertFinalNaturalnessDigests,
  assertNaturalnessCorrectionChain,
  parseNaturalnessCorrection,
} from './artifact-two-lane-read-naturalness-digest.ts';
import { parseNaturalnessReviewRound, } from './artifact-two-lane-read-naturalness-round.ts';

//region Artifact absolute naturalness review read

/**
 * Reads one schema-nine confirmation round.
 *
 * @param value - unknown confirmation round
 *
 * @param path - confirmation path
 *
 * @returns Exact candidate and paragraph-bound round
 *
 * @example
 * ```ts
 * const round = parseConfirmationRound({ value, path, });
 * ```
 */
function parseConfirmationRound(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactNaturalnessReviewRound {
  return parseNaturalnessReviewRound({
    value,
    path,
    paragraphDigestsRequired: true,
  },);
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
      ...(correctionChainRequired
        ? [
          'corrections',
          'confirmations',
        ]
        : []),
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
   * Decisive initial and post-correction reviews.
   */
  const rounds = requireArray({
    value: record.rounds,
    path: `${path}.rounds`,
  },)
    .map(function readRound(
      entry,
      at,
    ) {
      return parseNaturalnessReviewRound({
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
   * Whether artifact carries post-generation-nine acceptance confirmation.
   */
  const confirmationsPresent = correctionChainRequired && ('confirmations' in record);
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
   * Earlier acceptable readings bound to decisive reviewed candidates.
   */
  const confirmations = parseNaturalnessConfirmations({
    value: record.confirmations,
    present: confirmationsPresent,
    rounds,
    path,
    parseRound: parseConfirmationRound,
  },);
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
    ...(confirmationsPresent ? { confirmations, } : {}),
  };
}

//endregion Artifact absolute naturalness review read
