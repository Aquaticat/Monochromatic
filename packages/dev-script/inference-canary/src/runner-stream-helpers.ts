/**
 * Streaming helper types and utilities for the OpenAI SDK streaming wrapper.
 *
 * Contains the {@link PartialCompletionError} class for abort handling,
 * and helper functions for timing display, usage parsing, and result assembly.
 */
import { MS_PER_SECOND, } from '@monochromatic-dev/module-numeric-const';

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

//region PartialCompletionError: thrown on stream abort, carries whatever data was collected before cancellation

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
 * Options for {@link logTiming}.
 *
 * @example
 * ```ts
 * const opts: LogTimingOptions = {
 *   probeName: 'sudoku-solver',
 *   timing: streamTiming,
 * };
 * ```
 */
type LogTimingOptions = {
  /** Probe/call label for log prefix */
  readonly probeName: string;
  /** Collected timing data */
  readonly timing: StreamTiming;
};

/**
 * Logs a timing summary for a streamed response.
 * Only ttfc and total are shown; chunk count and inter-chunk gaps are too granular
 * for routine human inspection and are preserved in the StreamTiming object for callers
 * that need them.
 *
 * @param probeName - probe/call label for log prefix
 *
 * @param timing - collected timing data
 *
 * @example
 * ```ts
 * logTiming({ probeName: 'sudoku-solver', timing });
 * // logs: [timing:sudoku-solver] ttfc=150ms total=3.2s
 * ```
 */
export function logTiming({
  probeName,
  timing,
}: LogTimingOptions,): void {
  /** Timing-specific logger tagged with the call label. */
  const rl = tagged({
    tag: `timing:${probeName}`,
    l,
  },);
  /** Total stream duration rendered as seconds with one decimal, suitable for terse human log lines. */
  const totalSeconds = (timing.totalMs
    / MS_PER_SECOND).toFixed(1,);
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
  if ((raw === null) || (raw === undefined))
    return undefined;
  return {
    promptTokens: raw.prompt_tokens,
    completionTokens: raw.completion_tokens,
    reasoningTokens: raw.completion_tokens_details
      ?.reasoning_tokens,
    totalTokens: raw.total_tokens,
  };
}

/**
 * Options for {@link buildResult}.
 *
 * @example
 * ```ts
 * const opts: BuildResultOptions = {
 *   chunks: ['hello', ' world'],
 *   reasoningChunks: ['thinking...'],
 *   timing: streamTiming,
 *   usage: chunk.usage,
 *   finishReason: 'stop',
 * };
 * ```
 */
type BuildResultOptions = {
  /** Collected content deltas */
  readonly chunks: readonly string[];
  /** Collected reasoning deltas */
  readonly reasoningChunks: readonly string[];
  /** Computed timing breakdown */
  readonly timing: StreamTiming;
  /** Raw usage from the API (may be nullish) */
  readonly usage: OpenAI.CompletionUsage | null | undefined;
  /** Stop reason from the final chunk */
  readonly finishReason: string | undefined;
};

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
 *
 * @example
 * ```ts
 * const result = buildResult({ chunks, reasoningChunks, timing, usage, finishReason: 'stop' });
 * result.text; // joined content chunks
 * ```
 */
export function buildResult({
  chunks,
  reasoningChunks,
  timing,
  usage,
  finishReason,
}: BuildResultOptions,): CompletionResult {
  return {
    text: chunks.join('',),
    reasoning: reasoningChunks.join('',),
    timing,
    usage: parseUsage(usage,),
    finishReason,
  };
}
