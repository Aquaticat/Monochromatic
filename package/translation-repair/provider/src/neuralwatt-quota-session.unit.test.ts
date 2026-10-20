/**
 Tests the two quota readings of one NeuralWatt run: a baseline taken lazily,
 once, before the first call, and the reading at the end, whose difference is
 the plan energy the run spent (`neuralwatt-quota.ts` says what that figure
 can and cannot see, `https://docs.neuralwatt.com/api/quota`, fetched
 2026-10-20). A reading that fails never blocks a call; it is warned, and the
 end report says why it has nothing to compare.

 REACHED THROUGH THE CLIENT, because `createNeuralWattQuotaSession` is not on
 the package index, which exports only what the siblings and their tests
 reach, and a test imports the built package and not the source. The client
 takes the baseline before its first call and hands the end report on as
 `planSpend`, so the cases ask a question and read the quota exchanges the
 scripted transport saw. No case reaches NeuralWatt or reads a key, the retry
 policy allows no retry so no case waits, and logging goes through the case's
 own sandbox. Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { TransportReply, } from '@monochromatic-dev/translation-repair-provider-stream';
import { consoleLinesDuring, } from './neuralwatt-ledger.test-fixture.ts';
import {
  ask,
  BASE_URL,
  chatExchangesOf,
  NO_SUBSCRIPTION_REPLY,
  quotaExchangesOf,
  quotaReply,
  scriptedClient,
  SIGNAL,
  UNREPORTED_QUOTA_REPLY,
} from './neuralwatt-scripted-client.test-fixture.ts';
import { scratchDir, } from '@monochromatic-dev/translation-repair-test-fixture/ts/scratch-dir.test-fixture.ts';

/**
 The day-start setting of the runs whose quota gives no period start: without a day a run sends nothing, and these
 cases are about the quota readings of a run that does.
 */
const MIDNIGHT_SETTING = { msOfDay: 0, } as const;

/**
 What the quota route does on a read: answers, or drops the connection.
 */
type QuotaReply = Error | TransportReply;

/**
 Quota replies that fail, with the kind of failure each is warned as: a refused status, a body that is not the
 documented shape and a dropped connection.
 */
const FAILURES = [
  [{ status: 403, bodyText: 'Forbidden', }, 'ProviderHttpError',],
  [{ status: 200, bodyText: '[1]', }, 'NeuralWattQuotaShapeError',],
  [new Error('connection dropped',), 'Error',],
] as const satisfies readonly (readonly [QuotaReply, string,])[];

await describe({
  name: 'NeuralWatt quota session',
  concurrency: 1,
  children: [
    describe({
      name: 'the baseline',
      children: [
        it({
          name: 'READS THE QUOTA ONCE BEFORE THE FIRST CALL, a GET to the quota route with the key and the signal '
            + 'the call carries, ahead of the first chat request, and says what the plan had charged at the start of '
            + 'the run',
          fn: async ctx => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
            const { client, exchanges, } = scriptedClient({ dir: scratch.path, },);
            /**
             Lines the call logged.
             */
            const lines = await consoleLinesDuring({
              run: async function call(): Promise<void> {
                await ask({ client, },);
              },
              sinon: ctx.sinon,
            },);
            expect(exchanges.map(function shape(exchange,): string {
              return `${exchange.method} ${exchange.url.split('?',)[0] ?? ''}`;
            },),).toEqual([
              `GET ${BASE_URL}/quota`,
              `GET ${BASE_URL}/usage/by-model`,
              `POST ${BASE_URL}/chat/completions`,
            ],);
            expect(exchanges[0]?.label,).toBe('quota',);
            expect(exchanges[0]?.headers.Authorization,).toBe('Bearer test-key',);
            expect(exchanges[0]?.signal,).toBe(SIGNAL,);
            expect(lines.some(function says(line,): boolean {
              return line.includes('NeuralWatt quota at the start of the run: 13.9023 kWh charged this period',);
            },),).toBe(true,);
          },
        },),

        it({
          name: 'SAYS NO ENERGY CHARGED TO A PLAN IS REPORTED when the account has no subscription or its reply leaves '
            + 'the charged figure out, since an unreported figure is not a zero',
          fn: async ctx => {
            /**
             Takes the baseline of one run whose quota reply is given.

             @param reply - what the quota route answers
             */
            async function takeBaseline(reply: QuotaReply,): Promise<void> {
              await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
              const { client, } = scriptedClient({
                dir: scratch.path,
                quota: [reply,],
                dayStartSetting: MIDNIGHT_SETTING,
              },);
              await ask({ client, },);
            }
            /**
             Lines the two runs logged.
             */
            const lines = await consoleLinesDuring({
              run: async function runs(): Promise<void> {
                await takeBaseline(NO_SUBSCRIPTION_REPLY,);
                await takeBaseline(UNREPORTED_QUOTA_REPLY,);
              },
              sinon: ctx.sinon,
            },);
            expect(lines.filter(function says(line,): boolean {
              return line.includes('NeuralWatt quota at the start of the run: no energy charged to a plan is reported',);
            },).length,).toBe(2,);
            expect(lines.some(function says(line,): boolean {
              return line.includes('kWh charged this period',);
            },),).toBe(false,);
          },
        },),

        it({
          name: 'TAKES ONE READING FOR EVERY CALL OF THE RUN, a second call and two calls made at the same time '
            + 'awaiting the first reading rather than reading again',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
            const { client, exchanges, } = scriptedClient({ dir: scratch.path, },);
            await Promise.all([ask({ client, },), ask({ client, },),],);
            await ask({ client, },);
            expect(quotaExchangesOf({ exchanges, },).length,).toBe(1,);
            expect(chatExchangesOf({ exchanges, },).length,).toBe(3,);
          },
        },),

        it({
          name: 'NEVER BLOCKS A CALL FOR A READ THAT FAILED, a refused status, a body that is not the documented shape '
            + 'and a dropped connection alike: the call is sent, the failure is warned with its kind, and the read is '
            + 'not tried again',
          fn: async ctx => {
            /**
             Runs two calls on a run whose quota read fails.

             @param reply - what the quota route does

             @returns Quota reads and chat requests the transport saw
             */
            async function failingRun(reply: QuotaReply,): Promise<readonly number[]> {
              await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
              const { client, exchanges, } = scriptedClient({
                dir: scratch.path,
                quota: [reply,],
                dayStartSetting: MIDNIGHT_SETTING,
              },);
              expect((await ask({ client, },)).text,).toBe('{"spot":"sunbeam"}',);
              await ask({ client, },);
              return [quotaExchangesOf({ exchanges, },).length, chatExchangesOf({ exchanges, },).length,];
            }
            /**
             Reads and requests of each run.
             */
            const counts: (readonly number[])[] = [];
            /**
             Lines the failed reads logged.
             */
            const lines = await consoleLinesDuring({
              run: async function runs(): Promise<void> {
                /**
                 Reads and requests of every run, made at once.
                 */
                const made = await Promise.all(FAILURES.map(async function run([reply,],) {
                  return await failingRun(reply,);
                },),);
                counts.push(...made,);
              },
              sinon: ctx.sinon,
            },);
            expect(counts,).toEqual([[1, 2,], [1, 2,], [1, 2,],],);
            for (const [, kind,] of FAILURES) {
              expect(lines.some(function warns(line,): boolean {
                return line.includes(`NeuralWatt quota could not be read before the first call (${kind})`,)
                  && line.includes('no starting reading to compare with',);
              },),).toBe(true,);
            }
          },
        },),
      ],
    },),

    describe({
      name: 'the end report',
      children: [
        it({
          name: 'TAKES NO READING FOR A RUN THAT MADE NO NEURALWATT CALL, and says no starting reading was taken',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
            const { client, exchanges, } = scriptedClient({ dir: scratch.path, },);
            expect(await client.planSpend({ signal: SIGNAL, },),).toEqual({
              kind: 'not-comparable',
              reason: 'the run made no NeuralWatt call, so no starting reading was taken',
            },);
            expect(exchanges.length,).toBe(0,);
          },
        },),

        it({
          name: 'DOES NOT READ AGAIN WHEN THE BASELINE COULD NOT BE TAKEN, and says so, since there is nothing to '
            + 'compare a later reading with',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
            const { client, exchanges, } = scriptedClient({
              dir: scratch.path,
              quota: [{ status: 403, bodyText: 'Forbidden', }, quotaReply({ kwhUsed: 14, }),],
              dayStartSetting: MIDNIGHT_SETTING,
            },);
            await ask({ client, },);
            expect(await client.planSpend({ signal: SIGNAL, },),).toEqual({
              kind: 'not-comparable',
              reason: 'the starting reading could not be taken',
            },);
            expect(quotaExchangesOf({ exchanges, },).length,).toBe(1,);
          },
        },),

        it({
          name: 'REPORTS THE DIFFERENCE OF THE TWO READINGS as plan energy spent, the second read a GET to the same '
            + 'route as the first',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
            const { client, exchanges, } = scriptedClient({
              dir: scratch.path,
              quota: [quotaReply({ kwhUsed: 13.9023, }), quotaReply({ kwhUsed: 13.9523, }),],
            },);
            await ask({ client, },);
            /**
             Difference of the two readings.
             */
            const spend = await client.planSpend({ signal: SIGNAL, },);
            expect(spend.kind,).toBe('measured',);
            if (spend.kind === 'measured') {
              expect(spend.kwh,).toBeCloseTo(0.05, 9,);
              expect(spend.inOverage,).toBe(false,);
            }
            expect(quotaExchangesOf({ exchanges, },).map(function urlOf(exchange,): string {
              return exchange.url;
            },),).toEqual([`${BASE_URL}/quota`, `${BASE_URL}/quota`,],);
          },
        },),

        it({
          name: 'DECLINES TO COMPARE READINGS THAT CANNOT BE COMPARED, a billing period that rolled over between them, '
            + 'and says why',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
            const { client, } = scriptedClient({
              dir: scratch.path,
              quota: [
                quotaReply({ kwhUsed: 19, }),
                quotaReply({ kwhUsed: 0.2, periodStart: '2026-11-11T05:05:25Z', }),
              ],
            },);
            await ask({ client, },);
            /**
             Comparison of the start with the reading of the next period.
             */
            const spend = await client.planSpend({ signal: SIGNAL, },);
            expect(spend.kind,).toBe('not-comparable',);
            if (spend.kind === 'not-comparable')
              expect(spend.reason,).toContain('billing period',);
          },
        },),

        it({
          name: 'SAYS THE READING AT THE END COULD NOT BE TAKEN when it fails, a refused status, a body that is not '
            + 'the documented shape and a dropped connection alike, warning with the kind of failure and never throwing',
          fn: async ctx => {
            /**
             Reports the end of a run whose second quota read fails.

             @param reply - what the quota route does the second time

             @returns What the end report said
             */
            async function endOfRun(reply: QuotaReply,) {
              await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-quota-', },);
              const { client, } = scriptedClient({
                dir: scratch.path,
                quota: [quotaReply({ kwhUsed: 13.9023, }), reply,],
              },);
              await ask({ client, },);
              return await client.planSpend({ signal: SIGNAL, },);
            }
            /**
             What each run's end report said.
             */
            const spends: unknown[] = [];
            /**
             Lines the failed reads logged.
             */
            const lines = await consoleLinesDuring({
              run: async function runs(): Promise<void> {
                /**
                 End report of every run, made at once.
                 */
                const reported = await Promise.all(FAILURES.map(async function run([reply,],) {
                  return await endOfRun(reply,);
                },),);
                spends.push(...reported,);
              },
              sinon: ctx.sinon,
            },);
            expect(spends,).toEqual(FAILURES.map(function said(): unknown {
              return { kind: 'not-comparable', reason: 'the reading at the end of the run could not be taken', };
            },),);
            for (const [, kind,] of FAILURES) {
              expect(lines.some(function warns(line,): boolean {
                return line.includes(`NeuralWatt quota could not be read at the end of the run (${kind})`,);
              },),).toBe(true,);
            }
          },
        },),
      ],
    },),
  ],
},);
