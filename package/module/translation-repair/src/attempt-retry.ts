import type { CriticAttemptRecord, } from './scorecard.ts';

//region Attempt retry policy
// The serving stack is transiently unreliable in two ways: it
// nondeterministically blows through its completion-token ceiling on
// identical input (observed runs land on 65_536 exactly), truncating output
// mid-thinking or mid-JSON, and under pack-count concurrency it sheds bursts
// as 5xx storms or hung streams. Both are weather, not request defects, so
// the benchmark grants exactly one second attempt; the trigger predicates
// live here so they stay testable in isolation.

/**
 * Completion-token ceiling that blowout runs land on exactly;
 * a schema mismatch reporting this many completion tokens is truncation
 * even when its detail text is unrecognized.
 */
export const COMPLETION_TOKEN_CEILING = 65_536;

/**
 * Detail fragments marking truncated output:
 * the client's own truncated-thinking diagnosis,
 * plus the JSON parser messages cut-off answers produce.
 */
const TRUNCATION_DETAIL_MARKERS: readonly string[] = [
  'truncated inside its thinking block',
  'Unexpected end of JSON input',
  'Unterminated string in JSON',
];

/**
 * Decides whether one graded attempt failed because the model's output was
 * cut off, as opposed to being well-formed garbage.
 * Only schema mismatches qualify:
 * refusals and HTTP failures have their own handling,
 * and retrying them here would double-spend quota for nothing.
 *
 * @param record - graded attempt under inspection
 *
 * @returns Whether the attempt deserves the single truncation retry
 *
 * @example
 * ```ts
 * if (isTruncatedAttempt({ record: first, },)) retryOnce();
 * ```
 */
export function isTruncatedAttempt(
  { record, }: { readonly record: CriticAttemptRecord; },
): boolean {
  if (record.outcomeKind !== 'schema-mismatch')
    return false;
  if (
    (record.completionTokens !== undefined)
    && (record.completionTokens >= COMPLETION_TOKEN_CEILING)
  ) {
    return true;
  }
  return TRUNCATION_DETAIL_MARKERS.some(function markerPresent(marker,) {
    return record
      .detail
      .includes(marker,);
  },);
}

/**
 * Decides whether one graded attempt deserves the benchmark's single
 * second attempt.
 * Two transient shapes qualify:
 * truncated output, and HTTP-failure records
 * (exhausted transient statuses, dropped transports, forfeited deadlines),
 * each already backed by the client's own transport-level retries.
 * Refusals reroute cross-family and well-formed-garbage mismatches are
 * model behavior the ensemble absorbs; retrying either buys nothing.
 *
 * @param record - graded attempt under inspection
 *
 * @returns Whether the attempt deserves the single second attempt
 *
 * @example
 * ```ts
 * if (isRetryableAttempt({ record: first, },)) retryOnce();
 * ```
 */
export function isRetryableAttempt(
  { record, }: { readonly record: CriticAttemptRecord; },
): boolean {
  if (record.outcomeKind === 'http-error')
    return true;
  return isTruncatedAttempt({ record, },);
}

//endregion Attempt retry policy
