/**
 Tests for the streaming map's yield order, failure surfacing, and shutdown.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  pMapIterable,
  pMapSkip,
} from '../dist/final/neutral/index.mjs';

import { yieldTurn, } from './test-support.ts';

await describe({
  name: pMapIterable.name,
  children: [
    it({
      name: 'yields mapper results in input order',
      fn: async () => {
        /**
         Streamed values in yield order.
         */
        const streamed: number[] = [];
        for await (const mapped of pMapIterable({
          iterable: [
            3,
            1,
            2,
          ],
          mapper: function identity(value: number,): number {
            return value;
          },
        }))
          streamed.push(mapped,);
        expect(streamed,).toEqual([
          3,
          1,
          2,
        ],);
      },
    },),

    it({
      name: 'yields nothing for an empty input',
      fn: async () => {
        /**
         Streamed values in yield order.
         */
        const streamed: number[] = [];
        for await (const mapped of pMapIterable({
          iterable: [],
          mapper: function unusedMapper(value: unknown,): unknown {
            return value;
          },
        }))
          streamed.push(mapped as number,);
        expect(streamed,).toEqual([],);
      },
    },),

    it({
      name: 'awaits promise elements before invoking the mapper',
      fn: async () => {
        /**
         Streamed values in yield order.
         */
        const streamed: number[] = [];
        for await (const mapped of pMapIterable({
          iterable: [
            Promise.resolve(1,),
            Promise.resolve(2,),
          ],
          mapper: function double(value: number,): number {
            return value * 2;
          },
        }))
          streamed.push(mapped,);
        expect(streamed,).toEqual([
          2,
          4,
        ],);
      },
    },),

    it({
      name: 'walks an asynchronous source',
      fn: async () => {
        /**
         Asynchronous source yielding two values.
         */
        const asyncIterable: AsyncIterable<number> = {
          [Symbol.asyncIterator]: function openAsyncIterable(): AsyncIterator<number> {
            const cursor = {
              position: 0,
            };
            return {
              next: async function asyncNext(): Promise<IteratorResult<number>> {
                if (cursor.position >= 2)
                  return {
                    done: true,
                    value: undefined,
                  };
                cursor.position += 1;
                return {
                  done: false,
                  value: cursor.position,
                };
              },
            };
          },
        };
        /**
         Streamed values in yield order.
         */
        const streamed: number[] = [];
        for await (const mapped of pMapIterable({
          iterable: asyncIterable,
          mapper: function double(value: number,): number {
            return value * 2;
          },
        }))
          streamed.push(mapped,);
        expect(streamed,).toEqual([
          2,
          4,
        ],);
      },
    },),

    it({
      name: 'drops skipped results instead of yielding them',
      fn: async () => {
        /**
         Streamed values in yield order.
         */
        const streamed: number[] = [];
        for await (const mapped of pMapIterable({
          iterable: [
            1,
            2,
            3,
          ],
          mapper: function dropEvens(value: number,): number | typeof pMapSkip {
            return ((value % 2) === 0)
              ? pMapSkip
              : value;
          },
        }))
          streamed.push(mapped,);
        expect(streamed,).toEqual([
          1,
          3,
        ],);
      },
    },),

    it({
      name: 'throws the mapper failure from the async iterator',
      fn: async () => {
        /**
         Failure observed from the iteration.
         */
        let caught: unknown;
        try {
          for await (const mapped of pMapIterable({
            iterable: [
              1,
              2,
            ],
            mapper: function failingOnTwo(value: number,): number {
              if (value === 2)
                throw new Error('mapper failed',);
              return value;
            },
          }))
            void mapped;
        }
        catch (error) {
          caught = error;
        }
        expect((caught as Error).message,).toBe('mapper failed',);
      },
    },),

    it({
      name: 'closes the source and stops spawning once the consumer breaks early',
      fn: async () => {
        /**
         Close telemetry for this source.
         */
        const closeState = {
          returnCalled: false,
        };
        /**
         Pull counter proving the source was not walked past the break.
         */
        const pullState = {
          pulls: 0,
        };
        /**
         Source counting pulls and recording its shutdown.
         */
        const countedIterable: Iterable<number> = {
          [Symbol.iterator]: function openCountedIterator(): Iterator<number> {
            return {
              next: function countedNext(): IteratorResult<number> {
                pullState.pulls += 1;
                return {
                  done: false,
                  value: pullState.pulls,
                };
              },
              return: function countedReturn(): IteratorResult<number> {
                closeState.returnCalled = true;
                return {
                  done: true,
                  value: undefined,
                };
              },
            };
          },
        };

        for await (const mapped of pMapIterable({
          iterable: countedIterable,
          mapper: function identity(value: number,): number {
            return value;
          },
          options: {
            concurrency: 1,
            backpressure: 1,
          },
        })) {
          expect(mapped,).toBe(1,);
          break;
        }
        await yieldTurn();
        expect(closeState.returnCalled,).toBe(true,);
        /**
         Pulls after the consumer's break; upstream stops pulling there, so
         this must stay within the spawn already in flight.
         */
        const pullsAtBreak = pullState.pulls;
        await yieldTurn();
        expect(pullState.pulls,).toBe(pullsAtBreak,);
      },
    },),

    it({
      name: 're-walks the source on a second iteration',
      fn: async () => {
        /**
         Stream under test, iterated twice.
         */
        const stream = pMapIterable({
          iterable: [
            1,
            2,
          ],
          mapper: function double(value: number,): number {
            return value * 2;
          },
        });
        /**
         First walk's streamed values.
         */
        const first: number[] = [];
        for await (const value of stream)
          first.push(value,);
        /**
         Second walk's streamed values.
         */
        const second: number[] = [];
        for await (const value of stream)
          second.push(value,);
        expect(first,).toEqual([
          2,
          4,
        ],);
        expect(second,).toEqual([
          2,
          4,
        ],);
      },
    },),
  ],
},);
