/**
 * Whole-project parameter mutation summaries over TypeScript 7 semantic AST.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { directEffectSummary, } from './direct-effect-summary.ts';
import { propagateCallbackRelations, } from './effect-callback-relation.ts';
import {
  cachedFinalEffectIndex,
  cacheFinalEffectIndex,
  FINAL_EFFECT_INDEX_CACHE_MISS,
} from './effect-final-index-cache.ts';
import {
  effectProjectFingerprint,
  effectProjectSourceSignatures,
} from './effect-project-fingerprint.ts';
import {
  directSummariesForSource,
  pruneDirectSummaryCache,
} from './effect-summary-cache.ts';
import { contentDigest, } from './effect-summary-cache-identity.ts';
import { propagateInvokedCapabilities, } from './effect-invoked-capability.ts';
import { externalCallableEffect, } from './external-callable-effect.ts';
import { propagateCalleeIndexes, } from './effect-propagation-indexes.ts';
import {
  callableKey,
  collectAstNodes,
  type EffectCallableDeclaration,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import { propagateUncertaintyProvenance, } from './effect-uncertainty-provenance.ts';
import {
  type CallableEffectSummary,
  type EffectSummaryIndex,
  NO_EFFECT_SUMMARY,
} from './effect-summary-index.ts';
import { propagateForeignBorrowed, } from './foreign-borrowed-propagation.ts';
import { isWorkspaceSourceFileName, } from './workspace-source-path.ts';

/**
 * Mutable effect dimensions propagated per parameter.
 */
const EFFECT_DIMENSION_COUNT = 4;

/**
 * Empty exclusion set for ordinary effect propagation.
 */
const NO_EXCLUDED_EFFECT_INDEXES: ReadonlySet<number> = new Set();

export {
  type CallableEffectSummary,
  type EffectSummaryIndex,
  NO_EFFECT_SUMMARY,
} from './effect-summary-index.ts';

/**
 * Propagates direct, transitive, recursive, and higher-order effects to fixed point.
 *
 * @param summaries - Mutable summaries keyed by declaration.
 *
 * @mutates summaries - Propagates call effects to fixed point.
 */
function propagateEffects(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): void {
  /**
   * Total effect bits that can change before fixed point.
   */
  const effectBitCount = [...summaries.values(),].reduce(
    function total(
    totalCount,
    summary,
  ): number {
    return totalCount + (summary.parameterCount * EFFECT_DIMENSION_COUNT);
  },
    0,
  );
  /**
   * Mutable convergence state shared across each propagation pass.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed && (state.pass <= effectBitCount)) {
    state.changed = false;
    state.pass++;
    summaries.forEach(
      /**
       * Propagates every owned call edge from one caller summary.
       *
       * @param summary - Caller summary receiving transitive effects.
       *
       * @mutates summary - Adds callee and callback effects.
       */
      function propagateSummary(summary,): void {
        summary.calls
          .forEach(function propagateCall(edge,): void {
            /**
             * Summary for owned callee edge.
             */
            const calleeSummary = summaries.get(edge.calleeKey,);
            if (calleeSummary === undefined)
              return;
            state.changed = propagateInvokedCapabilities({
              summaries,
              summary,
              calleeSummary,
              edge,
            },) || state.changed;
            state.changed = propagateCalleeIndexes({
              target: summary.mutated,
              edge,
              calleeIndexes: calleeSummary.mutated,
              excludedIndexes: calleeSummary.invoked,
            },) || state.changed;
            state.changed = propagateCalleeIndexes({
              target: summary.opaque,
              edge,
              calleeIndexes: calleeSummary.opaque,
              excludedIndexes: NO_EXCLUDED_EFFECT_INDEXES,
            },) || state.changed;
            state.changed = propagateCalleeIndexes({
              target: summary.documentedUncertain,
              edge,
              calleeIndexes: calleeSummary.documentedUncertain,
              excludedIndexes: NO_EXCLUDED_EFFECT_INDEXES,
            },) || state.changed;
            state.changed = propagateUncertaintyProvenance({
              summary,
              calleeSummary,
              edge,
              calleeIndexes: calleeSummary.opaque,
            },) || state.changed;
            state.changed = propagateUncertaintyProvenance({
              summary,
              calleeSummary,
              edge,
              calleeIndexes: calleeSummary.documentedUncertain,
            },) || state.changed;
            state.changed = propagateCallbackRelations({
              summaries,
              summary,
              calleeSummary,
              edge,
            },) || state.changed;
          },);
      },);
  }
}

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
      .map(function sourceIdentity(sourceFile,): string {
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
   * Complete configured-project identity used by persistent direct summaries.
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
   * Mutable summaries keyed by stable declaration identity.
   */
  const summaries = new Map<string, MutableEffectSummary>();
  /**
   * Current owned source paths used to prune rename and deletion residue.
   */
  const activeFiles = new Set<string>();
  indexedSourceFiles.forEach(function gatherSource(sourceFile,): void {
    /**
     * Exact source path participating in direct and propagated summaries.
     */
    const { fileName, } = sourceFile;
    activeFiles.add(fileName,);
    /**
     * Direct summaries reused when exact source text remains unchanged.
     */
    const fileSummaries = directSummariesForSource({
      projectKey: project.configFileName,
      projectDigest,
      fileName,
      sourceText: sourceFile.text,
      ...(cacheRootOverride === undefined) ? {} : { cacheRootOverride, },
      create(): ReadonlyMap<string, MutableEffectSummary> {
        /**
         * Callable declarations decoded only after both cache layers miss.
         */
        const declarations = collectAstNodes(sourceFile,)
          .filter(function retainEffectCallable(node,): node is EffectCallableDeclaration {
            return isEffectCallableDeclaration(node,);
          },);
        return new Map(declarations.map(function gatherCallable(declaration,): [
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
      },
    },);
    fileSummaries.forEach(function addSummary(
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
