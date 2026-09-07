import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { BedrockStreamEnd, } from './bedrock-catalog.ts';
import { MalformedCompletionError, } from './completion-shape.ts';
import { errorName, } from './error-name.ts';
import { isJsonRecord, } from './json-guard.ts';
import { requireStreamTerminator, } from './stream-completion.ts';

//region Bedrock stream end
// HOW A BEDROCK STREAM SAYS IT IS WHOLE, which differs by route. The Gemma
// route ends on `data: [DONE]` as every other provider here does; the gpt-oss
// route ends on a chunk carrying `usage` and no choices, and sends no
// sentinel at all (measured 2026-09-07: six lines, the last a usage chunk).
// The shared reader requires the sentinel, on the grounds that a stream which
// stopped early comes back as 200; so this file asks the right question per
// route and, where the usage chunk is the terminator, appends the sentinel
// the reader expects once that chunk has been seen.

/**
 * Logger root for the stream-end checks.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Prefix of a data line in a server-sent event stream.
 */
const DATA_PREFIX = 'data: ';

/**
 * Terminal sentinel the shared reader requires.
 */
const DONE_LINE = 'data: [DONE]\n';

/**
 * Whether one stream line is a chunk carrying a usage block.
 *
 * @param rawLine - one line of the drained body
 *
 * @returns Whether it parses as an object with a `usage` object
 *
 * @example
 * ```ts
 * isUsageChunk('data: {"choices":[],"usage":{"completion_tokens":10}}',);
 * ```
 */
function isUsageChunk(rawLine: string,): boolean {
  /**
   * Line without surrounding whitespace.
   */
  const line = rawLine.trim();
  if (!line.startsWith(DATA_PREFIX,))
    return false;
  try {
    /**
     * Parsed chunk, unknown until checked.
     */
    const chunk: unknown = JSON.parse(line.slice(DATA_PREFIX.length,),);
    return isJsonRecord(chunk,) && isJsonRecord(chunk.usage,);
  } catch (error) {
    // A line that will not parse is not a usage chunk; the shared reader
    // names it when it folds the stream, so here it is only noted.
    l.debug(`stream line skipped while looking for the usage chunk: ${errorName({ error, },)}`,);
    return false;
  }
}

/**
 * Refuses a body whose stream never announced it was whole, in the way this
 * model's route announces it.
 *
 * @param bodyText - whole drained body, as the transport returned it
 *
 * @param streamEnd - how this model's stream ends
 *
 * @throws {@link MalformedCompletionError} when the terminator never arrived
 *
 * @example
 * ```ts
 * requireBedrockStreamEnd({ bodyText, streamEnd: 'usage-chunk', },);
 * ```
 */
export function requireBedrockStreamEnd(
  {
    bodyText,
    streamEnd,
  }: {
    readonly bodyText: string;
    readonly streamEnd: BedrockStreamEnd;
  },
): void {
  if (streamEnd === 'done-sentinel') {
    requireStreamTerminator({ bodyText, },);
    return;
  }

  /**
   * Whether a usage chunk arrived anywhere in the stream.
   */
  const sawUsage = bodyText
    .split('\n',)
    .some(isUsageChunk,);
  if (!sawUsage) {
    throw new MalformedCompletionError({
      detail: 'stream ended without its usage chunk; the reply was cut off',
    },);
  }
}

/**
 * Body the shared reader accepts: the stream as it came, with the sentinel
 * appended where this route ends on a usage chunk instead.
 *
 * @param bodyText - whole drained body, already checked whole
 *
 * @param streamEnd - how this model's stream ends
 *
 * @returns Body ending on the sentinel
 *
 * @example
 * ```ts
 * const extracted = extractStreamedCompletion({ bodyText: withDoneSentinel({ bodyText, streamEnd, },), },);
 * ```
 */
export function withDoneSentinel(
  {
    bodyText,
    streamEnd,
  }: {
    readonly bodyText: string;
    readonly streamEnd: BedrockStreamEnd;
  },
): string {
  if (streamEnd === 'done-sentinel')
    return bodyText;
  return `${bodyText}\n${DONE_LINE}`;
}

//endregion Bedrock stream end
