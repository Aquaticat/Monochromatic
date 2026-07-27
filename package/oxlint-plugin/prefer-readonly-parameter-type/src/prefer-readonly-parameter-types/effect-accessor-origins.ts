/**
 * Caller origins packaged into a call argument through an object-literal accessor.
 *
 * The argument walk enumerates the property forms whose value it can read directly:
 * assignments, shorthand and spreads. An accessor has no such value. The callee obtains
 * one by reading the property, which runs the accessor body in the caller's scope, so a
 * parameter the body can return reaches the callee without ever appearing as a property
 * value. Measured on `accessorPackagedEffect` in the result-provenance fixture, where
 * `get unnamed() { return row; }` recorded nothing and the rule offered `row` as readonly
 * while the callee wrote `row.label`.
 *
 * The body is scanned rather than evaluated, and every binding it names contributes,
 * whatever position it appears in. That over-approximates, which is the direction that
 * costs a withheld offer rather than a wrong one, and it needs no claim about which of
 * several returns runs.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import { isIdentifier, } from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  collectAstNodes,
  NO_PARAMETER_ORIGIN,
  type ParameterOrigins,
} from './effect-summary-model.ts';

/**
 * Collects caller parameter origins any binding named inside an accessor can carry.
 *
 * @param project - TypeScript project resolving binding symbols.
 *
 * @param bindingOriginBySymbolId - Current callable parameter and alias origins.
 *
 * @param accessor - Accessor declaration authored inside a call-argument literal.
 *
 * @returns parameter indexes reachable through this accessor's body.
 *
 * @example
 * ```ts
 * accessorPackagedOrigins({ project, bindingOriginBySymbolId, accessor });
 * ```
 */
export function accessorPackagedOrigins({
  project,
  bindingOriginBySymbolId,
  accessor,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, ParameterOrigins>;
  readonly accessor: Node;
},): ReadonlySet<number> {
  /**
   * Checker resolving each named binding to its declaring symbol.
   */
  const { checker, } = project;
  /**
   * Origins any binding inside this accessor can carry.
   */
  const origins = new Set<number>();
  collectAstNodes(accessor,)
    .forEach(function collectNamed(node,): void {
      if (!isIdentifier(node,))
        return;
      /**
       * Symbol this occurrence resolves to.
       */
      const symbol = checker.getSymbolAtLocation(node,);
      if (symbol === undefined)
        return;
      /**
       * Caller parameters this binding can hold.
       */
      const named = bindingOriginBySymbolId.get(symbol.id,) ?? NO_PARAMETER_ORIGIN;
      if (named.size === 0)
        return;
      /* A binding that cannot carry mutable state grants the callee nothing, and
       * including it would name primitives in the resulting diagnostic. */
      if (!expressionCanCarryMutableState({
        checker,
        node,
      },))
        return;
      named.forEach(function collectOrigin(origin,): void {
        origins.add(origin,);
      },);
    },);
  return origins;
}
