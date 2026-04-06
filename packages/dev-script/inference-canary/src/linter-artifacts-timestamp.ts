/**
 * Timestamp parsing and recency checking for artifact directory names.
 *
 * Artifact directories encode timestamps in a filesystem-safe slug format
 * (colons replaced with hyphens). This module reverses that encoding and
 * checks whether timestamps fall within a 24-hour recency window.
 */

/** Hours in a day */
const HOURS_PER_DAY = 24;

/** Minutes per hour */
const MINUTES_PER_HOUR = 60;

/** Seconds per minute */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second */
const MS_PER_SECOND = 1_000;

/** 24 hours in milliseconds */
export const TWENTY_FOUR_HOURS_MS: number = HOURS_PER_DAY
  * MINUTES_PER_HOUR
  * SECONDS_PER_MINUTE
  * MS_PER_SECOND;

/**
 * Result of scanning artifact directories for recent activity.
 * Contains both per-probe pairs and whole-model failures so the runner can
 * skip probes that were already attempted (successfully or not) within 24 hours.
 */
export type RecentArtifactScan = {
  /** Map from model label to set of recently-tested probe names */
  readonly probePairs: ReadonlyMap<string, ReadonlySet<string>>;
  /** Model labels that had a whole-model failure (e.g. 429, auth error) within 24 hours */
  readonly failedModels: ReadonlySet<string>;
};

/**
 * Regex to parse artifact directory names into (probe, pass, timestamp) components.
 * Matches: `<probe>-<pass>-<timestamp>` where pass is "initial" or "fix".
 * The timestamp has colons replaced with hyphens by `timestampSlug`.
 *
 * @example
 * ```ts
 * ARTIFACT_DIR_PATTERN.exec('csv-rfc4180-initial-2026-03-06T12-00-00.000Z');
 * // groups: { probe: 'csv-rfc4180', pass: 'initial', timestamp: '2026-03-06T12-00-00.000Z' }
 * ```
 */
export const ARTIFACT_DIR_PATTERN: RegExp =
  /^(?<probe>.+)-(?<pass>initial|fix)-(?<timestamp>\d{4}-.+)$/;

/**
 * Regex to parse failure artifact directory names into timestamp components.
 * Matches: `failure-<timestamp>` where the timestamp has colons replaced with hyphens.
 *
 * @example
 * ```ts
 * FAILURE_DIR_PATTERN.exec('failure-2026-03-06T12-00-00.000Z');
 * // groups: { timestamp: '2026-03-06T12-00-00.000Z' }
 * ```
 */
export const FAILURE_DIR_PATTERN: RegExp = /^failure-(?<timestamp>\d{4}-.+)$/;

/**
 * Restores an ISO timestamp from its filesystem-safe slug form.
 * Reverses the transformation done by `timestampSlug`: hyphens back to colons,
 * then fixes the date portion (year-MM-DD) which was incorrectly colonized.
 *
 * @param rawTimestamp - filesystem-safe timestamp slug (e.g. "2026-03-06T12-00-00.000Z")
 *
 * @returns ISO 8601 timestamp string, or undefined if parsing fails
 */
function restoreTimestamp(rawTimestamp: string,): string {
  const withColons = rawTimestamp
    .replaceAll(
      '-',
      ':',
    )
    .replace(
      'T:',
      'T',
    );
  // Fix the date part: year:MM:DD -> year-MM-DD (first two colons after year are date separators)
  return withColons.replace(
    /^(\d{4}):(\d{2}):(\d{2})/,
    '$1-$2-$3',
  );
}

/**
 * Checks whether a filesystem-safe timestamp slug falls within the recent cutoff.
 *
 * @param rawTimestamp - filesystem-safe timestamp slug
 *
 * @param cutoff - cutoff time in milliseconds since epoch
 *
 * @returns true if the timestamp is recent (after the cutoff)
 *
 * @example
 * ```ts
 * const cutoff = Date.now() - 86_400_000;
 * isRecentTimestamp('2026-03-06T12-00-00.000Z', cutoff);
 * ```
 */
export function isRecentTimestamp(
  rawTimestamp: string,
  cutoff: number,
): boolean {
  const fixed = restoreTimestamp(rawTimestamp,);
  const entryTime = new Date(fixed,).getTime();
  return !Number.isNaN(entryTime,) && entryTime >= cutoff;
}
