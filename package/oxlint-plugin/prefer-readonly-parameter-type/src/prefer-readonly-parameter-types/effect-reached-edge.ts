/**
 * Fail-closed owned-edge validation for demand-driven effect analysis.
 *
 * @module
 */

import { SemanticBridgeError, } from './semantic-bridge-error.ts';
import type { MutableEffectSummary, } from './effect-summary-model.ts';

/**
 * Tests whether foreign provenance requires complete declaration inbounds.
 *
 * @param summary - Reached direct summary under inspection.
 *
 * @returns whether declaration-global foreign proof needs complete graph.
 *
 * @example
 * ```ts
 * summaryRequiresCompleteInboundGraph(summary);
 * ```
 */
export function summaryRequiresCompleteInboundGraph(
  summary: MutableEffectSummary,
): boolean {
  /**
   * Explicit marker count on current declaration.
   */
  const directForeignCount = summary
    .directForeignBorrowed
    .size;
  if (directForeignCount > 0)
    return true;
  return summary.calls
    .some(function hasDirectForeignArgument(edge,): boolean {
      return edge.directForeignArguments
        .includes(true,);
    },);
}

/**
 * Adds exact owned source dependency or rejects inconsistent scope.
 *
 * @param dependencies - Dependency set receiving owned source.
 *
 * @param indexedFileNames - Exact source scope admitted by analyzer.
 *
 * @param fileName - Owned edge source path.
 *
 * @mutates dependencies - Adds validated source path.
 */
function addOwnedDependency({
  dependencies,
  indexedFileNames,
  fileName,
}: {
  readonly dependencies: Set<string>;
  readonly indexedFileNames: ReadonlySet<string>;
  readonly fileName: string;
}): void {
  if (!indexedFileNames.has(fileName,)) {
    throw new SemanticBridgeError({
      reason: 'source-file-not-found',
      message: `Owned effect edge reached source outside indexed snapshot: ${fileName}.`,
    },);
  }
  dependencies.add(fileName,);
}

/**
 * Collects owned callee and callback source paths from direct summaries.
 *
 * @param fileSummaries - Direct summaries from one reached source.
 *
 * @param indexedFileNames - Exact owned source scope.
 *
 * @returns unique reached source paths in stable order.
 *
 * @throws SemanticBridgeError when owned edge source is absent from scope.
 *
 * @example
 * ```ts
 * reachedSourceFileNames({ fileSummaries, indexedFileNames });
 * ```
 */
export function reachedSourceFileNames({
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
        addOwnedDependency({
          dependencies,
          indexedFileNames,
          fileName: edge.calleeFileName,
        },);
        edge.callbackFileNames
          .forEach(function collectCallbackFile(fileName,): void {
            if ((typeof fileName) !== 'string')
              return;
            addOwnedDependency({
              dependencies,
              indexedFileNames,
              fileName,
            },);
          },);
      },);
  },);
  return [...dependencies,].toSorted();
}

/**
 * Verifies every loaded owned key has a completed summary.
 *
 * @param summaries - Complete reached summary map after source expansion.
 *
 * @throws SemanticBridgeError when an owned callee or callback key is absent.
 *
 * @example
 * ```ts
 * assertReachedCallSummaries(summaries);
 * ```
 */
export function assertReachedCallSummaries(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): void {
  for (const summary of summaries.values()) {
    for (const edge of summary.calls) {
      if (!summaries.has(edge.calleeKey,)) {
        throw new SemanticBridgeError({
          reason: 'node-not-found',
          message: `Owned effect edge lacks callee summary: ${edge.calleeKey}.`,
        },);
      }
      for (const callbackKey of edge.callbackKeys) {
        if (((typeof callbackKey) === 'string')
          && (!summaries.has(callbackKey,))) {
          throw new SemanticBridgeError({
            reason: 'node-not-found',
            message: `Owned effect edge lacks callback summary: ${callbackKey}.`,
          },);
        }
      }
    }
  }
}
