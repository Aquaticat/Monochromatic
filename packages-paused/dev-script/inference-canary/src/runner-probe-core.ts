/**
 * Core probe execution logic: consistency runs, second-pass fix loop, and artifact enrichment.
 *
 * Consistency runs are sequential to avoid rate limits. After all runs complete,
 * the second-pass fix loop gives the model a chance to improve its output.
 * On failure, persists whatever partial data was collected before re-throwing.
 */
import {
  l,
  tagged,
} from './log.ts';
import { mean, } from './math.ts';
import {
  createProbeClient,
  executeProbe,
} from './runner-client.ts';
import {
  enrichArtifact,
  extractPartialCompletion,
  saveFailureArtifacts,
} from './runner-probe-artifacts.ts';
import { runAndEnrichFixPass, } from './runner-probe-fix.ts';
import { FIX_PASS_SKIPPED, } from './runner-second-pass.ts';

import type {
  Probe,
  ScoreContext,
} from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type {
  CompletionResult,
  ProbeResult,
} from './runner-types.ts';

/**
 * Options for {@link runProbeCore}.
 *
 * @example
 * ```ts
 * const opts: RunProbeCoreOptions = {
 *   probe: sudokuSolverProbe,
 *   config: runnerConfig,
 *   timestamp: '2025-09-21T11:13:00Z',
 *   signal: abortSignal,
 * };
 * ```
 */
type RunProbeCoreOptions = {
  /**
   * Canary probe to execute
   */
  readonly probe: Probe;
  /**
   * Runner configuration
   */
  readonly config: RunnerConfig;
  /**
   * Authoritative server timestamp for artifact naming
   */
  readonly timestamp: string;
  /**
   * Abort signal from the timeout controller; cancels HTTP streams and containers
   */
  readonly signal: AbortSignal;
};

/**
 * Core probe logic: runs consistency checks then the second-pass fix loop.
 * After scoring, writes enriched metadata to each artifact directory.
 *
 * On failure, persists whatever partial data was collected (completed runs,
 * partial stream responses) before re-throwing.
 *
 * @param probe - canary probe to execute
 *
 * @param config - runner configuration
 *
 * @param timestamp - authoritative server timestamp for artifact naming
 *
 * @param signal - abort signal from the timeout controller; cancels HTTP streams and containers
 *
 * @returns scored result with consistency information
 *
 * @example
 * ```ts
 * const result = await runProbeCore({ probe, config, timestamp, signal });
 * result.meanScore; // average across consistency runs
 * ```
 */
export async function runProbeCore({
  probe,
  config,
  timestamp,
  signal,
}: RunProbeCoreOptions,): Promise<ProbeResult> {
  /**
   * Probe-specific logger for run progress and error messages.
   */
  const rl = tagged({
    tag: probe.name,
    l: tagged({
      tag: config.label,
      l,
    },),
  },);
  /**
   * Shared OpenAI client used for every consistency run; reuse keeps connection pooling intact.
   */
  const client = createProbeClient(config,);
  // Consistency runs must be sequential (rate limits) and each run's score is
  // logged immediately. scores uses push because each run appends in the loop;
  // functional reduce/map would require pre-running all turns before collecting.
  /**
   * Per-run scores collected in iteration order; later reduced to mean and consistency check.
   */
  const scores: number[] = [];
  /**
   * Per-run completions collected in iteration order; parallel to {@link scores} by index, so the last entry is the most recent run and the entry at the min-score index is the worst run.
   */
  const completions: CompletionResult[] = [];
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- multi-statement state machine: flag for failure handler to avoid double-writing artifact */
  /**
   * Whether the initial-pass artifact has been written; failure handler avoids double-writing.
   */
  let enrichedInitial = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  try {
    for (const runIndex of Array.from({ length: config.consistencyRuns, },)
      .keys()) {
      /**
       * Raw model completion for this consistency run; pushed to `completions`, then scored.
       */
      // oxlint-disable-next-line no-await-in-loop -- sequential to avoid rate limits
      const completion = await executeProbe({
        probe,
        config,
        client,
        signal,
      },);
      completions.push(completion,);
      /**
       * Context handed to the probe's scorer; identifies this initial-pass run for artifact naming.
       */
      const scoreContext: ScoreContext = {
        label: config.label,
        pass: 'initial',
        timestamp,
        signal,
      };
      /**
       * Numeric score from this run; appended to `scores` parallel to its completion.
       */
      // oxlint-disable-next-line no-await-in-loop -- score may involve container execution
      const runScore = await probe.score(
        completion.text,
        scoreContext,
      );
      scores.push(runScore,);
      rl.info(
        `run ${String(runIndex + 1,)}/${String(config.consistencyRuns,)}: score=${
          runScore.toFixed(2,)
        }`,
      );
    }

    /**
     * Completion of the most recent consistency run, absent when zero runs completed.
     */
    const lastCompletion = completions.at(-1,);
    /**
     * Score of the most recent run; written into the initial-pass artifact metadata.
     */
    const lastScore = scores.at(-1,)
      ?? 0;

    // Enrich the initial-pass artifact with the last consistency run's data.
    if (lastCompletion !== undefined) {
      await enrichArtifact({
        probe,
        config,
        timestamp,
        pass: 'initial',
        completion: lastCompletion,
        score: lastScore,
      },);
      enrichedInitial = true;
    }

    /**
     * Arithmetic mean of run scores; the headline metric returned to the caller.
     */
    const meanScore = mean(scores,);
    /**
     * True when every consistency run produced the same score; useful for flakiness reporting.
     */
    const consistent = scores.every(function sameScore(score,): boolean {
      return score === scores[0];
    },);

    // Fix pass uses the worst-scoring consistency run's output so the model
    // gets a chance to fix code that actually has problems. Using the last run
    // would skip the fix when the last run happened to be perfect but earlier
    // runs were not.
    /**
     * Completion of the lowest-scoring run; the fix pass repairs the model's worst output, not a coincidentally-perfect last run.
     */
    const worstCompletion = completions[scores.indexOf(Math.min(...scores,),)];
    /**
     * Completion fed into the fix pass: prefer worst-scoring run; fall back to the last run if scoring failed.
     */
    const fixCompletion = worstCompletion ?? lastCompletion;
    /**
     * Score after the second-pass fix; {@link FIX_PASS_SKIPPED} when the probe declines a fix pass.
     */
    const pass2Score = await runAndEnrichFixPass({
      probe,
      config,
      client,
      timestamp,
      signal,
      lastCompletionText: fixCompletion?.text
        ?? '',
      meanScore,
    },);

    /**
     * Timing of the last consistency run, present once at least one run completed.
     */
    const lastTiming = lastCompletion?.timing;
    /**
     * Token usage of the last consistency run, present when the API reported it.
     */
    const lastUsage = lastCompletion?.usage;
    return {
      name: probe.name,
      category: probe.category,
      scores,
      meanScore,
      consistent,
      ...((pass2Score !== FIX_PASS_SKIPPED)
        ? {
          pass2Score,
          fixDelta: pass2Score - meanScore,
        }
        : {}),
      ...((lastTiming !== undefined) ? { timing: lastTiming, } : {}),
      ...((lastUsage !== undefined) ? { usage: lastUsage, } : {}),
    };
  }
  catch (error) {
    /**
     * Partial stream payload recovered from a {@link PartialCompletionError}, or {@link NO_PARTIAL}.
     */
    const partialCompletion = extractPartialCompletion(error,);
    /**
     * Completion of the most recent run before failure, absent when none completed.
     */
    const lastCompletion = completions.at(-1,);
    /**
     * Score of the most recent run before failure.
     */
    const lastScore = scores.at(-1,)
      ?? 0;
    // Save whatever data we collected before the failure. Uses a separate try/catch
    // so a write failure doesn't mask the original error.
    try {
      await saveFailureArtifacts({
        probe,
        config,
        timestamp,
        error,
        ...((lastCompletion !== undefined) ? { lastCompletion, } : {}),
        partialCompletion,
        lastScore,
        enrichedInitial,
      },);
    }
    catch (saveError) {
      rl.error(
        `failed to save failure artifacts: ${String(saveError,)}`,
      );
    }
    throw error;
  }
}
