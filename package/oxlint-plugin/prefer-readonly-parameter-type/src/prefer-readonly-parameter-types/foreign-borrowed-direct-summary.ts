/**
 * Ownership-only direct summary for complete inbound proof.
 *
 * @module
 */

import type {
  BinaryExpression,
  ForOfStatement,
  VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isBinaryExpression,
  isCallExpression,
  isForOfStatement,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import { SyntaxKind, } from 'typescript/unstable/ast';
import type { Project, } from 'typescript/unstable/sync';

import { activeCallableBodyNodes, } from './closure-activity.ts';
import {
  discoverAliasOrigins,
  registerBindingOrigin,
} from './effect-binding-origins.ts';
import {
  ALL_PACKAGED_PROPERTIES,
  callableDeclaration,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { declarationDirectlyOwnsNode, } from './effect-foreign-inbound.ts';
import { addOwnedCallEdge, } from './effect-owned-call-edge.ts';
import {
  collectAstNodes,
  isEffectCallableDeclaration,
  type EffectCallableDeclaration,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';
import { bindingContainsForeignBorrowed, } from './foreign-borrowed-classifier.ts';

/**
 * Creates minimum summary needed by foreign ownership fixed point.
 *
 * @param project - TypeScript project resolving owned calls and argument origins.
 *
 * @param declaration - Callable whose inbound edges are required.
 *
 * @param analysisRoot - Optional external package root admitted as owned.
 *
 * @returns direct marker and owned-call facts with empty effect dimensions.
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
   * Binding origins seeded by callable parameters.
   */
  const bindingOriginBySymbolId = new Map<number, number>();
  declaration.parameters.forEach(function registerParameter(parameter, parameterIndex,): void {
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
  for (const [parameterIndex, parameter,] of declaration.parameters.entries()) {
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
    parameterCount: declaration.parameters.length,
    bindingOriginBySymbolId,
    directMutated: new Set(),
    directInvoked: new Set(),
    directOpaque: new Set(),
    opaqueProvenanceByParameter: new Map(),
    mutated: new Set(),
    invoked: new Set(),
    opaque: new Set(),
    directForeignBorrowed,
    relations: [],
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
      && (node.operatorToken.kind === SyntaxKind.EqualsToken);
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
  activeCallableBodyNodes({
    project,
    body,
    bindingOriginBySymbolId,
  },).forEach(function inspectOwnedCall(node,): void {
    if (!isCallExpression(node,))
      return;
    /**
     * Resolved source declaration selected by overload when available.
     */
    const resolvedDeclaration = project.checker
      .getResolvedSignature(node,)
      ?.declaration
      ?.resolve(project,);
    /**
     * Owned callee selected from signature before expression fallback.
     */
    const signatureCallee = (resolvedDeclaration !== undefined)
      && isEffectCallableDeclaration(resolvedDeclaration,)
      ? callableDeclaration({
        project,
        node: resolvedDeclaration,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
      },)
      : OWNED_CALLABLE_UNAVAILABLE;
    /**
     * Final owned callee declaration.
     */
    const callee = signatureCallee === OWNED_CALLABLE_UNAVAILABLE
      ? callableDeclaration({
        project,
        node: node.expression,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
      },)
      : signatureCallee;
    if (callee === OWNED_CALLABLE_UNAVAILABLE)
      return;
    /**
     * Caller parameter roots corresponding to call arguments.
     */
    const allArgumentIndexes = node.arguments.map(function argumentIndexes(argument,): readonly number[] {
      return parameterIndexes({
        checker: project.checker,
        bindingOriginBySymbolId,
        node: argument,
        includedPropertyNames: ALL_PACKAGED_PROPERTIES,
      },);
    },);
    addOwnedCallEdge({
      project,
      checker: project.checker,
      bindingOriginBySymbolId,
      call: node,
      callee,
      allArgumentIndexes,
      summary,
      foreignInbound: declarationDirectlyOwnsNode({
        node,
        declaration,
      },),
      ...(analysisRoot === undefined) ? {} : { analysisRoot, },
    },);
  },);
  return summary;
}
