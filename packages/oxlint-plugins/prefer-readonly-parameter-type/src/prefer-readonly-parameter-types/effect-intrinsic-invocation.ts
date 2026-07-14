/**
 * Intrinsic callback-capability invocation effects.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type { Checker, } from 'typescript/unstable/sync';

import {
  ALL_PACKAGED_PROPERTIES,
  parameterIndexes,
} from './effect-call-resolution.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
} from './effect-summary-model.ts';

/**
 * Adds callback-capability parameters directly invoked by intrinsic.
 *
 * @param checker - TypeScript checker resolving argument origins.
 *
 * @param bindingOriginBySymbolId - Current bindings to source parameters.
 *
 * @param call - Exact intrinsic call.
 *
 * @param argumentIndexes - Callable argument positions invoked by intrinsic.
 *
 * @param summary - Current callable summary receiving invocation effects.
 *
 * @mutates summary - Adds direct invoked-capability parameter indexes.
 *
 * @example
 * ```ts
 * addIntrinsicInvocations({ checker, bindingOriginBySymbolId, call, argumentIndexes, summary });
 * ```
 */
export function addIntrinsicInvocations({
  checker,
  bindingOriginBySymbolId,
  call,
  argumentIndexes,
  summary,
}: {
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly argumentIndexes: readonly number[];
  readonly summary: MutableEffectSummary;
}): void {
  argumentIndexes.forEach(function invokedArgument(argumentIndex,): void {
    /**
     * Callable argument directly invoked by intrinsic.
     */
    const argument = call.arguments[argumentIndex];
    if (argument === undefined)
      return;
    parameterIndexes({
      checker,
      bindingOriginBySymbolId,
      node: argument,
      includedPropertyNames: ALL_PACKAGED_PROPERTIES,
    },)
      .forEach(function invokedOrigin(origin,): void {
        addEffectIndex({
          target: summary.directInvoked,
          value: origin,
        },);
      },);
  },);
}
