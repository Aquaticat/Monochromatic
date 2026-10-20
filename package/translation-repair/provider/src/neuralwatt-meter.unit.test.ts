/**
 Tests what the NeuralWatt energy ledger's reading means for routing: whether
 the day is dry, and the `key=value` tokens the meter line carries
 (`budget-routing.ts` holds the other providers' meters in the same shape).

 Readings are hand-written, so no case needs a ledger file or a clock.
 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  NEURALWATT_SMALLEST_ESTIMATE_WH,
  neuralWattIsDry,
  neuralWattMeterLevel,
  type NeuralWattEnergy,
} from '../dist/final/node/index.mjs';

/**
 A day with room for many calls and no billed request.
 */
const ROOMY: NeuralWattEnergy = {
  day: '2026-10-20',
  dailyWh: 550,
  spentWh: 0.014,
  reckonedWh: 0.5,
  reservedWh: 0,
  remainingWh: 549.986,
  billedToday: false,
  calls: 3,
};

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: neuralWattIsDry.name,
      children: [
        it({
          name: 'READS A DAY WITH ROOM FOR THE SMALLEST CALL AS WET, and a day with room for exactly the smallest call '
            + 'as wet too, since that call could still be granted',
          fn: async () => {
            expect(neuralWattIsDry({ energy: ROOMY, },),).toBe(false,);
            expect(neuralWattIsDry({ energy: { ...ROOMY, remainingWh: NEURALWATT_SMALLEST_ESTIMATE_WH, }, },),)
              .toBe(false,);
          },
        },),

        it({
          name: 'READS A DAY WITH LESS LEFT THAN THE SMALLEST CALL WOULD HOLD AS DRY, down to nothing and below it, '
            + 'since no call could then be granted',
          fn: async () => {
            for (const remainingWh of [NEURALWATT_SMALLEST_ESTIMATE_WH / 2, 0, -0.3,]) {
              expect(neuralWattIsDry({ energy: { ...ROOMY, remainingWh, }, },),).toBe(true,);
            }
          },
        },),

        it({
          name: 'READS A BILLED DAY AS DRY WHATEVER THE ARITHMETIC SAYS, since every further request would be charged '
            + 'to the owner\'s plan',
          fn: async () => {
            expect(neuralWattIsDry({ energy: { ...ROOMY, billedToday: true, }, },),).toBe(true,);
          },
        },),
      ],
    },),

    describe({
      name: neuralWattMeterLevel.name,
      children: [
        it({
          name: 'RENDERS WHAT IS LEFT AND THE RECKONED SHARE TO THREE PLACES and says a request was not billed, as '
            + 'tokens with no value carrying a space',
          fn: async () => {
            /**
             Tokens for a day nothing was billed on.
             */
            const level = neuralWattMeterLevel({ energy: ROOMY, },);
            expect(level,).toEqual(['neuralwattWh=549.986', 'neuralwattReckonedWh=0.500', 'neuralwattBilled=no',],);
            expect(level.some(function hasSpace(token,): boolean {
              return token.includes(' ',);
            },),).toBe(false,);
          },
        },),

        it({
          name: 'ROUNDS A FIGURE THAT HAS MORE PLACES AND PRINTS A NEGATIVE REMAINDER, which a measurement over its '
            + 'estimate leaves, and says a request was billed',
          fn: async () => {
            expect(neuralWattMeterLevel({
              energy: { ...ROOMY, remainingWh: -0.00449, reckonedWh: 1.23456, billedToday: true, },
            },),).toEqual(['neuralwattWh=-0.004', 'neuralwattReckonedWh=1.235', 'neuralwattBilled=yes',],);
          },
        },),
      ],
    },),
  ],
},);
