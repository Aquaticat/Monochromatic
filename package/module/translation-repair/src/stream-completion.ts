import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  type ExtractedCompletion,
  MalformedCompletionError,
  readUsage,
} from './completion-shape.ts';
import {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';

//region Streamed completion
// SSE reassembly for streamed chat completions. The provider is finicky without
// streaming, and streaming also defeats fetch's default headers timeout: headers
// arrive before thinking starts, and reasoning deltas keep the body alive. The
// transport drains the whole event stream to text; this module folds the events
// back into one completion. Reasoning deltas are dropped (content is the answer
// channel), refusal deltas accumulate into the first-class refusal field.

/**
 * SSE field prefix carrying event payloads.
 */
const DATA_PREFIX = 'data:';

/**
 * Terminal sentinel payload closing an OpenAI-compatible stream.
 */
const DONE_SENTINEL = '[DONE]';

/**
 * Channels accumulated while folding one event stream.
 */
type StreamFold = {
  /**
   * Content deltas in arrival order.
   */
  readonly contentParts: string[];

  /**
   * Refusal deltas in arrival order.
   */
  readonly refusalParts: string[];

  /**
   * Usage blocks seen; the last one wins.
   */
  readonly usageParts: ExtractedCompletion['usage'][];
};

/**
 * Folds one parsed stream event into the accumulator.
 *
 * @param fold - accumulated channels
 *
 * @param chunk - parsed event payload
 *
 * @example
 * ```ts
 * foldChunk({ fold, chunk, },);
 * ```
 */
function foldChunk(
  {
    fold,
    chunk,
  }: {
    readonly fold: StreamFold;
    readonly chunk: Readonly<Record<string, unknown>>;
  },
): void {
  /**
   * Usage carried by this event, when present and well typed.
   */
  const { usage, } = readUsage({ parsed: chunk, },);
  if (usage !== undefined) {
    fold
      .usageParts
      .push(usage,);
  }

  /**
   * Choices of this event; usage-only events carry an empty array.
   */
  const { choices, } = chunk;
  if (!isJsonArray(choices,))
    return;

  /**
   * First choice of this event, when any.
   */
  const [first,] = choices;
  if (!isJsonRecord(first,))
    return;

  /**
   * Delta block of the first choice.
   */
  const { delta, } = first;
  if (!isJsonRecord(delta,))
    return;

  if ((typeof delta.content) === 'string') {
    fold
      .contentParts
      .push(delta.content,);
  }
  if (((typeof delta.refusal) === 'string') && (delta.refusal !== '')) {
    fold
      .refusalParts
      .push(delta.refusal,);
  }
}

/**
 * Reads one SSE line's data payload;
 * empty for lines that carry none.
 *
 * @param rawLine - one line of the drained stream
 *
 * @returns Payload after the data prefix, or empty
 *
 * @example
 * ```ts
 * dataPayloadOf('data: [DONE]',);
 * ```
 */
function dataPayloadOf(rawLine: string,): string {
  /**
   * Line without surrounding whitespace and carriage returns.
   */
  const line = rawLine.trim();
  if (!line.startsWith(DATA_PREFIX,))
    return '';
  return line
    .slice(DATA_PREFIX.length,)
    .trim();
}

/**
 * Reassembles one drained SSE body into a completion.
 * Requires the `[DONE]` terminator: a stream that ended without it was cut
 * off, and silently returning truncated content would poison every consumer.
 *
 * @param bodyText - whole drained `text/event-stream` body
 *
 * @returns Reassembled content, refusal, and usage
 *
 * @throws {@link MalformedCompletionError} when an event is not JSON or the terminator is missing
 *
 * @example
 * ```ts
 * const extracted = extractStreamedCompletion({ bodyText: reply.bodyText, },);
 * ```
 */
export function extractStreamedCompletion(
  { bodyText, }: { readonly bodyText: string; },
): ExtractedCompletion {
  /**
   * Accumulated channels across every event.
   */
  const fold: StreamFold = {
    contentParts: [],
    refusalParts: [],
    usageParts: [],
  };

  /**
   * Stream lines walked twice: once for the terminator, once for folding.
   */
  const lines = bodyText.split('\n',);

  /**
   * Whether the terminal sentinel arrived anywhere in the stream.
   */
  const sawDone = lines.some(function isDone(rawLine,) {
    return dataPayloadOf(rawLine,) === DONE_SENTINEL;
  },);

  for (const rawLine of lines) {
    /**
     * Event payload of this line; empty and sentinel lines fold nothing.
     */
    const payload = dataPayloadOf(rawLine,);
    if ((payload === '') || (payload === DONE_SENTINEL))
      continue;

    try {
      /**
       * Parsed event payload.
       */
      const chunk: unknown = JSON.parse(payload,);
      if (!isJsonRecord(chunk,))
        throw new MalformedCompletionError({ detail: 'stream event is not a JSON object', },);
      foldChunk({
        fold,
        chunk,
      },);
    }
    catch (error) {
      if (error instanceof MalformedCompletionError)
        throw error;
      throw new MalformedCompletionError({
        detail: 'stream event is not valid JSON',
        cause: error,
      },);
    }
  }

  if (!sawDone) {
    throw new MalformedCompletionError({
      detail: 'stream ended without its [DONE] terminator; the reply was cut off',
    },);
  }

  /**
   * Refusal accumulated across deltas, when the API refused.
   */
  const refusal = fold
    .refusalParts
    .join('',);

  /**
   * Answer accumulated across content deltas.
   */
  const text = fold
    .contentParts
    .join('',);

  /**
   * Last usage block of the stream, when any arrived.
   */
  const lastUsage = fold
    .usageParts
    .at(-1,);

  return {
    text,
    // Conditional spreads keep absent channels absent.
    ...(refusal === ''
      ? {}
      : { refusal, }),
    ...(lastUsage === undefined
      ? {}
      : { usage: nonNullishOrThrow(lastUsage,), }),
  };
}

//endregion Streamed completion
