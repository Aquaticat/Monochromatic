/**
 * Human-readable diagnostics for unresolved caller-observable effects.
 *
 * @module
 */

import type { Context, } from '@oxlint/plugins';

import type { CallableEffectSummary, } from './effect-summaries.ts';
import {
  everyBoundaryIsInputMethod,
  inputMethodUsageSubject,
} from './input-diagnostic-description.ts';
import { STRING_OBJECT_COERCION_PROVENANCE, } from './string-coercion-effect.ts';

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
  readonly parameterIndex: number;
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
  readonly uncertainty: UncertaintyBoundaries;
},): Parameters<Context['report']>[0] {
  /**
   * Number of unresolved provenance facts.
   */
  const factCount = uncertainty.facts
    .length;
  /**
   * First provenance fact for singleton-specialization checks.
   */
  const [firstFact,] = uncertainty.facts;
  /**
   * Whether only exact global String object conversion remains unresolved.
   */
  const onlyStringObjectCoercion = (factCount === 1)
    && (firstFact === STRING_OBJECT_COERCION_PROVENANCE);
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
    messageId: onlyStringObjectCoercion
      ? 'stringObjectCoercionEffect'
      : onlyInputMethods
        ? 'opaqueMethodEffect'
        : 'opaqueEffect',
    data: {
      inputSubject: onlyInputMethods
        ? inputMethodUsageSubject({
          boundaries: uncertainty.facts,
          targetIndexes,
          parameterIndex,
        },)
        : inputSubject,
      boundaries: uncertainty.names,
    },
  };
}
