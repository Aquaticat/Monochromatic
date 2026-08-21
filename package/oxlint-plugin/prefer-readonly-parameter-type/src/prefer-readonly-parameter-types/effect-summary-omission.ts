/**
 * Direct effect-summary omission recording and visible lifecycle logging.
 *
 * @module
 */

import { caughtValueStack, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { EffectSummaryOmissionReason, } from './effect-cache-envelope.ts';

/**
 * Omission lifecycle logger.
 */
const l = tagged({ tag: 'effect-summary-omission', },);

/**
 * Records one fresh direct-summary omission without exposing stack noise at warning level.
 *
 * @param allOmittedKeys - Build-wide identities accepted by completeness checks.
 *
 * @param sourceOmittedKeys - Source-local identities persisted with direct summaries.
 *
 * @param key - Stable callable identity whose summary failed.
 *
 * @param error - Caught summary construction failure retained at debug level.
 *
 * @mutates allOmittedKeys - Adds omitted callable identity.
 *
 * @mutates sourceOmittedKeys - Adds omitted callable identity.
 *
 * @example
 * ```ts
 * recordDirectSummaryOmission({ allOmittedKeys, sourceOmittedKeys, key, error });
 * ```
 */
export function recordDirectSummaryOmission({
  allOmittedKeys,
  sourceOmittedKeys,
  key,
  error,
}: {
  readonly allOmittedKeys: Set<string>;
  readonly sourceOmittedKeys: Set<string>;
  readonly key: string;
  readonly error: unknown;
}): void {
  allOmittedKeys.add(key,);
  sourceOmittedKeys.add(key,);
  l.debug(`omitting ${key} from the effect index: ${caughtValueStack(error,)}`,);
}

/**
 * Emits one concise warning for fresh source-local omissions.
 *
 * @param omittedKeys - Source-local identities omitted during scan.
 *
 * @param sourceFileName - Exact source whose scan was incomplete.
 *
 * @example
 * ```ts
 * reportDirectSummaryOmissions({ omittedKeys, sourceFileName });
 * ```
 */
export function reportDirectSummaryOmissions({
  omittedKeys,
  sourceFileName,
}: {
  readonly omittedKeys: ReadonlySet<string>;
  readonly sourceFileName: string;
}): void {
  if (omittedKeys.size === 0)
    return;
  l.warn(
    `omitted ${String(omittedKeys.size,)} callable summaries for ${sourceFileName}: direct-summary-construction-failed; debug logging contains causes`,
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
 * @param reason - Validated bounded reason category restored from cache.
 *
 * @mutates allOmittedKeys - Adds every restored callable identity.
 *
 * @example
 * ```ts
 * restoreCachedSummaryOmissions({
 *   allOmittedKeys,
 *   restoredKeys,
 *   sourceFileName,
 *   reason,
 * });
 * ```
 */
export function restoreCachedSummaryOmissions({
  allOmittedKeys,
  restoredKeys,
  sourceFileName,
  reason,
}: {
  readonly allOmittedKeys: Set<string>;
  readonly restoredKeys: readonly string[];
  readonly sourceFileName: string;
  readonly reason: EffectSummaryOmissionReason;
}): void {
  restoredKeys.forEach(function restoreKey(key,): void {
    allOmittedKeys.add(key,);
  },);
  if (restoredKeys.length === 0)
    return;
  l.warn(
    `restored ${String(restoredKeys.length,)} omitted callable summaries for ${sourceFileName} from effect cache: ${reason}`,
  );
}
