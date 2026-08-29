/**
 * Tests for the cross-provider roster lookup.
 *
 * EACH PROVIDER'S CATALOG REMAINS AUTHORITATIVE for its own serving stack.
 * GLM-5.3-Flash is verified only on Synthetic and reads images there; no
 * predecessor route or modality may be inherited from GLM-5.2.
 *
 * THE COUNTS ARE PINNED ON PURPOSE. A roster that silently gains or loses a
 * seat changes what a quorum means, and this derivation is exactly where such a
 * change would enter without anyone writing it down.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEFAULT_JUDGE_MODEL_IDS,
  HYPER_ONLY_NAMES_ARE_SERVED,
  HYPER_ONLY_ROSTER_IDS,
  hyperIdFor,
  hyperServesLabel,
  readsImages,
  reachOf,
  ROSTER_MODEL_IDS,
  syntheticEntryFor,
  syntheticServes,
  visionReachOf,
} from '../dist/final/node/index.mjs';

/**
 * Models the owner removed from every active stage.
 */
const DEPARTED_MODEL_IDS = [
  'hf:zai-org/GLM-4.7-Flash',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
] as const;

// FIRST, because every describe after this one assumes the roster is served:
// a label with no catalog row must fail here, by name, before it fails a
// count elsewhere.
await describe({
  name: 'roster against the catalogs',
  children: [
    it({
      name: 'SERVES every roster id from at least one catalog, so a roster label without a catalog '
        + 'row fails here rather than as one lost voice per call (`#241`)',
      fn: async () => {
        /**
         * Roster ids no catalog has a row for under the roster's own spelling.
         */
        const unserved = ROSTER_MODEL_IDS.filter(function nobodyServes(modelId,): boolean {
          return (!syntheticServes(modelId,)) && (!hyperServesLabel(modelId,));
        },);
        expect(unserved,).toStrictEqual([],);
      },
    },),
    it({
      name: 'HAS a Charm Hyper row for every Hyper-only roster label, the half of the roster with no '
        + 'other provider to fall back to',
      fn: async () => {
        /**
         * Hyper-only labels the Hyper catalog does not carry.
         */
        const missing = HYPER_ONLY_ROSTER_IDS.filter(function noRow(modelId,): boolean {
          return !hyperServesLabel(modelId,);
        },);
        expect(missing,).toStrictEqual([],);
      },
    },),
    it({
      name: 'CARRIES the type-level proof as a value, so the same drift also stops the type check',
      fn: async () => {
        expect(HYPER_ONLY_NAMES_ARE_SERVED,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: 'ROSTER_MODEL_IDS',
  children: [
    it({
      name: 'SEATS EIGHT DISTINCT MODELS, four Synthetic serves and four only the second provider does',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.length,).toBe(8,);
        expect(new Set(ROSTER_MODEL_IDS,).size,).toBe(8,);
      },
    },),

    it({
      name: 'DOES NOT SEAT qwen3.8-max after owner culled its disproportionate metered cost',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.includes('qwen3.8-max' as never,),).toBe(false,);
      },
    },),

    it({
      name: 'DOES NOT SEAT the blocklisted model, which the owner removed on 2026-08-24',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.includes('hf:zai-org/GLM-4.7-Flash' as never,),).toBe(false,);
      },
    },),

    it({
      name: 'DOES NOT SEAT Nemotron after contradictory adjacent review guidance caused owner removal',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.includes(
          'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4' as never,
        ),).toBe(false,);
      },
    },),

    it({
      name: 'REPLACES GLM-5.2 rather than double-seating predecessor and successor',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.includes('hf:zai-org/GLM-5.3-Flash',),).toBe(true,);
        expect(ROSTER_MODEL_IDS.includes('hf:zai-org/GLM-5.2' as never,),).toBe(false,);
        expect(ROSTER_MODEL_IDS.includes('glm-5.2' as never,),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: 'active stage model exclusions',
  children: [
    it({
      name: 'KEEPS owner-removed models out of callable production roster and benchmark defaults',
      fn: async () => {
        /**
         * Every model reachable through whole-roster production stages or
         * explicit benchmark defaults. Narrow production roles are statically
         * constrained to same roster type, so a departed literal fails types.
         */
        const activeStageModelIds = new Set<string>([
          ...ROSTER_MODEL_IDS,
          ...DEFAULT_JUDGE_MODEL_IDS,
        ],);

        for (const departedModelId of DEPARTED_MODEL_IDS)
          expect(activeStageModelIds.has(departedModelId,),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: hyperIdFor.name,
  children: [
    it({
      name: 'TRANSLATES a shared model into the spelling the second provider uses, which is the '
        + 'whole reason a roster id and a wire id are different things',
      fn: async () => {
        expect(hyperIdFor({ modelId: 'hf:moonshotai/Kimi-K3', },),).toEqual({
          served: true,
          id: 'kimi-k3',
        },);
      },
    },),

    it({
      name: 'ANSWERS a Hyper-only model with its own name, since there is no other spelling to '
        + 'choose and so no translation to get wrong',
      fn: async () => {
        expect(hyperIdFor({ modelId: 'minimax-m3', },),).toEqual({
          served: true,
          id: 'minimax-m3',
        },);
      },
    },),

    it({
      name: 'REPORTS Synthetic-only model as unserved rather than inheriting predecessor wire names',
      fn: async () => {
        expect(hyperIdFor({ modelId: 'hf:zai-org/GLM-5.3-Flash', },),)
          .toEqual({ served: false, },);
      },
    },),
  ],
},);

await describe({
  name: syntheticEntryFor.name,
  children: [
    it({
      name: 'FINDS the catalog entry for a model this provider serves',
      fn: async () => {
        expect(syntheticEntryFor({ modelId: 'hf:Qwen/Qwen3.8-27B', },).served,).toBe(true,);
      },
    },),

    it({
      name: 'REPORTS a Hyper-only model as unserved rather than indexing the record with an id '
        + 'that is not one of its keys',
      fn: async () => {
        expect(syntheticEntryFor({ modelId: 'deepseek-v4-pro-0813', },),)
          .toEqual({ served: false, },);
      },
    },),
  ],
},);

await describe({
  name: reachOf.name,
  children: [
    it({
      name: 'REPORTS both providers for a shared model, which is what makes an overflow and a '
        + 'cross-provider re-ask possible at all',
      fn: async () => {
        expect(reachOf({ modelId: 'hf:openai/gpt-oss-120b', },),).toEqual({
          onSynthetic: true,
          onHyper: true,
        },);
      },
    },),

    it({
      name: 'REPORTS one provider for a model only that provider serves, on both sides',
      fn: async () => {
        expect(reachOf({ modelId: 'hf:zai-org/GLM-5.3-Flash', },),).toEqual({
          onSynthetic: true,
          onHyper: false,
        },);

        expect(reachOf({ modelId: 'gemma-4-26b-a4b-it', },),).toEqual({
          onSynthetic: false,
          onHyper: true,
        },);
      },
    },),

    it({
      name: 'LEAVES every seated model reachable somewhere, so no roster entry is a seat that can '
        + 'never be filled',
      fn: async () => {
        for (const modelId of ROSTER_MODEL_IDS) {
          /**
           * Where this model can be reached at all.
           */
          const reach = reachOf({ modelId, },);

          expect(reach.onSynthetic || reach.onHyper,).toBe(true,);
        }
      },
    },),
  ],
},);

await describe({
  name: visionReachOf.name,
  children: [
    it({
      name: 'SENDS GLM-5.3-FLASH PICTURES TO SYNTHETIC without inheriting GLM-5.2 Hyper reach',
      fn: async () => {
        expect(visionReachOf({ modelId: 'hf:zai-org/GLM-5.3-Flash', },),).toEqual({
          onSynthetic: true,
          onHyper: false,
        },);

        expect(reachOf({ modelId: 'hf:zai-org/GLM-5.3-Flash', },),).toEqual({
          onSynthetic: true,
          onHyper: false,
        },);
      },
    },),

    it({
      name: 'KEEPS both providers for a model that reads on both, so a picture is not needlessly '
        + 'pinned to one of them',
      fn: async () => {
        expect(visionReachOf({ modelId: 'hf:moonshotai/Kimi-K3', },),).toEqual({
          onSynthetic: true,
          onHyper: true,
        },);
      },
    },),

    it({
      name: 'REPORTS NEITHER for a model both providers serve and neither gives vision to, which '
        + 'is the case a wrongly computed union would turn into a wasted call',
      fn: async () => {
        expect(visionReachOf({ modelId: 'hf:openai/gpt-oss-120b', },),).toEqual({
          onSynthetic: false,
          onHyper: false,
        },);
      },
    },),
  ],
},);

await describe({
  name: readsImages.name,
  children: [
    it({
      name: 'KEEPS READER SUB-ROSTER AT FOUR after replacing one image-capable model with another',
      fn: async () => {
        expect(ROSTER_MODEL_IDS
          .filter(function reads(modelId,): boolean {
            return readsImages({ modelId, },);
          },)
          .toSorted(),).toEqual([
          'hf:Qwen/Qwen3.8-27B',
          'hf:moonshotai/Kimi-K3',
          'hf:zai-org/GLM-5.3-Flash',
          'minimax-m3',
        ],);
      },
    },),

    it({
      name: 'ANSWERS true for a model that reads on either provider, not only on both',
      fn: async () => {
        expect(readsImages({ modelId: 'hf:zai-org/GLM-5.3-Flash', },),).toBe(true,);
      },
    },),
  ],
},);
