/**
 Tests the NeuralWatt energy ledger: the meter this pipeline keeps itself for
 the 550 Wh of free energy a day, because no API reports what is left of it
 (`https://docs.neuralwatt.com/billing/daily-free-energy`, fetched
 2026-10-20: "It resets every day at 00:00 UTC. Unused free energy doesn't
 carry over.").

 Every case writes a ledger file in a throwaway directory and reads time from
 a clock the case holds, so no case reads the real ledger or the real clock.
 Fixtures are cat-themed invention.

 @module
 */

import {
  appendFile,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createNeuralWattLedger,
  defaultNeuralWattLedgerPath,
  NEURALWATT_DAILY_WH,
  NEURALWATT_DAILY_WH_VAR,
  NEURALWATT_LEDGER_PATH_VAR,
  NeuralWattAllowanceOverrideError,
  neuralWattDailyWhFrom,
  NeuralWattLedgerShapeError,
  neuralWattLedgerPathFrom,
} from '../dist/final/node/index.mjs';
import {
  handClock,
  lineOf,
} from './neuralwatt-ledger.test-fixture.ts';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/rejecting-call.test-fixture.ts';
import { scratchDir, } from '@monochromatic-dev/translation-repair-test-fixture/ts/scratch-dir.test-fixture.ts';

/**
 Model every case spends on.
 */
const MODEL = 'deepseek-v4.1-flash';

await describe({
  name: 'NeuralWatt ledger',
  concurrency: 1,
  children: [
    describe({
      name: 'where it lives and how much a day it holds',
      children: [
        it({
          name: 'STANDS AT 550 WATT-HOURS A DAY, the owner\'s 500 on the Max plan and 50 for the product-news email, '
            + 'and LIVES UNDER THE STATE DIRECTORY OF THE HOME THE PROCESS RUNS AS',
          fn: async () => {
            expect(NEURALWATT_DAILY_WH,).toBe(550,);
            expect(defaultNeuralWattLedgerPath({ home: '/home/whiskers', },),).toBe(
              '/home/whiskers/.local/state/translation-repair/neuralwatt-energy.jsonl',
            );
          },
        },),

        it({
          name: 'TAKES BOTH FROM THE ENVIRONMENT WHEN IT NAMES THEM and from the built-in otherwise, empty counting '
            + 'as absent',
          fn: async () => {
            expect(neuralWattDailyWhFrom({ env: {}, },),).toBe(550,);
            expect(neuralWattDailyWhFrom({ env: { [NEURALWATT_DAILY_WH_VAR]: '  ', }, },),).toBe(550,);
            expect(neuralWattDailyWhFrom({ env: { [NEURALWATT_DAILY_WH_VAR]: '120.5', }, },),).toBe(120.5,);
            expect(neuralWattDailyWhFrom({ env: { [NEURALWATT_DAILY_WH_VAR]: '0', }, },),).toBe(0,);
            expect(neuralWattLedgerPathFrom({ env: {}, home: '/home/whiskers', },),).toBe(
              '/home/whiskers/.local/state/translation-repair/neuralwatt-energy.jsonl',
            );
            expect(neuralWattLedgerPathFrom({
              env: { [NEURALWATT_LEDGER_PATH_VAR]: '/var/tmp/nap.jsonl', },
              home: '/home/whiskers',
            },),).toBe('/var/tmp/nap.jsonl',);
          },
        },),

        it({
          name: 'REFUSES AN ALLOWANCE THAT IS NOT A PLAIN NON-NEGATIVE DECIMAL, naming the variable and quoting it',
          fn: async () => {
            for (const value of ['plenty', '-5', '1e3', '0x10', '+5', 'NaN', '5 Wh',]) {
              /**
               What reading that value throws.
               */
              const refusal = caught(function read(): void {
                neuralWattDailyWhFrom({ env: { [NEURALWATT_DAILY_WH_VAR]: value, }, },);
              },);
              expect(refusal,).toBeInstanceOf(NeuralWattAllowanceOverrideError,);
              expect(String(refusal,),).toContain(NEURALWATT_DAILY_WH_VAR,);
              expect(String(refusal,),).toContain(JSON.stringify(value,),);
            }
          },
        },),
      ],
    },),

    describe({
      name: 'the UTC day',
      children: [
        it({
          name: 'READS A FILE THAT WAS NEVER WRITTEN AS A DAY NOTHING WAS SPENT ON',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path: join(scratch.path, 'none.jsonl',), dailyWh: 550, now, },);
            expect(await ledger.read(),).toEqual({
              day: '2026-10-20',
              dailyWh: 550,
              spentWh: 0,
              reckonedWh: 0,
              reservedWh: 0,
              remainingWh: 550,
              billedToday: false,
              calls: 0,
            },);
          },
        },),

        it({
          name: 'COUNTS ONLY THE ENTRIES THAT FALL ON TODAY\'S UTC DATE, so a run that crosses 00:00 UTC sees the '
            + 'allowance come back and an entry a millisecond before midnight is yesterday\'s',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'energy.jsonl',);
            await writeFile(
              path,
              lineOf({ at: '2026-10-20T23:59:59.999Z', model: MODEL, wh: 540, promptTokens: 100, },)
                + lineOf({ at: '2026-10-20T02:00:00.000Z', model: MODEL, wh: 5, promptTokens: 100, },),
              'utf8',
            );
            const { now, setTo, } = handClock({ start: '2026-10-20T23:59:59.999Z', },);
            const ledger = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            expect((await ledger.read()).spentWh,).toBe(545,);
            expect((await ledger.read()).remainingWh,).toBe(5,);
            setTo('2026-10-21T00:00:00.000Z',);
            expect(await ledger.read(),).toEqual({
              day: '2026-10-21',
              dailyWh: 550,
              spentWh: 0,
              reckonedWh: 0,
              reservedWh: 0,
              remainingWh: 550,
              billedToday: false,
              calls: 0,
            },);
          },
        },),

        it({
          name: 'READS THE DAY IN UTC WHATEVER ZONE THE PROCESS RUNS IN: an entry stamped with an offset is placed by '
            + 'the instant it names',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'energy.jsonl',);
            // 2026-10-20T22:30:00-04:00 is 2026-10-21T02:30:00Z, tomorrow's date in UTC.
            await writeFile(path, lineOf({ at: '2026-10-20T22:30:00.000-04:00', model: MODEL, wh: 9, promptTokens: 1, },), 'utf8',);
            const { now, } = handClock({ start: '2026-10-21T10:00:00.000Z', },);
            expect((await createNeuralWattLedger({ path, dailyWh: 550, now, },).read()).spentWh,).toBe(9,);
          },
        },),
      ],
    },),

    describe({
      name: 'reserving, settling and abandoning',
      children: [
        it({
          name: 'GRANTS A CALL THAT FITS, HOLDS ITS ESTIMATE AGAINST THE ALLOWANCE while it is in flight, and refuses '
            + 'one that does not fit, saying what was left',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path: join(scratch.path, 'e.jsonl',), dailyWh: 1, now, },);
            const first = await ledger.reserve({ model: MODEL, promptTokens: 100, estimateWh: 0.6, },);
            expect(first.granted,).toBe(true,);
            expect((await ledger.read()).reservedWh,).toBe(0.6,);
            expect((await ledger.read()).remainingWh,).toBeCloseTo(0.4, 12,);
            const second = await ledger.reserve({ model: MODEL, promptTokens: 100, estimateWh: 0.6, },);
            expect(second.granted,).toBe(false,);
            if (!second.granted) {
              expect(second.energy.remainingWh,).toBeCloseTo(0.4, 12,);
              expect(second.estimateWh,).toBe(0.6,);
            }
          },
        },),

        it({
          name: 'LETS CONCURRENT CALLS NOT EACH SEE THE SAME REMAINDER: two reserved at once against room for one '
            + 'are granted once and refused once',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path: join(scratch.path, 'e.jsonl',), dailyWh: 1, now, },);
            const outcomes = await Promise.all([
              ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.7, },),
              ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.7, },),
              ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.7, },),
            ],);
            expect(outcomes.filter(function granted(outcome,): boolean {
              return outcome.granted;
            },).length,).toBe(1,);
          },
        },),

        it({
          name: 'SETTLES AT THE MEASURED ENERGY, which replaces the estimate: the hold is released, the measured '
            + 'watt-hours are appended unmarked, and the day\'s spend is the measured figure',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'e.jsonl',);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 321, estimateWh: 0.5, },);
            if (!outcome.granted)
              throw new Error('the call fits and should have been granted',);
            await outcome.reservation.settle({ measuredWh: 0.015, },);
            expect(await ledger.read(),).toEqual({
              day: '2026-10-20',
              dailyWh: 550,
              spentWh: 0.015,
              reckonedWh: 0,
              reservedWh: 0,
              remainingWh: 549.985,
              billedToday: false,
              calls: 1,
            },);
            expect(JSON.parse((await readFile(path, 'utf8',)).trim(),),).toEqual({
              at: '2026-10-20T12:00:00.000Z',
              model: MODEL,
              wh: 0.015,
              promptTokens: 321,
            },);
          },
        },),

        it({
          name: 'KEEPS THE ESTIMATE WHEN NO ENERGY WAS MEASURED and marks the line estimated, the way the Bedrock '
            + 'ledger marks a reckoned one, so the share of the spend that rests on an estimate can be read',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'e.jsonl',);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 321, estimateWh: 0.5, },);
            if (!outcome.granted)
              throw new Error('the call fits and should have been granted',);
            await outcome.reservation.settle({},);
            expect(JSON.parse((await readFile(path, 'utf8',)).trim(),),).toEqual({
              at: '2026-10-20T12:00:00.000Z',
              model: MODEL,
              wh: 0.5,
              promptTokens: 321,
              estimated: 'unreported-estimate',
            },);
            expect((await ledger.read()).reckonedWh,).toBe(0.5,);
          },
        },),

        it({
          name: 'NOTES AN ATTEMPT THAT NEVER FINISHED AT ITS ESTIMATE while the hold for the next attempt stays, '
            + 'and a release that wrote nothing frees the hold of an attempt that delivered nothing',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'e.jsonl',);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 50, estimateWh: 0.25, },);
            if (!outcome.granted)
              throw new Error('the call fits and should have been granted',);
            await outcome.reservation.noteAbandoned();
            expect(JSON.parse((await readFile(path, 'utf8',)).trim(),),).toEqual({
              at: '2026-10-20T12:00:00.000Z',
              model: MODEL,
              wh: 0.25,
              promptTokens: 50,
              estimated: 'abandoned-estimate',
            },);
            expect(await ledger.read(),).toMatchObject({ spentWh: 0.25, reservedWh: 0.25, reckonedWh: 0.25, },);
            outcome.reservation.release();
            outcome.reservation.release();
            expect(await ledger.read(),).toMatchObject({ spentWh: 0.25, reservedWh: 0, },);
            expect((await readFile(path, 'utf8',)).trim().split('\n',).length,).toBe(1,);
          },
        },),

        it({
          name: 'REFUSES A SECOND SETTLEMENT OF ONE RESERVATION, since the call it stood for is over',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path: join(scratch.path, 'e.jsonl',), dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.1, },);
            if (!outcome.granted)
              throw new Error('the call fits and should have been granted',);
            await outcome.reservation.settle({ measuredWh: 0.05, },);
            expect(await rejectionOf(async function again(): Promise<void> {
              await outcome.reservation.settle({ measuredWh: 0.05, },);
            },),).toBeInstanceOf(Error,);
            expect((await ledger.read()).calls,).toBe(1,);
          },
        },),

        it({
          name: 'RELEASES THE HOLD WHEN THE LINE CANNOT BE WRITTEN, so a failed write leaves no phantom spend in flight',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            // A FILE STANDS WHERE THE LEDGER'S DIRECTORY SHOULD BE, so the write cannot succeed.
            const blocker = join(scratch.path, 'blocker',);
            await writeFile(blocker, 'a file, not a directory', 'utf8',);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path: join(blocker, 'e.jsonl',), dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.1, },);
            if (!outcome.granted)
              throw new Error('the call fits and should have been granted',);
            expect(await rejectionOf(async function write(): Promise<void> {
              await outcome.reservation.settle({ measuredWh: 0.05, },);
            },),).toBeInstanceOf(Error,);
            expect((await ledger.read()).reservedWh,).toBe(0,);
          },
        },),
      ],
    },),

    describe({
      name: 'a request that was billed',
      children: [
        it({
          name: 'MARKS THE DAY BILLED when a settlement carries a nonzero cost, writing it in the ledger so the next '
            + 'run on the same UTC day sees it, and CLEARS THE MARK AT THE NEXT 00:00 UTC',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'e.jsonl',);
            const { now, setTo, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.1, },);
            if (!outcome.granted)
              throw new Error('the call fits and should have been granted',);
            await outcome.reservation.settle({ measuredWh: 0.05, billedUsd: 0.00001, },);
            expect((await ledger.read()).billedToday,).toBe(true,);
            expect(JSON.parse((await readFile(path, 'utf8',)).trim(),),).toMatchObject({ billedUsd: 0.00001, wh: 0.05, },);

            // A fresh ledger over the same file, as the next run builds.
            const nextRun = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            expect((await nextRun.read()).billedToday,).toBe(true,);
            setTo('2026-10-21T00:00:00.000Z',);
            expect((await nextRun.read()).billedToday,).toBe(false,);
          },
        },),

        it({
          name: 'DOES NOT MARK THE DAY FOR A COST OF ZERO, which is how a free request reads',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'e.jsonl',);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.1, },);
            if (!outcome.granted)
              throw new Error('the call fits and should have been granted',);
            await outcome.reservation.settle({ measuredWh: 0.05, billedUsd: 0, },);
            expect((await ledger.read()).billedToday,).toBe(false,);
            expect(JSON.parse((await readFile(path, 'utf8',)).trim(),).billedUsd,).toBeUndefined();
          },
        },),

        it({
          name: 'REFUSES A RESERVATION ON A BILLED DAY WHATEVER ENERGY IS LEFT, since a call sent then would be charged '
            + 'to the plan, and says so in the denial, so a client holding a stale reading cannot spend past the mark',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'e.jsonl',);
            await writeFile(path, lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: 1, promptTokens: 1, billedUsd: 0.2, },), 'utf8',);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            const ledger = createNeuralWattLedger({ path, dailyWh: 550, now, },);
            const outcome = await ledger.reserve({ model: MODEL, promptTokens: 1, estimateWh: 0.1, },);
            expect(outcome.granted,).toBe(false,);
            if (!outcome.granted)
              expect(outcome.energy,).toMatchObject({ billedToday: true, remainingWh: 549, },);
          },
        },),
      ],
    },),

    describe({
      name: 'a ledger line that will not read',
      children: [
        it({
          name: 'IS A THROWN ERROR NAMING THE FILE AND THE LINE, never a skipped line, since a ledger that dropped a '
            + 'line would report energy as unspent',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            /**
             Good line the bad ones follow.
             */
            const good = lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: 1, promptTokens: 1, },);
            const cases: readonly (readonly [string, string,])[] = [
              ['not valid JSON', '{"at":\n',],
              ['not a JSON object', '[1]\n',],
              ['at is not an instant', lineOf({ at: 'yesterday', model: MODEL, wh: 1, promptTokens: 1, },),],
              ['at is not an instant', lineOf({ at: 5, model: MODEL, wh: 1, promptTokens: 1, },),],
              ['model is not a string', lineOf({ at: '2026-10-20T01:00:00.000Z', model: 5, wh: 1, promptTokens: 1, },),],
              ['wh is not a non-negative number', lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: -1, promptTokens: 1, },),],
              ['wh is not a non-negative number', lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: '1', promptTokens: 1, },),],
              ['promptTokens is not a number', lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: 1, },),],
              ['estimated is not a reckoning this package writes', lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: 1, promptTokens: 1, estimated: 'guess', },),],
              ['billedUsd is not a positive number', lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: 1, promptTokens: 1, billedUsd: 0, },),],
            ];
            for (const [index, [detail, bad,],] of cases.entries()) {
              const path = join(scratch.path, `bad-${String(index,)}.jsonl`,);
              await writeFile(path, good, 'utf8',);
              await appendFile(path, bad, 'utf8',);
              /**
               What reading the file throws.
               */
              const refusal = await rejectionOf(async function read(): Promise<void> {
                await createNeuralWattLedger({ path, dailyWh: 550, now, },).read();
              },);
              expect(refusal,).toBeInstanceOf(NeuralWattLedgerShapeError,);
              expect(String(refusal,),).toContain(path,);
              expect(String(refusal,),).toContain('line 2',);
              expect(String(refusal,),).toContain(detail,);
            }
          },
        },),

        it({
          name: 'READS PAST BLANK LINES, which an editor or a torn append can leave, and counts the lines it reads',
          fn: async () => {
            await using scratch = await scratchDir({ prefix: 'whiskers-neuralwatt-', },);
            const path = join(scratch.path, 'e.jsonl',);
            const { now, } = handClock({ start: '2026-10-20T12:00:00.000Z', },);
            await writeFile(
              path,
              `\n${lineOf({ at: '2026-10-20T01:00:00.000Z', model: MODEL, wh: 1, promptTokens: 1, },)}\n\n`
                + lineOf({ at: '2026-10-20T02:00:00.000Z', model: 'glm-5.3-flash', wh: 2, promptTokens: 1, },),
              'utf8',
            );
            expect(await createNeuralWattLedger({ path, dailyWh: 550, now, },).read(),).toMatchObject({
              spentWh: 3,
              calls: 2,
            },);
          },
        },),
      ],
    },),
  ],
},);
