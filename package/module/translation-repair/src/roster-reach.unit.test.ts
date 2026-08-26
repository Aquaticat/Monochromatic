/**
 * Tests for the cross-provider roster lookup.
 *
 * THE GLM-5.2 VISION CASE IS WHY THIS FILE EXISTS. That model reads pictures on
 * Charm Hyper and not on Synthetic, so the two catalogs disagree while each
 * reports its own serving stack correctly. Every naive way to combine them gets
 * this model wrong in one direction or the other: ask only the older catalog
 * and a readable picture is refused, ask only the newer one and a picture is
 * sent where it cannot be read.
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
      name: 'SEATS TEN DISTINCT MODELS, five Synthetic serves and five only the second provider '
        + 'does, with the three shared ones counted once',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.length,).toBe(10,);
        expect(new Set(ROSTER_MODEL_IDS,).size,).toBe(10,);
      },
    },),

    it({
      name: 'DOES NOT SEAT the blocklisted model, which the owner removed on 2026-08-24',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.includes('hf:zai-org/GLM-4.7-Flash' as never,),).toBe(false,);
      },
    },),

    it({
      name: 'NAMES a shared model once, under its Synthetic spelling, so one model cannot occupy '
        + 'two seats on a voting panel and count one opinion as two confirmations',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.includes('hf:zai-org/GLM-5.2',),).toBe(true,);
        expect(ROSTER_MODEL_IDS.includes('glm-5.2' as never,),).toBe(false,);
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
        expect(hyperIdFor({ modelId: 'hf:zai-org/GLM-5.2', },),).toEqual({
          served: true,
          id: 'glm-5.2',
        },);
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
      name: 'REPORTS a Synthetic-only model as unserved rather than guessing a wire name for it',
      fn: async () => {
        expect(hyperIdFor({
          modelId: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
        },),).toEqual({ served: false, },);
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
        expect(reachOf({
          modelId: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
        },),).toEqual({
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
      name: 'SENDS GLM-5.2 PICTURES TO EXACTLY ONE PROVIDER, because it reads them on Charm Hyper '
        + 'and not on Synthetic: the same model, the same weights, a different serving stack',
      fn: async () => {
        expect(visionReachOf({ modelId: 'hf:zai-org/GLM-5.2', },),).toEqual({
          onSynthetic: false,
          onHyper: true,
        },);

        expect(reachOf({ modelId: 'hf:zai-org/GLM-5.2', },),).toEqual({
          onSynthetic: true,
          onHyper: true,
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
      name: 'NAMES THE READER SUB-ROSTER AS FIVE, widened from two by the second provider. Three '
        + 'of the five read only there, which is why the reading lane was a two-model bottleneck '
        + 'before this',
      fn: async () => {
        expect(ROSTER_MODEL_IDS
          .filter(function reads(modelId,): boolean {
            return readsImages({ modelId, },);
          },)
          .toSorted(),).toEqual([
          'hf:Qwen/Qwen3.8-27B',
          'hf:moonshotai/Kimi-K3',
          'hf:zai-org/GLM-5.2',
          'minimax-m3',
          'qwen3.8-max',
        ],);
      },
    },),

    it({
      name: 'ANSWERS true for a model that reads on either provider, not only on both',
      fn: async () => {
        expect(readsImages({ modelId: 'hf:zai-org/GLM-5.2', },),).toBe(true,);
      },
    },),
  ],
},);
