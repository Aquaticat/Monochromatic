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
 A day with room for many calls.
 */
const ROOMY: NeuralWattEnergy = {
  day: '2026-10-20',
  dailyWh: 550,
  spentWh: 0.014,
  reckonedWh: 0.5,
  reservedWh: 0,
  remainingWh: 549.986,
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
          name: 'READS A DAY BY WHAT IS LEFT ALONE: the spend, the holds and the calls of the day change nothing '
            + 'while the remainder fits the smallest call, and a reading still carrying the old billedToday flag is '
            + 'wet when its remainder is',
          fn: async () => {
            expect(neuralWattIsDry({ energy: { ...ROOMY, spentWh: 449.9, reservedWh: 100, calls: 9_000, }, },),).toBe(false,);

            /**
             Reading as an older build shaped it, with a flag nothing reads any more.
             */
            const older = { ...ROOMY, billedToday: true, };
            expect(neuralWattIsDry({ energy: older, },),).toBe(false,);
          },
        },),
      ],
    },),

    describe({
      name: neuralWattMeterLevel.name,
      children: [
        it({
          name: 'RENDERS WHAT IS LEFT AND THE RECKONED SHARE TO THREE PLACES as '
            + 'two tokens with no value carrying a space',
          fn: async () => {
            /**
             Tokens for a day with room.
             */
            const level = neuralWattMeterLevel({ energy: ROOMY, },);
            expect(level,).toEqual(['neuralwattWh=549.986', 'neuralwattReckonedWh=0.500',],);
            expect(level.some(function hasSpace(token,): boolean {
              return token.includes(' ',);
            },),).toBe(false,);
          },
        },),

        it({
          name: 'ROUNDS A FIGURE THAT HAS MORE PLACES AND PRINTS A NEGATIVE REMAINDER, which a measurement over its '
            + 'estimate leaves',
          fn: async () => {
            expect(neuralWattMeterLevel({
              energy: { ...ROOMY, remainingWh: -0.00449, reckonedWh: 1.23456, },
            },),).toEqual(['neuralwattWh=-0.004', 'neuralwattReckonedWh=1.235',],);
          },
        },),
      ],
    },),
  ],
},);
