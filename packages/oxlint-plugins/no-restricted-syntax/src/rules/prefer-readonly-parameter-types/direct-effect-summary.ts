/**
 * Direct syntax and call-edge extraction for callable effect summaries.
 *
 * @module
 */

import {
  type BindingName,
  type Node,
  SyntaxKind,
  type VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isAssignmentOperator,
  isBinaryExpression,
  isBindingElement,
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
import { inspectEffectCall, } from './effect-call-analysis.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
  mutationTargetIndexes,
} from './mutation-contract-query.ts';
import {
  addEffectIndex,
  type EffectCallableDeclaration,
  expressionRoot,
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/* oxlint-disable typescript/prefer-readonly-parameter-types -- TypeScript nodes and mutable origin map are semantic-analysis identities and accumulators. */
/**
 * Registers every identifier bound by one parameter or destructuring pattern.
 *
 * @param project - TypeScript project resolving binding symbols.
 *
 * @param name - Binding name or nested pattern.
 *
 * @param parameterIndex - Source parameter represented by binding.
 *
 * @param bindingOriginBySymbolId - Origin map receiving bindings.
 *
 * @returns whether map changed.
 *
 * @mutates bindingOriginBySymbolId - Adds parameter origin for binding symbols.
 */
function registerBindingOrigin({
  project,
  name,
  parameterIndex,
  bindingOriginBySymbolId,
}: {
  readonly project: Project;
  readonly name: BindingName;
  readonly parameterIndex: number;
  readonly bindingOriginBySymbolId: Map<number, number>;
},): boolean {
  if (isIdentifier(name,)) {
    /**
     * Symbol declared by binding identifier.
     */
    const symbol = project.checker
      .getSymbolAtLocation(name,);
    if (symbol === undefined)
      return false;
    /**
     * Prior origin detects fixed-point progress.
     */
    const prior = bindingOriginBySymbolId.get(symbol.id,);
    bindingOriginBySymbolId.set(
      symbol.id,
      parameterIndex,
    );
    return prior !== parameterIndex;
  }
  return name.elements
    .reduce(
      function registerElement(
        changed,
        element,
      ): boolean {
    if ((!isBindingElement(element,)) || (element.name === undefined))
      return changed;
    return registerBindingOrigin({
      project,
      name: element.name,
      parameterIndex,
      bindingOriginBySymbolId,
    },) || changed;
  },
      false,
    );
}

/**
 * Resolves parameter origin represented by expression root.
 *
 * @param project - TypeScript project resolving root symbol.
 *
 * @param bindingOriginBySymbolId - Known parameter and alias origins.
 *
 * @param node - Expression whose root may represent parameter state.
 *
 * @returns source parameter index or sentinel.
 */
function expressionOrigin({
  project,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly node: Node;
},): number | typeof PARAMETER_INDEX_UNAVAILABLE {
  /**
   * Root node after property and element access removal.
   */
  const root = expressionRoot(node,);
  if (!isIdentifier(root,))
    return PARAMETER_INDEX_UNAVAILABLE;
  /**
   * Root symbol used for origin lookup.
   */
  const symbol = project.checker
    .getSymbolAtLocation(root,);
  return symbol === undefined
    ? PARAMETER_INDEX_UNAVAILABLE
    : bindingOriginBySymbolId.get(symbol.id,)
      ?? PARAMETER_INDEX_UNAVAILABLE;
}

/**
 * Discovers local aliases and destructured bindings to fixed point.
 *
 * @param project - TypeScript project resolving symbols.
 *
 * @param variableDeclarations - Body declarations eligible for aliasing.
 *
 * @param bindingOriginBySymbolId - Origin map receiving aliases.
 *
 * @mutates bindingOriginBySymbolId - Adds aliases rooted in parameter state.
 */
function discoverAliasOrigins({
  project,
  variableDeclarations,
  bindingOriginBySymbolId,
}: {
  readonly project: Project;
  readonly variableDeclarations: readonly VariableDeclaration[];
  readonly bindingOriginBySymbolId: Map<number, number>;
},): void {
  /**
   * Convergence state bounded by declaration count.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed && (state.pass <= variableDeclarations.length)) {
    state.changed = false;
    state.pass++;
    variableDeclarations.forEach(function discover(declaration,): void {
      if (declaration.initializer === undefined)
        return;
      /**
       * Parameter origin of initializer root.
       */
      const parameterIndex = expressionOrigin({
        project,
        bindingOriginBySymbolId,
        node: declaration.initializer,
      },);
      if (parameterIndex === PARAMETER_INDEX_UNAVAILABLE)
        return;
      state.changed = registerBindingOrigin({
        project,
        name: declaration.name,
        parameterIndex,
        bindingOriginBySymbolId,
      },) || state.changed;
    },);
  }
}

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
  discoverAliasOrigins({
    project,
    variableDeclarations,
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
