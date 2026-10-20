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

 DRY WHEN THE DAY HAS LESS LEFT THAN THE SMALLEST CALL WOULD HOLD
 (`NEURALWATT_SMALLEST_ESTIMATE_WH`), since no call could then be granted; a
 day with room for a small call and not a large one stays wet, and a large
 call is refused at its own reservation and moves on. THE ARITHMETIC ALONE
 DECIDES: a cost a call reported is not a reason to stop, since NeuralWatt
 reports a nominal cost on free-energy requests too.

 @param energy - most recent ledger reading

 @returns Whether that reading leaves nothing sendable

 @example
 ```ts
 const dry = neuralWattIsDry({ energy, },);
 ```
 */
export function neuralWattIsDry({ energy, }: { readonly energy: NeuralWattEnergy; },): boolean {
  return energy.remainingWh < NEURALWATT_SMALLEST_ESTIMATE_WH;
}

/**
 Renders what NeuralWatt's meter actually said, as record fields.

 WHAT IS LEFT, IN WATT-HOURS TO THREE PLACES (a call is a few thousandths of
 one), and the share of the day's spend that rests on estimates. The figure is
 the ledger's, not the account's.

 @param energy - ledger reading the dryness verdict was read from

 @returns `key=value` tokens, no value carrying a space

 @example
 ```ts
 neuralWattMeterLevel({ energy, },);
 // => ['neuralwattWh=549.986', 'neuralwattReckonedWh=0.500',]
 ```
 */
export function neuralWattMeterLevel({ energy, }: { readonly energy: NeuralWattEnergy; },): readonly string[] {
  return [
    `neuralwattWh=${energy.remainingWh
      .toFixed(WH_DECIMALS,)}`,
    `neuralwattReckonedWh=${energy.reckonedWh
      .toFixed(WH_DECIMALS,)}`,
  ];
}

//endregion NeuralWatt meter
