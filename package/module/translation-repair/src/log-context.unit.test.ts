/**
 Tests for the context a line carries: which entry, lane and slice it belongs
 to (ledger A11).

 Cat-themed invention throughout.

 @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  contextRoot,
  currentLogContext,
  inEntryLogContext,
  inSliceLogContext,
  sliceTagged,
} from '../dist/final/node/index.mjs';

/**
 Collects what `console.info`, where the tagged logger's `info` sink resolves,
 receives while one piece of work runs.

 @param run - work that logs

 @returns Lines printed

 @example
 ```ts
 const lines = await infoLinesOf({ run: async () => { l.info('purr',); }, },);
 ```
 */
async function infoLinesOf(
  { run, }: { readonly run: () => Promise<void>; },
): Promise<readonly string[]> {
  /**
   Lines printed.
   */
  const lines: string[] = [];
  /**
   `console.info` as it was, put back once the work returns.
   */
  const informed = console.info;
  console.info = (...parts: readonly unknown[]) => {
    lines.push(parts.map(String,)
      .join(' ',),);
  };
  await using restore = {
    [Symbol.asyncDispose]: async () => {
      console.info = informed;
    },
  };
  await run();
  return lines;
}

await describe({
  name: inSliceLogContext.name,
  children: [
    it({
      name: 'READS empty outside any entry, the entry inside one, and entry, lane and slice inside a slice',
      fn: async () => {
        expect(currentLogContext(),).toStrictEqual({
          entry: '',
          generation: '',
          lane: '',
          slice: '',
        },);
        await inEntryLogContext({
          entry: 'Tabby',
          generation: 'nap-3',
          run: async () => {
            expect(currentLogContext().entry,).toBe('Tabby',);
            await inSliceLogContext({
              lane: 'repair',
              sliceIndex: 3,
              run: async () => {
                expect(currentLogContext(),).toStrictEqual({
                  entry: 'Tabby',
                  generation: 'nap-3',
                  lane: 'repair',
                  slice: '3',
                },);
              },
            },);
            expect(currentLogContext().slice,).toBe('',);
          },
        },);
      },
    },),
    it({
      name: 'KEEPS each concurrent slice in its own context across awaits',
      fn: async () => {
        /**
         Slice each concurrent run saw after yielding.
         */
        const seen = await inEntryLogContext({
          entry: 'Calico',
          generation: 'nap-3',
          run: async () => await Promise.all([
            1,
            2,
          ].map(async function settleOne(sliceIndex,): Promise<string> {
            return await inSliceLogContext({
              lane: 'translate',
              sliceIndex,
              run: async () => {
                // A timer turn, so the two slices interleave.
                await wait(0,);
                return currentLogContext().slice;
              },
            },);
          },),),
        },);
        expect(seen,).toStrictEqual([
          '1',
          '2',
        ],);
      },
    },),
  ],
},);

await describe({
  name: contextRoot.name,
  // SEQUENTIAL: each case diverts the one global `console.info` across an await.
  concurrency: 1,
  children: [
    it({
      name: 'NAMES the entry, lane and slice after the root tag, and nothing outside an entry',
      fn: async () => {
        /**
         Root logger under test.
         */
        const l = contextRoot({ tag: 'whiskers', },);
        /**
         Lines printed inside a slice and outside any entry.
         */
        const lines = await infoLinesOf({
          run: async () => {
            await inEntryLogContext({
              entry: 'Tabby',
              generation: 'nap-3',
              run: async () => {
                await inSliceLogContext({
                  lane: 'repair',
                  sliceIndex: 3,
                  run: async () => {
                    l.info('purr in the slice',);
                  },
                },);
              },
            },);
            l.info('purr outside',);
          },
        },);
        expect(lines.some(function tagsSlice(line,): boolean {
          return line.includes('[whiskers] [Tabby] [repair slice 3] purr in the slice',);
        },),).toBe(true,);
        expect(lines.some(function bareOutside(line,): boolean {
          return line.includes('[whiskers] purr outside',);
        },),).toBe(true,);
      },
    },),
    it({
      name: 'ADDS only the lane and slice to a logger already tagged with the entry',
      fn: async () => {
        /**
         Entry logger under test, tagged with the entry the way the pass
         tags it.
         */
        const l = sliceTagged({ l: tagged({ tag: 'Tabby', },), },);
        /**
         Lines printed inside one slice.
         */
        const lines = await infoLinesOf({
          run: async () => {
            await inSliceLogContext({
              lane: 'consolidation',
              sliceIndex: 7,
              run: async () => {
                l.info('kneads',);
              },
            },);
          },
        },);
        expect(lines.some(function tagsSliceOnce(line,): boolean {
          return line.includes('[Tabby] [consolidation slice 7] kneads',);
        },),).toBe(true,);
      },
    },),
  ],
},);
