/**
 * Second-pass fix loop: sends the model its own code + diagnostics and scores the fix.
 */
import { streamCompletion, } from './runner-stream.ts';

import type OpenAI from 'openai';
import type { ChatMessage, } from './runner-types.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { Probe, ScoreContext, } from './probes.ts';

/**
 * Runs the second pass: sends the model its code + linter/type-checker diagnostics
 * and scores whether it can fix the issues in one follow-up turn.
 * @param probe - probe that produced the first-pass response
 * @param config - runner configuration
 * @param client - OpenAI SDK client (reused from first pass)
 * @param firstResponse - raw model output from the first pass
 * @param context - score context for artifact organization (includes abort signal)
 * @returns second-pass score, or undefined if skipped
 */
export async function runSecondPass(
  probe: Probe,
  config: RunnerConfig,
  client: OpenAI,
  firstResponse: string,
  context: ScoreContext,
): Promise<number | undefined> {
  if (probe.buildFixPrompt === undefined) return undefined;

  const fixPrompt = await probe.buildFixPrompt(firstResponse, context);
  if (fixPrompt === undefined) {
    console.log(`  [${config.model}:${probe.name}] pass2: skipped (no diagnostics to fix)`);
    return undefined;
  }

  console.log(`  [${config.model}:${probe.name}] pass2: sending fix prompt...`);

  const messages: ChatMessage[] = [
    { role: 'system', content: probe.system, },
    { role: 'user', content: probe.prompt, },
    { role: 'assistant', content: firstResponse, },
    { role: 'user', content: fixPrompt, },
  ];
  const { text, } = await streamCompletion(client, messages, config, `${probe.name}:fix`, context.signal);
  return probe.score(text, context);
}
