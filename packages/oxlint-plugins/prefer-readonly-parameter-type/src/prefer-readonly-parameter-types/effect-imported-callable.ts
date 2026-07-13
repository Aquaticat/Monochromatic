/**
 * Imported and global callable effect application.
 *
 * @module
 */

import type { CallExpression, } from 'typescript/unstable/ast';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

import { NO_INTRINSIC_EFFECT, } from './intrinsic-effect-catalog.ts';
import { auditedCallableEffect, } from './effect-call-observation.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import {
  ALL_PACKAGED_PROPERTIES,
  parameterIndexes,
} from './effect-call-resolution.ts';

/**
 * Applies exact non-method callable effect when cataloged.
 *
 * @param project - TypeScript project resolving callable provenance.
 *
 * @param checker - TypeScript checker resolving argument origins.
 *
 * @param bindingOriginBySymbolId - Current callable bindings to source parameters.
 *
 * @param call - Imported or global call candidate.
 *
 * @param summary - Current callable summary receiving mutations.
 *
 * @returns whether exact callable effect was cataloged.
 *
 * @mutates summary - Adds audited imported-call argument effects.
 *
 * @example
 * ```ts
 * applyAuditedCallableEffect({ project, checker, bindingOriginBySymbolId, call, summary });
 * ```
 */
export function applyAuditedCallableEffect({
  project,
  checker,
  bindingOriginBySymbolId,
  call,
  summary,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, number>;
  readonly call: CallExpression;
  readonly summary: MutableEffectSummary;
},): boolean {
  /**
   * Exact imported or global callable effect when cataloged.
   */
  const callableEffect = auditedCallableEffect({
    project,
    checker,
    expression: call.expression,
  },);
  if (callableEffect === NO_INTRINSIC_EFFECT)
    return false;
  callableEffect.targets
    .forEach(function callableTarget(target,): void {
      if (target.kind !== 'argument')
        return;
      /**
       * Call argument selected by audited callable effect target.
       */
      const argument = call.arguments[target.index];
      if (argument === undefined)
        return;
      parameterIndexes({
        checker,
        bindingOriginBySymbolId,
        node: argument,
        includedPropertyNames: target.propertyNames === undefined
          ? ALL_PACKAGED_PROPERTIES
          : new Set(target.propertyNames,),
      },)
        .forEach(function addCallableMutation(index,): void {
          addEffectIndex({
            target: summary.directMutated,
            value: index,
          },);
        },);
    },);
  return true;
}
