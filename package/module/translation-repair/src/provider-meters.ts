import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { BedrockClient, } from './bedrock-client.ts';
import {
  bedrockIsDry,
  bedrockMeterLevel,
  hyperIsDry,
  hyperMeterLevel,
  openRouterIsDry,
  openRouterMeterLevel,
  syntheticIsDry,
  syntheticMeterLevel,
} from './budget-routing.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import { errorName, } from './error-name.ts';
import type { HyperClient, } from './hyper-client.ts';
import type { OpenRouterClient, } from './openrouter-client.ts';
import type {
  ProviderName,
  ProviderRecord,
} from './provider-name.ts';

//region Provider meters
// WHAT EACH PROVIDER'S METER SAID, read once for everyone: the three states a
// reading can be in, the record one answers with, and the read of all four
// meters together. Split out of `provider-budget.ts` on 2026-09-07 when the
// fourth provider put that file over the line budget; the budget layer keeps
// the cache, the holds and the routing view, and asks this file for the
// numbers.

/**
 * Logger root for the meter readers.
 */
const l = tagged({ tag: 'translation-repair', },);

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
export const UNCONFIGURED_METER: MeterRecord = {
  state: 'dry',
  fields: [],
};

/**
 * Reads every configured provider's meter together, so one slow endpoint
 * does not serialise behind another, and names a provider that was never
 * configured as dry with nothing to report.
 *
 * @param synthetic - first provider's quota reader, absent when unconfigured
 *
 * @param hyper - second provider's balance reader, absent when unconfigured
 *
 * @param bedrock - fourth provider's ledger reader, absent when unconfigured
 *
 * @param openrouter - third provider's credits reader, absent when unconfigured
 *
 * @param signal - abort signal of whichever call started this reading
 *
 * @returns Every provider's meter record, keyed by name
 *
 * @example
 * ```ts
 * const meters = await readEveryMeter({ synthetic, hyper, bedrock, openrouter, signal, },);
 * ```
 */
export async function readEveryMeter(
  {
    synthetic,
    hyper,
    bedrock,
    openrouter,
    signal,
  }: {
    readonly synthetic?: Pick<SyntheticClient, 'quotas'>;
    readonly hyper?: Pick<HyperClient, 'credits'>;
    readonly bedrock?: Pick<BedrockClient, 'credits'>;
    readonly openrouter?: Pick<OpenRouterClient, 'credits'>;
    readonly signal: AbortSignal;
  },
): Promise<ProviderRecord<MeterRecord>> {
  /**
   * Every meter, read together so one slow endpoint does not serialise
   * behind another.
   */
  const [syntheticMeter, hyperMeter, bedrockMeter, openrouterMeter,] = await Promise.all([
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
    (bedrock === undefined)
      ? Promise.resolve(UNCONFIGURED_METER,)
      : meterRecordOf({
        name: 'bedrock',
        readLevel: async function readBedrockCredits(): Promise<MeterLevel> {
          /**
           * Ledger reading the verdict and the number are both drawn from.
           */
          const credits = await bedrock.credits({ signal, },);

          return {
            dry: bedrockIsDry({ credits, },),
            fields: bedrockMeterLevel({ credits, },),
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

  return {
    synthetic: syntheticMeter,
    hyper: hyperMeter,
    bedrock: bedrockMeter,
    openrouter: openrouterMeter,
  };
}

//endregion Provider meters
