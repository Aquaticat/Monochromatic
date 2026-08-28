import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  ABSOLUTE_NATURALNESS_REVIEW_RESPONSE_FORMAT,
  type AbsoluteNaturalnessFinding,
  type AbsoluteNaturalnessReviewSubject,
  buildAbsoluteNaturalnessReviewMessages,
  isAbsoluteNaturalnessReviewWire,
} from './absolute-naturalness-review-wire.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import { runGatherRound, } from './stage-round.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Absolute naturalness review stage

/**
 * Usable voices required before absolute review can approve candidate.
 */
export const ABSOLUTE_NATURALNESS_REVIEW_QUORUM = 2;

/**
 * One roster seat as absolute review accounted for it.
 *
 * @example
 * ```ts
 * const seat: AbsoluteNaturalnessReviewSeat = { modelId: 'hf:zai-org/GLM-5.2', status: 'acceptable', findings: [], reason: 'ready' };
 * ```
 */
export type AbsoluteNaturalnessReviewSeat = {
  /**
   * Roster model asked.
   */
  readonly modelId: RosterModelId;

  /**
   * Usable verdict or named lack of usable reply.
   */
  readonly status: 'acceptable' | 'unacceptable' | 'unusable';

  /**
   * Actionable defects from rejecting usable voice.
   */
  readonly findings: readonly AbsoluteNaturalnessFinding[];

  /**
   * Usable voice explanation, empty for unusable seat.
   */
  readonly reason: string;
};

/**
 * Absolute review verdict derived from every accounted seat.
 */
export type AbsoluteNaturalnessReviewVerdict =
  | 'acceptable'
  | 'unacceptable'
  | 'quorum-not-met';

/**
 * Auditable absolute review of exact would-ship text.
 *
 * @example
 * ```ts
 * const review: AbsoluteNaturalnessReviewOutcome = { candidateDigest: 'sha256:abc', seats: [], usable: 0, verdict: 'quorum-not-met', findings: [] };
 * ```
 */
export type AbsoluteNaturalnessReviewOutcome = {
  /**
   * Digest binding review to exact candidate bytes.
   */
  readonly candidateDigest: string;

  /**
   * Every requested roster seat in request order.
   */
  readonly seats: readonly AbsoluteNaturalnessReviewSeat[];

  /**
   * Number of seats returning usable structured verdict.
   */
  readonly usable: number;

  /**
   * Fail-closed aggregate verdict.
   */
  readonly verdict: AbsoluteNaturalnessReviewVerdict;

  /**
   * Rejection findings in deterministic roster order without exact duplicates.
   */
  readonly findings: readonly AbsoluteNaturalnessFinding[];
};

/**
 * Removes exact duplicate located findings while preserving roster order.
 *
 * @param findings - model findings in roster order
 *
 * @returns First occurrence of each paragraph and problem pair
 *
 * @example
 * ```ts
 * uniqueFindings({ findings: [{ paragraph: 1, problem: 'stiff phrasing', }], });
 * ```
 */
function uniqueFindings(
  { findings, }: { readonly findings: readonly AbsoluteNaturalnessFinding[]; },
): readonly AbsoluteNaturalnessFinding[] {
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
 * Reviews exact would-ship body text against absolute publication naturalness.
 *
 * Every seat reaches usable response, malformed response, transport failure,
 * or per-call deadline before settlement. No early acceptable quorum can cut
 * off delayed rejection.
 *
 * @param client - provider client
 *
 * @param modelIds - every independent reviewer seat
 *
 * @param subject - source context and exact candidate
 *
 * @param signal - caller cancellation
 *
 * @param exchangeTimeoutMs - deadline accounting unavailable seat
 *
 * @param l - parent logger
 *
 * @returns Candidate-bound absolute verdict and every seat status
 *
 * @example
 * ```ts
 * const review = await reviewAbsoluteNaturalness({ client, modelIds, subject, signal, exchangeTimeoutMs, l, });
 * ```
 */
export async function reviewAbsoluteNaturalness(
  {
    client,
    modelIds,
    subject,
    signal,
    exchangeTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly subject: AbsoluteNaturalnessReviewSubject;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<AbsoluteNaturalnessReviewOutcome> {
  /**
   * Stage-specific logger.
   */
  const rl = tagged({
    l,
    tag: reviewAbsoluteNaturalness.name,
  },);
  /**
   * Every requested outcome after every seat has settled or reached deadline.
   */
  const outcomes = await runGatherRound({
    client,
    modelIds,
    messages: buildAbsoluteNaturalnessReviewMessages({ subject, },),
    signal,
    exchangeTimeoutMs,
    responseFormat: ABSOLUTE_NATURALNESS_REVIEW_RESPONSE_FORMAT,
    validate: isAbsoluteNaturalnessReviewWire,
    stage: 'absolute-naturalness-review',
    l: rl,
    heardNeeded: modelIds.length,
  },);
  /**
   * Stable seat records, including calls with no usable ballot.
   */
  const seats = outcomes.map(function toSeat(
    outcome,
  ): AbsoluteNaturalnessReviewSeat {
    /**
     * Usable or unavailable voice under requested model id.
     */
    const { voice, } = outcome;
    if (!voice.heard) {
      return {
        modelId: outcome.modelId,
        status: 'unusable',
        findings: [],
        reason: '',
      };
    }
    /**
     * Validated structured reviewer reply.
     */
    const reply = voice.value;
    return {
      modelId: outcome.modelId,
      status: reply.acceptable ? 'acceptable' : 'unacceptable',
      findings: reply.findings,
      reason: reply.reason,
    };
  },);
  /**
   * Seats carrying usable structured reply.
   */
  const usableSeats = seats.filter(function isUsable(seat,): boolean {
    return seat.status !== 'unusable';
  },);
  /**
   * Material rejection findings in roster order.
   */
  const findings = uniqueFindings({
    findings: usableSeats.flatMap(function rejected(
      seat,
    ): readonly AbsoluteNaturalnessFinding[] {
      return (seat.status === 'unacceptable') ? seat.findings : [];
    },),
  },);
  /**
   * Fail-closed verdict: thin review cannot approve, and any rejection blocks.
   */
  const verdict: AbsoluteNaturalnessReviewVerdict = (usableSeats.length
      < ABSOLUTE_NATURALNESS_REVIEW_QUORUM)
    ? 'quorum-not-met'
    : usableSeats.some(function rejected(seat,): boolean {
      return seat.status === 'unacceptable';
    },)
      ? 'unacceptable'
      : 'acceptable';
  rl.info(
    `absolute naturalness review: ${String(usableSeats.length,)}/${String(modelIds.length,)} usable, ${verdict}`,
  );
  return {
    candidateDigest: hashContent({ content: subject.candidateText, },),
    seats,
    usable: usableSeats.length,
    verdict,
    findings,
  };
}

//endregion Absolute naturalness review stage
