import { wait as sleep, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Request pace
// A sliding-window pacer that lets at most `perMinute` requests START in any
// sixty seconds, queueing the rest, so a provider's request-rate limit is met
// by waiting rather than by being refused.
//
// WHY. Hyper limits requests by rate and refuses the excess with HTTP 429
// ("You've hit your hourly rate limit. Please try again in 1s"). Measured on
// XIEPT2 on 2026-09-03 00:55 to 01:39 UTC with Hyper the only provider left:
// the pass drove 1,300 to 1,500 request attempts a minute at peak, about 700
// of which succeeded; every refusal retried four more times on the transport
// ladder, so refusals multiplied the attempts, every seat lost about half its
// calls and the run ended provider-unavailable. A provider-wide hold on the
// refusal (the morning's answer) herded every call into the next burst; no hold
// at all saturated the limit outright. Neither is pacing. This is.
//
// THE WINDOW IS MEASURED, NOT DOCUMENTED. The client's record says the account
// is limited to 1,000 requests an hour; the same run completed 9,628 requests
// in 43 minutes, so the window is shorter than the message says. Refusals began
// at about 1,000 request starts in the preceding hour and the sustained
// success rate under refusal was about 700 a minute; the default sits under
// that and the dial is there for the next measurement.

/**
 * Logger root for the pacer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Length of the sliding window, in milliseconds.
 */
export const PACE_WINDOW_MS = 60_000;

/**
 * Environment variable overriding how many Hyper requests may start a minute.
 */
export const HYPER_REQUESTS_PER_MINUTE_VAR = 'TRANSLATION_REPAIR_HYPER_REQUESTS_PER_MINUTE';

/**
 * Requests a minute the pacer allows Hyper by default: under the roughly 700 a
 * minute that succeeded while Hyper was refusing the rest on 2026-09-03.
 */
export const HYPER_REQUESTS_PER_MINUTE = 600;

/**
 * What a pacer offers: a turn to start one request, granted when the window
 * has room.
 *
 * @example
 * ```ts
 * const pace: RequestPace = createRequestPace({ perMinute: 600, },);
 * await pace.take({ signal, },);
 * ```
 */
export type RequestPace = {
  /**
   * Waits until one more request may start inside the window, then records
   * the start.
   *
   * @throws The signal's reason when the caller aborts while waiting
   */
  readonly take: (input: { readonly signal: AbortSignal; }) => Promise<void>;

  /**
   * How many starts the window currently holds.
   */
  readonly inWindow: () => number;
};

/**
 * Builds a pacer over a sliding window.
 *
 * TAKES ARE SERIALISED through one promise chain, so two calls arriving
 * together cannot both read a window with one free place and both start.
 *
 * @param perMinute - starts allowed in any sixty seconds; not positive means
 * no pacing, which is what tests and a provider without a rate limit want
 *
 * @param now - clock, injectable for tests
 *
 * @param wait - sleeper, injectable for tests
 *
 * @returns Pacer
 *
 * @example
 * ```ts
 * const pace = createRequestPace({ perMinute: 600, },);
 * ```
 */
export function createRequestPace(
  {
    perMinute,
    now = Date.now,
    wait = sleep,
  }: {
    readonly perMinute: number;
    readonly now?: () => number;
    readonly wait?: (ms: number,) => Promise<void>;
  },
): RequestPace {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: createRequestPace.name,
    l,
  },);
  /**
   * Start times inside the window, oldest first.
   */
  const starts: number[] = [];
  /**
   * The chain every take joins, so takes resolve in arrival order.
   */
  const turn: { current: Promise<void>; } = { current: Promise.resolve(), };

  /**
   * Drops starts that have left the window.
   */
  function prune(): void {
    /**
     * Oldest moment still inside the window.
     */
    const edge = now() - PACE_WINDOW_MS;
    while ((starts.length > 0) && ((starts[0] ?? edge) <= edge))
      starts.shift();
  }

  /**
   * Waits for room in the window, then records this start.
   *
   * @param signal - the caller's abort
   */
  async function admit({ signal, }: { readonly signal: AbortSignal; },): Promise<void> {
    prune();
    if ((perMinute > 0) && (starts.length >= perMinute)) {
      /**
       * When the oldest start leaves the window.
       */
      const until = (starts[0] ?? now()) + PACE_WINDOW_MS;
      /**
       * How long until then.
       */
      const ms = Math.max(
        0,
        until - now(),
      );
      rl.info(`window full (${String(starts.length,)} starts in ${String(PACE_WINDOW_MS,)}ms); waiting ${String(ms,)}ms`,);
      await wait(ms,);
      signal.throwIfAborted();
      prune();
    }
    starts.push(now(),);
  }

  return {
    take: async function take({ signal, },): Promise<void> {
      signal.throwIfAborted();
      /**
       * The take ahead of this one.
       */
      const previous = turn.current;
      /**
       * This take, queued behind it.
       */
      const mine = (async function queued(): Promise<void> {
        await previous;
        await admit({ signal, },);
      })();
      turn.current = (async function settled(): Promise<void> {
        try {
          await mine;
        } catch (error) {
          rl.debug(`a take ended with ${String(error,)}; the chain continues`,);
        }
      })();
      await mine;
    },
    inWindow: function inWindow(): number {
      prune();
      return starts.length;
    },
  };
}

/**
 * Requests a minute the environment asks for, or the default.
 *
 * @param env - environment to read
 *
 * @returns Positive number from the variable, else the default
 *
 * @example
 * ```ts
 * const perMinute = hyperRequestsPerMinute({ env: process.env, },);
 * ```
 */
export function hyperRequestsPerMinute(
  { env, }: { readonly env: Readonly<NodeJS.ProcessEnv>; },
): number {
  /**
   * Raw value when set.
   */
  const raw = env[HYPER_REQUESTS_PER_MINUTE_VAR] ?? '';
  if (raw === '')
    return HYPER_REQUESTS_PER_MINUTE;
  /**
   * Parsed value.
   */
  const parsed = Number(raw,);
  return (Number.isFinite(parsed,) && (parsed > 0)) ? parsed : HYPER_REQUESTS_PER_MINUTE;
}

//endregion Request pace
