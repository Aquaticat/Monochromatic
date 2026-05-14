// Not extracted to the types tree: the consensus API is shaped around
// BackendResult with string values and numeric priority tiers (store
// vocabulary). The concept (majority vote over prioritized sources) is general,
// but generalizing the API without a second consumer would be speculative.

/**
 * Internal result record for Store.get aggregation.
 * Generic over backend type so both sync and async stores can reuse consensus logic.
 *
 * @typeParam TBackend - storage backend type (sync or async)
 *
 * @example
 * ```ts
 * const result: BackendResult<Map<string, string>> = {
 *   value: '{"json":42}',
 *   priority: 1,
 *   backend: new Map(),
 * };
 * ```
 */
export type BackendResult<TBackend = unknown,> = {
  /** Serialized value returned by a backend, or undefined if missing. */
  value: string | undefined;
  /** Backend priority (higher value means higher tier). */
  priority: number;
  /** Backend instance that produced the value. */
  backend: TBackend;
};

/**
 * Pick the majority bucket by size from a grouping map.
 *
 * @param buckets - map from serialized value to result records
 *
 * @param totalCount - total number of results for majority threshold
 *
 * @returns majority presence flag and the candidate serialized value
 *
 * @example
 * ```ts
 * const buckets = Map.groupBy(results, (r) => r.value);
 * const { hasMajority, value } = pickMajority(buckets, results.length);
 * ```
 */
export function pickMajority<TBackend = unknown,>(
  buckets: Map<string | undefined, BackendResult<TBackend>[]>,
  totalCount: number,
): {
  hasMajority: boolean;
  value?: string | undefined;
} {
  /** Leader candidate and its bucket after sorting by descending bucket size. */
  const sorted = [...buckets.entries(),]
    .toSorted(function byDescCount(
      [, bucketA,],
      [, bucketB,],
    ) {
      return bucketB.length - bucketA.length;
    },);

  /** Top entry from sorted buckets; falls back to empty bucket so majority check stays well-defined when no results exist. */
  const [leaderKey, leaderBucket,] = sorted.at(0,)
    ?? [
      undefined,
      [] as BackendResult<TBackend>[],
    ];

  return {
    hasMajority: leaderBucket.length > Math.floor(totalCount / 2,),
    value: leaderKey,
  };
}

/**
 * Compute canonical serialized value from highest tier only.
 * Throws when there is no majority within the highest tier.
 *
 * @param groupedHighest - buckets of highest tier results by value
 *
 * @param highestResults - array of highest priority tier results
 *
 * @param key - key for error context
 *
 * @returns canonical serialized value (can be undefined)
 *
 * @throws Error when no majority in highest tier
 *
 * @example
 * ```ts
 * const canonical = computeFromHighestTier(grouped, highest, 'my-key');
 * ```
 */
export function computeFromHighestTier<TBackend = unknown,>(
  groupedHighest: Map<string | undefined, BackendResult<TBackend>[]>,
  highestResults: readonly BackendResult<TBackend>[],
  key: string,
): string | undefined {
  /** Majority pick restricted to the highest priority tier; throws below when no clear winner exists. */
  const highestTier = pickMajority(
    groupedHighest,
    highestResults.length,
  );
  if (!highestTier.hasMajority) {
    throw new Error(
      `(maybe sync) Store.get consensus failure for key "${key}" -- no majority in highest tier`,
    );
  }
  return highestTier.value;
}

/**
 * Compute canonical serialized value across all tiers with fallback to highest tier.
 *
 * @param results - all tier results
 *
 * @param groupedHighest - buckets for highest tier only
 *
 * @param highestResults - highest tier array
 *
 * @param key - key for error context
 *
 * @returns canonical serialized value (can be undefined)
 *
 * @example
 * ```ts
 * const canonical = computeCanonical(allResults, groupedHighest, highestResults, 'key');
 * ```
 */
export function computeCanonical<TBackend = unknown,>(
  results: readonly BackendResult<TBackend>[],
  groupedHighest: Map<string | undefined, BackendResult<TBackend>[]>,
  highestResults: readonly BackendResult<TBackend>[],
  key: string,
): string | undefined {
  /** Cross-tier grouping by serialized value so a strong overall majority can short-circuit tier-aware fallback. */
  const groupedAll = Map.groupBy(
    results,
    function byValue({ value, },) {
      return value;
    },
  );

  /** Cross-tier majority pick; consulted before falling back to highest-tier-only resolution. */
  const overall = pickMajority(
    groupedAll,
    results.length,
  );

  return overall.hasMajority
    ? overall.value
    : computeFromHighestTier(
      groupedHighest,
      highestResults,
      key,
    );
}

/**
 * Resolve canonical value from backend results via consensus.
 *
 * Groups results by priority tier, picks the highest tier, then delegates
 * to {@link computeCanonical} for majority-based resolution.
 *
 * @typeParam TBackend - storage backend type
 *
 * @param results - backend query results (at least one)
 *
 * @param key - lookup key for error messages
 *
 * @returns canonical serialized value or `undefined`
 *
 * @throws Error when no backend results exist for the key
 *
 * @example
 * ```ts
 * const canonical = resolveConsensus(results, 'my-key');
 * ```
 */
export function resolveConsensus<TBackend = unknown,>(
  results: readonly [
    BackendResult<TBackend>,
    ...BackendResult<TBackend>[],
  ],
  key: string,
): string | undefined {
  /** Results grouped by priority tier so the highest-priority cohort can be isolated for consensus. */
  const grouped = Map.groupBy(
    results,
    function byPriority({ priority, },) {
      return priority;
    },
  );

  /** Tier cohorts ordered ascending by priority so `.at(-1)` yields the highest-priority cohort. */
  const sortedTiers = [...grouped.entries(),]
    .toSorted(function byAscPriority(
      [priorityA,],
      [priorityB,],
    ) {
      return priorityA - priorityB;
    },)
    .map(function extractResults([, tierResults,],) {
      return tierResults;
    },);

  /** Last entry in `sortedTiers`; the highest-priority cohort that gates consensus when cross-tier majority fails. */
  const highestResults = sortedTiers.at(-1,);
  if (highestResults === undefined || highestResults.length === 0)
    throw new Error(`(maybe sync) Store.get: no backend results for key "${key}"`,);

  /** Highest-tier results regrouped by serialized value, ready for majority resolution. */
  const groupedHighest = Map.groupBy(
    highestResults,
    function byValue({ value, },) {
      return value;
    },
  );

  return computeCanonical(
    results,
    groupedHighest,
    highestResults,
    key,
  );
}
