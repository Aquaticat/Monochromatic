/**
 * Parameter origin through audited intrinsic results.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isCallExpression,
  isPropertyAccessExpression,
} from 'typescript/unstable/ast/is';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

import { parameterIndex, } from './effect-call-resolution.ts';
import {
  intrinsicEffect,
  NO_INTRINSIC_EFFECT,
} from './intrinsic-effect-catalog.ts';
import {
  intrinsicEffectQuery,
  NO_INTRINSIC_QUERY,
} from './intrinsic-effect-query.ts';
import { PARAMETER_INDEX_UNAVAILABLE, } from './effect-summary-model.ts';

/**
 * Resolves receiver origin through audited calls whose results retain values
 * reachable from their receiver.
 *
 * @param project - TypeScript project resolving exact intrinsic identity.
 *
 * @param checker - TypeScript checker resolving receiver types and symbols.
 *
 * @param bindingOriginBySymbolId - Current parameter and alias origins.
 *
 * @param node - Receiver expression whose result may retain source values.
 *
 * @returns originating parameter index or unavailable sentinel.
 *
 * @example
 * ```ts
 * intrinsicReceiverParameterIndex({ project, checker, bindingOriginBySymbolId, node });
 * ```
 */
export function intrinsicReceiverParameterIndex({
  project,
  checker,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly node: Node;
}): number | typeof PARAMETER_INDEX_UNAVAILABLE {
  /**
   * Iterative expression cursor bounded by nested call-expression depth.
   */
  const cursor = { current: node, };
  while (true) {
    /**
     * Current expression retained for stable TypeScript narrowing.
     */
    const current = cursor.current;
    /**
     * Direct parameter or local-alias origin at current expression.
     */
    const directOrigin = parameterIndex({
      checker,
      bindingOriginBySymbolId,
      node: current,
    },);
    if (directOrigin !== PARAMETER_INDEX_UNAVAILABLE)
      return directOrigin;
    if ((!isCallExpression(current,))
      || (!isPropertyAccessExpression(current.expression,)))
      return PARAMETER_INDEX_UNAVAILABLE;
    /**
     * Receiver whose reachable values may flow into current call result.
     */
    const receiver = current.expression.expression;
    /**
     * Exact semantic receiver type.
     */
    const receiverType = checker.getTypeAtLocation(receiver,);
    /**
     * Exact intrinsic member symbol.
     */
    const memberSymbol = checker.getSymbolAtLocation(current.expression.name,);
    if ((receiverType === undefined) || (memberSymbol === undefined))
      return PARAMETER_INDEX_UNAVAILABLE;
    /**
     * Exact catalog query for current result-producing call.
     */
    const query = intrinsicEffectQuery({
      project,
      receiverType,
      memberSymbol,
    },);
    if (query === NO_INTRINSIC_QUERY)
      return PARAMETER_INDEX_UNAVAILABLE;
    /**
     * Audited intrinsic effect controlling result provenance.
     */
    const effect = intrinsicEffect(query,);
    if ((effect === NO_INTRINSIC_EFFECT)
      || (effect.receiverValuesReachResult !== true))
      return PARAMETER_INDEX_UNAVAILABLE;
    cursor.current = receiver;
  }
}
