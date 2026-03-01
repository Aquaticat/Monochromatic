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
 * @param totalCount - total number of results for majority threshold
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
): { hasMajority: boolean; value?: string | undefined; } {
  /** Leader candidate and its bucket after sorting by descending bucket size. */
  const sorted = Array
    .from(buckets.entries(),)
    .toSorted(function byDescCount(
      [, bucketA,],
      [, bucketB,],
    ) {
      return bucketB.length - bucketA.length;
    },);

  const [leaderKey, leaderBucket,] = sorted.at(0,) ?? [undefined, [] as BackendResult<TBackend>[],];

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
 * @param highestResults - array of highest priority tier results
 * @param key - key for error context
 * @returns canonical serialized value (can be undefined)
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
  const highestTier = pickMajority(groupedHighest, highestResults.length,);
  if (!highestTier.hasMajority) {
    throw new Error(
      `Store.get consensus failure for key "${key}" -- no majority in highest tier`,
    );
  }
  return highestTier.value;
}

/**
 * Compute canonical serialized value across all tiers with fallback to highest tier.
 *
 * @param results - all tier results
 * @param groupedHighest - buckets for highest tier only
 * @param highestResults - highest tier array
 * @param key - key for error context
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
  const groupedAll = Map.groupBy(results, function byValue({ value, },) {
    return value;
  },);

  const overall = pickMajority(groupedAll, results.length,);

  return overall.hasMajority
    ? overall.value
    : computeFromHighestTier(groupedHighest, highestResults, key,);
}

/**
 * Heal async backends to the canonical serialized value by deleting or setting mismatches.
 *
 * @param results - all backend results
 * @param canonicalSerialized - canonical serialized value (or undefined)
 * @param key - key to heal
 *
 * @example
 * ```ts
 * await healBackends(results, '"correct-value"', 'my-key');
 * ```
 */
export async function healBackends(
  results: readonly BackendResult<{ set: (key: string, value: string,) => unknown; delete: (key: string,) => unknown; }>[],
  canonicalSerialized: string | undefined,
  key: string,
): Promise<void> {
  await Promise.all(
    results.map(async function heal({ value, backend, },) {
      if (canonicalSerialized === undefined) {
        if (value !== undefined) {
          await backend.delete(key,);
        }
        return;
      }

      if (value !== canonicalSerialized) {
        await backend.set(key, canonicalSerialized,);
      }
    },),
  );
}

/**
 * Heal sync backends to the canonical serialized value by deleting or setting mismatches.
 *
 * @param results - all backend results
 * @param canonicalSerialized - canonical serialized value (or undefined)
 * @param key - key to heal
 *
 * @example
 * ```ts
 * healBackendsSync(results, '"correct-value"', 'my-key');
 * ```
 */
export function healBackendsSync(
  results: readonly BackendResult<{ set: (key: string, value: string,) => unknown; delete: (key: string,) => unknown; }>[],
  canonicalSerialized: string | undefined,
  key: string,
): void {
  for (const { value, backend, } of results) {
    if (canonicalSerialized === undefined) {
      if (value !== undefined) {
        backend.delete(key,);
      }
      continue;
    }

    if (value !== canonicalSerialized) {
      backend.set(key, canonicalSerialized,);
    }
  }
}
