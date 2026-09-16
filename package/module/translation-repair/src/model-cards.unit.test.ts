/**
 Guards on the model cards: every catalog, cap table and hold set is a
 projection of them, so these hold the cards and the roster lists to each
 other and to the naming rule.

 Fixtures here are the roster itself; no corpus content appears.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  BEDROCK_MODELS,
  BEDROCK_ONLY_ROSTER_IDS,
  BEDROCK_SERVED_IDS,
  cardOf,
  cardsServing,
  COMPLETION_CAP,
  holdSet,
  HYPER_MODELS,
  HYPER_ORIGIN_ROSTER_IDS,
  HYPER_SERVED_IDS,
  MODEL_CARDS,
  OPENROUTER_MODELS,
  OPENROUTER_ONLY_ROSTER_IDS,
  OPENROUTER_SERVED_IDS,
  ROSTER_CARDS,
  ROSTER_MODEL_IDS,
  SYNTHETIC_MODELS,
  SYNTHETIC_SERVED_IDS,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'model-cards',
  children: [
    it({
      name: 'CARRIES ONE CARD PER ROSTER ID and nothing else, in roster order',
      fn: async () => {
        expect(Object.keys(MODEL_CARDS,),).toEqual([...ROSTER_MODEL_IDS,],);
        expect(ROSTER_CARDS.map(function toId(card,): string {
          return card.id;
        },),).toEqual([...ROSTER_MODEL_IDS,],);
        expect(new Set(ROSTER_MODEL_IDS,).size,).toBe(ROSTER_MODEL_IDS.length,);
      },
    },),

    it({
      name: 'NAMES EVERY SERVED SPELLING ON EXACTLY ONE CARD, so a served-id list entry without a card '
        + 'and a card spelling missing from its list both fail here rather than at the first call',
      fn: async () => {
        /**
         Served ids each provider's cards carry.
         */
        const carried = {
          synthetic: cardsServing({ provider: 'synthetic', },).map(function toId(card,): string {
            return card.synthetic.id;
          },),
          hyper: cardsServing({ provider: 'hyper', },).map(function toId(card,): string {
            return card.hyper.id;
          },),
          openrouter: cardsServing({ provider: 'openrouter', },).map(function toId(card,): string {
            return card.openrouter.id;
          },),
          bedrock: cardsServing({ provider: 'bedrock', },).map(function toId(card,): string {
            return card.bedrock.id;
          },),
        };
        expect(carried.synthetic.toSorted(),).toEqual([...SYNTHETIC_SERVED_IDS,].toSorted(),);
        expect(carried.hyper.toSorted(),).toEqual([...HYPER_SERVED_IDS,].toSorted(),);
        expect(carried.openrouter.toSorted(),).toEqual([...OPENROUTER_SERVED_IDS,].toSorted(),);
        expect(carried.bedrock.toSorted(),).toEqual([...BEDROCK_SERVED_IDS,].toSorted(),);
      },
    },),

    it({
      name: 'SPELLS EVERY ROSTER ID THE FIRST SERVING PROVIDER\'S WAY: Synthetic, else Hyper, else Bedrock, '
        + 'else OpenRouter, in the order the providers joined',
      fn: async () => {
        for (const card of ROSTER_CARDS) {
          /**
           Spelling the naming rule demands.
           */
          const expected = card.synthetic?.id ?? card.hyper?.id ?? card.bedrock?.id ?? card.openrouter?.id;
          expect(card.id,).toBe(expected,);
        }
      },
    },),

    it({
      name: 'KEYS EVERY DERIVED CATALOG BY THE CARDS, one row per served spelling with the card\'s fields',
      fn: async () => {
        expect(Object.keys(SYNTHETIC_MODELS,).toSorted(),).toEqual([...SYNTHETIC_SERVED_IDS,].toSorted(),);
        expect(Object.keys(HYPER_MODELS,).toSorted(),).toEqual([...HYPER_SERVED_IDS,].toSorted(),);
        expect(Object.keys(OPENROUTER_MODELS,).toSorted(),).toEqual([...OPENROUTER_SERVED_IDS,].toSorted(),);
        expect(Object.keys(BEDROCK_MODELS,).toSorted(),).toEqual([...BEDROCK_SERVED_IDS,].toSorted(),);
        expect(Object.keys(COMPLETION_CAP,).toSorted(),).toEqual([...ROSTER_MODEL_IDS,].toSorted(),);
        for (const card of cardsServing({ provider: 'openrouter', },)) {
          expect(OPENROUTER_MODELS[card.openrouter.id].sharedWith,).toBe(card.id,);
          expect(OPENROUTER_MODELS[card.openrouter.id].ignoredEndpoints,).toEqual(card.openrouter.ignoredEndpoints,);
        }
        for (const card of cardsServing({ provider: 'bedrock', },)) {
          expect(BEDROCK_MODELS[card.bedrock.id].sharedWith,).toBe(card.id,);
          expect(BEDROCK_MODELS[card.bedrock.id].route,).toBe(card.bedrock.route,);
        }
        for (const card of cardsServing({ provider: 'hyper', },)) {
          expect(HYPER_MODELS[card.hyper.id].sharedWith,).toBe(card.synthetic?.id ?? 'no-synthetic-counterpart',);
        }
      },
    },),

    it({
      name: 'DERIVES THE ORIGIN BUCKETS FROM THE SPELLINGS: Hyper-origin, Bedrock-only and OpenRouter-only '
        + 'ids are the roster ids spelled that provider\'s way',
      fn: async () => {
        expect([...HYPER_ORIGIN_ROSTER_IDS,],).toEqual(ROSTER_MODEL_IDS.filter(function hyperSpelled(id,): boolean {
          return (HYPER_SERVED_IDS as readonly string[]).includes(id,);
        },),);
        expect([...BEDROCK_ONLY_ROSTER_IDS,],).toEqual(ROSTER_MODEL_IDS.filter(function bedrockSpelled(id,): boolean {
          return (BEDROCK_SERVED_IDS as readonly string[]).includes(id,);
        },),);
        expect([...OPENROUTER_ONLY_ROSTER_IDS,],).toEqual(ROSTER_MODEL_IDS.filter(function openRouterSpelled(id,): boolean {
          return (OPENROUTER_SERVED_IDS as readonly string[]).includes(id,);
        },),);
        for (const modelId of BEDROCK_ONLY_ROSTER_IDS) {
          /**
           Card of a Bedrock-only model.
           */
          const card = cardOf({ modelId, },);
          expect(card.synthetic,).toBeUndefined();
          expect(card.hyper,).toBeUndefined();
          expect(card.openrouter,).toBeUndefined();
        }
      },
    },),

    it({
      name: 'READS EACH HOLD OFF THE CARDS, in roster order, and an unused hold reads empty',
      fn: async () => {
        for (const card of ROSTER_CARDS) {
          for (const hold of card.holds)
            expect(holdSet({ hold, },).has(card.id,),).toBe(true,);
        }
        expect([...holdSet({ hold: 'judge-unmeasured', },),],).toEqual(ROSTER_CARDS
          .filter(function held(card,): boolean {
            return card.holds.includes('judge-unmeasured',);
          },)
          .map(function toId(card,): string {
            return card.id;
          },),);
      },
    },),
  ],
},);
