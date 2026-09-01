/**
 * Tests for the Charm Hyper catalog.
 *
 * THIS FILE PINS MEASUREMENTS, not preferences. Every value it checks came from
 * live calls, and each one is a value that a plausible reading of provider
 * docs could get wrong: model answer ceiling can sit below bound `#156`,
 * and provider-specific image input support must be read rather than inferred.
 *
 * A CHANGED VALUE HERE IS A PROVIDER CHANGE, so these cases are meant to fail
 * loudly rather than be updated to match.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  answerCeilingFor,
  HYPER_MODELS,
  HYPER_ONLY,
  modelsServedByBoth,
  modelsServedOnlyHere,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'hyper-catalog',
  children: [
    it({
      name: 'CARRIES every model the owner allowlisted, and nothing else, so a model reaches the '
        + 'wire because it was chosen rather than because a string resolved',
      fn: async () => {
        expect(Object.keys(HYPER_MODELS,).toSorted(),).toEqual([
          'deepseek-v4-flash-0731',
          'deepseek-v4-pro-0813',
          'gemma-4-26b-a4b-it',
          'glm-5.3',
          'glm-5.3-flash',
          'gpt-oss-120b',
          'kimi-k3',
          'minimax-m3',
          'qwen3.8-27b',
        ],);
      },
    },),

    it({
      name: 'LOWERS the answer ceiling to what a model can actually emit, which two of the nine '
        + 'cannot reach: asking for more than a model emits buys a truncation and reports it as a '
        + 'schema mismatch, sending a reader to the prompt instead of to the ceiling',
      fn: async () => {
        expect(answerCeilingFor({ modelId: 'gpt-oss-120b', },),).toBe(13_107,);
        expect(answerCeilingFor({ modelId: 'kimi-k3', },),).toBe(16_000,);
      },
    },),

    it({
      name: 'HOLDS the measured bound for a model that could emit far more, since the bound is '
        + 'about what an answer should be rather than what a model is capable of',
      fn: async () => {
        expect(answerCeilingFor({ modelId: 'deepseek-v4-flash-0731', },),).toBe(32_000,);
        expect(answerCeilingFor({ modelId: 'minimax-m3', },),).toBe(32_000,);
      },
    },),

    it({
      name: 'NAMES the four models both providers serve, which are the only ones a non-conformant '
        + 'answer can be re-asked across',
      fn: async () => {
        // glm-5.3-flash joined 2026-09-01 as the Hyper route for Synthetic's
        // GLM-5.3-Flash seat.
        expect(modelsServedByBoth().toSorted(),).toEqual([
          'glm-5.3-flash',
          'gpt-oss-120b',
          'kimi-k3',
          'qwen3.8-27b',
        ],);
      },
    },),

    it({
      name: 'NAMES the five models only this provider serves, which have no cross-provider re-ask '
        + 'and fall back to the invalid-candidate path from `#88` instead',
      fn: async () => {
        expect(modelsServedOnlyHere().toSorted(),).toEqual([
          'deepseek-v4-flash-0731',
          'deepseek-v4-pro-0813',
          'gemma-4-26b-a4b-it',
          'glm-5.3',
          'minimax-m3',
        ],);
      },
    },),

    it({
      name: 'SPLITS the roster into shared and provider-only with no model in both and none left '
        + 'out, since a model missing from the split would silently lose its recovery path',
      fn: async () => {
        expect(modelsServedByBoth().length + modelsServedOnlyHere().length,)
          .toBe(Object.keys(HYPER_MODELS,).length,);

        for (const id of modelsServedByBoth())
          expect(modelsServedOnlyHere().includes(id,),).toBe(false,);
      },
    },),

    it({
      name: 'PAIRS each shared model with the SAME panelist on the other provider, because '
        + 'provider is not part of panelist identity: a slice judged by that model counts once '
        + 'however it was reached',
      fn: async () => {
        expect(HYPER_MODELS['kimi-k3'].sharedWith,).toBe('hf:moonshotai/Kimi-K3',);
        expect(HYPER_MODELS['gpt-oss-120b'].sharedWith,).toBe('hf:openai/gpt-oss-120b',);
        expect(HYPER_MODELS['qwen3.8-27b'].sharedWith,).toBe('hf:Qwen/Qwen3.8-27B',);
        expect(HYPER_MODELS['minimax-m3'].sharedWith,).toBe(HYPER_ONLY,);
      },
    },),

    it({
      name: 'REPORTS four image readers after the 2026-09-01 candidate refresh and its same-day cull',
      fn: async () => {
        /**
         * Models this provider says can be sent an image.
         */
        const readers = Object
          .values(HYPER_MODELS,)
          .filter(function reads(info,): boolean {
            return info.readsImages;
          },)
          .map(function toId(info,): string {
            return info.id;
          },);

        expect(readers.toSorted(),).toEqual([
          'glm-5.3-flash',
          'kimi-k3',
          'minimax-m3',
          'qwen3.8-27b',
        ],);
      },
    },),
  ],
},);
