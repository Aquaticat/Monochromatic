/**
 * Ownership-only direct summary for complete inbound proof.
 *
 * @module
 */

import {
  type BinaryExpression,
  type ForOfStatement,
  SyntaxKind,
  type VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isBinaryExpression,
  isCallExpression,
  isForOfStatement,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { activeCallableBodyNodes, } from './closure-activity.ts';
import {
  discoverAliasOrigins,
  registerBindingOrigin,
} from './effect-binding-origins.ts';
import {
  collectAstNodes,
  type EffectCallableDeclaration,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import { bindingContainsForeignBorrowed, } from './foreign-borrowed-classifier.ts';
import { addForeignBorrowedCallEdge, } from './foreign-borrowed-call-edge.ts';

/**
 * Creates ownership seed needed by foreign ownership fixed point.
 *
 * @param project - TypeScript project resolving owned calls and argument origins.
 *
 * @param declaration - Callable whose inbound edges are required.
 *
 * @returns direct marker and binding facts with empty effect dimensions.
 *
 * @example
 * ```ts
 * foreignBorrowedOwnershipSeed({ project, declaration });
 * ```
 */
export function foreignBorrowedOwnershipSeed({
  project,
  declaration,
}: {
  readonly project: Project;
  readonly declaration: EffectCallableDeclaration;
}): MutableEffectSummary {
  /**
   * Binding origins seeded by callable parameters.
   */
  const bindingOriginBySymbolId = new Map<number, Set<number>>();
  declaration.parameters
    .forEach(function registerParameter(
      parameter,
      parameterIndex,
    ): void {
    registerBindingOrigin({
      project,
      name: parameter.name,
      parameterIndex,
      bindingOriginBySymbolId,
    },);
  },);
  /**
   * Explicit foreign marker indexes on current declaration.
   */
  const directForeignBorrowed = new Set<number>();
  for (const [parameterIndex, parameter,] of declaration.parameters
    .entries()) {
    if (bindingContainsForeignBorrowed({
      project,
      name: parameter.name,
    },))
      directForeignBorrowed.add(parameterIndex,);
  }
  /**
   * Ownership-only summary with effect dimensions intentionally empty.
   */
  const summary: MutableEffectSummary = {
    parameterCount: declaration.parameters
      .length,
    bindingOriginBySymbolId,
    directMutated: new Set(),
    directInvoked: new Set(),
    directOpaque: new Set(),
    opaqueProvenanceByParameter: new Map(),
    mutated: new Set(),
    invoked: new Set(),
    opaque: new Set(),
    directForeignBorrowed,
    directReturned: new Set(),
    relations: [],
    elementApplications: [],
    calls: [],
  };
  /**
   * Callable body absent for source-only signatures.
   */
  const body = 'body' in declaration ? declaration.body : undefined;
  if (body === undefined)
    return summary;
  /**
   * Complete body nodes used for alias-origin discovery.
   */
  const allBodyNodes = collectAstNodes(body,);
  /**
   * Variable aliases initialized from parameter-reachable state.
   */
  const variableDeclarations = allBodyNodes.filter(function variableDeclaration(node,): node is VariableDeclaration {
    return isVariableDeclaration(node,);
  },);
  /**
   * Simple assignments that may establish later aliases.
   */
  const aliasAssignments = allBodyNodes.filter(function aliasAssignment(node,): node is BinaryExpression {
    return isBinaryExpression(node,)
      && (node.operatorToken
        .kind
        === SyntaxKind.EqualsToken);
  },);
  /**
   * Iterations binding elements reached through parameter-owned iterables.
   */
  const forOfStatements = allBodyNodes.filter(function forOfStatement(node,): node is ForOfStatement {
    return isForOfStatement(node,);
  },);
  discoverAliasOrigins({
    project,
    variableDeclarations,
    aliasAssignments,
    forOfStatements,
    bindingOriginBySymbolId,
  },);
  return summary;
}

/**
 * Creates direct marker and owned-call facts for one callable.
 *
 * @param project - TypeScript project resolving owned calls and argument origins.
 *
 * @param declaration - Callable whose body calls are summarized.
 *
 * @param analysisRoot - Optional external package root admitted as owned.
 *
 * @returns ownership summary with every active direct call edge.
 *
 * @example
 * ```ts
 * foreignBorrowedDirectSummary({ project, declaration });
 * ```
 */
export function foreignBorrowedDirectSummary({
  project,
  declaration,
  analysisRoot,
}: {
  readonly project: Project;
  readonly declaration: EffectCallableDeclaration;
  readonly analysisRoot?: string;
}): MutableEffectSummary {
  /**
   * Marker and alias-origin seed for current callable.
   */
  const summary = foreignBorrowedOwnershipSeed({
    project,
    declaration,
  },);
  /**
   * Callable body absent for source-only signatures.
   */
  const body = 'body' in declaration ? declaration.body : undefined;
  if (body === undefined)
    return summary;
  activeCallableBodyNodes({
    project,
    body,
    bindingOriginBySymbolId: summary.bindingOriginBySymbolId,
  },)
    .forEach(function inspectOwnedCall(node,): void {
    if (!isCallExpression(node,))
      return;
    addForeignBorrowedCallEdge({
      project,
      declaration,
      call: node,
      summary,
      ...(analysisRoot === undefined) ? {} : { analysisRoot, },
    },);
  },);
  return summary;
}
