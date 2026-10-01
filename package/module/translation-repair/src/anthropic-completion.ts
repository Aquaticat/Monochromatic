import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { isAsciiLowerLetter, } from './ascii-letters.ts';
import { contextRoot, } from './log-context.ts';
import { errorName, } from './error-name.ts';
import { isJsonRecord, } from './json-guard.ts';
import {
  type ExtractedCompletion,
  MalformedCompletionError,
} from './completion-shape.ts';
import { ssePayloadOf, } from './sse-data-line.ts';

/**
 Logger root for the Anthropic completion reader.
 */
const l = contextRoot({ tag: 'translation-repair', },);

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
// `[DONE]` IS SKIPPED, NOT REFUSED. OpenRouter's Messages endpoint appends an
// `event: data` frame carrying the OpenAI-style `data: [DONE]` sentinel after
// `message_stop` (captured 2026-09-03, `deepseek/deepseek-v4-flash-0731` via
// DigitalOcean), and Charm Hyper sends no such frame. The sentinel is not an
// event and carries nothing, so it is the one non-JSON payload this reader
// lets through; every other unreadable payload still refuses the body.
//
// THINKING IS DISCARDED HERE ON PURPOSE. `thinking_delta` is the model's
// private channel; `anthropic-delta-scan.ts` routes it to the guards that watch
// for a runaway, and this file reads only the answer.

/**
 Event ending a well-formed message.
 */
const TERMINATOR = 'message_stop';

/**
 Event a provider sends when the message fails partway, in place of the rest
 of it (the streaming documentation's "Error events").
 */
const ERROR_EVENT = 'error';

/**
 Longest error type a refusal repeats. The documented types are short
 protocol words; anything longer is read as text and not repeated.
 */
const ERROR_TYPE_LIMIT = 64;

/**
 Name a refusal gives an error event whose type is absent or is not a
 protocol word.
 */
const UNNAMED_ERROR = 'unnamed';

/**
 Sentinel some gateways append after the terminator, carrying no event.
 
 SPELLED HERE RATHER THAN IMPORTED from `stream-completion.ts`: that file's
 constant is private to the OpenAI-shaped reader, and the two readers are
 kept independent so a change to one wire format cannot reach the other.
 */
const DONE_SENTINEL = '[DONE]';

/**
 Everything one pass over the body accumulates.
 */
type AnthropicFold = {
  /**
   Text fragments, in arrival order, from `text_delta` frames: the answer
   when the model answered in prose, and prose set aside when it also called
   the tool.
   */
  readonly textParts: string[];

  /**
   Tool-argument fragments, in arrival order, from `input_json_delta`
   frames: the answer whenever there are any.
   */
  readonly toolParts: string[];

  /**
   Why the model stopped, as `message_delta` reported it.
   */
  readonly stopReasons: string[];

  /**
   Prompt tokens, from `message_start`.
   */
  readonly promptTokens: number[];

  /**
   Completion tokens, from `message_delta`.
   */
  readonly completionTokens: number[];
};

/**
 Reads one string field off a parsed object.
 
 @param fields - parsed object to read
 
 @param name - field wanted
 
 @returns Value, or empty when absent or not a string
 
 @example
 ```ts
 const kind = stringField({ fields: frame, name: 'type', },);
 ```
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
   Raw value under that name, of unknown type.
   */
  const value = fields[name];

  if ((typeof value) !== 'string')
    return '';
  return value;
}

/**
 Records the token counts a usage block carried, ignoring absent ones.
 
 THE TWO FRAMES NEST IT DIFFERENTLY, which is why the holder is a parameter
 rather than read off the frame here. `message_delta` puts `usage` at the top
 level, while `message_start` puts it inside `message` alongside the model
 name and the null stop reason. Reading only the top level would silently drop
 every prompt-token count.
 
 @param holder - object that directly holds the `usage` block
 
 @param fold - accumulator to append to
 
 @example
 ```ts
 foldUsage({ holder: frame, fold, },);
 ```
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
   Usage block, absent while a frame carries none.
   */
  const { usage, } = holder;
  if (!isJsonRecord(usage,))
    return;

  /**
   Prompt tokens this frame reported.
   */
  const { input_tokens: input, } = usage;

  /**
   Completion tokens this frame reported.
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
 Folds one `message_start` frame's usage, which it nests inside `message`.
 
 @param frame - parsed message-start frame
 
 @param fold - accumulator to append to
 
 @example
 ```ts
 foldStart({ frame, fold, },);
 ```
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
   Message envelope this frame opens, which holds the usage block.
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
 Folds one `content_block_delta` frame's answer text, if it carried any.
 
 READS BOTH `text_delta` AND `input_json_delta`, because a model asked for a
 tool answers in the second and a model asked for prose answers in the first,
 and this pipeline uses both shapes.
 
 @param frame - parsed delta frame
 
 @param fold - accumulator to append to
 
 @example
 ```ts
 foldDelta({ frame, fold, },);
 ```
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
   Delta descriptor the frame carried.
   */
  const { delta, } = frame;
  if (!isJsonRecord(delta,))
    return;

  /**
   Kind of delta, which names the field its text rides in.
   */
  const kind = stringField({
    fields: delta,
    name: 'type',
  },);

  if (kind === 'text_delta')
    fold
      .textParts
      .push(stringField({
      fields: delta,
      name: 'text',
    },),);
  if (kind === 'input_json_delta')
    fold
      .toolParts
      .push(stringField({
      fields: delta,
      name: 'partial_json',
    },),);
}

/**
 Folds one `message_delta` frame's stop reason and usage.
 
 @param frame - parsed message-delta frame
 
 @param fold - accumulator to append to
 
 @example
 ```ts
 foldMessageDelta({ frame, fold, },);
 ```
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
   Delta descriptor, which carries the stop reason on this frame kind.
   */
  const { delta, } = frame;
  if (!isJsonRecord(delta,))
    return;

  /**
   Why the model stopped, absent while it is still going.
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
 Token counts as a READER sees them, with no way to append.
 
 A SEPARATE TYPE FROM {@link AnthropicFold} because the accumulator is
 deliberately mutable and this function only reads it. Taking the accumulator
 here would hand a reader the ability to change what it is reporting on.
 
 @example
 ```ts
 const counts: ReportedCounts = { promptTokens: [41,], completionTokens: [12,], };
 ```
 */
type ReportedCounts = {
  /**
   Prompt tokens, in arrival order.
   */
  readonly promptTokens: readonly number[];

  /**
   Completion tokens, in arrival order.
   */
  readonly completionTokens: readonly number[];
};

/**
 Usage fragment for the result, present only when the stream reported counts.
 
 @param counts - token counts the body reported, read only
 
 @returns Spreadable fragment carrying usage, or nothing
 
 @example
 ```ts
 const fragment = usageOf({ counts: fold, },);
 ```
 */
function usageOf(
  { counts, }: { readonly counts: ReportedCounts; },
): Pick<ExtractedCompletion, 'usage'> {
  /**
   Both count series, named so neither read is a three-step chain.
   */
  const {
    promptTokens,
    completionTokens,
  } = counts;

  /**
   Prompt tokens, which arrive once in `message_start`.
   */
  const prompt = promptTokens
    .at(-1,)
    ?? 0;

  /**
   Completion tokens, whose last report is the running total.
   */
  const completion = completionTokens
    .at(-1,)
    ?? 0;

  /**
   Whether the provider reported any count at all.
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
 What one event payload reads as: a frame, or why it is not one.

 A DISCRIMINATED RESULT so the two readers of a body share one parse and
 still differ in what they do with a payload that is not a frame: the check
 for a whole message passes over it, and the fold refuses the body.

 @example
 ```ts
 const reading: FrameReading = { kind: 'not-object', };
 ```
 */
type FrameReading =
  | {
    readonly kind: 'frame';

    /**
     Parsed frame, which carries its own `type`.
     */
    readonly frame: Readonly<Record<string, unknown>>;
  }
  | {
    readonly kind: 'not-json';

    /**
     Parse failure, kept as the cause of any refusal.
     */
    readonly cause: unknown;
  }
  | { readonly kind: 'not-object'; };

/**
 Reads one event payload as a frame.

 @param payload - one `data:` line's payload, already unwrapped

 @returns Frame, or why the payload is not one

 @example
 ```ts
 const reading = readFrame({ payload: '{"type":"ping"}', },);
 ```
 */
function readFrame({ payload, }: { readonly payload: string; },): FrameReading {
  try {
    /**
     Whatever the payload parsed to, before any shape is assumed.
     */
    const parsed: unknown = JSON.parse(payload,);

    if (!isJsonRecord(parsed,))
      return { kind: 'not-object', };
    return {
      kind: 'frame',
      frame: parsed,
    };
  } catch (error) {
    l.debug(`anthropic stream payload did not parse: ${errorName({ error, },)}`,);
    return {
      kind: 'not-json',
      cause: error,
    };
  }
}

/**
 Whether a provider's error type reads as a protocol word: lower-case ASCII
 letters and underscores, as every documented type is spelled, and short.

 A TEST OF SHAPE RATHER THAN A LIST, so a type the provider adds later is
 still named, while text that is not a protocol word is never repeated in a
 refusal whose class promises to quote nothing from the body.

 @param text - error type as the frame gave it

 @returns Whether a refusal may repeat it

 @example
 ```ts
 isProtocolWord({ text: 'overloaded_error', },);
 ```
 */
function isProtocolWord({ text, }: { readonly text: string; },): boolean {
  if ((text.length === 0) || (text.length > ERROR_TYPE_LIMIT))
    return false;
  return Array.from(text,)
    .every(function isWordCharacter(character,): boolean {
    return (character === '_') || isAsciiLowerLetter({ character, },);
  },);
}

/**
 Names the failure an error event reported, for the refusal that ends the
 call.

 @param frame - parsed error frame

 @returns Error type, or that the frame named none a refusal may repeat

 @example
 ```ts
 const named = errorTypeOf({ frame, },);
 ```
 */
function errorTypeOf(
  { frame, }: { readonly frame: Readonly<Record<string, unknown>>; },
): string {
  /**
   Error descriptor the frame carried.
   */
  const { error, } = frame;
  if (!isJsonRecord(error,))
    return UNNAMED_ERROR;

  /**
   Type the descriptor names, empty when it names none.
   */
  const named = stringField({
    fields: error,
    name: 'type',
  },);

  return isProtocolWord({ text: named, },)
    ? named
    : UNNAMED_ERROR;
}

/**
 Refuses a body whose event stream did not end the way a whole message does:
 with a `message_stop` frame, and with no error event anywhere in it.

 SPLIT OUT SO THE RETRY LADDER CAN ASK IT TOO. A body that stops before
 `message_stop` is a transport failure wearing a success status: the HTTP
 exchange returned 200 and the message inside it is not whole. Reading it
 only after the retry had already returned meant the one failure this file
 calls a transport failure was the only one that never retried.

 ONE RULE IN ONE PLACE. `extractAnthropicCompletion` calls this rather than
 carrying its own copy, so the retry and the parse can never disagree about
 what a finished message looks like.

 THE TERMINATOR IS A FRAME OF THAT TYPE, read off the parse (ledger B87).
 Looking for the quoted word anywhere in a payload passed a body cut inside
 its last frame, after `{"type":"message_stop"` and before the closing
 brace, so the ladder returned it and the fold then refused it as not JSON,
 with no retry left to spend. It also passed any frame holding that word as
 a value, a tool's name for one.

 AN ERROR EVENT REFUSES THE MESSAGE even when a terminator follows it, and
 the refusal names its type. The provider said why it stopped; calling that
 a cut connection sent a reader to the network. Refused here, it is retried
 like a cut stream, which suits an overloaded or internal error; a request
 the provider called invalid is retried too, and that waste is left open in
 the ledger.

 ONLY THE ENDING IS READ. A frame elsewhere in the body that does not parse
 is the fold's to refuse, after the ladder: a body whose terminator arrived
 was delivered whole, and a frame inside it that cannot be read is read here
 as a formatting defect a retry would repeat and pay for again (an
 inference, not measured). `requireStreamTerminator`, the OpenAI-shaped
 sibling, reads the same scope.

 @param bodyText - whole drained body, as the transport returned it

 @throws {@link MalformedCompletionError} when an error event arrived or the terminator never did

 @example
 ```ts
 requireWholeAnthropicMessage({ bodyText, },);
 ```
 */
export function requireWholeAnthropicMessage(
  { bodyText, }: { readonly bodyText: string; },
): void {
  /**
   Frames the body carried, in arrival order; payloads that are not frames
   are passed over.
   */
  const frames = bodyText
    .split('\n',)
    .flatMap(function framesOf(rawLine,): readonly Readonly<Record<string, unknown>>[] {
      /**
       Payload of this line, empty for a line carrying no event.
       */
      const payload = ssePayloadOf({ line: rawLine, },);
      if (payload === '')
        return [];

      /**
       What that payload reads as.
       */
      const reading = readFrame({ payload, },);
      return (reading.kind === 'frame')
        ? [reading.frame,]
        : [];
    },);

  /**
   Type each frame declared, empty where it declared none.
   */
  const kinds = frames.map(function kindOf(frame,): string {
    return stringField({
      fields: frame,
      name: 'type',
    },);
  },);

  /**
   First error event, when the provider sent one.
   */
  const failure = frames.find(function isFailure(frame,): boolean {
    return stringField({
      fields: frame,
      name: 'type',
    },) === ERROR_EVENT;
  },);

  if (failure !== undefined) {
    throw new MalformedCompletionError({
      detail: `anthropic stream carried an error event (${errorTypeOf({ frame: failure, },)})`,
    },);
  }
  if (!kinds.includes(TERMINATOR,)) {
    throw new MalformedCompletionError({
      detail: `anthropic stream ended without ${TERMINATOR}`,
    },);
  }
}

/**
 Reassembles one drained Anthropic Messages body into a completion.
 
 @param bodyText - whole drained `text/event-stream` body
 
 @returns Answer text, stop reason, and usage
 
 @throws {@link MalformedCompletionError} when an event is not JSON, an error event arrived, or `message_stop` never did

 @example
 ```ts
 const extracted = extractAnthropicCompletion({ bodyText: reply.bodyText, },);
 ```
 */
export function extractAnthropicCompletion(
  { bodyText, }: { readonly bodyText: string; },
): ExtractedCompletion {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: extractAnthropicCompletion.name,
    l,
  },);

  /**
   Everything this pass over the body accumulates.
   */
  const fold: AnthropicFold = {
    textParts: [],
    toolParts: [],
    stopReasons: [],
    promptTokens: [],
    completionTokens: [],
  };

  requireWholeAnthropicMessage({ bodyText, },);

  /**
   Body lines, folded into the answer.
   */
  const lines = bodyText.split('\n',);

  for (const rawLine of lines) {
    /**
     Event payload of this line; empty lines fold nothing.
     */
    const payload = ssePayloadOf({ line: rawLine, },);
    if (payload === '')
      continue;
    if (payload === DONE_SENTINEL)
      continue;

    /**
     What this payload reads as.
     */
    const reading = readFrame({ payload, },);

    if (reading.kind === 'not-json') {
      throw new MalformedCompletionError({
        detail: 'anthropic stream event is not JSON',
        cause: reading.cause,
      },);
    }
    if (reading.kind === 'not-object')
      throw new MalformedCompletionError({ detail: 'anthropic stream event is not a JSON object', },);

    /**
     Parsed event payload.
     */
    const { frame, } = reading;

    /**
     Which frame this is.
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
   Stop reason, when the stream reported one.
   */
  const stopReason = fold
    .stopReasons
    .at(-1,)
    ?? '';

  /**
   Tool arguments, whole, when the model called the tool at all.
   */
  const toolAnswer = fold
    .toolParts
    .join('',);

  /**
   Prose, whole, which is the answer only when no tool was called.
   */
  const prose = fold
    .textParts
    .join('',);

  // THE TOOL'S ARGUMENTS ARE THE ANSWER WHENEVER THERE ARE ANY. Under
  // `tool_choice: auto` a model may write a text block before the tool block;
  // folding both into one string handed the schema reader prose glued to JSON
  // and lost the voice, and a Hyper-only seat has no other stack for a second
  // opinion. The prose is set aside and its size logged, never its
  // content.
  if ((toolAnswer !== '') && (prose !== ''))
    rl.info(
      `tool answer kept, ${String(prose.length,)} characters of prose set aside`,
    );

  return {
    text: (toolAnswer === '') ? prose : toolAnswer,
    ...((stopReason === '') ? {} : { finishReason: stopReason, }),
    ...usageOf({ counts: fold, },),
  };
}

//endregion Anthropic completion
