/**
 * External callable effect mapping to caller parameter origins.
 *
 * @module
 */

import type { ExternalCallableEffect, } from './external-callable-effect.ts';
import type { EffectSlot, } from './effect-slot-identity.ts';
import {
  addEffectSlot,
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
  readonly argumentIndexes: readonly (readonly EffectSlot[])[];
  readonly summary: MutableEffectSummary;
}): void {
  /* Every lookup below indexes an actual-position array with a parameter position of the
   * external callee. The two coincide only for a plain positional call, which predates slots
   * and is unchanged by them, and no brand catches it because indexing accepts any number.
   * External summaries stay parameter-level deliberately: a slot number means nothing across
   * a project boundary, where the declaration a consumer resolves need not be the one the
   * external analyzer inspected. */
  externalEffect.summary
    .referentMutatedParameterIndexes
    .forEach(function externalMutation(parameter,): void {
      argumentIndexes[parameter]
        ?.forEach(function callerMutation(index,): void {
          addEffectSlot({
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
          addEffectSlot({
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
            affectedSlot: index,
            provenance: `${externalEffect.provenance} callback argument ${String(relation.callbackArgumentPosition,)}`,
          },);
        },);
    },);
  externalEffect.summary
    .opaqueParameterIndexes
    .forEach(function externalUncertainty(parameter,): void {
      argumentIndexes[parameter]
        ?.forEach(function callerUncertainty(index,): void {
          addOpaqueEffect({
            summary,
            affectedSlot: index,
            provenance: externalEffect.provenance,
          },);
        },);
    },);
}
