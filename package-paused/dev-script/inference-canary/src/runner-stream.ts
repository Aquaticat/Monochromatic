/**
 * OpenAI SDK streaming wrapper: streams chat completions and collects
 * per-chunk timing data, reasoning traces, token usage, and finish reason.
 *
 * Based on research from:
 * - "Calibrating LLMs with Sample Consistency" (AAAI 2025)
 * - "Confidence Improves Self-Consistency in LLMs" (arxiv 2502.06233)
 */
import type OpenAI from 'openai';
import {
  buildResult,
  buildStreamUsage,
  logTiming,
  PartialCompletionError,
} from './runner-stream-helpers.ts';

import type { RunnerConfig, } from './runner-config.ts';
import type {
  ChatClient,
  ChatMessage,
  CompletionResult,
  StreamTiming,
} from './runner-types.ts';

export { PartialCompletionError, } from './runner-stream-helpers.ts';

/**
 * Options for {@link streamCompletion}.
 *
 * @example
 * ```ts
 * const opts: StreamCompletionOptions = {
 *   client: openAi,
 *   messages: [{ role: 'user', content: 'hi' }],
 *   config: runnerConfig,
 *   probeName: 'sudoku-solver',
 *   signal: abortSignal,
 * };
 * ```
 */
type StreamCompletionOptions = {
  /**
   * OpenAI SDK client (narrow readonly view)
   */
  readonly client: ChatClient;
  /**
   * Conversation messages
   */
  readonly messages: readonly ChatMessage[];
  /**
   * Runner configuration
   */
  readonly config: RunnerConfig;
  /**
   * Label for timing logs
   */
  readonly probeName: string;
  /**
   * Abort signal; cancels the HTTP stream when aborted, or absent to disable
   */
  readonly signal?: AbortSignal;
};

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
 * @param probeName - label for timing logs
 *
 * @param signal - optional abort signal; cancels the HTTP stream when aborted
 *
 * @returns full completion result with all captured data
 *
 * @throws when the stream is aborted, carrying partial data as PartialCompletionError
 *
 * @example
 * ```ts
 * const result = await streamCompletion({ client, messages, config, probeName: 'sudoku-solver', signal });
 * result.text; // full model response
 * ```
 */
export async function streamCompletion({
  client,
  messages,
  config,
  probeName,
  signal,
}: StreamCompletionOptions,): Promise<CompletionResult> {
  // Fast-path: if the signal is already aborted, skip the network request entirely.
  if ((signal !== undefined) && signal
    .aborted) {
    throw new DOMException(
      'Probe timeout signal already aborted before stream start',
      'AbortError',
    );
  }

  // Track whether the signal fired during the stream. tsgo narrows `signal.aborted` to
  // `false | undefined` after the for-await loop (infers no abort if stream completed
  // without throwing), so we use a listener-set flag that tsgo cannot narrow away.
  /**
   * Flag flipped by the abort listener so post-stream code can distinguish
   * graceful completion from cancellation.
   *
   * Declared as `let` because the listener callback writes to it from outside
   * the for-await scope; tsgo cannot prove the flag stays `false` either way.
   */
  let streamWasAborted = false;
  /**
   * Sets the abort flag when the signal fires during streaming.
   */
  function onAbort(): void {
    streamWasAborted = true;
  }
  signal?.addEventListener(
    'abort',
    onAbort,
    { once: true, },
  );

  /**
   * Wall-clock anchor for the stream; every timing metric below is computed relative to it.
   */
  const startMs = Date.now();

  /**
   * Optional SDK fields (reasoning, verbosity) injected only when set; keeps the request body minimal.
   */
  const extraBody: Record<string, unknown> = {
    ...(config.reasoning ? { reasoning: { enabled: true, }, } : {}),
    // 'high' is OpenRouter's server-side default, so skip sending it to reduce payload noise
    ...(config.verbosity
      !== 'high' ? { verbosity: config.verbosity, } : {}),
  };

  /**
   * Async iterator over chat completion chunks; awaited per-chunk in the for-await below.
   */
  const stream = await client.chat
    .completions
    .create(
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
  /**
   * Text chunks from `delta.content`; joined into the final completion text.
   */
  const chunks: string[] = [];
  /**
   * Reasoning trace fragments (text/summary) extracted from OpenRouter's `reasoning_details`.
   */
  const reasoningChunks: string[] = [];
  /**
   * Per-chunk inter-arrival times in ms; used to compute streaming-rate stats.
   */
  const interChunkMs: number[] = [];
  /**
   * Every non-null `finish_reason` seen, in arrival order; the last entry is what the API used to terminate.
   */
  const finishReasons: string[] = [];
  /**
   * Every usage payload seen, in arrival order; the last entry is the final cumulative usage.
   */
  const usages: OpenAI.CompletionUsage[] = [];
  // firstChunkMs, lastChunkMs, chunkCount are let because they are all reassigned inside the for-await loop.
  /**
   * Latency (ms) from request start to the first chunk; set on the first iteration.
   */
  let firstChunkMs = 0;
  /**
   * Wall-clock timestamp of the most recent chunk; seed value compares against `startMs`.
   */
  let lastChunkMs = startMs;
  /**
   * Number of stream chunks observed so far; drives first-chunk detection and metrics.
   */
  let chunkCount = 0;

  for await (const chunk of stream) {
    /**
     * Wall-clock timestamp captured once per chunk so first-chunk and inter-chunk arithmetic stay consistent.
     */
    const now = Date.now();
    chunkCount += 1;
    if (chunkCount === 1)
      firstChunkMs = now - startMs;
    else
      interChunkMs.push(now - lastChunkMs,);
    lastChunkMs = now;

    /**
     * First (and typically only) choice from this chunk; rest of the array is unused.
     */
    const [
      choice,
    ] = chunk.choices;
    if (choice !== undefined) {
      /**
       * Delta payload from the choice; carries incremental `content`, reasoning, and finish state.
       */
      const {
        delta,
      } = choice;
      if ((delta.content
        !== undefined) && (delta.content
          !== null))
        chunks.push(delta.content,);

      // OpenRouter surfaces reasoning via `reasoning_details` on the delta: an array of
      // objects with `type` ("reasoning.text" | "reasoning.summary" | "reasoning.encrypted")
      // and a type-specific text field (`text`, `summary`, or `data`).
      // The field is not typed in OpenAI SDK v6.22, so access it dynamically.
      /**
       * OpenRouter's untyped reasoning array on the delta; mined for `reasoning.text`/`reasoning.summary` items.
       */
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- OpenRouter extends the SDK delta with reasoning_details
      const reasoningDetails = (delta as Record<string, unknown>).reasoning_details;
      if (Array.isArray(reasoningDetails,)) {
        for (const detail of reasoningDetails as readonly Record<string, unknown>[]) {
          if ((detail.type
            === 'reasoning.text')
            && ((typeof detail.text) === 'string'))
          {
            reasoningChunks.push(detail.text,);
          }
          else if ((detail.type
            === 'reasoning.summary')
            && ((typeof detail.summary) === 'string'))
          {
            reasoningChunks.push(detail.summary,);
          }
        }
      }

      if (choice.finish_reason
        !== null)
        finishReasons.push(choice.finish_reason,);
    }

    // Usage arrives on the final chunk when stream_options.include_usage is set.
    if ((chunk.usage
      !== undefined) && (chunk.usage
        !== null))
      usages.push(chunk.usage,);
  }

  signal?.removeEventListener(
    'abort',
    onAbort,
  );

  /**
   * End-to-end stream duration (ms) from request start to last chunk.
   */
  const totalMs = Date.now()
    - startMs;
  /**
   * Bundled timing snapshot logged once and stored on the final result for the report.
   */
  const timing: StreamTiming = {
    timeToFirstChunkMs: firstChunkMs,
    interChunkMs,
    totalMs,
    chunkCount,
  };
  logTiming({
    probeName,
    timing,
  },);

  /**
   * Final usage payload, when the API reported one on the closing chunk.
   */
  const lastUsage = usages.at(-1,);
  /**
   * Final stop reason, when the API reported one.
   */
  const lastFinishReason = finishReasons.at(-1,);
  /**
   * Reasoning-token count from the final usage payload; absent when the provider omits it.
   */
  const reasoningTokens = lastUsage
    ?.completion_tokens_details
    ?.reasoning_tokens;
  /**
   * Normalized usage built from the final payload; omitted from the result when absent.
   */
  const usage = lastUsage === undefined
    ? undefined
    : buildStreamUsage({
      promptTokens: lastUsage.prompt_tokens,
      completionTokens: lastUsage.completion_tokens,
      totalTokens: lastUsage.total_tokens,
      ...(reasoningTokens !== undefined ? { reasoningTokens, } : {}),
    });
  /**
   * Assembled completion (text + reasoning + usage + finish reason) returned on success or in PartialCompletionError.
   */
  const result = buildResult({
    chunks,
    reasoningChunks,
    timing,
    ...((usage !== undefined) ? { usage, } : {}),
    ...((lastFinishReason !== undefined) ? { finishReason: lastFinishReason, } : {}),
  },);

  // The SDK ends the stream gracefully on abort (returns partial data) rather than throwing.
  // Throw PartialCompletionError so callers can distinguish abort from success while still
  // having access to whatever chunks arrived before cancellation.
  if (streamWasAborted) {
    throw new PartialCompletionError(
      'Stream aborted by probe timeout signal',
      result,
    );
  }

  return result;
}
