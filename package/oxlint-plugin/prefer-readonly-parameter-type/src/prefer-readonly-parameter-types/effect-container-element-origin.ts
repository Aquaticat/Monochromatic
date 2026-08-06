/**
 * Which receiver a fresh container's elements came from, through any local hops.
 *
 * @module
 */

import type {
  Expression,
  Node,
} from 'typescript/unstable/ast';
import {
  isCallExpression,
  isIdentifier,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

import {
  callResultElementReceiver,
  RESULT_NOT_RECEIVER_STATE,
} from './effect-member-result-relation.ts';

/**
 * Sentinel when nothing proves the value is a container of receiver elements.
 */
export const NOT_A_RECEIVER_CONTAINER: unique symbol = Symbol(
  'value is not a verified container of receiver elements',
);

/**
 * Hops followed through local declarations before the walk gives up.
 *
 * A bound rather than a cycle guard alone, because the visited set already stops a cycle
 * and this stops a long alias chain from costing a declaration resolution per hop. Chains
 * this long do not appear in the corpus, and stopping early only withholds an origin.
 */
const CONTAINER_ALIAS_HOP_LIMIT = 8;

/**
 * Resolves the receiver whose elements an expression's container value holds.
 *
 * The container relation is recorded on a call, and code rarely writes through the call
 * expression itself: `rows.filter(kept)[0].label = 'x'` is legal and unusual, while
 * `const kept = rows.filter(keeps); kept[0].label = 'x'` is the shape that appears. So the
 * question has to survive local hops, and this follows a binding to its declaration's
 * initializer until it reaches a call or runs out.
 *
 * Only a declaration initializer is followed, never a later assignment. A reassigned local
 * therefore keeps answering for the container it was declared with, which over-attributes
 * rather than under-attributes: the write is credited to a receiver whose elements the
 * local may no longer hold, which costs precision and never an offer.
 *
 * @param project - TypeScript project resolving declarations and default-library ownership.
 *
 * @param checker - TypeScript checker resolving signatures and types.
 *
 * @param node - Expression whose value may be a container of receiver elements.
 *
 * @returns receiver expression, or sentinel when nothing proves the relation.
 *
 * @example
 * ```ts
 * containerElementReceiver({ project, checker, node: elementAccess.expression });
 * ```
 */
export function containerElementReceiver({
  project,
  checker,
  node,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly node: Node;
},): Expression | typeof NOT_A_RECEIVER_CONTAINER {
  /**
   * Declarations already visited, so an alias cycle cannot spin the walk.
   */
  const visited = new Set<Node>();
  /**
   * Cursor descending through local declarations toward a container call.
   */
  const cursor: {
    current: Node;
    hops: number;
  } = {
    current: node,
    hops: 0,
  };
  while (cursor.hops < CONTAINER_ALIAS_HOP_LIMIT) {
    if (visited.has(cursor.current,))
      return NOT_A_RECEIVER_CONTAINER;
    visited.add(cursor.current,);
    if (isCallExpression(cursor.current,)) {
      /**
       * Receiver this call's container result may hold the elements of.
       */
      const receiver = callResultElementReceiver({
        project,
        checker,
        call: cursor.current,
      },);
      return (receiver === RESULT_NOT_RECEIVER_STATE)
        ? NOT_A_RECEIVER_CONTAINER
        : receiver;
    }
    if (!isIdentifier(cursor.current,))
      return NOT_A_RECEIVER_CONTAINER;
    /**
     * Binding this identifier names.
     */
    const symbol = checker.getSymbolAtLocation(cursor.current,);
    /**
     * Declaration the binding was introduced by, when there is exactly one.
     */
    const declaration = (symbol === undefined)
        || (symbol.declarations
          .length
          !== 1)
      ? undefined
      : symbol.declarations[0]
        ?.resolve(project,);
    if ((declaration === undefined)
      || (!isVariableDeclaration(declaration,))
      || (declaration.initializer === undefined))
      return NOT_A_RECEIVER_CONTAINER;
    cursor.current = declaration.initializer;
    cursor.hops += 1;
  }
  return NOT_A_RECEIVER_CONTAINER;
}
