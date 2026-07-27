/**
 * Demand-bounded owned inbound graph for declaration-global foreign provenance.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  Node,
  SourceFile,
} from 'typescript/unstable/ast';
import { isCallExpression, } from 'typescript/unstable/ast/is';
import type {
  Project,
  SignatureUsage,
} from 'typescript/unstable/sync';

import type { EffectAnalysisBudget, } from './effect-analysis-budget.ts';
import {
  callableKey,
  type EffectCallableDeclaration,
  isEffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';
import { addForeignBorrowedCallEdge, } from './foreign-borrowed-call-edge.ts';
import { foreignBorrowedOwnershipSeed, } from './foreign-borrowed-direct-summary.ts';
import { propagateForeignBorrowed, } from './foreign-borrowed-propagation.ts';

/**
 * Foreign inbound graph logger.
 */
const l = tagged({ tag: 'foreign-borrowed-complete-graph', },);

/**
 * Sentinel when TypeScript cannot enumerate signature usage.
 */
const SIGNATURE_USAGE_UNAVAILABLE: unique symbol = Symbol(
  'TypeScript signature usages could not be enumerated',
);

/**
 * Finds nearest callable owner admitted by effect source policy.
 *
 * @param node - Call expression whose caller is needed.
 *
 * @param indexedSourceFiles - Sources admitted as owned.
 *
 * @returns caller declaration or unavailable sentinel.
 */
function nearestOwnedCallable({
  node,
  indexedSourceFiles,
}: {
  readonly node: Node;
  readonly indexedSourceFiles: ReadonlyMap<string, SourceFile>;
}): EffectCallableDeclaration | typeof OWNED_CALLABLE_UNAVAILABLE {
  /**
   * Parent cursor seeking callable boundary.
   */
  const cursor: { current: Node; } = { current: node.parent, };
  while (!isEffectCallableDeclaration(cursor.current,)) {
    /**
     * Next parent, self-parented source boundary, or absent past a source-file
     * root.
     *
     * A source file reports no parent at all rather than parenting itself,
     * despite the non-optional `parent` in TypeScript's node types, so the root
     * has to end the walk alongside the self-parented case.
     */
    const { parent, } = cursor.current;
    if ((parent === undefined) || (parent === cursor.current))
      return OWNED_CALLABLE_UNAVAILABLE;
    cursor.current = parent;
  }
  return indexedSourceFiles.has(cursor.current
    .getSourceFile()
    .fileName,)
    ? cursor.current
    : OWNED_CALLABLE_UNAVAILABLE;
}

/**
 * Reads project-wide usages for one exact callable signature.
 *
 * @param project - TypeScript semantic project snapshot.
 *
 * @param declaration - Callable whose inbound references are required.
 *
 * @returns signature usages or unavailable sentinel after logged failure.
 */
function signatureUsages({
  project,
  declaration,
}: {
  readonly project: Project;
  readonly declaration: EffectCallableDeclaration;
}): readonly SignatureUsage[] | typeof SIGNATURE_USAGE_UNAVAILABLE {
  try {
    return project.checker
      .getSignatureUsage(declaration,);
  }
  catch (error) {
    l.error(
      `signature usage unavailable for ${callableKey(declaration,)}: ${String(error,)}`,
    );
    return SIGNATURE_USAGE_UNAVAILABLE;
  }
}

/**
 * Creates ordinary unknown inbound edge that removes inferred provenance.
 *
 * @param declaration - Callee whose unknown inbound must fail closed.
 *
 * @returns synthetic caller summary carrying ordinary argument origins.
 */
function unknownInboundSummary(
  declaration: EffectCallableDeclaration,
): MutableEffectSummary {
  /**
   * Callee parameter positions represented by empty ordinary origins.
   */
  const parameterIndexes = declaration.parameters
    .map(function emptyOrigins(): readonly number[] {
    return [];
  },);
  return {
    parameterCount: 0,
    bindingOriginBySymbolId: new Map(),
    directMutated: new Set(),
    directInvoked: new Set(),
    directOpaque: new Set(),
    opaqueProvenanceByParameter: new Map(),
    mutated: new Set(),
    invoked: new Set(),
    opaque: new Set(),
    directForeignBorrowed: new Set(),
    relations: [],
    calls: [{
      calleeKey: callableKey(declaration,),
      calleeFileName: declaration.getSourceFile()
        .fileName,
      arguments: parameterIndexes,
      foreignArguments: parameterIndexes,
      directForeignArguments: declaration.parameters
        .map(function ordinaryArgument(): boolean {
        return false;
      },),
      foreignInbound: true,
      callbackKeys: declaration.parameters
        .map(function unavailableCallback() {
        return OWNED_CALLABLE_UNAVAILABLE;
      },),
      callbackFileNames: declaration.parameters
        .map(function unavailableCallbackFile() {
        return OWNED_CALLABLE_UNAVAILABLE;
      },),
    },],
  };
}

/**
 * Records unknown inbound once for one callee.
 *
 * @param summaries - Mutable ownership summaries.
 *
 * @param declaration - Callee whose inbound cannot be proven.
 */
function addUnknownInbound({
  summaries,
  declaration,
}: {
  readonly summaries: Map<string, MutableEffectSummary>;
  readonly declaration: EffectCallableDeclaration;
}): void {
  /**
   * Synthetic caller identity unique to callee.
   */
  const syntheticKey = `\0unknown-inbound:${callableKey(declaration,)}`;
  if (summaries.has(syntheticKey,))
    return;
  summaries.set(
    syntheticKey,
    unknownInboundSummary(declaration,),
  );
}

/**
 * Computes guaranteed foreign parameters through exact signature inbounds.
 *
 * TypeScript enumerates every reference to each demanded callable signature.
 * Caller summaries are then added backwards until no new callable owner is
 * reached. Non-call references, top-level calls, and unresolved owned edges
 * add ordinary inbounds and therefore reject inferred foreign provenance.
 *
 * @param project - TypeScript project resolving signature usages.
 *
 * @param indexedSourceFiles - Complete source scope admitted by ownership policy.
 *
 * @param rootDeclaration - Reached candidate requiring complete inbound proof.
 *
 * @param analysisBudget - Shared fail-closed project analysis budget.
 *
 * @param analysisRoot - Optional external package root admitted as owned.
 *
 * @returns foreign parameter indexes for demanded backwards closure.
 *
 * @example
 * ```ts
 * completeForeignBorrowedGraph({
 *   project,
 *   indexedSourceFiles,
 *   rootDeclaration,
 *   analysisBudget,
 * });
 * ```
 */
export function completeForeignBorrowedGraph({
  project,
  indexedSourceFiles,
  rootDeclaration,
  analysisBudget,
  analysisRoot,
}: {
  readonly project: Project;
  readonly indexedSourceFiles: ReadonlyMap<string, SourceFile>;
  readonly rootDeclaration: EffectCallableDeclaration;
  readonly analysisBudget: EffectAnalysisBudget;
  readonly analysisRoot?: string;
}): ReadonlyMap<string, ReadonlySet<number>> {
  /**
   * Ownership summaries in demanded backwards caller closure.
   */
  const summaries = new Map<string, MutableEffectSummary>();
  /**
   * Callable declarations queued for exact inbound discovery.
   */
  const queue: EffectCallableDeclaration[] = [rootDeclaration,];
  /**
   * Callable identities whose signature usages were enumerated.
   */
  const visited = new Set<string>();
  /**
   * Queue cursor avoiding recursive graph traversal.
   */
  const cursor = { current: 0, };
  while (cursor.current < queue.length) {
    /**
     * Current callable requiring direct facts and every inbound usage.
     */
    const declaration = queue[cursor.current];
    cursor.current++;
    if (declaration === undefined)
      throw new Error('Foreign inbound queue lost current declaration.',);
    /**
     * Stable current callable identity.
     */
    const key = callableKey(declaration,);
    if (visited.has(key,))
      continue;
    visited.add(key,);
    analysisBudget.assertAvailable(`foreign signature usage ${key}`,);
    if (!summaries.has(key,)) {
      summaries.set(
        key,
        foreignBorrowedOwnershipSeed({
          project,
          declaration,
        },),
      );
    }
    /**
     * Start time for exact TypeScript signature reference query.
     */
    const startedAt = analysisBudget.start();
    /**
     * Every project usage of current callable signature.
     */
    const usages = signatureUsages({
      project,
      declaration,
    },);
    analysisBudget.record({
      startedAt,
      phase: `foreign signature usage ${key}`,
    },);
    if (usages === SIGNATURE_USAGE_UNAVAILABLE) {
      addUnknownInbound({
        summaries,
        declaration,
      },);
      continue;
    }
    usages.forEach(function addInboundCaller(usage,): void {
      /**
       * Resolved call expression or non-call escape marker.
       */
      const call = usage.call
        ?.resolve(project,);
      if (call === undefined) {
        addUnknownInbound({
          summaries,
          declaration,
        },);
        return;
      }
      /**
       * Nearest callable owner admitted as project-owned source.
       */
      const caller = nearestOwnedCallable({
        node: call,
        indexedSourceFiles,
      },);
      if (caller === OWNED_CALLABLE_UNAVAILABLE) {
        addUnknownInbound({
          summaries,
          declaration,
        },);
        return;
      }
      /**
       * Stable caller identity.
       */
      const callerKey = callableKey(caller,);
      /**
       * Caller ownership seed receiving exact current usage edge.
       */
      const callerSummary = summaries.get(callerKey,)
        ?? foreignBorrowedOwnershipSeed({
          project,
          declaration: caller,
        },);
      summaries.set(
        callerKey,
        callerSummary,
      );
      queue.push(caller,);
      if (!isCallExpression(call,)) {
        addUnknownInbound({
          summaries,
          declaration,
        },);
        return;
      }
      /**
       * Call count before exact usage edge is added.
       */
      const priorCallCount = callerSummary.calls
        .length;
      /**
       * Whether exact usage resolved to owned callee.
       */
      const added = addForeignBorrowedCallEdge({
        project,
        declaration: caller,
        call,
        summary: callerSummary,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
      },);
      /**
       * Exact edge produced for current usage.
       */
      const exactEdge = callerSummary.calls[priorCallCount];
      if ((!added)
        || (callerSummary.calls
          .length
          !== (priorCallCount
          + 1))
        || (exactEdge === undefined)
        || (!exactEdge.foreignInbound)
        || (exactEdge.calleeKey !== key)) {
        callerSummary.calls
          .splice(priorCallCount,);
        addUnknownInbound({
          summaries,
          declaration,
        },);
      }
    },);
  }
  return propagateForeignBorrowed(summaries,);
}
