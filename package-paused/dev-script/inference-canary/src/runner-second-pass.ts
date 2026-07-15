/**
 * Second-pass fix loop: sends the model its own code + diagnostics and scores the fix.
 */
import {
  l,
  tagged,
} from './log.ts';
import { streamCompletion, } from './runner-stream.ts';

import type {
  Probe,
  ScoreContext,
} from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type {
  ChatClient,
  ChatMessage,
  CompletionResult,
} from './runner-types.ts';

/**
 * Sentinel returned when the second pass is skipped (no `buildFixPrompt`, or it
 * produced no fix prompt). A unique symbol keeps the "skipped" outcome out of the
 * result's value space without a banned nullish union.
 */
export const FIX_PASS_SKIPPED: unique symbol = Symbol('fix-pass-skipped',);

/**
 * Result from a second-pass fix attempt, bundling score with completion data and the prompt used
 */
export type SecondPassResult = {
  /**
   * Score after the fix pass
   */
  readonly score: number;
  /**
   * Full completion result from the fix turn
   */
  readonly completion: CompletionResult;
  /**
   * Diagnostic prompt sent to the model for this fix attempt
   */
  readonly fixPrompt: string;
};

/**
 * Options for {@link runSecondPass}.
 *
 * @example
 * ```ts
 * const opts: RunSecondPassOptions = {
 *   probe: cssMixinProbe,
 *   config: runnerConfig,
 *   client: openAi,
 *   lastCompletionText: 'first response text',
 *   fixContext: scoreContext,
 * };
 * ```
 */
type RunSecondPassOptions = {
  /**
   * Probe that produced the first-pass response
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
   * Raw model output from the first pass
   */
  readonly lastCompletionText: string;
  /**
   * Score context for artifact organization (includes abort signal)
   */
  readonly fixContext: ScoreContext;
};

/**
 * Runs the second pass: sends the model its code + linter/type-checker diagnostics
 * and scores whether it can fix the issues in one follow-up turn.
 *
 * @param probe - probe that produced the first-pass response
 *
 * @param config - runner configuration
 *
 * @param client - OpenAI SDK client (reused from first pass)
 *
 * @param lastCompletionText - raw model output from the first pass
 *
 * @param fixContext - score context for artifact organization (includes abort signal)
 *
 * @returns second-pass result with score, completion data, and fix prompt; or {@link FIX_PASS_SKIPPED} if skipped
 *
 * @example
 * ```ts
 * const result = await runSecondPass({ probe, config, client, lastCompletionText, fixContext });
 * if (result !== FIX_PASS_SKIPPED) result.score; // fix pass score
 * ```
 */
export async function runSecondPass({
  probe,
  config,
  client,
  lastCompletionText,
  fixContext,
}: RunSecondPassOptions,): Promise<SecondPassResult | typeof FIX_PASS_SKIPPED> {
  if (probe.buildFixPrompt
    === undefined)
    return FIX_PASS_SKIPPED;

  /**
   * Probe-specific logger for pass2 messages.
   */
  const rl = tagged({
    tag: probe.name,
    l: tagged({
      tag: config.label,
      l,
    },),
  },);
  /**
   * Diagnostic-only follow-up prompt; empty string when the probe decides no fix turn is warranted.
   */
  const fixPrompt = await probe.buildFixPrompt(
    lastCompletionText,
    fixContext,
  );
  if (fixPrompt === '') {
    rl.info('pass2: skipped (no diagnostics to fix)',);
    return FIX_PASS_SKIPPED;
  }

  rl.info('pass2: sending fix prompt...',);

  /**
   * Conversation echoed back to the model: system, original prompt, first response, then the fix instruction.
   */
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: probe.system,
    },
    {
      role: 'user',
      content: probe.prompt,
    },
    {
      role: 'assistant',
      content: lastCompletionText,
    },
    {
      role: 'user',
      content: fixPrompt,
    },
  ];
  /**
   * Abort signal from the fix context; spread into the stream call only when present.
   */
  const {
    signal,
  } = fixContext;
  /**
   * Streamed completion for the fix turn; carries the model's revised source plus usage and timing data.
   */
  const completion = await streamCompletion({
    client,
    messages,
    config,
    probeName: `${probe.name}:fix`,
    ...(signal !== undefined ? { signal, } : {}),
  },);
  /**
   * Fix-pass score; combined with the completion data in the returned `SecondPassResult`.
   */
  const score = await probe.score(
    completion.text,
    fixContext,
  );
  return {
    score,
    completion,
    fixPrompt,
  };
}
