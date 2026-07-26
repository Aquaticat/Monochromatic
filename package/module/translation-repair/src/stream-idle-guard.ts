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
 * Silence allowed before the first body byte. Generous on purpose: this window
 * also covers the model ingesting a large prompt, which produces no output yet
 * is real work. It stays under the per-call total deadline so the guard, not
 * the deadline, is what normally fires.
 */
export const STREAM_FIRST_BYTE_MS = 150_000;

/**
 * Silence allowed between body bytes once the stream is flowing. A token
 * stream that has gone a full minute without emitting anything is stalled
 * rather than thinking.
 *
 * Chosen conservatively rather than measured: nothing recorded inter-chunk gaps
 * before this module existed, because the transport drained the whole body as
 * text in one call. {@link StreamProgress} is logged on every exchange so the
 * observed distribution can tighten this.
 */
export const STREAM_IDLE_MS = 60_000;

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
