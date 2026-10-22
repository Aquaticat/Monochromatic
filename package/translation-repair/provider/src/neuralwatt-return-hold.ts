import {
  MS_PER_DAY,
  neuralWattDayStartOfInstant,
} from './neuralwatt-day.ts';
import type { NeuralWattEnergy, } from './neuralwatt-energy.ts';
import { neuralWattIsDry, } from './neuralwatt-meter.ts';

//region NeuralWatt return hold
// HOW LONG UNTIL A SPENT NEURALWATT DAY STARTS AGAIN, and whether that is near enough to wait for. The case is XingZ6019
// (2026-10-22): NeuralWatt dry at 19:14:20 UTC because the day's 550 Wh was spent, its day restarting at 19:15:08 UTC, 48 s
// later; the bench stood short of its floor and the entry stopped 48 s before the energy came back. A NeuralWatt dry
// reading now carries its return as a hold (`provider-budget.ts`), so every wait that already waits out holds waits for it.
//
// THE DAY STARTS AT A TIME OF DAY IN UTC (`neuralwatt-day.ts`), and a UTC day is exactly 24 hours, so the distance is the
// clock's time of day to the day start's time of day, around midnight where it must be. No instant of the wall clock is
// read as a number (`source-scan/src/wall-clock-reads.unit.test.ts`), and no calendar is needed.

/**
 The longest return this run waits for: five minutes.

 NO BOUND ON A WAIT EXISTED TO REUSE. A hold the budget layer places on a refusal lasts at most `REFUSAL_COOLDOWN_MS`
 (300 s, `provider-budget.ts`) unless the refusal names a longer wait, which is then waited for whatever it is (Hyper's
 daily limit, 923 s and 2 h 25 m on record), and the pass carries no deadline the readers can see. A NeuralWatt day is up to 24
 hours, and a router call waits inside its own deadline (`RUN_PER_CALL_TIMEOUT_MS`, 360 s, in the run package, which this
 package cannot import), so the bound is the cooldown's own length, below that deadline: the longest the budget layer
 holds a provider on its own judgment. A return past it is refused with its time stated instead
 (`hold-reason.ts`). THE OWNER MAY VETO THE VALUE.
 */
export const NEURALWATT_RETURN_WAIT_BOUND_MS = 300_000;

/**
 Milliseconds added to a return, so a timer that fires a hair before the day starts, or a day start given to the second,
 still reads the new day: one second, the granularity of the quota's `current_period_start`.
 */
export const NEURALWATT_RETURN_MARGIN_MS = 1_000;

/**
 Whether a spent NeuralWatt day has a return worth waiting for, and how long that wait is.

 @example
 ```ts
 const wait: NeuralWattReturnWait = { kind: 'wait', ms: 48_000, };
 ```
 */
export type NeuralWattReturnWait =
  | {
    /**
     The day starts again within the bound.
     */
    readonly kind: 'wait';

    /**
     Milliseconds until it does, plus the margin.
     */
    readonly ms: number;
  }
    | {
    /**
     There is no return to wait for: the energy is not what is spent, the day start is unknown, the key is blocked, or
     the day starts again past the bound.
     */
      readonly kind: 'none';
    };

/**
 Milliseconds in a second.
 */
const MS_PER_SECOND = 1_000;

/**
 Milliseconds in a minute.
 */
const MS_PER_MINUTE = 60_000;

/**
 Milliseconds in an hour.
 */
const MS_PER_HOUR = 3_600_000;

/**
 Milliseconds since 00:00 UTC at an instant.

 @param at - the instant

 @returns Milliseconds after the UTC midnight that began its day

 @example
 ```ts
 msOfDayUtc({ at: new Date('2026-10-23T19:14:20.000Z',), },); // 69_260_000
 ```
 */
function msOfDayUtc({ at, }: { readonly at: Date; },): number {
  return (at.getUTCHours() * MS_PER_HOUR)
    + (at.getUTCMinutes() * MS_PER_MINUTE)
    + (at.getUTCSeconds() * MS_PER_SECOND)
    + at.getUTCMilliseconds();
}

/**
 How long to wait for NeuralWatt's day to start again, when its energy is what is spent and the day starts again within
 the bound.

 NOTHING FOR WHAT A DAY START DOES NOT RETURN: a day with energy left is not dry, an unknown day start names no time, and
 a blocked key's allowance comes back at its own time (`keyBlockedUntil`) and not at the day start. A day that has just
 started reads as a whole day away, since the energy of that day is what is spent.

 @param energy - the reading the dryness was drawn from

 @param now - the wall clock's instant, whose time of day the distance is taken from

 @param boundMs - the longest return worth waiting for

 @param marginMs - milliseconds added to a return that is waited for

 @returns The wait, milliseconds until the day starts again plus the margin, or that there is none

 @example
 ```ts
 neuralWattReturnWaitMs({ energy, now: new Date('2026-10-23T19:14:20.000Z',), boundMs: 300_000, marginMs: 0, },); // 48_000
 ```
 */
export function neuralWattReturnWaitMs(
  {
    energy,
    now,
    boundMs,
    marginMs,
  }: {
    readonly energy: NeuralWattEnergy;
    readonly now: Date;
    readonly boundMs: number;
    readonly marginMs: number;
  },
): NeuralWattReturnWait {
  if ((energy.dayStart === undefined) || (energy.keyBlockedUntil !== undefined)
    || (!neuralWattIsDry({ energy, },)))
    return { kind: 'none', };

  /**
   The time of day the day starts at, when the reading's day start parses.
   */
  const { msOfDay, } = neuralWattDayStartOfInstant({ instant: energy.dayStart, },);
  if (msOfDay === undefined)
    return { kind: 'none', };

  /**
   Milliseconds from the clock's time of day to the next time of day the day starts at, zero meaning it starts now.
   */
  const untilStart = (((msOfDay - msOfDayUtc({ at: now, },)) % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
  /**
   The distance, a whole day where the day starts now.
   */
  const wait = (untilStart === 0) ? MS_PER_DAY : untilStart;
  if (wait > boundMs)
    return { kind: 'none', };
  return {
    kind: 'wait',
    ms: wait + marginMs,
  };
}

//endregion NeuralWatt return hold
