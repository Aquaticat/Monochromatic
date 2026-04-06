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
} from './runner-probe-artifacts.ts';
import { runSecondPass, } from './runner-second-pass.ts';

// oxlint-disable-next-line import/no-named-as-default -- OpenAI SDK canonical usage is `import OpenAI from 'openai'`
import type OpenAI from 'openai';
import type {
  Probe,
  ScoreContext,
} from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';

/**
 * Runs the second-pass fix turn, enriches artifacts, and handles errors.
 *
 * On success, logs the fix score and delta, enriches the fix-pass artifact,
 * and returns the score. On failure, logs the error, saves partial completion
 * data if available, and returns undefined.
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
 * @returns fix pass score, or undefined if the fix was skipped or failed
 *
 * @example
 * ```ts
 * const score = await runAndEnrichFixPass(probe, config, client, timestamp, signal, text, 0.8);
 * ```
 */
export async function runAndEnrichFixPass(
  probe: Probe,
  config: RunnerConfig,
  client: OpenAI,
  timestamp: string,
  signal: AbortSignal,
  lastCompletionText: string,
  meanScore: number,
): Promise<number | undefined> {
  /** Probe-specific logger for fix pass messages. */
  const rl = tagged({
    tag: probe.name,
    l: tagged({
      tag: config.label,
      l,
    },),
  },);
  try {
    const fixContext: ScoreContext = {
      label: config.label,
      pass: 'fix',
      timestamp,
      signal,
    };
    const pass2Result = await runSecondPass(
      probe,
      config,
      client,
      lastCompletionText,
      fixContext,
    );

    if (pass2Result === undefined)
      return undefined;

    const delta = pass2Result.score - meanScore;
    const deltaStr = delta >= 0 ? `+${delta.toFixed(2,)}` : delta.toFixed(2,);
    rl.info(
      `pass2: score=${
        pass2Result
          .score
          .toFixed(2,)
      } delta=${deltaStr}`,
    );

    // Enrich the fix-pass artifact with completion data, score, and diagnostic prompt.
    await enrichArtifact(
      probe,
      config,
      timestamp,
      'fix',
      pass2Result.completion,
      pass2Result.score,
      {
        fixPrompt: pass2Result.fixPrompt,
      },
    );

    return pass2Result.score;
  }
  catch (fixError) {
    const errorMessage = fixError instanceof Error
      ? fixError.message
      : String(fixError,);
    rl.error(`pass2 failed: ${errorMessage}`,);

    // Save partial fix data if the stream was aborted mid-response.
    const partialFix = extractPartialCompletion(fixError,);
    if (partialFix !== undefined) {
      try {
        await enrichArtifact(
          probe,
          config,
          timestamp,
          'fix',
          partialFix,
          0,
          {
            partial: true,
            error: errorMessage,
          },
        );
      }
      catch (saveError) {
        rl.error(
          `failed to save partial fix artifact: ${String(saveError,)}`,
        );
      }
    }

    return undefined;
  }
}
