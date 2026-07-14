/**
 * Process-local fixed-point effect index cache.
 *
 * @module
 */

import type { EffectSummaryIndex, } from './effect-summaries.ts';

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
  readonly sourceDigests: ReadonlyMap<string, string>;
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
 * Reads final index when project membership and active source remain exact.
 *
 * @param projectKey - Configured TypeScript project identity.
 *
 * @param fileListDigest - Current sorted project-file identity.
 *
 * @param activeFileName - Current Oxlint source path.
 *
 * @param activeSourceDigest - Current source-text identity.
 *
 * @returns reusable final index or miss sentinel.
 *
 * @example
 * ```ts
 * cachedFinalEffectIndex({ projectKey, fileListDigest, activeFileName, activeSourceDigest });
 * ```
 */
export function cachedFinalEffectIndex({
  projectKey,
  fileListDigest,
  activeFileName,
  activeSourceDigest,
}: {
  readonly projectKey: string;
  readonly fileListDigest: string;
  readonly activeFileName: string;
  readonly activeSourceDigest: string;
}): EffectSummaryIndex | typeof FINAL_EFFECT_INDEX_CACHE_MISS {
  /**
   * Prior fixed-point index for configured project.
   */
  const cached = finalIndexByProject.get(projectKey,);
  if ((cached === undefined)
    || (cached.fileListDigest !== fileListDigest)
    || (cached.sourceDigests
      .get(activeFileName,)
      !== activeSourceDigest))
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
 * @param sourceDigests - Exact source identities from full fingerprint.
 *
 * @param index - Immutable final summary lookup.
 *
 * @example
 * ```ts
 * cacheFinalEffectIndex({ projectKey, fileListDigest, sourceDigests, index });
 * ```
 */
export function cacheFinalEffectIndex({
  projectKey,
  fileListDigest,
  sourceDigests,
  index,
}: {
  readonly projectKey: string;
  readonly fileListDigest: string;
  readonly sourceDigests: ReadonlyMap<string, string>;
  readonly index: EffectSummaryIndex;
}): void {
  finalIndexByProject.set(
    projectKey,
    {
      fileListDigest,
      sourceDigests: new Map(sourceDigests,),
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
