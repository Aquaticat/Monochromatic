/**
 * Demand-driven effect index over active callable dependency closure.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { caughtValueStack, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { directEffectSummary, } from './direct-effect-summary.ts';
import { sourceIdentity, } from './effect-source-identity.ts';
import type { EffectAnalysisBudget, } from './effect-analysis-budget.ts';
import { createDependencyClosureResolver, } from './effect-dependency-closure.ts';
import { propagateEffects, } from './effect-fixed-point-propagation.ts';
import type { EffectProjectFingerprint, } from './effect-project-fingerprint.ts';
import { effectPublicSummary, } from './effect-public-summary.ts';
import type { ParameterIndex, } from './effect-slot-identity.ts';
import {
  assertReachedCallSummaries,
  reachedSourceFileNames,
} from './effect-reached-edge.ts';
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
import { completeForeignBorrowedGraph, } from './foreign-borrowed-complete-graph.ts';

/**
 * Tagged logger for effect index construction.
 */
const dl = tagged({ tag: 'effect-demand-index', },);

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
  readonly analysisBudget: EffectAnalysisBudget;
};

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
export function createDemandDrivenEffectIndex(
  options: DemandDrivenEffectIndexOptions,
): EffectSummaryIndex {
  /**
   * Exact project,
   * cache,
   * ownership,
   * budget,
   * and recursive external-analysis inputs.
   */
  const {
    project,
    indexedSourceFiles,
    projectFingerprint,
    scopeKey,
    projectDigest,
    cacheRootOverride,
    analysisRoot,
    buildIndex,
    analysisBudget,
  } = options;
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
   * Callable candidates whose exact signature inbounds were verified.
   */
  const verifiedForeignKeys = new Set<string>();
  /**
   * Complete foreign results accumulated from demanded backwards closures.
   */
  const completeForeignByCallable = new Map<string, ReadonlySet<ParameterIndex>>();

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
        dependencies: reachedSourceFileNames({
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
    const fileSummaries = new Map(declarations.flatMap(function gatherCallable(declaration,): readonly [
      string,
      MutableEffectSummary,
    ][] {
      try {
        return [[
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
        ],];
      }
      catch (error) {
        /* One callable whose summary cannot be built must not cost the rest of the file.
         * Omitting it is what makes the rest analyzable, and omission is fail-closed on
         * both sides: its callers hit the absent-callee branch in
         * `effect-fixed-point-propagation.ts` and take opacity, while the rule skips
         * verifying it rather than reporting an internal failure against code whose author
         * cannot act on it. The live cause is an upstream panic recorded in
         * `doc/troubleshooting/typescript-go-tuple-type-panic.md`, which no ordering of API
         * calls avoids. */
        dl.warn(
          `omitting ${callableKey(declaration,)} from the effect index: ${caughtValueStack(error,)}`,
        );
        return [];
      }
    },),);
    /**
     * Owned source dependencies discovered through semantic call edges.
     */
    const dependencies = reachedSourceFileNames({
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
      analysisBudget.assertAvailable(`source ${current.fileName}`,);
      /**
       * Start time for one reached-source cache or semantic analysis.
       */
      const sourceStartedAt = analysisBudget.start();
      /**
       * Current source summaries and their semantic dependencies.
       */
      const loaded = loadSource(current,);
      analysisBudget.record({
        startedAt: sourceStartedAt,
        phase: `source ${current.fileName}`,
      },);
      loaded.fileSummaries
        .forEach(function addSummary(
          summary,
          key,
        ): void {
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
    }
    if (!expansion.changed)
      return;
    /**
     * Start time for cache publication and fixed-point completion.
     */
    const finalizationStartedAt = analysisBudget.start();
    assertReachedCallSummaries(summaries,);
    pendingStores.forEach(function persistReachedSource(pendingStore,): void {
      /**
       * Complete dependency closure after every reached edge is loaded.
       */
      const closure = closureResolver.closureFor(
        pendingStore.sourceFile
          .fileName,
      );
      storeCreatedSummariesForSource({
        identity: sourceIdentity({
          project,
          scopeKey,
          projectDigest,
          sourceFile: pendingStore.sourceFile,
          ...(cacheRootOverride === undefined) ? {} : { cacheRootOverride, },
        },),
        summaries: pendingStore.summaries,
        surfaces: projectFingerprint.surfaces,
        closure,
      },);
    },);
    pendingStores.clear();
    pruneDirectSummaryCache({
      projectKey: project.configFileName,
      activeFiles: indexedFileNames,
    },);
    /* The optimistic per-expansion foreign pass is gone with the gate it fed. It narrowed
     * candidates over whatever had been reached, and nothing reads that answer now: the
     * complete backwards closure decides every foreign question and walks the whole configured
     * scope rather than the reached part of it. Keeping the pass would have cost a full
     * inbound grouping after every expansion to produce a value no consumer looks at. */
    propagateEffects(summaries,);
    analysisBudget.record({
      startedAt: finalizationStartedAt,
      phase: 'fixed-point finalization',
    },);
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
      /* The complete proof runs for every callable asked about, not only for one the reached
       * graph already hints at. The hint is `foreignByCallable.current`, recomputed after each
       * expansion over whatever has been reached, so gating on it made the answer a fact about
       * which files the lint run happened to visit first. Measured in one process with no
       * threads: `stateMatches` in `package/desktop-app/electron-infra/src/wayland-state.ts`
       * read `foreign=[]` before its siblings were expanded and `foreign=[0]` after, because
       * `wayland-test.ts` declares the marker and reaches it. Skipping is not the safe
       * direction either, since foreign ownership suppresses the readonly offer, so the
       * unproven answer emits an offer the proven one withholds.
       *
       * `completeForeignBorrowedGraph` was already order-independent: it walks
       * `indexedSourceFiles`, the whole configured scope, however little has been reached. Only
       * its trigger had to move.
       * `doc/troubleshooting/prefer-readonly-parameter-type-thread-nondeterminism.md` records
       * the measurement. */
      if (!verifiedForeignKeys.has(key,)) {
        /**
         * Exact backwards caller closure for current reached candidate.
         */
        const completeForeign = completeForeignBorrowedGraph({
          project,
          indexedSourceFiles,
          rootDeclaration: declaration,
          analysisBudget,
          ...(analysisRoot === undefined) ? {} : { analysisRoot, },
        },);
        completeForeign.forEach(function retainCompleteForeign(
          indexes,
          callableKeyValue,
        ): void {
          completeForeignByCallable.set(
            callableKeyValue,
            indexes,
          );
        },);
        verifiedForeignKeys.add(key,);
      }
      /* Every key reaching here has been verified, since the proof above runs for any key that
       * has not. The lookup still defaults, because a callable the closure finds no inbound for
       * is absent from the result rather than present and empty. */
      /**
       * Guaranteed foreign indexes after the complete-inbound proof.
       */
      const foreignParameterIndexes = completeForeignByCallable.get(key,)
        ?? new Set<ParameterIndex>();
      return effectPublicSummary({
        summary,
        foreignParameterIndexes,
        declaration,
      },);
    },
  };
}
