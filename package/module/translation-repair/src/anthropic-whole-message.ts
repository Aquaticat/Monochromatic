import { isAsciiLowerLetter, } from './ascii-letters.ts';
import { contextRoot, } from './log-context.ts';
import { errorName, } from './error-name.ts';
import { isJsonRecord, } from './json-guard.ts';
import { MalformedCompletionError, } from './completion-shape.ts';
import { ssePayloadOf, } from './sse-data-line.ts';

/**
 Logger root for the Anthropic whole-message check.
 */
const l = contextRoot({ tag: 'translation-repair', },);

//region Anthropic whole message
// Whether one drained Anthropic Messages body ended the way a whole message
// does, and how each of its payloads reads as a frame. Split from
// `anthropic-completion.ts`, which folds the frames into an answer, so that the
// retry ladder in `hyper-client.ts` and the fold read a body by one rule.
//
// THE TERMINATOR IS `message_stop`, NOT `[DONE]`. Requiring it matters for the
// same reason `extractStreamedCompletion` requires its own: a stream that ended
// without one was cut off, and returning the truncated prefix would hand a
// validator a half-written JSON object and get it reported as a schema mismatch
// rather than as the transport failure it is.

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
 Reads one string field off a parsed object.

 @param fields - parsed object to read

 @param name - field wanted

 @returns Value, or empty when absent or not a string

 @example
 ```ts
 const kind = stringField({ fields: frame, name: 'type', },);
 ```
 */
export function stringField(
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
 What one event payload reads as: a frame, or why it is not one.

 A DISCRIMINATED RESULT so the two readers of a body share one parse and
 still differ in what they do with a payload that is not a frame: the check
 for a whole message passes over it, and the fold refuses the body.

 @example
 ```ts
 const reading: FrameReading = { kind: 'not-object', };
 ```
 */
export type FrameReading =
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
export function readFrame({ payload, }: { readonly payload: string; },): FrameReading {
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
      wireFormat: 'anthropic',
      detail: `stream carried an error event (${errorTypeOf({ frame: failure, },)})`,
    },);
  }
  if (!kinds.includes(TERMINATOR,)) {
    throw new MalformedCompletionError({
      wireFormat: 'anthropic',
      detail: `stream ended without ${TERMINATOR}`,
    },);
  }
}

//endregion Anthropic whole message
