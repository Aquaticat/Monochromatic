/**
 * Second-pass fix loop: sends the model its own code + diagnostics and scores the fix.
 */
import { createProbeClient, } from './runner-client.ts';
import { streamCompletion, } from './runner-stream.ts';
import type { ChatMessage, } from './runner-types.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { Probe, ScoreContext, } from './probes.ts';

/**
 * Runs the second pass: sends the model its code + linter/type-checker diagnostics
 * and scores whether it can fix the issues in one follow-up turn.
 * @param probe - probe that produced the first-pass response
 * @param config - runner configuration
 * @param firstResponse - raw model output from the first pass
 * @param context - score context for artifact organization
 * @returns second-pass score, or undefined if skipped
 */
export async function runSecondPass(
  probe: Probe,
  config: RunnerConfig,
  firstResponse: string,
  context: ScoreContext,
): Promise<number | undefined> {
  if (probe.buildFixPrompt === undefined) return undefined;

  const fixPrompt = await probe.buildFixPrompt(firstResponse, context);
  if (fixPrompt === undefined) {
    console.log(`  [${probe.name}] pass2: skipped (no diagnostics to fix)`);
    return undefined;
  }

  console.log(`  [${probe.name}] pass2: sending fix prompt...`);

  try {
    const client = createProbeClient(config);
    const messages: ChatMessage[] = [
      { role: 'system', content: probe.system, },
      { role: 'user', content: probe.prompt, },
      { role: 'assistant', content: firstResponse, },
      { role: 'user', content: fixPrompt, },
    ];
    const { text, } = await streamCompletion(client, messages, config, `${probe.name}:fix`);
    return probe.score(text, context);
  } catch (error) {
    console.log(`  [${probe.name}] pass2: failed: ${String(error)}`);
    return undefined;
  }
}
