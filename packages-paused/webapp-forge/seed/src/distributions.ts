/**
 * Long-tail distributions for synthetic forge data.
 *
 * Models the real-world skew of GitHub repos: most have a handful of
 * issues, the long tail goes into the thousands. P50 ~10, P95 ~200,
 * P99 ~5000, tail ~50000.
 */

import { rng, } from './rng.ts';

/**
 * Cumulative thresholds that split the distribution into buckets.
 */
const P50_THRESHOLD = 0.5;

/**
 * 95th percentile threshold.
 */
const P95_THRESHOLD = 0.95;

/**
 * 99th percentile threshold.
 */
const P99_THRESHOLD = 0.99;

/**
 * Lower bound (count) for the P50 bucket of issue counts.
 */
const ISSUES_P50_BASE = 1;

/**
 * Range size (count) for the P50 bucket.
 */
const ISSUES_P50_RANGE = 30;

/**
 * Lower bound for the P95 bucket.
 */
const ISSUES_P95_BASE = 30;

/**
 * Range size for the P95 bucket.
 */
const ISSUES_P95_RANGE = 200;

/**
 * Lower bound for the P99 bucket.
 */
const ISSUES_P99_BASE = 200;

/**
 * Range size for the P99 bucket.
 */
const ISSUES_P99_RANGE = 4_800;

/**
 * Lower bound for the tail bucket.
 */
const ISSUES_TAIL_BASE = 5_000;

/**
 * Range size for the tail bucket.
 */
const ISSUES_TAIL_RANGE = 45_000;

/**
 * Lower bound (count) for the P50 bucket of comment counts.
 */
const COMMENTS_P50_BASE = 0;

/**
 * Range size for the P50 comment bucket.
 */
const COMMENTS_P50_RANGE = 4;

/**
 * Lower bound for the P95 comment bucket.
 */
const COMMENTS_P95_BASE = 4;

/**
 * Range size for the P95 comment bucket.
 */
const COMMENTS_P95_RANGE = 30;

/**
 * Lower bound for the P99 comment bucket.
 */
const COMMENTS_P99_BASE = 30;

/**
 * Range size for the P99 comment bucket.
 */
const COMMENTS_P99_RANGE = 200;

/**
 * Lower bound for the tail comment bucket.
 */
const COMMENTS_TAIL_BASE = 200;

/**
 * Range size for the tail comment bucket.
 */
const COMMENTS_TAIL_RANGE = 1_000;

/**
 * Samples an issue count for a single repo, drawn from the long-tail
 * distribution.
 *
 * @param seed - rng seed for the sample
 *
 * @returns issue count
 *
 * @example
 * ```ts
 * const count = sampleIssueCount(42);
 * ```
 */
export function sampleIssueCount(seed: number,): number {
  /**
   * Bucket-selector draw in [0, 1) compared against the cumulative percentile thresholds.
   */
  const r = rng(seed,);
  if (r < P50_THRESHOLD)
    return ISSUES_P50_BASE + Math
      .floor(rng(seed + 1,)
        * ISSUES_P50_RANGE,);
  if (r < P95_THRESHOLD)
    return ISSUES_P95_BASE + Math
      .floor(rng(seed + 1,)
        * ISSUES_P95_RANGE,);
  if (r < P99_THRESHOLD)
    return ISSUES_P99_BASE + Math
      .floor(rng(seed + 1,)
        * ISSUES_P99_RANGE,);
  return ISSUES_TAIL_BASE + Math
    .floor(rng(seed + 1,)
      * ISSUES_TAIL_RANGE,);
}

/**
 * Samples a comment count for a single issue.
 *
 * Same shape as issues but smaller; most issues have 0-3 comments.
 *
 * @param seed - rng seed for the sample
 *
 * @returns comment count
 *
 * @example
 * ```ts
 * const count = sampleCommentCount(42);
 * ```
 */
export function sampleCommentCount(seed: number,): number {
  /**
   * Bucket-selector draw in [0, 1) compared against the cumulative percentile thresholds.
   */
  const r = rng(seed,);
  if (r < P50_THRESHOLD)
    return COMMENTS_P50_BASE + Math
      .floor(rng(seed + 1,)
        * COMMENTS_P50_RANGE,);
  if (r < P95_THRESHOLD)
    return COMMENTS_P95_BASE + Math
      .floor(rng(seed + 1,)
        * COMMENTS_P95_RANGE,);
  if (r < P99_THRESHOLD)
    return COMMENTS_P99_BASE + Math
      .floor(rng(seed + 1,)
        * COMMENTS_P99_RANGE,);
  return COMMENTS_TAIL_BASE + Math
    .floor(rng(seed + 1,)
      * COMMENTS_TAIL_RANGE,);
}
