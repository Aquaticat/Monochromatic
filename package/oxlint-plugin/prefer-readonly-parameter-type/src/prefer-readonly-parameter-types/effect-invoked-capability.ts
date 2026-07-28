/**
 * Invoked callback-capability propagation across owned call edges.
 *
 * @module
 */

import {
  addEffectSlot,
  type CallEdge,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
} from './effect-summary-model.ts';

/**
 * Propagates invocation when caller forwards unknown callback capability.
 *
 * Owned callback bodies are summarized independently, so invoking pure local
 * callback does not claim mutation of callback object or captured values.
 *
 * @param summaries - Owned callback summaries by declaration key.
 *
 * @param summary - Caller receiving forwarded invocation effect.
 *
 * @param calleeSummary - Callee declaring invoked capability parameters.
 *
 * @param edge - Caller arguments and owned callback identities.
 *
 * @returns whether caller invocation or mutation effects changed.
 *
 * @mutates summary - Adds invocation inherited through forwarded callbacks.
 *
 * @example
 * ```ts
 * propagateInvokedCapabilities({ summaries, summary, calleeSummary, edge });
 * ```
 */
export function propagateInvokedCapabilities({
  summaries,
  summary,
  calleeSummary,
  edge,
}: {
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly summary: MutableEffectSummary;
  readonly calleeSummary: MutableEffectSummary;
  readonly edge: CallEdge;
},): boolean {
  /**
   * Whether any caller invocation effect was added.
   */
  let changed = false;
  for (const calleeIndex of calleeSummary.invoked) {
    /**
     * Owned callback declaration passed to invoked parameter.
     */
    const callbackKey = edge.callbackKeysByCalleeSlot[calleeIndex];
    if ((callbackKey !== undefined)
      && (callbackKey !== OWNED_CALLABLE_UNAVAILABLE)
      && summaries.has(callbackKey,))
      continue;
    for (const callerIndex of edge.originsByCalleeSlot[calleeIndex] ?? []) {
      changed = addEffectSlot({
        target: summary.invoked,
        value: callerIndex,
      },) || changed;
    }
  }
  return changed;
}
