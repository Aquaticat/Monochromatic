/**
 * OpenAI client creation and single-turn probe execution.
 */
import OpenAI from 'openai';

import { streamCompletion, } from './runner-stream.ts';

import type { RunnerConfig, } from './runner-config.ts';
import type { ChatMessage, } from './runner-types.ts';
import type { Probe, } from './probes.ts';

/**
 * Creates a new OpenAI client configured for this runner.
 * Each client is local-scoped so it can be garbage collected quickly.
 * @param config - runner configuration
 * @returns configured OpenAI SDK client
 */
export function createProbeClient(config: RunnerConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey ?? '',
    baseURL: config.baseURL ?? 'https://openrouter.ai/api/v1',
  });
}

/**
 * Sends a single probe to the API and returns the raw text response.
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @param client - OpenAI SDK client (reused across consistency runs and fix pass)
 * @param signal - optional abort signal; cancels the HTTP stream when aborted
 * @returns raw text response from the model
 */
export async function executeProbe(probe: Probe, config: RunnerConfig, client: OpenAI, signal?: AbortSignal): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: probe.system, },
    { role: 'user', content: probe.prompt, },
  ];
  const { text, } = await streamCompletion(client, messages, config, probe.name, signal);
  return text;
}
