import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { BothProvidersDryError, } from './budget-routing.ts';
import type {
  BudgetView,
  ProviderBudgets,
  ProviderName,
} from './provider-budget.ts';
import type { RosterModelId, } from './roster-id.ts';

//region Budget hold wait
// A budget reading that waits out a refusal hold before it calls both
// providers dry.
//
// BOTH HELD IS NOT BOTH DRY. A hold is process state set by a refusal, and the
// pin pass of 2026-09-02 (`#474`) ended for every remaining entry inside one
// second because two holds were read as two empty meters while both meters
// read wet. When both providers read dry and at least one is held, the shorter
// hold is waited out and the budgets are read again; only a second both-dry
// reading, which no hold can explain, ends the run.
//
// SPLIT FROM `provider-router.ts` at its line budget, and along a real seam:
// this is about WHEN to read the budgets, and the router's slot arithmetic must
// stay synchronous with the decision it feeds, which an await in the middle of
// it would break.

/**
 * Logger root for the wait.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * How often a call waiting out a provider hold checks whether it was aborted.
 *
 * THE GRANULARITY OF ABORT, NOT A PACING CHOICE: the wait itself is the hold's
 * remaining length, which the budget layer measured, and this only bounds how
 * long an aborted call keeps sleeping past its abort.
 */
export const HOLD_POLL_MS = 1_000;

/**
 * Shortest hold still running across the providers, zero when none is.
 *
 * @param holds - milliseconds of hold left per provider
 *
 * @returns Milliseconds until the first held provider comes back
 *
 * @example
 * ```ts
 * shortestHold({ holds: { synthetic: 0, hyper: 4_000, }, },);
 * // => 4000
 * ```
 */
export function shortestHold(
  { holds, }: { readonly holds: Readonly<Record<ProviderName, number>>; },
): number {
  /**
   * Holds that are actually running.
   */
  const running = Object.values(holds,)
    .filter(function isRunning(ms,): boolean {
      return ms > 0;
    },);
  if (running.length === 0)
    return 0;
  return Math.min(...running,);
}

/**
 * Sleeps out a hold, waking to check for abort at the poll interval.
 *
 * @param ms - hold left to wait out
 *
 * @param signal - the call's abort, which ends the wait with its reason
 *
 * @param pollMs - how often the abort is checked
 *
 * @example
 * ```ts
 * await waitOutHold({ ms: 4_000, signal, pollMs: HOLD_POLL_MS, },);
 * ```
 */
export async function waitOutHold(
  {
    ms,
    signal,
    pollMs,
  }: {
    readonly ms: number;
    readonly signal: AbortSignal;
    readonly pollMs: number;
  },
): Promise<void> {
  for (
    let remaining = ms;
    remaining > 0;
    remaining -= Math.min(
      remaining,
      pollMs,
    )
  ) {
    signal.throwIfAborted();
    // eslint-disable-next-line no-await-in-loop -- the loop IS the wait, sliced only so an abort is noticed
    await wait(Math.min(
      remaining,
      pollMs,
    ),);
  }
  signal.throwIfAborted();
}

/**
 * Reads the budgets, waiting out the shorter hold once when both providers
 * read dry and a refusal hold explains it.
 *
 * @param budgets - shared budget view
 *
 * @param modelId - model being routed, for the log line
 *
 * @param signal - the call's abort
 *
 * @param syntheticDown - whether the first provider has just refused us, which
 * counts as dry for this reading
 *
 * @param pollMs - how often the wait checks for abort
 *
 * @returns Both providers' dryness, holds waited out
 *
 * @throws {@link BothProvidersDryError} when both providers read dry with no
 * hold left to wait out, or still read dry after the shorter hold ended
 *
 * @example
 * ```ts
 * const view = await readBudgetsPastHolds({ budgets, modelId, signal, syntheticDown: false, pollMs: HOLD_POLL_MS, },);
 * ```
 */
export async function readBudgetsPastHolds(
  {
    budgets,
    modelId,
    signal,
    syntheticDown,
    pollMs,
  }: {
    readonly budgets: ProviderBudgets;
    readonly modelId: RosterModelId;
    readonly signal: AbortSignal;
    readonly syntheticDown: boolean;
    readonly pollMs: number;
  },
): Promise<BudgetView> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readBudgetsPastHolds.name,
    l,
  },);

  /**
   * What each provider's budget looks like right now.
   */
  const first = await budgets.read({ signal, },);
  /**
   * The first provider's dryness with the refusal that routed here folded in.
   */
  const firstSyntheticDry = first.syntheticDry || syntheticDown;
  if (!(firstSyntheticDry && first.hyperDry)) {
    return {
      syntheticDry: firstSyntheticDry,
      hyperDry: first.hyperDry,
    };
  }

  /**
   * How long each provider's refusal still holds it out.
   */
  const holds = budgets.holds();
  /**
   * The first hold to end, zero when neither provider is held.
   */
  const shortest = shortestHold({ holds, },);
  if (shortest === 0)
    throw new BothProvidersDryError();

  rl.warn(
    `${modelId}: both providers held out by refusals `
      + `(synthetic ${String(holds.synthetic,)}ms, hyper ${String(holds.hyper,)}ms); `
      + `waiting ${String(shortest,)}ms for the shorter hold to end rather than ending the run`,
  );
  await waitOutHold({
    ms: shortest,
    signal,
    pollMs,
  },);

  /**
   * What the budgets look like once the shorter hold has ended.
   */
  const second = await budgets.read({ signal, },);
  /**
   * The first provider's dryness again, the routing refusal still folded in.
   */
  const secondSyntheticDry = second.syntheticDry || syntheticDown;
  if (secondSyntheticDry && second.hyperDry)
    throw new BothProvidersDryError();
  return {
    syntheticDry: secondSyntheticDry,
    hyperDry: second.hyperDry,
  };
}

//endregion Budget hold wait
