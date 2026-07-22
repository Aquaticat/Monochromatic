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
import { originBoundaryName, } from './effect-origin-location.ts';

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
 * @param parsedContracts - Echo of every parsed contract block.
 *
 * @param undocumentedContractBoundaries - Plain boundary names no parsed
 * contract explanation documents; empty when no contract targets this
 * parameter, so the coverage note only appears for the
 * present-but-incomplete case the numbered remediations do not single out.
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
  parsedContracts,
  undocumentedContractBoundaries,
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
  readonly parsedContracts: string;
  readonly undocumentedContractBoundaries: readonly string[];
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
    && (originBoundaryName(firstFact ?? '',) === STRING_OBJECT_COERCION_PROVENANCE);
  /**
   * Whether every unknown call is a method on one current input binding.
   */
  const onlyInputMethods = everyBoundaryIsInputMethod({
    boundaries: uncertainty.facts,
    targetIndexes,
    parameterIndex,
  },);
  /**
   * First undocumented boundary, doubling as a concrete matching example.
   */
  const [firstUndocumented,] = undocumentedContractBoundaries;
  /**
   * Coverage note for a contract that exists but leaves calls unnamed; the
   * echoed contract list alone cannot show which calls remain uncovered or
   * that matching is literal.
   */
  const contractCoverage = firstUndocumented === undefined
    ? ''
    : `\n\nA @mutates contract for this input was parsed, but its explanation does not mention these calls: ${
      undocumentedContractBoundaries.join(', ',)
    }. The rule matches literally: an explanation covers a call once it contains that call's name (for example "${firstUndocumented}"), or a documentation URL (http:// or https://) together with the name after the call's last dot.`;
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
      parsedContracts,
      contractCoverage,
    },
  };
}
