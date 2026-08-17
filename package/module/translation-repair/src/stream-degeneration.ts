//region Stream degeneration
// WHETHER A MODEL HAS STOPPED SAYING ANYTHING NEW, which is a different failure
// from the one `stream-idle-guard.ts` watches for and is invisible to it.
//
// The idle guard asks whether bytes are arriving. A degenerating model answers
// yes forever: it emits continuously, at full speed, repeating itself. Measured
// over 1677 completed streams in the 2026-08-17 pass, the largest streams ran
// with gaps of 202 to 858 ms and only 61 streams paused longer than 5 s, so no
// silence window can separate a degenerating stream from a working one. Both
// idle constants are set to 600000 precisely because silence does not
// discriminate here.
//
// THE PROVIDER DOES NOT STOP THESE CALLS, and no production stage sends a token
// cap, so nothing upstream ends them either. The only remaining place to end
// them is here.
//
// WHAT IS MEASURED is the share of recent windows of text that are distinct. A
// model producing prose emits almost entirely fresh windows; one cycling on a
// phrase emits the same few windows forever. The measure is taken over a
// TRAILING sample rather than the whole stream, so a reply that degenerates
// after a healthy opening is still caught rather than diluted by its own good
// beginning.
//
// THIS MODULE KNOWS NOTHING ABOUT THE WIRE FORMAT. It is fed generated text.
// Feeding it raw server-sent events would report every healthy stream as
// degenerate, because the JSON envelope around each token is identical by
// construction and would dominate the sample.

/**
 * Width of one sampled window, in characters.
 *
 * Wide enough that ordinary prose almost never repeats a whole window by
 * chance, and narrow enough that a short repeated phrase still fills several.
 */
const WINDOW_CHARS = 64;

/**
 * Distance between the starts of consecutive sampled windows.
 *
 * Half a window, so every position is covered by a sample without paying for a
 * sample at every character.
 */
const WINDOW_STRIDE = 32;

/**
 * Windows kept in the trailing sample, which at the stride above is about 64000
 * characters of recent text.
 *
 * TRAILING RATHER THAN CUMULATIVE so late-onset degeneration is caught. A
 * cumulative ratio over a reply that ran healthy for a long time cannot fall
 * far enough to trip, no matter how long it then cycles.
 */
const TRAILING_WINDOWS = 2_048;

/**
 * Windows required before any verdict is offered.
 *
 * A short reply has too few windows for the ratio to mean anything, and a
 * legitimate one that happens to open with a repeated heading would trip
 * instantly without this.
 */
const MIN_WINDOWS_FOR_VERDICT = 512;

/**
 * Share of distinct windows at or below which the sample is called degenerate.
 *
 * SET WITH A WIDE MARGIN, deliberately. Scanned across all 56 settled
 * artifacts, the most repetitive real string scored 0.998 distinct, and a
 * synthetic control repeating one phrase scored 0.010. Nothing observed lies
 * between 0.1 and 0.99, so this threshold is placed in empty space rather than
 * fitted to a boundary.
 */
const DEGENERATE_RATIO = 0.1;

/**
 * What the detector currently believes about a stream.
 *
 * A TAGGED UNION rather than a boolean plus numbers, because "not enough text
 * to say" and "enough text, and it looks fine" are different answers and a
 * caller that conflates them would abort short replies or trust empty ones.
 *
 * @example
 * ```ts
 * const verdict: DegenerationVerdict = { kind: 'undecided', windows: 12, };
 * ```
 */
export type DegenerationVerdict = {
  readonly kind: 'undecided';

  /**
   * Windows sampled so far, so a caller can say how far off a verdict is.
   */
  readonly windows: number;
} | {
  readonly kind: 'healthy';

  /**
   * Share of the trailing sample that was distinct.
   */
  readonly distinctRatio: number;

  /**
   * Windows the ratio was taken over.
   */
  readonly windows: number;
} | {
  readonly kind: 'degenerate';

  /**
   * Share of the trailing sample that was distinct, at or below
   * `DEGENERATE_RATIO`.
   */
  readonly distinctRatio: number;

  /**
   * Windows the ratio was taken over.
   */
  readonly windows: number;

  /**
   * Characters of generated text seen before the verdict, so the cost of
   * letting it run this far is legible in the log.
   */
  readonly charsSeen: number;
};

/**
 * A running detector over one stream's generated text.
 *
 * @example
 * ```ts
 * const detector = watchForDegeneration();
 * detector.notifyText({ text: 'The cat naps. ', },);
 * const verdict = detector.verdict();
 * ```
 */
export type DegenerationDetector = {
  /**
   * Feeds newly generated text, in arrival order.
   */
  readonly notifyText: (input: { readonly text: string; },) => void;

  /**
   * Reads what the trailing sample currently says.
   */
  readonly verdict: () => DegenerationVerdict;
};

/**
 * Builds a detector that reports when a stream has stopped producing new text.
 *
 * ONE LINEAR PASS AND BOUNDED MEMORY, per `RG2`: every character is examined a
 * fixed number of times, and the sample never grows past `TRAILING_WINDOWS`
 * entries regardless of how long the stream runs, which matters precisely
 * because the streams this exists to stop are the ones that never end.
 *
 * NO REGEX, per `RG1`: the rule is "take a fixed-width slice every fixed number
 * of characters", which slicing states directly.
 *
 * @returns Detector fed by `notifyText` and read by `verdict`
 *
 * @example
 * ```ts
 * const detector = watchForDegeneration();
 * for (const chunk of chunks)
 *   detector.notifyText({ text: chunk, },);
 * if (detector.verdict().kind === 'degenerate')
 *   throw new Error('the model is cycling',);
 * ```
 */
export function watchForDegeneration(): DegenerationDetector {
  /**
   * Text not yet consumed into a window, plus the running totals.
   *
   * A RECORD RATHER THAN LOOSE BINDINGS so the factory root holds no mutable
   * variable, and so every piece of the detector's state is named in one place.
   */
  const state = {
    pending: '',
    charsSeen: 0,
  };

  /**
   * Windows in the trailing sample, oldest first, so the oldest can be evicted
   * when the sample is full.
   */
  const order: string[] = [];

  /**
   * How many times each window appears in `order`.
   *
   * Counted rather than merely present, because eviction must know when the
   * last copy of a window has left the sample.
   */
  const counts = new Map<string, number>();

  /**
   * Drops the oldest window from the sample, keeping `counts` in step.
   *
   * @example
   * ```ts
   * evictOldest();
   * ```
   */
  function evictOldest(): void {
    /**
     * Window leaving the sample.
     */
    const gone = order.shift();
    if (gone === undefined)
      return;

    /**
     * Copies of it that remain after this one leaves.
     */
    const left = (counts.get(gone,) ?? 1) - 1;
    if (left <= 0)
      counts.delete(gone,);
    else
      counts.set(
        gone,
        left,
      );
  }

  /**
   * Adds one sampled window to the trailing sample.
   *
   * @param window - fixed-width slice of generated text
   *
   * @example
   * ```ts
   * admit({ window: 'the cat naps on the mat', },);
   * ```
   */
  function admit({ window, }: { readonly window: string; },): void {
    order.push(window,);
    counts.set(
      window,
      (counts.get(window,) ?? 0) + 1,
    );
    if (order.length > TRAILING_WINDOWS)
      evictOldest();
  }

  return {
    notifyText({ text, },): void {
      if (text === '')
        return;
      state.charsSeen += text.length;

      /**
       * Everything not yet cut into windows, this arrival included.
       */
      const buffer = state.pending + text;

      /**
       * Cursor over the buffer, advanced one stride per window taken.
       */
      const cut = { at: 0, };
      while ((cut.at + WINDOW_CHARS) <= buffer.length) {
        admit({
          window: buffer.slice(
            cut.at,
            cut.at + WINDOW_CHARS,
          ),
        },);
        cut.at += WINDOW_STRIDE;
      }

      // Keep only what a later window might still need, so the buffer cannot
      // grow with the stream.
      state.pending = buffer.slice(cut.at,);
    },

    verdict(): DegenerationVerdict {
      /**
       * Windows currently in the trailing sample.
       */
      const windows = order.length;
      if (windows < MIN_WINDOWS_FOR_VERDICT)
        return {
          kind: 'undecided',
          windows,
        };

      /**
       * Share of the sample that is distinct.
       */
      const distinctRatio = counts.size / windows;
      if (distinctRatio > DEGENERATE_RATIO)
        return {
          kind: 'healthy',
          distinctRatio,
          windows,
        };

      return {
        kind: 'degenerate',
        distinctRatio,
        windows,
        charsSeen: state.charsSeen,
      };
    },
  };
}

//endregion Stream degeneration
