import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  hyperIsDry,
  hyperMeterLevel,
  openRouterIsDry,
  openRouterMeterLevel,
  syntheticIsDry,
  syntheticMeterLevel,
} from './budget-routing.ts';
import { errorName, } from './error-name.ts';
import type { HyperClient, } from './hyper-client.ts';
import type { OpenRouterClient, } from './openrouter-client.ts';
import {
  otherProviders,
  PROVIDER_ORDER,
  type ProviderName,
  type ProviderRecord,
  providerRecord,
} from './provider-name.ts';
import type { SyntheticClient, } from './chat-contract.ts';

//region Provider budget
// ASKS FOR METERS, NOT CLIENTS. Every parameter is narrowed to the one method
// this file calls, so a caller can hand it a meter without a client and a test
// does not have to fake a chat surface to check an arithmetic.

// WHETHER EACH PROVIDER STILL HAS MONEY, cached, and correctable by what the
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
 * NOT A MEASUREMENT of any provider's meter latency. It is short enough that
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
 * How long a provider stays out after refusing us while its meter reads wet.
 *
 * A 429 FROM A WET PROVIDER IS A CONCURRENCY LIMIT, NOT EXHAUSTION. The pin
 * pass of 2026-09-02 (`#474`) held Synthetic out for the whole cooldown on a
 * burst of 429s while its meter read 2729 of 2750, and two such holds ended the
 * pass for every remaining entry. The bursts measured there lasted 31 s
 * (01:39:20 to 01:39:51), 3 s (01:40:32 to 01:40:35) and 2 s (01:54:06 to
 * 01:54:08).
 *
 * TIED TO THE FRESHNESS WINDOW rather than picked: the reading that excused
 * the refusal is trusted for this long, so the hold expires with it, and the
 * window is longer than every burst measured.
 */
const RATE_LIMIT_BACKOFF_MS = BUDGET_FRESH_MS;

/**
 * Logger root for the budget layer.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Which providers currently have NO budget to spend, keyed by name.
 *
 * @example
 * ```ts
 * const view: BudgetView = { synthetic: false, hyper: true, openrouter: false, };
 * ```
 */
export type BudgetView = ProviderRecord<boolean>;

/**
 * One reading of every meter: the routed bits and the states they came from.
 *
 * BOTH KEPT, because a refusal needs the state (a wet meter makes the refusal
 * a rate limit; an unreadable one keeps it sticky) while routing needs only
 * the bit.
 *
 * @internal
 */
type MeterReading = {
  /**
   * Routed dryness of each provider.
   */
  readonly view: BudgetView;

  /**
   * What each meter said, or that it said nothing.
   */
  readonly states: ProviderRecord<MeterState>;
};

/**
 * Cached budget state, correctable by what a refused call reported.
 *
 * @example
 * ```ts
 * const budgets: ProviderBudgets = createProviderBudgets({ synthetic, hyper, openrouter, },);
 * ```
 */
export type ProviderBudgets = {
  /**
   * Current view, re-reading the meters when the cached one has aged out.
   */
  readonly read: (args: { readonly signal: AbortSignal; },) => Promise<BudgetView>;

  /**
   * Records that a provider refused us, re-reading its meter at once and
   * holding it out for the cooldown when the meter agrees or cannot be read,
   * for the rate-limit backoff when the meter still reads wet.
   */
  readonly markRefused: (args: {
    readonly provider: ProviderName;
    readonly signal: AbortSignal;
  },) => Promise<void>;

  /**
   * How much longer each provider is held out by a refusal, zero when it is
   * not, so a caller facing only held providers can wait out the shortest
   * hold rather than declare the run over.
   */
  readonly holds: () => ProviderRecord<number>;
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
 * Meter of a provider that was never configured: dry, with nothing to report.
 *
 * DRY RATHER THAN UNREADABLE, because absence is known rather than failed: the
 * router must never send a call to a provider with no key, and a seat reader
 * must count that provider as unable to serve.
 */
const UNCONFIGURED_METER: MeterRecord = {
  state: 'dry',
  fields: [],
};

/**
 * Builds the cached budget view every provider is routed by.
 *
 * @param synthetic - first provider's quota meter, which is all this reads
 *
 * @param hyper - second provider's balance meter, which is all this reads
 *
 * @param openrouter - third provider's credits meter, which is all this reads
 *
 * @param freshForMs - how long one reading is trusted
 *
 * @param cooldownMs - how long a refusal holds a provider out
 *
 * @param rateLimitBackoffMs - how long a refusal on a wet meter holds a
 * provider out while another provider can take the traffic
 *
 * @param now - clock, injectable so tests do not wait
 *
 * @returns Budget view plus the correction a refused call feeds back
 *
 * @example
 * ```ts
 * const budgets = createProviderBudgets({ synthetic, hyper, openrouter, },);
 * ```
 */
export function createProviderBudgets(
  {
    synthetic,
    hyper,
    openrouter,
    freshForMs = BUDGET_FRESH_MS,
    cooldownMs = REFUSAL_COOLDOWN_MS,
    rateLimitBackoffMs = RATE_LIMIT_BACKOFF_MS,
    now = Date.now,
  }: {
    readonly synthetic?: Pick<SyntheticClient, 'quotas'>;
    readonly hyper?: Pick<HyperClient, 'credits'>;
    readonly openrouter?: Pick<OpenRouterClient, 'credits'>;
    readonly freshForMs?: number;
    readonly cooldownMs?: number;
    readonly rateLimitBackoffMs?: number;
    readonly now?: () => number;
  },
): ProviderBudgets {
  /**
   * Last meter reading and when it was taken, with a zero stamp for never.
   *
   * THE PRE-READ VIEW IS NOT A PLACEHOLDER LIE. Before any meter has answered,
   * nothing is known about any budget, and this file's policy for an unknown
   * budget is already that it counts as spendable. The zero stamp forces a
   * read on the first call regardless, exactly as `heldUntil` uses zero for a
   * provider that has never refused us.
   */
  const cache: {
    startedAt: number;
    inFlight: boolean;
    reading: Promise<MeterReading>;
  } = {
    startedAt: 0,
    inFlight: false,
    reading: Promise.resolve({
      view: providerRecord({
        of: function spendable(): boolean {
          return false;
        },
      },),
      states: providerRecord({
        of: function unread(): MeterState {
          return 'unreadable';
        },
      },),
    },),
  };

  /**
   * Reads every meter once, for everyone waiting on this reading.
   *
   * THE FIRST CALLER'S SIGNAL GOVERNS, which is a real consequence worth
   * naming rather than hiding. If that caller aborts, every read rejects,
   * each provider reports as spendable, and the reading resolves WET for
   * every sharer. That is this file's answer for an unreadable meter anyway,
   * and the router still recovers a real refusal through failover.
   *
   * @param signal - abort signal of whichever call started this reading
   *
   * @returns Every provider's dryness, unreadable meters counting as spendable
   *
   * @example
   * ```ts
   * cache.reading = takeReading({ signal, },);
   * ```
   */
  async function takeReading(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<MeterReading> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: takeReading.name,
      l,
    },);

    /**
     * Every meter, read together so one slow endpoint does not serialise
     * behind another.
     */
    const [syntheticMeter, hyperMeter, openrouterMeter,] = await Promise.all([
      (synthetic === undefined)
        ? Promise.resolve(UNCONFIGURED_METER,)
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
        ? Promise.resolve(UNCONFIGURED_METER,)
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
      (openrouter === undefined)
        ? Promise.resolve(UNCONFIGURED_METER,)
        : meterRecordOf({
          name: 'openrouter',
          readLevel: async function readOpenRouterCredits(): Promise<MeterLevel> {
            /**
             * Credits the verdict and the number are both drawn from.
             */
            const credits = await openrouter.credits({ signal, },);

            return {
              dry: openRouterIsDry({ credits, },),
              fields: openRouterMeterLevel({ credits, },),
            };
          },
        },),
    ],);

    /**
     * Every meter's record, keyed by provider.
     */
    const meters: ProviderRecord<MeterRecord> = {
      synthetic: syntheticMeter,
      hyper: hyperMeter,
      openrouter: openrouterMeter,
    };

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
    //
    // STATES FIRST, IN PROVIDER ORDER, THEN EVERY NUMBER, so the reader in
    // `meter-sample-read.ts` finds each provider's state by name and older
    // lines without the third state still read.
    rl.info(`METERS ${[
      ...PROVIDER_ORDER.map(function stateOf(provider,): string {
        return `${provider}=${meters[provider].state}`;
      },),
      ...PROVIDER_ORDER.flatMap(function fieldsOf(provider,): readonly string[] {
        return meters[provider].fields;
      },),
    ].join(' ',)}`,);
    return {
      view: providerRecord({
        of: function dryOf(provider,): boolean {
          return routesAsDry({ state: meters[provider].state, },);
        },
      },),
      states: providerRecord({
        of: function stateOf(provider,): MeterState {
          return meters[provider].state;
        },
      },),
    };
  }

  /**
   * Until when each provider is held out by a refusal, zero for never.
   */
  const heldUntil: Record<ProviderName, number> = {
    synthetic: 0,
    hyper: 0,
    openrouter: 0,
  };

  /**
   * How much longer a provider's refusal holds it out, zero when it does not.
   *
   * @param provider - provider to check
   *
   * @returns Milliseconds of hold left
   *
   * @example
   * ```ts
   * const left = holdLeft({ provider: 'hyper', },);
   * ```
   */
  function holdLeft(
    { provider, }: { readonly provider: ProviderName; },
  ): number {
    /**
     * When its hold ends.
     */
    const until = heldUntil[provider];

    if (until === 0)
      return 0;
    return Math.max(
      0,
      until - now(),
    );
  }

  /**
   * Starts a reading now, whatever the cache's age, for everyone who reads
   * after it.
   *
   * @param signal - abort signal of the call forcing the read
   *
   * @returns The fresh reading
   *
   * @example
   * ```ts
   * const reading = await readNow({ signal, },);
   * ```
   */
  async function readNow(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<MeterReading> {
    // A reading still in flight is younger than any refusal arriving now, so a
    // burst of refusals shares it rather than starting one meter call each.
    if (cache.inFlight)
      return await cache.reading;
    /**
     * The in-flight mark, cleared when this read's scope ends however it ends.
     */
    using flight = markInFlight();
    cache.startedAt = now();
    cache.reading = takeReading({ signal, },);
    return await cache.reading;
  }

  /**
   * Marks a reading as in flight until the scope that took it ends, however
   * that scope ends.
   *
   * @returns Disposable that clears the mark
   *
   * @example
   * ```ts
   * using flight = markInFlight();
   * ```
   */
  function markInFlight(): Disposable {
    cache.inFlight = true;
    return {
      [Symbol.dispose]() {
        cache.inFlight = false;
      },
    };
  }

  return {
    read: async function read({ signal, },): Promise<BudgetView> {
      // STAMPED BEFORE THE READ IS STARTED, never after it returns. The stamp
      // says when this reading BEGAN, so a call arriving while it is still in
      // flight sees a fresh stamp and waits on the same promise instead of
      // starting a second read of every meter.
      if ((cache.startedAt === 0) || ((now() - cache.startedAt) >= freshForMs))
        await readNow({ signal, },);

      /**
       * Meter reading this call is decided on, shared with every other call
       * that arrived inside the same window.
       */
      const { view, } = await cache.reading;

      // A hold can only keep a provider OUT, never bring one back in.
      return providerRecord({
        of: function dryOrHeld(provider,): boolean {
          return view[provider] || (holdLeft({ provider, },) > 0);
        },
      },);
    },

    markRefused: async function markRefused({
      provider,
      signal,
    },): Promise<void> {
      /**
       * Logger pre-tagged with this function's name.
       */
      const rl = tagged({
        tag: markRefused.name,
        l,
      },);

      // THE METER IS ASKED AT ONCE, freshness window or not. A refusal from a
      // provider whose meter still reads wet is its concurrency limit, which
      // clears in seconds, and holding it out for the exhaustion cooldown is
      // what ended the pin pass of 2026-09-02 (`#474`). A meter that agrees, or
      // one that cannot be read, keeps the refusal stickier than the reading.
      /**
       * What every meter said just now.
       */
      const { states, } = await readNow({ signal, },);
      /**
       * What that provider's meter said just now.
       */
      const state = states[provider];
      /**
       * Whether some other provider reads wet, which decides whether a hold
       * moves traffic anywhere.
       */
      const anotherIsWet = otherProviders({ provider, },)
        .some(function isWet(other,): boolean {
          return states[other] === 'wet';
        },);
      // A HOLD MOVES TRAFFIC; WITH NOWHERE TO MOVE IT, IT ONLY HERDS. A refusal
      // on a wet meter is a concurrency limit, and holding the provider out for
      // the backoff sends the next calls to another provider, which is what
      // the hold is for. When no other provider is wet there is nothing to
      // send them to: every call waits the same hold and fires together when it
      // ends, into the same limit. Measured on XIEPT2, 2026-09-03 00:46 to
      // 00:51 UTC, Synthetic at 0% weekly and Hyper alone: 429 bursts of 80 to
      // 131 hits every 80 seconds, 95 calls waiting 60-second holds, 44 lost as
      // both-dry inside the next hold, and no slice settled in five minutes.
      // With no hold, each call keeps its own jittered retry ladder in the
      // transport layer, which is the pacing a concurrency limit wants.
      /**
       * How long this refusal holds the provider out.
       */
      const holdMs = (state === 'wet')
        ? (anotherIsWet ? rateLimitBackoffMs : 0)
        : cooldownMs;
      heldUntil[provider] = now() + holdMs;
      /**
       * The other meters' states, for the line.
       */
      const others = otherProviders({ provider, },)
        .map(function stateOf(other,): string {
          return `${other} ${states[other]}`;
        },)
        .join(', ',);
      rl.info(
        `${provider}: refused us while its meter reads ${state} and ${others}; `
          + `held out for ${String(holdMs,)}ms`,
      );
    },

    holds: function holds(): ProviderRecord<number> {
      return providerRecord({
        of: function left(provider,): number {
          return holdLeft({ provider, },);
        },
      },);
    },
  };
}

//endregion Provider budget
