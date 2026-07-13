/**
 * Direct syntax and call-edge extraction for callable effect summaries.
 *
 * @module
 */

import {
  type FunctionLikeDeclaration,
  type Node,
  SyntaxKind,
} from 'typescript/unstable/ast';
import {
  isAssignmentOperator,
  isBinaryExpression,
  isCallExpression,
  isDeleteExpression,
  isIdentifier,
  isPostfixUnaryExpression,
  isPrefixUnaryExpression,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { inspectEffectCall, } from './effect-call-analysis.ts';
import {
  addEffectIndex,
  collectAstNodes,
  expressionRoot,
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Project and callable declarations mirror TypeScript semantic identities required for effect analysis. */
/**
 * Builds direct syntax facts and call edges for one callable.
 *
 * @param project - TypeScript project owning declaration.
 *
 * @param declaration - Callable declaration to inspect.
 *
 * @returns mutable summary seeded with direct effects.
 *
 * @example
 * ```ts
 * const summary = directEffectSummary({ project, declaration });
 * ```
 */
export function directEffectSummary({
  project,
  declaration,
}: {
  readonly project: Project;
  readonly declaration: FunctionLikeDeclaration;
},): MutableEffectSummary {
  /**
   * TypeScript checker for current project.
   */
  const { checker, } = project;
  /**
   * Callable parameter symbol identifiers in source order.
   */
  const parameterSymbolIds = declaration.parameters
    .map(function parameterId(parameter,) {
    return checker.getSymbolAtLocation(parameter.name,)
      ?.id
      ?? PARAMETER_INDEX_UNAVAILABLE;
  },);
  /**
   * Mutable summary receiving direct and propagated effects.
   */
  const summary: MutableEffectSummary = {
    parameterSymbolIds,
    directMutated: new Set(),
    directOpaque: new Set(),
    mutated: new Set(),
    opaque: new Set(),
    relations: [],
    calls: [],
  };
  if (declaration.body === undefined)
    return summary;

  collectAstNodes(declaration.body,)
    .forEach(function inspect(node,): void {
    if (isBinaryExpression(node,)
      && isAssignmentOperator(node.operatorToken
        .kind,)) {
      inspectDirectWrite({
        project,
        parameterSymbolIds,
        summary,
        node: node.left,
      },);
      return;
    }
    if (isDeleteExpression(node,)) {
      inspectDirectWrite({
        project,
        parameterSymbolIds,
        summary,
        node: node.expression,
      },);
      return;
    }
    if ((isPrefixUnaryExpression(node,) || isPostfixUnaryExpression(node,))
      && ((node.operator === SyntaxKind.PlusPlusToken)
        || (node.operator === SyntaxKind.MinusMinusToken))) {
      inspectDirectWrite({
        project,
        parameterSymbolIds,
        summary,
        node: node.operand,
      },);
      return;
    }
    if (isCallExpression(node,)) {
      inspectEffectCall({
        project,
        checker,
        parameterSymbolIds,
        call: node,
        summary,
      },);
    }
  },);
  summary.directMutated
    .forEach(function seed(index,): void {
    summary.mutated
      .add(index,);
  },);
  summary.directOpaque
    .forEach(function seed(index,): void {
    summary.opaque
      .add(index,);
  },);
  return summary;
}

/**
 * Records direct write rooted at callable parameter.
 *
 * @param project - TypeScript project resolving root symbol.
 *
 * @param parameterSymbolIds - Callable parameter symbols by index.
 *
 * @param summary - Summary receiving direct mutation.
 *
 * @param node - Write target expression.
 */
function inspectDirectWrite({
  project,
  parameterSymbolIds,
  summary,
  node,
}: {
  readonly project: Project;
  readonly parameterSymbolIds: readonly (
    number | typeof PARAMETER_INDEX_UNAVAILABLE
  )[];
  readonly summary: MutableEffectSummary;
  readonly node: Node;
},): void {
  /**
   * Root node of write target.
   */
  const expressionRootNode = expressionRoot(node,);
  if (!isIdentifier(expressionRootNode,))
    return;
  /**
   * Parameter symbol matching write root.
   */
  const symbol = project.checker
    .getSymbolAtLocation(expressionRootNode,);
  if (symbol === undefined)
    return;
  /**
   * Parameter index matching symbol, or negative lookup sentinel.
   */
  const index = parameterSymbolIds.indexOf(symbol.id,);
  addEffectIndex({
    target: summary.directMutated,
    value: index === (-1) ? PARAMETER_INDEX_UNAVAILABLE : index,
  },);
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
