/**
 * Second-pass fix execution and artifact enrichment for the probe runner.
 *
 * Runs the fix pass, logs results, enriches artifacts, and handles partial
 * completions when the fix stream is aborted mid-response.
 */
import {
  l,
  tagged,
} from './log.ts';
import {
  enrichArtifact,
  extractPartialCompletion,
  NO_PARTIAL,
} from './runner-probe-artifacts.ts';
import {
  FIX_PASS_SKIPPED,
  runSecondPass,
} from './runner-second-pass.ts';

import type {
  Probe,
  ScoreContext,
} from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { ChatClient, } from './runner-types.ts';

/**
 * Options for {@link runAndEnrichFixPass}.
 *
 * @example
 * ```ts
 * const opts: RunAndEnrichFixPassOptions = {
 *   probe: cssMixinProbe,
 *   config: runnerConfig,
 *   client: openAi,
 *   timestamp: '2025-09-21T11:13:00Z',
 *   signal: abortSignal,
 *   lastCompletionText: '```ts\n//\n```',
 *   meanScore: 0.8,
 * };
 * ```
 */
type RunAndEnrichFixPassOptions = {
  /**
   * Canary probe that produced the first-pass response
   */
  readonly probe: Probe;
  /**
   * Runner configuration
   */
  readonly config: RunnerConfig;
  /**
   * OpenAI SDK client (reused from first pass; narrow readonly view)
   */
  readonly client: ChatClient;
  /**
   * Authoritative server timestamp for artifact naming
   */
  readonly timestamp: string;
  /**
   * Abort signal for cancellation
   */
  readonly signal: AbortSignal;
  /**
   * Raw text from the last consistency run
   */
  readonly lastCompletionText: string;
  /**
   * Mean score across consistency runs, used for delta logging
   */
  readonly meanScore: number;
};

/**
 * Runs the second-pass fix turn, enriches artifacts, and handles errors.
 *
 * On success, logs the fix score and delta, enriches the fix-pass artifact,
 * and returns the score. On failure, logs the error, saves partial completion
 * data if available, and returns {@link FIX_PASS_SKIPPED}.
 *
 * @param probe - canary probe that produced the first-pass response
 *
 * @param config - runner configuration
 *
 * @param client - OpenAI SDK client (reused from first pass)
 *
 * @param timestamp - authoritative server timestamp for artifact naming
 *
 * @param signal - abort signal for cancellation
 *
 * @param lastCompletionText - raw text from the last consistency run
 *
 * @param meanScore - mean score across consistency runs, used for delta logging
 *
 * @returns fix pass score, or {@link FIX_PASS_SKIPPED} if the fix was skipped or failed
 *
 * @example
 * ```ts
 * const score = await runAndEnrichFixPass({ probe, config, client, timestamp, signal, lastCompletionText: text, meanScore: 0.8 });
 * ```
 */
export async function runAndEnrichFixPass({
  probe,
  config,
  client,
  timestamp,
  signal,
  lastCompletionText,
  meanScore,
}: RunAndEnrichFixPassOptions,): Promise<number | typeof FIX_PASS_SKIPPED> {
  /**
   * Probe-specific logger for fix pass messages.
   */
  const rl = tagged({
    tag: probe.name,
    l: tagged({
      tag: config.label,
      l,
    },),
  },);
  try {
    /**
     * Context object handed to the second-pass scoring run; identifies pass kind and carries cancellation.
     */
    const fixContext: ScoreContext = {
      label: config.label,
      pass: 'fix',
      timestamp,
      signal,
    };
    /**
     * Result of the fix pass; null when the probe declined to run a second pass.
     */
    const pass2Result = await runSecondPass({
      probe,
      config,
      client,
      lastCompletionText,
      fixContext,
    },);

    if (pass2Result === FIX_PASS_SKIPPED)
      return FIX_PASS_SKIPPED;

    /**
     * Score change between mean first-pass score and fix-pass score; positive means improvement.
     */
    const delta = pass2Result.score
      - meanScore;
    /**
     * Signed delta string used for log output: `+0.20`, `-0.10`.
     */
    const deltaStr = delta >= 0 ? `+${delta.toFixed(2,)}` : delta.toFixed(2,);
    rl.info(
      `pass2: score=${
        pass2Result
          .score
          .toFixed(2,)
      } delta=${deltaStr}`,
    );

    // Enrich the fix-pass artifact with completion data, score, and diagnostic prompt.
    await enrichArtifact({
      probe,
      config,
      timestamp,
      pass: 'fix',
      completion: pass2Result.completion,
      score: pass2Result.score,
      options: {
        fixPrompt: pass2Result.fixPrompt,
      },
    },);

    return pass2Result.score;
  }
  catch (fixError) {
    /**
     * Human-readable error string for log output; unwraps Error to its message field.
     */
    const errorMessage = fixError instanceof Error
      ? fixError.message
      : String(fixError,);
    rl.error(`pass2 failed: ${errorMessage}`,);

    /**
     * Partial response text recovered when the stream was aborted mid-completion.
     */
    const partialFix = extractPartialCompletion(fixError,);
    if (partialFix !== NO_PARTIAL) {
      try {
        await enrichArtifact({
          probe,
          config,
          timestamp,
          pass: 'fix',
          completion: partialFix,
          score: 0,
          options: {
            partial: true,
            error: errorMessage,
          },
        },);
      }
      catch (saveError) {
        rl.error(
          `failed to save partial fix artifact: ${String(saveError,)}`,
        );
      }
    }

    return FIX_PASS_SKIPPED;
  }
}
