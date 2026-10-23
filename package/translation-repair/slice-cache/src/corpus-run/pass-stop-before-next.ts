import { runSpendUsd, } from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  SPEND_CEILING_PROVIDERS,
  spendCeilingNote,
  spendCeilingReached,
} from '@monochromatic-dev/translation-repair-run/ts';

//region Stop before the next entry
// THE TWO REASONS A PASS STARTS NO FURTHER ENTRY, asked by the attempt queue
// before each one and never mid-entry: the soft time budget, and since
// 2026-09-04 the per-run spend ceiling, applied since 2026-10-22 to each provider that bills in USD on its own.
// Split out of `corpus-pass.ts` at the line cap, and because the pass had no
// unit test of its scheduler's stop rules while both rules were inline.

/**
 Decides whether the pass may start one more entry, and says why not when
 it may not.

 SOFT BUDGET FIRST, because it is the older rule and the cheaper check; a run
 past both prints the time reason, which is the one an operator planned.

 @param elapsedMs - time since the processing loop began, on `monotonicMs`,
 so setting the system clock neither spends the budget nor refunds it
 (ledger B78)

 @param softBudgetMs - time after which no new entry starts

 @param ceilingUsd - USD this run may spend on any one metered provider before
 no new entry starts

 @returns Whether the queue must stop before its next attempt

 @example
 ```ts
 const stop = stopBeforeNextEntry({ elapsedMs: monotonicMs() - start, softBudgetMs, ceilingUsd, },);
 ```
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

  for (const provider of SPEND_CEILING_PROVIDERS) {
    /**
     What this run has spent so far on this provider, never summed with another's.
     */
    const spentUsd = runSpendUsd({ provider, },);

    if (spendCeilingReached({
      spentUsd,
      ceilingUsd,
    },)) {
      console.log(spendCeilingNote({
        provider,
        spentUsd,
        ceilingUsd,
      },),);
      return true;
    }
  }
  return false;
}

//endregion Stop before the next entry
