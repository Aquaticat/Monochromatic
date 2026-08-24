/**
 * Tests for the three states a provider meter can be in, and for which of them
 * stops us spending.
 *
 * THE POINT OF THE THIRD STATE IS THAT IT DOES NOT CHANGE ROUTING. An
 * unreachable meter has always routed as spendable and still does; what it
 * gains here is a name, so a later reader of the log cannot mistake a
 * monitoring failure for a provider that was up. Both halves are pinned below,
 * because a change breaking either would be silent.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  meterStateOf,
  routesAsDry,
} from '../dist/final/node/index.mjs';

/**
 * Error a meter read rejects with when its endpoint cannot be reached.
 */
class MeterUnreachableError extends Error {
  public override readonly name = 'MeterUnreachableError';
}

await describe({
  name: meterStateOf.name,
  children: [
    it({
      name: 'reads a meter reporting budget left as wet',
      fn: async () => {
        /**
         * State a meter answering "there is budget" produces.
         */
        const state = await meterStateOf({
          name: 'synthetic',
          readDryness: async () => false,
        },);

        expect(state,).toBe('wet',);
      },
    },),

    it({
      name: 'reads a meter reporting nothing left as dry',
      fn: async () => {
        /**
         * State a meter answering "there is nothing left" produces.
         */
        const state = await meterStateOf({
          name: 'synthetic',
          readDryness: async () => true,
        },);

        expect(state,).toBe('dry',);
      },
    },),

    it({
      name: 'REFUSES to guess for a meter that could not be read, naming it instead',
      fn: async () => {
        /**
         * State an unreachable endpoint produces, which is the whole reason
         * this type has a third member.
         */
        const state = await meterStateOf({
          name: 'hyper',
          readDryness: async () => {
            throw new MeterUnreachableError('endpoint refused the connection',);
          },
        },);

        expect(state,).toBe('unreadable',);
      },
    },),
  ],
},);

await describe({
  name: routesAsDry.name,
  children: [
    it({
      name: 'holds out only a meter that answered and said dry',
      fn: async () => {
        expect(routesAsDry({ state: 'dry', },),).toBe(true,);
      },
    },),

    it({
      name: 'ACCEPTS a wet meter for spending',
      fn: async () => {
        expect(routesAsDry({ state: 'wet', },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS an unreadable meter for spending, so lost monitoring is not an outage',
      fn: async () => {
        expect(routesAsDry({ state: 'unreadable', },),).toBe(false,);
      },
    },),
  ],
},);
