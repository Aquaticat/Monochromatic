/**
 * Process-bounded direct effect-summary cache.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed';

import type { MutableEffectSummary, } from './effect-summary-model.ts';

/**
 * Scanner producing direct summaries for one source.
 */
type DirectSummaryFactory = () => ReadonlyMap<string, MutableEffectSummary>;

/**
 * Cached direct summaries for one exact source text.
 */
type CachedSourceSummaries = {
  readonly sourceText: string;
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
};

/**
 * Direct summary cache keyed by configured project and source path.
 */
const summariesByProject = new Map<string, Map<string, CachedSourceSummaries>>();

/**
 * Mutable counters used by deterministic cache regression tests.
 */
const counters = {
  directSummaryBuildCount: 0,
  sourceCacheHitCount: 0,
};

/**
 * Cache activity counts.
 *
 * @example
 * ```ts
 * const stats: EffectSummaryCacheStats = effectSummaryCacheStats();
 * ```
 */
export type EffectSummaryCacheStats = {
  readonly directSummaryBuildCount: number;
  readonly sourceCacheHitCount: number;
};

/**
 * Clones direct summary before fixed-point propagation mutates it.
 *
 * @param summary - Cached or newly scanned direct summary.
 *
 * @returns independent mutable fixed-point seed.
 */
function cloneSummary(summary: MutableEffectSummary,): MutableEffectSummary {
  return {
    parameterCount: summary.parameterCount,
    bindingOriginBySymbolId: new Map(summary.bindingOriginBySymbolId,),
    directMutated: new Set(summary.directMutated,),
    directOpaque: new Set(summary.directOpaque,),
    opaqueProvenanceByParameter: new Map(
      [...summary.opaqueProvenanceByParameter
        .entries(),]
        .map(function cloneProvenance([index, facts,],): [
          number,
          Set<string>,
        ] {
          return [
            index,
            new Set(facts,),
          ];
        },),
    ),
    mutated: new Set(summary.mutated,),
    opaque: new Set(summary.opaque,),
    relations: [...summary.relations,],
    calls: [...summary.calls,],
  };
}

/**
 * Tests whether cached summaries contain every current callable key.
 *
 * @param expectedKeys - Current callable keys required by source wrapper.
 *
 * @param summaries - Cached direct summaries keyed by callable identity.
 *
 * @returns whether cache covers every current callable.
 */
function containsEveryExpectedKey({
  expectedKeys,
  summaries,
}: {
  readonly expectedKeys: ReadonlySet<string>;
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
},): boolean {
  for (const key of expectedKeys) {
    if (!summaries.has(key,))
      return false;
  }
  return true;
}

/**
 * Invokes caller-owned direct-summary scanner.
 *
 * @param create - Scanner callback to invoke.
 *
 * @returns newly scanned direct summaries.
 *
 * @mutates create - invokes caller scanner callback and its captured state
 *
 * @example
 * ```ts
 * runSummaryFactory(create);
 * ```
 */
function runSummaryFactory(
  create: ForeignBorrowed<DirectSummaryFactory>,
): ReadonlyMap<string, MutableEffectSummary> {
  return create();
}

/**
 * Returns cloned direct summaries from cache or source scanner.
 *
 * @param projectKey - Configured project identity.
 *
 * @param fileName - Source path within project.
 *
 * @param sourceText - Exact semantic snapshot source text.
 *
 * @param expectedKeys - Callable keys present in current source wrapper.
 *
 * @param create - Scanner producing direct summaries on cache miss or incomplete hit.
 *
 * @returns independent direct summaries safe for propagation.
 *
 * @mutates create - invokes caller scanner callback on cache miss or incomplete hit
 *
 * @example
 * ```ts
 * directSummariesForSource({ projectKey, fileName, sourceText, expectedKeys, create });
 * ```
 */
export function directSummariesForSource({
  projectKey,
  fileName,
  sourceText,
  expectedKeys,
  create,
}: ForeignBorrowed<Readonly<{
  projectKey: string;
  fileName: string;
  sourceText: string;
  expectedKeys: ReadonlySet<string>;
  create: DirectSummaryFactory;
}>>): ReadonlyMap<string, MutableEffectSummary> {
  /**
   * Project-local cache bounded by configured source paths.
   */
  const projectCache: Map<string, CachedSourceSummaries> = summariesByProject.get(projectKey,)
    ?? new Map<string, CachedSourceSummaries>();
  /**
   * Prior direct summaries for exact path.
   */
  const cached = projectCache.get(fileName,);
  if ((cached !== undefined)
    && (cached.sourceText === sourceText)
    && containsEveryExpectedKey({
      expectedKeys,
      summaries: cached.summaries,
    },)) {
    counters.sourceCacheHitCount++;
    return new Map(
      [...cached.summaries
        .entries(),]
        .map(function cloneEntry([key, summary,],): [
          string,
          MutableEffectSummary,
        ] {
          return [
            key,
            cloneSummary(summary,),
          ];
        },),
    );
  }
  /**
   * Fresh semantic direct summaries for changed or uncached source.
   */
  const created = runSummaryFactory(create,);
  counters.directSummaryBuildCount += created.size;
  projectCache.set(
    fileName,
    {
      sourceText,
      summaries: new Map(
        [...created.entries(),]
          .map(function cacheEntry([key, summary,],): [
            string,
            MutableEffectSummary,
          ] {
            return [
              key,
              cloneSummary(summary,),
            ];
          },),
      ),
    },
  );
  summariesByProject.set(
    projectKey,
    projectCache,
  );
  return created;
}

/**
 * Removes cached files no longer present in configured project.
 *
 * @param projectKey - Configured project identity.
 *
 * @param activeFiles - Current non-declaration project source paths.
 *
 * @example
 * ```ts
 * pruneDirectSummaryCache({ projectKey, activeFiles });
 * ```
 */
export function pruneDirectSummaryCache({
  projectKey,
  activeFiles,
}: {
  readonly projectKey: string;
  readonly activeFiles: ReadonlySet<string>;
}): void {
  /**
   * Existing project-local source cache, when initialized.
   */
  const projectCache = summariesByProject.get(projectKey,);
  if (projectCache === undefined)
    return;
  [...projectCache.keys(),].forEach(function prune(fileName,): void {
    if (!activeFiles.has(fileName,))
      projectCache.delete(fileName,);
  },);
}

/**
 * Reads cache activity counters.
 *
 * @returns current direct-build and source-hit counts.
 *
 * @example
 * ```ts
 * effectSummaryCacheStats();
 * ```
 */
export function effectSummaryCacheStats(): EffectSummaryCacheStats {
  return { ...counters, };
}

/**
 * Clears direct cache and counters for lifecycle tests.
 *
 * @example
 * ```ts
 * clearEffectSummaryCache();
 * ```
 */
export function clearEffectSummaryCache(): void {
  summariesByProject.clear();
  counters.directSummaryBuildCount = 0;
  counters.sourceCacheHitCount = 0;
}
