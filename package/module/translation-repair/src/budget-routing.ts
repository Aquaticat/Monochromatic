import type { HyperCredits, } from './hyper-credits.ts';
import type { QuotaSnapshot, } from './synthetic-quota.ts';

//region Budget routing
// WHICH PROVIDER SERVES ONE CALL, decided from budget and saturation rather
// than from a fixed split.
//
// The owner's policy, in the owner's order: send everything to Synthetic until
// its per-model concurrency limit is reached, then overflow to Hyper, which has
// no such limit; if Synthetic has run out of quota, use Hyper; if both are out
// at once, throw an error saying so and end the run.
//
// SYNTHETIC HAS TWO LIMITS, not one. A five-hour rolling window and a weekly
// credit budget, and either being empty is a reason to fail over. `#199` was
// opened because the weekly one emptied and 866 of 875 lost voices carried a
// single HTTP 429, while the reader that would have seen it coming had been
// parsing `weekly.percentRemaining` and discarding it since 2026-07-16.
//
// DRYNESS ARRIVES AS A BOOLEAN rather than being read off the snapshots here,
// so a caller can OR in what it just learned at the wire. A budget reading is
// minutes old and a 429 is now; a router that could only see the reading would
// keep sending to a provider that has already started refusing.
//
// A MODEL THAT NO LIVE PROVIDER SERVES IS AN OUTCOME, NOT A THROW. Half the
// roster is served by one provider only, and one of those providers being dry
// costs that panelist its voice, which the pipeline already records and
// proceeds without. Only both budgets being empty ends a run, because at that
// point nothing can be bought at all.

/**
 * Refusal raised when neither provider has budget left.
 *
 * ENDS THE RUN, at the owner's instruction. Every other budget state leaves
 * something buyable, and this one leaves nothing.
 *
 * @example
 * ```ts
 * throw new BothProvidersDryError();
 * ```
 */
export class BothProvidersDryError extends Error {
  /**
   * Declares this message safe to forward: fixed sentences plus, at most, the
   * meter states and hold lengths the decision was made on, never content.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds failure stating that no provider can serve any call.
   *
   * @param measured - meter states and holds at the decision, stated so a
   * reader can tell exhaustion from two refusal holds (#474, option 3);
   * composed by the caller from two booleans and two durations, and "no
   * reading cited" where the caller has none
   *
   * @example
   * ```ts
   * new BothProvidersDryError({ measured: 'meters read synthetic dry, hyper dry; holds synthetic 0ms, hyper 0ms', },);
   * ```
   */
  public constructor(
    { measured = 'no reading cited', }: { readonly measured?: string; } = {},
  ) {
    super(
      `Both providers are out of budget at once: Synthetic has no five-hour or weekly credit left and Charm Hyper has no balance left. Nothing further can be bought, so this run ends. Synthetic regenerates on its own schedule and Hyper refills roughly every 24 hours. Measured at the decision: ${measured}.`,
    );
    this.name = 'BothProvidersDryError';
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
 * const reach: ModelReach = { onSynthetic: true, onHyper: true, };
 * ```
 */
export type ModelReach = {
  /**
   * Whether the first provider serves this model.
   */
  readonly onSynthetic: boolean;

  /**
   * Whether the second provider serves this model.
   */
  readonly onHyper: boolean;
};

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
     * Discriminator marking the first provider.
     */
    readonly kind: 'synthetic';
  }
  | {
    /**
     * Discriminator marking the second provider.
     */
    readonly kind: 'hyper';
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
 * Decides which provider serves one call.
 *
 * @param reach - providers that serve this model at all
 *
 * @param syntheticDry - whether Synthetic has nothing buyable, budget reading
 * and anything just learned at the wire taken together
 *
 * @param hyperDry - same, for Hyper
 *
 * @param syntheticSaturated - whether this model's per-model concurrency limit
 * on Synthetic is already taken, which is the overflow trigger
 *
 * @returns Provider to call, or why none can be
 *
 * @throws {@link BothProvidersDryError} when neither provider has budget left,
 * which ends the run
 *
 * @example
 * ```ts
 * const choice = routeProviderFor({ reach, syntheticDry, hyperDry, syntheticSaturated, },);
 * ```
 */
export function routeProviderFor(
  {
    reach,
    syntheticDry,
    hyperDry,
    syntheticSaturated,
  }: {
    readonly reach: ModelReach;
    readonly syntheticDry: boolean;
    readonly hyperDry: boolean;
    readonly syntheticSaturated: boolean;
  },
): ProviderChoice {
  if (syntheticDry && hyperDry)
    throw new BothProvidersDryError();

  /**
   * Whether the first provider both serves this model and has budget.
   */
  const syntheticUsable = reach.onSynthetic && (!syntheticDry);

  /**
   * Whether the second provider both serves this model and has budget.
   */
  const hyperUsable = reach.onHyper && (!hyperDry);

  if ((!syntheticUsable) && (!hyperUsable))
    return {
      kind: 'unreachable',
      reason: (reach.onSynthetic || reach.onHyper)
        ? 'every provider serving this model is out of budget'
        : 'no provider serves this model',
    };

  // Only one side is usable, so saturation cannot divert the call anywhere.
  if (!hyperUsable)
    return { kind: 'synthetic', };

  if (!syntheticUsable)
    return { kind: 'hyper', };

  // Both usable: fill Synthetic to its per-model limit first, overflow to the
  // provider that has no such limit.
  return syntheticSaturated
    ? { kind: 'hyper', }
    : { kind: 'synthetic', };
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

//endregion Budget routing
