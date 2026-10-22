/**
 Tests for the three states a provider meter can be in, and for which of them
 stops us spending.

 THE POINT OF THE THIRD STATE IS THAT IT DOES NOT CHANGE ROUTING. An
 unreachable meter has always routed as spendable and still does; what it
 gains here is a name, so a later reader of the log cannot mistake a
 monitoring failure for a provider that was up. Both halves are pinned in this file,
 because a change breaking either would be silent.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  parseQuotaSnapshot,
  ProviderHttpError,
} from '@monochromatic-dev/translation-repair-provider-stream';
import {
  meterRecordOf,
  routesAsDry,
} from '../dist/final/node/index.mjs';
import { warnLinesDuring, } from '@monochromatic-dev/translation-repair-typography/ts/console-warn-lines.test-fixture.ts';
import { HANG_STOP_MS, } from '@monochromatic-dev/translation-repair-test-fixture/ts/hang-stop.test-fixture.ts';

/**
 Error a meter read rejects with when its endpoint cannot be reached.
 */
class MeterUnreachableError extends Error {
  public override readonly name = 'MeterUnreachableError';
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: meterRecordOf.name,
      // ONE CASE AT A TIME: two cases divert `console.warn` across an await to
      // read what the package's root logger wrote.
      concurrency: 1,
      children: [
        it({
          name: 'reads a meter reporting budget left as wet',
          fn: async () => {
            /**
             Record a meter answering "there is budget" produces.
             */
            const meter = await meterRecordOf({
              name: 'synthetic',
              signal: AbortSignal.timeout(HANG_STOP_MS,),
              readLevel: async () => ({
                dry: false,
                fields: ['syntheticWeekly=97%',],
              }),
            },);

            expect(meter.state,).toBe('wet',);
          },
        },),

        it({
          name: 'reads a meter reporting nothing left as dry',
          fn: async () => {
            /**
             Record a meter answering "there is nothing left" produces.
             */
            const meter = await meterRecordOf({
              name: 'synthetic',
              signal: AbortSignal.timeout(HANG_STOP_MS,),
              readLevel: async () => ({
                dry: true,
                fields: ['syntheticWeekly=0%',],
              }),
            },);

            expect(meter.state,).toBe('dry',);
          },
        },),

        it({
          name: 'FORWARDS the numbers the meter was read from, so a dry verdict can be checked',
          fn: async () => {
            /**
             Record carrying what the meter actually said, which is what
             separates an empty budget from a threshold that was wrong about a
             budget that was not.
             */
            const meter = await meterRecordOf({
              name: 'hyper',
              signal: AbortSignal.timeout(HANG_STOP_MS,),
              readLevel: async () => ({
                dry: true,
                fields: ['hyperBalance=0',],
              }),
            },);

            expect(meter.fields,).toEqual(['hyperBalance=0',],);
          },
        },),

        it({
          name: 'REFUSES to guess for a meter that could not be read, naming it instead',
          fn: async () => {
            /**
             Record an unreachable endpoint produces, which is the whole reason
             this type has a third member.
             */
            const meter = await meterRecordOf({
              name: 'hyper',
              signal: AbortSignal.timeout(HANG_STOP_MS,),
              readLevel: async () => {
                throw new MeterUnreachableError('endpoint refused the connection',);
              },
            },);

            expect(meter.state,).toBe('unreadable',);
          },
        },),

        it({
          name: 'reports no numbers for a meter that never answered',
          fn: async () => {
            /**
             Record of a read that rejected, which has nothing to report a level
             from and must not invent one.
             */
            const meter = await meterRecordOf({
              name: 'hyper',
              signal: AbortSignal.timeout(HANG_STOP_MS,),
              readLevel: async () => {
                throw new MeterUnreachableError('endpoint refused the connection',);
              },
            },);

            expect(meter.fields,).toEqual([],);
          },
        },),

        it({
          name: 'WARNS A METER THE PROVIDER REFUSED with its status and the provider\'s words, and records it '
            + 'unreadable with no numbers',
          fn: async () => {
            const { result: meter, warned, } = await warnLinesDuring({
              run: async function readRefusedMeter() {
                return await meterRecordOf({
                  name: 'hyper',
                  signal: AbortSignal.timeout(HANG_STOP_MS,),
                  readLevel: async () => {
                    throw new ProviderHttpError({
                      provider: 'hyper',
                      status: 401,
                      bodyText: 'this cat has no collar tag',
                    },);
                  },
                },);
              },
            },);

            expect(warned,).toEqual([
              '[translation-repair] [meterRecordOf] hyper: budget unreadable, treating as spendable (refused by '
                + 'ProviderHttpError from hyper with HTTP 401 (the provider said: "this cat has no collar tag"))',
            ],);
            expect(meter,).toEqual({
              state: 'unreadable',
              fields: [],
            },);
          },
        },),

        it({
          name: 'WARNS A QUOTAS BODY THAT VIOLATES EXPECTATIONS WITH THE KEYS IT HELD AND THE JSON TYPE OF EACH, never a value: an '
            + 'empty body, a body that lacks the weekly block, and a body whose weekly block holds other fields, whose values a reader '
            + 'of the log must not see',
          fn: async () => {
            /**
             The warning a body comes to when the meter reads it.
             */
            async function warnedFor({ bodyText, }: { readonly bodyText: string; },): Promise<readonly string[]> {
              const { warned, } = await warnLinesDuring({
                run: async function readBody() {
                  return await meterRecordOf({
                    name: 'synthetic',
                    signal: AbortSignal.timeout(HANG_STOP_MS,),
                    readLevel: async () => {
                      parseQuotaSnapshot({ bodyText, },);
                      throw new MeterUnreachableError('a body that parses is not reached by this case',);
                    },
                  },);
                },
              },);
              return warned;
            }
            /**
             A body of the older shape, with values an account would not want in a log.
             */
            const older = JSON.stringify({
              subscription: {
                limit: 135,
                requests: 41,
                renewsAt: '2026-09-21T14:36:14.288Z',
                plan: 'whiskers-private-plan',
              },
              freeToolCalls: { limit: 0, },
            },);
            /**
             A body with no five-hour block whose weekly block holds other fields, with values an account would not want in a log.
             */
            const reshaped = JSON.stringify({
              subscription: { limit: 135, },
              weeklyTokenLimit: {
                percentLeft: 64.5,
                plan: 'whiskers-private-plan',
              },
            },);
            const lines = [
              await warnedFor({ bodyText: '{}', },),
              await warnedFor({ bodyText: older, },),
              await warnedFor({ bodyText: reshaped, },),
            ];
            expect(lines,).toEqual([
              [
                '[translation-repair] [meterRecordOf] synthetic: budget unreadable, treating as spendable (Synthetic /quotas body '
                  + 'violated expectations: weeklyTokenLimit is not an object; received {})',
              ],
              [
                '[translation-repair] [meterRecordOf] synthetic: budget unreadable, treating as spendable (Synthetic /quotas body '
                  + 'violated expectations: weeklyTokenLimit is not an object; received subscription:object, freeToolCalls:object)',
              ],
              [
                '[translation-repair] [meterRecordOf] synthetic: budget unreadable, treating as spendable (Synthetic /quotas body '
                  + 'violated expectations: weeklyTokenLimit.percentRemaining is not a number; received subscription:object, '
                  + 'weeklyTokenLimit:object; weeklyTokenLimit holds percentLeft:number, plan:string)',
              ],
            ],);
            /**
             The warnings as one text.
             */
            const joined = lines.flat()
              .join('\n',);
            expect(['135', '41', '64.5', 'whiskers-private-plan', '2026-09-21',].filter(function appears(value,): boolean {
              return joined.includes(value,);
            },),).toEqual([],);
          },
        },),

        it({
          name: 'WARNS A METER READ THE CALLER STOPPED AS STOPPED, not as a meter that could not be read, and still '
            + 'records it unreadable with no numbers, which every sharer of the reading routes as spendable',
          fn: async () => {
            /**
             Why the caller stopped the reading.
             */
            const reason = new Error('the owner called the cats in',);
            /**
             The caller's steering, stopped before the meter answers.
             */
            const steering = new AbortController();
            steering.abort(reason,);
            const { result: meter, warned, } = await warnLinesDuring({
              run: async function readStoppedMeter() {
                return await meterRecordOf({
                  name: 'synthetic',
                  signal: steering.signal,
                  readLevel: async () => {
                    throw reason;
                  },
                },);
              },
            },);

            expect(warned,).toEqual([
              '[translation-repair] [meterRecordOf] synthetic: budget not read, since the caller stopped the '
                + 'reading; treating as spendable',
            ],);
            expect(meter,).toEqual({
              state: 'unreadable',
              fields: [],
            },);
          },
        },),
      ],
    },),

    describe({
      name: routesAsDry.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'holds out only a meter that answered and said dry',
          fn: async () => {
            expect(routesAsDry({ state: 'dry', },),).toBe(true,);
          },
        },),

        it({
          name: 'ACCEPTS a wet meter for spending',
          fn: async () => {
            expect(routesAsDry({ state: 'wet', },),).toBe(false,);
          },
        },),

        it({
          name: 'ACCEPTS an unreadable meter for spending, so lost monitoring is not an outage',
          fn: async () => {
            expect(routesAsDry({ state: 'unreadable', },),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
