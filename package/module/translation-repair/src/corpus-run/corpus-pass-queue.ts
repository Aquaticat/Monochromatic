import { join, } from 'node:path';

import { inEntryLogContext, } from '../log-context.ts';
import {
  type AttemptMap,
  countAttempt,
  writeAttemptMap,
} from './attempt-store.ts';
import { runAttemptQueue, } from './entry-attempt-queue.ts';
import { countCachedSlices, } from './entry-reattempt.ts';
import type {
  CorpusPair,
  EntryOutcome,
} from './pass-entry-contract.ts';
import { stopBeforeNextEntry, } from './pass-stop-before-next.ts';

//region Corpus pass queue
// Runs the pending entries one attempt at a time under the pass's budgets.

/**
 Runs every pending entry once, then re-runs the ones that earned it, counting
 and persisting each attempt before it starts and stopping at the soft budget
 or the spend ceiling.

 @param pending - entries in run order

 @param attempts - attempt counts this run keeps and persists

 @param attemptsPath - where the counts are persisted

 @param sliceCacheDir - root of the per-entry slice caches

 @param pipelineDigest - generation every log line of an attempt carries

 @param softBudgetMs - time after which no new entry starts

 @param spendCeilingUsd - USD the run may spend before it stops starting entries

 @param start - instant the processing loop began, on the clock `now` reads (ledger B78)

 @param now - clock the budget is read on, in milliseconds

 @param settle - settles one entry, given that entry; the pass's whole per-entry procedure

 @mutates attempts - counts one more attempt for an entry ahead of the attempt itself

 @example
 ```ts
 await runPassQueue({ pending, attempts, attemptsPath, sliceCacheDir, pipelineDigest, softBudgetMs, spendCeilingUsd, start, now, settle, },);
 ```
 */
export async function runPassQueue(
  {
    pending,
    attempts,
    attemptsPath,
    sliceCacheDir,
    pipelineDigest,
    softBudgetMs,
    spendCeilingUsd,
    start,
    now,
    settle,
  }: {
    readonly pending: readonly CorpusPair[];
    readonly attempts: AttemptMap;
    readonly attemptsPath: string;
    readonly sliceCacheDir: string;
    readonly pipelineDigest: string;
    readonly softBudgetMs: number;
    readonly spendCeilingUsd: number;
    readonly start: number;
    readonly now: () => number;
    readonly settle: (input: { readonly entry: CorpusPair; },) => Promise<EntryOutcome>;
  },
): Promise<void> {
  await runAttemptQueue({
    pending,

    cachedCountFor: function cachedCountFor({ entry, },): Promise<number> {
      return countCachedSlices({
        dir: join(
          sliceCacheDir,
          entry.id,
        ),
      },);
    },

    stopBeforeNext: function stopBeforeNext(): boolean {
      return stopBeforeNextEntry({
        elapsedMs: now() - start,
        softBudgetMs,
        ceilingUsd: spendCeilingUsd,
      },);
    },

    attempt: async function attempt({ entry, },): Promise<EntryOutcome> {
      countAttempt({
        attempts,
        id: entry.id,
      },);
      // Persisted before the attempt so a crash still records that it happened.
      await writeAttemptMap({
        attemptsPath,
        attempts,
      },);

      // Every line and ledger record written for this entry names it (ledger A11).
      return await inEntryLogContext({
        entry: entry.id,
        generation: pipelineDigest,
        run: async function settleInContext(): Promise<EntryOutcome> {
          return await settle({ entry, },);
        },
      },);
    },
  },);
}

//endregion Corpus pass queue
