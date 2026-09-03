/**
 * Tests for the provider identity: the order the owner prefers to spend in,
 * and the record helpers every provider-keyed shape is built from.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isProviderName,
  otherProviders,
  PROVIDER_ORDER,
  providerRecord,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'PROVIDER_ORDER',
  children: [
    it({
      name: 'SPENDS ON SYNTHETIC, THEN HYPER, THEN OPENROUTER, which is the owner\'s order of '
        + '2026-09-03: the subscription first, the balance that will not be topped up next, and '
        + 'the per-token provider last',
      fn: async () => {
        expect(PROVIDER_ORDER,).toEqual([
          'synthetic',
          'hyper',
          'openrouter',
        ],);
      },
    },),
  ],
},);

await describe({
  name: providerRecord.name,
  children: [
    it({
      name: 'FILLS every provider from one function, in order, so a shape keyed by provider cannot '
        + 'be built with one missing',
      fn: async () => {
        /**
         * Positions each provider was asked in.
         */
        const asked: string[] = [];
        expect(providerRecord({
          of: function position(provider,): number {
            asked.push(provider,);
            return asked.length;
          },
        },),).toEqual({
          synthetic: 1,
          hyper: 2,
          openrouter: 3,
        },);
        expect(asked,).toEqual(PROVIDER_ORDER,);
      },
    },),
  ],
},);

await describe({
  name: otherProviders.name,
  children: [
    it({
      name: 'NAMES the others in spending order, whichever one is left out',
      fn: async () => {
        expect(otherProviders({ provider: 'hyper', },),).toEqual(['synthetic', 'openrouter',],);
        expect(otherProviders({ provider: 'synthetic', },),).toEqual(['hyper', 'openrouter',],);
        expect(otherProviders({ provider: 'openrouter', },),).toEqual(['synthetic', 'hyper',],);
      },
    },),
  ],
},);

await describe({
  name: isProviderName.name,
  children: [
    it({
      name: 'ADMITS the three names and nothing else, since a flag value reaches this unchecked',
      fn: async () => {
        expect(PROVIDER_ORDER.every(function admitted(provider,): boolean {
          return isProviderName(provider,);
        },),).toBe(true,);
        expect(isProviderName('anthropic',),).toBe(false,);
        expect(isProviderName('',),).toBe(false,);
      },
    },),
  ],
},);
