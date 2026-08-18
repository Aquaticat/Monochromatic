//region Stream delta scan
// PULLS GENERATED TEXT OUT OF A STREAM AS IT ARRIVES, which is what makes
// `watchForDegeneration` usable at all: the detector must be fed generated
// text, and the transport carries server-sent events whose JSON envelope is
// identical around every token. Fed the raw body the detector would condemn
// every healthy stream, because the envelope would dominate its sample.
//
// BOTH CHANNELS ARE SCANNED, and the reasoning channel is the one that matters
// most. A model can degenerate entirely inside its thinking, repeating "I will
// output." forever while emitting no answer at all. A scanner that read only
// `content` would hand the detector an empty string, which reads as a short
// reply rather than a runaway one, so the very worst case would be the one
// case nothing caught.
//
// TWO DELIVERY SHAPES EXIST HERE and both are covered. This provider sends
// reasoning in separate `reasoning_content` fields, verified live and recorded
// in `completion-shape.ts`; some models instead embed `<think>` blocks inside
// `content`, which `model-content.ts` strips after the fact. The second shape
// needs nothing special, since such text arrives as content and is scanned as
// content.
//
// NOTHING HERE THROWS. It runs inside the drain loop for every chunk of every
// call, so a frame it cannot read must not take down a stream that is working.
// Unreadable frames are COUNTED rather than swallowed, and the count is
// reported, so a provider that changes its wire format shows up as a rising
// number instead of as silence.

/**
 * Prefix marking a line that carries a payload.
 *
 * NO TRAILING SPACE, deliberately. The space after the colon is OPTIONAL in
 * server-sent events and a reader is required to strip one if present, so a
 * provider may legitimately emit `data:{...}`. Spelling the prefix with the
 * space would skip those lines as though they were comments, and skip them
 * SILENTLY, since only `data:` lines are ever counted as unreadable. This
 * repository has already paid for exactly this trap once: `runner-closure.ts`
 * carries four import spellings because the tight form produced a false null
 * that looked like a self-contained bundle.
 */
const DATA_PREFIX = 'data:';

/**
 * Single optional space a sender may put after the colon.
 */
const OPTIONAL_SPACE = ' ';

/**
 * Payload the provider sends to mark the end of a stream, which is not JSON.
 */
const DONE_PAYLOAD = '[DONE]';

/**
 * Which channel a piece of generated text arrived on.
 *
 * KEPT APART rather than merged into one string, so a degeneration verdict can
 * name the channel it happened in. "The model repeated itself while thinking"
 * and "the model repeated itself in its answer" are different failures to
 * diagnose, and the first is invisible in the answer.
 */
export type StreamChannel = 'content' | 'reasoning';

/**
 * One piece of generated text, and where it came from.
 *
 * @example
 * ```ts
 * const delta: ChannelDelta = { channel: 'reasoning', text: 'I will output.', };
 * ```
 */
export type ChannelDelta = {
  /**
   * Channel this text arrived on.
   */
  readonly channel: StreamChannel;

  /**
   * Text itself, exactly as sent.
   */
  readonly text: string;
};

/**
 * A running scanner over one stream's raw body.
 *
 * @example
 * ```ts
 * const scanner = scanStreamDeltas();
 * const deltas = scanner.feed({ chunk, },);
 * ```
 */
export type DeltaScanner = {
  /**
   * Takes the next raw chunk and returns whatever generated text it completed.
   */
  readonly feed: (input: { readonly chunk: string; },) => readonly ChannelDelta[];

  /**
   * Payload lines that could not be read, which should stay at zero.
   */
  readonly unreadableFrames: () => number;
};

/**
 * Reads one string field off a delta object, ignoring anything else.
 *
 * @param delta - parsed `delta` object from a frame
 *
 * @param key - field to read
 *
 * @returns Its text, or empty when absent, null, or not a string
 *
 * @example
 * ```ts
 * const text = textField({ delta, key: 'reasoning_content', },);
 * ```
 */
function textField(
  {
    delta,
    key,
  }: {
    readonly delta: Record<string, unknown>;
    readonly key: string;
  },
): string {
  /**
   * Whatever sits at that key, which may be absent or null.
   */
  const value = delta[key];
  return ((typeof value) === 'string') ? value : '';
}

/**
 * Reads the `delta` object out of a parsed frame.
 *
 * @param frame - parsed payload of one `data:` line
 *
 * @returns Its first choice's delta, or an empty object when the frame carries
 * none, which usage-only frames legitimately do
 *
 * @example
 * ```ts
 * const delta = deltaOf({ frame, },);
 * ```
 */
function deltaOf({ frame, }: { readonly frame: unknown; },): Record<string, unknown> {
  if ((typeof frame) !== 'object' || (frame === null))
    return {};

  /**
   * Choices array, absent on the final usage frame.
   */
  const choices = (frame as Record<string, unknown>).choices;
  if (!Array.isArray(choices,))
    return {};

  /**
   * First choice, the only one requested.
   */
  const first = choices[0];
  if ((typeof first) !== 'object' || (first === null))
    return {};

  /**
   * Its delta, absent when the choice carries only a finish reason.
   */
  const delta = (first as Record<string, unknown>).delta;
  if ((typeof delta) !== 'object' || (delta === null))
    return {};
  return delta as Record<string, unknown>;
}

/**
 * Builds a scanner that turns raw stream chunks into generated text.
 *
 * INCREMENTAL BY LINE, because a chunk boundary falls wherever the network puts
 * it and routinely lands in the middle of a frame. Whatever follows the last
 * newline is carried forward rather than parsed, so no frame is read twice and
 * none is read in halves.
 *
 * NO REGEX, per `RG1`: the rule is "split on newlines, keep lines starting with
 * a fixed prefix", which string methods state directly.
 *
 * @returns Scanner fed by `feed`
 *
 * @example
 * ```ts
 * const scanner = scanStreamDeltas();
 * for (const chunk of chunks)
 *   for (const delta of scanner.feed({ chunk, },))
 *     detectors[delta.channel].notifyText({ text: delta.text, },);
 * ```
 */
export function scanStreamDeltas(): DeltaScanner {
  /**
   * Partial line held back from an earlier chunk, plus the unreadable tally.
   *
   * A RECORD RATHER THAN LOOSE BINDINGS so the factory root holds no mutable
   * variable.
   */
  const state = {
    carry: '',
    unreadable: 0,
  };

  /**
   * Reads one complete line, returning whatever text it carried.
   *
   * @param line - one line, without its newline
   *
   * @returns Deltas it carried, empty for comments and the done marker
   *
   * @example
   * ```ts
   * const deltas = readLine({ line: 'data: {"choices":[]}', },);
   * ```
   */
  function readLine({ line, }: { readonly line: string; },): readonly ChannelDelta[] {
    /**
     * Line without the carriage return a server may pair with its newline.
     */
    const clean = line.endsWith('\r',) ? line.slice(
      0,
      -1,
    ) : line;

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
    if (payload === DONE_PAYLOAD)
      return [];

    /**
     * Parsed frame, or a note that it could not be read.
     */
    const parsed = ((): { readonly ok: true; readonly frame: unknown; } | { readonly ok: false; } => {
      try {
        return {
          ok: true,
          frame: JSON.parse(payload,),
        };
      }
      catch (error) {
        // Counted rather than thrown: this runs on every chunk of every call,
        // and one unreadable frame must not end a stream that is working. The
        // caught value is folded into the tally the caller reports.
        void error;
        return { ok: false, };
      }
    })();

    if (!parsed.ok) {
      state.unreadable += 1;
      return [];
    }

    /**
     * Delta object this frame carried.
     */
    const delta = deltaOf({ frame: parsed.frame, },);

    /**
     * Answer text, if any.
     */
    const content = textField({
      delta,
      key: 'content',
    },);

    /**
     * Thinking text, if any.
     */
    const reasoning = textField({
      delta,
      key: 'reasoning_content',
    },);

    return [
      ...((content === '') ? [] : [{
        channel: 'content' as const,
        text: content,
      },]),
      ...((reasoning === '') ? [] : [{
        channel: 'reasoning' as const,
        text: reasoning,
      },]),
    ];
  }

  return {
    feed({ chunk, },): readonly ChannelDelta[] {
      /**
       * Everything unparsed so far, this chunk included.
       */
      const buffer = state.carry + chunk;

      /**
       * Lines in it, the last of which may be incomplete.
       */
      const lines = buffer.split('\n',);

      // Hold the trailing fragment back until its newline arrives.
      state.carry = lines[lines.length - 1] ?? '';

      return lines.slice(
        0,
        -1,
      ).flatMap(function read(line,): readonly ChannelDelta[] {
        return readLine({ line, },);
      },);
    },

    unreadableFrames(): number {
      return state.unreadable;
    },
  };
}

//endregion Stream delta scan
