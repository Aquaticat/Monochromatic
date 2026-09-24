/**
 Tests for the cross-provider roster lookup.
 
 EACH PROVIDER'S CATALOG REMAINS AUTHORITATIVE for its own serving stack.
 GLM-5.3-Flash is verified only on Synthetic and reads images there; no
 predecessor route or modality may be inherited from GLM-5.2.
 
 THE COUNTS ARE PINNED ON PURPOSE. A roster that silently gains or loses a
 seat changes what a quorum means, and this derivation is exactly where such a
 change would enter without anyone writing it down.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  bedrockServesLabel,
  DEFAULT_JUDGE_MODEL_IDS,
  HYPER_ORIGIN_NAMES_ARE_SERVED,
  HYPER_ORIGIN_ROSTER_IDS,
  hyperIdFor,
  hyperServesLabel,
  isDecisionSeat,
  openRouterServesLabel,
  reachOf,
  readsImages,
  ROSTER_MODEL_IDS,
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_BEDROCK_ONLY_VISION_UNSEATED,
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_HYPER_TEXT_BEDROCK,
  SEAT_HYPER_VISION,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
  SEAT_SYNTHETIC_VISION_EDITOR,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
  syntheticEntryFor,
  syntheticServes,
  visionReachOf,
} from '../dist/final/node/index.mjs';

/**
 Models the owner removed from every active stage.
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
         Roster ids no catalog has a row for under the roster's own spelling.
         */
        const unserved = ROSTER_MODEL_IDS.filter(function nobodyServes(modelId,): boolean {
          // A decision-only seat is served by the decisions endpoint, which
          // has no chat catalog row by design.
          if (isDecisionSeat({ modelId, },))
            return false;
          return (!syntheticServes(modelId,)) && (!hyperServesLabel(modelId,)) && (!bedrockServesLabel(modelId,))
            && (!openRouterServesLabel(modelId,));
        },);
        expect(unserved,).toStrictEqual([],);
      },
    },),
    it({
      name: 'HAS a Charm Hyper row for every Hyper-only roster label, the half of the roster with no '
        + 'other provider to fall back to',
      fn: async () => {
        /**
         Hyper-only labels the Hyper catalog does not carry.
         */
        const missing = HYPER_ORIGIN_ROSTER_IDS.filter(function noRow(modelId,): boolean {
          return !hyperServesLabel(modelId,);
        },);
        expect(missing,).toStrictEqual([],);
      },
    },),
    it({
      name: 'CARRIES the type-level proof as a value, so the same drift also stops the type check',
      fn: async () => {
        expect(HYPER_ORIGIN_NAMES_ARE_SERVED,).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: 'ROSTER_MODEL_IDS',
  children: [
    it({
      name: 'registers twelve distinct approved models without duplicating identities across providers',
      fn: async () => {
        // Eight until 2026-09-01, when the post-blocklist candidate refresh
        // admitted glm-5.3 and the same-day conformance probe culled the
        // refresh's two automatic-only Qwen3.8 routes before seating.
        // Eleven since 2026-09-07, when the owner's Bedrock account added the
        // two Gemma 4 sizes no other provider serves. Twelve since 2026-09-09,
        // when the owner approved Mercury 2.5, which only OpenRouter serves.
        // V4.1 Flash adds one approved identity on 2026-09-11, not one per serving provider.
        // Eleven since 2026-09-16, when the owner removed the two dated DeepSeek V4 models.
        // Twelve since 2026-09-18, when the owner approved Jev 1.13, a
        // decision-only seat served by OpenRouter's decisions endpoint alone.
        expect(ROSTER_MODEL_IDS.length,).toBe(12,);
        expect(new Set(ROSTER_MODEL_IDS,).size,).toBe(12,);
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
        expect(ROSTER_MODEL_IDS.includes(SEAT_SYNTHETIC_VISION_EDITOR,),).toBe(true,);
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
         Every model reachable through whole-roster production stages or
         explicit benchmark defaults. Narrow production roles are statically
         constrained to same roster type, so a departed literal fails types.
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
        expect(hyperIdFor({ modelId: SEAT_SYNTHETIC_VISION_WITHHELD, },),).toEqual({
          served: true,
          id: 'kimi-k3',
        },);
      },
    },),

    it({
      name: 'ANSWERS a Hyper-only model with its own name, since there is no other spelling to '
        + 'choose and so no translation to get wrong',
      fn: async () => {
        expect(hyperIdFor({ modelId: SEAT_HYPER_VISION, },),).toEqual({
          served: true,
          id: SEAT_HYPER_VISION,
        },);
      },
    },),

    it({
      name: 'ANSWERS the GLM-5.3-Flash seat with its own Hyper spelling, never a predecessor wire name',
      fn: async () => {
        // Unserved on Hyper until 2026-09-01, when the provider began listing
        // glm-5.3-flash; the claim that matters is unchanged: the seat must
        // never inherit the retired glm-5.2 spelling.
        expect(hyperIdFor({ modelId: SEAT_SYNTHETIC_VISION_EDITOR, },),)
          .toEqual({
            served: true,
            id: 'glm-5.3-flash',
          },);
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
        expect(syntheticEntryFor({ modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER, },).served,).toBe(true,);
      },
    },),

    it({
      name: 'REPORTS a Hyper-only model as unserved rather than indexing the record with an id '
        + 'that is not one of its keys',
      fn: async () => {
        expect(syntheticEntryFor({ modelId: SEAT_HYPER_OPENROUTER_UNMEASURED, },),)
          .toEqual({ served: false, },);
      },
    },),
  ],
},);

await describe({
  name: reachOf.name,
  children: [
    it({
      name: 'REPORTS every provider for a shared model, which is what makes an overflow and a '
        + 'cross-provider re-ask possible at all',
      fn: async () => {
        expect(reachOf({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, },),).toEqual({
          synthetic: true,
          hyper: true,
          bedrock: true,
          openrouter: true,
        },);
      },
    },),

    it({
      name: 'REPORTS Hyper and OpenRouter for a model Synthetic never served, and every provider for the '
        + 'seat that gained its second route',
      fn: async () => {
        // No Synthetic-only seat exists since 2026-09-01: glm-5.3-flash gave
        // the last single-route Synthetic seat its Hyper twin, and OpenRouter
        // serves the whole roster since 2026-09-03.
        expect(reachOf({ modelId: SEAT_SYNTHETIC_VISION_EDITOR, },),).toEqual({
          synthetic: true,
          hyper: true,
          bedrock: false,
          openrouter: true,
        },);

        expect(reachOf({ modelId: SEAT_HYPER_TEXT_BEDROCK, },),).toEqual({
          synthetic: false,
          hyper: true,
          bedrock: true,
          openrouter: true,
        },);
      },
    },),

    it({
      name: 'LEAVES every seated model reachable somewhere, so no roster entry is a seat that can '
        + 'never be filled',
      fn: async () => {
        for (const modelId of ROSTER_MODEL_IDS) {
          // A decision-only seat is reached through the decisions endpoint,
          // off every chat provider by design.
          if (isDecisionSeat({ modelId, },))
            continue;
          /**
           Where this model can be reached at all.
           */
          const reach = reachOf({ modelId, },);

          expect(reach.synthetic || reach.hyper || reach.bedrock || reach.openrouter,).toBe(true,);
        }
      },
    },),
  ],
},);

await describe({
  name: visionReachOf.name,
  children: [
    it({
      name: 'SENDS GLM-5.3-FLASH TO HYPER AND OPENROUTER and not to Synthetic, which lists it and is '
        + 'withheld on measured latency (class one hundred eighteen, CuspariaKLSY13), without inheriting '
        + 'GLM-5.2 Hyper reach',
      fn: async () => {
        // The Hyper side comes from glm-5.3-flash's own 2026-09-01 catalog
        // entry, never from the retired glm-5.2 spelling this test predates.
        // Synthetic still lists the model; the run does not route it there.
        expect(syntheticServes(SEAT_SYNTHETIC_VISION_EDITOR,),).toBe(true,);

        expect(visionReachOf({ modelId: SEAT_SYNTHETIC_VISION_EDITOR, },),).toEqual({
          synthetic: false,
          hyper: true,
          bedrock: false,
          openrouter: true,
        },);

        expect(reachOf({ modelId: SEAT_SYNTHETIC_VISION_EDITOR, },),).toEqual({
          synthetic: false,
          hyper: true,
          bedrock: false,
          openrouter: true,
        },);
      },
    },),

    it({
      name: 'KEEPS every provider that reads AND that the run buys from: Kimi-K3 reads on OpenRouter '
        + 'too and is withheld there on cost (owner, 2026-09-03; the reach honours it since 2026-09-09)',
      fn: async () => {
        expect(visionReachOf({ modelId: SEAT_SYNTHETIC_VISION_WITHHELD, },),).toEqual({
          synthetic: true,
          hyper: true,
          bedrock: false,
          openrouter: false,
        },);
      },
    },),

    it({
      name: 'REPORTS NOBODY for a model every provider serves and none gives vision to, which '
        + 'is the case a wrongly computed union would turn into a wasted call',
      fn: async () => {
        expect(visionReachOf({ modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE, },),).toEqual({
          synthetic: false,
          hyper: false,
          bedrock: false,
          openrouter: false,
        },);
      },
    },),

    it({
      name: 'SENDS gemma pictures through Bedrock alone, where its transcription was measured (2026-09-08), '
        + 'and not through OpenRouter, whose listing field alone cannot widen the reader roster',
      fn: async () => {
        expect(visionReachOf({ modelId: SEAT_HYPER_TEXT_BEDROCK, },),).toEqual({
          synthetic: false,
          hyper: false,
          bedrock: true,
          openrouter: false,
        },);
        expect(visionReachOf({ modelId: SEAT_BEDROCK_ONLY_TEXT, },),).toEqual({
          synthetic: false,
          hyper: false,
          bedrock: false,
          openrouter: false,
        },);
      },
    },),
  ],
},);

await describe({
  name: readsImages.name,
  children: [
    it({
      name: 'reports image reach independently of measured reader admission',
      fn: async () => {
        expect(ROSTER_MODEL_IDS
          .filter(function reads(modelId,): boolean {
            return readsImages({ modelId, },);
          },)
          .toSorted(),).toEqual([
          SEAT_HYPER_OPENROUTER_UNMEASURED,
          SEAT_HYPER_TEXT_BEDROCK,
          SEAT_BEDROCK_ONLY_VISION_UNSEATED,
          SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
          SEAT_SYNTHETIC_VISION_WITHHELD,
          SEAT_SYNTHETIC_VISION_EDITOR,
          SEAT_HYPER_VISION,
        ],);
      },
    },),

    it({
      name: 'ANSWERS true for a model that reads on either provider, not only on both',
      fn: async () => {
        expect(readsImages({ modelId: SEAT_SYNTHETIC_VISION_EDITOR, },),).toBe(true,);
      },
    },),
  ],
},);
