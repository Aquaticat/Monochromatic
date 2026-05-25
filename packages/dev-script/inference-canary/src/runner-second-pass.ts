/**
 * Second-pass fix loop: sends the model its own code + diagnostics and scores the fix.
 */
import {
  l,
  tagged,
} from './log.ts';
import { streamCompletion, } from './runner-stream.ts';

// oxlint-disable-next-line import/no-named-as-default -- OpenAI SDK canonical usage is `import OpenAI from 'openai'`
import type OpenAI from 'openai';
import type {
  Probe,
  ScoreContext,
} from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type {
  ChatMessage,
  CompletionResult,
} from './runner-types.ts';

/** Result from a second-pass fix attempt, bundling score with completion data and the prompt used */
export type SecondPassResult = {
  /** Score after the fix pass */
  readonly score: number;
  /** Full completion result from the fix turn */
  readonly completion: CompletionResult;
  /** Diagnostic prompt sent to the model for this fix attempt */
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
  /** Probe that produced the first-pass response */
  readonly probe: Probe;
  /** Runner configuration */
  readonly config: RunnerConfig;
  /** OpenAI SDK client (reused from first pass) */
  readonly client: OpenAI;
  /** Raw model output from the first pass */
  readonly lastCompletionText: string;
  /** Score context for artifact organization (includes abort signal) */
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
 * @returns second-pass result with score, completion data, and fix prompt; or undefined if skipped
 *
 * @example
 * ```ts
 * const result = await runSecondPass({ probe, config, client, lastCompletionText, fixContext });
 * if (result !== undefined) result.score; // fix pass score
 * ```
 */
export async function runSecondPass({
  probe,
  config,
  client,
  lastCompletionText,
  fixContext,
}: RunSecondPassOptions,): Promise<SecondPassResult | undefined> {
  if (probe.buildFixPrompt
    === undefined)
    return undefined;

  /** Probe-specific logger for pass2 messages. */
  const rl = tagged({
    tag: probe.name,
    l: tagged({
      tag: config.label,
      l,
    },),
  },);
  /** Diagnostic-only follow-up prompt; undefined when the probe decides no fix turn is warranted. */
  const fixPrompt = await probe.buildFixPrompt(
    lastCompletionText,
    fixContext,
  );
  if (fixPrompt === undefined) {
    rl.info('pass2: skipped (no diagnostics to fix)',);
    return undefined;
  }

  rl.info('pass2: sending fix prompt...',);

  /** Conversation echoed back to the model: system, original prompt, first response, then the fix instruction. */
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
  /** Streamed completion for the fix turn; carries the model's revised source plus usage and timing data. */
  const completion = await streamCompletion({
    client,
    messages,
    config,
    probeName: `${probe.name}:fix`,
    signal: fixContext.signal,
  },);
  /** Fix-pass score; combined with the completion data in the returned `SecondPassResult`. */
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
