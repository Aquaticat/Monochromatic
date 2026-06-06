/**
 * Additional container run execution, caching, and scoring.
 *
 * When a probe uses `additionalRuns`, this module handles launching parallel
 * container runs, caching results, verifying output, and computing per-run
 * correctness. Fix-prompt diagnostics live in the diagnostics companion module.
 */
import {
  type ContainerResult,
  runInContainer,
} from '../container.ts';
import {
  l,
  tagged,
} from '../log.ts';

import type {
  AdditionalRun,
  VerifyResult,
} from './additional-run-types.ts';
import type { WritableCache, } from './probe-factory-types.ts';

/**
 * Options for {@link executeAdditionalRuns}.
 *
 * @example
 * ```ts
 * const options: ExecuteAdditionalRunsOptions = {
 *   source: probeSource,
 *   runs: probe.additionalRuns,
 *   signal: undefined,
 * };
 * ```
 */
type ExecuteAdditionalRunsOptions = {
  /**
   * Base TypeScript source (after main transformSource)
   */
  readonly source: string;
  /**
   * Additional run configurations
   */
  readonly runs: readonly AdditionalRun[];
  /**
   * Abort signal for cancellation
   */
  readonly signal?: AbortSignal;
};

/**
 * Launches additional container runs in parallel.
 * Applies per-run source transforms before execution.
 *
 * @param source - base TypeScript source (after main transformSource)
 *
 * @param runs - additional run configurations
 *
 * @param signal - abort signal for cancellation
 *
 * @returns promise resolving to container results in the same order as runs
 *
 * @example
 * ```ts
 * const results = await executeAdditionalRuns({ source, runs: config.additionalRuns, signal });
 * ```
 */
export function executeAdditionalRuns({
  source,
  runs,
  signal,
}: ExecuteAdditionalRunsOptions,): Promise<ContainerResult[]> {
  /**
   * Per-run container promises with optional source transforms applied
   */
  const promises = runs.map(function launchRun(run,): Promise<ContainerResult> {
    /**
     * Source with per-run transform applied (e.g. injected CLI flags)
     */
    const runSource = run.transformSource
      !== undefined
      ? run.transformSource(source,)
      : source;
    return runInContainer({
      source: runSource,
      stdinData: run.input,
      ...((signal !== undefined) ? { signal, } : {}),
    },);
  },);
  return Promise.all(promises,);
}

/**
 * Options for {@link cacheAdditionalResults}.
 *
 * @example
 * ```ts
 * const options: CacheAdditionalResultsOptions = {
 *   results: containerResults,
 *   runs: probe.additionalRuns,
 *   containerCaches,
 *   verifyCaches,
 *   label: 'Opus',
 * };
 * ```
 */
type CacheAdditionalResultsOptions = {
  /**
   * Container results from executeAdditionalRuns
   */
  readonly results: readonly ContainerResult[];
  /**
   * Additional run configurations (for verify functions)
   */
  readonly runs: readonly AdditionalRun[];
  /**
   * Per-run container result caches to populate
   */
  readonly containerCaches: readonly WritableCache<string, ContainerResult>[];
  /**
   * Per-run verification result caches to populate
   */
  readonly verifyCaches: readonly WritableCache<string, VerifyResult>[];
  /**
   * Model label for cache keys
   */
  readonly label: string;
};

/**
 * Caches additional run container results and verifies successful ones.
 * Populates both the container and verify caches for downstream use
 * by diagnostics and correctness scoring.
 *
 * @param results - container results from executeAdditionalRuns
 *
 * @param runs - additional run configurations (for verify functions)
 *
 * @param containerCaches - per-run container result caches to populate
 *
 * @param verifyCaches - per-run verification result caches to populate
 *
 * @param label - model label for cache keys
 *
 * @example
 * ```ts
 * cacheAdditionalResults({ results, runs, containerCaches, verifyCaches, label: 'Opus' });
 * ```
 */
export function cacheAdditionalResults({
  results,
  runs,
  containerCaches,
  verifyCaches,
  label,
}: CacheAdditionalResultsOptions,): void {
  for (const [index, result,] of results.entries()) {
    containerCaches[index]
      ?.set(
      label,
      result,
    );
    /**
     * Run configuration for this index, used to call verify on successful containers
     */
    const run = runs[index];
    if ((run !== undefined) && (result.exitCode
      === 0)
      && (!result.timedOut)) {
      verifyCaches[index]
        ?.set(
        label,
        run.verify(result,),
      );
    }
  }
}

/**
 * Options for {@link computeAdditionalCorrectnesses}.
 *
 * @example
 * ```ts
 * const options: ComputeAdditionalCorrectnessesOptions = {
 *   results: containerResults,
 *   runs: probe.additionalRuns,
 *   verifyCaches,
 *   label: 'Opus',
 *   probeName: 'csv-rfc4180',
 * };
 * ```
 */
type ComputeAdditionalCorrectnessesOptions = {
  /**
   * Container results from executeAdditionalRuns
   */
  readonly results: readonly ContainerResult[];
  /**
   * Additional run configurations (for names in log messages)
   */
  readonly runs: readonly AdditionalRun[];
  /**
   * Per-run verification caches populated by cacheAdditionalResults (read-only here)
   */
  readonly verifyCaches: readonly ReadonlyMap<string, VerifyResult>[];
  /**
   * Model label for cache lookups and log prefixes
   */
  readonly label: string;
  /**
   * Probe name for log prefixes
   */
  readonly probeName: string;
};

/**
 * Computes per-run correctness fractions from cached additional run results.
 * Returns 0 for runs that crashed or timed out, logging the failure.
 *
 * @param results - container results from executeAdditionalRuns
 *
 * @param runs - additional run configurations (for names in log messages)
 *
 * @param verifyCaches - per-run verification caches populated by cacheAdditionalResults
 *
 * @param label - model label for cache lookups and log prefixes
 *
 * @param probeName - probe name for log prefixes
 *
 * @returns array of correctness fractions (0-1) in the same order as runs
 *
 * @example
 * ```ts
 * const fractions = computeAdditionalCorrectnesses({ results, runs, verifyCaches, label: 'Opus', probeName: 'csv-rfc4180' });
 * // fractions might be [1.0, 0.0] for two additional runs
 * ```
 */
export function computeAdditionalCorrectnesses({
  results,
  runs,
  verifyCaches,
  label,
  probeName,
}: ComputeAdditionalCorrectnessesOptions,): number[] {
  return results.map(function scoreRun(
    result,
    index,
  ): number {
    if (result.timedOut
      || (result.exitCode
        !== 0)) {
      /**
       * Run name for the log message, falls back to numeric index
       */
      const runName = runs[index]
        ?.name
        ?? String(index,);
      /**
       * Run-specific logger for container failure messages.
       */
      const rl = tagged({
        tag: runName,
        l: tagged({
          tag: probeName,
          l: tagged({
            tag: label,
            l,
          },),
        },),
      },);
      rl.info(
        `container failed: exit=${String(result.exitCode,)} timedOut=${
          String(result.timedOut,)
        }`,
      );
      return 0;
    }
    return verifyCaches[index]
      ?.get(label,)
      ?.correctness
      ?? 0;
  },);
}
