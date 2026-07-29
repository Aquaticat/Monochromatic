/**
 * Everything the body scan has to know about its own locals before it starts.
 *
 * Split from `direct-effect-summary.ts` for the line budget, on the seam the phases already
 * had. This phase reads no effects and records none: it collects the syntax that can bind a
 * value and answers two questions about every local, which parameter slots it can reach and
 * which call filled it. The scan that follows consults both and writes the summary.
 *
 * Keeping the two discoveries together matters more than keeping either beside its caller.
 * They walk the same three node lists, they converge in the same loop shape, and a change
 * to what counts as a binding has to reach both or the maps disagree about the same local.
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
  isBinaryExpression,
  isForOfStatement,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { discoverAliasOrigins, } from './effect-binding-origins.ts';
import { discoverResultBindings, } from './effect-result-binding.ts';
import type { EffectSlot, } from './effect-slot-identity.ts';
import {
  collectAstNodes,
  type EffectCallableDeclaration,
} from './effect-summary-model.ts';

/**
 * What the body scan needs from the binding discovery phase.
 */
export type BodyBindings = {
  readonly parameterInitializerNodes: readonly Node[];
  readonly resultSitesBySymbolId: ReadonlyMap<number, ReadonlySet<string>>;
};

/**
 * Resolves what every local in one callable body can be holding.
 *
 * @param project - TypeScript project resolving binding symbols.
 *
 * @param declaration - Callable whose parameter initializers join the walk.
 *
 * @param body - Callable implementation body.
 *
 * @param bindingOriginBySymbolId - Origin map filled with parameter slots per binding.
 *
 * @mutates bindingOriginBySymbolId - Adds every parameter slot each binding can reach.
 *
 * @returns parameter initializer nodes and the call sites recorded per binding.
 *
 * @example
 * ```ts
 * discoverBodyBindings({ project, declaration, body, bindingOriginBySymbolId });
 * ```
 */
export function discoverBodyBindings({
  project,
  declaration,
  body,
  bindingOriginBySymbolId,
}: {
  readonly project: Project;
  readonly declaration: EffectCallableDeclaration;
  readonly body: Node;
  readonly bindingOriginBySymbolId: Map<number, Set<EffectSlot>>;
},): BodyBindings {
  /* Parameter initializers run on entry and can do anything a body statement can, so they
   * belong to the callable's own effects. A walk bounded by the body never saw them, and
   * `defaultInitializerEffect` in the call-edge fixture reached a mutating call from an
   * initializer and was offered readonly for the parameter it wrote. */
  /**
   * Nodes of every parameter initializer, which run on entry before the body.
   */
  const parameterInitializerNodes = declaration.parameters
    .flatMap(function initializerNodes(parameter,): readonly Node[] {
      return parameter.initializer === undefined
        ? []
        : collectAstNodes(parameter.initializer,);
    },);
  /**
   * Complete body nodes used to discover origins before escape selection.
   */
  const allBodyNodes = [
    ...parameterInitializerNodes,
    ...collectAstNodes(body,),
  ];
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
   * Call sites each local binding can be holding a result of.
   *
   * Beside the origins rather than inside them, because the two settle for different
   * reasons: origins accumulate parameter slots a binding can reach, while these name a
   * syntactic fact about where a value came from, complete as soon as the declarations
   * have been walked.
   */
  const resultSitesBySymbolId = new Map<number, Set<string>>();
  discoverResultBindings({
    project,
    variableDeclarations,
    aliasAssignments,
    forOfStatements,
    resultSitesBySymbolId,
  },);
  return {
    parameterInitializerNodes,
    resultSitesBySymbolId,
  };
}
