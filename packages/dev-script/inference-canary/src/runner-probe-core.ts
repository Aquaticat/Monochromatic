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
 */
export async function runProbeCore(
  probe: Probe,
  config: RunnerConfig,
  timestamp: string,
  signal: AbortSignal,
): Promise<ProbeResult>
{
  /** Probe-specific logger for run progress and error messages. */
  const rl = tagged({
    tag: probe.name,
    l: tagged({
      tag: config.label,
      l,
    },),
  },);
  const client = createProbeClient(config,);
  // Consistency runs must be sequential (rate limits) and each run's score is
  // logged immediately. scores uses push because each run appends in the loop;
  // functional reduce/map would require pre-running all turns before collecting.
  const scores: number[] = [];
  // lastCompletion is let because the for-of loop reassigns it each run, and the
  // final value is needed after the loop for the second-pass fix turn and artifact enrichment.
  let lastCompletion: CompletionResult | undefined = undefined;
  // lastScore tracks the score of the most recent consistency run for artifact enrichment.
  let lastScore = 0;
  // enrichedInitial tracks whether the initial-pass artifact was successfully enriched,
  // so the failure handler knows whether it needs to write the artifact.
  let enrichedInitial = false;

  try {
    for (const runIndex of Array.from({ length: config.consistencyRuns, },).keys()) {
      // oxlint-disable-next-line no-await-in-loop -- sequential to avoid rate limits
      lastCompletion = await executeProbe(
        probe,
        config,
        client,
        signal,
      );
      const scoreContext: ScoreContext = {
        label: config.label,
        pass: 'initial',
        timestamp,
        signal,
      };
      // oxlint-disable-next-line no-await-in-loop -- score may involve container execution
      const runScore = await probe.score(
        lastCompletion.text,
        scoreContext,
      );
      scores.push(runScore,);
      lastScore = runScore;
      rl.info(
        `run ${String(runIndex + 1,)}/${
          String(config.consistencyRuns,)
        }: score=${runScore.toFixed(2,)}`,
      );
    }

    // Enrich the initial-pass artifact with the last consistency run's data.
    if (lastCompletion !== undefined) {
      await enrichArtifact(
        probe,
        config,
        timestamp,
        'initial',
        lastCompletion,
        lastScore,
      );
      enrichedInitial = true;
    }

    const meanScore = mean(scores,);
    const consistent = scores.every(function sameScore(score,): boolean {
      return score === scores[0];
    },);

    // Fix pass has its own error handling: a failed fix should not discard
    // valid initial-pass results. Partial fix data is saved before continuing.
    const pass2Score = await runAndEnrichFixPass(
      probe,
      config,
      client,
      timestamp,
      signal,
      lastCompletion?.text ?? '',
      meanScore,
    );

    return {
      name: probe.name,
      category: probe.category,
      scores,
      meanScore,
      consistent,
      pass2Score,
      fixDelta: pass2Score !== undefined ? pass2Score - meanScore : undefined,
      timing: lastCompletion?.timing,
      usage: lastCompletion?.usage,
    };
  }
  catch (error) {
    const partialCompletion = extractPartialCompletion(error,);
    // Save whatever data we collected before the failure. Uses a separate try/catch
    // so a write failure doesn't mask the original error.
    try {
      await saveFailureArtifacts(
        probe,
        config,
        timestamp,
        error,
        lastCompletion,
        partialCompletion,
        lastScore,
        enrichedInitial,
      );
    }
    catch (saveError) {
      rl.error(
        `failed to save failure artifacts: ${String(saveError,)}`,
      );
    }
    throw error;
  }
}
