import { wait as sleep, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Request pace
// A sliding-window pacer that lets at most `perWindow` requests START in any
// `windowMs`, queueing the rest, so a provider's request-rate limit is met by
// waiting rather than by being refused.
//
// WHY. Hyper limits this account to 1,000 requests in a rolling hour (the
// owner's figure, recorded in `hyper-client.ts`) and refuses the excess with
// HTTP 429 ("You've hit your hourly rate limit. Please try again in 1s").
// Measured on XIEPT2, 2026-09-03 00:55 to 01:39 UTC, Hyper the only provider
// left: 612 successful requests in the whole run (SPEND lines), refusals from
// 01:00:33 once the hour's thousand was spent (257 of them in this run, the
// rest in the run before it), then a trickle of 100 to 140 successes per ten
// minutes, which is the rate at which requests from an hour earlier left the
// window; 6,441 retry attempts and 1,487 calls refused five times over, every
// seat losing about half its calls, and the run ended provider-unavailable. A
// provider-wide hold on the refusal herded every call into one burst; no hold
// at all saturated the window outright. Neither is pacing. This is.
//
// A FIRST READING OF THE SAME LOG counted "completed streams" and reached
// 9,628 successes in 43 minutes; a refused exchange completes its stream too,
// so that count was successes plus refusals. The SPEND lines are the count.
//
// LIMITS. The injected `wait` is not abort-aware: a caller that aborts while
// sleeping is refused when the sleep ends, not sooner. The window starts
// empty: requests an earlier process made in the last hour are not in it, so a
// launch right after a heavy run can be refused until they leave the window;
// the retry ladder honours the refusal's own wait for that.

/**
 * Logger root for the pacer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Length of Hyper's window: a rolling hour, in milliseconds.
 */
export const HYPER_PACE_WINDOW_MS = 3_600_000;

/**
 * Environment variable overriding how many Hyper requests may start in any
 * rolling hour.
 */
export const HYPER_REQUESTS_PER_HOUR_VAR = 'TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR';

/**
 * Requests in any rolling hour the pacer allows Hyper by default: the account's
 * limit as the owner stated it and as the 2026-09-03 refusals bear out.
 */
export const HYPER_REQUESTS_PER_HOUR = 1_000;

/**
 * What a pacer offers: a turn to start one request, granted when the window
 * has room.
 *
 * @example
 * ```ts
 * const pace: RequestPace = createRequestPace({ perWindow: 1_000, windowMs: 3_600_000, },);
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
 * @param perWindow - starts allowed in any window; not positive means no
 * pacing, which is what tests and a provider without a rate limit want
 *
 * @param windowMs - window length
 *
 * @param now - clock, injectable for tests
 *
 * @param wait - sleeper, injectable for tests
 *
 * @returns Pacer
 *
 * @example
 * ```ts
 * const pace = createRequestPace({ perWindow: 1_000, windowMs: 3_600_000, },);
 * ```
 */
export function createRequestPace(
  {
    perWindow,
    windowMs,
    now = Date.now,
    wait = sleep,
  }: {
    readonly perWindow: number;
    readonly windowMs: number;
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
    const edge = now() - windowMs;
    while ((starts.length > 0) && ((starts[0] ?? edge) <= edge))
      starts.shift();
  }

  /**
   * Waits for room in the window, then records this start.
   *
   * @param signal - the caller's abort
   */
  async function admit({ signal, }: { readonly signal: AbortSignal; },): Promise<void> {
    // A caller that gave up while queued behind the chain must not take a
    // place its transport call will never use.
    signal.throwIfAborted();
    prune();
    if ((perWindow > 0) && (starts.length >= perWindow)) {
      /**
       * When the oldest start leaves the window.
       */
      const until = (starts[0] ?? now()) + windowMs;
      /**
       * How long until then.
       */
      const ms = Math.max(
        0,
        until - now(),
      );
      rl.info(`window full (${String(starts.length,)} starts in ${String(windowMs,)}ms); waiting ${String(ms,)}ms`,);
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
 * Requests per rolling hour the environment asks for, or the default.
 *
 * @param env - environment to read
 *
 * @returns Positive number from the variable, else the default
 *
 * @example
 * ```ts
 * const perHour = hyperRequestsPerHour({ env: process.env, },);
 * ```
 */
export function hyperRequestsPerHour(
  { env, }: { readonly env: Readonly<NodeJS.ProcessEnv>; },
): number {
  /**
   * Raw value when set.
   */
  const raw = env[HYPER_REQUESTS_PER_HOUR_VAR] ?? '';
  if (raw === '')
    return HYPER_REQUESTS_PER_HOUR;
  /**
   * Parsed value.
   */
  const parsed = Number(raw,);
  return (Number.isFinite(parsed,) && (parsed > 0)) ? parsed : HYPER_REQUESTS_PER_HOUR;
}

//endregion Request pace
