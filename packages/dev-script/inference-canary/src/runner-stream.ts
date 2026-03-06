/**
 * OpenAI SDK streaming wrapper: streams chat completions and collects
 * per-chunk timing data, reasoning traces, token usage, and finish reason.
 *
 * Based on research from:
 * - "Calibrating LLMs with Sample Consistency" (AAAI 2025)
 * - "Confidence Improves Self-Consistency in LLMs" (arxiv 2502.06233)
 */
// eslint-disable-next-line import/no-named-as-default -- OpenAI SDK canonical usage is `import OpenAI from 'openai'`
import type OpenAI from 'openai';
import type { RunnerConfig, } from './runner-config.ts';
import type { ChatMessage, CompletionResult, StreamTiming, StreamUsage, } from './runner-types.ts';

/** Milliseconds per second for human-readable timing display */
const MS_PER_SECOND = 1000;

/**
 * Logs a timing summary for a streamed response.
 * Only ttfc and total are shown -- chunk count and inter-chunk gaps are too granular
 * for routine human inspection and are preserved in the StreamTiming object for callers
 * that need them.
 * @param label - probe/call label for log prefix
 * @param timing - collected timing data
 */
function logTiming(label: string, timing: StreamTiming): void {
  const totalSeconds = (timing.totalMs / MS_PER_SECOND).toFixed(1);
  console.log(
    `    [timing:${label}] ttfc=${String(timing.timeToFirstChunkMs)}ms`
    + ` total=${totalSeconds}s`,
  );
}

/**
 * Extracts a {@link StreamUsage} from the SDK's CompletionUsage shape.
 * Returns undefined when the input is nullish (API did not include usage).
 * @param raw - raw usage object from the OpenAI SDK
 * @returns normalized usage, or undefined
 */
function parseUsage(raw: OpenAI.CompletionUsage | null | undefined): StreamUsage | undefined {
  if (raw === null || raw === undefined) return undefined;
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    reasoningTokens: raw.completion_tokens_details?.reasoning_tokens,
    totalTokens: raw.total_tokens,
  };
}

/**
 * Streams a chat completion and collects text, reasoning traces, per-chunk timing,
 * token usage, and finish reason.
 * @param client - OpenAI SDK client
 * @param messages - conversation messages
 * @param config - runner configuration
 * @param label - label for timing logs
 * @param signal - optional abort signal; cancels the HTTP stream when aborted
 * @returns full completion result with all captured data
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
    throw new DOMException('Probe timeout signal already aborted before stream start', 'AbortError');
  }

  // Track whether the signal fired during the stream. tsgo narrows `signal.aborted` to
  // `false | undefined` after the for-await loop (infers no abort if stream completed
  // without throwing), so we use a listener-set flag that tsgo cannot narrow away.
  // let: assigned true by the abort listener callback below
  let streamWasAborted = false;
  const onAbort = (): void => { streamWasAborted = true; };
  signal?.addEventListener('abort', onAbort, { once: true, });

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
    stream_options: { include_usage: true, },
    ...extraBody,
  }, { signal, });

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
    if (chunkCount === 1) {
      firstChunkMs = now - startMs;
    } else {
      interChunkMs.push(now - lastChunkMs);
    }
    lastChunkMs = now;

    const choice = chunk.choices[0];
    if (choice !== undefined) {
      const delta = choice.delta;
      if (delta.content !== undefined && delta.content !== null) chunks.push(delta.content);

      // OpenRouter surfaces reasoning traces as `reasoning_content` on the delta.
      // The field is not typed in OpenAI SDK v6.22, so access it dynamically.
      const reasoningContent = (delta as Record<string, unknown>)['reasoning_content'];
      if (typeof reasoningContent === 'string') reasoningChunks.push(reasoningContent);

      if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
        lastFinishReason = choice.finish_reason;
      }
    }

    // Usage arrives on the final chunk when stream_options.include_usage is set.
    if (chunk.usage !== undefined && chunk.usage !== null) {
      lastUsage = chunk.usage;
    }
  }

  signal?.removeEventListener('abort', onAbort);

  const totalMs = Date.now() - startMs;
  const timing: StreamTiming = { timeToFirstChunkMs: firstChunkMs, interChunkMs, totalMs, chunkCount, };
  logTiming(label, timing);

  // The SDK ends the stream gracefully on abort (returns partial data) rather than throwing.
  // Throw here so callers treat a truncated response as an error, not valid output.
  if (streamWasAborted) {
    throw new DOMException('Stream aborted by probe timeout signal', 'AbortError');
  }

  return {
    text: chunks.join(''),
    reasoning: reasoningChunks.join(''),
    timing,
    usage: parseUsage(lastUsage),
    finishReason: lastFinishReason,
  };
}
