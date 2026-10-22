/**
 Tests for the wait NeuralWatt's spent day names: how long until its day starts again, and whether that is near enough
 to wait for.

 THE DAY STARTS AT A TIME OF DAY IN UTC (`neuralwatt-day.ts`), so the wait is the distance from the clock's time of day
 to the energy reading's day-start time of day, around midnight where it must be. No calendar and no instant of the wall
 clock is read as a number.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  NEURALWATT_RETURN_MARGIN_MS,
  NEURALWATT_RETURN_WAIT_BOUND_MS,
  neuralWattReturnWaitMs,
  type NeuralWattReturnWait,
} from '../dist/final/node/index.mjs';

/**
 No wait: the energy is not what is spent, or the return is not near.
 */
const NONE: NeuralWattReturnWait = { kind: 'none', };

/**
 A wait of so many milliseconds.

 @param ms - the wait

 @returns The wait

 @example
 ```ts
 const wait = waitOf({ ms: 48_000, },);
 ```
 */
function waitOf({ ms, }: { readonly ms: number; },): NeuralWattReturnWait {
  return {
    kind: 'wait',
    ms,
  };
}

/**
 A reading of a day whose energy is spent, the day starting at 19:15:08 UTC.
 */
const SPENT_DAY = {
  dayStart: '2026-10-22T19:15:08.000Z',
  dailyWh: 550,
  spentWh: 550,
  reckonedWh: 0,
  reservedWh: 0,
  remainingWh: 0,
  calls: 40,
} as const;

/**
 The wait for a spent day at a time, with no margin.

 @param at - the wall clock's instant

 @returns The wait, or that there is none where no return is near enough or known

 @example
 ```ts
 const wait = waitAt({ at: '2026-10-23T19:14:20.000Z', },);
 ```
 */
function waitAt({ at, }: { readonly at: string; },): NeuralWattReturnWait {
  return neuralWattReturnWaitMs({
    energy: SPENT_DAY,
    now: new Date(at,),
    boundMs: NEURALWATT_RETURN_WAIT_BOUND_MS,
    marginMs: 0,
  },);
}

await describe({
  name: neuralWattReturnWaitMs.name,
  concurrency: 1,
  children: [
    it({
      name: 'IS THE 48 SECONDS XINGZ6019 STOOD SHORT FOR: spent at 19:14:20 UTC, the day starting again at 19:15:08',
      fn: async () => {
        expect(waitAt({ at: '2026-10-23T19:14:20.000Z', },),).toEqual(waitOf({ ms: 48_000, },),);
        expect(waitAt({ at: '2026-10-22T19:14:20.000Z', },),).toEqual(waitOf({ ms: 48_000, },),);
      },
    },),

    it({
      name: 'ADDS THE MARGIN to the wait, so a timer that fires a hair early still reads the new day',
      fn: async () => {
        expect(neuralWattReturnWaitMs({
          energy: SPENT_DAY,
          now: new Date('2026-10-23T19:14:20.000Z',),
          boundMs: NEURALWATT_RETURN_WAIT_BOUND_MS,
          marginMs: NEURALWATT_RETURN_MARGIN_MS,
        },),).toEqual(waitOf({ ms: 48_000 + NEURALWATT_RETURN_MARGIN_MS, },),);
      },
    },),

    it({
      name: 'WRAPS PAST MIDNIGHT: 23:59:50 UTC with a day starting at 00:00:10 is 20 seconds',
      fn: async () => {
        expect(neuralWattReturnWaitMs({
          energy: { ...SPENT_DAY, dayStart: '2026-10-22T00:00:10.000Z', },
          now: new Date('2026-10-22T23:59:50.000Z',),
          boundMs: NEURALWATT_RETURN_WAIT_BOUND_MS,
          marginMs: 0,
        },),).toEqual(waitOf({ ms: 20_000, },),);
      },
    },),

    it({
      name: 'READS A DAY THAT HAS JUST STARTED AS A WHOLE DAY AWAY, past any bound, since the energy of that day is '
        + 'what is spent',
      fn: async () => {
        expect(waitAt({ at: '2026-10-23T19:15:08.000Z', },),).toEqual(NONE,);
      },
    },),

    it({
      name: 'NAMES NO WAIT PAST THE BOUND and one at the bound',
      fn: async () => {
        expect(waitAt({ at: '2026-10-23T19:10:08.000Z', },),).toEqual(
          waitOf({ ms: NEURALWATT_RETURN_WAIT_BOUND_MS, },),
        );
        expect(waitAt({ at: '2026-10-23T19:10:07.999Z', },),).toEqual(NONE,);
      },
    },),

    it({
      name: 'NAMES NO WAIT where the energy is not what is spent: a day with energy left, an unknown day start, a '
        + 'blocked key',
      fn: async () => {
        /**
         The instant 48 seconds before the day starts again.
         */
        const now = new Date('2026-10-23T19:14:20.000Z',);
        const { dayStart, ...unanchored } = SPENT_DAY;
        expect(dayStart,).toBe(SPENT_DAY.dayStart,);
        expect([
          neuralWattReturnWaitMs({
            energy: { ...SPENT_DAY, remainingWh: 400, },
            now,
            boundMs: NEURALWATT_RETURN_WAIT_BOUND_MS,
            marginMs: 0,
          },),
          neuralWattReturnWaitMs({
            energy: unanchored,
            now,
            boundMs: NEURALWATT_RETURN_WAIT_BOUND_MS,
            marginMs: 0,
          },),
          neuralWattReturnWaitMs({
            energy: { ...SPENT_DAY, keyBlockedUntil: '2026-10-23T20:00:00.000Z', },
            now,
            boundMs: NEURALWATT_RETURN_WAIT_BOUND_MS,
            marginMs: 0,
          },),
        ],).toEqual([NONE, NONE, NONE,],);
      },
    },),
  ],
},);
