import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary/ts';

//region NeuralWatt energy reading
// WHAT THE METER SAYS AND THE REFUSAL IT GIVES.
//
// THE FREE ENERGY (`https://docs.neuralwatt.com/billing/daily-free-energy`,
// fetched 2026-10-20): 500 Wh for a Max plan plus 50 Wh for subscribers to the
// product-news email, 550 Wh a day on the covered models, "used before
// anything else", resetting at 00:00 UTC, with unused energy not carried over.
// No API reports what is left of it, which is why this package keeps its own
// meter (`neuralwatt-ledger.ts`).

/**
 Decimals a watt-hour figure is printed to: a call is a few thousandths of one.
 */
const WH_DECIMALS = 3;

/**
 One reading of the day's NeuralWatt energy.

 @example
 ```ts
 const energy: NeuralWattEnergy = {
   day: '2026-10-20',
   dailyWh: 550,
   spentWh: 12.5,
   reckonedWh: 0.5,
   reservedWh: 0.1,
   remainingWh: 537.4,
   billedToday: false,
   calls: 40,
 };
 ```
 */
export type NeuralWattEnergy = {
  /**
   UTC date the reading covers, `YYYY-MM-DD`.
   */
  readonly day: string;

  /**
   Free energy the day holds, in watt-hours.
   */
  readonly dailyWh: number;

  /**
   Watt-hours the ledger lines of the day add up to.
   */
  readonly spentWh: number;

  /**
   The part of that which is an estimate, not a measurement.
   */
  readonly reckonedWh: number;

  /**
   Watt-hours held by calls now in flight, not yet in the ledger.
   */
  readonly reservedWh: number;

  /**
   What the day has left after the spend and the holds; negative once a
   measurement came in over its estimate.
   */
  readonly remainingWh: number;

  /**
   Whether any request of the day came back billed, which ends the day's
   free energy for this provider whatever the arithmetic says.
   */
  readonly billedToday: boolean;

  /**
   Ledger lines of the day.
   */
  readonly calls: number;
};

/**
 Raised, before any request leaves, when the day cannot take a call: the
 estimate does not fit in what is left, or a request was billed today.

 A BUDGET REFUSAL the router moves on from (`isBudgetRefusal`), and not a
 payment refusal: nothing is wrong with the account, the day's free energy is
 spent or held, and it returns at 00:00 UTC.

 @example
 ```ts
 throw new NeuralWattAllowanceError({ model: 'glm-5.3-flash', estimateWh: 0.3, energy, },);
 ```
 */
export class NeuralWattAllowanceError extends StatedRefusalError {
  /**
   Declares this message safe to forward: a model id, a day, and figures the
   ledger computed.
   */
  override readonly messageNamesOnly: true = true;

  /**
   What the day held when the call was refused.
   */
  readonly energy: NeuralWattEnergy;

  /**
   Names the model, the estimate and what the day had left.

   @param model - NeuralWatt model id the call was for

   @param estimateWh - energy the call would have held

   @param energy - the day's reading the refusal rests on

   @example
   ```ts
   new NeuralWattAllowanceError({ model: 'glm-5.3-flash', estimateWh: 0.3, energy, },);
   ```
   */
  public constructor(
    {
      model,
      estimateWh,
      energy,
    }: {
      readonly model: string;
      readonly estimateWh: number;
      readonly energy: NeuralWattEnergy;
    },
  ) {
    super({
      says: energy.billedToday
        ? `NeuralWatt billed a request on ${energy.day} (UTC), so its free energy is treated as spent until `
          + `00:00 UTC; the call to ${model} was not sent`
        : `NeuralWatt has ${energy.remainingWh
          .toFixed(WH_DECIMALS,)} Wh of the ${String(energy.dailyWh,)} Wh free energy `
          + `left on ${energy.day} (UTC) after ${energy.reservedWh
            .toFixed(WH_DECIMALS,)} Wh held by calls in flight, `
          + `and the call to ${model} is estimated at ${estimateWh.toFixed(WH_DECIMALS,)} Wh; it was not sent, and the `
          + 'energy returns at 00:00 UTC',
    },);
    this.name = 'NeuralWattAllowanceError';
    this.energy = energy;
  }
}

//endregion NeuralWatt energy reading
