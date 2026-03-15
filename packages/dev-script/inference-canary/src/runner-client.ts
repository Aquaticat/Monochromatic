/**
 * OpenAI client creation and single-turn probe execution.
 */
// oxlint-disable-next-line import/no-named-as-default -- OpenAI SDK canonical usage is `import OpenAI from 'openai'`
import OpenAI from 'openai';

import { streamCompletion, } from './runner-stream.ts';

import type { Probe, } from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type {
  ChatMessage,
  CompletionResult,
} from './runner-types.ts';

/**
 * Creates a new OpenAI client configured for this runner.
 * Each client is local-scoped so it can be garbage collected quickly.
 *
 * @param config - runner configuration
 *
 * @returns configured OpenAI SDK client
 */
export function createProbeClient(config: RunnerConfig,): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey ?? '',
    baseURL: config.baseURL ?? 'https://openrouter.ai/api/v1',
  },);
}

/**
 * Sends a single probe to the API and returns the full completion result
 * including text, reasoning traces, timing, usage, and finish reason.
 *
 * @param probe - canary probe to execute
 *
 * @param config - runner configuration
 *
 * @param client - OpenAI SDK client (reused across consistency runs and fix pass)
 *
 * @param signal - optional abort signal; cancels the HTTP stream when aborted
 *
 * @returns full completion result from the model
 */
export function executeProbe(probe: Probe, config: RunnerConfig, client: OpenAI,
  signal?: AbortSignal,): Promise<CompletionResult>
{
  const messages: ChatMessage[] = [
    { role: 'system', content: probe.system, },
    { role: 'user', content: probe.prompt, },
  ];
  return streamCompletion(client, messages, config, probe.name, signal,);
}
