import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  hyperIsDry,
  hyperMeterLevel,
  syntheticIsDry,
  syntheticMeterLevel,
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
 * What one provider's meter said, keeping a meter that could not be read
 * distinct from one that answered.
 *
 * THREE STATES RATHER THAN A BOOLEAN, because routing and measurement want
 * different things out of the same read. Routing needs one bit, spend here or
 * do not, and an unreachable meter has to fall on the spendable side of it for
 * the reason `drynessOf` was written with. Measurement needs to know that the
 * bit was a guess: a duty cycle counting an unreadable meter as an available
 * provider reports an outage as uptime, which is backwards for the one number
 * it exists to produce.
 *
 * @internal
 */
export type MeterState = 'wet' | 'dry' | 'unreadable';

/**
 * Whether a meter state stops us spending on that provider.
 *
 * ONLY A METER THAT ANSWERED AND SAID DRY holds a provider out, so this file's
 * routing policy is unchanged by the third state existing.
 *
 * @param state - what the meter said, or that it said nothing
 *
 * @returns Whether the router should treat this provider as out of budget
 *
 * @example
 * ```ts
 * const dry = routesAsDry({ state: 'unreadable', },);
 * // => false
 * ```
 *
 * @internal
 */
export function routesAsDry(
  { state, }: { readonly state: MeterState; },
): boolean {
  return state === 'dry';
}

/**
 * What one meter answered: the verdict, and the numbers it was drawn from.
 *
 * BOTH COME OUT OF ONE READ so they cannot disagree. A verdict rendered from
 * one snapshot beside a level rendered from a later one would record a moment
 * that never happened, which is worse evidence than recording no level at all.
 *
 * @internal
 */
export type MeterLevel = {
  /**
   * Whether this reading holds the provider out of spending.
   */
  readonly dry: boolean;

  /**
   * `key=value` tokens naming what was read, no value carrying a space.
   */
  readonly fields: readonly string[];
};

/**
 * One meter as the availability record should carry it.
 *
 * @internal
 */
export type MeterRecord = {
  /**
   * What the meter said, or that it said nothing.
   */
  readonly state: MeterState;

  /**
   * Numbers behind the state, in the order they should be written.
   *
   * EMPTY IS NOT AN ABSENCE SENTINEL HERE. A meter that did not answer has no
   * numbers to report, and `state` already carries the fact that it did not,
   * so nothing is being encoded twice and nothing is lost.
   */
  readonly fields: readonly string[];
};

/**
 * Reads one provider's meter, naming an unreachable meter rather than
 * flattening it into the answer a working meter would have given.
 *
 * @param name - provider being read, for the log line
 *
 * @param readLevel - meter read, which may reject
 *
 * @returns What that meter said and was reading, or that it could not be read
 *
 * @example
 * ```ts
 * const meter = await meterRecordOf({ name: 'hyper', readLevel, },);
 * ```
 *
 * @internal
 */
export async function meterRecordOf(
  {
    name,
    readLevel,
  }: {
    readonly name: ProviderName;
    readonly readLevel: () => Promise<MeterLevel>;
  },
): Promise<MeterRecord> {
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: meterRecordOf.name,
    l,
  },);

  try {
    /**
     * Verdict and numbers, both off the same read.
     */
    const level = await readLevel();

    return {
      state: level.dry
        ? 'dry'
        : 'wet',
      fields: level.fields,
    };
  } catch (error) {
    // A monitoring failure must not become an outage: the router's failover
    // still recovers a real refusal, and a false dry stops calls that work.
    rl.warn(
      `${name}: budget unreadable, treating as spendable (${
        errorName({ error, },)
      })`,
    );
    return {
      state: 'unreadable',
      fields: [],
    };
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
    readonly synthetic?: Pick<SyntheticClient, 'quotas'>;
    readonly hyper?: Pick<HyperClient, 'credits'>;
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
    const [syntheticMeter, hyperMeter,] = await Promise.all([
      (synthetic === undefined)
        ? Promise.resolve<MeterRecord>({
          state: 'dry',
          fields: [],
        },)
        : meterRecordOf({
          name: 'synthetic',
          readLevel: async function readQuota(): Promise<MeterLevel> {
            /**
             * Snapshot the verdict and the numbers are both drawn from.
             */
            const quota = await synthetic.quotas({ signal, },);

            return {
              dry: syntheticIsDry({ quota, },),
              fields: syntheticMeterLevel({ quota, },),
            };
          },
        },),
      (hyper === undefined)
        ? Promise.resolve<MeterRecord>({
          state: 'dry',
          fields: [],
        },)
        : meterRecordOf({
          name: 'hyper',
          readLevel: async function readCredits(): Promise<MeterLevel> {
            /**
             * Balance the verdict and the number are both drawn from.
             */
            const credits = await hyper.credits({ signal, },);

            return {
              dry: hyperIsDry({ credits, },),
              fields: hyperMeterLevel({ credits, },),
            };
          },
        },),
    ],);

    // INFO RATHER THAN DEBUG, because this line is the only record that a
    // provider was AVAILABLE at a given moment, and a run does not record debug.
    // It carries the meter state rather than the routed bit, so an unreadable
    // meter cannot be read back later as a provider that was up.
    // Refusals alone cannot measure a duty cycle: `NoProviderForModelError`
    // appears only where something happened to ask for a model that provider
    // serves, so a quiet period reads identically to a healthy one. This is
    // bounded by the freshness window rather than by call volume, so it costs
    // about one line a minute however busy the run is.
    //
    // IT CARRIES THE NUMBERS TOO, added after reading one back. `hyper=dry`
    // alone could not be told from a threshold in `budget-routing.ts` being
    // wrong, and answering that took a live call to the provider, which is not
    // available for a moment that has already passed.
    rl.info(`METERS ${[
      `synthetic=${syntheticMeter.state}`,
      `hyper=${hyperMeter.state}`,
      ...syntheticMeter.fields,
      ...hyperMeter.fields,
    ].join(' ',)}`,);
    return {
      syntheticDry: routesAsDry({ state: syntheticMeter.state, },),
      hyperDry: routesAsDry({ state: hyperMeter.state, },),
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
