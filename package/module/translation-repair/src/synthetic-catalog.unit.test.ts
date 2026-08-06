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
  SYNTHETIC_BASELINE_MODEL_ID,
  SYNTHETIC_MODELS,
} from '../dist/final/neutral/index.mjs';

await describe({
  name: estimateRequestWeight.name,
  children: [
    it({
      name: 'weights the baseline model as exactly one request',
      fn: async () => {
        expect(estimateRequestWeight({ modelId: SYNTHETIC_BASELINE_MODEL_ID, },),).toBe(1,);
      },
    },),

    it({
      name: 'derives every weight as the input-price ratio against the baseline',
      fn: async () => {
        /** Baseline input price weights divide by. */
        const baselinePrice = SYNTHETIC_MODELS[SYNTHETIC_BASELINE_MODEL_ID].promptDollarsPerToken;
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
      name: 'spans five vendor families across six distinct models',
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
        // Six, not the ten ids the models endpoint lists: syn:large:text,
        // syn:large:vision, syn:small:text, and syn:small:vision each alias a
        // model already counted here. Admitting one would seat a single model
        // twice on a voting panel and count one opinion as two confirmations.
        expect(Object.keys(SYNTHETIC_MODELS,),).toHaveLength(6,);
      },
    },),
  ],
},);
