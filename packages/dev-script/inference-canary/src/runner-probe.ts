/**
 * Per-probe execution: consistency runs, timeout enforcement, and artifact enrichment.
 *
 * Consistency runs are sequential to avoid rate limits. A 5-minute timeout covers
 * all turns (all consistency runs + the second pass fix turn).
 */
import { mean, } from './math.ts';
import { createProbeClient, executeProbe, } from './runner-client.ts';
import { runSecondPass, } from './runner-second-pass.ts';
import { PartialCompletionError, } from './runner-stream.ts';
import { writeEnrichedArtifact, type EnrichedArtifactMeta, } from './linter-artifacts.ts';

import type { CompletionResult, ConfigSnapshot, ProbeResult, } from './runner-types.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { Probe, ScoreContext, } from './probes.ts';

/** Minutes before a probe is considered timed out */
const PROBE_TIMEOUT_MINUTES = 5;

/** Seconds per minute for timeout computation */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second for timeout computation */
const MS_PER_SECOND = 1_000;

/** 5 minutes per probe (all consistency runs + fix pass) -- slower inference is unusable */
const PROBE_TIMEOUT_MS = PROBE_TIMEOUT_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Builds a {@link ConfigSnapshot} from the runner configuration.
 *
 * @param config - full runner configuration
 *
 * @returns snapshot of the fields relevant for reproducibility
 */
function snapshotConfig(config: RunnerConfig): ConfigSnapshot {
  return {
    verbosity: config.verbosity,
    reasoning: config.reasoning,
    maxTokens: config.maxTokens,
    consistencyRuns: config.consistencyRuns,
  };
}

/**
 * Writes an enriched artifact for a single probe execution (initial or fix pass).
 *
 * @param probe - probe that produced the response
 *
 * @param config - runner configuration
 *
 * @param timestamp - authoritative server timestamp
 *
 * @param pass - which pass produced the response
 *
 * @param completion - full completion result from the API
 *
 * @param score - computed score for this response
 *
 * @param options - optional fields for fix prompt, partial flag, and error message
 *
 * @returns resolves after the artifact is written
 */
async function enrichArtifact(
  probe: Probe,
  config: RunnerConfig,
  timestamp: string,
  pass: 'initial' | 'fix',
  completion: CompletionResult,
  score: number,
  options?: { fixPrompt?: string; partial?: boolean; error?: string; },
): Promise<void> {
  const enriched: EnrichedArtifactMeta = {
    model: config.model,
    label: config.label,
    probe: probe.name,
    pass,
    timestamp,
    score,
    reasoning: completion.reasoning,
    timing: completion.timing,
    usage: completion.usage,
    finishReason: completion.finishReason,
    config: snapshotConfig(config),
    ...(options?.fixPrompt !== undefined ? { fixPrompt: options.fixPrompt, } : {}),
    ...(options?.partial === true ? { partial: true, } : {}),
    ...(options?.error !== undefined ? { error: options.error, } : {}),
  };
  await writeEnrichedArtifact(enriched, completion.text);
}

/**
 * Extracts a {@link CompletionResult} from an error if it is a
 * {@link PartialCompletionError}, otherwise returns undefined.
 *
 * @param error - caught error value
 *
 * @returns partial completion result, or undefined for non-partial errors
 */
function extractPartialCompletion(error: unknown): CompletionResult | undefined {
  if (error instanceof PartialCompletionError) return error.partialResult;
  return undefined;
}

/**
 * Saves whatever data was collected before a probe failure.
 *
 * For completed consistency runs, the last run's completion is already enriched
 * during the normal flow. This function handles the partial/failed case: it writes
 * the partial completion (if any) with `partial: true` and the error message.
 *
 * @param probe - probe being executed
 *
 * @param config - runner configuration
 *
 * @param timestamp - authoritative server timestamp
 *
 * @param error - the caught error
 *
 * @param lastCompletion - completion from the last successful consistency run (if any)
 *
 * @param partialCompletion - partial completion extracted from a PartialCompletionError
 *
 * @param lastScore - score from the last successful consistency run
 *
 * @param enrichedInitial - whether the initial-pass artifact was already enriched
 */
async function saveFailureArtifacts(
  probe: Probe,
  config: RunnerConfig,
  timestamp: string,
  error: unknown,
  lastCompletion: CompletionResult | undefined,
  partialCompletion: CompletionResult | undefined,
  lastScore: number,
  enrichedInitial: boolean,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // If we have a partial completion from an aborted stream, save it.
  // This captures the mid-stream response that would otherwise be lost.
  if (partialCompletion !== undefined) {
    await enrichArtifact(probe, config, timestamp, 'initial', partialCompletion, 0, {
      partial: true,
      error: errorMessage,
    });
    return;
  }

  // If we completed at least one run but haven't enriched the artifact yet, do it now.
  if (lastCompletion !== undefined && !enrichedInitial) {
    await enrichArtifact(probe, config, timestamp, 'initial', lastCompletion, lastScore, {
      error: errorMessage,
    });
  }
}

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
async function runProbeCore(probe: Probe, config: RunnerConfig, timestamp: string, signal: AbortSignal): Promise<ProbeResult> {
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

/**
 * Runs a single probe with a 5-minute timeout covering all turns (consistency + fix).
 *
 * Uses `AbortController` so the timeout doesn't just cancel the promise -- it also
 * cancels in-flight HTTP streams (OpenAI SDK respects `signal`) and kills any live
 * container processes (`execBun` listens for abort). Without cancellation, orphaned
 * coroutines keep the Bun event loop alive well past the timeout.
 *
 * On timeout the probe resolves with score=0 and `timedOut: true` rather than throwing,
 * so partial results from other probes can still be collected and written to history.
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @param timestamp - authoritative server timestamp for artifact naming
 * @returns scored result; on timeout, a zero-score result with `timedOut: true`
 */
// oxlint-disable-next-line require-await -- returns Promise.race directly; async needed for callers expecting Promise<ProbeResult>
export async function runProbe(probe: Probe, config: RunnerConfig, timestamp: string): Promise<ProbeResult> {
  // new Promise required: no standard promisified API exists for time-based resolution,
  // and @monochromatic-dev/module-es is not a dependency of this package.
  // timer.unref() prevents the timer from keeping the process alive after the probe finishes.
  const controller = new AbortController();
  const corePromise = runProbeCore(probe, config, timestamp, controller.signal);
  // Suppress unhandled-rejection warning: after the timeout wins the race,
  // corePromise may still reject (via AbortError) with no observer.
  // oxlint-disable-next-line promise/prefer-await-to-then -- catch handler on a racing promise; await is not viable here
  corePromise.catch(function suppressAbortRejection(): void { /* expected: abort-triggered rejection after timeout */ });
  // Zero-score sentinel returned when the timeout fires; score 0 is recorded in history
  // so the overall model score reflects the failure without discarding other probe results.
  const timedOutResult: ProbeResult = {
    name: probe.name,
    category: probe.category,
    scores: [],
    meanScore: 0,
    consistent: true,
    timedOut: true,
  };
  // timer is let so corePromise's finally handler can clear it before the callback fires,
  // preventing a misleading "timed out" log for probes that complete before the deadline.
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  return Promise.race([
    // oxlint-disable-next-line promise/prefer-await-to-then -- finally on a racing promise; await is not viable here
    corePromise.finally(function clearTimer(): void { if (timer !== undefined) clearTimeout(timer); }),
    // oxlint-disable-next-line promise/avoid-new -- timeout racing requires manual Promise construction
    new Promise<ProbeResult>(function setupTimeout(resolve): void {
      timer = setTimeout(
        function onTimeout(): void {
          controller.abort();
          console.error(`  [${config.label}:${probe.name}] timed out after ${String(PROBE_TIMEOUT_MINUTES)} minutes`);
          resolve(timedOutResult);
        },
        PROBE_TIMEOUT_MS,
      );
      timer.unref();
    }),
  ]);
}
