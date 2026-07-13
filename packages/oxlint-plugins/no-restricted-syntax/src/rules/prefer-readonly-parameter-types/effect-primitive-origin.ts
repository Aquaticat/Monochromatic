/**
 * Primitive-origin narrowing for opaque effect boundaries.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  type Checker,
  type Type,
  TypeFlags,
} from 'typescript/unstable/sync';

/**
 * Tests whether semantic type can expose caller-owned mutable state.
 *
 * Unions are primitive only when every possible constituent is primitive.
 * Intersections with a primitive constituent are runtime primitives,
 * including branded strings and numbers.
 * Unresolved types fail closed as potentially mutable.
 *
 * @param checker - TypeScript checker resolving type-parameter constraints.
 *
 * @param type - Semantic type crossing opaque boundary.
 *
 * @returns whether value can carry caller-owned mutable state.
 */
function typeCanCarryMutableState({
  checker,
  type,
}: {
  readonly checker: Checker;
  readonly type: Type;
},): boolean {
  if ((type.flags & TypeFlags.AnyOrUnknown) !== 0)
    return true;
  if (type.isUnionType()) {
    return type.getTypes()
      .some(function unionConstituentCanCarryState(constituent,): boolean {
        return typeCanCarryMutableState({
          checker,
          type: constituent,
        },);
      },);
  }
  if (type.isIntersectionType()) {
    return !type.getTypes()
      .some(function intersectionConstituentIsPrimitive(constituent,): boolean {
        return !typeCanCarryMutableState({
          checker,
          type: constituent,
        },);
      },);
  }
  if (type.isTypeParameter()) {
    /**
     * Constraint determining runtime state shape when available.
     */
    const constraint = checker.getBaseConstraintOfType(type,);
    return (constraint === undefined)
      || typeCanCarryMutableState({
        checker,
        type: constraint,
      },);
  }
  return (type.flags & TypeFlags.Primitive) === 0;
}

/**
 * Tests whether expression can carry caller-owned mutable state across unknown call.
 *
 * @param checker - TypeScript checker resolving expression type.
 *
 * @param node - Receiver or argument expression crossing opaque boundary.
 *
 * @returns whether unknown callee could mutate caller-reachable state through expression.
 *
 * @example
 * ```ts
 * expressionCanCarryMutableState({ checker, node });
 * ```
 */
export function expressionCanCarryMutableState({
  checker,
  node,
}: {
  readonly checker: Checker;
  readonly node: Node;
},): boolean {
  /**
   * Semantic expression type, absent when bridge cannot classify syntax.
   */
  const type = checker.getTypeAtLocation(node,);
  return (type === undefined)
    || typeCanCarryMutableState({
      checker,
      type,
    },);
}
