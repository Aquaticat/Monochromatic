import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { EveryProviderDryError, } from './budget-routing.ts';
import type {
  BudgetView,
  ProviderBudgets,
} from './provider-budget.ts';
import {
  PROVIDER_ORDER,
  type ProviderName,
  type ProviderRecord,
  providerRecord,
} from './provider-name.ts';
import type { RosterModelId, } from './roster-id.ts';

//region Budget hold wait
// A budget reading that waits out a refusal hold before it calls every
// provider dry.
//
// ALL HELD IS NOT ALL DRY. A hold is process state set by a refusal, and the
// pin pass of 2026-09-02 (`#474`) ended for every remaining entry inside one
// second because two holds were read as two empty meters while both meters
// read wet. When every provider reads dry and at least one is held, the
// shortest hold is waited out and the budgets are read again; only a second
// all-dry reading, which no hold can explain, ends the run.
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
 * Reading given when no provider has just refused the call being routed.
 */
export const NOBODY_REFUSED = 'nobody';

/**
 * Shortest hold still running across the providers, zero when none is.
 *
 * @param holds - milliseconds of hold left per provider
 *
 * @returns Milliseconds until the first held provider comes back
 *
 * @example
 * ```ts
 * shortestHold({ holds: { synthetic: 0, hyper: 4_000, openrouter: 0, }, },);
 * // => 4000
 * ```
 */
export function shortestHold(
  { holds, }: { readonly holds: ProviderRecord<number>; },
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
 * Whether every provider reads dry in one view.
 *
 * @param view - dryness per provider
 *
 * @returns Whether nothing is buyable anywhere
 *
 * @example
 * ```ts
 * const over = everyProviderDry({ view, },);
 * ```
 */
function everyProviderDry(
  { view, }: { readonly view: BudgetView; },
): boolean {
  return PROVIDER_ORDER.every(function isDry(provider,): boolean {
    return view[provider];
  },);
}

/**
 * States what the budgets read and what held them, for the error that ends
 * the run.
 *
 * @param view - meter reading with holds folded in
 *
 * @param refused - provider that had just refused this call, or nobody
 *
 * @param holds - hold left per provider
 *
 * @returns One clause a reader can tell exhaustion from holds by
 *
 * @example
 * ```ts
 * measuredAt({ view, refused: NOBODY_REFUSED, holds: budgets.holds(), },);
 * // => 'meters read synthetic dry, hyper dry, openrouter dry; holds synthetic 0ms, hyper 0ms, openrouter 0ms'
 * ```
 */
function measuredAt(
  {
    view,
    refused,
    holds,
  }: {
    readonly view: BudgetView;
    readonly refused: ProviderName | typeof NOBODY_REFUSED;
    readonly holds: ProviderRecord<number>;
  },
): string {
  /**
   * Each meter's reading, the refusal that routed here folded into its
   * provider's clause.
   */
  const meters = PROVIDER_ORDER.map(function clauseOf(provider,): string {
    /**
     * Whether this provider reads dry once the refusal is folded in.
     */
    const dry = view[provider] || (refused === provider);
    return `${provider} ${dry ? 'dry' : 'wet'}${
      (refused === provider) ? ' (just refused this call)' : ''
    }`;
  },);
  /**
   * Each provider's hold.
   */
  const held = PROVIDER_ORDER.map(function holdOf(provider,): string {
    return `${provider} ${String(holds[provider],)}ms`;
  },);
  return `meters read ${meters.join(', ',)}; holds ${held.join(', ',)}`;
}

/**
 * Reads the budgets, waiting out the shortest hold once when every provider
 * reads dry and a refusal hold explains it.
 *
 * @param budgets - shared budget view
 *
 * @param modelId - model being routed, for the log line
 *
 * @param signal - the call's abort
 *
 * @param refused - provider that has just refused this call, which counts as
 * dry for the first reading and not after its hold has been waited out; or
 * nobody
 *
 * @param pollMs - how often the wait checks for abort
 *
 * @returns Every provider's dryness, holds waited out
 *
 * @throws {@link EveryProviderDryError} when every provider reads dry with no
 * hold left to wait out, or still reads dry after the shortest hold ended
 *
 * @example
 * ```ts
 * const view = await readBudgetsPastHolds({ budgets, modelId, signal, refused: NOBODY_REFUSED, pollMs: HOLD_POLL_MS, },);
 * ```
 */
export async function readBudgetsPastHolds(
  {
    budgets,
    modelId,
    signal,
    refused,
    pollMs,
  }: {
    readonly budgets: ProviderBudgets;
    readonly modelId: RosterModelId;
    readonly signal: AbortSignal;
    readonly refused: ProviderName | typeof NOBODY_REFUSED;
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
   * The same view with the refusal that routed here folded in.
   */
  const folded = providerRecord({
    of: function dryOf(provider,): boolean {
      return first[provider] || (refused === provider);
    },
  },);
  if (!everyProviderDry({ view: folded, },))
    return folded;

  /**
   * How long each provider's refusal still holds it out.
   */
  const holds = budgets.holds();
  /**
   * The first hold to end, zero when no provider is held.
   */
  const shortest = shortestHold({ holds, },);
  if (shortest === 0) {
    throw new EveryProviderDryError({
      measured: measuredAt({
        view: first,
        refused,
        holds,
      },),
    },);
  }

  /**
   * Each provider's hold, for the line.
   */
  const held = PROVIDER_ORDER.map(function holdOf(provider,): string {
    return `${provider} ${String(holds[provider],)}ms`;
  },);
  rl.warn(
    `${modelId}: every provider held out by refusals (${held.join(', ',)}); `
      + `waiting ${String(shortest,)}ms for the shortest hold to end rather than ending the run`,
  );
  await waitOutHold({
    ms: shortest,
    signal,
    pollMs,
  },);

  /**
   * What the budgets look like once the shortest hold has ended.
   *
   * THE ROUTING REFUSAL IS NOT FOLDED IN AGAIN. `refused` says a provider
   * refused THIS call a moment ago; its hold is what that refusal became, and
   * a hold that has just expired is the provider coming back. Folding the
   * refusal in a second time would send the call to an all-dry error after
   * waiting for exactly the hold that would have cleared it.
   */
  const second = await budgets.read({ signal, },);
  if (everyProviderDry({ view: second, },)) {
    throw new EveryProviderDryError({
      measured: `after waiting ${String(shortest,)}ms, ${
        measuredAt({
          view: second,
          refused: NOBODY_REFUSED,
          holds: budgets.holds(),
        },)
      }`,
    },);
  }
  return second;
}

//endregion Budget hold wait
