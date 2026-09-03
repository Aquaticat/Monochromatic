import type { HyperCredits, } from './hyper-credits.ts';
import type { OpenRouterCredits, } from './openrouter-credits.ts';
import {
  PROVIDER_ORDER,
  type ProviderName,
  type ProviderRecord,
} from './provider-name.ts';
import type { QuotaSnapshot, } from './synthetic-quota.ts';

//region Budget routing
// WHICH PROVIDER SERVES ONE CALL, decided from budget and saturation rather
// than from a fixed split.
//
// The owner's policy, in the owner's order: send everything to Synthetic until
// its per-model concurrency limit is reached, then overflow to Hyper, which has
// no such limit; if Synthetic has run out of quota, use Hyper; when Hyper is
// dry too, buy on OpenRouter (2026-09-03); if every provider is out at once,
// throw an error saying so and end the run.
//
// THE POLICY IS A WALK DOWN `PROVIDER_ORDER`. The first provider that serves
// the model and has budget takes the call, unless its per-model slots are all
// taken and a later provider with budget can take it now; a saturated provider
// with nobody behind it still gets the call, since a queue behind its limit is
// slower than the split and still buys the answer.
//
// SYNTHETIC HAS TWO LIMITS, not one. A five-hour rolling window and a weekly
// credit budget, and either being empty is a reason to fail over. `#199` was
// opened because the weekly one emptied and 866 of 875 lost voices carried a
// single HTTP 429, while the reader that would have seen it coming had been
// parsing `weekly.percentRemaining` and discarding it since 2026-07-16.
//
// DRYNESS ARRIVES AS A RECORD OF BOOLEANS rather than being read off the
// snapshots here, so a caller can OR in what it just learned at the wire. A
// budget reading is minutes old and a 429 is now; a router that could only see
// the reading would keep sending to a provider that has already started
// refusing.
//
// A MODEL THAT NO LIVE PROVIDER SERVES IS AN OUTCOME, NOT A THROW. Part of the
// roster is served by fewer than all providers, and one of those providers
// being dry costs that panelist its voice, which the pipeline already records
// and proceeds without. Only every budget being empty ends a run, because at
// that point nothing can be bought at all.

/**
 * Refusal raised when no provider has budget left.
 *
 * ENDS THE RUN, at the owner's instruction. Every other budget state leaves
 * something buyable, and this one leaves nothing.
 *
 * RENAMED 2026-09-03 from the two-provider name when OpenRouter joined; the
 * old name is in the local forbidden-strings appendix so it cannot come back.
 *
 * @example
 * ```ts
 * throw new EveryProviderDryError();
 * ```
 */
export class EveryProviderDryError extends Error {
  /**
   * Declares this message safe to forward: fixed sentences plus, at most, the
   * meter states and hold lengths the decision was made on, never content.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds failure stating that no provider can serve any call.
   *
   * @param measured - meter states and holds at the decision, stated so a
   * reader can tell exhaustion from refusal holds (#474, option 3);
   * composed by the caller from the dryness record and the holds, and "no
   * reading cited" where the caller has none
   *
   * @example
   * ```ts
   * new EveryProviderDryError({ measured: 'meters read synthetic dry, hyper dry, openrouter dry; holds synthetic 0ms, hyper 0ms, openrouter 0ms', },);
   * ```
   */
  public constructor(
    { measured = 'no reading cited', }: { readonly measured?: string; } = {},
  ) {
    super(
      `Every provider is out of budget at once: Synthetic has no five-hour or weekly credit left, Charm Hyper has no balance left, and OpenRouter has no credit left. Nothing further can be bought, so this run ends. Synthetic regenerates on its own schedule; Hyper and OpenRouter refill on purchase. Measured at the decision: ${measured}.`,
    );
    this.name = 'EveryProviderDryError';
  }
}

/**
 * Which providers can serve one model at all, before budget is considered.
 *
 * STATED RATHER THAN DERIVED, so this decision is testable without a roster and
 * keeps answering correctly while the roster is being widened.
 *
 * @example
 * ```ts
 * const reach: ModelReach = { synthetic: true, hyper: true, openrouter: true, };
 * ```
 */
export type ModelReach = ProviderRecord<boolean>;

/**
 * Reading given when no provider in order both serves a model and has budget.
 */
export const NO_PROVIDER = 'none';

/**
 * Where one call goes, or why it can go nowhere.
 *
 * @example
 * ```ts
 * const choice: ProviderChoice = { kind: 'hyper', };
 * ```
 */
export type ProviderChoice =
  | {
    /**
     * Provider that takes the call.
     */
    readonly kind: ProviderName;
  }
  | {
    /**
     * Discriminator marking a call no live provider can take.
     */
    readonly kind: 'unreachable';

    /**
     * Why, in terms a voice-loss record can carry.
     */
    readonly reason: string;
  };

/**
 * Whether Synthetic's budget reading says nothing more can be bought there.
 *
 * READS BOTH LIMITS. The provider throttling the account, an empty five-hour
 * window and an empty weekly budget are three separate ways to be out, and the
 * one that actually emptied was the weekly budget.
 *
 * @param quota - most recent budget reading
 *
 * @returns Whether that reading leaves nothing buyable
 *
 * @example
 * ```ts
 * const dry = syntheticIsDry({ quota, },);
 * ```
 */
export function syntheticIsDry(
  { quota, }: { readonly quota: QuotaSnapshot; },
): boolean {
  /**
   * Rolling window, whose emptiness is stated two ways.
   */
  const {
    limited,
    remaining,
  } = quota.fiveHour;

  if (limited)
    return true;

  if (remaining <= 0)
    return true;

  /**
   * Weekly budget, the limit that actually emptied.
   */
  const { percentRemaining, } = quota.weekly;

  return percentRemaining <= 0;
}

/**
 * Whether Hyper's balance says nothing more can be bought there.
 *
 * NO MARGIN ABOVE ZERO. What one call costs has not been measured, so any
 * cushion would be a number nobody established. A balance too small for the
 * next call surfaces as a refusal at the wire, which the caller ORs into the
 * dryness it passes back in.
 *
 * @param credits - most recent balance reading
 *
 * @returns Whether that reading leaves nothing buyable
 *
 * @example
 * ```ts
 * const dry = hyperIsDry({ credits, },);
 * ```
 */
export function hyperIsDry(
  { credits, }: { readonly credits: HyperCredits; },
): boolean {
  return credits.balance <= 0;
}

/**
 * Whether OpenRouter's credits say nothing more can be bought there.
 *
 * THE SAME RULE AS HYPER'S, for the same reason: a balance too small for the
 * next call answers `402` at the wire, and that refusal holds the provider
 * out through the budget layer.
 *
 * @param credits - most recent credits reading
 *
 * @returns Whether that reading leaves nothing buyable
 *
 * @example
 * ```ts
 * const dry = openRouterIsDry({ credits, },);
 * ```
 */
export function openRouterIsDry(
  { credits, }: { readonly credits: OpenRouterCredits; },
): boolean {
  return credits.remainingUsd <= 0;
}

/**
 * First provider in spending order that serves a model and has budget.
 *
 * THE SEAT READER'S QUESTION AS WELL AS THE ROUTER'S: `run-seats.ts` asks
 * where each judge would be served before a phase starts, because a seat that
 * one provider serves too slowly for the round window is withheld only while
 * that provider is the one that would take its calls.
 *
 * @param reach - providers that serve this model at all
 *
 * @param dry - which providers have nothing buyable right now
 *
 * @returns Provider that would take a call with a free slot, or none
 *
 * @example
 * ```ts
 * const provider = providerServing({ reach, dry, },);
 * ```
 */
export function providerServing(
  {
    reach,
    dry,
  }: {
    readonly reach: ModelReach;
    readonly dry: ProviderRecord<boolean>;
  },
): ProviderName | typeof NO_PROVIDER {
  return PROVIDER_ORDER.find(function usable(provider,): boolean {
    return reach[provider] && (!dry[provider]);
  },) ?? NO_PROVIDER;
}

/**
 * Decides which provider serves one call.
 *
 * @param reach - providers that serve this model at all
 *
 * @param dry - which providers have nothing buyable, budget reading and
 * anything just learned at the wire taken together
 *
 * @param saturated - which providers have this model's per-model concurrency
 * limit already taken, which is the overflow trigger; a provider with no such
 * limit is never saturated
 *
 * @returns Provider to call, or why none can be
 *
 * @throws {@link EveryProviderDryError} when no provider has budget left,
 * which ends the run
 *
 * @example
 * ```ts
 * const choice = routeProviderFor({ reach, dry, saturated, },);
 * ```
 */
export function routeProviderFor(
  {
    reach,
    dry,
    saturated,
  }: {
    readonly reach: ModelReach;
    readonly dry: ProviderRecord<boolean>;
    readonly saturated: ProviderRecord<boolean>;
  },
): ProviderChoice {
  if (PROVIDER_ORDER.every(function isDry(provider,): boolean {
    return dry[provider];
  },))
    throw new EveryProviderDryError();

  /**
   * Providers that both serve this model and have budget, in spending order.
   */
  const usable = PROVIDER_ORDER.filter(function serves(provider,): boolean {
    return reach[provider] && (!dry[provider]);
  },);

  /**
   * First usable provider, or nothing when every serving provider is dry.
   */
  const [preferred,] = usable;

  if (preferred === undefined)
    return {
      kind: 'unreachable',
      reason: PROVIDER_ORDER.some(function serves(provider,): boolean {
        return reach[provider];
      },)
        ? 'every provider serving this model is out of budget'
        : 'no provider serves this model',
    };

  /**
   * First usable provider with a free slot, which overflow prefers.
   */
  const unsaturated = usable.find(function hasRoom(provider,): boolean {
    return !saturated[provider];
  },);

  // A saturated provider with nobody usable behind it still takes the call:
  // a queue behind its limit is slower than the split and still buys the answer.
  return { kind: unsaturated ?? preferred, };
}

/**
 * Renders what the first provider's meter actually said, as record fields.
 *
 * A VERDICT ALONE CANNOT BE DIAGNOSED. `wet` and `dry` say what routing did,
 * not what was read: a dry reading could be an emptied weekly budget, an
 * emptied rolling window, an account this provider is actively throttling, or
 * a threshold in this file being wrong about a budget that was fine. Only a
 * second live call separates those, and once the moment has passed there is no
 * second call to make.
 *
 * BOTH LIMITS EVERY TIME, including whichever one is full. A record naming
 * only the limit that emptied would leave a reader unable to watch the other
 * one approach.
 *
 * @param quota - snapshot the dryness verdict was read from
 *
 * @returns `key=value` tokens, no value carrying a space
 *
 * @example
 * ```ts
 * syntheticMeterLevel({ quota, },);
 * // => ['syntheticWeekly=97%', 'syntheticFiveHour=48/50', 'syntheticThrottled=no',]
 * ```
 */
export function syntheticMeterLevel(
  { quota, }: { readonly quota: QuotaSnapshot; },
): readonly string[] {
  /**
   * Rolling window and weekly budget, either of which emptying is a dry meter.
   */
  const {
    fiveHour,
    weekly,
  } = quota;

  return [
    `syntheticWeekly=${String(weekly.percentRemaining,)}%`,
    `syntheticFiveHour=${String(fiveHour.remaining,)}/${String(fiveHour.max,)}`,
    `syntheticThrottled=${fiveHour.limited ? 'yes' : 'no'}`,
  ];
}

/**
 * Renders what the second provider's meter actually said, as record fields.
 *
 * ONE NUMBER, because this provider reports one. Read back later, a recorded
 * balance of zero is what separates a provider that was genuinely empty from a
 * threshold here that was wrong about a balance that was not.
 *
 * @param credits - balance the dryness verdict was read from
 *
 * @returns `key=value` tokens, no value carrying a space
 *
 * @example
 * ```ts
 * hyperMeterLevel({ credits, },);
 * // => ['hyperBalance=0',]
 * ```
 */
export function hyperMeterLevel(
  { credits, }: { readonly credits: HyperCredits; },
): readonly string[] {
  return [`hyperBalance=${String(credits.balance,)}`,];
}

/**
 * Renders what the third provider's meter actually said, as record fields.
 *
 * WHAT IS LEFT, IN USD, TO TWO PLACES. The provider reports purchased and used
 * to nine decimals; a record field is for watching a balance approach zero
 * across readings, and cents are the unit the owner tops up in.
 *
 * @param credits - credits the dryness verdict was read from
 *
 * @returns `key=value` tokens, no value carrying a space
 *
 * @example
 * ```ts
 * openRouterMeterLevel({ credits, },);
 * // => ['openrouterUsd=57.62',]
 * ```
 */
export function openRouterMeterLevel(
  { credits, }: { readonly credits: OpenRouterCredits; },
): readonly string[] {
  /**
   * What is left, which is the one number the record watches.
   */
  const { remainingUsd, } = credits;

  return [`openrouterUsd=${remainingUsd.toFixed(2,)}`,];
}

//endregion Budget routing
