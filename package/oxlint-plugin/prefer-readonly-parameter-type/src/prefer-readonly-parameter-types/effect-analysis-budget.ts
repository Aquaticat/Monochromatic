/**
 * Fail-closed synchronous effect-analysis runtime budget.
 *
 * @module
 */

import { performance, } from 'node:perf_hooks';

import { SemanticBridgeError, } from './semantic-bridge-error.ts';

/**
 * Default project-wide analyzer budget guarding pathological reachable graphs.
 * Workload-specific latency gates remain stricter than this safety ceiling.
 */
const DEFAULT_ANALYSIS_BUDGET_MILLISECONDS = 120_000;

/**
 * Cumulative synchronous analysis budget for one exact project index.
 */
export type EffectAnalysisBudget = {
  readonly start: () => number;
  readonly record: (options: {
    readonly startedAt: number;
    readonly phase: string;
  }) => void;
  readonly assertAvailable: (phase: string) => void;
};

/**
 * Creates cumulative runtime budget that rejects incomplete analysis.
 *
 * @param limitMilliseconds - Maximum measured analyzer time.
 *
 * @returns timer recording only synchronous analyzer operations.
 *
 * @throws TypeError when configured limit is negative or not finite.
 *
 * @example
 * ```ts
 * const budget = createEffectAnalysisBudget();
 * const startedAt = budget.start();
 * budget.record({ startedAt, phase: 'source' });
 * ```
 */
export function createEffectAnalysisBudget(
  limitMilliseconds: number = DEFAULT_ANALYSIS_BUDGET_MILLISECONDS,
): EffectAnalysisBudget {
  if ((!Number.isFinite(limitMilliseconds,)) || (limitMilliseconds < 0))
    throw new TypeError(`Effect analysis budget must be a finite nonnegative number: ${String(limitMilliseconds,)}.`,);
  /**
   * Mutable cumulative analyzer duration excluding time between Oxlint callbacks.
   */
  const state = { consumedMilliseconds: 0, };

  /**
   * Throws stable fail-closed error after budget is exhausted.
   *
   * @param phase - Analyzer phase that cannot safely continue.
   *
   * @throws SemanticBridgeError when no runtime budget remains.
   */
  function assertAvailable(phase: string,): void {
    if (state.consumedMilliseconds < limitMilliseconds)
      return;
    throw new SemanticBridgeError({
      reason: 'analysis-incomplete',
      message: `Effect analysis budget exhausted before ${phase}: ${String(state.consumedMilliseconds,)}ms of ${String(limitMilliseconds,)}ms consumed.`,
    },);
  }

  return {
    start(): number {
      return performance.now();
    },
    record({
      startedAt,
      phase,
    },): void {
      state.consumedMilliseconds += performance.now() - startedAt;
      assertAvailable(phase,);
    },
    assertAvailable,
  };
}
