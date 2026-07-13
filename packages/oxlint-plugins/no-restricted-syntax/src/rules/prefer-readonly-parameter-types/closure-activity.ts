/**
 * Active nested-closure selection for callable effect scans.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isCallExpression,
  isIdentifier,
  isReturnStatement,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  callableKey,
  type EffectCallableDeclaration,
  collectAstNodes,
  isEffectCallableDeclaration,
} from './effect-summary-model.ts';

/**
 * Sentinel when expression does not resolve to owned nested callable.
 */
const NESTED_CALLABLE_UNAVAILABLE: unique symbol = Symbol(
  'closure expression lacks nested callable declaration',
);

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Project and Node mirror TypeScript semantic AST identities. */
/**
 * Resolves expression or selected call signature to callable declaration.
 *
 * @param project - TypeScript project resolving symbols.
 *
 * @param node - Expression or declaration candidate.
 *
 * @returns callable declaration or sentinel.
 */
function resolvedCallable({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Node;
}): EffectCallableDeclaration | typeof NESTED_CALLABLE_UNAVAILABLE {
  /**
   * Cursor follows identifier and variable-initializer aliases iteratively.
   */
  const cursor: { current: Node; } = { current: node, };
  /**
   * Stable node keys prevent cyclic alias traversal.
   */
  const visited = new Set<string>();
  while (true) {
    if (isEffectCallableDeclaration(cursor.current,))
      return cursor.current;
    /**
     * Stable source span for alias-cycle detection.
     */
    const cursorKey = `${cursor.current
      .getSourceFile()
      .fileName}:${String(cursor.current
        .pos,)}:${String(cursor.current
          .end,)}`;
    if (visited.has(cursorKey,))
      return NESTED_CALLABLE_UNAVAILABLE;
    visited.add(cursorKey,);
    /**
     * Resolved symbol for expression reference.
     */
    const symbol = isIdentifier(cursor.current,)
      ? project.checker
        .getResolvedSymbol(cursor.current,)
      : project.checker
        .getSymbolAtLocation(cursor.current,);
    /**
     * Value declaration with first declaration fallback.
     */
    const handle = symbol?.valueDeclaration
      ?? symbol?.declarations
      .at(0,);
    /**
     * Resolved declaration in current project.
     */
    const declaration = handle?.resolve(project,);
    if (declaration === undefined)
      return NESTED_CALLABLE_UNAVAILABLE;
    if (isEffectCallableDeclaration(declaration,))
      return declaration;
    if (isVariableDeclaration(declaration,)
      && (declaration.initializer !== undefined)) {
      cursor.current = declaration.initializer;
      continue;
    }
    return NESTED_CALLABLE_UNAVAILABLE;
  }
}

/**
 * Finds nearest nested callable enclosing node before body boundary.
 *
 * @param node - Descendant whose closure owner is required.
 *
 * @param body - Outer callable body boundary.
 *
 * @returns enclosing nested callable or sentinel.
 */
function enclosingNestedCallable({
  node,
  body,
}: {
  readonly node: Node;
  readonly body: Node;
}): EffectCallableDeclaration | typeof NESTED_CALLABLE_UNAVAILABLE {
  /**
   * Parent cursor ascending toward outer body.
   */
  const cursor: { current: Node; } = { current: node.parent, };
  while (cursor.current !== body) {
    if (isEffectCallableDeclaration(cursor.current,))
      return cursor.current;
    if (cursor.current
      .parent
      === cursor.current)
      return NESTED_CALLABLE_UNAVAILABLE;
    cursor.current = cursor.current
      .parent;
  }
  return NESTED_CALLABLE_UNAVAILABLE;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Project and callable body mirror TypeScript semantic AST identities. */
/**
 * Selects outer body nodes plus nested closures that may execute or escape.
 *
 * Direct invocation,
 * direct callback arguments,
 * and direct returns activate nested closure body.
 * Unreferenced local function declarations remain outside outer callable effect.
 *
 * @param project - TypeScript project resolving callable references.
 *
 * @param body - Outer callable body.
 *
 * @returns effect-relevant body nodes.
 *
 * @example
 * ```ts
 * const nodes = activeCallableBodyNodes({ project, body });
 * ```
 */
export function activeCallableBodyNodes({
  project,
  body,
}: {
  readonly project: Project;
  readonly body: Node;
}): readonly Node[] {
  /**
   * Complete descendants used to discover nested declarations and activations.
   */
  const allNodes = collectAstNodes(body,);
  /**
   * Stable keys for every nested callable declaration.
   */
  const nestedKeys = new Set(
    allNodes
      .filter(function nestedCallable(node,): node is EffectCallableDeclaration {
        return isEffectCallableDeclaration(node,);
      },)
      .map(function nestedKey(declaration,): string {
        return callableKey(declaration,);
      },),
  );
  /**
   * Nested callable keys proven invoked or escaped.
   */
  const activeKeys = new Set<string>();
  allNodes.forEach(function findActivation(node,): void {
    if (isCallExpression(node,)) {
      /**
       * Callable selected by overload resolution.
       */
      const signatureDeclaration = project.checker
        .getResolvedSignature(node,)
        ?.declaration
        ?.resolve(project,);
      if ((signatureDeclaration !== undefined)
        && isEffectCallableDeclaration(signatureDeclaration,)) {
        /**
         * Stable declaration key for selected nested call target.
         */
        const key = callableKey(signatureDeclaration,);
        if (nestedKeys.has(key,))
          activeKeys.add(key,);
      }
      node.arguments
        .forEach(function callbackArgument(argument,): void {
        /**
         * Callable passed directly as callback argument.
         */
        const callback = resolvedCallable({
          project,
          node: argument,
        },);
        if (callback === NESTED_CALLABLE_UNAVAILABLE)
          return;
        /**
         * Stable declaration key for callback argument.
         */
        const key = callableKey(callback,);
        if (nestedKeys.has(key,))
          activeKeys.add(key,);
      },);
      return;
    }
    if ((!isReturnStatement(node,)) || (node.expression === undefined))
      return;
    /**
     * Callable returned directly or by identifier.
     */
    const returned = resolvedCallable({
      project,
      node: node.expression,
    },);
    if (returned === NESTED_CALLABLE_UNAVAILABLE)
      return;
    /**
     * Stable declaration key for returned closure.
     */
    const key = callableKey(returned,);
    if (nestedKeys.has(key,))
      activeKeys.add(key,);
  },);
  return allNodes.filter(function activeNode(node,): boolean {
    /**
     * Nearest nested closure containing node.
     */
    const closure = enclosingNestedCallable({
      node,
      body,
    },);
    return (closure === NESTED_CALLABLE_UNAVAILABLE)
      || activeKeys.has(callableKey(closure,),);
  },);
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
