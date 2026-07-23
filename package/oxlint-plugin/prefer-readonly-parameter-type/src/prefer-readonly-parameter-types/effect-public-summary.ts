/**
 * Public effect-summary projection from mutable fixed-point state.
 *
 * @module
 */

import type { MutableEffectSummary, } from './effect-summary-model.ts';
import type { CallableEffectSummary, } from './effect-summary-index.ts';

/**
 * Converts completed mutable summary to public immutable view.
 *
 * @param summary - Completed fixed-point summary.
 *
 * @param foreignParameterIndexes - Guaranteed foreign-owned parameter indexes.
 *
 * @returns copied public effect summary.
 *
 * @example
 * ```ts
 * effectPublicSummary({ summary, foreignParameterIndexes });
 * ```
 */
export function effectPublicSummary({
  summary,
  foreignParameterIndexes,
}: {
  readonly summary: MutableEffectSummary;
  readonly foreignParameterIndexes: ReadonlySet<number>;
}): CallableEffectSummary {
  return {
    mutatedParameterIndexes: new Set([
      ...summary.mutated,
      ...summary.invoked,
      ...summary.documentedUncertain,
    ],),
    referentMutatedParameterIndexes: summary.mutated,
    invokedParameterIndexes: summary.invoked,
    documentedUncertainParameterIndexes: summary.documentedUncertain,
    opaqueParameterIndexes: summary.opaque,
    opaqueProvenanceByParameter: summary.opaqueProvenanceByParameter,
    foreignBorrowedParameterIndexes: foreignParameterIndexes,
    callbackRelations: [...summary.relations,],
  };
}
