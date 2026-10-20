import {
  type NeuralWattServedId,
  type RosterModelId,
  servedRecord,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';

//region NeuralWatt catalog
// What NeuralWatt serves for this pipeline, how it spells it and where it is
// called.
//
// WHY THIS PROVIDER EXISTS IN THE PIPELINE. The owner, 2026-10-20: "I just
// added TRANSLATION_REPAIR_NEURALWATT_API_KEY . It includes 550Wh of energy on
// DeepSeek V4.1 Flash and GLM 5.3 Flash per day. And we need to meter (using
// estimations) ourselves because overage eats into my normal plan which I use
// for other stuff." Then: "Use the neuralwatt free energy front and center."
// It is the first provider in `PROVIDER_ORDER`: free energy that does not
// carry over is the most expiring money there is. Record:
// `doc/decision/translation-repair-neuralwatt-provider.md`.
//
// THE API IS OPENAI-COMPATIBLE: base `https://api.neuralwatt.com/v1`, a bearer
// key, `POST /v1/chat/completions` with streaming
// (`https://docs.neuralwatt.com`, fetched 2026-10-20). Raw fetch over the same
// transport seam as every other client, no SDK, as the owner's standing
// instruction for the Bedrock client already was.
//
// ONLY THE STANDARD IDS (`GET /v1/models`, public, fetched 2026-10-20):
// `deepseek-v4.1-flash` (context 1,048,560, maximum output 393,216, 0.15 and
// 0.60 USD per million tokens) and `glm-5.3-flash` (context 1,048,560, no
// listed output ceiling, 0.15 and 0.50). Not the `-flex` ids, which are billed
// at 0.65 of the price and "may be held under load"; not `-speed`, which the
// free energy does not cover; not the `nw-flash` alias. The free energy "covers
// each covered model's standard and Flex tiers" and "Speed lanes are billed
// normally" (`https://docs.neuralwatt.com/billing/daily-free-energy`).
//
// REASONING IS ON BY DEFAULT on both models (GLM-5.3-Flash always, at the
// listing's default effort of `max`; DeepSeek V4.1 Flash at `high`). The
// pipeline sends no reasoning parameter by the owner's standing rule of
// 2026-08-25, so the energy a call uses includes whatever thinking the default
// spends, and the matrix means the meter estimates from are over traffic that
// ran the same defaults.

/**
 Base address every NeuralWatt route hangs off.
 */
export const NEURALWATT_BASE_URL = 'https://api.neuralwatt.com/v1';

/**
 Header carrying the key, a bearer token as on the other providers.
 */
export const NEURALWATT_AUTH_HEADER = 'Authorization';

/**
 Verified per-model facts the router and the request builder read.

 @example
 ```ts
 const info: NeuralWattModelInfo = NEURALWATT_MODELS['deepseek-v4.1-flash'];
 ```
 */
export type NeuralWattModelInfo = {
  /**
   Identifier sent in the request body's `model` field.
   */
  readonly id: NeuralWattServedId;

  /**
   The roster seat this spelling reaches.
   */
  readonly sharedWith: RosterModelId;

  /**
   Whether a picture may be sent here: the listing's image input.
   */
  readonly readsImages: boolean;

  /**
   Context window in tokens, as the listing states it.
   */
  readonly contextLength: number;

  /**
   Ceiling the listing states for completion tokens, or the context window
   where it states none.
   */
  readonly maxOutputLength: number;
};

/**
 Every model this provider serves for this pipeline, read off the cards.

 @example
 ```ts
 const info = NEURALWATT_MODELS['glm-5.3-flash'];
 ```
 */
export const NEURALWATT_MODELS: Readonly<Record<NeuralWattServedId, NeuralWattModelInfo>> = servedRecord({
  provider: 'neuralwatt',
  toRow: function neuralWattRow(card,): NeuralWattModelInfo {
    /**
     NeuralWatt's side of the card.
     */
    const { neuralwatt, } = card;
    return {
      id: neuralwatt.id,
      sharedWith: card.id,
      readsImages: neuralwatt.readsImages,
      contextLength: neuralwatt.contextLength,
      maxOutputLength: neuralwatt.maxOutputLength,
    };
  },
},);

/**
 Chat completions URL.

 @param baseUrl - base address, overridable for tests

 @returns Absolute URL to POST the body to

 @example
 ```ts
 neuralWattChatUrlFor({ baseUrl: NEURALWATT_BASE_URL, },);
 // => 'https://api.neuralwatt.com/v1/chat/completions'
 ```
 */
export function neuralWattChatUrlFor({ baseUrl, }: { readonly baseUrl: string; },): string {
  return `${baseUrl}/chat/completions`;
}

/**
 Quota URL, which reports the plan's charged energy and says nothing about
 the daily free energy (`https://docs.neuralwatt.com/api/quota`, fetched
 2026-10-20).

 @param baseUrl - base address, overridable for tests

 @returns Absolute URL to GET

 @example
 ```ts
 neuralWattQuotaUrlFor({ baseUrl: NEURALWATT_BASE_URL, },);
 // => 'https://api.neuralwatt.com/v1/quota'
 ```
 */
export function neuralWattQuotaUrlFor({ baseUrl, }: { readonly baseUrl: string; },): string {
  return `${baseUrl}/quota`;
}

//endregion NeuralWatt catalog
