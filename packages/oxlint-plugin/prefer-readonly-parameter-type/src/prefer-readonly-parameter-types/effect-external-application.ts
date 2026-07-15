/**
 * External callable effect mapping to caller parameter origins.
 *
 * @module
 */

import type { ExternalCallableEffect, } from './external-callable-effect.ts';
import {
  addEffectIndex,
  type MutableEffectSummary,
} from './effect-summary-model.ts';
import { addOpaqueEffect, } from './effect-call-resolution.ts';

/**
 * Applies inferred external callable effects to caller summary.
 *
 * @param externalEffect - Proven external implementation effect.
 *
 * @param argumentIndexes - Caller parameter origins by call argument.
 *
 * @param summary - Caller summary receiving mapped effects.
 *
 * @mutates summary - Adds proven mutation,
 * invocation,
 * and unresolved transitive effects.
 *
 * @example
 * ```ts
 * applyExternalEffect({ externalEffect, argumentIndexes, summary });
 * ```
 */
export function applyExternalEffect({
  externalEffect,
  argumentIndexes,
  summary,
}: {
  readonly externalEffect: ExternalCallableEffect;
  readonly argumentIndexes: readonly (readonly number[])[];
  readonly summary: MutableEffectSummary;
}): void {
  externalEffect.summary
    .referentMutatedParameterIndexes
    .forEach(function externalMutation(parameter,): void {
      argumentIndexes[parameter]
        ?.forEach(function callerMutation(index,): void {
          addEffectIndex({
            target: summary.directMutated,
            value: index,
          },);
        },);
    },);
  externalEffect.summary
    .invokedParameterIndexes
    .forEach(function externalInvocation(parameter,): void {
      argumentIndexes[parameter]
        ?.forEach(function callerInvocation(index,): void {
          addEffectIndex({
            target: summary.directInvoked,
            value: index,
          },);
        },);
    },);
  externalEffect.summary
    .callbackRelations
    .forEach(function externalCallbackRelation(relation,): void {
      argumentIndexes[relation.sourceParameterIndex]
        ?.forEach(function callbackSourceUncertainty(index,): void {
          addOpaqueEffect({
            summary,
            affectedParameterIndex: index,
            provenance: `${externalEffect.provenance} callback argument ${String(relation.callbackArgumentIndex,)}`,
          },);
        },);
    },);
  new Set([
    ...externalEffect.summary
      .opaqueParameterIndexes,
    ...externalEffect.summary
      .documentedUncertainParameterIndexes,
  ],)
    .forEach(function externalUncertainty(parameter,): void {
      argumentIndexes[parameter]
        ?.forEach(function callerUncertainty(index,): void {
          addOpaqueEffect({
            summary,
            affectedParameterIndex: index,
            provenance: externalEffect.provenance,
          },);
        },);
    },);
}
