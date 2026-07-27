/**
 * Parameter and local-alias binding origin analysis.
 *
 * @module
 */

import type {
  BinaryExpression,
  BindingName,
  ForOfStatement,
  Node,
  VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isBindingElement,
  isIdentifier,
  isVariableDeclarationList,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { expressionValueOrigins, } from './effect-expression-provenance.ts';
import type { ParameterOrigins, } from './effect-summary-model.ts';

/**
 * Registers every identifier bound by one parameter or destructuring pattern.
 *
 * Origins accumulate rather than replace. A local reassigned across branches holds
 * state from every parameter assigned into it, and an earlier revision overwrote, so
 * one branch erased the other and the erased parameter was offered `readonly` while
 * the body mutated it through the alias. Applying that suggestion failed to compile;
 * `doc/decision/prefer-readonly-binding-origin-accumulation.md` records the measurement.
 *
 * Accumulation also fixes convergence. Under overwrite, an alias with two origins
 * flipped between them on every pass and reported progress each time, so
 * `discoverAliasOrigins` only stopped at its pass bound. Monotone growth makes
 * progress mean "the set grew", which settles on its own.
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
  readonly bindingOriginBySymbolId: Map<number, Set<number>>;
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
     * Origins already known for binding, or new accumulator.
     */
    const origins = bindingOriginBySymbolId.get(symbol.id,) ?? new Set<number>();
    /**
     * Size before insertion detects fixed-point progress.
     */
    const priorSize = origins.size;
    origins.add(parameterIndex,);
    bindingOriginBySymbolId.set(
      symbol.id,
      origins,
    );
    return origins.size !== priorSize;
  }
  /**
   * Whether any nested binding origin changed.
   */
  let changed = false;
  for (const element of name.elements) {
    if ((!isBindingElement(element,)) || (element.name === undefined))
      continue;
    changed = registerBindingOrigin({
      project,
      name: element.name,
      parameterIndex,
      bindingOriginBySymbolId,
    },) || changed;
  }
  return changed;
}

/**
 * Resolves every parameter origin represented by expression root.
 *
 * {@inheritDoc expressionValueOrigins}
 *
 * @param project - TypeScript project resolving root symbol.
 *
 * @param bindingOriginBySymbolId - Known parameter and alias origins.
 *
 * @param node - Expression whose root may represent parameter state.
 *
 * @returns source parameter origins, empty when root is not parameter-derived.
 *
 * @example
 * ```ts
 * expressionOrigins({ project, bindingOriginBySymbolId, node });
 * ```
 */
export function expressionOrigins({
  project,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, ParameterOrigins>;
  readonly node: Node;
},): ParameterOrigins {
  return expressionValueOrigins({
    project,
    bindingOriginBySymbolId,
    node,
  },);
}

/**
 * Registers one binding as holding every origin its source can hold.
 *
 * @param project - TypeScript project resolving binding symbols.
 *
 * @param name - Binding name or nested pattern receiving origins.
 *
 * @param parameterOrigins - Origins resolved for aliased source expression.
 *
 * @param bindingOriginBySymbolId - Origin map receiving bindings.
 *
 * @returns whether map changed.
 *
 * @mutates bindingOriginBySymbolId - Adds every source origin for binding symbols.
 *
 * @example
 * ```ts
 * registerBindingOrigins({ project, name, parameterOrigins, bindingOriginBySymbolId });
 * ```
 */
function registerBindingOrigins({
  project,
  name,
  parameterOrigins,
  bindingOriginBySymbolId,
}: {
  readonly project: Project;
  readonly name: BindingName;
  readonly parameterOrigins: ParameterOrigins;
  readonly bindingOriginBySymbolId: Map<number, Set<number>>;
},): boolean {
  /* Spread because `ReadonlySet` has no `reduce`, and for no stronger reason now.
   *
   * It used to also be a defensive snapshot: `expressionOrigins` returned the live set
   * stored for the source binding, so a self-assignment (`cursor = cursor`) could have
   * one call iterating the object another was inserting into. `expressionValueOrigins`
   * removed that hazard structurally by always returning a freshly built set or the
   * shared empty constant, so the copy is no longer what makes this safe. */
  return [...parameterOrigins,]
    .reduce(
      function registerOne(
        changed,
        parameterIndex,
      ): boolean {
        return registerBindingOrigin({
          project,
          name,
          parameterIndex,
          bindingOriginBySymbolId,
        },) || changed;
      },
      false,
    );
}

/**
 * Tests whether an expression root is reachable from any callable parameter.
 *
 * @param project - TypeScript project resolving root symbol.
 *
 * @param bindingOriginBySymbolId - Known parameter and alias origins.
 *
 * @param node - Expression whose root may represent parameter state.
 *
 * @returns whether root carries at least one parameter origin.
 *
 * @example
 * ```ts
 * expressionHasParameterOrigin({ project, bindingOriginBySymbolId, node });
 * ```
 */
export function expressionHasParameterOrigin({
  project,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, ParameterOrigins>;
  readonly node: Node;
},): boolean {
  /**
   * Origins resolved for expression root.
   */
  const origins = expressionOrigins({
    project,
    bindingOriginBySymbolId,
    node,
  },);
  return origins.size > 0;
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
 * @param forOfStatements - Iterations binding elements from parameter-owned iterables.
 *
 * @param bindingOriginBySymbolId - Origin map receiving aliases.
 *
 * @mutates bindingOriginBySymbolId - Adds aliases rooted in parameter state.
 *
 * @example
 * ```ts
 * discoverAliasOrigins({ project, variableDeclarations, aliasAssignments, forOfStatements, bindingOriginBySymbolId });
 * ```
 */
export function discoverAliasOrigins({
  project,
  variableDeclarations,
  aliasAssignments,
  forOfStatements,
  bindingOriginBySymbolId,
}: {
  readonly project: Project;
  readonly variableDeclarations: readonly VariableDeclaration[];
  readonly aliasAssignments: readonly BinaryExpression[];
  readonly forOfStatements: readonly ForOfStatement[];
  readonly bindingOriginBySymbolId: Map<number, Set<number>>;
},): void {
  /**
   * Convergence state, settling on its own now that origins only grow.
   *
   * The pass bound is a backstop rather than the actual terminator it was while
   * origins could overwrite each other: an alias with two origins used to flip
   * between them every pass and report progress each time.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed
    && (state.pass <= (variableDeclarations.length + aliasAssignments.length
      + forOfStatements.length))) {
    state.changed = false;
    state.pass++;
    variableDeclarations.forEach(function discover(declaration,): void {
      if (declaration.initializer === undefined)
        return;
      /**
       * Parameter origins of initializer root.
       */
      const parameterOrigins = expressionOrigins({
        project,
        bindingOriginBySymbolId,
        node: declaration.initializer,
      },);
      state.changed = registerBindingOrigins({
        project,
        name: declaration.name,
        parameterOrigins,
        bindingOriginBySymbolId,
      },) || state.changed;
    },);
    forOfStatements.forEach(function discoverIteration(statement,): void {
      /**
       * Parameter origins of iterated expression.
       */
      const parameterOrigins = expressionOrigins({
        project,
        bindingOriginBySymbolId,
        node: statement.expression,
      },);
      if (parameterOrigins.size === 0)
        return;
      if (isVariableDeclarationList(statement.initializer,)) {
        /**
         * Declarations receiving iterated elements.
         */
        const { declarations, } = statement.initializer;
        declarations.forEach(function registerIterationDeclaration(declaration,): void {
            state.changed = registerBindingOrigins({
              project,
              name: declaration.name,
              parameterOrigins,
              bindingOriginBySymbolId,
            },) || state.changed;
        },);
        return;
      }
      if (isIdentifier(statement.initializer,)) {
        state.changed = registerBindingOrigins({
          project,
          name: statement.initializer,
          parameterOrigins,
          bindingOriginBySymbolId,
        },) || state.changed;
      }
    },);
    aliasAssignments.forEach(function discoverAssignment(assignment,): void {
      /**
       * Parameter origins of assignment right-hand side.
       */
      const parameterOrigins = expressionOrigins({
        project,
        bindingOriginBySymbolId,
        node: assignment.right,
      },);
      if (!isIdentifier(assignment.left,))
        return;
      state.changed = registerBindingOrigins({
        project,
        name: assignment.left,
        parameterOrigins,
        bindingOriginBySymbolId,
      },) || state.changed;
    },);
  }
}
