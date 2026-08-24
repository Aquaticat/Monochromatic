import type {
  ChannelDelta,
  DeltaScanner,
  StreamChannel,
} from './stream-delta-scan.ts';
import { isJsonRecord, } from './json-guard.ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Anthropic delta scan
// The SAME `DeltaScanner` the OpenAI-shaped path produces, fed by Anthropic
// Messages events instead.
//
// WHY NORMALIZE RATHER THAN GUARD TWICE. Everything downstream of a scanner
// consumes `ChannelDelta` and nothing else: `stream-degeneration.ts` counts
// repetition per channel, `stream-idle-guard.ts` watches the gap between
// deltas, `stream-runaway-watch.ts` decides when a call has stopped making
// progress, and `stream-overrun.ts` bounds volume. Every threshold in that set
// came from measurement, and `#121` re-derived the straggler and idle windows
// after finding the median premise wrong by a factor of eighty. A second
// implementation of those guards would be unmeasured, and would drift from
// this one invisibly. One scanner interface, two wire formats.
//
// THE THINKING CHANNEL IS TYPED HERE RATHER THAN SNIFFED. `#158` cost 47
// percent of calls to a scanner that had to guess which of two field spellings
// carried reasoning, because the OpenAI-shaped provider names it
// `reasoning_content` on some models and `reasoning` on others. Anthropic
// sends a `thinking` content block with `thinking_delta` events, so the
// channel is declared by the wire and that whole class of blindness cannot
// recur through this path.
//
// `event:` LINES ARE IGNORED ON PURPOSE. Every Anthropic frame carries its own
// `type` inside the JSON payload, so reading the payload is both sufficient and
// robust against a server that reorders or omits the `event:` line.

/**
 * Prefix marking a line that carries an event payload.
 */
const DATA_PREFIX = 'data:';

/**
 * Logger root for this scanner.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * One optional space servers put between the colon and the payload.
 */
const OPTIONAL_SPACE = ' ';

/**
 * Block type carrying the model's reasoning rather than its answer.
 */
const THINKING_BLOCK = 'thinking';

/**
 * Delta types this scanner reads, mapped to the channel each belongs to.
 *
 * `input_json_delta` IS THE ANSWER CHANNEL, which is the one mapping here that
 * is not obvious. Under forced tool use the model's whole reply is the tool
 * call's arguments, so those fragments are the content a consumer is waiting
 * for. Routing them to `reasoning` would leave every schema'd call looking
 * like a model that thought at length and answered nothing.
 */
const DELTA_CHANNELS: Readonly<Record<string, StreamChannel>> = {
  text_delta: 'content',
  thinking_delta: 'reasoning',
  input_json_delta: 'content',
};

/**
 * Field each delta type carries its text in.
 *
 * SEPARATE FROM {@link DELTA_CHANNELS} because the two are genuinely
 * independent: `text_delta` and `input_json_delta` share a channel and use
 * different field names, so one record cannot express both.
 */
const DELTA_TEXT_FIELDS: Readonly<Record<string, string>> = {
  text_delta: 'text',
  thinking_delta: 'thinking',
  input_json_delta: 'partial_json',
};

/**
 * Reads one string field off a parsed object, ignoring anything else.
 *
 * @param fields - parsed object to read
 *
 * @param name - field wanted
 *
 * @returns Field value, or empty when absent or not a string
 *
 * @example
 * ```ts
 * const text = stringField({ fields: delta, name: 'text', },);
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

  if (typeof value !== 'string')
    return '';
  return value;
}

/**
 * Reads one number field off a parsed object.
 *
 * @param fields - parsed object to read
 *
 * @param name - field wanted
 *
 * @returns Field value, or nothing when absent or not a number
 *
 * @example
 * ```ts
 * const index = numberField({ fields: frame, name: 'index', },);
 * ```
 */
function numberField(
  {
    fields,
    name,
  }: {
    readonly fields: Readonly<Record<string, unknown>>;
    readonly name: string;
  },
): number | undefined {
  /**
   * Raw value under that name, of unknown type.
   */
  const value = fields[name];

  if (typeof value !== 'number')
    return undefined;
  return value;
}

/**
 * Channel a delta belongs to, preferring what the block declared.
 *
 * A `text_delta` INSIDE A THINKING BLOCK is reasoning despite its type, which
 * is why the block map is consulted first. Providers have been observed to send
 * plain text deltas inside a thinking block, and reading only the delta type
 * would file that as the answer.
 *
 * @param deltaType - `type` of the delta object
 *
 * @param blockType - type the enclosing block declared, when known
 *
 * @returns Channel to file this text under, or nothing for an unread type
 *
 * @example
 * ```ts
 * const channel = channelFor({ deltaType: 'text_delta', blockType: 'thinking', },);
 * ```
 */
function channelFor(
  {
    deltaType,
    blockType,
  }: {
    readonly deltaType: string;
    readonly blockType: string | undefined;
  },
): StreamChannel | undefined {
  if (blockType === THINKING_BLOCK)
    return 'reasoning';
  return DELTA_CHANNELS[deltaType];
}

/**
 * Names what a thrown value is, without asserting it into a shape.
 *
 * @param error - whatever was caught
 *
 * @returns Class name, or a stand-in for a value that has none
 *
 * @example
 * ```ts
 * l.debug(errorName({ error, },),);
 * ```
 */
function errorName(
  { error, }: { readonly error: unknown; },
): string {
  if (Error.isError(error,))
    return error.name;
  return 'a thrown value that is not an Error';
}

/**
 * Parses one event payload, reporting rather than raising on malformed JSON.
 *
 * A DISCRIMINATED RESULT rather than a nullable frame, matching `readPayload`
 * in `stream-delta-scan.ts`. Returning the caught error as the value would pass
 * {@link isJsonRecord}, which narrows only that a value is a non-null object,
 * so an unreadable line would be read as an empty frame instead of counted.
 *
 * @param payload - one `data:` line's payload, already unwrapped
 *
 * @returns Parsed frame, or that it could not be read
 *
 * @example
 * ```ts
 * const parsed = readPayload({ payload: '{"type":"ping"}', },);
 * ```
 */
function readPayload(
  { payload, }: { readonly payload: string; },
):
  | {
    readonly ok: true;
    readonly frame: Readonly<Record<string, unknown>>;
  }
  | { readonly ok: false; }
{
  try {
    /**
     * Whatever that payload parsed to, before any shape is assumed.
     */
    const frame: unknown = JSON.parse(payload,);

    if (!isJsonRecord(frame,))
      return { ok: false, };
    return {
      ok: true,
      frame,
    };
  } catch (error) {
    l.debug(`anthropic stream frame did not parse: ${errorName({ error, },)}`,);
    return { ok: false, };
  }
}

/**
 * A running scanner over one Anthropic Messages stream body.
 *
 * Produces the same {@link DeltaScanner} the OpenAI-shaped path produces, so
 * every stream guard consumes both wire formats without knowing which it has.
 *
 * @returns Scanner fed by `feed`
 *
 * @example
 * ```ts
 * const scanner = scanAnthropicDeltas();
 * for (const chunk of chunks)
 *   for (const delta of scanner.feed({ chunk, },))
 *     detectors[delta.channel].notifyText({ text: delta.text, },);
 * ```
 */
export function scanAnthropicDeltas(): DeltaScanner {
  /**
   * Partial line held from an earlier chunk, the unreadable tally, and the
   * type each open block declared.
   *
   * A RECORD RATHER THAN LOOSE BINDINGS so the factory root holds no mutable
   * variable, matching `scanStreamDeltas`.
   */
  const state = {
    carry: '',
    unreadable: 0,
    blockTypes: new Map<number, string>(),
  };

  /**
   * Records what an opening block declared, so its deltas can be attributed.
   *
   * @param frame - parsed `content_block_start` frame
   *
   * @example
   * ```ts
   * openBlock({ frame, },);
   * ```
   */
  function openBlock(
    { frame, }: { readonly frame: Readonly<Record<string, unknown>>; },
  ): void {
    /**
     * Position this block occupies in the message.
     */
    const index = numberField({
      fields: frame,
      name: 'index',
    },);

    /**
     * Block descriptor the frame carried.
     */
    const block = frame['content_block'];

    if ((index === undefined) || !isJsonRecord(block,))
      return;
    state.blockTypes.set(
      index,
      stringField({
        fields: block,
        name: 'type',
      },),
    );
  }

  /**
   * Reads one delta frame into whatever generated text it carried.
   *
   * @param frame - parsed `content_block_delta` frame
   *
   * @returns Deltas it carried, empty for a delta type this does not read
   *
   * @example
   * ```ts
   * const deltas = readDelta({ frame, },);
   * ```
   */
  function readDelta(
    { frame, }: { readonly frame: Readonly<Record<string, unknown>>; },
  ): readonly ChannelDelta[] {
    /**
     * Delta descriptor the frame carried.
     */
    const delta = frame['delta'];
    if (!isJsonRecord(delta,))
      return [];

    /**
     * Kind of delta this is, which names both channel and text field.
     */
    const deltaType = stringField({
      fields: delta,
      name: 'type',
    },);

    /**
     * Position this delta belongs to, used to recover its block's type.
     */
    const index = numberField({
      fields: frame,
      name: 'index',
    },);

    /**
     * Channel to file this text under, absent for a type not read here.
     */
    const channel = channelFor({
      deltaType,
      blockType: (index === undefined) ? undefined : state.blockTypes.get(index,),
    },);
    if (channel === undefined)
      return [];

    /**
     * Text this delta carried, empty when the field was absent.
     */
    const text = stringField({
      fields: delta,
      name: DELTA_TEXT_FIELDS[deltaType] ?? '',
    },);
    if (text === '')
      return [];

    return [{
      channel,
      text,
    },];
  }

  /**
   * Reads one complete line, returning whatever text it carried.
   *
   * @param line - one line, without its newline
   *
   * @returns Deltas it carried, empty for every non-delta frame
   *
   * @example
   * ```ts
   * const deltas = readLine({ line: 'data: {"type":"ping"}', },);
   * ```
   */
  function readLine(
    { line, }: { readonly line: string; },
  ): readonly ChannelDelta[] {
    /**
     * Line without the carriage return a server may pair with its newline.
     */
    const clean = line.endsWith('\r',)
      ? line.slice(
        0,
        -1,
      )
      : line;

    if (!clean.startsWith(DATA_PREFIX,))
      return [];

    /**
     * Everything after the colon, which may begin with one optional space.
     */
    const afterColon = clean.slice(DATA_PREFIX.length,);

    /**
     * Payload proper, with that one space removed if it was sent.
     */
    const payload = afterColon.startsWith(OPTIONAL_SPACE,)
      ? afterColon.slice(OPTIONAL_SPACE.length,)
      : afterColon;

    if (payload === '')
      return [];

    /**
     * Parsed frame, or a note that this line could not be read.
     */
    const parsed = readPayload({ payload, },);

    if (!parsed.ok) {
      state.unreadable += 1;
      return [];
    }

    /**
     * Which Anthropic frame this is.
     */
    const frameType = stringField({
      fields: parsed.frame,
      name: 'type',
    },);

    if (frameType === 'content_block_start') {
      openBlock({ frame: parsed.frame, },);
      return [];
    }
    if (frameType === 'content_block_delta')
      return readDelta({ frame: parsed.frame, },);
    return [];
  }

  return {
    feed({ chunk, },): readonly ChannelDelta[] {
      /**
       * Everything unparsed so far, including this chunk.
       */
      const pending = state.carry + chunk;

      /**
       * Lines the pending text splits into; the last is kept for next time.
       */
      const lines = pending.split('\n',);
      state.carry = lines.pop() ?? '';

      return lines.flatMap(function ofLine(line,): readonly ChannelDelta[] {
        return readLine({ line, },);
      },);
    },

    unreadableFrames(): number {
      return state.unreadable;
    },
  };
}

//endregion Anthropic delta scan
