/**
 * Tests the provider-aware judge seats.
 *
 * THE CASE IS Qwen3.8-27B: cut in 30 of 34 translate-lane select rounds when
 * Hyper served it (XIEPT2, 2026-09-03) and answering 25 of 28 when Synthetic
 * did (Toka_ls, 2026-09-02). Here the seat is withheld when Synthetic is dry,
 * kept when it is wet, kept when the meter cannot be read, and the static
 * drops (GLM-5.3-Flash and glm-5.3 from the wide seats) hold either way.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  HYPER_SLOW_JUDGES,
  judgeSeatsFor,
  type QuotaSnapshot,
  readJudgeSeats,
  RUN_LATE_JUDGES,
  RUN_WIDE_SEATS,
  type SyntheticClient,
} from '../../dist/final/node/index.mjs';

/**
 * The Hyper-slow judge every case is about.
 */
const QWEN = 'hf:Qwen/Qwen3.8-27B';

/**
 * Builds a client whose quota surface answers as scripted.
 *
 * @param quotas - scripted meter reply
 *
 * @returns Client with the chat surfaces unused
 *
 * @example
 * ```ts
 * const client = meterClient({ quotas: async () => snapshot, },);
 * ```
 */
function meterClient(
  { quotas, }: { readonly quotas: SyntheticClient['quotas']; },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the seat reading',);
    },
    chatJson: async () => {
      throw new Error('chatJson unused by the seat reading',);
    },
    quotas,
  };
}

/**
 * Meter reading with the given weekly share and window left.
 *
 * @param percentRemaining - weekly budget left
 *
 * @param remaining - five-hour window left
 *
 * @returns Snapshot
 *
 * @example
 * ```ts
 * const dry = snapshotOf({ percentRemaining: 0, remaining: 0, },);
 * ```
 */
function snapshotOf(
  {
    percentRemaining,
    remaining,
  }: {
    readonly percentRemaining: number;
    readonly remaining: number;
  },
): QuotaSnapshot {
  return {
    fiveHour: {
      remaining,
      max: 2_750,
      limited: false,
      nextTickAt: '',
    },
    weekly: {
      percentRemaining,
      nextRegenAt: '',
    },
  };
}

await describe({
  name: judgeSeatsFor.name,
  children: [
    it({
      name: 'WITHHOLDS the Hyper-slow judge from both benches when Synthetic is dry and SEATS it when wet, '
        + 'with the static drops holding either way',
      fn: async () => {
        expect(HYPER_SLOW_JUDGES.has(QWEN,),).toBe(true,);
        expect(RUN_WIDE_SEATS.includes(QWEN,),).toBe(true,);
        expect(RUN_LATE_JUDGES.includes(QWEN,),).toBe(true,);

        const dry = judgeSeatsFor({ syntheticDry: true, },);
        expect(dry.wideSeats.includes(QWEN,),).toBe(false,);
        expect(dry.lateJudges.includes(QWEN,),).toBe(false,);
        expect(dry.wideSeats.length,).toBe(RUN_WIDE_SEATS.length - 1,);
        expect(dry.lateJudges.length,).toBe(RUN_LATE_JUDGES.length - 1,);
        expect(dry.repairModels.criticModelIds,).toEqual(dry.wideSeats,);
        expect(dry.repairModels.panelModelIds,).toEqual(dry.wideSeats,);
        expect(dry.repairModels.judgeModelIds,).toEqual(dry.wideSeats,);
        expect(dry.translateModels.judgeModelIds,).toEqual(dry.wideSeats,);
        expect(dry.wideSeats.includes('hf:zai-org/GLM-5.3-Flash',),).toBe(false,);

        const wet = judgeSeatsFor({ syntheticDry: false, },);
        expect(wet.wideSeats,).toEqual(RUN_WIDE_SEATS,);
        expect(wet.lateJudges,).toEqual(RUN_LATE_JUDGES,);
        expect(wet.wideSeats.includes('hf:zai-org/GLM-5.3-Flash',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: readJudgeSeats.name,
  children: [
    it({
      name: 'READS dryness off the meter, and SEATS the full bench when the meter cannot be read, since an '
        + 'unreadable meter is not evidence of dryness',
      fn: async () => {
        /**
         * Logger the readings write to.
         */
        const l = tagged({ tag: 'run-seats-test', },);
        const dry = await readJudgeSeats({
          client: meterClient({
            quotas: async () => snapshotOf({ percentRemaining: 0, remaining: 0, },),
          },),
          phase: 'lanes',
          signal: new AbortController().signal,
          l,
        },);
        expect(dry.syntheticDry,).toBe(true,);
        expect(dry.wideSeats.includes(QWEN,),).toBe(false,);

        const wet = await readJudgeSeats({
          client: meterClient({
            quotas: async () => snapshotOf({ percentRemaining: 40, remaining: 2_000, },),
          },),
          phase: 'lanes',
          signal: new AbortController().signal,
          l,
        },);
        expect(wet.syntheticDry,).toBe(false,);
        expect(wet.wideSeats.includes(QWEN,),).toBe(true,);

        const unread = await readJudgeSeats({
          client: meterClient({
            quotas: async () => {
              throw new Error('meter offline',);
            },
          },),
          phase: 'lanes',
          signal: new AbortController().signal,
          l,
        },);
        expect(unread.syntheticDry,).toBe(false,);
        expect(unread.wideSeats.includes(QWEN,),).toBe(true,);
      },
    },),
  ],
},);
