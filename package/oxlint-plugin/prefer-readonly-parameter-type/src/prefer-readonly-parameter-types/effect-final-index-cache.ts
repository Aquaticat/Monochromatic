/**
 * Process-local fixed-point effect index cache.
 *
 * @module
 */

import type { EffectSummaryIndex, } from './effect-summary-index.ts';

/**
 * Sentinel when process-local project index cannot be reused.
 */
export const FINAL_EFFECT_INDEX_CACHE_MISS: unique symbol = Symbol(
  'final effect index cache miss',
);

/**
 * Final index and source identities for one configured project.
 */
type CachedFinalEffectIndex = {
  readonly fileListDigest: string;
  readonly sourceSignatures: ReadonlyMap<string, string>;
  readonly index: EffectSummaryIndex;
};

/**
 * Final indexes bounded by configured projects seen in current process.
 */
const finalIndexByProject = new Map<string, CachedFinalEffectIndex>();

/**
 * Process-local fixed-point cache counters.
 */
const counters = {
  hitCount: 0,
  writeCount: 0,
};

/**
 * Fixed-point cache activity counts.
 */
export type FinalEffectIndexCacheStats = {
  readonly hitCount: number;
  readonly writeCount: number;
};

/**
 * Tests whether every project source signature remains unchanged.
 *
 * @param left - Cached source signatures.
 *
 * @param right - Current source signatures.
 *
 * @returns whether maps contain identical keys and values.
 */
function sourceSignaturesEqual({
  left,
  right,
}: {
  readonly left: ReadonlyMap<string, string>;
  readonly right: ReadonlyMap<string, string>;
}): boolean {
  if (left.size !== right.size)
    return false;
  for (const [fileName, signature,] of left) {
    if (right.get(fileName,) !== signature)
      return false;
  }
  return true;
}

/**
 * Reads final index when project membership and every source remain exact.
 *
 * @param projectKey - Configured TypeScript project identity.
 *
 * @param fileListDigest - Current sorted project-file identity.
 *
 * @param sourceSignatures - Current project source snapshot signatures.
 *
 * @returns reusable final index or miss sentinel.
 *
 * @example
 * ```ts
 * cachedFinalEffectIndex({ projectKey, fileListDigest, sourceSignatures });
 * ```
 */
export function cachedFinalEffectIndex({
  projectKey,
  fileListDigest,
  sourceSignatures,
}: {
  readonly projectKey: string;
  readonly fileListDigest: string;
  readonly sourceSignatures: ReadonlyMap<string, string>;
}): EffectSummaryIndex | typeof FINAL_EFFECT_INDEX_CACHE_MISS {
  /**
   * Prior fixed-point index for configured project.
   */
  const cached = finalIndexByProject.get(projectKey,);
  if ((cached === undefined)
    || (cached.fileListDigest !== fileListDigest)
    || (!sourceSignaturesEqual({
      left: cached.sourceSignatures,
      right: sourceSignatures,
    },)))
    return FINAL_EFFECT_INDEX_CACHE_MISS;
  counters.hitCount++;
  return cached.index;
}

/**
 * Stores final fixed-point index for one exact project snapshot.
 *
 * @param projectKey - Configured TypeScript project identity.
 *
 * @param fileListDigest - Sorted project-file identity.
 *
 * @param sourceSignatures - Current project source snapshot signatures.
 *
 * @param index - Immutable final summary lookup.
 *
 * @example
 * ```ts
 * cacheFinalEffectIndex({ projectKey, fileListDigest, sourceSignatures, index });
 * ```
 */
export function cacheFinalEffectIndex({
  projectKey,
  fileListDigest,
  sourceSignatures,
  index,
}: {
  readonly projectKey: string;
  readonly fileListDigest: string;
  readonly sourceSignatures: ReadonlyMap<string, string>;
  readonly index: EffectSummaryIndex;
}): void {
  finalIndexByProject.set(
    projectKey,
    {
      fileListDigest,
      sourceSignatures: new Map(sourceSignatures,),
      index,
    },
  );
  counters.writeCount++;
}

/**
 * Reads process-local final-index activity counts.
 *
 * @returns copied hit and write counters.
 *
 * @example
 * ```ts
 * finalEffectIndexCacheStats();
 * ```
 */
export function finalEffectIndexCacheStats(): FinalEffectIndexCacheStats {
  return { ...counters, };
}

/**
 * Clears process-local final indexes and counters for lifecycle tests.
 *
 * @example
 * ```ts
 * clearFinalEffectIndexCache();
 * ```
 */
export function clearFinalEffectIndexCache(): void {
  finalIndexByProject.clear();
  counters.hitCount = 0;
  counters.writeCount = 0;
}
