/**
 * Human-readable diagnostics for unresolved caller-observable effects.
 *
 * @module
 */

import type { Context, } from '@oxlint/plugins';

import type { ParameterIndex, } from './effect-slot-identity.ts';
import type { CallableEffectSummary, } from './effect-summaries.ts';
import {
  everyBoundaryIsInputMethod,
  inputMethodUsageSubject,
} from './input-diagnostic-description.ts';

/**
 * Sorted uncertainty provenance and display text for one parameter.
 *
 * @example
 * ```ts
 * const uncertainty: UncertaintyBoundaries = {
 *   facts: ['JSON.stringify'],
 *   names: 'JSON.stringify',
 * };
 * ```
 */
export type UncertaintyBoundaries = {
  readonly facts: readonly string[];
  readonly names: string;
};

/**
 * Reads stable uncertainty provenance for one parameter.
 *
 * @param effectSummary - Callable effects carrying upstream provenance.
 *
 * @param parameterIndex - Parameter whose uncertainty is described.
 *
 * @returns sorted facts and human-readable fallback.
 *
 * @example
 * ```ts
 * uncertaintyBoundaries({ effectSummary, parameterIndex: 0 });
 * ```
 */
export function uncertaintyBoundaries({
  effectSummary,
  parameterIndex,
}: {
  readonly effectSummary: CallableEffectSummary;
  readonly parameterIndex: ParameterIndex;
},): UncertaintyBoundaries {
  /**
   * Sorted upstream boundary names retained by effect propagation.
   */
  const facts = [
    ...effectSummary.opaqueProvenanceByParameter
      .get(parameterIndex,)
      ?? [],
  ].toSorted();
  return {
    facts,
    names: facts.length === 0
      ? 'a call whose name this rule could not determine'
      : facts.join(', ',),
  };
}

/**
 * Builds unresolved external effect report for one input.
 *
 * @param loc - Parameter source location.
 *
 * @param inputSubject - Plain-language input description.
 *
 * @param affectedNames - Bindings whose own slot carries the opacity, absent to name them all.
 *
 * @param targetIndexes - Authored targets mapped to parameter indexes.
 *
 * @param parameterIndex - Parameter carrying unresolved effects.
 *
 * @param uncertainty - Sorted upstream boundary description.
 *
 * @returns unresolved-effect report descriptor.
 *
 * @example
 * ```ts
 * opaqueEffectReport({ loc, inputSubject, targetIndexes, parameterIndex, uncertainty });
 * ```
 */
export function opaqueEffectReport({
  loc,
  inputSubject,
  targetIndexes,
  parameterIndex,
  uncertainty,
  affectedNames,
}: {
  readonly loc: {
    readonly start: {
      readonly line: number;
      readonly column: number;
    };
    readonly end: {
      readonly line: number;
      readonly column: number;
    };
  };
  readonly inputSubject: string;
  readonly targetIndexes: ReadonlyMap<string, number>;
  readonly parameterIndex: number;
  readonly affectedNames?: ReadonlySet<string>;
  readonly uncertainty: UncertaintyBoundaries;
},): Parameters<Context['report']>[0] {
  /**
   * Whether every unknown call is a method on one current input binding.
   */
  const onlyInputMethods = everyBoundaryIsInputMethod({
    boundaries: uncertainty.facts,
    targetIndexes,
    parameterIndex,
  },);
  return {
    loc,
    messageId: onlyInputMethods
      ? 'opaqueMethodEffect'
      : 'opaqueEffect',
    data: {
      inputSubject: onlyInputMethods
        ? inputMethodUsageSubject({
          boundaries: uncertainty.facts,
          targetIndexes,
          parameterIndex,
          ...(affectedNames === undefined) ? {} : { affectedNames, },
        },)
        : inputSubject,
      boundaries: uncertainty.names,
    },
  };
}
