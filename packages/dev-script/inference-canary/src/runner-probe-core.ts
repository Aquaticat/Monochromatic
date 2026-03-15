/**
 * Core probe execution logic: consistency runs, second-pass fix loop, and artifact enrichment.
 *
 * Consistency runs are sequential to avoid rate limits. After all runs complete,
 * the second-pass fix loop gives the model a chance to improve its output.
 * On failure, persists whatever partial data was collected before re-throwing.
 */
import { mean, } from './math.ts';
import { createProbeClient, executeProbe, } from './runner-client.ts';
import { enrichArtifact, extractPartialCompletion, saveFailureArtifacts, } from './runner-probe-artifacts.ts';
import { runSecondPass, } from './runner-second-pass.ts';

import type { CompletionResult, ProbeResult, } from './runner-types.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { Probe, ScoreContext, } from './probes.ts';

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
export async function runProbeCore(probe: Probe, config: RunnerConfig, timestamp: string, signal: AbortSignal): Promise<ProbeResult> {
  const client = createProbeClient(config);
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
    for (const runIndex of Array.from({ length: config.consistencyRuns, }).keys()) {
      // oxlint-disable-next-line no-await-in-loop -- sequential to avoid rate limits
      lastCompletion = await executeProbe(probe, config, client, signal);
      const scoreContext: ScoreContext = { label: config.label, pass: 'initial', timestamp, signal, };
      // oxlint-disable-next-line no-await-in-loop -- score may involve container execution
      const runScore = await probe.score(lastCompletion.text, scoreContext);
      scores.push(runScore);
      lastScore = runScore;
      console.log(`  [${config.label}:${probe.name}] run ${String(runIndex + 1)}/${String(config.consistencyRuns)}: score=${runScore.toFixed(2)}`);
    }

    // Enrich the initial-pass artifact with the last consistency run's data.
    if (lastCompletion !== undefined) {
      await enrichArtifact(probe, config, timestamp, 'initial', lastCompletion, lastScore);
      enrichedInitial = true;
    }

    const meanScore = mean(scores);
    const consistent = scores.every(function sameScore(score): boolean { return score === scores[0]; });

    // Fix pass has its own error handling: a failed fix should not discard
    // valid initial-pass results. Partial fix data is saved before continuing.
    // pass2Score is let because it starts undefined and is conditionally assigned
    // based on the fix pass result or left undefined if the fix pass is skipped/fails.
    let pass2Score: number | undefined = undefined;
    try {
      const fixContext: ScoreContext = { label: config.label, pass: 'fix', timestamp, signal, };
      const pass2Result = await runSecondPass(probe, config, client, lastCompletion?.text ?? '', fixContext);

      if (pass2Result !== undefined) {
        pass2Score = pass2Result.score;
        const delta = pass2Result.score - meanScore;
        const deltaStr = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
        console.log(`  [${config.label}:${probe.name}] pass2: score=${pass2Result.score.toFixed(2)} delta=${deltaStr}`);

        // Enrich the fix-pass artifact with completion data, score, and diagnostic prompt.
        await enrichArtifact(probe, config, timestamp, 'fix', pass2Result.completion, pass2Result.score, {
          fixPrompt: pass2Result.fixPrompt,
        });
      }
    } catch (fixError) {
      const errorMessage = fixError instanceof Error ? fixError.message : String(fixError);
      console.error(`  [${config.label}:${probe.name}] pass2 failed: ${errorMessage}`);

      // Save partial fix data if the stream was aborted mid-response.
      const partialFix = extractPartialCompletion(fixError);
      if (partialFix !== undefined) {
        try {
          await enrichArtifact(probe, config, timestamp, 'fix', partialFix, 0, {
            partial: true,
            error: errorMessage,
          });
        } catch (saveError) {
          console.error(`  [${config.label}:${probe.name}] failed to save partial fix artifact:`, saveError);
        }
      }
    }

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
  } catch (error) {
    const partialCompletion = extractPartialCompletion(error);
    // Save whatever data we collected before the failure. Uses a separate try/catch
    // so a write failure doesn't mask the original error.
    try {
      await saveFailureArtifacts(
        probe, config, timestamp, error,
        lastCompletion, partialCompletion, lastScore, enrichedInitial,
      );
    } catch (saveError) {
      console.error(`  [${config.label}:${probe.name}] failed to save failure artifacts:`, saveError);
    }
    throw error;
  }
}
