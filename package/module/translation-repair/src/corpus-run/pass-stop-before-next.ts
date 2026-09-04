import { runSpendUsd, } from '../run-spend-meter.ts';
import {
  SPEND_CEILING_PROVIDER,
  spendCeilingNote,
  spendCeilingReached,
} from './spend-ceiling.ts';

//region Stop before the next entry
// THE TWO REASONS A PASS STARTS NO FURTHER ENTRY, asked by the attempt queue
// before each one and never mid-entry: the soft wall-clock budget, and since
// 2026-09-04 the per-run spend ceiling on the provider that bills in USD.
// Split out of `corpus-pass.ts` at the line cap, and because the pass had no
// unit test of its scheduler's stop rules while both rules were inline.

/**
 * Decides whether the pass may start one more entry, and says why not when
 * it may not.
 *
 * SOFT BUDGET FIRST, because it is the older rule and the cheaper check; a run
 * past both prints the time reason, which is the one an operator planned.
 *
 * @param elapsedMs - wall time since the processing loop began
 *
 * @param softBudgetMs - wall time after which no new entry starts
 *
 * @param ceilingUsd - USD this run may spend on the metered provider before
 * no new entry starts
 *
 * @returns Whether the queue must stop before its next attempt
 *
 * @example
 * ```ts
 * const stop = stopBeforeNextEntry({ elapsedMs: Date.now() - start, softBudgetMs, ceilingUsd, },);
 * ```
 */
export function stopBeforeNextEntry(
  {
    elapsedMs,
    softBudgetMs,
    ceilingUsd,
  }: {
    readonly elapsedMs: number;
    readonly softBudgetMs: number;
    readonly ceilingUsd: number;
  },
): boolean {
  if (elapsedMs >= softBudgetMs) {
    console.log(`SOFT budget reached after ${String(elapsedMs,)}ms; not starting new entries`,);
    return true;
  }

  /**
   * What this run has spent so far on the provider the ceiling meters.
   */
  const spentUsd = runSpendUsd({ provider: SPEND_CEILING_PROVIDER, },);

  if (spendCeilingReached({
    spentUsd,
    ceilingUsd,
  },)) {
    console.log(spendCeilingNote({
      spentUsd,
      ceilingUsd,
    },),);
    return true;
  }
  return false;
}

//endregion Stop before the next entry
