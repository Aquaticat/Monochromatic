/**
 * Active nested-closure selection for callable effect scans.
 *
 * @module
 */

import {
  type Node,
  SyntaxKind,
} from 'typescript/unstable/ast';
import {
  isBinaryExpression,
  isCallExpression,
  isIdentifier,
  isReturnStatement,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  expressionHasParameterOrigin,
} from './effect-binding-origins.ts';
import {
  callableKey,
  type EffectCallableDeclaration,
  collectAstNodes,
  isEffectCallableDeclaration,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Activates callables reachable through escaped expression containers and aliases.
 *
 * @param project - TypeScript project resolving variable aliases.
 *
 * @param node - Passed or returned expression whose callables escape.
 *
 * @param nestedKeys - Callable declarations nested under outer body.
 *
 * @param activeKeys - Accumulator receiving escaped callable keys.
 *
 * @mutates activeKeys - Adds every reachable nested callable key.
 */
function activateEscapedCallables({
  project,
  node,
  nestedKeys,
  activeKeys,
}: {
  readonly project: Project;
  readonly node: Node;
  readonly nestedKeys: ReadonlySet<string>;
  readonly activeKeys: Set<string>;
}): void {
  /**
   * Explicit work stack for container and alias traversal.
   */
  const stack: Node[] = [node,];
  /**
   * Stable node keys prevent cyclic object and variable aliases.
   */
  const visited = new Set<string>();
  while (stack.length > 0) {
    /**
     * Next escaped expression node.
     */
    const current = stack.pop();
    if (current === undefined)
      continue;
    /**
     * Stable source span for cycle detection.
     */
    const currentKey = `${current.getSourceFile()
      .fileName}:${String(current.pos,)}:${String(current.end,)}`;
    if (visited.has(currentKey,))
      continue;
    visited.add(currentKey,);
    if (isEffectCallableDeclaration(current,)) {
      /**
       * Stable callable key activated as escaped value.
       */
      const key = callableKey(current,);
      if (nestedKeys.has(key,))
        activeKeys.add(key,);
      continue;
    }
    if (isIdentifier(current,)) {
      /**
       * Symbol reached through identifier alias.
       */
      const symbol = project.checker
        .getResolvedSymbol(current,);
      /**
       * Declaration reached through identifier alias.
       */
      const declaration = (symbol?.valueDeclaration
        ?? symbol?.declarations
        .at(0,))?.resolve(project,);
      if ((declaration !== undefined)
        && isEffectCallableDeclaration(declaration,)) {
        stack.push(declaration,);
        continue;
      }
      if ((declaration !== undefined)
        && isVariableDeclaration(declaration,)
        && (declaration.initializer !== undefined)) {
        stack.push(declaration.initializer,);
        continue;
      }
    }
    current.forEachChild(function addEscapedChild(child,): undefined {
      stack.push(child,);
      return undefined;
    },);
  }
}

/**
 * Tests that node is enclosed only by active nested closures.
 *
 * @param node - Descendant whose closure ancestry is checked.
 *
 * @param body - Outer callable body boundary.
 *
 * @param activeKeys - Nested callables proven active.
 *
 * @returns whether every enclosing nested closure is active.
 */
function insideOnlyActiveClosures({
  node,
  body,
  activeKeys,
}: {
  readonly node: Node;
  readonly body: Node;
  readonly activeKeys: ReadonlySet<string>;
}): boolean {
  /**
   * Parent cursor ascending through every nested closure.
   */
  const cursor: { current: Node; } = { current: node.parent, };
  while (cursor.current !== body) {
    if (isEffectCallableDeclaration(cursor.current,)
      && (!activeKeys.has(callableKey(cursor.current,),)))
      return false;
    if (cursor.current
      .parent
      === cursor.current)
      return false;
    cursor.current = cursor.current
      .parent;
  }
  return true;
}

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
 * @param bindingOriginBySymbolId - Binding symbols mapped to source parameters.
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
  bindingOriginBySymbolId,
}: {
  readonly project: Project;
  readonly body: Node;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
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
  /* Gated on ancestry and iterated to a fixed point, rather than scanned once over every node.
   * The scan visited every node in the body, so a call written inside a closure that never runs
   * activated its target anyway, and the target's own body was then read as though the enclosing
   * callable had run it. Measured: `declareWritingSiblingUncalled` recorded `mutated=[0]` for a
   * write the callable never reaches, and `storeCallingDeclaredSibling` recorded a returned
   * origin it never returns.
   *
   * Two forms behave differently and the first probe of this used the wrong one. A sibling bound
   * to a `const` arrow did not reproduce it, because overload resolution answers with the arrow
   * and its key matched nothing the scan had reached; a sibling written as a function declaration
   * did. So the earlier note recording that the consequence did not reproduce was true of the
   * shape it tested and false of the defect.
   *
   * Termination: `activeKeys` only grows, and it is bounded by `nestedKeys`, which is fixed. */
  /**
   * Whether the last pass activated anything, so the loop knows to look again.
   */
  const state: { changed: boolean; } = { changed: true, };
  while (state.changed) {
    state.changed = false;
    /**
     * Keys already active before this pass, so growth is what ends the loop.
     */
    const knownBefore = activeKeys.size;
    activationSites({
      project,
      bindingOriginBySymbolId,
      allNodes,
      body,
      nestedKeys,
      activeKeys,
    },);
    state.changed = activeKeys.size !== knownBefore;
  }
  return allNodes.filter(function activeNode(node,): boolean {
    return insideOnlyActiveClosures({
      node,
      body,
      activeKeys,
    },);
  },);
}

/**
 * Activates every callable reachable from a site the enclosing callable can actually run.
 *
 * @param project - TypeScript project resolving call targets.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the callable being summarised.
 *
 * @param allNodes - Every node of the body.
 *
 * @param body - Outer callable body boundary.
 *
 * @param nestedKeys - Keys of every callable nested under the body.
 *
 * @param activeKeys - Accumulator receiving newly activated keys.
 *
 * @mutates activeKeys - Adds every key reachable from a runnable site.
 *
 * @example
 * ```ts
 * activationSites({ project, bindingOriginBySymbolId, allNodes, body, nestedKeys, activeKeys });
 * ```
 */
function activationSites({
  project,
  bindingOriginBySymbolId,
  allNodes,
  body,
  nestedKeys,
  activeKeys,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly allNodes: readonly Node[];
  readonly body: Node;
  readonly nestedKeys: ReadonlySet<string>;
  readonly activeKeys: Set<string>;
},): void {
  allNodes.forEach(function findActivation(node,): void {
    /* The gate. A site inside a closure nothing has proven active cannot activate anything,
     * because the enclosing callable does not reach it. */
    if (!insideOnlyActiveClosures({
      node,
      body,
      activeKeys,
    },))
      return;
    if (isBinaryExpression(node,)
      && (node.operatorToken
        .kind
        === SyntaxKind.EqualsToken)
      && expressionHasParameterOrigin({
        project,
        bindingOriginBySymbolId,
        node: node.left,
      },)) {
      activateEscapedCallables({
        project,
        node: node.right,
        nestedKeys,
        activeKeys,
      },);
      return;
    }
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
        activateEscapedCallables({
          project,
          node: argument,
          nestedKeys,
          activeKeys,
        },);
      },);
      return;
    }
    if ((!isReturnStatement(node,)) || (node.expression === undefined))
      return;
    activateEscapedCallables({
      project,
      node: node.expression,
      nestedKeys,
      activeKeys,
    },);
  },);
}
