import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary/ts';
import { wordForCount, } from '@monochromatic-dev/translation-repair-typography/ts';
import {
  ANTHROPIC_SERVED_IDS,
  type AnthropicPrices,
  CLAUDE_CARDS,
  CLAUDE_COMPLETION_CAP,
  type RosterModelId,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import { STAGE_RETRY_ROUNDS, } from '@monochromatic-dev/translation-repair-stage/ts';

//region Editor fidelity ceiling
// WHAT THE PROBE MAY SPEND, printed before any call and held to the amount the operator allows.
//
// THE CEILING IS BUILT FROM THE TWO THINGS A CALL CANNOT EXCEED: the prompt, sized at one input token to the
// character of the sheet (an overshoot for English, which runs near four characters a token, and close for Chinese),
// and the completion cap every Claude card sends as `max_tokens`, thinking included. A call that spends the whole cap
// is billed for it and asked again, so the ceiling prices the cap in full.
//
// TWO FIGURES, BECAUSE ONE ASK A TRIAL IS NOT THE WORST. The gather asks again when a reply cannot be read: in each of
// its retry rounds, and once more in a recovery round. The FIRST-PASS figure is one ask for each trial; the WORST CASE
// multiplies it by the most asks one gather gives a seat. The run is held to the first-pass figure, which is what a
// reachable arm spends; the worst case is printed so a reader knows what a seat that answers nothing readable could
// cost.
//
// A CARD WITH NO PRICE TABLE IS REFUSED, never priced at zero: only the Claude cards carry one.

/**
 Most asks one gather gives a seat: the first round, the retry rounds, and the recovery round for a reply nothing
 could read.
 */
export const MAX_ASKS_PER_TRIAL: number = STAGE_RETRY_ROUNDS + 2;

/**
 Tokens in a million, the unit the prices are written in.
 */
const PER_MILLION = 1_000_000;

/**
 The ceiling for one card.

 @example
 ```ts
 const [ceiling,] = editorCeilings({ cardIds: ['claude-sonnet-5-5-effort-low',], sheetChars: [9000,], },);
 ```
 */
export type EditorCeiling = {
  /**
   Card the figures are for.
   */
  readonly cardId: RosterModelId;

  /**
   Trials the figures cover.
   */
  readonly trials: number;

  /**
   Most the trials can cost at one ask each, in US dollars.
   */
  readonly firstPassUsd: number;

  /**
   Most the trials can cost when every one is asked as often as a gather asks, in US dollars.
   */
  readonly worstCaseUsd: number;

  /**
   Prices the figures are reckoned at, tier of the first sheet.
   */
  readonly prices: AnthropicPrices;
};

/**
 Prices of a card, or the refusal that none exist.

 @param cardId - card named

 @returns The card's prices

 @throws StatedRefusalError when the card is not one the Claude route serves, so it has no table

 @example
 ```ts
 const prices = pricesOf({ cardId: 'claude-haiku-5-5', },);
 ```
 */
export function pricesOf({ cardId, }: { readonly cardId: RosterModelId; },): AnthropicPrices {
  /**
   The Claude spelling this id matches, absent for any other seat.
   */
  const served = ANTHROPIC_SERVED_IDS.find(function is(servedId,): boolean {
    return servedId === cardId;
  },);
  if (served === undefined) {
    throw new StatedRefusalError({
      says: `${cardId} has no price table in claude-card-sides.ts, so no ceiling can be printed and the editor `
        + 'fidelity probe will not start; it benches the Claude cards',
    },);
  }
  return nonNullishOrThrow(CLAUDE_CARDS[served]
    .anthropic,)
    .prices;
}

/**
 Most one ask can cost at a card's prices.

 @param prices - the card's prices

 @param promptTokens - tokens in the prompt, at the sizing rule

 @returns US dollars for that prompt and a whole completion cap

 @example
 ```ts
 const usd = askUsd({ prices, promptTokens: 9000, },);
 ```
 */
function askUsd(
  {
    prices,
    promptTokens,
  }: {
    readonly prices: AnthropicPrices;
    readonly promptTokens: number;
  },
): number {
  /**
   Tier that prices the whole call: the long-prompt tier once the prompt passes its limit.
   */
  const tier = ((prices.longPrompt !== undefined) && (promptTokens
    > prices.longPrompt
      .aboveTokens))
    ? prices.longPrompt
    : prices;
  return ((promptTokens * tier.inputUsdPerMillion) + (CLAUDE_COMPLETION_CAP * tier.outputUsdPerMillion)) / PER_MILLION;
}

/**
 Prices the most a run can spend, card by card.

 @param cardIds - cards the run seats

 @param sheetChars - characters of the sheet each trial sends, in trial order

 @returns One ceiling for each card

 @throws StatedRefusalError when a card has no price table

 @example
 ```ts
 const ceilings = editorCeilings({ cardIds, sheetChars: [9000, 9500,], },);
 ```
 */
export function editorCeilings(
  {
    cardIds,
    sheetChars,
  }: {
    readonly cardIds: readonly RosterModelId[];
    readonly sheetChars: readonly number[];
  },
): readonly EditorCeiling[] {
  return cardIds.map(function ceilingOf(cardId,): EditorCeiling {
    /**
     The card's prices, refused where it has none.
     */
    const prices = pricesOf({ cardId, },);
    /**
     One ask for each trial at the most it can cost.
     */
    const firstPassUsd = sheetChars.reduce(
      function summed(
        total,
        chars,
      ): number {
        return total + askUsd({
          prices,
          promptTokens: chars,
        },);
      },
      0,
    );
    return {
      cardId,
      trials: sheetChars.length,
      firstPassUsd,
      worstCaseUsd: firstPassUsd * MAX_ASKS_PER_TRIAL,
      prices,
    };
  },);
}

/**
 Decimals a dollar figure is printed with, enough to tell a cent-fraction ask apart.
 */
const USD_DECIMALS = 4;

/**
 Dollars as the lines print them.

 @param usd - amount

 @returns Four decimals

 @example
 ```ts
 const text = usdText({ usd: 0.648, },); // '0.6480'
 ```
 */
function usdText({ usd, }: { readonly usd: number; },): string {
  return usd.toFixed(USD_DECIMALS,);
}

/**
 The line that states one card's ceiling and what it is built from.

 @param ceiling - the card's ceiling

 @returns The line, without a newline

 @example
 ```ts
 log.info(ceilingLine({ ceiling, },),);
 ```
 */
export function ceilingLine({ ceiling, }: { readonly ceiling: EditorCeiling; },): string {
  return `ceiling ${ceiling.cardId}: ${String(ceiling.trials,)} ${ceiling.trials === 1 ? 'trial' : 'trials'}, one ask each, `
    + `at most ${usdText({ usd: ceiling.firstPassUsd, },)} USD; with ${String(MAX_ASKS_PER_TRIAL,)} ${
      wordForCount({
        count: MAX_ASKS_PER_TRIAL,
        one: 'ask',
        many: 'asks',
      },)
    } a trial at most `
    + `${usdText({ usd: ceiling.worstCaseUsd, },)} USD; priced at ${String(ceiling.prices
      .inputUsdPerMillion,)} USD in and `
    + `${String(ceiling.prices
      .outputUsdPerMillion,)} USD out per million tokens, ${String(CLAUDE_COMPLETION_CAP,)} output `
    + 'tokens an ask, one input token to the character of the sheet';
}

/**
 Refuses a run whose ceiling passes the amount the operator allows.

 @param ceilings - one for each card the run seats

 @param maxUsd - amount allowed, from `--max-usd`

 @throws StatedRefusalError when the first-pass ceilings, summed over the cards, pass the amount

 @example
 ```ts
 assertWithinCeiling({ ceilings, maxUsd: 2, },);
 ```
 */
export function assertWithinCeiling(
  {
    ceilings,
    maxUsd,
  }: {
    readonly ceilings: readonly EditorCeiling[];
    readonly maxUsd: number;
  },
): void {
  /**
   Most the whole run can cost at one ask a trial.
   */
  const totalUsd = ceilings.reduce(
    function summed(
      total,
      ceiling,
    ): number {
      return total + ceiling.firstPassUsd;
    },
    0,
  );
  if (totalUsd > maxUsd) {
    throw new StatedRefusalError({
      says: `the ceiling of this run is ${usdText({ usd: totalUsd, },)} USD against --max-usd ${usdText({ usd: maxUsd, },)}; `
        + 'lower --cap, name fewer cards or raise --max-usd, and nothing was asked',
    },);
  }
}

//endregion Editor fidelity ceiling
