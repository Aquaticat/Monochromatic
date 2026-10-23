//region NeuralWatt seat client
// TEST SUPPORT, NOT PACKAGE SOURCE. The seat reader's client over the real budgets with NeuralWatt dry for a spent day,
// shared by the cases that read seats against the XingZ6019 shape.

import {
  createProviderBudgets,
  type NeuralWattEnergy,
} from '@monochromatic-dev/translation-repair-provider';

/**
 Abort signal every read here carries.
 */
export const SIGNAL = new AbortController().signal;

/**
 Milliseconds after 00:00 UTC the account's day starts at: 19:15:08 UTC.
 */
export const DAY_START_MS_OF_DAY = 69_308_000;

/**
 The day whose energy is spent.
 */
export const SPENT_DAY = {
  dayStart: '2026-10-22T19:15:08.000Z',
  dailyWh: 550,
  spentWh: 550,
  reckonedWh: 0,
  reservedWh: 0,
  remainingWh: 0,
  calls: 40,
} as const;

/**
 The day that began at the return.
 */
export const FRESH_DAY = {
  dayStart: '2026-10-23T19:15:08.000Z',
  dailyWh: 550,
  spentWh: 0,
  reckonedWh: 0,
  reservedWh: 0,
  remainingWh: 550,
  calls: 0,
} as const;

/**
 The seat reader's client over the real budgets, with NeuralWatt dry for the spent day and Synthetic the only wet
 provider.

 @param msBeforeReturn - how long before NeuralWatt's day starts again the wall clock reads

 @param spent - the first NeuralWatt reading, the spent day unless the case says otherwise

 @param syntheticWet - whether Synthetic, the only other configured provider, has budget

 @param passLeftMs - what the pass has left, which bounds the wait for a return; absent for a pass that bounds nothing

 @param lagging - whether the account still reads the spent day after the return (default: the new day shows)

 @param now - the monotonic clock the budgets count a return's distance on, a frozen one for a case that waits for
 nothing (default: the real clock, for a case that sleeps)

 @returns The client the reader takes, and the energy reads counted

 @example
 ```ts
 const { client, } = clientBefore({ msBeforeReturn: 60, },);
 ```
 */
export function clientBefore(
  {
    msBeforeReturn,
    spent = SPENT_DAY,
    syntheticWet = true,
    lagging = false,
    passLeftMs,
    now,
  }: {
    readonly msBeforeReturn: number;
    readonly spent?: NeuralWattEnergy;
    readonly syntheticWet?: boolean;
    readonly lagging?: boolean;
    readonly passLeftMs?: number;
    readonly now?: () => number;
  },
) {
  const reads = { count: 0, };
  const budgets = createProviderBudgets({
    neuralwatt: {
      energy: async () => {
        reads.count += 1;
        return ((reads.count === 1) || lagging) ? spent : FRESH_DAY;
      },
      dayAnchor: () => ({ known: true, msOfDay: DAY_START_MS_OF_DAY, }),
    },
    synthetic: {
      quotas: async () => ({
        weekly: { percentRemaining: syntheticWet ? 50 : 0, nextRegenAt: '2026-10-25T00:00:00.000Z', },
      }),
    },
    wallNow: () => new Date(Date.UTC(
      2_026,
      9,
      23,
      0,
      0,
      0,
      DAY_START_MS_OF_DAY - msBeforeReturn,
    ),),
    returnMarginMs: 0,
    // Conditional spread keeps the real clock where the case sleeps for real.
    ...((now === undefined) ? {} : { now, }),
  },);
  return {
    reads,
    client: {
      providerDryness: () => budgets.read({ signal: SIGNAL, },),
      providerMeterStates: () => budgets.readStates({ signal: SIGNAL, },),
      providerHolds: budgets.holds,
      neuralwattReturn: budgets.neuralwattReturn,
      neuralwattDryness: budgets.neuralwattDryness,
      // Conditional spread keeps the client without a pass bound where the case names none.
      ...((passLeftMs === undefined) ? {} : { passLeftMs: () => passLeftMs, }),
    },
  };
}

//endregion NeuralWatt seat client
