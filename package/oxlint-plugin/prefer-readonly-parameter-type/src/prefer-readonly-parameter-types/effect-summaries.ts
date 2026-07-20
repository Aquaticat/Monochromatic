/**
 * Whole-project parameter mutation summaries over TypeScript 7 semantic AST.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { directEffectSummary, } from './direct-effect-summary.ts';
import {
  cachedFinalEffectIndex,
  cacheFinalEffectIndex,
  FINAL_EFFECT_INDEX_CACHE_MISS,
} from './effect-final-index-cache.ts';
import { createDependencyClosureResolver, } from './effect-dependency-closure.ts';
import { propagateEffects, } from './effect-fixed-point-propagation.ts';
import {
  effectProjectFingerprint,
  effectProjectSourceSignatures,
} from './effect-project-fingerprint.ts';
import {
  LAYERED_SUMMARY_CACHE_MISS,
  pruneDirectSummaryCache,
  readCachedSummariesForSource,
  storeCreatedSummariesForSource,
} from './effect-summary-cache.ts';
import { contentDigest, } from './effect-summary-cache-identity.ts';
import { externalCallableEffect, } from './external-callable-effect.ts';
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
import { propagateForeignBorrowed, } from './foreign-borrowed-propagation.ts';
import { isWorkspaceSourceFileName, } from './workspace-source-path.ts';

export {
  type CallableEffectSummary,
  type EffectSummaryIndex,
  NO_EFFECT_SUMMARY,
} from './effect-summary-index.ts';

/**
 * Builds effect summaries for owned non-declaration source in project.
 *
 * @param project - TypeScript project snapshot to analyze.
 *
 * @param activeSourceFile - Current overlay source wrapper used by verifier.
 *
 * @param cacheRootOverride - Optional disposable persistent cache root used by tests.
 *
 * @param analysisRoot - Optional external implementation root included despite library classification.
 *
 * @returns exact declaration summary lookup.
 *
 * @example
 * ```ts
 * const effects = buildEffectSummaryIndex({ project, activeSourceFile });
 * ```
 */
export function buildEffectSummaryIndex({
  project,
  activeSourceFile,
  cacheRootOverride,
  analysisRoot,
}: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
  readonly cacheRootOverride?: string;
  readonly analysisRoot?: string;
},): EffectSummaryIndex {
  /**
   * Process cache identity including optional external analysis scope.
   */
  const cacheProjectKey = `${project.configFileName}\0${analysisRoot ?? ''}`;
  /**
   * Stable configured project membership for process-local reuse.
   */
  const fileNames = [...new Set([
    ...project.program
      .getSourceFileNames(),
    activeSourceFile.fileName,
  ],),].toSorted();
  /**
   * Exact source set admitted by current ownership and active-source policy.
   */
  const indexedSourceFiles = fileNames.flatMap(function retainIndexedSource(fileName,): SourceFile[] {
    /**
     * Program source matching configured path or exact active wrapper.
     */
    const sourceFile = fileName === activeSourceFile.fileName
      ? activeSourceFile
      : project.program
        .getSourceFile(fileName,);
    if ((sourceFile === undefined) || sourceFile.isDeclarationFile)
      return [];
    if (sourceFile.fileName === activeSourceFile.fileName)
      return [sourceFile,];
    if (!project
      .program
      .isSourceFileFromExternalLibrary(sourceFile,))
      return [sourceFile,];
    /* Symlink-resolved workspace dependencies classify as external while
     * living at repository paths; their source joins the indexed scope. */
    if (isWorkspaceSourceFileName(fileName,))
      return [sourceFile,];
    if ((analysisRoot !== undefined) && fileName.startsWith(analysisRoot,))
      return [sourceFile,];
    return [];
  },);
  /**
   * Complete inclusion-scope identity for process-local final index.
   */
  const indexedFileListDigest = contentDigest(
    indexedSourceFiles
      .map(function indexedSourceName(sourceFile,): string {
        return sourceFile.fileName;
      },)
      .join('\0',),
  );
  /**
   * Current process snapshot signatures for every project source.
   */
  const sourceSignatures = effectProjectSourceSignatures({
    project,
    activeSourceFile,
    fileNames,
  },);
  /**
   * Final fixed-point index reusable for unchanged project snapshot.
   */
  const cachedIndex = cachedFinalEffectIndex({
    projectKey: cacheProjectKey,
    fileListDigest: indexedFileListDigest,
    sourceSignatures,
  },);
  if (cachedIndex !== FINAL_EFFECT_INDEX_CACHE_MISS)
    return cachedIndex;
  /**
   * Complete configured-project identity used by process-layer invalidation.
   */
  const projectFingerprint = effectProjectFingerprint({
    project,
    activeSourceFile,
  },);
  /**
   * Direct-summary identity including analysis-scope policy.
   */
  const projectDigest = contentDigest(
    `${projectFingerprint.digest}\0${analysisRoot ?? ''}`,
  );
  /**
   * Persistent scope identity separating analysis-root policies.
   */
  const scopeKey = `${project.configFileName}\0${analysisRoot ?? ''}`;
  /**
   * Current program state validating incremental persistent entries.
   */
  const dependencyState = {
    surfaces: projectFingerprint.surfaces,
    sourceDigests: projectFingerprint.sourceDigests,
  };
  /**
   * Indexed scope membership for closure walks.
   */
  const indexedFileNames = new Set(
    indexedSourceFiles.map(function indexedName(sourceFile,): string {
      return sourceFile.fileName;
    },),
  );
  /**
   * Closure resolver seeded by validated entries, resolving misses freshly.
   */
  const closureResolver = createDependencyClosureResolver({
    project,
    indexedFileNames,
    sourceDigests: projectFingerprint.sourceDigests,
  },);
  /**
   * Mutable summaries keyed by stable declaration identity.
   */
  const summaries = new Map<string, MutableEffectSummary>();
  /**
   * Current owned source paths used to prune rename and deletion residue.
   */
  const activeFiles = new Set<string>();

  /**
   * Builds both-layer identity for one indexed source.
   *
   * @param sourceFile - Indexed source.
   *
   * @returns shared layered-cache identity.
   */
  function sourceIdentity(sourceFile: SourceFile,): {
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
   * Sources whose summaries both cache layers missed, scanned in second phase.
   */
  const missedSourceFiles = indexedSourceFiles.filter(function readCachedSource(sourceFile,): boolean {
    activeFiles.add(sourceFile.fileName,);
    /**
     * Layered hit carrying cloned summaries and recorded closure edges.
     */
    const hit = readCachedSummariesForSource({
      identity: sourceIdentity(sourceFile,),
      state: dependencyState,
    },);
    if (hit === LAYERED_SUMMARY_CACHE_MISS)
      return true;
    closureResolver.seedEdges({
      fileName: sourceFile.fileName,
      edges: hit.edges,
    },);
    hit.summaries
      .forEach(function addSummary(
        summary,
        key,
      ): void {
        summaries.set(
          key,
          summary,
        );
      },);
    return false;
  },);
  missedSourceFiles.forEach(function scanMissedSource(sourceFile,): void {
    /**
     * Callable declarations decoded only after both cache layers miss.
     */
    const declarations = collectAstNodes(sourceFile,)
      .filter(function retainEffectCallable(node,): node is EffectCallableDeclaration {
        return isEffectCallableDeclaration(node,);
      },);
    /**
     * Freshly scanned direct summaries for one source.
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
              buildIndex(options,) {
                return buildEffectSummaryIndex(options,);
              },
            },);
          },
        },),
      ];
    },),);
    storeCreatedSummariesForSource({
      identity: sourceIdentity(sourceFile,),
      summaries: fileSummaries,
      surfaces: projectFingerprint.surfaces,
      closure: closureResolver.closureFor(sourceFile.fileName,),
    },);
    fileSummaries.forEach(function addCreatedSummary(
      summary,
      key,
    ): void {
      summaries.set(
        key,
        summary,
      );
    },);
  },);
  pruneDirectSummaryCache({
    projectKey: project.configFileName,
    activeFiles,
  },);
  propagateEffects(summaries,);
  /**
   * Guaranteed foreign provenance indexed independently from mutable effects.
   */
  const foreignByCallable = propagateForeignBorrowed(summaries,);
  /**
   * Immutable lookup over completed fixed-point summaries.
   */
  const index: EffectSummaryIndex = {
    get(declaration,): CallableEffectSummary | typeof NO_EFFECT_SUMMARY {
      /**
       * Stable identity shared by effect and provenance indexes.
       */
      const key = callableKey(declaration,);
      /**
       * Internal summary matching declaration identity.
       */
      const summary = summaries.get(key,);
      if (summary === undefined)
        return NO_EFFECT_SUMMARY;
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
        foreignBorrowedParameterIndexes: foreignByCallable.get(key,) ?? new Set<number>(),
        callbackRelations: [...summary.relations,],
      };
    },
  };
  cacheFinalEffectIndex({
    projectKey: cacheProjectKey,
    fileListDigest: indexedFileListDigest,
    sourceSignatures,
    index,
  },);
  return index;
}
