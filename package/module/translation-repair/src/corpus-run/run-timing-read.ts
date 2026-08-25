import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  type CallTiming,
  readCallTiming,
  readRoundTiming,
  type RoundTiming,
} from './run-timing-parse.ts';

//region Run timing read
// Turns a log's timing lines into the two answers `#215` was opened to make
// possible: how much of a run's wall-clock went into waiting on stragglers,
// and how many calls were actually in flight at once.
//
// ACHIEVED CONCURRENCY IS AN OVERLAP COUNT, not an average of anything. Each
// call occupies `[endedAt - elapsedMs, endedAt]`, and sweeping those endpoints
// in order gives the exact number in flight at every instant. Before `#215` a
// completion line said only when a call ended, so no interval existed to
// overlap and the question had no answer at all.

/**
 * Everything a log said about how a run spent its time.
 *
 * @example
 * ```ts
 * const reading: RunTiming = readRunTiming({ lines, },);
 * ```
 */
export type RunTiming = {
  /**
   * Every round the log reported, in the order it reported them.
   */
  readonly rounds: readonly RoundTiming[];

  /**
   * Every call whose line carried a duration.
   */
  readonly calls: readonly CallTiming[];

  /**
   * Completion lines that carried no `elapsed` field, which is every one in a
   * log written before `#215`. A concurrency computed while this is above zero
   * describes only the calls that happened to be readable.
   */
  readonly callsWithoutDuration: number;
};

/**
 * One endpoint of a call's interval, as the sweep sees it.
 *
 * NAMED RATHER THAN A PAIR. A tuple of two numbers at a boundary where both are
 * numbers invites reading them in the wrong order, and the sort depends on
 * which is which.
 *
 * @example
 * ```ts
 * const opens: SweepEvent = { at: 1_760_000_000_000, delta: 1, };
 * ```
 */
type SweepEvent = {
  /**
   * Instant this endpoint falls at.
   *
   * NOT NAMED `at`, which would sit one character from the `Array.at` calls
   * that produce these very events and read as the same thing.
   */
  readonly instant: number;

  /**
   * Change in calls in flight: `1` where one starts, `-1` where one ends.
   */
  readonly delta: number;
};

/**
 * How many calls a run had in flight, and over what span.
 *
 * @example
 * ```ts
 * const flight: InFlight = measureInFlight({ calls, },);
 * ```
 */
export type InFlight = {
  /**
   * Wall-clock from the first call's start to the last call's end.
   */
  readonly spanMs: number;

  /**
   * Summed call durations, which exceeds the span exactly when calls overlap.
   */
  readonly busyMs: number;

  /**
   * Time-weighted mean number of calls in flight across the span.
   */
  readonly meanInFlight: number;

  /**
   * Largest number of calls in flight at any one instant.
   */
  readonly peakInFlight: number;
};

/**
 * Reads every timing line out of a log.
 *
 * @param lines - log lines, in the order they were written
 *
 * @returns Rounds, calls, and how many calls could not be timed
 *
 * @example
 * ```ts
 * const reading = readRunTiming({ lines: text.split('\n',), },);
 * ```
 */
export function readRunTiming(
  { lines, }: { readonly lines: readonly string[]; },
): RunTiming {
  /**
   * Accumulators filled by one pass, since a line is at most one of the two
   * shapes and reading the log twice would double the work for nothing.
   */
  const found = {
    rounds: [] as RoundTiming[],
    calls: [] as CallTiming[],
    untimed: 0,
  };

  for (const line of lines) {
    /**
     * What this line turned out to say about a round.
     */
    const round = readRoundTiming({ line, },);
    if (round.kind === 'round') {
      found
        .rounds
        .push(round.round,);
      continue;
    }

    // ONE READ DECIDES ALL THREE OUTCOMES. The parse already separates a
    // completion carrying a duration from one that predates `#215` and from a
    // line that is not a completion at all, so nothing here re-inspects the
    // text to tell them apart.
    /**
     * What this line turned out to say about a call.
     */
    const call = readCallTiming({ line, },);
    if (call.kind === 'timed') {
      found
        .calls
        .push(call.call,);
      continue;
    }
    if (call.kind === 'untimed')
      found.untimed += 1;
  }

  return {
    rounds: found.rounds,
    calls: found.calls,
    callsWithoutDuration: found.untimed,
  };
}

/**
 * Counts how many calls were in flight across a run.
 *
 * SWEEPS ENDPOINTS rather than sampling a grid: a grid coarse enough to be
 * cheap misses every burst shorter than its step, and the peak is exactly the
 * thing a burst carries.
 *
 * @param calls - every call whose line carried a duration
 *
 * @returns Span, busy time, and the mean and peak in flight
 *
 * @throws Error when no call can be timed, since every figure would be a
 * division by an empty span
 *
 * @example
 * ```ts
 * const flight = measureInFlight({ calls, },);
 * ```
 */
export function measureInFlight(
  { calls, }: { readonly calls: readonly CallTiming[]; },
): InFlight {
  if (calls.length === 0)
    throw new Error('no call in this log carried a duration, so nothing can be counted in flight',);

  /**
   * One entry per endpoint: `1` where a call starts, `-1` where it ends.
   *
   * Sorted with ENDS ahead of STARTS at the same instant, which is what keeps
   * two calls that merely abut from counting as one overlap: the earlier call
   * is subtracted before the later one is added.
   */
  const events = calls
    .flatMap(function endpoints(call,): readonly SweepEvent[] {
      return [
        {
          instant: call.endedAt - call.elapsedMs,
          delta: 1,
        },
        {
          instant: call.endedAt,
          delta: -1,
        },
      ];
    },)
    .toSorted(function byInstant(
      left,
      right,
    ): number {
      return (left.instant - right.instant) || (left.delta - right.delta);
    },);

  /**
   * First endpoint, which exists because the call list was checked non-empty
   * above and every call contributes two.
   */
  const opening = nonNullishOrThrow(events[0],);

  /**
   * Last endpoint, likewise: two per call, and the call list is not empty.
   */
  const closing = nonNullishOrThrow(events.at(-1,),);

  /**
   * Sweep state: how many are live now, the highest seen, and the running
   * time-weighted total.
   */
  const sweep = {
    live: 0,
    peak: 0,
    weighted: 0,
    lastInstant: opening.instant,
  };

  for (const event of events) {
    sweep.weighted += sweep.live * (event.instant - sweep.lastInstant);
    sweep.lastInstant = event.instant;
    sweep.live += event.delta;
    if (sweep.live > sweep.peak)
      sweep.peak = sweep.live;
  }

  /**
   * First start and last end, which bound the whole run.
   */
  const spanMs = closing.instant - opening.instant;

  /**
   * Summed durations, which is what the span is compared against.
   */
  const busyMs = calls.reduce(
    function addCall(
      total,
      call,
    ): number {
      return total + call.elapsedMs;
    },
    0,
  );

  return {
    spanMs,
    busyMs,
    meanInFlight: (spanMs === 0) ? calls.length : (sweep.weighted / spanMs),
    peakInFlight: sweep.peak,
  };
}

//endregion Run timing read
