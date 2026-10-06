/**
 Tests for the queue a corpus pass runs its entries through: each attempt is
 counted and persisted before it starts, runs under its entry's name, and
 the run stops at the soft budget or the spend allowance.

 Every effect is injected: the settlement is scripted, the clock is a list of
 instants and the runs directory is a throwaway, so no case reads a corpus or
 calls a provider.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type AttemptMap,
  currentLogContext,
  readAttemptMap,
  resetRunSpend,
  runPassQueue,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { relayingConsoleLog, } from './console-log-capture.test-fixture.ts';

/**
 Generation every case's attempts run under.
 */
const GENERATION = `sha256-tree-v1:${'c'.repeat(64,)}`;

/**
 A pair of invented pages.

 @param id - entry id

 @returns The pair

 @example
 ```ts
 const pair = pairOf({ id: 'tabby', },);
 ```
 */
function pairOf({ id, }: { readonly id: string; },): {
  readonly id: string;
  readonly sourceText: string;
  readonly targetText: string;
} {
  return {
    id,
    sourceText: '猫睡觉。\n',
    targetText: 'The cat naps.\n',
  };
}

/**
 A clock reading each instant of a list in turn, and the last one for ever.

 @param instants - what it reads, first first

 @returns The clock

 @example
 ```ts
 const now = clockReading({ instants: [0, 5,], },);
 ```
 */
function clockReading({ instants, }: { readonly instants: readonly number[]; },): () => number {
  /**
   Readings not yet taken.
   */
  const remaining = [...instants,];

  /**
   Instant every reading after the list answers.
   */
  const last = instants.at(-1,) ?? 0;
  return function now(): number {
    return remaining.shift() ?? last;
  };
}

await describe({
  name: runPassQueue.name,
  concurrency: 1,
  children: [
    it({
      name: 'COUNTS AND PERSISTS AN ATTEMPT BEFORE IT RUNS, and settles each entry under its own name and the '
        + 'build, so a crash still records that the attempt happened',
      fn: async (ctx) => {
        resetRunSpend();
        using _printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-queue-', },);
        /**
         Where the counts are persisted.
         */
        const attemptsPath = join(
          scratch.path,
          'attempts.json',
        );
        /**
         Counts this run keeps.
         */
        const attempts: AttemptMap = new Map([
          [
            'tabby',
            2,
          ],
        ],);
        /**
         What each settlement saw when it started.
         */
        const seen: {
          readonly entry: string;
          readonly persisted: ReadonlyMap<string, number>;
          readonly context: string;
          readonly generation: string;
        }[] = [];

        await runPassQueue({
          pending: [
            pairOf({ id: 'tabby', },),
            pairOf({ id: 'mittens', },),
          ],
          attempts,
          attemptsPath,
          sliceCacheDir: join(
            scratch.path,
            'slice-cache',
          ),
          pipelineDigest: GENERATION,
          softBudgetMs: 1_000,
          spendCeilingUsd: 20,
          start: 0,
          now: clockReading({ instants: [0,], },),
          settle: async function settle({ entry, },) {
            seen.push({
              entry: entry.id,
              persisted: await readAttemptMap(attemptsPath,),
              context: currentLogContext().entry,
              generation: currentLogContext().generation,
            },);
            return { kind: 'settled', };
          },
        },);

        expect(seen,).toEqual([
          {
            entry: 'tabby',
            persisted: new Map([
              [
                'tabby',
                3,
              ],
            ],),
            context: 'tabby',
            generation: GENERATION,
          },
          {
            entry: 'mittens',
            persisted: new Map([
              [
                'tabby',
                3,
              ],
              [
                'mittens',
                1,
              ],
            ],),
            context: 'mittens',
            generation: GENERATION,
          },
        ],);
        expect(attempts,).toEqual(new Map([
          [
            'tabby',
            3,
          ],
          [
            'mittens',
            1,
          ],
        ],),);
      },
    },),
    it({
      name: 'STOPS AT THE SOFT BUDGET before the next entry starts, and says how long the run had gone',
      fn: async (ctx) => {
        resetRunSpend();
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-queue-', },);
        /**
         Entries settled.
         */
        const settled: string[] = [];

        await runPassQueue({
          pending: [
            pairOf({ id: 'tabby', },),
            pairOf({ id: 'mittens', },),
          ],
          attempts: new Map(),
          attemptsPath: join(
            scratch.path,
            'attempts.json',
          ),
          sliceCacheDir: join(
            scratch.path,
            'slice-cache',
          ),
          pipelineDigest: GENERATION,
          softBudgetMs: 1_000,
          spendCeilingUsd: 20,
          start: 100,
          now: clockReading({ instants: [
            100,
            1_100,
          ], },),
          settle: async function settle({ entry, },) {
            settled.push(entry.id,);
            return { kind: 'settled', };
          },
        },);

        expect(settled,).toEqual(['tabby',],);
        expect(printed.lines,).toEqual(['SOFT budget reached after 1000ms; not starting new entries',],);
      },
    },),
    it({
      name: 'STOPS BEFORE THE FIRST ENTRY under an allowance of nothing, and writes no attempt',
      fn: async (ctx) => {
        resetRunSpend();
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-queue-', },);
        /**
         Entries settled.
         */
        const settled: string[] = [];
        /**
         Counts this run keeps.
         */
        const attempts: AttemptMap = new Map();

        await runPassQueue({
          pending: [pairOf({ id: 'tabby', },),],
          attempts,
          attemptsPath: join(
            scratch.path,
            'attempts.json',
          ),
          sliceCacheDir: join(
            scratch.path,
            'slice-cache',
          ),
          pipelineDigest: GENERATION,
          softBudgetMs: 1_000,
          spendCeilingUsd: 0,
          start: 0,
          now: clockReading({ instants: [0,], },),
          settle: async function settle({ entry, },) {
            settled.push(entry.id,);
            return { kind: 'settled', };
          },
        },);

        expect(settled,).toEqual([],);
        expect(attempts,).toEqual(new Map(),);
        expect(printed.lines.length,).toBe(1,);
      },
    },),
    it({
      name: 'QUEUES A SECOND ATTEMPT FOR AN ENTRY THAT CACHED ONE SLICE under its own directory in the slice cache, '
        + 'and DROPS ONE THAT CACHED NONE, each said in the singular where it counts one',
      fn: async (ctx) => {
        resetRunSpend();
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-queue-', },);
        /**
         Slice cache the attempts write into.
         */
        const sliceCacheDir = join(
          scratch.path,
          'slice-cache',
        );
        /**
         Attempts made, by entry.
         */
        const made: string[] = [];

        await runPassQueue({
          pending: [
            pairOf({ id: 'tabby', },),
            pairOf({ id: 'mittens', },),
          ],
          attempts: new Map(),
          attemptsPath: join(
            scratch.path,
            'attempts.json',
          ),
          sliceCacheDir,
          pipelineDigest: GENERATION,
          softBudgetMs: 1_000,
          spendCeilingUsd: 20,
          start: 0,
          now: clockReading({ instants: [0,], },),
          settle: async function settle({ entry, },) {
            made.push(entry.id,);
            /**
             Attempts made so far on this entry, this one included.
             */
            const triesOfEntry = made.filter(function isThisEntry(id,): boolean {
              return id === entry.id;
            },).length;
            if ((entry.id === 'tabby') && (triesOfEntry === 1)) {
              await mkdir(
                join(
                  sliceCacheDir,
                  'tabby',
                ),
                { recursive: true, },
              );
              await writeFile(
                join(
                  sliceCacheDir,
                  'tabby',
                  '0.json',
                ),
                '{}',
              );
            }
            return { kind: 'resumable-failure', };
          },
        },);

        expect(made,).toEqual([
          'tabby',
          'mittens',
          'tabby',
        ],);
        expect(printed.lines,).toEqual([
          'REATTEMPT tabby queued: 1 more cache record than it had, so the next attempt starts further along',
          'STALLED mittens: its 0 cache records are what it started with, so a further attempt in this '
          + 'invocation would repeat it',
          'STALLED tabby: its 1 cache record is what it started with, so a further attempt in this '
          + 'invocation would repeat it',
        ],);
      },
    },),
    it({
      name: 'QUEUES A SECOND ATTEMPT FOR AN ENTRY THAT CACHED TWO SLICES and says so in the plural, then drops it '
        + 'when the second attempt caches nothing more',
      fn: async (ctx) => {
        resetRunSpend();
        using printed = relayingConsoleLog({ sinon: ctx.sinon, },);
        await using scratch = await scratchDir({ prefix: 'corpus-pass-queue-', },);
        /**
         Slice cache the attempts write into.
         */
        const sliceCacheDir = join(
          scratch.path,
          'slice-cache',
        );
        /**
         Where the entry's slices are cached.
         */
        const entryDir = join(
          sliceCacheDir,
          'tabby',
        );
        /**
         Attempts made.
         */
        let made = 0;

        await runPassQueue({
          pending: [pairOf({ id: 'tabby', },),],
          attempts: new Map(),
          attemptsPath: join(
            scratch.path,
            'attempts.json',
          ),
          sliceCacheDir,
          pipelineDigest: GENERATION,
          softBudgetMs: 1_000,
          spendCeilingUsd: 20,
          start: 0,
          now: clockReading({ instants: [0,], },),
          settle: async function settle() {
            made += 1;
            if (made === 1) {
              await mkdir(
                entryDir,
                { recursive: true, },
              );
              await writeFile(
                join(
                  entryDir,
                  '0.json',
                ),
                '{}',
              );
              await writeFile(
                join(
                  entryDir,
                  '1.json',
                ),
                '{}',
              );
            }
            return { kind: 'resumable-failure', };
          },
        },);

        expect(made,).toBe(2,);
        expect(printed.lines,).toEqual([
          'REATTEMPT tabby queued: 2 more cache records than it had, so the next attempt starts further along',
          'STALLED tabby: its 2 cache records are what it started with, so a further attempt in this '
          + 'invocation would repeat it',
        ],);
      },
    },),
  ],
},);
