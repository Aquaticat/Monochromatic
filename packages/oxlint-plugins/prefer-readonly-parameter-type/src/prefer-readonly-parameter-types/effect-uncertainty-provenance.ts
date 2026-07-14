/**
 * Uncertain effect provenance propagation across owned calls.
 *
 * @module
 */

import {
  type CallEdge,
  type MutableEffectSummary,
  PARAMETER_INDEX_UNAVAILABLE,
} from './effect-summary-model.ts';

/**
 * Adds uncertainty provenance facts for one caller parameter.
 *
 * @param target - Caller provenance map receiving facts.
 *
 * @param parameterIndex - Caller parameter affected by uncertain boundary.
 *
 * @param provenanceFacts - Callee provenance facts to propagate.
 *
 * @returns whether target changed.
 *
 * @mutates target - Adds previously unseen uncertainty provenance facts.
 *
 * @example
 * ```ts
 * addUncertaintyProvenance({ target, parameterIndex: 0, provenanceFacts });
 * ```
 */
export function addUncertaintyProvenance({
  target,
  parameterIndex,
  provenanceFacts,
}: {
  readonly target: Map<number, Set<string>>;
  readonly parameterIndex: number | typeof PARAMETER_INDEX_UNAVAILABLE;
  readonly provenanceFacts: ReadonlySet<string>;
},): boolean {
  if (parameterIndex === PARAMETER_INDEX_UNAVAILABLE)
    return false;
  /**
   * Existing caller provenance or new accumulator.
   */
  const callerFacts = target.get(parameterIndex,) ?? new Set<string>();
  /**
   * Size before union detects fixed-point progress.
   */
  const priorSize = callerFacts.size;
  provenanceFacts.forEach(function add(provenance,): void {
    callerFacts.add(provenance,);
  },);
  target.set(
    parameterIndex,
    callerFacts,
  );
  return callerFacts.size !== priorSize;
}

/**
 * Maps opaque or documented uncertainty provenance through one owned call edge.
 *
 * @param summary - Caller summary receiving provenance.
 *
 * @param calleeSummary - Callee summary providing provenance facts.
 *
 * @param edge - Caller-to-callee argument mapping.
 *
 * @param calleeIndexes - Callee parameters carrying uncertain effects.
 *
 * @returns whether caller provenance changed.
 *
 * @mutates summary - Adds caller uncertainty provenance inherited from callee.
 *
 * @example
 * ```ts
 * propagateUncertaintyProvenance({ summary, calleeSummary, edge, calleeIndexes });
 * ```
 */
export function propagateUncertaintyProvenance({
  summary,
  calleeSummary,
  edge,
  calleeIndexes,
}: {
  readonly summary: MutableEffectSummary;
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
  readonly calleeIndexes: ReadonlySet<number>;
},): boolean {
  /**
   * Whether any caller provenance fact was added.
   */
  let changed = false;
  for (const calleeIndex of calleeIndexes) {
    /**
     * Caller parameters packaged into uncertain callee parameter.
     */
    const callerIndexes = edge.arguments[calleeIndex] ?? [];
    /**
     * Provenance facts attached to uncertain callee parameter.
     */
    const provenanceFacts = calleeSummary.opaqueProvenanceByParameter
      .get(calleeIndex,)
      ?? new Set<string>();
    for (const callerIndex of callerIndexes) {
      changed = addUncertaintyProvenance({
        target: summary.opaqueProvenanceByParameter,
        parameterIndex: callerIndex,
        provenanceFacts,
      },) || changed;
    }
  }
  return changed;
}
