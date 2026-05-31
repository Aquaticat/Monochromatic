/**
 * Failure handling for the canary runner.
 *
 * Writes a failure artifact recording that the run was attempted and returns
 * a zero-score report so the caller can continue with other models.
 */
import { writeFailureArtifact, } from './linter-artifacts.ts';
import {
  l,
  tagged,
} from './log.ts';

import type { RunnerConfig, } from './runner-config.ts';
import type {
  CanaryReport,
  ISOTimestamp,
} from './runner-types.ts';

/**
 * Options for {@link handleRunFailure}.
 *
 * @example
 * ```ts
 * const opts: HandleRunFailureOptions = {
 *   error: new Error('boom'),
 *   mergedConfig: runnerConfig,
 *   timestamp: '2025-09-21T11:13:00Z',
 * };
 * ```
 */
type HandleRunFailureOptions = {
  /**
   * Caught error from the runner
   */
  readonly error: unknown;
  /**
   * Merged runner configuration
   */
  readonly mergedConfig: RunnerConfig;
  /**
   * Authoritative server timestamp for artifact naming
   */
  readonly timestamp: ISOTimestamp;
};

/**
 * Handles a whole-model failure during canary execution.
 *
 * Logs the error, writes a failure artifact to disk so the artifact directory
 * records that this run was attempted, and returns a zero-score report.
 *
 * @param error - caught error from the runner
 *
 * @param mergedConfig - merged runner configuration
 *
 * @param timestamp - authoritative server timestamp for artifact naming
 *
 * @returns zero-score canary report with the error message
 *
 * @example
 * ```ts
 * const report = await handleRunFailure({ error, mergedConfig, timestamp });
 * report.failed; // true
 * ```
 */
export async function handleRunFailure({
  error,
  mergedConfig,
  timestamp,
}: HandleRunFailureOptions,): Promise<CanaryReport> {
  /**
   * Model-specific logger for failure messages.
   */
  const rl = tagged({
    tag: mergedConfig.label,
    l,
  },);
  /**
   * Caught value normalised to a string; preserves `error.message` when available, otherwise coerces via `String(error)`.
   */
  const message = error instanceof Error ? error.message : String(error,);
  rl.error(`FAILED: ${message}`,);

  // Write a failure artifact so the artifact directory records that this run
  // was attempted, even though no probes completed successfully.
  try {
    await writeFailureArtifact({
      model: mergedConfig.model,
      label: mergedConfig.label,
      timestamp,
      failed: true,
      error: message,
      config: {
        verbosity: mergedConfig.verbosity,
        reasoning: mergedConfig.reasoning,
        maxTokens: mergedConfig.maxTokens,
        consistencyRuns: mergedConfig.consistencyRuns,
      },
    },);
  }
  catch (writeError) {
    rl.error(
      `failed to write failure artifact: ${String(writeError,)}`,
    );
  }

  return {
    model: mergedConfig.model,
    label: mergedConfig.label,
    timestamp,
    results: [],
    overallScore: 0,
    categoryScores: {},
    failed: true,
    error: message,
  };
}
