/**
 Tests the JSON exchange and the per-model limiter every provider client
 shares (audit area six): the exchange carries every field of the request but
 its validator, and each model gets one limiter of its own.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  chatJsonThrough,
  perModelLimiter,
} from '../dist/final/node/index.mjs';

/**
 Whether a parsed answer names a cat.

 @param value - parsed answer

 @returns True for an object with a string `cat`

 @example
 ```ts
 namesCat({ cat: 'Mittens', },); // true
 ```
 */
function namesCat(value: unknown,): value is { readonly cat: string; } {
  return ((typeof value) === 'object') && (value !== null) && ('cat' in value) && ((typeof value.cat) === 'string');
}

await describe({
  name: chatJsonThrough.name,
  children: [
    it({
      name: 'FORWARDS EVERY FIELD OF THE REQUEST BUT ITS VALIDATOR to the text exchange, the ones no copy '
        + 'named included, and reads the reply against the validator',
      fn: async () => {
        /**
         Requests the text exchange received.
         */
        const seen: Record<string, unknown>[] = [];
        const chatJson = chatJsonThrough({
          chatText: async function chatText(request,) {
            seen.push({ ...request, },);
            return { text: '{"cat":"Mittens"}', };
          },
        },);
        const outcome = await chatJson({
          modelId: 'minimax-m3',
          messages: [{ role: 'user', content: 'Name the cat.', },],
          signal: AbortSignal.timeout(60_000,),
          maxTokens: 64,
          otherThan: 'synthetic',
          validate: namesCat,
        },);
        expect(outcome.kind,).toBe('ok',);
        expect(Object.keys(seen[0] ?? {},).toSorted(),).toEqual([
          'maxTokens',
          'messages',
          'modelId',
          'otherThan',
          'signal',
        ],);
      },
    },),
  ],
},);

await describe({
  name: perModelLimiter.name,
  children: [
    it({
      name: 'HANDS EACH MODEL ONE LIMITER OF ITS OWN, kept across calls, at the concurrency asked for',
      fn: async () => {
        const limiterFor = perModelLimiter({ perModelConcurrency: 2, },);
        expect(limiterFor('minimax-m3',),).toBe(limiterFor('minimax-m3',),);
        expect(limiterFor('minimax-m3',),).not.toBe(limiterFor('google.gemma-4-31b',),);
        expect(limiterFor('minimax-m3',).concurrency,).toBe(2,);
      },
    },),
  ],
},);
