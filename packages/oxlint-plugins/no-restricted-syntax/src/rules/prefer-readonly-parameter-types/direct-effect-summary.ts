/**
 * Direct syntax and call-edge extraction for callable effect summaries.
 *
 * @module
 */

import {
  type BinaryExpression,
  type Node,
  SyntaxKind,
  type VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isAssignmentOperator,
  isBinaryExpression,
  isCallExpression,
  isDeleteExpression,
  isIdentifier,
  isPostfixUnaryExpression,
  isPrefixUnaryExpression,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { activeCallableBodyNodes, } from './closure-activity.ts';
import { applyVerifiedAdapterContracts, } from './effect-adapter.ts';
import {
  discoverAliasOrigins,
  expressionOrigin,
  registerBindingOrigin,
} from './effect-binding-origins.ts';
import { inspectEffectCall, } from './effect-call-analysis.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
  mutationTargetIndexes,
} from './mutation-contract-query.ts';
import {
  addEffectIndex,
  type EffectCallableDeclaration,
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/* oxlint-disable typescript/prefer-readonly-parameter-types -- TypeScript nodes and mutable origin map are semantic-analysis identities and accumulators. */
/**
 * Records direct write rooted at callable parameter or alias.
 *
 * @param project - TypeScript project resolving root symbol.
 *
 * @param bindingOriginBySymbolId - Local binding origins by symbol identity.
 *
 * @param summary - Summary receiving direct mutation.
 *
 * @param node - Write target expression.
 */
function inspectDirectWrite({
  project,
  bindingOriginBySymbolId,
  summary,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly summary: MutableEffectSummary;
  readonly node: Node;
},): void {
  if (isIdentifier(node,))
    return;
  addEffectIndex({
    target: summary.directMutated,
    value: expressionOrigin({
      project,
      bindingOriginBySymbolId,
      node,
    },),
  },);
}

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
  readonly declaration: EffectCallableDeclaration;
},): MutableEffectSummary {
  /**
   * TypeScript checker for current project.
   */
  const { checker, } = project;
  /**
   * Binding symbol origins seeded by callable parameters.
   */
  const bindingOriginBySymbolId = new Map<number, number>();
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
   * Mutable summary receiving direct and propagated effects.
   */
  const summary: MutableEffectSummary = {
    parameterCount: declaration.parameters
      .length,
    bindingOriginBySymbolId,
    directMutated: new Set(),
    directOpaque: new Set(),
    opaqueProvenanceByParameter: new Map(),
    mutated: new Set(),
    opaque: new Set(),
    relations: [],
    calls: [],
  };
  /**
   * Callable implementation body, absent for source signatures.
   */
  const body = 'body' in declaration ? declaration.body : undefined;
  if (body === undefined) {
    /**
     * Authored bodyless mutation contracts used as conservative call effects.
     */
    const contracts = mutationContractsForDeclaration({
      declaration,
      sourceFile: declaration.getSourceFile(),
    },);
    if (contracts === MUTATION_CONTRACT_UNAVAILABLE)
      return summary;
    /**
     * Contract target names mapped to source parameter indexes.
     */
    const targetIndexes = mutationTargetIndexes({
      declaration,
      sourceFile: declaration.getSourceFile(),
    },);
    contracts.blocks
      .forEach(function seedContract(block,): void {
      addEffectIndex({
        target: summary.mutated,
        value: targetIndexes.get(block.parameterName,)
          ?? PARAMETER_INDEX_UNAVAILABLE,
      },);
    },);
    return summary;
  }
  /**
   * Body nodes shared by alias discovery and effect inspection.
   */
  const bodyNodes = activeCallableBodyNodes({
    project,
    body,
  },);
  /**
   * Variable declarations that may alias parameter-reachable state.
   */
  const variableDeclarations = bodyNodes.filter(function variableDeclaration(node,): node is VariableDeclaration {
    return isVariableDeclaration(node,);
  },);
  /**
   * Simple assignments that may establish aliases after declaration.
   */
  const aliasAssignments = bodyNodes.filter(function aliasAssignment(node,): node is BinaryExpression {
    return isBinaryExpression(node,)
      && (node.operatorToken
        .kind
        === SyntaxKind.EqualsToken);
  },);
  discoverAliasOrigins({
    project,
    variableDeclarations,
    aliasAssignments,
    bindingOriginBySymbolId,
  },);
  bodyNodes.forEach(function inspect(node,): void {
    if (isBinaryExpression(node,)
      && isAssignmentOperator(node.operatorToken
        .kind,)) {
      inspectDirectWrite({
        project,
        bindingOriginBySymbolId,
        summary,
        node: node.left,
      },);
      return;
    }
    if (isDeleteExpression(node,)) {
      inspectDirectWrite({
        project,
        bindingOriginBySymbolId,
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
        bindingOriginBySymbolId,
        summary,
        node: node.operand,
      },);
      return;
    }
    if (isCallExpression(node,)) {
      inspectEffectCall({
        project,
        checker,
        bindingOriginBySymbolId,
        call: node,
        summary,
      },);
    }
  },);
  applyVerifiedAdapterContracts({
    declaration,
    summary,
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
