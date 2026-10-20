import type { NeuralWattEnergy, } from './neuralwatt-energy.ts';
import { NEURALWATT_SMALLEST_ESTIMATE_WH, } from './neuralwatt-estimate.ts';

//region NeuralWatt meter
// WHAT THE ENERGY LEDGER'S READING MEANS FOR ROUTING, in the shape the other
// providers' meters have (`budget-routing.ts`): a verdict, and the numbers it
// was drawn from as record fields.

/**
 Decimals a watt-hour figure is printed to: a call is a few thousandths of one.
 */
const WH_DECIMALS = 3;

/**
 Whether the day's reading says nothing more can be sent to NeuralWatt.

 DRY WHEN A REQUEST WAS BILLED TODAY, whatever the arithmetic says: a billed
 request left the free energy, so every further one would be charged to the
 owner's plan. Otherwise DRY WHEN THE DAY HAS LESS LEFT THAN THE SMALLEST CALL
 WOULD HOLD (`NEURALWATT_SMALLEST_ESTIMATE_WH`), since no call could then be
 granted; a day with room for a small call and not a large one stays wet, and
 a large call is refused at its own reservation and moves on.

 @param energy - most recent ledger reading

 @returns Whether that reading leaves nothing sendable

 @example
 ```ts
 const dry = neuralWattIsDry({ energy, },);
 ```
 */
export function neuralWattIsDry({ energy, }: { readonly energy: NeuralWattEnergy; },): boolean {
  return energy.billedToday || (energy.remainingWh < NEURALWATT_SMALLEST_ESTIMATE_WH);
}

/**
 Renders what NeuralWatt's meter actually said, as record fields.

 WHAT IS LEFT, IN WATT-HOURS TO THREE PLACES (a call is a few thousandths of
 one), the share of the day's spend that rests on estimates, and whether a
 request was billed. The figure is the ledger's, not the account's.

 @param energy - ledger reading the dryness verdict was read from

 @returns `key=value` tokens, no value carrying a space

 @example
 ```ts
 neuralWattMeterLevel({ energy, },);
 // => ['neuralwattWh=549.986', 'neuralwattReckonedWh=0.500', 'neuralwattBilled=no',]
 ```
 */
export function neuralWattMeterLevel({ energy, }: { readonly energy: NeuralWattEnergy; },): readonly string[] {
  return [
    `neuralwattWh=${energy.remainingWh
      .toFixed(WH_DECIMALS,)}`,
    `neuralwattReckonedWh=${energy.reckonedWh
      .toFixed(WH_DECIMALS,)}`,
    `neuralwattBilled=${energy.billedToday ? 'yes' : 'no'}`,
  ];
}

//endregion NeuralWatt meter
