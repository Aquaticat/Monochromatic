/**
 * Direct effect-summary omission recording and visible lifecycle logging.
 *
 * @module
 */

import { caughtValueStack, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  DIRECT_SUMMARY_FAILURE_REASON,
  type EffectSummaryOmissionReason,
  TYPESCRIPT_TUPLE_SERIALIZATION_FAILURE_REASON,
} from './effect-cache-envelope.ts';

/**
 * Omission lifecycle logger.
 */
const l = tagged({ tag: 'effect-summary-omission', },);

/**
 * Stable fragment identifying known TypeScript instantiated-tuple serializer panic.
 */
const TYPESCRIPT_TUPLE_PANIC_FRAGMENT = 'checker.TypeData is *checker.TypeReference, not *checker.TupleType';

/**
 * Classifies caught summary failure into bounded persisted category.
 *
 * @param detail - Caught failure stack retained at debug level.
 *
 * @returns known tuple panic or general direct-summary failure category.
 */
function omissionReason(detail: string,): EffectSummaryOmissionReason {
  return detail.includes(TYPESCRIPT_TUPLE_PANIC_FRAGMENT,)
    ? TYPESCRIPT_TUPLE_SERIALIZATION_FAILURE_REASON
    : DIRECT_SUMMARY_FAILURE_REASON;
}

/**
 * Records one fresh direct-summary omission without exposing stack noise at warning level.
 *
 * @param allOmittedKeys - Build-wide identities accepted by completeness checks.
 *
 * @param sourceOmittedKeys - Source-local identities persisted with direct summaries.
 *
 * @param sourceOmissionReasons - Source-local bounded failure categories.
 *
 * @param key - Stable callable identity whose summary failed.
 *
 * @param error - Caught summary construction failure retained at debug level.
 *
 * @mutates allOmittedKeys - Adds omitted callable identity.
 *
 * @mutates sourceOmittedKeys - Adds omitted callable identity.
 *
 * @mutates sourceOmissionReasons - Adds bounded caught failure category.
 *
 * @example
 * ```ts
 * recordDirectSummaryOmission({
 *   allOmittedKeys,
 *   sourceOmittedKeys,
 *   sourceOmissionReasons,
 *   key,
 *   error,
 * });
 * ```
 */
export function recordDirectSummaryOmission({
  allOmittedKeys,
  sourceOmittedKeys,
  sourceOmissionReasons,
  key,
  error,
}: {
  readonly allOmittedKeys: Set<string>;
  readonly sourceOmittedKeys: Set<string>;
  readonly sourceOmissionReasons: Set<EffectSummaryOmissionReason>;
  readonly key: string;
  readonly error: unknown;
}): void {
  /**
   * Complete caught detail used for debug log and bounded category.
   */
  const detail = caughtValueStack(error,);
  allOmittedKeys.add(key,);
  sourceOmittedKeys.add(key,);
  sourceOmissionReasons.add(omissionReason(detail,),);
  l.debug(`omitting ${key} from the effect index: ${detail}`,);
}

/**
 * Emits one concise warning for fresh source-local omissions.
 *
 * @param omittedKeys - Source-local identities omitted during scan.
 *
 * @param sourceFileName - Exact source whose scan was incomplete.
 *
 * @param reasons - Bounded failure categories encountered during scan.
 *
 * @example
 * ```ts
 * reportDirectSummaryOmissions({ omittedKeys, sourceFileName, reasons });
 * ```
 */
export function reportDirectSummaryOmissions({
  omittedKeys,
  sourceFileName,
  reasons,
}: {
  readonly omittedKeys: ReadonlySet<string>;
  readonly sourceFileName: string;
  readonly reasons: ReadonlySet<EffectSummaryOmissionReason>;
}): void {
  if (omittedKeys.size === 0)
    return;
  /**
   * Deterministic comma-separated reason categories for one-line warning.
   */
  const renderedReasons = [...reasons,]
    .toSorted()
    .join(',',);
  l.warn(
    `omitted ${String(omittedKeys.size,)} callable summaries for ${sourceFileName}: ${renderedReasons}; debug logging contains causes`,
  );
}

/**
 * Restores cached omission identities and emits one concise warning.
 *
 * @param allOmittedKeys - Build-wide identities accepted by completeness checks.
 *
 * @param restoredKeys - Validated source-local identities restored from cache.
 *
 * @param sourceFileName - Exact source whose cached scan was incomplete.
 *
 * @param reasons - Validated bounded reason categories restored from cache.
 *
 * @mutates allOmittedKeys - Adds every restored callable identity.
 *
 * @example
 * ```ts
 * restoreCachedSummaryOmissions({
 *   allOmittedKeys,
 *   restoredKeys,
 *   sourceFileName,
 *   reasons,
 * });
 * ```
 */
export function restoreCachedSummaryOmissions({
  allOmittedKeys,
  restoredKeys,
  sourceFileName,
  reasons,
}: {
  readonly allOmittedKeys: Set<string>;
  readonly restoredKeys: readonly string[];
  readonly sourceFileName: string;
  readonly reasons: readonly EffectSummaryOmissionReason[];
}): void {
  restoredKeys.forEach(function restoreKey(key,): void {
    allOmittedKeys.add(key,);
  },);
  if (restoredKeys.length === 0)
    return;
  l.warn(
    `restored ${String(restoredKeys.length,)} omitted callable summaries for ${sourceFileName} from effect cache: ${reasons.join(',')}`,
  );
}
