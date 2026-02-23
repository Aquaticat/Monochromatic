/**
 * OpenAI SDK streaming wrapper: streams chat completions and collects
 * per-chunk timing data to diagnose time-to-first-token vs generation latency.
 *
 * Based on research from:
 * - "Calibrating LLMs with Sample Consistency" (AAAI 2025)
 * - "Confidence Improves Self-Consistency in LLMs" (arxiv 2502.06233)
 */
import OpenAI from 'openai';

import type { RunnerConfig, } from './runner-config.ts';
import type { ChatMessage, StreamTiming, } from './runner-types.ts';

/**
 * Logs a timing summary for a streamed response.
 * @param label - probe/call label for log prefix
 * @param timing - collected timing data
 */
function logTiming(label: string, timing: StreamTiming): void {
  const maxGap = timing.interChunkMs.length > 0 ? Math.max(...timing.interChunkMs) : 0;
  console.log(
    `    [timing:${label}] ttfc=${String(timing.timeToFirstChunkMs)}ms`
    + ` chunks=${String(timing.chunkCount)}`
    + ` maxGap=${String(maxGap)}ms`
    + ` total=${String(timing.totalMs)}ms`,
  );
}

/**
 * Streams a chat completion and collects the full text + per-chunk timing.
 * @param client - OpenAI SDK client
 * @param messages - conversation messages
 * @param config - runner configuration
 * @param label - label for timing logs
 * @returns collected text and timing breakdown
 */
export async function streamCompletion(
  client: OpenAI,
  messages: readonly ChatMessage[],
  config: RunnerConfig,
  label: string,
): Promise<{ text: string; timing: StreamTiming }> {
  const startMs = Date.now();

  const extraBody: Record<string, unknown> = {
    ...(config.reasoning ? { reasoning: { enabled: true, }, } : {}),
    // 'high' is OpenRouter's server-side default, so skip sending it to reduce payload noise
    ...(config.verbosity !== 'high' ? { verbosity: config.verbosity, } : {}),
  };

  const stream = await client.chat.completions.create({
    model: config.model,
    max_tokens: config.maxTokens,
    messages: [...messages],
    stream: true,
    ...extraBody,
  });

  // Mutable accumulators are required here: for-await streams are inherently
  // imperative and each chunk must be processed as it arrives.
  const chunks: string[] = [];
  const interChunkMs: number[] = [];
  // firstChunkMs, lastChunkMs, chunkCount are let because they are all
  // reassigned inside the for-await loop; prefer-const does not apply since
  // they ARE reassigned, but the mutation pattern requires let not const.
  let firstChunkMs = 0;
  let lastChunkMs = startMs;
  let chunkCount = 0;

  for await (const chunk of stream) {
    const now = Date.now();
    chunkCount += 1;
    if (chunkCount === 1) {
      firstChunkMs = now - startMs;
    } else {
      interChunkMs.push(now - lastChunkMs);
    }
    lastChunkMs = now;
    const delta = chunk.choices[0]?.delta?.content;
    if (delta !== undefined && delta !== null) chunks.push(delta);
  }

  const totalMs = Date.now() - startMs;
  const timing: StreamTiming = { timeToFirstChunkMs: firstChunkMs, interChunkMs, totalMs, chunkCount, };
  logTiming(label, timing);
  return { text: chunks.join(''), timing, };
}
