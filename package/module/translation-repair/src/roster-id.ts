//region Roster identity
// WHO IS ON THE ROSTER AND HOW EACH PROVIDER SPELLS THEM, named once.
//
// This file imports nothing on purpose. The card type, the cards and every
// catalog need these names and each other's would be a cycle, so the
// identity lives on its own and the cards describe it.
//
// LISTS RATHER THAN A DERIVATION FROM THE CARDS because declaration emit
// (`isolatedDeclarations`) cannot infer a nested object literal, so the
// literal unions the catalogs key on have to come from `as const` arrays of
// strings. The cards in `model-cards.ts` are a `Record` over the roster
// list, so a name added here without a card, or a card without a name, is a
// type error, and a card naming a served id missing from its provider's
// list is one too.
//
// Roster identities are independent of provider routes. A model is one
// roster entry however many providers can reach it, which is the property
// the adjudication tally depends on: `synthetic-catalog.ts` explains at
// length why one model occupying two seats would silently overstate
// agreement, and a second provider is exactly the new way for that to
// happen.
//
// SHARED MODELS ARE NAMED THE SYNTHETIC WAY, else the Hyper way, else
// Bedrock's, else OpenRouter's, in the order the providers joined.
// `hf:moonshotai/Kimi-K3` and `kimi-k3` are one model with two spellings,
// and the roster needs one of them; Synthetic was here first, its ids are
// already written into settled artifacts, and `roster-reach.ts` translates
// when a call actually goes to another provider.

/**
 Every model this pipeline may seat, in the order the roster reads them:
 the Synthetic four, the Hyper-origin seats, then the Bedrock-only and
 OpenRouter-only arrivals.

 @example
 ```ts
 const everyone = ROSTER_MODEL_IDS;
 ```
 */
export const ROSTER_MODEL_IDS = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:openai/gpt-oss-120b',
  'minimax-m3',
  'gemma-4-26b-a4b-it',
  'glm-5.3',
  'deepseek-v4.1-flash',
  'google.gemma-4-e2b',
  'google.gemma-4-31b',
  'inception/mercury-2.5',
] as const;

/**
 Every model this pipeline may seat, whoever serves it.

 @example
 ```ts
 const modelId: RosterModelId = 'hf:moonshotai/Kimi-K3';
 ```
 */
export type RosterModelId = typeof ROSTER_MODEL_IDS[number];

/**
 Spellings Synthetic serves, which are also those models' roster spellings.

 @example
 ```ts
 const everyone = SYNTHETIC_SERVED_IDS;
 ```
 */
export const SYNTHETIC_SERVED_IDS = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:openai/gpt-oss-120b',
] as const;

/**
 Roster models Synthetic serves.

 @example
 ```ts
 const modelId: SyntheticServedId = 'hf:zai-org/GLM-5.3-Flash';
 ```
 */
export type SyntheticServedId = typeof SYNTHETIC_SERVED_IDS[number];

/**
 Spellings Charm Hyper serves.

 @example
 ```ts
 const everyone = HYPER_SERVED_IDS;
 ```
 */
export const HYPER_SERVED_IDS = [
  'glm-5.3-flash',
  'qwen3.8-27b',
  'kimi-k3',
  'gpt-oss-120b',
  'minimax-m3',
  'gemma-4-26b-a4b-it',
  'glm-5.3',
  'deepseek-v4.1-flash',
] as const;

/**
 Model identifier Charm Hyper accepts on the wire.

 @example
 ```ts
 const modelId: HyperServedId = 'deepseek-v4.1-flash';
 ```
 */
export type HyperServedId = typeof HYPER_SERVED_IDS[number];

/**
 Spellings OpenRouter serves.

 @example
 ```ts
 const everyone = OPENROUTER_SERVED_IDS;
 ```
 */
export const OPENROUTER_SERVED_IDS = [
  'z-ai/glm-5.3-flash',
  'moonshotai/kimi-k3',
  'openai/gpt-oss-120b',
  'minimax/minimax-m3',
  'google/gemma-4-26b-a4b-it',
  'deepseek/deepseek-v4.1-flash',
  'inception/mercury-2.5',
] as const;

/**
 Model identifier OpenRouter accepts on the wire.

 @example
 ```ts
 const modelId: OpenRouterServedId = 'moonshotai/kimi-k3';
 ```
 */
export type OpenRouterServedId = typeof OPENROUTER_SERVED_IDS[number];

/**
 Spellings Amazon Bedrock serves.

 @example
 ```ts
 const everyone = BEDROCK_SERVED_IDS;
 ```
 */
export const BEDROCK_SERVED_IDS = [
  'openai.gpt-oss-120b',
  'google.gemma-4-26b-a4b',
  'google.gemma-4-e2b',
  'google.gemma-4-31b',
] as const;

/**
 Model identifier Amazon Bedrock accepts on the wire.

 @example
 ```ts
 const modelId: BedrockServedId = 'google.gemma-4-31b';
 ```
 */
export type BedrockServedId = typeof BEDROCK_SERVED_IDS[number];

/**
 Roster identities introduced through Charm Hyper without a Synthetic
 spelling: by the naming rule, the roster ids that are Hyper spellings.
 The historical bucket name is not exclusive reach: OpenRouter serves
 several too.

 @example
 ```ts
 const modelId: HyperOriginRosterId = 'minimax-m3';
 ```
 */
export type HyperOriginRosterId = Extract<RosterModelId, HyperServedId>;

/**
 Roster models only Amazon Bedrock serves: by the naming rule, the roster
 ids that are Bedrock spellings.

 @example
 ```ts
 const modelId: BedrockOnlyRosterId = 'google.gemma-4-31b';
 ```
 */
export type BedrockOnlyRosterId = Extract<RosterModelId, BedrockServedId>;

/**
 Roster models only OpenRouter serves: by the naming rule, the roster ids
 that are OpenRouter spellings.

 @example
 ```ts
 const modelId: OpenRouterOnlyRosterId = 'inception/mercury-2.5';
 ```
 */
export type OpenRouterOnlyRosterId = Extract<RosterModelId, OpenRouterServedId>;

//endregion Roster identity
