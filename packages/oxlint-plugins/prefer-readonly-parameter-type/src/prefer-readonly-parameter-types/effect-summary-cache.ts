/**
 * Process-bounded direct effect-summary cache.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { MutableEffectSummary, } from './effect-summary-model.ts';
import {
  PERSISTENT_EFFECT_CACHE_MISS,
  readPersistentEffectSummaries,
  writePersistentEffectSummaries,
} from './effect-summary-persistent-cache.ts';

/**
 * Scanner producing direct summaries for one source.
 */
type DirectSummaryFactory = () => ReadonlyMap<string, MutableEffectSummary>;

/**
 * Cached direct summaries for one exact source text.
 */
type CachedSourceSummaries = {
  readonly projectDigest: string;
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
  persistentSourceCacheHitCount: 0,
  persistentCacheWriteCount: 0,
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
  readonly persistentSourceCacheHitCount: number;
  readonly persistentCacheWriteCount: number;
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
    directInvoked: new Set(summary.directInvoked,),
    directOpaque: new Set(summary.directOpaque,),
    directDocumentedUncertain: new Set(summary.directDocumentedUncertain,),
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
    invoked: new Set(summary.invoked,),
    opaque: new Set(summary.opaque,),
    documentedUncertain: new Set(summary.documentedUncertain,),
    directForeignBorrowed: new Set(summary.directForeignBorrowed,),
    relations: [...summary.relations,],
    calls: [...summary.calls,],
  };
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
 * @param projectDigest - Exact configured project semantic identity.
 *
 * @param fileName - Source path within project.
 *
 * @param sourceText - Exact semantic snapshot source text.
 *
 * @param cacheRootOverride - Optional disposable persistent root used by tests.
 *
 * @param create - Scanner producing direct summaries on cache miss.
 *
 * @returns independent direct summaries safe for propagation.
 *
 * @mutates create - invokes caller scanner callback on process and persistent cache miss
 *
 * @example
 * ```ts
 * directSummariesForSource({ projectKey, fileName, sourceText, create });
 * ```
 */
export function directSummariesForSource({
  projectKey,
  projectDigest,
  fileName,
  sourceText,
  cacheRootOverride,
  create,
}: ForeignBorrowed<Readonly<{
  projectKey: string;
  projectDigest: string;
  fileName: string;
  sourceText: string;
  cacheRootOverride?: string;
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
    && (cached.projectDigest === projectDigest)
    && (cached.sourceText === sourceText)) {
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
   * Persistent cache address for exact source snapshot.
   */
  const persistentAddress = {
    projectKey,
    projectDigest,
    fileName,
    sourceText,
    ...(cacheRootOverride === undefined) ? {} : { cacheRootOverride, },
  };
  /**
   * Direct summaries persisted by prior Oxlint process.
   */
  const persistent = readPersistentEffectSummaries(persistentAddress,);
  if (persistent !== PERSISTENT_EFFECT_CACHE_MISS) {
    counters.persistentSourceCacheHitCount++;
    projectCache.set(
      fileName,
      {
        projectDigest,
        sourceText,
        summaries: persistent,
      },
    );
    summariesByProject.set(
      projectKey,
      projectCache,
    );
    return new Map([...persistent.entries(),]
      .map(function clonePersistentEntry([key, summary,],): [
        string,
        MutableEffectSummary
      ] {
        return [
          key,
          cloneSummary(summary,),
        ];
      },),);
  }
  /**
   * Fresh semantic direct summaries for changed or uncached source.
   */
  const created = runSummaryFactory(create,);
  counters.directSummaryBuildCount += created.size;
  projectCache.set(
    fileName,
    {
      projectDigest,
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
  writePersistentEffectSummaries({
    address: persistentAddress,
    summaries: created,
  },);
  counters.persistentCacheWriteCount++;
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
  counters.persistentSourceCacheHitCount = 0;
  counters.persistentCacheWriteCount = 0;
}
