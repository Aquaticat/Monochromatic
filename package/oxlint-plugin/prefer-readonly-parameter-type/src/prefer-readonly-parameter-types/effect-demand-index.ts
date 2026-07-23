/**
 * Demand-driven effect index over active callable dependency closure.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { directEffectSummary, } from './direct-effect-summary.ts';
import { createDependencyClosureResolver, } from './effect-dependency-closure.ts';
import { propagateEffects, } from './effect-fixed-point-propagation.ts';
import type { EffectProjectFingerprint, } from './effect-project-fingerprint.ts';
import {
  LAYERED_SUMMARY_CACHE_MISS,
  pruneDirectSummaryCache,
  readCachedSummariesForSource,
  storeCreatedSummariesForSource,
} from './effect-summary-cache.ts';
import {
  callableKey,
  collectAstNodes,
  type EffectCallableDeclaration,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';
import {
  type CallableEffectSummary,
  type EffectSummaryIndex,
  NO_EFFECT_SUMMARY,
} from './effect-summary-index.ts';
import {
  externalCallableEffect,
  type ExternalEffectIndexBuilder,
} from './external-callable-effect.ts';
import { propagateForeignBorrowed, } from './foreign-borrowed-propagation.ts';

/**
 * Inputs needed to construct one exact-snapshot demand index.
 */
type DemandDrivenEffectIndexOptions = {
  readonly project: Project;
  readonly indexedSourceFiles: ReadonlyMap<string, SourceFile>;
  readonly projectFingerprint: EffectProjectFingerprint;
  readonly scopeKey: string;
  readonly projectDigest: string;
  readonly cacheRootOverride?: string;
  readonly analysisRoot?: string;
  readonly buildIndex: ExternalEffectIndexBuilder;
};

/**
 * Builds layered-cache identity for one reached source.
 *
 * @param project - Semantic project owning cache scope.
 *
 * @param scopeKey - Persistent scope identity.
 *
 * @param projectDigest - Exact semantic project identity.
 *
 * @param sourceFile - Reached source whose summaries are requested.
 *
 * @param cacheRootOverride - Optional disposable cache root.
 *
 * @returns shared process and persistent cache identity.
 */
function sourceIdentity({
  project,
  scopeKey,
  projectDigest,
  sourceFile,
  cacheRootOverride,
}: {
  readonly project: Project;
  readonly scopeKey: string;
  readonly projectDigest: string;
  readonly sourceFile: SourceFile;
  readonly cacheRootOverride?: string;
}): {
  readonly projectKey: string;
  readonly scopeKey: string;
  readonly projectDigest: string;
  readonly fileName: string;
  readonly sourceText: string;
  readonly cacheRootOverride?: string;
} {
  return {
    projectKey: project.configFileName,
    scopeKey,
    projectDigest,
    fileName: sourceFile.fileName,
    sourceText: sourceFile.text,
    ...(cacheRootOverride === undefined) ? {} : { cacheRootOverride, },
  };
}

/**
 * Collects owned callee and callback source paths from direct summaries.
 *
 * @param fileSummaries - Direct summaries from one reached source.
 *
 * @param indexedFileNames - Exact owned source scope.
 *
 * @returns unique reached source paths in stable order.
 */
function summaryDependencyFileNames({
  fileSummaries,
  indexedFileNames,
}: {
  readonly fileSummaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly indexedFileNames: ReadonlySet<string>;
}): readonly string[] {
  /**
   * Unique semantic call dependencies discovered in current source.
   */
  const dependencies = new Set<string>();
  fileSummaries.forEach(function collectSummaryDependencies(summary,): void {
    summary.calls
      .forEach(function collectCallDependencies(edge,): void {
        if (indexedFileNames.has(edge.calleeFileName,))
          dependencies.add(edge.calleeFileName,);
        edge.callbackFileNames
          .forEach(function collectCallbackFile(fileName,): void {
            if (((typeof fileName) === 'string')
              && indexedFileNames.has(fileName,))
              dependencies.add(fileName,);
          },);
      },);
  },);
  return [...dependencies,].toSorted();
}

/**
 * Converts completed mutable summary to public immutable view.
 *
 * @param summary - Completed fixed-point summary.
 *
 * @param foreignParameterIndexes - Guaranteed foreign-owned parameter indexes.
 *
 * @returns copied public effect summary.
 */
function publicSummary({
  summary,
  foreignParameterIndexes,
}: {
  readonly summary: MutableEffectSummary;
  readonly foreignParameterIndexes: ReadonlySet<number>;
}): CallableEffectSummary {
  return {
    mutatedParameterIndexes: new Set([
      ...summary.mutated,
      ...summary.invoked,
      ...summary.documentedUncertain,
    ],),
    referentMutatedParameterIndexes: summary.mutated,
    invokedParameterIndexes: summary.invoked,
    documentedUncertainParameterIndexes: summary.documentedUncertain,
    opaqueParameterIndexes: summary.opaque,
    opaqueProvenanceByParameter: summary.opaqueProvenanceByParameter,
    foreignBorrowedParameterIndexes: foreignParameterIndexes,
    callbackRelations: [...summary.relations,],
  };
}

/**
 * Creates mutable index that expands only from requested callable sources.
 *
 * Foreign ownership is declaration-global rather than path-local.
 * Encountering one explicit foreign marker therefore expands the complete
 * owned source graph before proving propagated foreign provenance.
 *
 * @param options - Exact project,
 * cache,
 * ownership,
 * and recursive external-analysis inputs.
 *
 * @returns effect index expanding monotonically within one project snapshot.
 *
 * @example
 * ```ts
 * const index = createDemandDrivenEffectIndex(options);
 * ```
 */
export function createDemandDrivenEffectIndex({
  project,
  indexedSourceFiles,
  projectFingerprint,
  scopeKey,
  projectDigest,
  cacheRootOverride,
  analysisRoot,
  buildIndex,
}: DemandDrivenEffectIndexOptions): EffectSummaryIndex {
  /**
   * Exact owned source membership for closure validation.
   */
  const indexedFileNames = new Set(indexedSourceFiles.keys(),);
  /**
   * Dependency resolver combining module and semantic call edges.
   */
  const closureResolver = createDependencyClosureResolver({
    project,
    indexedFileNames,
    sourceDigests: projectFingerprint.sourceDigests,
  },);
  /**
   * Current program state validating persistent entries.
   */
  const dependencyState = {
    surfaces: projectFingerprint.surfaces,
    sourceDigests: projectFingerprint.sourceDigests,
  };
  /**
   * Direct and propagated summaries reached in current snapshot.
   */
  const summaries = new Map<string, MutableEffectSummary>();
  /**
   * Source paths already loaded into current graph.
   */
  const loadedFileNames = new Set<string>();
  /**
   * Fresh summaries awaiting complete semantic-edge closure before persistence.
   */
  const pendingStores = new Map<string, {
    readonly sourceFile: SourceFile;
    readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  }>();
  /**
   * Guaranteed foreign provenance recomputed after every graph expansion.
   */
  const foreignByCallable: {
    current: ReadonlyMap<string, ReadonlySet<number>>;
  } = { current: new Map(), };
  /**
   * Whether explicit foreign provenance requires complete inbound graph.
   */
  const foreignFallback = { required: false, };

  /**
   * Loads one reached source from cache or exact semantic scan.
   *
   * @param sourceFile - Owned source newly entering effect graph.
   *
   * @returns direct summaries and semantic source dependencies.
   */
  function loadSource(sourceFile: SourceFile,): {
    readonly fileSummaries: ReadonlyMap<string, MutableEffectSummary>;
    readonly dependencies: readonly string[];
  } {
    /**
     * Layered cache identity for current source.
     */
    const identity = sourceIdentity({
      project,
      scopeKey,
      projectDigest,
      sourceFile,
      ...(cacheRootOverride === undefined) ? {} : { cacheRootOverride, },
    },);
    /**
     * Validated cached direct summaries and dependency edges.
     */
    const hit = readCachedSummariesForSource({
      identity,
      state: dependencyState,
    },);
    if (hit !== LAYERED_SUMMARY_CACHE_MISS) {
      closureResolver.seedEdges({
        fileName: sourceFile.fileName,
        edges: hit.edges,
      },);
      return {
        fileSummaries: hit.summaries,
        dependencies: summaryDependencyFileNames({
          fileSummaries: hit.summaries,
          indexedFileNames,
        },),
      };
    }
    /**
     * Callable declarations decoded only for reached source.
     */
    const declarations = collectAstNodes(sourceFile,)
      .filter(function retainEffectCallable(node,): node is EffectCallableDeclaration {
        return isEffectCallableDeclaration(node,);
      },);
    /**
     * Fresh direct summaries for reached source.
     */
    const fileSummaries = new Map(declarations.map(function gatherCallable(declaration,): [
      string,
      MutableEffectSummary,
    ] {
      return [
        callableKey(declaration,),
        directEffectSummary({
          project,
          declaration,
          ...(analysisRoot === undefined) ? {} : { analysisRoot, },
          externalEffectResolver({
            consumerProject,
            call,
            declaration: externalDeclaration,
          },) {
            return externalCallableEffect({
              consumerProject,
              call,
              declaration: externalDeclaration,
              buildIndex,
            },);
          },
        },),
      ];
    },),);
    /**
     * Owned source dependencies discovered through semantic call edges.
     */
    const dependencies = summaryDependencyFileNames({
      fileSummaries,
      indexedFileNames,
    },);
    closureResolver.includeDirectDependencies({
      fileName: sourceFile.fileName,
      dependencies,
    },);
    pendingStores.set(
      sourceFile.fileName,
      {
        sourceFile,
        summaries: fileSummaries,
      },
    );
    return {
      fileSummaries,
      dependencies,
    };
  }

  /**
   * Expands graph from one requested source and completes fixed points.
   *
   * @param sourceFile - Requested owned source root.
   */
  function ensureSource(sourceFile: SourceFile,): void {
    /**
     * Work stack of reached source files awaiting direct summaries.
     */
    const pending: SourceFile[] = [sourceFile,];
    /**
     * Whether current request expanded graph and requires propagation.
     */
    const expansion = { changed: false, };
    while (pending.length > 0) {
      /**
       * Next reached source file.
       */
      const current = pending.pop();
      if ((current === undefined) || loadedFileNames.has(current.fileName,))
        continue;
      loadedFileNames.add(current.fileName,);
      expansion.changed = true;
      /**
       * Current source summaries and their semantic dependencies.
       */
      const loaded = loadSource(current,);
      loaded.fileSummaries
        .forEach(function addSummary(summary, key,): void {
          summaries.set(
            key,
            summary,
          );
        },);
      loaded.dependencies
        .forEach(function enqueueDependency(fileName,): void {
          /**
           * Owned source corresponding to semantic edge.
           */
          const dependency = indexedSourceFiles.get(fileName,);
          if ((dependency !== undefined)
            && (!loadedFileNames.has(fileName,)))
            pending.push(dependency,);
        },);
      if ((!foreignFallback.required)
        && [...loaded.fileSummaries.values(),]
        .some(function hasForeignBoundary(summary,): boolean {
          return (summary.directForeignBorrowed.size > 0)
            || summary.calls.some(function hasDirectForeignArgument(edge,): boolean {
              return edge.directForeignArguments.includes(true,);
            },);
        },)) {
        foreignFallback.required = true;
        indexedSourceFiles.forEach(function enqueueCompleteInboundGraph(candidate,): void {
          if (!loadedFileNames.has(candidate.fileName,))
            pending.push(candidate,);
        },);
      }
    }
    if (!expansion.changed)
      return;
    pendingStores.forEach(function persistReachedSource(pending,): void {
      storeCreatedSummariesForSource({
        identity: sourceIdentity({
          project,
          scopeKey,
          projectDigest,
          sourceFile: pending.sourceFile,
          ...(cacheRootOverride === undefined) ? {} : { cacheRootOverride, },
        },),
        summaries: pending.summaries,
        surfaces: projectFingerprint.surfaces,
        closure: closureResolver.closureFor(pending.sourceFile.fileName,),
      },);
    },);
    pendingStores.clear();
    pruneDirectSummaryCache({
      projectKey: project.configFileName,
      activeFiles: indexedFileNames,
    },);
    propagateEffects(summaries,);
    foreignByCallable.current = propagateForeignBorrowed(summaries,);
  }

  return {
    get(declaration,): CallableEffectSummary | typeof NO_EFFECT_SUMMARY {
      /**
       * Source from exact analyzer snapshot rather than foreign wrapper.
       */
      const sourceFile = indexedSourceFiles.get(declaration.getSourceFile()
        .fileName,);
      if (sourceFile === undefined)
        return NO_EFFECT_SUMMARY;
      ensureSource(sourceFile,);
      /**
       * Stable declaration identity shared across source wrappers.
       */
      const key = callableKey(declaration,);
      /**
       * Completed summary after demanded closure propagation.
       */
      const summary = summaries.get(key,);
      if (summary === undefined)
        return NO_EFFECT_SUMMARY;
      return publicSummary({
        summary,
        foreignParameterIndexes: foreignByCallable.current.get(key,)
          ?? new Set<number>(),
      },);
    },
  };
}
