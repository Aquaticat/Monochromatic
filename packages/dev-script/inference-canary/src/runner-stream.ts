/**
 * OpenAI SDK streaming wrapper: streams chat completions and collects
 * per-chunk timing data, reasoning traces, token usage, and finish reason.
 *
 * Based on research from:
 * - "Calibrating LLMs with Sample Consistency" (AAAI 2025)
 * - "Confidence Improves Self-Consistency in LLMs" (arxiv 2502.06233)
 */
// oxlint-disable-next-line import/no-named-as-default -- OpenAI SDK canonical usage is `import OpenAI from 'openai'`
import type OpenAI from 'openai';
import {
  buildResult,
  logTiming,
  PartialCompletionError,
} from './runner-stream-helpers.ts';

import type { RunnerConfig, } from './runner-config.ts';
import type {
  ChatMessage,
  CompletionResult,
  StreamTiming,
} from './runner-types.ts';

export { PartialCompletionError, } from './runner-stream-helpers.ts';

/**
 * Streams a chat completion and collects text, reasoning traces, per-chunk timing,
 * token usage, and finish reason.
 *
 * On abort, throws {@link PartialCompletionError} carrying whatever data was
 * collected before cancellation so callers can persist partial responses.
 *
 * @param client - OpenAI SDK client
 *
 * @param messages - conversation messages
 *
 * @param config - runner configuration
 *
 * @param label - label for timing logs
 *
 * @param signal - optional abort signal; cancels the HTTP stream when aborted
 *
 * @returns full completion result with all captured data
 *
 * @throws when the stream is aborted, carrying partial data as PartialCompletionError
 *
 * @example
 * ```ts
 * const result = await streamCompletion(client, messages, config, 'sudoku-solver', signal);
 * result.text; // full model response
 * ```
 */
export async function streamCompletion(
  client: OpenAI,
  messages: readonly ChatMessage[],
  config: RunnerConfig,
  label: string,
  signal?: AbortSignal,
): Promise<CompletionResult> {
  // Fast-path: if the signal is already aborted, skip the network request entirely.
  if (signal !== undefined && signal.aborted) {
    throw new DOMException(
      'Probe timeout signal already aborted before stream start',
      'AbortError',
    );
  }

  // Track whether the signal fired during the stream. tsgo narrows `signal.aborted` to
  // `false | undefined` after the for-await loop (infers no abort if stream completed
  // without throwing), so we use a listener-set flag that tsgo cannot narrow away.
  // let: assigned true by the abort listener callback below
  let streamWasAborted = false;
  /** Sets the abort flag when the signal fires during streaming. */
  function onAbort(): void {
    streamWasAborted = true;
  }
  signal?.addEventListener(
    'abort',
    onAbort,
    { once: true, },
  );

  const startMs = Date.now();

  const extraBody: Record<string, unknown> = {
    ...(config.reasoning ? { reasoning: { enabled: true, }, } : {}),
    // 'high' is OpenRouter's server-side default, so skip sending it to reduce payload noise
    ...(config.verbosity !== 'high' ? { verbosity: config.verbosity, } : {}),
  };

  const stream = await client.chat.completions.create(
    {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: [...messages,],
      stream: true,
      stream_options: { include_usage: true, },
      ...extraBody,
    },
    { signal, },
  );

  // Mutable accumulators are required here: for-await streams are inherently
  // imperative and each chunk must be processed as it arrives.
  const chunks: string[] = [];
  const reasoningChunks: string[] = [];
  const interChunkMs: number[] = [];
  // firstChunkMs, lastChunkMs, chunkCount, lastFinishReason, lastUsage are let
  // because they are all reassigned inside the for-await loop.
  let firstChunkMs = 0;
  let lastChunkMs = startMs;
  let chunkCount = 0;
  let lastFinishReason: string | undefined = undefined;
  let lastUsage: OpenAI.CompletionUsage | null | undefined = undefined;

  for await (const chunk of stream) {
    const now = Date.now();
    chunkCount += 1;
    if (chunkCount === 1)
      firstChunkMs = now - startMs;
    else
      interChunkMs.push(now - lastChunkMs,);
    lastChunkMs = now;

    const [choice,] = chunk.choices;
    if (choice !== undefined) {
      const { delta, } = choice;
      if (delta.content !== undefined && delta.content !== null)
        chunks.push(delta.content,);

      // OpenRouter surfaces reasoning via `reasoning_details` on the delta -- an array of
      // objects with `type` ("reasoning.text" | "reasoning.summary" | "reasoning.encrypted")
      // and a type-specific text field (`text`, `summary`, or `data`).
      // The field is not typed in OpenAI SDK v6.22, so access it dynamically.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- OpenRouter extends the SDK delta with reasoning_details
      const reasoningDetails = (delta as Record<string, unknown>)['reasoning_details'];
      if (Array.isArray(reasoningDetails,)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- OpenRouter reasoning_details items have known shape
        for (const detail of reasoningDetails as readonly Record<string, unknown>[]) {
          if (detail['type'] === 'reasoning.text' && typeof detail['text'] === 'string')
            reasoningChunks.push(detail['text'],);
          else if (detail['type'] === 'reasoning.summary'
            && typeof detail['summary'] === 'string')
          {
            reasoningChunks.push(detail['summary'],);
          }
        }
      }

      if (choice.finish_reason !== null)
        lastFinishReason = choice.finish_reason;
    }

    // Usage arrives on the final chunk when stream_options.include_usage is set.
    if (chunk.usage !== undefined && chunk.usage !== null)
      lastUsage = chunk.usage;
  }

  signal?.removeEventListener(
    'abort',
    onAbort,
  );

  const totalMs = Date.now() - startMs;
  const timing: StreamTiming = {
    timeToFirstChunkMs: firstChunkMs,
    interChunkMs,
    totalMs,
    chunkCount,
  };
  logTiming(
    label,
    timing,
  );

  const result = buildResult(
    chunks,
    reasoningChunks,
    timing,
    lastUsage,
    lastFinishReason,
  );

  // The SDK ends the stream gracefully on abort (returns partial data) rather than throwing.
  // Throw PartialCompletionError so callers can distinguish abort from success while still
  // having access to whatever chunks arrived before cancellation.
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- mutated by addEventListener callback; oxlint can't track cross-function mutation
  if (streamWasAborted) {
    throw new PartialCompletionError(
      'Stream aborted by probe timeout signal',
      result,
    );
  }

  return result;
}
