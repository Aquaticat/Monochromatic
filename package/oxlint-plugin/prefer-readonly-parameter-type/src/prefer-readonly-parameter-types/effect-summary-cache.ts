/**
 * Process-bounded direct effect-summary cache.
 *
 * @module
 */

import type { PersistentEffectDependencyState, } from './effect-cache-envelope.ts';
import type { EffectClosureEdges, } from './effect-dependency-closure.ts';
import type { EffectProjectSurfaces, } from './effect-project-fingerprint.ts';
import type { MutableEffectSummary, } from './effect-summary-model.ts';
import {
  type EffectDependencyClosure,
  PERSISTENT_EFFECT_CACHE_MISS,
  readPersistentEffectSummaries,
  writePersistentEffectSummaries,
} from './effect-summary-persistent-cache.ts';

/**
 * Sentinel when neither process nor persistent layer proves an exact hit.
 */
export const LAYERED_SUMMARY_CACHE_MISS: unique symbol = Symbol(
  'layered direct summary cache miss',
);

/**
 * Cached direct summaries for one exact source text.
 */
type CachedSourceSummaries = {
  readonly projectDigest: string;
  readonly sourceText: string;
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly edges: EffectClosureEdges;
};

/**
 * Layered hit: cloned summaries plus recorded closure edges.
 */
export type LayeredSummaryCacheHit = {
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly edges: EffectClosureEdges;
};

/**
 * Shared identity for one source across both cache layers.
 */
type LayeredSourceIdentity = {
  readonly projectKey: string;
  readonly scopeKey: string;
  readonly projectDigest: string;
  readonly fileName: string;
  readonly sourceText: string;
  readonly cacheRootOverride?: string;
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
    /* Deep, matching `opaqueProvenanceByParameter` below. A shallow copy would share
     * each origin set with the cached summary, so any later write through one would
     * be visible through the other, which is exactly what cloning exists to prevent. */
    bindingOriginBySymbolId: new Map(
      [...summary.bindingOriginBySymbolId
        .entries(),]
        .map(function cloneOrigins([symbolId, origins,],): [
          number,
          Set<number>,
        ] {
          return [
            symbolId,
            new Set(origins,),
          ];
        },),
    ),
    directMutated: new Set(summary.directMutated,),
    directInvoked: new Set(summary.directInvoked,),
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
    invoked: new Set(summary.invoked,),
    opaque: new Set(summary.opaque,),
    directForeignBorrowed: new Set(summary.directForeignBorrowed,),
    relations: [...summary.relations,],
    elementApplications: [...summary.elementApplications,],
    calls: [...summary.calls,],
  };
}

/**
 * Clones every summary in one map.
 *
 * @param summaries - Cached or created summaries.
 *
 * @returns independent mutable clones keyed identically.
 */
function cloneSummaries(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): ReadonlyMap<string, MutableEffectSummary> {
  return new Map(
    [...summaries.entries(),]
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
 * Stores summaries and edges in the process memory layer.
 *
 * @param identity - Shared source identity.
 *
 * @param summaries - Summaries retained as independent clones.
 *
 * @param edges - Closure edges recorded beside summaries.
 */
function storeMemoryLayer({
  identity,
  summaries,
  edges,
}: {
  readonly identity: LayeredSourceIdentity;
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly edges: EffectClosureEdges;
},): void {
  /**
   * Project-local cache bounded by configured source paths.
   */
  const projectCache: Map<string, CachedSourceSummaries> = summariesByProject.get(identity.projectKey,)
    ?? new Map<string, CachedSourceSummaries>();
  projectCache.set(
    identity.fileName,
    {
      projectDigest: identity.projectDigest,
      sourceText: identity.sourceText,
      summaries: cloneSummaries(summaries,),
      edges,
    },
  );
  summariesByProject.set(
    identity.projectKey,
    projectCache,
  );
}

/**
 * Reads cloned direct summaries from process or persistent layer.
 *
 * @param identity - Shared source identity.
 *
 * @param state - Current whole-scope surfaces and per-source digests.
 *
 * @returns cloned summaries with closure edges,
 * or layered miss sentinel.
 *
 * @example
 * ```ts
 * readCachedSummariesForSource({ identity, state });
 * ```
 */
export function readCachedSummariesForSource({
  identity,
  state,
}: {
  readonly identity: LayeredSourceIdentity;
  readonly state: PersistentEffectDependencyState;
},): LayeredSummaryCacheHit | typeof LAYERED_SUMMARY_CACHE_MISS {
  /**
   * Prior direct summaries for exact path.
   */
  const cached = summariesByProject.get(identity.projectKey,)
    ?.get(identity.fileName,);
  if ((cached !== undefined)
    && (cached.projectDigest === identity.projectDigest)
    && (cached.sourceText === identity.sourceText)) {
    counters.sourceCacheHitCount++;
    return {
      summaries: cloneSummaries(cached.summaries,),
      edges: cached.edges,
    };
  }
  /**
   * Direct summaries persisted by prior Oxlint process.
   */
  const persistent = readPersistentEffectSummaries({
    address: {
      projectKey: identity.scopeKey,
      fileName: identity.fileName,
      sourceText: identity.sourceText,
      ...(identity.cacheRootOverride === undefined)
        ? {}
        : { cacheRootOverride: identity.cacheRootOverride, },
    },
    state,
  },);
  if (persistent === PERSISTENT_EFFECT_CACHE_MISS)
    return LAYERED_SUMMARY_CACHE_MISS;
  counters.persistentSourceCacheHitCount++;
  /**
   * Closure edges recorded at entry creation.
   */
  const edges: EffectClosureEdges = {
    resolved: persistent.dependenciesResolved,
    directDependencies: persistent.directDependencies,
  };
  storeMemoryLayer({
    identity,
    summaries: persistent.summaries,
    edges,
  },);
  return {
    summaries: cloneSummaries(persistent.summaries,),
    edges,
  };
}

/**
 * Stores created summaries in both cache layers.
 *
 * @param identity - Shared source identity.
 *
 * @param summaries - Freshly created direct summaries.
 *
 * @param surfaces - Whole-scope surface digests at creation time.
 *
 * @param closure - Dependency-closure snapshot for exact source.
 *
 * @example
 * ```ts
 * storeCreatedSummariesForSource({ identity, summaries, surfaces, closure });
 * ```
 */
export function storeCreatedSummariesForSource({
  identity,
  summaries,
  surfaces,
  closure,
}: {
  readonly identity: LayeredSourceIdentity;
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly surfaces: EffectProjectSurfaces;
  readonly closure: EffectDependencyClosure;
},): void {
  counters.directSummaryBuildCount += summaries.size;
  storeMemoryLayer({
    identity,
    summaries,
    edges: {
      resolved: closure.resolved,
      directDependencies: closure.directDependencies,
    },
  },);
  writePersistentEffectSummaries({
    address: {
      projectKey: identity.scopeKey,
      fileName: identity.fileName,
      sourceText: identity.sourceText,
      ...(identity.cacheRootOverride === undefined)
        ? {}
        : { cacheRootOverride: identity.cacheRootOverride, },
    },
    summaries,
    surfaces,
    closure,
  },);
  counters.persistentCacheWriteCount++;
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
