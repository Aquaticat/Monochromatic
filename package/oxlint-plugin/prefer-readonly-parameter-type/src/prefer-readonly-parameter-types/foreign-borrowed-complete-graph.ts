/**
 * Complete owned inbound graph for declaration-global foreign provenance.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { directEffectSummary, } from './direct-effect-summary.ts';
import type { EffectAnalysisBudget, } from './effect-analysis-budget.ts';
import {
  type ExternalCallableEffectResolver,
  EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE,
} from './external-callable-effect.ts';
import {
  callableKey,
  collectAstNodes,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import { propagateForeignBorrowed, } from './foreign-borrowed-propagation.ts';

/**
 * Rejects external effects during ownership-only graph construction.
 *
 * External implementation details cannot add owned inbound edges inside the
 * current project, so opening their projects would add cost without changing
 * foreign ownership proof.
 */
const EXTERNAL_EFFECT_UNAVAILABLE: ExternalCallableEffectResolver = function unavailableExternalEffect() {
  return EXTERNAL_CALLABLE_EFFECT_UNAVAILABLE;
};

/**
 * Computes foreign parameter identities from every owned inbound call without external package analysis.
 *
 * @param project - TypeScript project resolving owned calls.
 *
 * @param indexedSourceFiles - Complete source scope admitted by ownership policy.
 *
 * @param analysisBudget - Shared fail-closed project analysis budget.
 *
 * @param analysisRoot - Optional external package root admitted as owned.
 *
 * @returns foreign parameter indexes by stable callable key.
 *
 * @example
 * ```ts
 * completeForeignBorrowedGraph({ project, indexedSourceFiles, analysisBudget });
 * ```
 */
export function completeForeignBorrowedGraph({
  project,
  indexedSourceFiles,
  analysisBudget,
  analysisRoot,
}: {
  readonly project: Project;
  readonly indexedSourceFiles: ReadonlyMap<string, SourceFile>;
  readonly analysisBudget: EffectAnalysisBudget;
  readonly analysisRoot?: string;
}): ReadonlyMap<string, ReadonlySet<number>> {
  /**
   * Ownership-only direct summaries for every callable in admitted scope.
   */
  const summaries = new Map<string, MutableEffectSummary>();
  indexedSourceFiles.forEach(function scanInboundSource(sourceFile,): void {
    analysisBudget.assertAvailable(`foreign inbound source ${sourceFile.fileName}`,);
    /**
     * Start time for one ownership-only source scan.
     */
    const startedAt = analysisBudget.start();
    collectAstNodes(sourceFile,)
      .filter(isEffectCallableDeclaration,)
      .forEach(function summarizeInboundCallable(declaration,): void {
        summaries.set(
          callableKey(declaration,),
          directEffectSummary({
            project,
            declaration,
            externalEffectResolver: EXTERNAL_EFFECT_UNAVAILABLE,
            ...(analysisRoot === undefined) ? {} : { analysisRoot, },
          },),
        );
      },);
    analysisBudget.record({
      startedAt,
      phase: `foreign inbound source ${sourceFile.fileName}`,
    },);
  },);
  return propagateForeignBorrowed(summaries,);
}
