/**
 * Performance result caching and multiplier computation for the scoring pipeline.
 *
 * Extracted from {@link scoreImpl} to keep the scoring module under the line limit.
 */
import {
  l,
  tagged,
} from '../log.ts';
import {
  computePerfScore,
  type TimedContainerResult,
} from './perf.ts';

import type { ScoreContext, } from '../probes.ts';
import type {
  CodeGenProbeConfig,
  WritableProbeFactoryCaches,
} from './probe-factory-types.ts';

/**
 * Options for {@link cacheAndComputePerfMultiplier}.
 *
 * @example
 * ```ts
 * const options: CacheAndComputePerfMultiplierOptions = {
 *   config: probeConfig,
 *   context: scoreContext,
 *   caches: probeFactoryCaches,
 *   perfResult: timedResult,
 * };
 * ```
 */
type CacheAndComputePerfMultiplierOptions = {
  /**
   * Probe configuration (for perfTest thresholds and probe name)
   */
  readonly config: CodeGenProbeConfig;
  /**
   * Scoring context (for model label in logs and cache keys)
   */
  readonly context: ScoreContext;
  /**
   * Shared caches to populate with the perf result
   */
  readonly caches: WritableProbeFactoryCaches;
  /**
   * Timed container result, omitted when no perf test ran
   */
  readonly perfResult?: TimedContainerResult;
};

/**
 * Caches the perf result and computes the performance multiplier.
 *
 * When no perf test is configured or no result is available, returns 1 (no penalty).
 * Otherwise caches the result, computes a 0-1 score via {@link computePerfScore},
 * and logs the duration and score.
 *
 * @param config - probe configuration (for perfTest thresholds and probe name)
 *
 * @param context - scoring context (for model label in logs and cache keys)
 *
 * @param caches - shared caches to populate with the perf result
 *
 * @param perfResult - timed container result, undefined when no perf test ran
 *
 * @returns performance multiplier in [0, 1]
 *
 * @example
 * ```ts
 * const multiplier = cacheAndComputePerfMultiplier({ config, context, caches, perfResult });
 * finalScore *= multiplier;
 * ```
 */
export function cacheAndComputePerfMultiplier({
  config,
  context,
  caches,
  perfResult,
}: CacheAndComputePerfMultiplierOptions,): number {
  if ((config.perfTest
    === undefined) || (perfResult === undefined))
    return 1;
  caches.perf
    .set(
    context.label,
    perfResult,
  );
  /**
   * Multiplier in [0, 1] derived from `perfResult.durationMs` against the configured thresholds.
   */
  const score = computePerfScore({
    perfResult,
    config: config.perfTest,
  },);
  /**
   * Probe-specific logger for perf result messages.
   */
  const rl = tagged({
    tag: config.name,
    l: tagged({
      tag: context.label,
      l,
    },),
  },);
  rl.info(
    `perf: ${String(perfResult.durationMs,)}ms score=${score.toFixed(2,)}`,
  );
  return score;
}
