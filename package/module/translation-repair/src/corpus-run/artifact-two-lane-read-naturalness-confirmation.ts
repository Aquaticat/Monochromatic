import {
  ArtifactParseError,
  requireArray,
} from '../artifact-guard.ts';
import type { ArtifactNaturalnessReviewRound, } from './artifact-two-lane-consolidate.ts';

//region Artifact naturalness confirmation read

/**
 * Parser for one exact candidate review round.
 *
 * @example
 * ```ts
 * const parser: RoundParser = ({ value, path, }) => parseRound({ value, path, });
 * ```
 */
type RoundParser = (input: {
  readonly value: unknown;
  readonly path: string;
}) => ArtifactNaturalnessReviewRound;

/**
 * Reads and binds optional acceptance confirmations added within schema nine.
 *
 * Absence remains readable for historical schema-nine artifacts.
 * Presence opts into repeated-acceptance invariant and must confirm final text.
 *
 * @param value - unknown confirmation array
 *
 * @param present - whether artifact explicitly carries confirmation key
 *
 * @param rounds - decisive candidate reviews in correction order
 *
 * @param path - artifact review path
 *
 * @param parseRound - exact schema-nine round parser
 *
 * @returns Earlier acceptable same-candidate reviews
 *
 * @example
 * ```ts
 * const confirmations = parseNaturalnessConfirmations({ value, present: true, rounds, path, parseRound, });
 * ```
 */
export function parseNaturalnessConfirmations(
  {
    value,
    present,
    rounds,
    path,
    parseRound,
  }: {
    readonly value: unknown;
    readonly present: boolean;
    readonly rounds: readonly ArtifactNaturalnessReviewRound[];
    readonly path: string;
    readonly parseRound: RoundParser;
  },
): readonly ArtifactNaturalnessReviewRound[] {
  if (!present)
    return [];

  /**
   * Earlier acceptable readings over exact decisive-round candidates.
   */
  const confirmations = requireArray({
    value,
    path: `${path}.confirmations`,
  },)
    .map(function readConfirmation(
      entry,
      at,
    ): ArtifactNaturalnessReviewRound {
      return parseRound({
        value: entry,
        path: `${path}.confirmations[${String(at,)}]`,
      },);
    },);
  if (confirmations.some(function rejectedConfirmation(round,): boolean {
    return round.verdict !== 'acceptable';
  },)) {
    throw new ArtifactParseError({
      path: `${path}.confirmations`,
      reason: 'acceptable earlier readings before decisive same-candidate review',
    },);
  }

  /**
   * Candidate identities carrying one earlier acceptable reading at most.
   */
  const confirmationDigests = confirmations.map(function digestOf(round,): string {
    return round.candidateDigest;
  },);
  if (new Set(confirmationDigests,).size !== confirmationDigests.length) {
    throw new ArtifactParseError({
      path: `${path}.confirmations`,
      reason: 'at most one acceptance confirmation per reviewed candidate',
    },);
  }
  /**
   * Decisive-round position corresponding to each confirmation.
   */
  const confirmedRoundIndexes = confirmations.map(function matchingRoundIndex(
    confirmation,
  ): number {
    return rounds.findIndex(function sameCandidate(round,): boolean {
      return (round.candidateDigest === confirmation.candidateDigest)
        && (round.candidateText === confirmation.candidateText)
        && (JSON.stringify(round.paragraphDigests,)
          === JSON.stringify(confirmation.paragraphDigests,));
    },);
  },);
  if (confirmedRoundIndexes.some(function unmatched(index,): boolean {
    return index < 0;
  },)) {
    throw new ArtifactParseError({
      path: `${path}.confirmations`,
      reason: 'exact candidate and paragraph identities of one decisive review round',
    },);
  }
  if (confirmedRoundIndexes.some(function outOfOrder(
    index,
    at,
  ): boolean {
    /**
     * Position before current confirmation.
     */
    const previousAt = at - 1;
    /**
     * Prior confirmation's decisive position when one exists.
     */
    const previousRead = confirmedRoundIndexes[previousAt];
    /**
     * Prior confirmation's position or before-first sentinel.
     */
    const previous = previousRead ?? (-1);
    return (at > 0) && (index <= previous);
  },)) {
    throw new ArtifactParseError({
      path: `${path}.confirmations`,
      reason: 'same candidate order as decisive review rounds',
    },);
  }
  if (confirmations.some(function differentRoster(
    confirmation,
    at,
  ): boolean {
    /**
     * Decisive same-candidate position when one exists.
     */
    const decisiveIndexRead = confirmedRoundIndexes[at];
    /**
     * Decisive position or unmatched sentinel.
     */
    const decisiveIndex = decisiveIndexRead ?? (-1);
    /**
     * Decisive same-candidate review established by identity check.
     */
    const decisive = rounds[decisiveIndex];
    if (decisive === undefined)
      return true;
    /**
     * Requested reviewer identities in stable roster order.
     */
    const confirmationRoster = confirmation
      .seats
      .map(function modelIdOf(seat,): string {
        return seat.modelId;
      },);
    /**
     * Decisive review's requested identities in same order.
     */
    const decisiveRoster = decisive
      .seats
      .map(function modelIdOf(seat,): string {
        return seat.modelId;
      },);
    return JSON.stringify(confirmationRoster,) !== JSON.stringify(decisiveRoster,);
  },)) {
    throw new ArtifactParseError({
      path: `${path}.confirmations`,
      reason: 'same requested reviewer roster as decisive review',
    },);
  }

  /**
   * Final decisive review that authorizes publication.
   */
  const final = rounds.at(-1,);
  if (final === undefined) {
    throw new ArtifactParseError({
      path: `${path}.confirmations`,
      reason: 'decisive final candidate review',
    },);
  }
  if (!confirmationDigests.includes(final.candidateDigest,)) {
    throw new ArtifactParseError({
      path: `${path}.confirmations`,
      reason: 'earlier acceptable reading of exact final candidate',
    },);
  }
  return confirmations;
}

//endregion Artifact naturalness confirmation read
