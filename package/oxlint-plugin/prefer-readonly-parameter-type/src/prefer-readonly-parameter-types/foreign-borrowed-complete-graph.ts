/**
 * Complete owned inbound graph for declaration-global foreign provenance.
 *
 * @module
 */

import type { SourceFile, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { foreignBorrowedDirectSummary, } from './foreign-borrowed-direct-summary.ts';
import type { EffectAnalysisBudget, } from './effect-analysis-budget.ts';
import {
  callableKey,
  collectAstNodes,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import { propagateForeignBorrowed, } from './foreign-borrowed-propagation.ts';

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
          foreignBorrowedDirectSummary({
            project,
            declaration,
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
