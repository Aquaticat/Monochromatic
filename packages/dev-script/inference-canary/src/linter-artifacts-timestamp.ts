/**
 * Timestamp parsing and recency checking for artifact directory names.
 *
 * Artifact directories encode timestamps in a filesystem-safe slug format
 * (colons replaced with hyphens). This module reverses that encoding and
 * checks whether timestamps fall within a 24-hour recency window.
 */

import { MS_PER_DAY, } from '@monochromatic-dev/module-numeric-const';

/** 24 hours in milliseconds */
export const TWENTY_FOUR_HOURS_MS: number = MS_PER_DAY;

//region Date-format constants

/** Number of digits in the year portion (`YYYY`). */
const YEAR_DIGITS = 4;
/** Position of the separator char immediately after the year. */
const YEAR_END = YEAR_DIGITS;
/** Minimum slug length: year digits + 1-char separator. */
const YEAR_HYPHEN_PREFIX_LENGTH = YEAR_DIGITS + 1;
/** Position of the first month digit. */
const MONTH_START = YEAR_HYPHEN_PREFIX_LENGTH;
/** Position of the separator char immediately after the month (`YYYY:MM` is 7 chars). */
const MONTH_END = 7;
/** Position of the first day digit. */
const DAY_START = 8;
/** Position immediately after the day digits (`YYYY:MM:DD` is 10 chars). */
const DAY_END = 10;

//endregion Date-format constants

//region Year-hyphen prefix predicate

/**
 * Tests whether `s` starts with four ASCII digits followed by `-`,
 * matching the `\d{4}-` shape every timestamp slug shares.
 *
 * @param s - candidate slug
 *
 * @returns whether the slug satisfies the year-prefix shape
 *
 * @example
 * ```ts
 * hasYearHyphenPrefix('2026-03-06T12-00-00.000Z'); // true
 * hasYearHyphenPrefix('not-a-year');               // false
 * ```
 */
function hasYearHyphenPrefix(s: string,): boolean {
  if (s.length < YEAR_HYPHEN_PREFIX_LENGTH)
    return false;
  /**
   * Walks the year digits, returning whether the slug ends them with `-`.
   *
   * @param idx - cursor into `s`
   *
   * @returns whether the first `YEAR_DIGITS` chars are digits and `s[YEAR_END]` is `-`
   */
  function checkDigits(idx: number,): boolean {
    if (idx >= YEAR_DIGITS)
      return s.charAt(YEAR_END,) === '-';
    /** Char at the cursor; only ASCII digits advance the scan. */
    const c = s.charAt(idx,);
    if ((c < '0') || (c > '9'))
      return false;
    return checkDigits(idx + 1,);
  }
  return checkDigits(0,);
}

//endregion Year-hyphen prefix predicate

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
 * Parsed components of an artifact directory name; `null` when the
 * directory name does not follow the `probe-pass-timestamp` convention.
 */
export type ArtifactDirParts = {
  /** Probe name (everything up to the pass marker). */
  probe: string;
  /** Pass marker, one of `'initial'` or `'fix'`. */
  pass: 'initial' | 'fix';
  /** Filesystem-safe timestamp slug starting with a four-digit year. */
  timestamp: string;
};

/**
 * Parses an artifact directory name into its `probe`, `pass`, and
 * `timestamp` components.
 *
 * Mirrors `/^(?<probe>.+)-(?<pass>initial|fix)-(?<timestamp>\d{4}-.+)$/`
 * with a linear search: locate the rightmost `-initial-` or `-fix-`
 * boundary whose tail starts with four digits and a `-`, then carve
 * the three substrings. Returns `null` when no boundary qualifies.
 *
 * @param name - directory basename
 *
 * @returns parsed components or `null`
 *
 * @example
 * ```ts
 * parseArtifactDir('csv-rfc4180-initial-2026-03-06T12-00-00.000Z');
 * // { probe: 'csv-rfc4180', pass: 'initial', timestamp: '2026-03-06T12-00-00.000Z' }
 * ```
 */
export function parseArtifactDir(name: string,): ArtifactDirParts | null {
  /**
   * Searches `name` for `-<pass>-` followed by a timestamp slug.
   *
   * @param marker - one of `-initial-` or `-fix-`
   *
   * @returns matching parts, or `null` when the marker does not yield a timestamp
   */
  function tryMarker(marker: '-initial-' | '-fix-',): ArtifactDirParts | null {
    /**
     * Recursive walker that tests every occurrence of `marker` in `name`
     * (right-to-left) so the longest valid probe prefix wins; matches
     * the original regex's greedy `.+` capture for the probe field.
     *
     * @param from - search end index (`lastIndexOf` stops at or before this)
     *
     * @returns matching parts, or `null` when no occurrence yields a timestamp
     */
    function scan(from: number,): ArtifactDirParts | null {
      /** Right-most occurrence of `marker` at or before `from`; `-1` ends the search. */
      const idx = name.lastIndexOf(
        marker,
        from,
      );
      if (idx <= 0)
        return null;
      /** Slug after the marker; must satisfy the year-prefix shape to count. */
      const tail = name.slice(idx + marker.length,);
      if (!hasYearHyphenPrefix(tail,))
        return scan(idx - 1,);
      return {
        probe: name.slice(
          0,
          idx,
        ),
        pass: marker === '-initial-' ? 'initial' : 'fix',
        timestamp: tail,
      };
    }
    return scan(name.length,);
  }
  return tryMarker('-initial-',) ?? tryMarker('-fix-',);
}

/**
 * Parses a failure-artifact directory name into its `timestamp`
 * component.
 *
 * Mirrors `/^failure-(?<timestamp>\d{4}-.+)$/` with a linear check:
 * requires the `failure-` prefix and a four-digit-year-anchored tail.
 *
 * @param name - directory basename
 *
 * @returns timestamp slug or `null`
 *
 * @example
 * ```ts
 * parseFailureDir('failure-2026-03-06T12-00-00.000Z');
 * // { timestamp: '2026-03-06T12-00-00.000Z' }
 * ```
 */
export function parseFailureDir(name: string,): { timestamp: string; } | null {
  /** Literal prefix consumed before the timestamp slug. */
  const PREFIX = 'failure-';
  if (!name.startsWith(PREFIX,))
    return null;
  /** Slug after the prefix; must start with four digits and a hyphen. */
  const tail = name.slice(PREFIX.length,);
  if (!hasYearHyphenPrefix(tail,))
    return null;
  return { timestamp: tail, };
}

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
  /** Slug with hyphens swapped back to colons; the date portion is fixed up to hyphens by the return expression. */
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
  return rewriteDateColons(withColons,);
}

/**
 * Replaces the two colons in a `YYYY:MM:DD` prefix with hyphens to restore
 * the ISO date shape. Mirrors `s.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')`
 * with explicit index checks; returns `s` unchanged when the prefix does
 * not match.
 *
 * @param s - candidate timestamp string
 *
 * @returns `s` with the leading date colons replaced, or `s` verbatim
 */
function rewriteDateColons(s: string,): string {
  if (s.length < 'YYYY:MM:DD'.length)
    return s;
  /**
   * Returns true when chars `[start, start + count)` are all ASCII digits.
   *
   * @param start - inclusive start index
   *
   * @param count - number of chars to check
   *
   * @returns whether the substring is purely numeric
   */
  function isDigitRun({
    start,
    count,
  }: {
    start: number;
    count: number;
  },): boolean {
    /**
     * Recursive walker.
     *
     * @param offset - relative offset into the candidate run
     *
     * @returns whether each char is an ASCII digit
     */
    function step(offset: number,): boolean {
      if (offset >= count)
        return true;
      /** Char at the absolute index. */
      const c = s.charAt(start + offset,);
      if ((c < '0') || (c > '9'))
        return false;
      return step(offset + 1,);
    }
    return step(0,);
  }
  if (
    (!isDigitRun({
      start: 0,
      count: YEAR_DIGITS,
    },))
    || (s.charAt(YEAR_END,) !== ':')
    || (!isDigitRun({
      start: MONTH_START,
      count: 2,
    },))
    || (s.charAt(MONTH_END,) !== ':')
    || (!isDigitRun({
      start: DAY_START,
      count: 2,
    },))
  ) {
    return s;
  }
  return `${s.slice(
    0,
    YEAR_END,
  )}-${s.slice(
    MONTH_START,
    MONTH_END,
  )}-${s.slice(
    DAY_START,
    DAY_END,
  )}${s.slice(DAY_END,)}`;
}

/**
 * Options for {@link isRecentTimestamp}.
 *
 * @example
 * ```ts
 * const opts: IsRecentTimestampOptions = {
 *   rawTimestamp: '2026-03-06T12-00-00.000Z',
 *   cutoff: Date.now() - 86_400_000,
 * };
 * ```
 */
type IsRecentTimestampOptions = {
  /** Filesystem-safe timestamp slug */
  readonly rawTimestamp: string;
  /** Cutoff time in milliseconds since epoch */
  readonly cutoff: number;
};

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
 * isRecentTimestamp({ rawTimestamp: '2026-03-06T12-00-00.000Z', cutoff });
 * ```
 */
export function isRecentTimestamp({
  rawTimestamp,
  cutoff,
}: IsRecentTimestampOptions,): boolean {
  /** Restored ISO 8601 timestamp; parsed by `Date` below for the cutoff comparison. */
  const fixed = restoreTimestamp(rawTimestamp,);
  /** Epoch milliseconds for the artifact's timestamp; NaN when the slug failed to parse. */
  const entryTime = new Date(fixed,).getTime();
  return (!Number.isNaN(entryTime,)) && (entryTime >= cutoff);
}
