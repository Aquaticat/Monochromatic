/**
 Tests what the seat reader says and does when the return it was told of lies past what the pass has left, and the
 bound itself.

 The reader refuses at once for such a return, and the words it refuses with state the return as past the pass in every
 place it speaks: the error line of a phase that goes on, the warning of a bench short of quorum, and the run-ending
 refusal of a reading where every provider is dry, which also carries the distance for the pass to read. A bound of zero
 or below (the pass or the entry's cap already spent) waits for no return at all.

 Every case here that names a return past the bound sleeps nothing, and reads the budgets on a frozen monotonic clock.

 Fixtures are cat-themed invention; every meter is a stub and no HTTP is made.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { EveryProviderDryError, } from '@monochromatic-dev/translation-repair-provider';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/corpus-run/rejection-of.test-fixture.ts';
import {
  levelCapturingLogger,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';
import {
  holdsWithinPass,
  readPhaseSeats,
  WritingBenchUnreachableError,
} from '../../dist/final/node/index.mjs';
import {
  clientBefore,
  SIGNAL,
} from './neuralwatt-seat-client.test-fixture.ts';

/**
 The clock the budgets count a return on, frozen so no host stall moves a distance between its reading and its hold.
 */
const FROZEN = (): number => 0;

await describe({
  name: 'the seat reader and a return past what the pass has left',
  concurrency: 1,
  children: [
    it({
      name: 'SAYS A RETURN PAST THE PASS IS NAMED in the error line of a phase that goes on without its writers, and '
        + 'does not say that no return was named: 700 away with 600 left',
      fn: async () => {
        const lines: string[] = [];
        const { client, reads, } = clientBefore({
          msBeforeReturn: 700,
          passLeftMs: 600,
          syntheticWet: false,
          now: FROZEN,
        },);
        const { unreachableWriters, } = await readPhaseSeats({
          client,
          phase: 'page consistency',
          signal: SIGNAL,
          l: levelCapturingLogger({ lines, },),
          pollMs: 5,
        },);
        expect(unreachableWriters.length,).toBeGreaterThan(0,);
        expect(reads.count,).toBe(1,);
        /**
         The error line the reading wrote.
         */
        const errorLine = lines.find(function isError(line,): boolean {
          return line.startsWith('error JUDGE SEATS',);
        },);
        expect(errorLine,).toContain('this pass has left',);
        expect(errorLine,).not.toContain('no provider has named its return',);
        expect(errorLine,).toContain('no provider has named a return the pass can wait for',);
      },
    },),

    it({
      name: 'SAYS A RETURN PAST THE PASS IS NAMED in the warning of a bench short of quorum that stops no entry (the '
        + 'readers at the pictures, every provider dry), instead of saying no provider named one',
      fn: async () => {
        const lines: string[] = [];
        const { client, } = clientBefore({ msBeforeReturn: 700, passLeftMs: 600, syntheticWet: false, now: FROZEN, },);
        await readPhaseSeats({
          client,
          phase: 'pictures',
          signal: SIGNAL,
          l: levelCapturingLogger({ lines, },),
          pollMs: 5,
        },);
        /**
         The warning the reading wrote.
         */
        const warning = lines.find(function isShort(line,): boolean {
          return line.startsWith('warn JUDGE SEATS phase=pictures short of quorum',);
        },);
        expect(warning,).toContain('this pass has left',);
        expect(warning,).not.toContain('no provider has named its return',);
      },
    },),

    it({
      name: 'ENDS THE RUN WITH THE DISTANCE AND THE PASS SENTENCE when every provider is dry and the return lies past the '
        + 'pass: the refusal carries the milliseconds to the return for the pass to read, states the time of day, says '
        + 'the pass has less left, and prints no NeuralWatt hold it did not wait for',
      fn: async () => {
        const { client, reads, } = clientBefore({
          msBeforeReturn: 700,
          passLeftMs: 600,
          syntheticWet: false,
          now: FROZEN,
        },);
        const refusal = await rejectionOf({
          promise: readPhaseSeats({
            client,
            phase: 'lanes',
            signal: SIGNAL,
            l: levelCapturingLogger({ lines: [], },),
            pollMs: 5,
          },),
        },);
        expect(refusal,).toBeInstanceOf(EveryProviderDryError,);
        expect((refusal as EveryProviderDryError).neuralwattReturnsInMs,).toBe(700,);
        expect((refusal as EveryProviderDryError).message,).toContain('19:15:08 UTC',);
        expect((refusal as EveryProviderDryError).message,).toContain('this pass has left',);
        expect((refusal as EveryProviderDryError).message,).not.toContain('neuralwatt 700ms',);
        expect(reads.count,).toBe(1,);
      },
    },),

    it({
      name: 'WAITS FOR NO RETURN WHEN THE BOUND IS ZERO OR BELOW, the pass or the entry\'s cap already spent: a return '
        + '5 away with a bound of -1 refuses at once and the sentence reads 0 s, never a negative number',
      fn: async () => {
        const { client, reads, } = clientBefore({ msBeforeReturn: 5, passLeftMs: -1, now: FROZEN, },);
        const refusal = await rejectionOf({
          promise: readPhaseSeats({
            client,
            phase: 'lanes',
            signal: SIGNAL,
            l: levelCapturingLogger({ lines: [], },),
            pollMs: 5,
          },),
        },);
        expect(refusal,).toBeInstanceOf(WritingBenchUnreachableError,);
        expect((refusal as WritingBenchUnreachableError).message,).toContain('past the 0 s this pass has left',);
        expect(reads.count,).toBe(1,);
      },
    },),

    describe({
      name: holdsWithinPass.name,
      concurrency: 1,
      children: [
        it({
          name: 'HANDS THE CLIENT\'S BOUND TO THE HOLDS, and no bound where the client carries none',
          fn: async () => {
            /**
             The bounds the holds were asked for.
             */
            const asked: number[] = [];
            const holds = {
              neuralwatt: 0,
              synthetic: 0,
              bedrock: 0,
              deepseek: 0,
              xiaomi: 0,
              hyper: 0,
              openrouter: 0,
            };
            /**
             Records the bound a reading asked for.

             @param args - what the reading handed over

             @returns No hold
             */
            function providerHolds(args?: { readonly returnBoundMs?: number; },): typeof holds {
              asked.push(args?.returnBoundMs ?? Number.NaN,);
              return holds;
            }
            holdsWithinPass({ client: { providerHolds, passLeftMs: () => 600, }, },);
            holdsWithinPass({ client: { providerHolds, }, },);
            expect(asked,).toEqual([600, Number.POSITIVE_INFINITY,],);
          },
        },),
      ],
    },),
  ],
},);
