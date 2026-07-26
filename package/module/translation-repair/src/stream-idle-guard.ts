import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Stream idle guard
// Distinguishes a dead stream from a long one, which a total-duration deadline
// cannot do.
//
// Measured on the twelve pass-7 corpus logs: 14 stage rounds of 417 expired at
// the 240 s per-call deadline, and every one of them lost 4, 5, 6, or 7 of its
// 7 voices at once, never just one or two. Model-specific slowness does not
// have that shape. The retry settles it: of 13 retry rounds, 12 recovered a
// full 7/7 in 27 to 233 s, median 88 s, so the very voices that could not
// answer inside 240 s answered inside 88 s on a fresh dispatch. The wait was
// not buying generation progress, so a LARGER total deadline would only scale
// the waste; what is needed is noticing that nothing is arriving.
//
// An idle guard aborts on silence rather than on elapsed time, so a healthy
// long generation runs as long as it keeps emitting while a stalled one is cut
// early. Because the abort fires on a locally owned controller and never on the
// caller's signal, `attemptExchange` sees a non-abort failure and
// `exchangeWithRetry` retries it at transport level on a ~1 s backoff, instead
// of the stall escalating into another whole stage round.

/**
 * Silence allowed before the first body byte.
 *
 * A sentinel probe logged six healthy calls reaching first byte at 84, 104,
 * 122, 132, 135, and 147 seconds. Those six are a CENSORED SAMPLE, not the
 * healthy range: the drain only logged an exchange whose first byte passed the
 * then-active 60 s notability threshold, so everything faster is missing by
 * construction. Pass-7 stage rounds independently confirm faster calls exist,
 * since a stage ends only when its slowest voice returns and the tenth
 * percentile of succeeding rounds is 9 seconds, which no 84 s first byte
 * allows.
 *
 * What the six do establish is that the healthy tail reaches at least 147 s.
 * An earlier 150 s value here would have killed that call with under 3 seconds
 * to spare, so this sits just under the 240 s total deadline instead. How much
 * further the healthy tail runs is UNKNOWN, and until it is known nobody can
 * say whether 240 s cuts into real work; the phase recorded in
 * {@link StreamStalledError} is what will settle whether the observed stalls
 * are first-byte or mid-stream.
 */
export const STREAM_FIRST_BYTE_MS = 210_000;

/**
 * Silence allowed between body bytes once the stream is flowing.
 *
 * This is where the guard can discriminate. Across six probe streams carrying
 * up to 745_015 characters, the largest gap between chunks was 733 ms, and four
 * of the six stayed under 130 ms: once a body starts it does not pause. Thirty
 * seconds is roughly forty times the worst observed gap, so it cannot plausibly
 * fire on a healthy stream, while catching a mid-stream death eight times
 * sooner than the total deadline would.
 *
 * Note what that evidence does and does not cover: those gaps come from streams
 * that SUCCEEDED, so they bound healthy behavior and say nothing about how a
 * dying stream behaves. If the real failure mode turns out to be first-byte
 * silence rather than mid-stream death, this window never fires and the guard
 * leaves the timeout cost untouched. Six streams from one entry is also a small
 * sample; every exchange past the notable thresholds logs its
 * {@link StreamProgress}, so this can tighten as the distribution fills in.
 */
export const STREAM_IDLE_MS = 30_000;

/**
 * Logger root for the stream guard.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Raised when a stream produced no bytes for longer than its idle window.
 * Distinct from a caller abort so the retry layer treats it as transient
 * weather and re-dispatches, which is the response the measurements support.
 *
 * @example
 * ```ts
 * throw new StreamStalledError({ label: 'hf:model', idleMs: 60_000, phase: 'body', },);
 * ```
 */
export class StreamStalledError extends Error {
  /**
   * Builds the stalled-stream failure.
   *
   * @param label - names the stalled call
   *
   * @param idleMs - silence window that expired
   *
   * @param phase - whether the silence preceded the first byte or interrupted
   * a flowing stream
   */
  constructor(
    {
      label,
      idleMs,
      phase,
    }: {
      readonly label: string;
      readonly idleMs: number;
      readonly phase: 'first-byte' | 'body';
    },
  ) {
    super(
      `Stalled: ${label} emitted nothing for ${String(idleMs,)}ms (${phase})`,
    );
    this.name = 'StreamStalledError';
  }
}

/**
 * What one drained stream did over time, for tuning the idle windows.
 *
 * @example
 * ```ts
 * const progress: StreamProgress = { firstByteMs: 812, maxGapMs: 43, chars: 9_211, };
 * ```
 */
export type StreamProgress = {
  /**
   * Milliseconds from arming to the first body byte; negative when no byte
   * ever arrived, which is itself the diagnostic.
   */
  readonly firstByteMs: number;

  /**
   * Longest silence observed between consecutive body chunks.
   */
  readonly maxGapMs: number;

  /**
   * Total decoded characters received.
   */
  readonly chars: number;
};

/**
 * Live guard over one exchange: a signal to hand the request, an activity
 * notification to call per chunk, and the progress it observed.
 */
export type IdleGuard = Disposable & {
  /**
   * Signal that aborts when the idle window expires; its abort reason is the
   * {@link StreamStalledError} describing which window expired.
   */
  readonly signal: AbortSignal;

  /**
   * Records that bytes arrived, resetting the idle window.
   */
  readonly notify: (chars: number,) => void;

  /**
   * Snapshot of what the stream has done so far.
   */
  readonly progress: () => StreamProgress;
};

/**
 * Arms an idle guard. Arm it BEFORE the request so the window also covers a
 * provider that never sends response headers at all, which a body-only guard
 * would miss entirely.
 *
 * @param label - names the call in the stall error
 *
 * @param firstByteMs - silence allowed before first byte
 *
 * @param idleMs - silence allowed between bytes afterwards
 *
 * @returns Guard whose disposal clears its timer
 *
 * @example
 * ```ts
 * using guard = armIdleGuard({ label: modelId, },);
 * ```
 */
export function armIdleGuard(
  {
    label,
    firstByteMs = STREAM_FIRST_BYTE_MS,
    idleMs = STREAM_IDLE_MS,
  }: {
    readonly label: string;
    readonly firstByteMs?: number;
    readonly idleMs?: number;
  },
): IdleGuard {
  /**
   * Controller aborted when silence outlasts the current window.
   */
  const controller = new AbortController();

  /**
   * Stream bookkeeping, held in one named record so no binding at function
   * root has to be reassignable.
   */
  const state = {
    armedAt: Date.now(),
    lastChunkAt: 0,
    firstByteMs: -1,
    maxGapMs: 0,
    chars: 0,
  };

  /**
   * Aborts the exchange, naming which silence window expired. The abort reason
   * carries the error so the transport can rethrow it instead of the opaque
   * abort the platform would otherwise surface.
   *
   * @param phase - which window expired
   *
   * @param expiredMs - that window's length
   */
  function trip(
    {
      phase,
      expiredMs,
    }: {
      readonly phase: 'first-byte' | 'body';
      readonly expiredMs: number;
    },
  ): void {
    tagged({
      tag: armIdleGuard.name,
      l,
    },)
      .warn(
        `${label}: no bytes for ${String(expiredMs,)}ms during ${phase}`
        + ` after ${String(state.chars,)} chars; aborting for retry`,
      );
    controller.abort(new StreamStalledError({
      label,
      idleMs: expiredMs,
      phase,
    },),);
  }

  /**
   * Starts one silence window, returning its timer handle.
   *
   * @param phase - window being armed
   *
   * @param windowMs - silence allowed before tripping
   *
   * @returns Timer handle to clear when activity arrives
   */
  function armWindow(
    {
      phase,
      windowMs,
    }: {
      readonly phase: 'first-byte' | 'body';
      readonly windowMs: number;
    },
  ): ReturnType<typeof setTimeout> {
    return setTimeout(
      function onSilence() {
        trip({
          phase,
          expiredMs: windowMs,
        },);
      },
      windowMs,
    );
  }

  /**
   * Timer handle of the currently armed window, replaced on every chunk.
   */
  const timers = {
    handle: armWindow({
      phase: 'first-byte',
      windowMs: firstByteMs,
    },),
  };

  return {
    signal: controller.signal,
    notify(chars: number,): void {
      /**
       * When this chunk landed, for gap bookkeeping.
       */
      const now = Date.now();
      if (state.firstByteMs < 0)
        state.firstByteMs = now - state.armedAt;
      else
        state.maxGapMs = Math.max(
          state.maxGapMs,
          now - state.lastChunkAt,
        );
      state.lastChunkAt = now;
      state.chars += chars;
      clearTimeout(timers.handle,);
      timers.handle = armWindow({
        phase: 'body',
        windowMs: idleMs,
      },);
    },
    progress(): StreamProgress {
      return {
        firstByteMs: state.firstByteMs,
        maxGapMs: state.maxGapMs,
        chars: state.chars,
      };
    },
    [Symbol.dispose](): void {
      clearTimeout(timers.handle,);
    },
  };
}

//endregion Stream idle guard
