/**
 Tests for the question every layer asks of a failed call: does this failure end the run, or cost one seat its voice.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { EveryProviderDryError, } from '@monochromatic-dev/translation-repair-provider';
import { NoProviderForModelError, } from '@monochromatic-dev/translation-repair-markup';
import {
  isDryRefusal,
  endsTheRun,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  children: [
    describe({
      name: endsTheRun.name,
      children: [
        it({
          name: 'ANSWERS YES FOR THE ROUTER\'S EVERY-PROVIDER-DRY REFUSAL, which the owner ruled ends the run',
          fn: async () => {
            expect(endsTheRun({ error: new EveryProviderDryError({ measured: 'every meter dry', },), },),).toBe(true,);
          },
        },),
  
        it({
          name: 'ANSWERS NO FOR A SEAT THE ROUTER CANNOT SERVE, which is a lost seat on a bench that stands, and for any '
            + 'other failure or non-error thrown value',
          fn: async () => {
            expect(endsTheRun({ error: new NoProviderForModelError({ modelId: 'minimax-m3', reason: 'no provider serves this model', },), },),).toBe(false,);
            expect(endsTheRun({ error: new Error('connection reset',), },),).toBe(false,);
            expect(endsTheRun({ error: 'the cat sat', },),).toBe(false,);
          },
        },),
      ],
    },),

    describe({
      name: isDryRefusal.name,
      children: [
        it({
          name: 'ANSWERS YES ONLY FOR THE ROUTER\'S EVERY-PROVIDER-DRY REFUSAL, narrowing it to its class, and no for any other value',
          fn: async () => {
          /**
           The refusal the router raised.
           */
            const dry = new EveryProviderDryError({ measured: 'every meter dry', },);
            expect(isDryRefusal(dry,),).toBe(true,);
            expect(
              isDryRefusal(new Error('connection reset',),),
            ).toBe(false,);
            expect(isDryRefusal('the cat sat',),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
