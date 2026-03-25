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
 * const results = await executeAdditionalRuns(source, config.additionalRuns, signal);
 * ```
 */
export function executeAdditionalRuns(
  source: string,
  runs: readonly AdditionalRun[],
  signal: AbortSignal | undefined,
): Promise<ContainerResult[]> {
  /** Per-run container promises with optional source transforms applied */
  const promises = runs.map(function launchRun(run,): Promise<ContainerResult> {
    /** Source with per-run transform applied (e.g. injected CLI flags) */
    const runSource = run.transformSource !== undefined
      ? run.transformSource(source,)
      : source;
    return runInContainer(
      runSource,
      run.input,
      signal,
    );
  },);
  return Promise.all(promises,);
}

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
 */
export function cacheAdditionalResults(
  results: readonly ContainerResult[],
  runs: readonly AdditionalRun[],
  containerCaches: Map<string, ContainerResult>[],
  verifyCaches: Map<string, VerifyResult>[],
  label: string,
): void {
  for (const [index, result,] of results.entries()) {
    containerCaches[index]?.set(
      label,
      result,
    );
    /** Run configuration for this index, used to call verify on successful containers */
    const run = runs[index];
    if (run !== undefined && result.exitCode === 0 && !result.timedOut)
      verifyCaches[index]?.set(
        label,
        run.verify(result,),
      );
  }
}

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
 */
export function computeAdditionalCorrectnesses(
  results: readonly ContainerResult[],
  runs: readonly AdditionalRun[],
  verifyCaches: readonly Map<string, VerifyResult>[],
  label: string,
  probeName: string,
): number[] {
  return results.map(function scoreRun(
    result,
    index,
  ): number {
    if (result.timedOut || result.exitCode !== 0) {
      /** Run name for the log message, falls back to numeric index */
      const runName = runs[index]?.name ?? String(index,);
      /** Run-specific logger for container failure messages. */
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
        `container failed: exit=${
          String(result.exitCode,)
        } timedOut=${String(result.timedOut,)}`,
      );
      return 0;
    }
    return verifyCaches[index]?.get(label,)?.correctness ?? 0;
  },);
}
