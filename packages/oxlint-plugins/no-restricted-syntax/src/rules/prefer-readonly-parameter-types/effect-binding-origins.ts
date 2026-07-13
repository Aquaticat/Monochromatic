/**
 * Parameter and local-alias binding origin analysis.
 *
 * @module
 */

import type {
  BinaryExpression,
  BindingName,
  Node,
  VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isBindingElement,
  isIdentifier,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  expressionRoot,
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
 *
 * @example
 * ```ts
 * registerBindingOrigin({ project, name, parameterIndex: 0, bindingOriginBySymbolId });
 * ```
 */
export function registerBindingOrigin({
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
 *
 * @example
 * ```ts
 * expressionOrigin({ project, bindingOriginBySymbolId, node });
 * ```
 */
export function expressionOrigin({
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
    : bindingOriginBySymbolId.get(symbol.id,) ?? PARAMETER_INDEX_UNAVAILABLE;
}

/**
 * Discovers local aliases and destructured bindings to fixed point.
 *
 * @param project - TypeScript project resolving symbols.
 *
 * @param variableDeclarations - Body declarations eligible for aliasing.
 *
 * @param aliasAssignments - Simple assignments eligible for aliasing.
 *
 * @param bindingOriginBySymbolId - Origin map receiving aliases.
 *
 * @mutates bindingOriginBySymbolId - Adds aliases rooted in parameter state.
 *
 * @example
 * ```ts
 * discoverAliasOrigins({ project, variableDeclarations, aliasAssignments, bindingOriginBySymbolId });
 * ```
 */
export function discoverAliasOrigins({
  project,
  variableDeclarations,
  aliasAssignments,
  bindingOriginBySymbolId,
}: {
  readonly project: Project;
  readonly variableDeclarations: readonly VariableDeclaration[];
  readonly aliasAssignments: readonly BinaryExpression[];
  readonly bindingOriginBySymbolId: Map<number, number>;
},): void {
  /**
   * Convergence state bounded by candidate alias count.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed
    && (state.pass <= (variableDeclarations.length + aliasAssignments.length))) {
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
    aliasAssignments.forEach(function discoverAssignment(assignment,): void {
      /**
       * Parameter origin of assignment right-hand side.
       */
      const parameterIndex = expressionOrigin({
        project,
        bindingOriginBySymbolId,
        node: assignment.right,
      },);
      if ((parameterIndex === PARAMETER_INDEX_UNAVAILABLE)
        || (!isIdentifier(assignment.left,)))
        return;
      state.changed = registerBindingOrigin({
        project,
        name: assignment.left,
        parameterIndex,
        bindingOriginBySymbolId,
      },) || state.changed;
    },);
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
