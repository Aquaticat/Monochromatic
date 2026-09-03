import { readFile, } from 'node:fs/promises';

import {
  priceTally,
  type PricedSeat,
  type SpendCost,
} from './spend-cost.ts';
import {
  tallySpend,
  type SeatSpend,
} from './spend-read.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';

//region Spend report
// WHAT A RUN COST, read back off its own log. Spends no quota and touches no
// model.
//
// A LOG WITH NO RECORDS AND A RUN THAT SPENT NOTHING ARE DIFFERENT ANSWERS, and
// this says which. Every log this project wrote before `spend-line.ts` landed
// carries no `SPEND` line at all, so silence is the ordinary case for the
// archive and reporting it as a zero total would be a lie about every one of
// them. `NOTHING RECORDED` names it.
//
// PRINTS IDS, COUNTS AND CREDITS. Never a passage: a run log holds unlicensed
// corpus wording, and this reads run logs.

/**
 * Multiplier turning a fraction into a percentage.
 */
const PERCENT = 100;

/**
 * Renders a credit figure at the precision the provider quotes balances in.
 *
 * @param credits - what something came to
 *
 * @returns Text for a report column
 *
 * @example
 * ```ts
 * console.log(asCredits({ credits: 9.5, },),);
 * ```
 */
function asCredits({ credits, }: { readonly credits: number; },): string {
  return credits.toFixed(2,);
}

/**
 * Renders one priced seat, and what share of the bill it was.
 *
 * @param seat - seat with its credits
 *
 * @param totalCredits - what every priced seat came to together
 *
 * @returns Line for the report
 *
 * @example
 * ```ts
 * console.log(pricedLine({ seat, totalCredits, },),);
 * ```
 */
function pricedLine(
  {
    seat,
    totalCredits,
  }: {
    readonly seat: PricedSeat;
    readonly totalCredits: number;
  },
): string {
  /**
   * Share of the bill this seat was, blank where nothing was billed at all.
   */
  const share = (totalCredits === 0)
    ? 'n/a'
    : `${((seat.totalCredits / totalCredits) * PERCENT).toFixed(1,)}%`;

  return `  ${seat.model}: ${asCredits({ credits: seat.totalCredits, },)} credits (${share}) `
    + `over ${String(seat.calls,)} calls, `
    + `in ${String(seat.promptTokens,)}=${asCredits({ credits: seat.inputCredits, },)} `
    + `out ${String(seat.completionTokens,)}=${asCredits({ credits: seat.outputCredits, },)}`;
}

/**
 * Decimal places USD figures are rendered at: a corpus call costs tenths of
 * a cent, and two places would print most of a run's seats as 0.00.
 */
const USD_PLACES = 4;

/**
 * Renders a USD figure at the precision a corpus call costs in.
 *
 * @param usd - what something came to
 *
 * @returns Text for a report column
 *
 * @example
 * ```ts
 * console.log(asUsd({ usd: 0.0842, },),);
 * ```
 */
function asUsd({ usd, }: { readonly usd: number; },): string {
  return usd.toFixed(USD_PLACES,);
}

/**
 * Renders one OpenRouter seat with the USD its lines reported, and what share
 * of the run's USD it was.
 *
 * @param seat - seat with the USD summed off its `cost=` fields
 *
 * @param totalUsd - what every OpenRouter seat came to together
 *
 * @returns Line for the report
 *
 * @example
 * ```ts
 * console.log(usdLine({ seat, totalUsd, },),);
 * ```
 */
function usdLine(
  {
    seat,
    totalUsd,
  }: {
    readonly seat: SeatSpend;
    readonly totalUsd: number;
  },
): string {
  /**
   * Share of the USD bill this seat was, blank where nothing was billed.
   */
  const share = (totalUsd === 0)
    ? 'n/a'
    : `${((seat.costUsd / totalUsd) * PERCENT).toFixed(1,)}%`;

  /**
   * Calls whose line carried no cost, named so the seat's figure reads as a
   * floor when any did.
   */
  const uncosted = seat.calls - seat.costedCalls;

  /**
   * Floor note, absent when every call was costed.
   */
  const floor = (uncosted === 0)
    ? ''
    : `, a floor: ${String(uncosted,)} calls carried no cost`;

  return `  ${seat.model}: ${asUsd({ usd: seat.costUsd, },)} USD (${share}) `
    + `over ${String(seat.calls,)} calls, `
    + `in ${String(seat.promptTokens,)} out ${String(seat.completionTokens,)}${floor}`;
}

/**
 * Renders a seat carrying tokens but no credit figure.
 *
 * @param seat - subscription or unpriced seat
 *
 * @returns Line for the report
 *
 * @example
 * ```ts
 * console.log(tokensOnlyLine({ seat, },),);
 * ```
 */
function tokensOnlyLine({ seat, }: { readonly seat: SeatSpend; },): string {
  return `  ${seat.model}: ${String(seat.calls,)} calls, `
    + `in ${String(seat.promptTokens,)} out ${String(seat.completionTokens,)}`;
}

/**
 * Prints everything a priced tally holds.
 *
 * @param cost - what `priceTally` returned
 *
 * @example
 * ```ts
 * printCost({ cost, },);
 * ```
 */
function printCost({ cost, }: { readonly cost: SpendCost; },): void {
  /**
   * Metered seats the table could price.
   */
  const pricedCount = cost
    .priced
    .length;

  /**
   * Metered seats the table had no row for.
   */
  const unpricedCount = cost
    .unpriced
    .length;

  /**
   * Seats on the flat subscription, which bill no credits.
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
  if (pricedCount === 0)
    console.log('  none. No call in these logs went to the metered provider',);

  console.log(`metered run total: ${asCredits({ credits: cost.totalCredits, },)} credits`,);

  if (unpricedCount > 0) {
    console.log(
      `UNPRICED, and these are not free: ${String(unpricedCount,)} metered seats have no row in `
        + `the price table read ${cost.pricedAsOf}. The total above is short by whatever they cost`,
    );
    for (const seat of cost.unpriced) {
      console.log(tokensOnlyLine({ seat, },),);
    }
  }

  /**
   * Seats billed in USD on OpenRouter.
   */
  const openRouterCount = cost
    .openRouter
    .length;

  if (openRouterCount > 0) {
    console.log('OpenRouter seats, billed in USD per token, each priced from the cost= its own lines carried:',);
    for (const seat of cost.openRouter) {
      console.log(usdLine({
        seat,
        totalUsd: cost.totalUsd,
      },),);
    }
    console.log(`OpenRouter run total: ${asUsd({ usd: cost.totalUsd, },)} USD, never summed with the credits above`,);
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
      `FLOOR, NOT A TOTAL: ${String(cost.unreportedCalls,)} calls reported no usage block, so their `
        + 'tokens are in no figure above',
    );
  }
}

/**
 * Reads named logs and reports what the run they describe cost.
 *
 * Returns nothing: the report on stdout IS the output.
 *
 * @throws {@link Error} when no log path was named
 *
 * @example
 * ```ts
 * await reportSpendCost();
 * ```
 */
async function reportSpendCost(): Promise<void> {
  /**
   * Logs to read, named on the command line.
   */
  const paths = process
    .argv
    .slice(2,);

  if (paths.length === 0) {
    throw new StatedRefusalError({
      says: 'name at least one log file: spend-report <path> [<path> ...]. Any log a pass, probe or '
        + 'calibration wrote will do, and passing several totals them as one run.',
    },);
  }

  /**
   * Every line of every named log, in one list.
   */
  const lines = (await Promise.all(paths.map(async function one(path,): Promise<readonly string[]> {
    return (await readFile(
      path,
      'utf8',
    )).split('\n',);
  },),)).flat();

  /**
   * Per-seat totals over every record those lines held.
   */
  const tally = tallySpend({ lines, },);

  /**
   * Distinct provider and model pairs those records named.
   */
  const seatCount = tally
    .seats
    .length;

  console.log(
    `spend-report: ${String(paths.length,)} logs, ${String(lines.length,)} lines, `
      + `${String(seatCount,)} seats`,
  );

  if (seatCount === 0) {
    console.log(
      'NOTHING RECORDED. These logs carry no SPEND line, which is not the same as a run that spent '
        + 'nothing: every log written before spend-line.ts landed carries none. Check the run date '
        + 'against that landing before reading this as a free run.',
    );
  }

  if (tally.unreadableLines > 0) {
    console.log(
      `${String(tally.unreadableLines,)} lines carried the marker and would not parse, so the totals `
        + 'below are short by whatever those calls cost',
    );
  }

  printCost({ cost: priceTally({ tally, },), },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'spend-report',
    run: reportSpendCost,
  },);

//endregion Spend report
