import { setTimeout as sleepFor, } from 'node:timers/promises';

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
// CLASS ONE HUNDRED FORTY-NINE (hulicaijia30, 2026-09-26). The pass spent the
// hour's thousand starts between 07:31 and 08:04 UTC, and at 08:04:20 one take
// slept 1,640,012 ms until the first start left the window. Takes then ran
// through one promise chain and the sleep did not hear an abort, so every Hyper
// call behind it waited too, and the 360 s call deadlines that fired at about
// 08:10 were only read at 08:31:40, when the sleep ended: eight translate
// slices stalled 27 to 34 minutes and the entry took 100.6 minutes. Each take
// now RESERVES its start at once, in arrival order, and waits for it on its
// own abortable timer: a caller that gives up leaves at once and hands its
// place back. `waitMs` says how long a take would wait, which the router reads
// to send the call to a provider that can start it now.
//
// LIMITS. The window starts empty: requests an earlier process made in the
// last hour are not in it, so a launch right after a heavy run can be refused
// until they leave the window; the retry ladder honours the refusal's own
// wait for that. A place handed back does not move later reservations
// earlier; they start on their own time, which never exceeds the rate.

/**
 Logger root for the pacer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 Length of Hyper's window: a rolling hour, in milliseconds.
 */
export const HYPER_PACE_WINDOW_MS = 3_600_000;

/**
 Environment variable overriding how many Hyper requests may start in any
 rolling hour.
 */
export const HYPER_REQUESTS_PER_HOUR_VAR = 'TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR';

/**
 Requests in any rolling hour the pacer allows Hyper by default: the account's
 limit as the owner stated it and as the 2026-09-03 refusals bear out.
 */
export const HYPER_REQUESTS_PER_HOUR = 1_000;

/**
 What a pacer offers: a turn to start one request, granted when the window
 has room, and a reading of how long that turn is away.
 
 @example
 ```ts
 const pace: RequestPace = createRequestPace({ perWindow: 1_000, windowMs: 3_600_000, },);
 await pace.take({ signal, },);
 ```
 */
export type RequestPace = {
  /**
   Reserves one start inside the window and waits until it comes.
   
   @throws The signal's reason when the caller aborts while waiting
   */
  readonly take: (input: { readonly signal: AbortSignal; }) => Promise<void>;

  /**
   How many starts the window holds that have already happened.
   */
  readonly inWindow: () => number;

  /**
   How long a take made now would wait, zero while the window has room.
   */
  readonly waitMs: () => number;
};

/**
 Sleeps the given milliseconds unless the caller aborts first.
 
 @param ms - how long to sleep
 
 @param signal - caller's abort, which ends the sleep at once
 
 @throws The timer's abort error when the caller gives up
 
 @example
 ```ts
 await abortableSleep({ ms: 1_000, signal, },);
 ```
 */
async function abortableSleep(
  {
    ms,
    signal,
  }: {
    readonly ms: number;
    readonly signal: AbortSignal;
  },
): Promise<void> {
  await sleepFor(
    ms,
    undefined,
    { signal, },
  );
}

/**
 Builds a pacer over a sliding window.
 
 A TAKE RESERVES ITS START WITHOUT AWAITING ANYTHING, so two calls arriving
 together cannot both read a window with one free place and both start, and
 no caller ever waits behind another caller's wait.
 
 @param perWindow - starts allowed in any window; not positive means no
 pacing, which is what tests and a provider without a rate limit want
 
 @param windowMs - window length
 
 @param now - clock, injectable for tests
 
 @param wait - sleeper that must end when the signal aborts, injectable for
 tests
 
 @returns Pacer
 
 @example
 ```ts
 const pace = createRequestPace({ perWindow: 1_000, windowMs: 3_600_000, },);
 ```
 */
export function createRequestPace(
  {
    perWindow,
    windowMs,
    now = Date.now,
    wait = abortableSleep,
  }: {
    readonly perWindow: number;
    readonly windowMs: number;
    readonly now?: () => number;
    readonly wait?: (
      args: {
        readonly ms: number;
        readonly signal: AbortSignal;
      },
    ) => Promise<void>;
  },
): RequestPace {
  /**
   Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: createRequestPace.name,
    l,
  },);
  /**
   Start times inside the window, past and reserved, oldest first.
   */
  const starts: number[] = [];

  /**
   Drops starts that have left the window.
   */
  function prune(): void {
    /**
     Oldest moment still inside the window.
     */
    const edge = now() - windowMs;
    while ((starts.length > 0) && ((starts[0] ?? edge) <= edge))
      starts.shift();
  }

  /**
   When the next start may happen: now while the window has room, else when
   the start `perWindow` places back leaves the window.
   
   @returns Moment of the next free place
   */
  function nextFreeAt(): number {
    prune();
    if ((perWindow <= 0) || (starts.length < perWindow))
      return now();
    return Math.max(
      now(),
      (starts[starts.length - perWindow] ?? now()) + windowMs,
    );
  }

  /**
   Hands a reserved place back when its caller gave up.
   
   @param at - the place's start time
   */
  function release(at: number,): void {
    /**
     Where the place sits; reservations at one moment are interchangeable.
     */
    const index = starts.lastIndexOf(at,);
    if (index !== (-1))
      starts.splice(
        index,
        1,
      );
  }

  return {
    take: async function take({ signal, },): Promise<void> {
      signal.throwIfAborted();
      /**
       Start this take reserves.
       */
      const at = nextFreeAt();
      /**
       Starts the window holds, reservations included, before this one.
       */
      const held = starts.length;
      starts.push(at,);
      /**
       How long until the reserved start.
       */
      const ms = at - now();
      if (ms <= 0)
        return;
      rl.info(`window full (${String(held,)} starts in ${String(windowMs,)}ms); waiting ${String(ms,)}ms`,);
      try {
        await wait({
          ms,
          signal,
        },);
      } catch (error) {
        release(at,);
        signal.throwIfAborted();
        throw error;
      }
      if (signal.aborted) {
        release(at,);
        signal.throwIfAborted();
      }
    },
    inWindow: function inWindow(): number {
      prune();
      /**
       Moment the count is read at.
       */
      const moment = now();
      return starts
        .filter(function started(start,): boolean {
          return start <= moment;
        },)
        .length;
    },
    waitMs: function waitMs(): number {
      return Math.max(
        0,
        nextFreeAt() - now(),
      );
    },
  };
}

/**
 Requests per rolling hour the environment asks for, or the default.
 
 @param env - environment to read
 
 @returns Positive number from the variable, else the default
 
 @example
 ```ts
 const perHour = hyperRequestsPerHour({ env: process.env, },);
 ```
 */
export function hyperRequestsPerHour(
  { env, }: { readonly env: Readonly<NodeJS.ProcessEnv>; },
): number {
  /**
   Raw value when set.
   */
  const raw = env[HYPER_REQUESTS_PER_HOUR_VAR] ?? '';
  if (raw === '')
    return HYPER_REQUESTS_PER_HOUR;
  /**
   Parsed value.
   */
  const parsed = Number(raw,);
  return (Number.isFinite(parsed,) && (parsed > 0)) ? parsed : HYPER_REQUESTS_PER_HOUR;
}

//endregion Request pace
