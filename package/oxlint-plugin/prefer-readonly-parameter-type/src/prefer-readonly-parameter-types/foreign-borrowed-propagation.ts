/**
 * Guaranteed foreign-ownership provenance propagation over owned call graph.
 *
 * @module
 */

import type {
  CallEdge,
  MutableEffectSummary,
} from './effect-summary-model.ts';

/**
 * One inbound owned call carrying caller state into callee.
 */
type ForeignInbound = {
  readonly callerKey: string;
  readonly edge: CallEdge;
};

/**
 * Tests whether one inbound argument is wholly foreign-owned.
 *
 * @param inbound - Caller identity and argument mapping.
 *
 * @param calleeIndex - Callee parameter position under test.
 *
 * @param candidates - Current guaranteed foreign indexes by callable.
 *
 * @returns whether all mutable origins in argument are foreign-owned.
 */
function inboundArgumentIsForeign({
  inbound,
  calleeIndex,
  candidates,
}: {
  readonly inbound: ForeignInbound;
  readonly calleeIndex: number;
  readonly candidates: ReadonlyMap<string, ReadonlySet<number>>;
},): boolean {
  /**
   * Argument mapping carried by inbound call.
   */
  const { edge, } = inbound;
  if (edge.directForeignArguments[calleeIndex] === true)
    return true;
  /**
   * Caller parameter origins packaged into current callee argument.
   */
  const callerIndexes = edge.foreignArguments[calleeIndex] ?? [];
  /**
   * Current guaranteed indexes for caller declaration.
   */
  const callerCandidates = candidates.get(inbound.callerKey,) ?? new Set<number>();
  return (callerIndexes.length > 0)
    && callerIndexes.every(function callerIsForeign(callerIndex,): boolean {
      return callerCandidates.has(callerIndex,);
    },);
}

/**
 * Collects every owned incoming call by callee declaration key.
 *
 * @param summaries - Call graph summaries to index.
 *
 * @returns immutable inbound lists by callee key.
 */
function collectInbounds(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): ReadonlyMap<string, readonly ForeignInbound[]> {
  /**
   * Inbound call lists accumulated by callee key.
   */
  const incomingByCallee = new Map<string, readonly ForeignInbound[]>();
  for (const [callerKey, callerSummary,] of summaries) {
    for (const edge of callerSummary.calls) {
      if (!edge.foreignInbound)
        continue;
      incomingByCallee.set(
        edge.calleeKey,
        [
          ...incomingByCallee.get(edge.calleeKey,) ?? [],
          {
            callerKey,
            edge,
          },
        ],
      );
    }
  }
  return incomingByCallee;
}

/**
 * Creates optimistic candidates for greatest fixed-point narrowing.
 *
 * @param summaries - Summaries providing explicit markers and parameter counts.
 *
 * @param incomingByCallee - Inbound calls proving declarations are reached.
 *
 * @returns mutable candidate sets owned by propagation pass.
 */
function initializeCandidates({
  summaries,
  incomingByCallee,
}: {
  readonly summaries: ReadonlyMap<string, MutableEffectSummary>;
  readonly incomingByCallee: ReadonlyMap<string, readonly ForeignInbound[]>;
},): Map<string, Set<number>> {
  /**
   * Optimistic guaranteed indexes by callable declaration.
   */
  const candidates = new Map<string, Set<number>>();
  for (const [key, summary,] of summaries) {
    /**
     * Explicit marker indexes preserved regardless of inbound calls.
     */
    const callableCandidates = new Set(summary.directForeignBorrowed,);
    if ((incomingByCallee.get(key,) ?? []).length > 0) {
      for (let parameterIndex = 0;
        parameterIndex < summary.parameterCount;
        parameterIndex++) {
        callableCandidates.add(parameterIndex,);
      }
    }
    candidates.set(
      key,
      callableCandidates,
    );
  }
  return candidates;
}

/**
 * Counts parameter candidates bounding provenance narrowing passes.
 *
 * @param summaries - Summaries whose parameters may carry provenance.
 *
 * @returns total parameter count.
 */
function totalParameterCount(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): number {
  /**
   * Running total across callable parameter counts.
   */
  let count = 0;
  for (const summary of summaries.values())
    count += summary.parameterCount;
  return count;
}

/**
 * Computes guaranteed foreign ownership across every owned inbound call.
 *
 * Greatest-fixed-point initialization supports recursive helpers reached from
 * marked boundary while any owned inbound argument removes guarantee.
 *
 * @param summaries - Readonly call graph and explicit marker facts.
 *
 * @returns guaranteed foreign parameter indexes by callable key.
 *
 * @example
 * ```ts
 * const foreignByCallable = propagateForeignBorrowed(summaries);
 * ```
 */
export function propagateForeignBorrowed(
  summaries: ReadonlyMap<string, MutableEffectSummary>,
): ReadonlyMap<string, ReadonlySet<number>> {
  /**
   * Inbound calls grouped by callee declaration.
   */
  const incomingByCallee = collectInbounds(summaries,);
  /**
   * Optimistic candidates narrowed until every inbound call agrees.
   */
  const candidates = initializeCandidates({
    summaries,
    incomingByCallee,
  },);
  /**
   * Maximum narrowing passes before every candidate bit stabilizes.
   */
  const parameterCount = totalParameterCount(summaries,);
  /**
   * Mutable convergence state for candidate removal.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed && (state.pass <= parameterCount)) {
    state.changed = false;
    state.pass++;
    for (const [key, summary,] of summaries) {
      /**
       * Every owned call reaching current declaration.
       */
      const inbounds = incomingByCallee.get(key,) ?? [];
      /**
       * Candidate indexes for current declaration.
       */
      const callableCandidates = candidates.get(key,) ?? new Set<number>();
      for (let parameterIndex = 0;
        parameterIndex < summary.parameterCount;
        parameterIndex++) {
        /**
         * Whether exact marker directly covers current parameter.
         */
        const directlyForeign = summary.directForeignBorrowed
          .has(parameterIndex,);
        if (directlyForeign)
          continue;
        /**
         * Whether every inbound argument is wholly foreign-owned.
         */
        const guaranteed = (inbounds.length > 0)
          && inbounds.every(function inboundIsForeign(inbound,): boolean {
            return inboundArgumentIsForeign({
              inbound,
              calleeIndex: parameterIndex,
              candidates,
            },);
          },);
        if (guaranteed)
          continue;
        state.changed = callableCandidates.delete(parameterIndex,) || state.changed;
      }
    }
  }
  return candidates;
}
