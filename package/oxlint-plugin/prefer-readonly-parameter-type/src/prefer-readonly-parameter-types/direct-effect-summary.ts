/**
 * Direct syntax and call-edge extraction for callable effect summaries.
 *
 * @module
 */

import {
  type BinaryExpression,
  type ForOfStatement,
  type Node,
  SyntaxKind,
  type VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isAssignmentOperator,
  isBinaryExpression,
  isCallExpression,
  isDeleteExpression,
  isForOfStatement,
  isIdentifier,
  isPostfixUnaryExpression,
  isPrefixUnaryExpression,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { activeCallableBodyNodes, } from './closure-activity.ts';
import {
  discoverAliasOrigins,
  expressionOrigin,
  registerBindingOrigin,
} from './effect-binding-origins.ts';
import { bindingContainsForeignBorrowed, } from './foreign-borrowed-classifier.ts';
import { inspectEffectCall, } from './effect-call-analysis.ts';
import { declarationDirectlyOwnsNode, } from './effect-foreign-inbound.ts';
import { addOpaqueEffect, } from './effect-call-resolution.ts';
import type { ExternalCallableEffectResolver, } from './external-callable-effect.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
  mutationTargetIndexes,
} from './mutation-contract-query.ts';
import {
  addEffectIndex,
  callableKey,
  type EffectCallableDeclaration,
  collectAstNodes,
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

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
 *
 * @mutates summary - Adds direct caller-observable write target.
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
 * @param analysisRoot - Optional external implementation root accepted for transitive calls.
 *
 * @param externalEffectResolver - Demand-driven package implementation analyzer.
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
  analysisRoot,
  externalEffectResolver,
}: {
  readonly project: Project;
  readonly declaration: EffectCallableDeclaration;
  readonly analysisRoot?: string;
  readonly externalEffectResolver: ExternalCallableEffectResolver;
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
   * Parameter indexes explicitly carrying exact foreign ownership marker.
   */
  const directForeignBorrowed = new Set<number>();
  /**
   * Parameter entries paired with declaration indexes.
   */
  const parameterEntries = declaration.parameters
    .entries();
  for (const [parameterIndex, parameter,] of parameterEntries) {
    if (bindingContainsForeignBorrowed({
      project,
      name: parameter.name,
    },))
      directForeignBorrowed.add(parameterIndex,);
  }
  /**
   * Mutable summary receiving direct and propagated effects.
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
    relations: [],
    calls: [],
  };
  /**
   * Callable implementation body, absent for source signatures.
   */
  const body = 'body' in declaration ? declaration.body : undefined;
  if (body === undefined) {
    declaration.parameters
      .forEach(function rejectBodylessParameter(
        parameter,
        parameterIndex,
      ): void {
        if (!expressionCanCarryMutableState({
          checker,
          node: parameter.name,
        },))
          return;
        addOpaqueEffect({
          summary,
          affectedParameterIndex: parameterIndex,
          provenance: `bodyless callable ${callableKey(declaration,)}`,
        },);
      },);
    /**
     * Authored bodyless mutation contracts remain documentation of known effects.
     * They never remove unresolved implementation opacity.
     */
    const contracts = mutationContractsForDeclaration({
      declaration,
      sourceFile: declaration.getSourceFile(),
    },);
    if (contracts !== MUTATION_CONTRACT_UNAVAILABLE) {
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
    }
    summary.directOpaque
      .forEach(function seedBodylessOpacity(index,): void {
        summary.opaque
          .add(index,);
      },);
    return summary;
  }
  /**
   * Complete body nodes used to discover origins before escape selection.
   */
  const allBodyNodes = collectAstNodes(body,);
  /**
   * Variable declarations that may alias parameter-reachable state.
   */
  const variableDeclarations = allBodyNodes.filter(function variableDeclaration(node,): node is VariableDeclaration {
    return isVariableDeclaration(node,);
  },);
  /**
   * Simple assignments that may establish aliases after declaration.
   */
  const aliasAssignments = allBodyNodes.filter(function aliasAssignment(node,): node is BinaryExpression {
    return isBinaryExpression(node,)
      && (node.operatorToken
        .kind
        === SyntaxKind.EqualsToken);
  },);
  /**
   * Iteration statements binding elements reached through parameter-owned iterables.
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
  /**
   * Body nodes selected after aliases expose caller-reachable closure storage.
   */
  const bodyNodes = activeCallableBodyNodes({
    project,
    body,
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
    if (isForOfStatement(node,) && (node.awaitModifier !== undefined)) {
      addEffectIndex({
        target: summary.directMutated,
        value: expressionOrigin({
          project,
          bindingOriginBySymbolId,
          node: node.expression,
        },),
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
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
        externalEffectResolver,
        foreignInbound: declarationDirectlyOwnsNode({
          node,
          declaration,
        },),
      },);
    }
  },);
  summary.directMutated
    .forEach(function seed(index,): void {
    summary.mutated
      .add(index,);
  },);
  summary.directInvoked
    .forEach(function seedInvocation(index,): void {
    summary.invoked
      .add(index,);
  },);
  summary.directOpaque
    .forEach(function seedOpacity(index,): void {
    summary.opaque
      .add(index,);
  },);
  return summary;
}
