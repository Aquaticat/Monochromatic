import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { readAttemptOutcome, } from './entry-reattempt.ts';

//region Entry attempt queue
// The loop `#196` turns on, lifted out of `corpus-pass.ts` so it can be tested
// without a corpus, a provider, or seven hours.
//
// `entry-reattempt.ts` decides whether ONE attempt earned another. This drives
// the sequence those verdicts produce, and the two questions are separable:
// a correct verdict used by a loop that never comes back settles nothing.
//
// EFFECTS ARE INJECTED rather than imported, because every one of them is
// either expensive or unavailable in a test: reading a cache directory,
// spending up to seven hours on an entry, and asking whether the run's wall
// budget is gone. What is left here is the ordering, which is the part with a
// defect worth catching.

/**
 * Least a queued entry must carry: something to name it by in a log line.
 */
export type QueueableEntry = {
  /**
   * Entry id, used only for reporting.
   */
  readonly id: string;
};

/**
 * Runs every pending entry once, then re-runs the ones that earned it.
 *
 * RE-ATTEMPTS GO TO THE BACK. Coverage of the corpus is what a first attempt
 * buys, so an oversized entry must not spend the run's budget before every
 * other entry has been tried at all. A queue gives that ordering for free:
 * pushing to the back cannot overtake anything still waiting.
 *
 * @param pending - entries to attempt, in the order the caller ranked them
 *
 * @param cachedCountFor - slices one entry holds, asked before and after each
 * attempt so progress is measured rather than assumed
 *
 * @param attempt - runs one attempt, reporting whether that entry settled
 *
 * @param stopBeforeNext - asked before each attempt; true ends the run. Owned
 * by the caller so the reason and its wording stay with the budget that knows
 * them, and it may log
 *
 * @example
 * ```ts
 * await runAttemptQueue({ pending, cachedCountFor, attempt, stopBeforeNext, },);
 * ```
 */
export async function runAttemptQueue<EntryT extends QueueableEntry,>(
  {
    pending,
    cachedCountFor,
    attempt,
    stopBeforeNext,
  }: {
    readonly pending: readonly EntryT[];
    readonly cachedCountFor: (args: { readonly entry: EntryT; },) => Promise<number>;
    readonly attempt: (args: { readonly entry: EntryT; },) => Promise<boolean>;
    readonly stopBeforeNext: () => boolean;
  },
): Promise<void> {
  /**
   * Attempts still to make, growing at the back as entries earn another.
   */
  const queue: EntryT[] = [...pending,];

  while (queue.length > 0) {
    /**
     * Next attempt, taken from the front.
     */
    const entry = nonNullishOrThrow(queue.shift(),);

    if (stopBeforeNext())
      return;

    /**
     * Slices this entry already holds.
     */
    /* oxlint-disable-next-line no-await-in-loop -- one cheap read per attempt, against an attempt that may run seven hours */
    const cachedBefore = await cachedCountFor({ entry, },);

    /**
     * Whether this attempt reached an artifact.
     */
    /* oxlint-disable-next-line no-await-in-loop -- entries run sequentially by design; that is the point of a queue */
    const settled = await attempt({ entry, },);

    /**
     * Slices present now the attempt has stopped.
     */
    /* oxlint-disable-next-line no-await-in-loop -- pairs with the read bracketing the other side of this attempt */
    const cachedAfter = await cachedCountFor({ entry, },);

    /**
     * What the attempt earned.
     */
    const verdict = readAttemptOutcome({
      settled,
      cachedBefore,
      cachedAfter,
    },);

    if (verdict.kind === 'earned') {
      console.log(
        `REATTEMPT ${entry.id} queued: cached ${String(verdict.gained,)} more slices, `
          + 'so the next attempt starts further along',
      );
      queue.push(entry,);
    }
    if (verdict.kind === 'stalled') {
      console.log(
        `STALLED ${entry.id}: its ${String(verdict.cached,)} cached slices are what it started `
          + 'with, so a further attempt in this invocation would repeat it',
      );
    }
  }
}

//endregion Entry attempt queue
