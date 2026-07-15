/**
 * Performance scoring for code-generation probes.
 *
 * Runs the generated source against a larger input, measures wall-clock time,
 * and converts the duration into a 0-1 multiplier. This multiplier is applied
 * to the combined (correctness + lint) score, so slow implementations degrade
 * the full score proportionally.
 *
 * The perf test does not verify output correctness; the correctness container
 * already handles that. Perf only measures whether the process completes within
 * acceptable time bounds. A crashed or timed-out process scores 0 (it failed to
 * run at all, not just slowly).
 *
 * Scoring uses linear interpolation between two thresholds:
 * - At or below `fastMs`: score = 1.0 (no penalty)
 * - At or above `slowMs`: score = 0.0 (maximum penalty)
 * - Between: linear decay
 */
import {
  type ContainerResult,
  runInContainer,
} from '../container.ts';

/**
 * Container result bundled with its wall-clock duration
 */
export type TimedContainerResult = ContainerResult & {
  /**
   * Wall-clock milliseconds from start of runInContainer call to resolution
   */
  readonly durationMs: number;
};

/**
 * Configuration for a performance test within a code-gen probe.
 * Probes supply the test input and timing thresholds.
 */
export type PerfTestConfig = {
  /**
   * Stdin data for the performance test (larger/heavier than the correctness test)
   */
  readonly input: string;
  /**
   * Wall-clock duration (ms) at or below which the perf test incurs no penalty.
   * Should account for container startup variance (~150-400ms observed).
   */
  readonly fastMs: number;
  /**
   * Wall-clock duration (ms) at or above which the perf test incurs maximum penalty.
   * Should be set above the slowest acceptable implementation.
   */
  readonly slowMs: number;
};

/**
 * Options for {@link runInContainerTimed}.
 *
 * @example
 * ```ts
 * const options: RunInContainerTimedOptions = {
 *   source: 'console.log("hi");',
 *   input: '',
 *   signal: undefined,
 * };
 * ```
 */
type RunInContainerTimedOptions = {
  /**
   * TypeScript source to execute
   */
  readonly source: string;
  /**
   * stdin data
   */
  readonly input: string;
  /**
   * Abort signal
   */
  readonly signal?: AbortSignal;
};

/**
 * Runs a container and records wall-clock duration alongside the result.
 *
 * @param source - TypeScript source to execute
 *
 * @param input - stdin data
 *
 * @param signal - abort signal
 *
 * @returns container result with durationMs attached
 *
 * @example
 * ```ts
 * const timedResult = await runInContainerTimed({ source, input: stdinData, signal });
 * console.log(`Took ${timedResult.durationMs}ms`);
 * ```
 */
export async function runInContainerTimed({
  source,
  input,
  signal,
}: RunInContainerTimedOptions,): Promise<TimedContainerResult> {
  /**
   * Wall-clock origin for the duration measurement returned alongside the container result.
   */
  const start = Date.now();
  /**
   * Container result; merged below with `durationMs` so callers receive both in one object.
   */
  const result = await runInContainer({
    source,
    stdinData: input,
    ...((signal !== undefined) ? { signal, } : {}),
  },);
  return {
    ...result,
    durationMs: Date.now()
      - start,
  };
}

/**
 * Options for {@link computePerfScore} and {@link buildPerfDiagnostic}.
 *
 * @example
 * ```ts
 * const options: PerfScoreOptions = {
 *   perfResult: timedResult,
 *   config: { input, fastMs: 3000, slowMs: 10000 },
 * };
 * ```
 */
type PerfScoreOptions = {
  /**
   * Timed container result from the perf test
   */
  readonly perfResult: TimedContainerResult;
  /**
   * Timing thresholds
   */
  readonly config: PerfTestConfig;
};

/**
 * Converts a timed container result into a 0-1 perf score.
 * Only checks that the process completed successfully (exit 0, no timeout).
 * Output correctness is the responsibility of the correctness container.
 *
 * @param perfResult - timed container result from the perf test
 *
 * @param config - timing thresholds
 *
 * @returns perf score between 0 (crashed/slow) and 1 (fast)
 *
 * @example
 * ```ts
 * // Fast enough: score 1.0
 * computePerfScore({ perfResult, config: { fastMs: 3000, slowMs: 10000 } }); // durationMs=2000 -> 1.0
 * // Between thresholds: linear decay
 * computePerfScore({ perfResult, config: { fastMs: 3000, slowMs: 10000 } }); // durationMs=6500 -> 0.5
 * ```
 */
export function computePerfScore({
  perfResult,
  config,
}: PerfScoreOptions,): number {
  if (perfResult.timedOut
    || (perfResult.exitCode
      !== 0))
    return 0;
  if (perfResult.durationMs
    <= config
    .fastMs)
    return 1;
  if (perfResult.durationMs
    >= config
    .slowMs)
    return 0;
  return 1 - ((perfResult.durationMs
    - config
    .fastMs) / (config.slowMs
      - config
      .fastMs));
}

/**
 * Builds a perf diagnostics section for the fix prompt.
 *
 * @param perfResult - timed container result
 *
 * @param config - timing thresholds
 *
 * @returns diagnostic text, or empty string if perf was acceptable
 *
 * @example
 * ```ts
 * const diag = buildPerfDiagnostic({ perfResult, config: { input: largeInput, fastMs: 3000, slowMs: 10000 } });
 * if (diag !== '') console.log(diag);
 * ```
 */
export function buildPerfDiagnostic({
  perfResult,
  config,
}: PerfScoreOptions,): string {
  /**
   * Perf score for the current run; the diagnostic is suppressed when the run already hit the fast threshold.
   */
  const score = computePerfScore({
    perfResult,
    config,
  },);
  if (score >= 1)
    return '';
  return [
    '=== performance issue ===',
    `Your implementation took ${
      String(perfResult.durationMs,)
    }ms on the performance test (target: under ${String(config.fastMs,)}ms).`,
    'Optimize for throughput on large inputs.',
  ]
    .join('\n',);
}
