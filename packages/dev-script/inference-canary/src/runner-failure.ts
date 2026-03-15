/**
 * Failure handling for the canary runner.
 *
 * Writes a failure artifact recording that the run was attempted and returns
 * a zero-score report so the caller can continue with other models.
 */
import { writeFailureArtifact, } from './linter-artifacts.ts';

import type { RunnerConfig, } from './runner-config.ts';
import type {
  CanaryReport,
  ISOTimestamp,
} from './runner-types.ts';

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
 */
export async function handleRunFailure(
  error: unknown,
  mergedConfig: RunnerConfig,
  timestamp: ISOTimestamp,
): Promise<CanaryReport> {
  const message = error instanceof Error ? error.message : String(error,);
  console.error(`  [${mergedConfig.label}] FAILED: ${message}`,);

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
    console.error(`  [${mergedConfig.label}] failed to write failure artifact:`,
      writeError,);
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
