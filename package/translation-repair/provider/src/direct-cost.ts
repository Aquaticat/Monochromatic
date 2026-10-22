import type {
  DeepSeekCard,
  XiaomiCard,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import type { ExtractedCompletion, } from '@monochromatic-dev/translation-repair-provider-stream/ts';
import type { DeepSeekCacheSplit, } from './direct-usage.ts';

//region Direct cost
// WHAT ONE DEEPSEEK OR XIAOMI CALL COST, in USD, from the usage it reported
// and the card's prices. NEITHER WIRE REPORTS A COST (the parent session's
// probes of 2026-10-22 found a token usage block and no cost field), so this
// figure, priced here, is the `cost=` the SPEND line carries and the one the
// run's own meter adds up.
//
// DEEPSEEK IS PRICED AT PEAK, ALWAYS: the upper bound. Its page halves every
// rate off peak (01:00 to 04:00 and 06:00 to 10:00 UTC on weekdays other than
// Chinese public holidays are peak, all other hours off peak), and a run
// cannot know the holidays, so an under-read of the owner's balance is the
// one error this avoids.
//
// A COUNT THE WIRE DID NOT SPLIT IS PRICED AT THE DEARER RATE, for the same
// reason: a DeepSeek block with no cache fields prices the whole prompt as
// misses, and a Xiaomi block with no cached count likewise.

/**
 Reading given when the stream carried no usage block, so nothing can be
 priced; the SPEND line still prints with its counts unreported.
 */
export const DIRECT_COST_UNREPORTED = 'unreported';

/**
 Tokens one quoted price covers, since both pages quote per million.
 */
const PRICE_UNIT_TOKENS = 1_000_000;

/**
 USD one completed DeepSeek exchange cost, at peak rates.

 @param card - DeepSeek's side of the card, whose rates price the call

 @param extracted - completion whose `usage` block DeepSeek filled in, or did not

 @param split - cache split the stream's usage block reported

 @returns Cost in USD, or that no usage arrived to price

 @example
 ```ts
 const cost = deepSeekCostOf({ card, extracted, split: deepSeekCacheSplitOf({ bodyText, },), },);
 ```
 */
export function deepSeekCostOf(
  {
    card,
    extracted,
    split,
  }: {
    readonly card: DeepSeekCard;
    readonly extracted: ExtractedCompletion;
    readonly split: DeepSeekCacheSplit;
  },
): number | typeof DIRECT_COST_UNREPORTED {
  /**
   Usage block as the provider reported it, absent where it did not.
   */
  const { usage, } = extracted;
  if (usage === undefined)
    return DIRECT_COST_UNREPORTED;

  /**
   Prompt tokens served from the cache, none where the block named none.
   */
  const hitTokens = split.hitTokens ?? 0;

  /**
   Prompt tokens not served from the cache: as named, else what the cache
   did not account for, so the whole prompt is priced as misses when the
   block split nothing.
   */
  const missTokens = split.missTokens ?? Math.max(
    0,
    usage.prompt_tokens - hitTokens,
  );

  return (
    (hitTokens * card.promptCacheHitUsdPerMillion)
    + (missTokens * card.promptCacheMissUsdPerMillion)
    + (usage.completion_tokens * card.completionUsdPerMillion)
  ) / PRICE_UNIT_TOKENS;
}

/**
 USD one completed Xiaomi exchange cost.

 @param card - Xiaomi's side of the card, whose rates price the call

 @param extracted - completion whose `usage` block Xiaomi filled in, or did not

 @param cachedTokens - prompt tokens the stream said were served from cache,
 none where it said nothing

 @returns Cost in USD, or that no usage arrived to price

 @example
 ```ts
 const cost = xiaomiCostOf({ card, extracted, cachedTokens: 0, },);
 ```
 */
export function xiaomiCostOf(
  {
    card,
    extracted,
    cachedTokens,
  }: {
    readonly card: XiaomiCard;
    readonly extracted: ExtractedCompletion;
    readonly cachedTokens: number;
  },
): number | typeof DIRECT_COST_UNREPORTED {
  /**
   Usage block as the provider reported it, absent where it did not.
   */
  const { usage, } = extracted;
  if (usage === undefined)
    return DIRECT_COST_UNREPORTED;

  /**
   Prompt tokens not served from the cache.
   */
  const missTokens = Math.max(
    0,
    usage.prompt_tokens - cachedTokens,
  );

  return (
    (cachedTokens * card.promptCacheHitUsdPerMillion)
    + (missTokens * card.promptCacheMissUsdPerMillion)
    + (usage.completion_tokens * card.completionUsdPerMillion)
  ) / PRICE_UNIT_TOKENS;
}

//endregion Direct cost
