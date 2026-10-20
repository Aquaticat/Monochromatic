/**
 Tests the refusal the NeuralWatt meter raises before any request leaves when
 the day cannot take a call (`https://docs.neuralwatt.com/billing/daily-free-energy`,
 fetched 2026-10-20: 550 Wh a day, reset at 00:00 UTC, unused energy not
 carried over): the message it composes from a day's reading, and the kind of
 refusal it is to the router.

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
  isBudgetRefusal,
  isPaymentRefusal,
  NeuralWattAllowanceError,
  type NeuralWattEnergy,
} from '../dist/final/node/index.mjs';

/**
 A day with room left and no billed request.
 */
const ROOMY: NeuralWattEnergy = {
  day: '2026-10-20',
  dailyWh: 550,
  spentWh: 549.6,
  reckonedWh: 0.5,
  reservedWh: 0.25,
  remainingWh: 0.15,
  billedToday: false,
  calls: 40,
};

/**
 A day on which a request came back billed, with arithmetic that still shows room.
 */
const BILLED: NeuralWattEnergy = {
  ...ROOMY,
  spentWh: 12.5,
  reservedWh: 0,
  remainingWh: 537.5,
  billedToday: true,
};

await describe({
  name: NeuralWattAllowanceError.name,
  concurrency: 1,
  children: [
    it({
      name: 'SAYS WHAT THE DAY HAD LEFT, the allowance, the hold in flight and the estimate, each to three places, '
        + 'and that the energy returns at 00:00 UTC, when the estimate does not fit',
      fn: async () => {
        /**
         Refusal for a call estimated at more than the day has left.
         */
        const refusal = new NeuralWattAllowanceError({ model: 'glm-5.3-flash', estimateWh: 0.3, energy: ROOMY, },);
        expect(refusal.message,).toBe(
          'NeuralWatt has 0.150 Wh of the 550 Wh free energy left on 2026-10-20 (UTC) after 0.250 Wh held by calls '
            + 'in flight, and the call to glm-5.3-flash is estimated at 0.300 Wh; it was not sent, and the energy '
            + 'returns at 00:00 UTC',
        );
      },
    },),

    it({
      name: 'SAYS A BILLED REQUEST ENDED THE DAY\'S FREE ENERGY WHATEVER THE ARITHMETIC SHOWS, naming the day and the '
        + 'model and leaving the figures out, since they are not why the call was refused',
      fn: async () => {
        /**
         Refusal for a call on a billed day.
         */
        const refusal = new NeuralWattAllowanceError({ model: 'deepseek-v4.1-flash', estimateWh: 0.3, energy: BILLED, },);
        expect(refusal.message,).toBe(
          'NeuralWatt billed a request on 2026-10-20 (UTC), so its free energy is treated as spent until 00:00 UTC; '
            + 'the call to deepseek-v4.1-flash was not sent',
        );
        expect(refusal.message,).not.toContain('537.500',);
      },
    },),

    it({
      name: 'KEEPS THE READING IT WAS RAISED ON, names itself, and declares its message safe to forward',
      fn: async () => {
        /**
         Refusal whose reading a caller inspects.
         */
        const refusal = new NeuralWattAllowanceError({ model: 'glm-5.3-flash', estimateWh: 0.3, energy: ROOMY, },);
        expect(refusal.energy,).toBe(ROOMY,);
        expect(refusal.name,).toBe('NeuralWattAllowanceError',);
        expect(refusal,).toBeInstanceOf(Error,);
        expect(refusal.messageNamesOnly,).toBe(true,);
      },
    },),

    it({
      name: 'IS A BUDGET REFUSAL THE ROUTER MOVES ON FROM and not a payment refusal, since nothing is wrong with the '
        + 'account and the energy returns at 00:00 UTC, whether the day is spent by arithmetic or by a billed request',
      fn: async () => {
        for (const energy of [ROOMY, BILLED,]) {
          /**
           Refusal raised on this reading.
           */
          const refusal = new NeuralWattAllowanceError({ model: 'glm-5.3-flash', estimateWh: 0.3, energy, },);
          expect(isBudgetRefusal({ error: refusal, },),).toBe(true,);
          expect(isPaymentRefusal({ error: refusal, },),).toBe(false,);
        }
      },
    },),
  ],
},);
