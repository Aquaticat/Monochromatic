/**
 * Streaming helper types and utilities for the OpenAI SDK streaming wrapper.
 *
 * Contains the {@link PartialCompletionError} class for abort handling,
 * and helper functions for timing display, usage parsing, and result assembly.
 */
import {
  l,
  tagged,
} from './log.ts';

// oxlint-disable-next-line import/no-named-as-default -- OpenAI SDK canonical usage is `import OpenAI from 'openai'`
import type OpenAI from 'openai';
import type {
  CompletionResult,
  StreamTiming,
  StreamUsage,
} from './runner-types.ts';

/** Milliseconds per second for human-readable timing display */
const MS_PER_SECOND = 1_000;

//region PartialCompletionError -- thrown on stream abort, carries whatever data was collected before cancellation

/**
 * Error thrown when a stream is aborted mid-response.
 * Carries the partial {@link CompletionResult} so callers can persist
 * whatever chunks were received before cancellation.
 *
 * @example
 * ```ts
 * try {
 *   return await streamCompletion(client, messages, config, label, signal);
 * } catch (error) {
 *   if (error instanceof PartialCompletionError) {
 *     console.log('Partial text:', error.partialResult.text);
 *   }
 *   throw error;
 * }
 * ```
 */
export class PartialCompletionError extends Error {
  /** Partial completion data collected before the stream was aborted */
  readonly partialResult: CompletionResult;

  /**
   * @param message - human-readable error description
   *
   * @param partialResult - completion data collected before abort
   */
  constructor(
    message: string,
    partialResult: CompletionResult,
  ) {
    super(message,);
    this.name = 'PartialCompletionError';
    this.partialResult = partialResult;
  }
}

//endregion PartialCompletionError

/**
 * Logs a timing summary for a streamed response.
 * Only ttfc and total are shown -- chunk count and inter-chunk gaps are too granular
 * for routine human inspection and are preserved in the StreamTiming object for callers
 * that need them.
 *
 * @param label - probe/call label for log prefix
 *
 * @param timing - collected timing data
 *
 * @example
 * ```ts
 * logTiming('sudoku-solver', timing);
 * // logs: [timing:sudoku-solver] ttfc=150ms total=3.2s
 * ```
 */
export function logTiming(
  label: string,
  timing: StreamTiming,
): void {
  /** Timing-specific logger tagged with the call label. */
  const rl = tagged({
    tag: `timing:${label}`,
    l,
  },);
  const totalSeconds = (timing.totalMs / MS_PER_SECOND).toFixed(1,);
  rl.info(
    `ttfc=${String(timing.timeToFirstChunkMs,)}ms`
      + ` total=${totalSeconds}s`,
  );
}

/**
 * Extracts a {@link StreamUsage} from the SDK's CompletionUsage shape.
 * Returns undefined when the input is nullish (API did not include usage).
 *
 * @param raw - raw usage object from the OpenAI SDK
 *
 * @returns normalized usage, or undefined
 *
 * @example
 * ```ts
 * const usage = parseUsage(chunk.usage);
 * usage?.totalTokens; // combined prompt + completion tokens
 * ```
 */
export function parseUsage(
  raw: OpenAI.CompletionUsage | null | undefined,
): StreamUsage | undefined {
  if (raw === null || raw === undefined)
    return undefined;
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    reasoningTokens: raw.completion_tokens_details?.reasoning_tokens,
    totalTokens: raw.total_tokens,
  };
}

/**
 * Builds a {@link CompletionResult} from accumulated stream data.
 *
 * @param chunks - collected content deltas
 *
 * @param reasoningChunks - collected reasoning deltas
 *
 * @param timing - computed timing breakdown
 *
 * @param usage - raw usage from the API (may be nullish)
 *
 * @param finishReason - stop reason from the final chunk
 *
 * @returns assembled completion result
 */
export function buildResult(
  chunks: readonly string[],
  reasoningChunks: readonly string[],
  timing: StreamTiming,
  usage: OpenAI.CompletionUsage | null | undefined,
  finishReason: string | undefined,
): CompletionResult {
  return {
    text: chunks.join('',),
    reasoning: reasoningChunks.join('',),
    timing,
    usage: parseUsage(usage,),
    finishReason,
  };
}
