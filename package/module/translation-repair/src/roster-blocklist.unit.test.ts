/**
 * Tests that the owner blocklist bars every blocked spelling from the
 * compiled catalogs and labels family arrivals, while leaving the eligible
 * neighbours (dated DeepSeek aliases, the Qwen3.8 line short of Max, the
 * GLM-5.3 pair) untouched.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  blocklistVerdictFor,
  HYPER_MODELS,
  ROSTER_BLOCKLIST,
  ROSTER_MODEL_IDS,
  SYNTHETIC_MODELS,
} from '../dist/final/node/index.mjs';

await describe({
  name: blocklistVerdictFor.name,
  children: [
    it({
      name: 'BARS EVERY BLOCKED SPELLING from the roster and both compiled catalogs',
      fn: async () => {
        /**
         * Every id the pipeline could seat.
         */
        const seated = [
          ...ROSTER_MODEL_IDS,
          ...Object.keys(SYNTHETIC_MODELS,),
          ...Object.keys(HYPER_MODELS,),
        ];
        for (const id of seated)
          expect(blocklistVerdictFor({ id, },),).toEqual({ blocked: false, },);
      },
    },),

    it({
      name: 'RETURNS THE OWNER REASON for exact entries under both provider spellings',
      fn: async () => {
        expect(blocklistVerdictFor({ id: 'qwen3.8-max', },),).toEqual({
          blocked: true,
          reason: 'absurd cost in money',
        },);
        expect(blocklistVerdictFor({ id: 'hf:zai-org/GLM-5.2', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
        expect(blocklistVerdictFor({ id: 'glm-5.2', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
        expect(blocklistVerdictFor({ id: 'syn:small:text', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
        expect(blocklistVerdictFor({ id: 'deepseek-v4-pro', },),).toEqual({
          blocked: true,
          reason: 'the undated versions',
        },);
        expect(
          blocklistVerdictFor({ id: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4', },),
        ).toEqual({
          blocked: true,
          reason: "can't stick to its own viewpoint",
        },);
      },
    },),

    it({
      name: 'CATCHES FAMILY ARRIVALS the owner phrased as series, on both provider spellings',
      fn: async () => {
        // A name the provider adds later inside a blocked family must not
        // surface as a candidate at the next refresh.
        expect(blocklistVerdictFor({ id: 'llama-5-800b-instruct', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
        expect(blocklistVerdictFor({ id: 'hf:meta-llama/Llama-4-Scout', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
        expect(blocklistVerdictFor({ id: 'qwen3.6-turbo', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
        expect(blocklistVerdictFor({ id: 'hf:Qwen/Qwen3.7-Omni', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
        expect(blocklistVerdictFor({ id: 'qwen3-vl-235b', },),).toEqual({
          blocked: true,
          reason: 'too outdated',
        },);
      },
    },),

    it({
      name: 'LEAVES ELIGIBLE NEIGHBOURS ALONE: dated DeepSeek, the Qwen3.8 line short of Max, the GLM-5.3 pair, Kimi K3',
      fn: async () => {
        // The dot after qwen3 is the family boundary, and the owner's single
        // exact entries must not leak onto their newer siblings.
        expect(blocklistVerdictFor({ id: 'deepseek-v4-pro-0813', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'deepseek-v4-flash-0731', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'qwen3.8-flash', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'qwen3.8-2.4t-a95b', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'hf:Qwen/Qwen3.8-27B', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'glm-5.3', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'glm-5.3-flash', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'hf:zai-org/GLM-5.3-Flash', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'hf:moonshotai/Kimi-K3', },),).toEqual({ blocked: false, },);
        expect(blocklistVerdictFor({ id: 'kimi-k2.8', },),).toEqual({ blocked: false, },);
      },
    },),

    it({
      name: 'CARRIES A REASON ON EVERY ENTRY, since the constant exists to record authority',
      fn: async () => {
        for (const entry of ROSTER_BLOCKLIST)
          expect(entry.reason.length > 0,).toBe(true,);
      },
    },),
  ],
},);
