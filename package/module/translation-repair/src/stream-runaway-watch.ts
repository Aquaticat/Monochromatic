import {
  type ChannelDelta,
  scanStreamDeltas,
  type StreamChannel,
} from './stream-delta-scan.ts';
import {
  type DegenerationDetector,
  watchForDegeneration,
} from './stream-degeneration.ts';

//region Stream runaway watch
// ONE THING THE DRAIN CAN CALL, so that reading a raw chunk and deciding
// whether the call has run away is a single step at the transport seam rather
// than three of them spread through the read loop.
//
// It owns the scanner and one detector per channel. Per channel, because a
// model that thinks in circles while writing a fine answer and one that writes
// in circles after thinking clearly are different failures, and pooling them
// would let either excuse the other.
//
// THE VERDICT IS A VALUE, not an exception. The drain decides what to do with
// it, which keeps the decision to end a call in the place that owns the
// connection rather than buried here.

/**
 * Decimal places the distinct ratio is reported to.
 *
 * Enough to distinguish the degenerate range, which runs near 0.001, from the
 * threshold at 0.1.
 */
const RATIO_DIGITS = 4;

/**
 * Channels watched, in the order a verdict is reported for them.
 *
 * REASONING FIRST, because a runaway there is the case that produces no answer
 * at all, so when both have gone wrong it is the more informative one to name.
 */
const WATCHED_CHANNELS: readonly StreamChannel[] = [
  'reasoning',
  'content',
];

/**
 * What the watch makes of a stream so far.
 *
 * @example
 * ```ts
 * const verdict: RunawayVerdict = { kind: 'continuing', };
 * ```
 */
export type RunawayVerdict = {
  readonly kind: 'continuing';
} | {
  readonly kind: 'runaway';

  /**
   * Channel that stopped saying anything new.
   */
  readonly channel: StreamChannel;

  /**
   * Share of its recent windows that were distinct.
   */
  readonly distinctRatio: number;

  /**
   * Characters that channel produced before the verdict, which is what the
   * call cost before it was stopped.
   */
  readonly charsSeen: number;
};

/**
 * A running watch over one call's raw stream.
 *
 * @example
 * ```ts
 * const watch = watchRunaway();
 * const verdict = watch.notifyChunk({ chunk, },);
 * ```
 */
export type RunawayWatch = {
  /**
   * Takes the next raw chunk and says whether the call has run away.
   */
  readonly notifyChunk: (input: { readonly chunk: string; },) => RunawayVerdict;

  /**
   * Payload lines the scanner could not read, which should stay at zero and is
   * worth reporting because a changed wire format would otherwise look like a
   * stream that simply produced nothing.
   */
  readonly unreadableFrames: () => number;

  /**
   * Reads how many generated characters have arrived on each channel so far.
   *
   * READS THE DETECTORS' OWN TOTALS rather than keeping a second tally: they
   * already count every character `notifyChunk` routes to them, and a
   * progress line asking the same question a second way would only invite the
   * two counts to drift.
   */
  readonly generatedChars: () => {
    readonly content: number;
    readonly reasoning: number;
  };
};

/**
 * Builds a watch that reads raw stream chunks and reports a runaway call.
 *
 * @returns Watch fed by `notifyChunk`
 *
 * @example
 * ```ts
 * const watch = watchRunaway();
 * for (const chunk of chunks) {
 *   const verdict = watch.notifyChunk({ chunk, },);
 *   if (verdict.kind === 'runaway')
 *     break;
 * }
 * ```
 */
export function watchRunaway(): RunawayWatch {
  /**
   * Turns raw server-sent events into generated text, per channel.
   */
  const scanner = scanStreamDeltas();

  /**
   * One detector per channel, judged separately.
   */
  const detectors: Record<StreamChannel, DegenerationDetector> = {
    content: watchForDegeneration(),
    reasoning: watchForDegeneration(),
  };

  /**
   * Reads whichever channel has gone wrong, if either has.
   *
   * @returns Verdict for the first watched channel that has run away
   *
   * @example
   * ```ts
   * const verdict = readChannels();
   * ```
   */
  function readChannels(): RunawayVerdict {
    /**
     * Channels reporting degeneration, in the reported order.
     */
    const failing = WATCHED_CHANNELS.flatMap(function judge(channel,): readonly RunawayVerdict[] {
      /**
       * What this channel's detector currently says.
       */
      const detector = detectors[channel];

      /**
       * What it currently says.
       */
      const verdict = detector.verdict();
      if (verdict.kind !== 'degenerate')
        return [];

      return [{
        kind: 'runaway' as const,
        channel,
        distinctRatio: verdict.distinctRatio,
        charsSeen: verdict.charsSeen,
      },];
    },);

    return failing[0] ?? { kind: 'continuing', };
  }

  return {
    notifyChunk({ chunk, },): RunawayVerdict {
      /**
       * Generated text this chunk completed, on either channel.
       */
      const deltas = scanner.feed({ chunk, },);

      deltas.forEach(function route(delta: ChannelDelta,): void {
        /**
         * Detector owning the channel this text arrived on.
         */
        const detector = detectors[delta.channel];
        detector.notifyText({ text: delta.text, },);
      },);
      return readChannels();
    },

    unreadableFrames(): number {
      return scanner.unreadableFrames();
    },

    generatedChars(): {
      readonly content: number;
      readonly reasoning: number;
    } {
      return {
        content: detectors.content
          .charsSeen(),
        reasoning: detectors.reasoning
          .charsSeen(),
      };
    },
  };
}

/**
 * Raised when a call is ended because it stopped saying anything new.
 *
 * ITS OWN CLASS, so a lost voice can be recorded with this cause rather than
 * folded in with a stall or with steering. They call for opposite responses: a
 * stall is worth retrying, and a model that has begun repeating itself will
 * repeat itself again.
 *
 * @example
 * ```ts
 * throw new StreamDegenerateError({ label, channel: 'reasoning', distinctRatio: 0.02, charsSeen: 400_000, },);
 * ```
 */
export class StreamDegenerateError extends Error {
  /**
   * Model or endpoint whose stream ran away.
   *
   * CARRIED AS A PROPERTY, not only baked into the message, for the same
   * reason `StreamCutShortError` carries it: attributing a stream to the
   * endpoint rather than the model makes a per-model figure unreadable, and
   * every chat-completions call shares one endpoint across the whole roster.
   */
  readonly label: string;

  /**
   * Channel that stopped saying anything new.
   */
  readonly channel: StreamChannel;

  /**
   * Share of recent windows that were distinct when the call was ended.
   */
  readonly distinctRatio: number;

  /**
   * Characters that channel produced before it was ended.
   */
  readonly charsSeen: number;

  /**
   * @param label - what was being called, for the message
   *
   * @param channel - channel that ran away
   *
   * @param distinctRatio - share of recent windows that were distinct
   *
   * @param charsSeen - characters produced on that channel
   *
   * @example
   * ```ts
   * const error = new StreamDegenerateError({
   *   label: 'critic',
   *   channel: 'reasoning',
   *   distinctRatio: 0.02,
   *   charsSeen: 400_000,
   * },);
   * ```
   */
  constructor(
    {
      label,
      channel,
      distinctRatio,
      charsSeen,
    }: {
      readonly label: string;
      readonly channel: StreamChannel;
      readonly distinctRatio: number;
      readonly charsSeen: number;
    },
  ) {
    super(
      `${label}: ended a runaway call, ${channel} channel repeated itself at `
        + `${distinctRatio.toFixed(RATIO_DIGITS,)} distinct over ${String(charsSeen,)} characters`,
    );
    this.name = 'StreamDegenerateError';
    this.label = label;
    this.channel = channel;
    this.distinctRatio = distinctRatio;
    this.charsSeen = charsSeen;
  }
}

//endregion Stream runaway watch
