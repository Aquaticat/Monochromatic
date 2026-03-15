/**
 * Second-pass fix loop: sends the model its own code + diagnostics and scores the fix.
 */
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
 * Runs the second pass: sends the model its code + linter/type-checker diagnostics
 * and scores whether it can fix the issues in one follow-up turn.
 *
 * @param probe - probe that produced the first-pass response
 *
 * @param config - runner configuration
 *
 * @param client - OpenAI SDK client (reused from first pass)
 *
 * @param firstResponse - raw model output from the first pass
 *
 * @param context - score context for artifact organization (includes abort signal)
 *
 * @returns second-pass result with score, completion data, and fix prompt; or undefined if skipped
 */
export async function runSecondPass(
  probe: Probe,
  config: RunnerConfig,
  client: OpenAI,
  firstResponse: string,
  context: ScoreContext,
): Promise<SecondPassResult | undefined> {
  if (probe.buildFixPrompt === undefined)
    return undefined;

  const fixPrompt = await probe.buildFixPrompt(firstResponse, context,);
  if (fixPrompt === undefined) {
    console.log(
      `  [${config.label}:${probe.name}] pass2: skipped (no diagnostics to fix)`,
    );
    return undefined;
  }

  console.log(`  [${config.label}:${probe.name}] pass2: sending fix prompt...`,);

  const messages: ChatMessage[] = [
    { role: 'system', content: probe.system, },
    { role: 'user', content: probe.prompt, },
    { role: 'assistant', content: firstResponse, },
    { role: 'user', content: fixPrompt, },
  ];
  const completion = await streamCompletion(client, messages, config, `${probe.name}:fix`,
    context.signal,);
  const score = await probe.score(completion.text, context,);
  return { score, completion, fixPrompt, };
}
