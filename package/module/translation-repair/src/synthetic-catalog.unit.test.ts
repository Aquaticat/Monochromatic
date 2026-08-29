/**
 * Tests for the verified model catalog and request-weight estimation.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  estimateRequestWeight,
  SYNTHETIC_BASELINE_PROMPT_DOLLARS_PER_TOKEN,
  SYNTHETIC_MODELS,
} from '../dist/final/node/index.mjs';

await describe({
  name: estimateRequestWeight.name,
  children: [
    it({
      name: 'RETAINS THE DOCUMENTED REQUEST-WEIGHT DENOMINATOR after its retiring model leaves the roster',
      fn: async () => {
        expect(SYNTHETIC_BASELINE_PROMPT_DOLLARS_PER_TOKEN,).toBe(0.000001,);
      },
    },),

    it({
      name: 'derives every weight as the input-price ratio against the baseline',
      fn: async () => {
        /** Baseline input price weights divide by. */
        const baselinePrice = SYNTHETIC_BASELINE_PROMPT_DOLLARS_PER_TOKEN;
        for (const info of Object.values(SYNTHETIC_MODELS,)) {
          expect(estimateRequestWeight({ modelId: info.id, },),)
            .toBe(info.promptDollarsPerToken / baselinePrice,);
        }
      },
    },),

    it({
      name: 'keeps every catalog entry internally coherent',
      fn: async () => {
        for (const [key, info,] of Object.entries(SYNTHETIC_MODELS,)) {
          expect(info.id,).toBe(key,);
          expect(info.contextLength > 0,).toBe(true,);
          expect(info.maxOutputLength > 0,).toBe(true,);
          expect(info.promptDollarsPerToken > 0,).toBe(true,);
          expect(info.completionDollarsPerToken > 0,).toBe(true,);
        }
      },
    },),

    it({
      name: 'RECORDS THE LIVE GLM-5.3-FLASH WIRE FACTS and leaves retiring GLM-5.2 uncallable',
      fn: async () => {
        const replacement = SYNTHETIC_MODELS['hf:zai-org/GLM-5.3-Flash'];
        expect(replacement,).toEqual({
          id: 'hf:zai-org/GLM-5.3-Flash',
          readsImages: true,
          family: 'zai',
          contextLength: 524_288,
          maxOutputLength: 65_536,
          promptDollarsPerToken: 0.00000015,
          completionDollarsPerToken: 0.0000005,
        },);
        expect(Object.hasOwn(SYNTHETIC_MODELS, 'hf:zai-org/GLM-5.2',),).toBe(false,);
      },
    },),

    it({
      name: 'spans five vendor families across five distinct models',
      fn: async () => {
        /** Distinct families in the catalog. */
        const families = new Set(
          Object.values(SYNTHETIC_MODELS,).map(function toFamily(info,) {
            return info.family;
          },),
        );
        expect([...families,].toSorted(),).toEqual([
          'moonshot',
          'nvidia',
          'openai',
          'qwen',
          'zai',
        ],);
        // Five, not the ten ids the models endpoint lists: syn:large:text,
        // syn:large:vision, syn:small:text, and syn:small:vision each alias a
        // model already counted here. Admitting one would seat a single model
        // twice on a voting panel and count one opinion as two confirmations.
        //
        // FIVE RATHER THAN SIX SINCE 2026-08-24, when the owner blocklisted
        // `zai-org/GLM-4.7-Flash`. Still five vendor families, because the
        // family it left behind remains represented by GLM-5.3-Flash.
        expect(Object.keys(SYNTHETIC_MODELS,),).toHaveLength(5,);
      },
    },),
  ],
},);
