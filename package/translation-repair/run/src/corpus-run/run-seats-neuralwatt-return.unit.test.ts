/**
 Tests the seat reader against the XingZ6019 shape: NeuralWatt dry because the day's energy was spent, its day starting
 again 48 s after the entry stopped, and a writing bench short of its floor without it.

 The reader waits for a return the budgets name when it is near enough, and then seats the NeuralWatt writers; past the
 bound it refuses and the refusal states the time. The budgets are the real ones over stub meters and a stub wall
 clock, so the return reaches the reader the way a run's does (a hold), and the times are scaled to milliseconds.

 Fixtures are cat-themed invention; every meter is a stub and no HTTP is made.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { createProviderBudgets, } from '@monochromatic-dev/translation-repair-provider';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/corpus-run/rejection-of.test-fixture.ts';
import { levelCapturingLogger, } from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';
import {
  readPhaseSeats,
  WritingBenchUnreachableError,
} from '../../dist/final/node/index.mjs';

/**
 Abort signal every read here carries.
 */
const SIGNAL = new AbortController().signal;

/**
 Milliseconds after 00:00 UTC the account's day starts at: 19:15:08 UTC.
 */
const DAY_START_MS_OF_DAY = 69_308_000;

/**
 The day whose energy is spent.
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
 The day that began at the return.
 */
const FRESH_DAY = {
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

 @param returnWaitBoundMs - the bound the budgets put on a return they name as a hold, which the seat reader does not have

 @returns The client the reader takes, and the energy reads counted

 @example
 ```ts
 const { client, } = clientBefore({ msBeforeReturn: 60, },);
 ```
 */
function clientBefore(
  {
    msBeforeReturn,
    returnWaitBoundMs = 300_000,
  }: {
    readonly msBeforeReturn: number;
    readonly returnWaitBoundMs?: number;
  },
) {
  const reads = { count: 0, };
  const budgets = createProviderBudgets({
    neuralwatt: {
      energy: async () => {
        reads.count += 1;
        return (reads.count === 1) ? SPENT_DAY : FRESH_DAY;
      },
      dayAnchor: () => ({ known: true, msOfDay: DAY_START_MS_OF_DAY, }),
    },
    synthetic: {
      quotas: async () => ({
        weekly: { percentRemaining: 50, nextRegenAt: '2026-10-25T00:00:00.000Z', },
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
    returnWaitBoundMs,
  },);
  return {
    reads,
    client: {
      providerDryness: () => budgets.read({ signal: SIGNAL, },),
      providerMeterStates: () => budgets.readStates({ signal: SIGNAL, },),
      providerHolds: budgets.holds,
      neuralwattReturn: budgets.neuralwattReturn,
    },
  };
}

await describe({
  name: 'the seat reader and NeuralWatt\'s return',
  concurrency: 1,
  children: [
    it({
      name: 'WAITS FOR NEURALWATT\'S DAY TO START AGAIN when the lanes\' writing benches stand short without it and the '
        + 'return is near, then seats the NeuralWatt writers, logging the wait with its reason and its end',
      fn: async () => {
        const lines: string[] = [];
        const { client, reads, } = clientBefore({ msBeforeReturn: 60, },);
        const { unreachableWriters, } = await readPhaseSeats({
          client,
          phase: 'lanes',
          signal: SIGNAL,
          l: levelCapturingLogger({ lines, },),
          pollMs: 5,
        },);
        expect(unreachableWriters,).toEqual([],);
        expect(reads.count,).toBe(2,);
        expect(lines.some(function waitLine(line,): boolean {
          return line.startsWith('warn JUDGE SEATS phase=lanes short of quorum',)
            && line.includes('waiting ',) && (!line.includes('waiting 0ms',))
            && line.includes('neuralwatt, whose day starts again at 19:15:08 UTC',);
        },),).toBe(true,);
        expect(lines.some(function endLine(line,): boolean {
          return line.startsWith('info JUDGE SEATS phase=lanes waited ',) && (!line.startsWith('info JUDGE SEATS phase=lanes waited 0ms',))
            && line.includes('for neuralwatt, whose day starts again at 19:15:08 UTC',);
        },),).toBe(true,);
        expect(lines.some(function seatsLine(line,): boolean {
          return line.startsWith('info JUDGE SEATS phase=lanes neuralwatt=wet',) && line.includes('waited=',)
            && (!line.includes('waited=0ms',));
        },),).toBe(true,);
      },
    },),

    it({
      name: 'WAITS FOR A RETURN PAST THE 300 s A ROUTER CALL WAITS, since the seat reader sits outside every exchange and '
        + 'is bounded by what the pass has left, the way Hyper\'s stated holds are: a return 80 ms away under a 60 ms '
        + 'bound is waited for and the NeuralWatt writers are seated',
      fn: async () => {
        const lines: string[] = [];
        const { client, reads, } = clientBefore({ msBeforeReturn: 80, returnWaitBoundMs: 60, },);
        const { unreachableWriters, } = await readPhaseSeats({
          client,
          phase: 'lanes',
          signal: SIGNAL,
          l: levelCapturingLogger({ lines, },),
          pollMs: 5,
        },);
        expect(unreachableWriters,).toEqual([],);
        expect(reads.count,).toBe(2,);
        expect(lines.some(function waitLine(line,): boolean {
          return line.startsWith('warn JUDGE SEATS phase=lanes short of quorum',)
            && line.includes('neuralwatt, whose day starts again at 19:15:08 UTC',);
        },),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES WITH THE STATED RETURN TIME when NeuralWatt\'s day starts again past the bound, naming the time of '
        + 'day and the bound in the error and in the error line, without waiting',
      fn: async () => {
        const lines: string[] = [];
        const { client, reads, } = clientBefore({ msBeforeReturn: 82_800_000, },);
        /**
         What the seat reading stopped with.
         */
        const refusal = await rejectionOf({
          promise: readPhaseSeats({
            client,
            phase: 'lanes',
            signal: SIGNAL,
            l: levelCapturingLogger({ lines, },),
            pollMs: 5,
          },),
        },);
        expect(refusal,).toBeInstanceOf(WritingBenchUnreachableError,);
        expect((refusal as WritingBenchUnreachableError).message,).toContain(
          'NeuralWatt reads dry and its day starts again at 19:15:08 UTC, which is past the 300 s this run waits for it',
        );
        expect(lines.some(function errorLine(line,): boolean {
          return line.startsWith('error JUDGE SEATS phase=lanes writing bench unreachable',)
            && line.includes('its day starts again at 19:15:08 UTC',);
        },),).toBe(true,);
        expect(reads.count,).toBe(1,);
      },
    },),
  ],
},);
