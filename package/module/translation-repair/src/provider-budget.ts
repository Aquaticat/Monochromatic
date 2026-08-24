import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  hyperIsDry,
  syntheticIsDry,
} from './budget-routing.ts';
import { errorName, } from './error-name.ts';
import type { HyperClient, } from './hyper-client.ts';
import type { SyntheticClient, } from './chat-contract.ts';

//region Provider budget
// ASKS FOR METERS, NOT CLIENTS. Both parameters are narrowed to the one method
// this file calls, so a caller can hand it a meter without a client and a test
// does not have to fake a chat surface to check an arithmetic.

// WHETHER EITHER PROVIDER STILL HAS MONEY, cached, and correctable by what the
// wire actually says.
//
// `#199` exists because a pass exhausted one provider's weekly credit and 866
// of 875 lost voices carried a single HTTP 429. Routing away from an exhausted
// provider needs to know it is exhausted, and there are two ways to learn that:
// ask the meter, or be refused. This reads both.
//
// AN UNREADABLE METER READS AS WET, NOT DRY, and that is the decision this file
// turns on. A budget endpoint that times out is a monitoring failure; treating
// it as exhaustion would convert it into an outage, stopping calls that would
// have succeeded. The owner's instruction is explicit that provider trouble is
// normal and the pipeline must not fail on it. Being wrong the other way costs
// one refused call, which the router already recovers from by failing over.
//
// ONE READING IS SHARED BY EVERY CALLER WAITING ON IT, which the first shape
// got wrong. The staleness check and the stamp sat on either side of the await,
// so every call arriving while a read was in flight saw the old stamp and
// started its own. MEASURED on the 2026-08-24 producer calibration: 158 quota
// reads and 158 credit reads in 46.5 minutes, against a 60-second window that
// should allow about 46. That is the same shape as the saturation race in
// `provider-router.ts`: state checked before an await and written after it.
//
// The fix collapses "fresh" and "in flight" into one idea. A reading STARTED
// inside the freshness window is the reading everyone uses, so the stamp goes
// on before the await rather than after and there is nothing left to race.
//
// A REFUSAL IS STICKIER THAN A METER READING. The meter can lag behind a 429 by
// its own refresh interval, so a provider that just refused us is held dry for
// a cooldown rather than until the next read, which could clear it immediately
// and walk straight back into the same wall.

/**
 * How long a budget reading is trusted before it is taken again.
 *
 * NOT A MEASUREMENT of either provider's meter latency. It is short enough that
 * an exhausted budget is noticed within a stage rather than a whole pass, and
 * long enough that a fan-out of slices does not spend a meter read per call.
 */
const BUDGET_FRESH_MS = 60_000;

/**
 * How long a provider stays dry after refusing us, whatever its meter says.
 *
 * ONE-DIRECTIONAL: it can only hold a provider OUT, never bring one back in. A
 * meter reporting exhaustion keeps it out past the cooldown on its own.
 */
const REFUSAL_COOLDOWN_MS = 300_000;

/**
 * Logger root for the budget layer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Which providers currently have budget to spend.
 *
 * @example
 * ```ts
 * const view: BudgetView = { syntheticDry: false, hyperDry: false, };
 * ```
 */
export type BudgetView = {
  /**
   * Whether the first provider is out of budget, by meter or by refusal.
   */
  readonly syntheticDry: boolean;

  /**
   * Whether the second provider is out of budget, by meter or by refusal.
   */
  readonly hyperDry: boolean;
};

/**
 * One of the two providers, named the way the router names them.
 */
export type ProviderName = 'synthetic' | 'hyper';

/**
 * Cached budget state, correctable by what a refused call reported.
 *
 * @example
 * ```ts
 * const budgets: ProviderBudgets = createProviderBudgets({ synthetic, hyper, },);
 * ```
 */
export type ProviderBudgets = {
  /**
   * Current view, re-reading the meters when the cached one has aged out.
   */
  readonly read: (args: { readonly signal: AbortSignal; },) => Promise<BudgetView>;

  /**
   * Records that a provider refused us, holding it out for the cooldown.
   */
  readonly markRefused: (args: { readonly provider: ProviderName; },) => void;
};

/**
 * Reads one provider's meter, reporting an unreachable meter as WET.
 *
 * @param name - provider being read, for the log line
 *
 * @param readDryness - meter read, which may reject
 *
 * @returns Whether that provider is out of budget
 *
 * @example
 * ```ts
 * const dry = await drynessOf({ name: 'hyper', readDryness, },);
 * ```
 */
async function drynessOf(
  {
    name,
    readDryness,
  }: {
    readonly name: ProviderName;
    readonly readDryness: () => Promise<boolean>;
  },
): Promise<boolean> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: drynessOf.name,
    l,
  },);

  try {
    return await readDryness();
  } catch (error) {
    // A monitoring failure must not become an outage: the router's failover
    // still recovers a real refusal, and a false dry stops calls that work.
    rl.warn(
      `${name}: budget unreadable, treating as spendable (${
        errorName({ error, },)
      })`,
    );
    return false;
  }
}

/**
 * Builds the cached budget view both providers are routed by.
 *
 * @param synthetic - first provider's quota meter, which is all this reads
 *
 * @param hyper - second provider's balance meter, which is all this reads
 *
 * @param freshForMs - how long one reading is trusted
 *
 * @param cooldownMs - how long a refusal holds a provider out
 *
 * @param now - clock, injectable so tests do not wait
 *
 * @returns Budget view plus the correction a refused call feeds back
 *
 * @example
 * ```ts
 * const budgets = createProviderBudgets({ synthetic, hyper, },);
 * ```
 */
export function createProviderBudgets(
  {
    synthetic,
    hyper,
    freshForMs = BUDGET_FRESH_MS,
    cooldownMs = REFUSAL_COOLDOWN_MS,
    now = Date.now,
  }: {
    readonly synthetic: Pick<SyntheticClient, 'quotas'>;
    readonly hyper: Pick<HyperClient, 'credits'>;
    readonly freshForMs?: number;
    readonly cooldownMs?: number;
    readonly now?: () => number;
  },
): ProviderBudgets {
  /**
   * Last meter reading and when it was taken, with a zero stamp for never.
   *
   * THE PRE-READ VIEW IS NOT A PLACEHOLDER LIE. Before any meter has answered,
   * nothing is known about either budget, and this file's policy for an
   * unknown budget is already that it counts as spendable. The zero stamp
   * forces a read on the first call regardless, exactly as `refusedAt` uses
   * zero for a provider that has never refused us.
   */
  const cache: {
    startedAt: number;
    reading: Promise<BudgetView>;
  } = {
    startedAt: 0,
    reading: Promise.resolve({
      syntheticDry: false,
      hyperDry: false,
    },),
  };

  /**
   * Reads both meters once, for everyone waiting on this reading.
   *
   * THE FIRST CALLER'S SIGNAL GOVERNS, which is a real consequence worth
   * naming rather than hiding. If that caller aborts, both reads reject,
   * `drynessOf` reports each provider as spendable, and the reading resolves
   * WET for every sharer. That is this file's answer for an unreadable meter
   * anyway, and the router still recovers a real refusal through failover.
   *
   * @param signal - abort signal of whichever call started this reading
   *
   * @returns Both providers' dryness, unreadable meters counting as spendable
   *
   * @example
   * ```ts
   * cache.reading = takeReading({ signal, },);
   * ```
   */
  async function takeReading(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<BudgetView> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: takeReading.name,
      l,
    },);

    /**
     * Both meters, read together so one slow endpoint does not serialise
     * behind the other.
     */
    const [syntheticDry, hyperDry,] = await Promise.all([
      drynessOf({
        name: 'synthetic',
        readDryness: async function readQuota(): Promise<boolean> {
          return syntheticIsDry({ quota: await synthetic.quotas({ signal, },), },);
        },
      },),
      drynessOf({
        name: 'hyper',
        readDryness: async function readCredits(): Promise<boolean> {
          return hyperIsDry({ credits: await hyper.credits({ signal, },), },);
        },
      },),
    ],);

    rl.debug(`meters: synthetic ${syntheticDry ? 'dry' : 'wet'}, hyper ${hyperDry ? 'dry' : 'wet'}`,);
    return {
      syntheticDry,
      hyperDry,
    };
  }

  /**
   * When each provider last refused us, zero for never.
   */
  const refusedAt: Record<ProviderName, number> = {
    synthetic: 0,
    hyper: 0,
  };

  /**
   * Whether a provider is inside its post-refusal cooldown.
   *
   * @param provider - provider to check
   *
   * @returns Whether its refusal still holds
   *
   * @example
   * ```ts
   * const held = inCooldown({ provider: 'hyper', },);
   * ```
   */
  function inCooldown(
    { provider, }: { readonly provider: ProviderName; },
  ): boolean {
    /**
     * When it last refused us.
     */
    const at = refusedAt[provider];

    if (at === 0)
      return false;
    return (now() - at) < cooldownMs;
  }

  return {
    read: async function read({ signal, },): Promise<BudgetView> {
      // STAMPED BEFORE THE READ IS STARTED, never after it returns. The stamp
      // says when this reading BEGAN, so a call arriving while it is still in
      // flight sees a fresh stamp and waits on the same promise instead of
      // starting a second read of both meters.
      if ((cache.startedAt === 0) || ((now() - cache.startedAt) >= freshForMs)) {
        cache.startedAt = now();
        cache.reading = takeReading({ signal, },);
      }

      /**
       * Meter reading this call is decided on, shared with every other call
       * that arrived inside the same window.
       */
      const view = await cache.reading;

      // The cooldown can only hold a provider OUT, never bring one back in.
      return {
        syntheticDry: view.syntheticDry || inCooldown({ provider: 'synthetic', },),
        hyperDry: view.hyperDry || inCooldown({ provider: 'hyper', },),
      };
    },

    markRefused: function markRefused({ provider, },): void {
      /**
       * Logger pre-tagged with this function's name.
       */
      const rl = tagged({
        tag: markRefused.name,
        l,
      },);

      refusedAt[provider] = now();
      rl.info(`${provider}: refused us, held out for ${String(cooldownMs,)}ms`,);
    },
  };
}

//endregion Provider budget
