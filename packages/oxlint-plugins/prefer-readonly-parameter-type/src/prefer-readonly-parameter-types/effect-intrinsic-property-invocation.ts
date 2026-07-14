/**
 * Audited callback-property invocation propagation.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type { Checker, } from 'typescript/unstable/sync';

import { parameterIndexes, } from './effect-call-resolution.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import type { IntrinsicArgumentPropertyInvocation, } from './intrinsic-effect-catalog.ts';

/**
 * Records source parameters exposing callback properties invoked by an audited callable.
 *
 * @param checker - TypeScript checker resolving shorthand property origins.
 *
 * @param bindingOriginBySymbolId - Current callable bindings to source parameters.
 *
 * @param call - Audited call carrying object arguments.
 *
 * @param effects - Argument and property selections known to be invoked.
 *
 * @param summary - Current callable summary receiving invocation effects.
 *
 * @mutates summary - Adds invoked parameter indexes for selected callback properties.
 *
 * @example
 * ```ts
 * addIntrinsicPropertyInvocations({ checker, bindingOriginBySymbolId, call, effects, summary });
 * ```
 */
export function addIntrinsicPropertyInvocations({
  checker,
  bindingOriginBySymbolId,
  call,
  effects,
  summary,
}: {
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly effects: readonly IntrinsicArgumentPropertyInvocation[];
  readonly summary: MutableEffectSummary;
}): void {
  effects.forEach(function invokedArgumentProperty(effect,): void {
    /**
     * Object argument carrying invoked callback properties.
     */
    const argument = call.arguments[effect.argumentIndex];
    if (argument === undefined)
      return;
    parameterIndexes({
      checker,
      bindingOriginBySymbolId,
      node: argument,
      includedPropertyNames: new Set(effect.propertyNames,),
    },)
      .forEach(function invokedPropertyOrigin(origin,): void {
        addEffectIndex({
          target: summary.directInvoked,
          value: origin,
        },);
      },);
  },);
}
