import { wordForCount, } from '../count-word.ts';
import type { SpendCost, } from './spend-cost.ts';
import type { SeatSpend, } from './spend-read.ts';
import {
  asCredits,
  asUsd,
  pricedLine,
  tokensOnlyLine,
  usdLine,
} from './spend-report-line.ts';

//region Spend report print
// What the spend report says about a priced tally: the metered seats and their
// total, the seats no price covered, the USD seats, the subscription seats and
// the calls that left a floor.
//
// SPLIT OUT OF `spend-report.ts` so the entry holds only the wiring.

/**
 Names the providers a set of USD seats were billed by.

 @param seats - seats billed in USD per token, each OpenRouter's or Bedrock's

 @returns `OpenRouter`, `Bedrock`, or both joined by "and", in that order

 @throws {@link Error} when a seat belongs to neither provider, which the
 tally's own grouping of USD seats cannot produce

 @example
 ```ts
 const billedBy = usdProvidersNamed({ seats: cost.openRouter, },);
 ```
 */
function usdProvidersNamed({ seats, }: { readonly seats: readonly SeatSpend[]; },): string {
  /**
   Whether any seat was billed by OpenRouter.
   */
  const hasOpenRouter = seats.some(function isOpenRouter(seat,): boolean {
    return seat.provider === 'openrouter';
  },);

  /**
   Whether any seat was billed by Bedrock.
   */
  const hasBedrock = seats.some(function isBedrock(seat,): boolean {
    return seat.provider === 'bedrock';
  },);

  if (hasOpenRouter && hasBedrock)
    return 'OpenRouter and Bedrock';
  if (hasOpenRouter)
    return 'OpenRouter';
  if (hasBedrock)
    return 'Bedrock';

  throw new Error('unreachable: a seat of the USD group is neither OpenRouter\'s nor Bedrock\'s, and priceTally groups only those two',);
}

/**
 Prints everything a priced tally holds.

 @param cost - what `priceTally` returned

 @example
 ```ts
 printCost({ cost, },);
 ```
 */
export function printCost({ cost, }: { readonly cost: SpendCost; },): void {
  /**
   Metered seats the table could price.
   */
  const pricedCount = cost
    .priced
    .length;

  /**
   Metered seats the table had no row for.
   */
  const unpricedCount = cost
    .unpriced
    .length;

  /**
   Seats on the flat subscription, which bill no credits.
   */
  const subscriptionCount = cost
    .subscription
    .length;

  console.log(`metered seats, priced at rates read ${cost.pricedAsOf}:`,);
  for (const seat of cost.priced) {
    console.log(pricedLine({
      seat,
      totalCredits: cost.totalCredits,
    },),);
  }
  // NO PRICED SEAT HAS TWO ANSWERS. No metered call at all, or metered
  // calls that all sat on seats the price table has no row for: saying the
  // first of the second sends a reader to a run that spent nothing.
  if ((pricedCount === 0) && (unpricedCount === 0))
    console.log('  none. No call in these logs went to the metered provider',);
  if ((pricedCount === 0) && (unpricedCount > 0))
    console.log('  none priced: every metered call in these logs was on a seat the price table has no row for',);

  console.log(`metered run total: ${asCredits({ credits: cost.totalCredits, },)} credits`,);

  if (unpricedCount > 0) {
    console.log(
      `UNPRICED, and not free: ${String(unpricedCount,)} metered ${
        wordForCount({
          count: unpricedCount,
          one: 'seat',
          many: 'seats',
        },)
      } ${
        wordForCount({
          count: unpricedCount,
          one: 'has',
          many: 'have',
        },)
      } no row in the price table read ${cost.pricedAsOf}. This report's total omits whatever cost ${
        wordForCount({
          count: unpricedCount,
          one: 'this seat',
          many: 'these seats',
        },)
      } would add`,
    );
    for (const seat of cost.unpriced) {
      console.log(tokensOnlyLine({ seat, },),);
    }
  }

  /**
   Seats billed in USD, on OpenRouter or on Bedrock.
   */
  const openRouterCount = cost
    .openRouter
    .length;

  if (openRouterCount > 0) {
    /**
     Providers those seats were billed by, named so no seat is read under
     another provider's name.
     */
    const billedBy = usdProvidersNamed({ seats: cost.openRouter, },);
    console.log(`${billedBy} seats, billed in USD per token, each priced from the cost= its own lines carried:`,);
    for (const seat of cost.openRouter) {
      console.log(usdLine({
        seat,
        totalUsd: cost.totalUsd,
      },),);
    }
    console.log(`${billedBy} run total: ${asUsd({ usd: cost.totalUsd, },)} USD, never summed with this report's credits`,);
  }

  if (subscriptionCount > 0) {
    console.log(
      'subscription seats, which bill no credits and are metered as a percentage of a weekly '
        + 'allowance on the METERS line:',
    );
    for (const seat of cost.subscription) {
      console.log(tokensOnlyLine({ seat, },),);
    }
  }

  if (cost.unreportedCalls > 0) {
    console.log(
      `FLOOR, NOT A TOTAL: ${String(cost.unreportedCalls,)} ${
        wordForCount({
          count: cost.unreportedCalls,
          one: 'call',
          many: 'calls',
        },)
      } reported no usage block, so ${
        wordForCount({
          count: cost.unreportedCalls,
          one: 'its',
          many: 'their',
        },)
      } tokens are in no figure of this report`,
    );
  }
}

//endregion Spend report print
