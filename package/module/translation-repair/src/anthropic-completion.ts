import { isJsonRecord, } from './json-guard.ts';
import {
  type ExtractedCompletion,
  MalformedCompletionError,
} from './completion-shape.ts';

//region Anthropic completion
// Reassembles one drained Anthropic Messages stream into the same
// `ExtractedCompletion` the OpenAI-shaped path produces, so `model-content.ts`
// reads an answer without knowing which provider served it.
//
// THE ANSWER IS USUALLY A TOOL CALL HERE. Charm Hyper produces schema-valid
// output only under tool use, so on most calls the model emits no text at all
// and the whole reply arrives as `input_json_delta` fragments of the tool's
// arguments. Those fragments ARE the answer, and concatenating them yields the
// JSON a validator then reads.
//
// THE TERMINATOR IS `message_stop`, NOT `[DONE]`. Requiring it matters for the
// same reason `extractStreamedCompletion` requires its own: a stream that ended
// without one was cut off, and returning the truncated prefix would hand a
// validator a half-written JSON object and get it reported as a schema mismatch
// rather than as the transport failure it is.
//
// THINKING IS DISCARDED HERE ON PURPOSE. `thinking_delta` is the model's
// private channel; `anthropic-delta-scan.ts` routes it to the guards that watch
// for a runaway, and this file reads only the answer.

/**
 * Prefix marking a line that carries an event payload.
 */
const DATA_PREFIX = 'data:';

/**
 * Event ending a well-formed message.
 */
const TERMINATOR = 'message_stop';

/**
 * Everything one pass over the body accumulates.
 */
type AnthropicFold = {
  /**
   * Answer fragments, in arrival order, from text and tool-argument deltas.
   */
  readonly answerParts: string[];

  /**
   * Why the model stopped, as `message_delta` reported it.
   */
  readonly stopReasons: string[];

  /**
   * Prompt tokens, from `message_start`.
   */
  readonly promptTokens: number[];

  /**
   * Completion tokens, from `message_delta`.
   */
  readonly completionTokens: number[];
};

/**
 * Payload of one line, empty for anything that is not an event.
 *
 * @param rawLine - one line of the drained body
 *
 * @returns Payload text, trimmed, empty when this line carries none
 *
 * @example
 * ```ts
 * const payload = dataPayloadOf('data: {"type":"ping"}',);
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
 * Reads one string field off a parsed object.
 *
 * @param fields - parsed object to read
 *
 * @param name - field wanted
 *
 * @returns Value, or empty when absent or not a string
 *
 * @example
 * ```ts
 * const kind = stringField({ fields: frame, name: 'type', },);
 * ```
 */
function stringField(
  {
    fields,
    name,
  }: {
    readonly fields: Readonly<Record<string, unknown>>;
    readonly name: string;
  },
): string {
  /**
   * Raw value under that name, of unknown type.
   */
  const value = fields[name];

  if ((typeof value) !== 'string')
    return '';
  return value;
}

/**
 * Records the token counts a usage block carried, ignoring absent ones.
 *
 * THE TWO FRAMES NEST IT DIFFERENTLY, which is why the holder is a parameter
 * rather than read off the frame here. `message_delta` puts `usage` at the top
 * level, while `message_start` puts it inside `message` alongside the model
 * name and the null stop reason. Reading only the top level would silently drop
 * every prompt-token count.
 *
 * @param holder - object that directly holds the `usage` block
 *
 * @param fold - accumulator to append to
 *
 * @example
 * ```ts
 * foldUsage({ holder: frame, fold, },);
 * ```
 */
function foldUsage(
  {
    holder,
    fold,
  }: {
    readonly holder: Readonly<Record<string, unknown>>;
    readonly fold: AnthropicFold;
  },
): void {
  /**
   * Usage block, absent while a frame carries none.
   */
  const { usage, } = holder;
  if (!isJsonRecord(usage,))
    return;

  /**
   * Prompt tokens this frame reported.
   */
  const { input_tokens: input, } = usage;

  /**
   * Completion tokens this frame reported.
   */
  const { output_tokens: output, } = usage;

  if ((typeof input) === 'number')
    fold
      .promptTokens
      .push(input,);
  if ((typeof output) === 'number')
    fold
      .completionTokens
      .push(output,);
}

/**
 * Folds one `message_start` frame's usage, which it nests inside `message`.
 *
 * @param frame - parsed message-start frame
 *
 * @param fold - accumulator to append to
 *
 * @example
 * ```ts
 * foldStart({ frame, fold, },);
 * ```
 */
function foldStart(
  {
    frame,
    fold,
  }: {
    readonly frame: Readonly<Record<string, unknown>>;
    readonly fold: AnthropicFold;
  },
): void {
  /**
   * Message envelope this frame opens, which holds the usage block.
   */
  const { message, } = frame;
  if (!isJsonRecord(message,))
    return;

  foldUsage({
    holder: message,
    fold,
  },);
}

/**
 * Folds one `content_block_delta` frame's answer text, if it carried any.
 *
 * READS BOTH `text_delta` AND `input_json_delta`, because a model asked for a
 * tool answers in the second and a model asked for prose answers in the first,
 * and this pipeline uses both shapes.
 *
 * @param frame - parsed delta frame
 *
 * @param fold - accumulator to append to
 *
 * @example
 * ```ts
 * foldDelta({ frame, fold, },);
 * ```
 */
function foldDelta(
  {
    frame,
    fold,
  }: {
    readonly frame: Readonly<Record<string, unknown>>;
    readonly fold: AnthropicFold;
  },
): void {
  /**
   * Delta descriptor the frame carried.
   */
  const { delta, } = frame;
  if (!isJsonRecord(delta,))
    return;

  /**
   * Kind of delta, which names the field its text rides in.
   */
  const kind = stringField({
    fields: delta,
    name: 'type',
  },);

  if (kind === 'text_delta')
    fold
      .answerParts
      .push(stringField({
      fields: delta,
      name: 'text',
    },),);
  if (kind === 'input_json_delta')
    fold
      .answerParts
      .push(stringField({
      fields: delta,
      name: 'partial_json',
    },),);
}

/**
 * Folds one `message_delta` frame's stop reason and usage.
 *
 * @param frame - parsed message-delta frame
 *
 * @param fold - accumulator to append to
 *
 * @example
 * ```ts
 * foldMessageDelta({ frame, fold, },);
 * ```
 */
function foldMessageDelta(
  {
    frame,
    fold,
  }: {
    readonly frame: Readonly<Record<string, unknown>>;
    readonly fold: AnthropicFold;
  },
): void {
  foldUsage({
    holder: frame,
    fold,
  },);

  /**
   * Delta descriptor, which carries the stop reason on this frame kind.
   */
  const { delta, } = frame;
  if (!isJsonRecord(delta,))
    return;

  /**
   * Why the model stopped, absent while it is still going.
   */
  const reason = stringField({
    fields: delta,
    name: 'stop_reason',
  },);

  if (reason !== '')
    fold
      .stopReasons
      .push(reason,);
}

/**
 * Token counts as a READER sees them, with no way to append.
 *
 * A SEPARATE TYPE FROM {@link AnthropicFold} because the accumulator is
 * deliberately mutable and this function only reads it. Taking the accumulator
 * here would hand a reader the ability to change what it is reporting on.
 *
 * @example
 * ```ts
 * const counts: ReportedCounts = { promptTokens: [41,], completionTokens: [12,], };
 * ```
 */
type ReportedCounts = {
  /**
   * Prompt tokens, in arrival order.
   */
  readonly promptTokens: readonly number[];

  /**
   * Completion tokens, in arrival order.
   */
  readonly completionTokens: readonly number[];
};

/**
 * Usage fragment for the result, present only when the stream reported counts.
 *
 * @param counts - token counts the body reported, read only
 *
 * @returns Spreadable fragment carrying usage, or nothing
 *
 * @example
 * ```ts
 * const fragment = usageOf({ counts: fold, },);
 * ```
 */
function usageOf(
  { counts, }: { readonly counts: ReportedCounts; },
): Pick<ExtractedCompletion, 'usage'> {
  /**
   * Both count series, named so neither read is a three-step chain.
   */
  const {
    promptTokens,
    completionTokens,
  } = counts;

  /**
   * Prompt tokens, which arrive once in `message_start`.
   */
  const prompt = promptTokens
    .at(-1,)
    ?? 0;

  /**
   * Completion tokens, whose last report is the running total.
   */
  const completion = completionTokens
    .at(-1,)
    ?? 0;

  /**
   * Whether the provider reported any count at all.
   */
  const silent = (promptTokens.length === 0)
    && (completionTokens.length === 0);

  if (silent)
    return {};
  return {
    usage: {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: prompt + completion,
    },
  };
}

/**
 * Refuses a body whose event stream never reached its terminator.
 *
 * SPLIT OUT SO THE RETRY LADDER CAN ASK IT TOO. A body that stops before
 * `message_stop` is a transport failure wearing a success status: the HTTP
 * exchange returned 200 and the message inside it is not whole. Reading it
 * only after the retry had already returned meant the one failure this file
 * calls a transport failure was the only one that never retried.
 *
 * ONE RULE IN ONE PLACE. `extractAnthropicCompletion` calls this rather than
 * carrying its own copy, so the retry and the parse can never disagree about
 * what a finished message looks like.
 *
 * @param bodyText - whole drained body, as the transport returned it
 *
 * @throws {@link MalformedCompletionError} when the terminator never arrived
 *
 * @example
 * ```ts
 * requireAnthropicTerminator({ bodyText, },);
 * ```
 */
export function requireAnthropicTerminator(
  { bodyText, }: { readonly bodyText: string; },
): void {
  /**
   * Whether the message ended the way a whole one does.
   */
  const ended = bodyText
    .split('\n',)
    .some(function isStop(rawLine,): boolean {
      /**
       * Payload of this line, empty for a line carrying no event.
       */
      const payload = dataPayloadOf(rawLine,);
      return payload.includes(`"${TERMINATOR}"`,);
    },);

  if (!ended) {
    throw new MalformedCompletionError({
      detail: `anthropic stream ended without ${TERMINATOR}`,
    },);
  }
}

/**
 * Reassembles one drained Anthropic Messages body into a completion.
 *
 * @param bodyText - whole drained `text/event-stream` body
 *
 * @returns Answer text, stop reason, and usage
 *
 * @throws {@link MalformedCompletionError} when an event is not JSON or `message_stop` never arrived
 *
 * @example
 * ```ts
 * const extracted = extractAnthropicCompletion({ bodyText: reply.bodyText, },);
 * ```
 */
export function extractAnthropicCompletion(
  { bodyText, }: { readonly bodyText: string; },
): ExtractedCompletion {
  /**
   * Everything the body accumulates across its frames.
   */
  const fold: AnthropicFold = {
    answerParts: [],
    stopReasons: [],
    promptTokens: [],
    completionTokens: [],
  };

  requireAnthropicTerminator({ bodyText, },);

  /**
   * Body lines, folded into the answer.
   */
  const lines = bodyText.split('\n',);

  for (const rawLine of lines) {
    /**
     * Event payload of this line; empty lines fold nothing.
     */
    const payload = dataPayloadOf(rawLine,);
    if (payload === '')
      continue;

    /**
     * Parsed event payload.
     */
    const frame: unknown = (function parseFrame(): unknown {
      try {
        return JSON.parse(payload,) as unknown;
      } catch (error) {
        throw new MalformedCompletionError({
          detail: 'anthropic stream event is not JSON',
          cause: error,
        },);
      }
    })();

    if (!isJsonRecord(frame,))
      throw new MalformedCompletionError({ detail: 'anthropic stream event is not a JSON object', },);

    /**
     * Which frame this is.
     */
    const kind = stringField({
      fields: frame,
      name: 'type',
    },);

    if (kind === 'message_start')
      foldStart({
        frame,
        fold,
      },);
    if (kind === 'content_block_delta')
      foldDelta({
        frame,
        fold,
      },);
    if (kind === 'message_delta')
      foldMessageDelta({
        frame,
        fold,
      },);
  }

  /**
   * Stop reason, when the stream reported one.
   */
  const stopReason = fold
    .stopReasons
    .at(-1,)
    ?? '';

  return {
    text: fold
      .answerParts
      .join('',),
    ...((stopReason === '') ? {} : { finishReason: stopReason, }),
    ...usageOf({ counts: fold, },),
  };
}

//endregion Anthropic completion
