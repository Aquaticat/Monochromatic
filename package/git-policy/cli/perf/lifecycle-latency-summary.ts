/**
 * Shared sample summarizing for the lifecycle latency benchmark.
 *
 * @module
 */
import {
  median,
  medianAbsoluteDeviation,
  p95,
} from './lifecycle-latency-command.ts';
import {
  LifecycleBenchmarkError,
  MAXIMUM_BUDGET_MS,
  RECORDED_RUNS,
  SCENARIO_BUDGETS,
  type CommandSample,
  type LifecycleMetric,
  type LifecycleScenarioId,
  type ScenarioSummary,
  WARMUP_RUNS,
} from './lifecycle-latency-contracts.ts';

/**
 * Decimal places in failure diagnostics.
 */
const DECIMAL_PLACES = 3;

/**
 * Creates zero-based measurement indices including warm-ups.
 *
 * @returns ordered indices
 *
 * @example
 * ```ts
 * measurementIndices().length;
 * ```
 */
export function measurementIndices(): readonly number[] {
  return Array.from(
    { length: WARMUP_RUNS + RECORDED_RUNS, },
    function measurementIndex(
      _unused,
      index,
    ) {
      return index;
    },
  );
}

/**
 * Selects metric values from samples.
 *
 * @param samples - recorded paired samples
 *
 * @returns wrapper-added observations
 *
 * @example
 * ```ts
 * metricValues({ samples: [{ wrapperMs: 2, addedMs: 1 }] });
 * // => [1]
 * ```
 */
export function metricValues({
  samples,
}: Readonly<{
  samples: readonly CommandSample[];
}>,): readonly number[] {
  return samples.map(function sampleMetric(sample,) {
    if (sample.addedMs === undefined)
      throw new LifecycleBenchmarkError('Paired scenario omitted wrapper-added latency.',);
    return sample.addedMs;
  },);
}

/**
 * Summarizes and enforces one measured scenario.
 *
 * @param id - stable scenario identity
 *
 * @param metric - enforced metric
 *
 * @param samples - recorded samples
 *
 * @returns measured summary
 *
 * @throws LifecycleBenchmarkError when a recorded value reaches the scenario budget
 *
 * @example
 * ```ts
 * summarize({ id: 'no-config', metric: 'wrapper-added', samples: [{ wrapperMs: 2, addedMs: 1 }] });
 * ```
 */
export function summarize({
  id,
  metric,
  samples,
}: Readonly<{
  id: LifecycleScenarioId;
  metric: LifecycleMetric;
  samples: readonly CommandSample[];
}>,): ScenarioSummary {
  /**
   * Values selected by scenario metric.
   */
  const values = metricValues({ samples, },);
  /**
   * Largest recorded metric value.
   */
  const maximumMs = Math.max(...values,);
  /**
   * Measured scenario budget.
   */
  const budgetMs = SCENARIO_BUDGETS[id];
  /**
   * Explicit baseline-capture mode used before budgets are written.
   */
  const capturesBaseline = process.env
    .CLI_GIT_CAPTURE_LATENCY_BASELINE
    === '1';
  if ((!capturesBaseline)
    && ((budgetMs >= MAXIMUM_BUDGET_MS) || (maximumMs >= budgetMs))) {
    throw new LifecycleBenchmarkError(
      `${id} ${metric} latency ${maximumMs.toFixed(DECIMAL_PLACES,)} ms reached ${String(budgetMs,)} ms budget.`,
    );
  }
  return {
    id,
    metric,
    budgetMs,
    maximumMs,
    medianMs: median(values,),
    p95Ms: p95(values,),
    madMs: medianAbsoluteDeviation(values,),
    samples,
  };
}
