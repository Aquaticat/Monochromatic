//region Roster identity
// WHO IS ON THE ROSTER, named once, independently of who serves them.
//
// This file imports nothing on purpose. Both catalogs need these names and each
// other's would be a cycle, so the identity lives on its own and the catalogs
// describe it from their own side.
//
// Roster identities are independent of provider routes. Hyper-origin identities
// can also be served by OpenRouter; their historical bucket is not an exclusive
// serving claim. New versions retain independent calibration and history. A
// model is one roster entry however many providers can reach it, which
// is the property the adjudication tally depends on: `synthetic-catalog.ts`
// explains at length why one model occupying two seats would silently overstate
// agreement, and a second provider is exactly the new way for that to happen.
//
// SHARED MODELS ARE NAMED THE SYNTHETIC WAY. `hf:moonshotai/Kimi-K3` and
// `kimi-k3` are one model with two spellings, and the roster needs one of them. Synthetic
// was here first, its ids are already written into settled artifacts, and
// `roster-reach.ts` translates when a call actually goes to the other provider.

/**
 * Roster models Synthetic serves.
 *
 * `hf:zai-org/GLM-4.7-Flash` WAS REMOVED 2026-08-24 at the owner's instruction,
 * which reverses `#136`'s finding that it should stay. That finding compared it
 * against five peers; that wider roster later changed independently.
 *
 * `hf:zai-org/GLM-5.2` WAS REPLACED 2026-08-29 by GLM-5.3-Flash after the
 * live endpoint confirmed the successor and the operational request reported
 * Synthetic's plan to retire the older model.
 *
 * `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` WAS REMOVED 2026-08-29
 * at the owner's instruction after contradicting its own concrete wording
 * recommendation in adjacent required-correction reviews.
 *
 * @example
 * ```ts
 * const modelId: SyntheticServedId = 'hf:zai-org/GLM-5.3-Flash';
 * ```
 */
export type SyntheticServedId =
  | 'hf:zai-org/GLM-5.3-Flash'
  | 'hf:Qwen/Qwen3.8-27B'
  | 'hf:moonshotai/Kimi-K3'
  | 'hf:openai/gpt-oss-120b';

/**
 * Roster identities introduced through Charm Hyper without a Synthetic spelling.
 * The historical bucket name is not exclusive reach: OpenRouter serves several too.
 * Keeping the original roster spelling preserves one identity across providers.
 *
 * @example
 * ```ts
 * const everyone = HYPER_ONLY_ROSTER_IDS;
 * ```
 */
export const HYPER_ONLY_ROSTER_IDS = [
  // qwen3.8-max WAS CULLED 2026-08-28 at owner's instruction because its
  // metered cost was disproportionate and exceptionally expensive.
  'minimax-m3',
  'gemma-4-26b-a4b-it',
  'deepseek-v4-pro-0813',
  'deepseek-v4-flash-0731',
  // glm-5.3 JOINED 2026-09-01 as a post-blocklist candidate from the live
  // catalog and passed the forced-tool probe. The refresh's other two
  // Hyper-only candidates, qwen3.8-flash and qwen3.8-2.4t-a95b, were culled
  // the same day before seating: both reject forced tool choice with HTTP
  // 400 (automatic-only, the culled qwen3.8-max's constraint), which the
  // hyper-catalog entry comment records with the probe.
  'glm-5.3',
  // Owner-approved on Hyper and OpenRouter 2026-09-11. One new identity,
  // not an alias for V4 Flash 0731; role admission requires fresh calibration.
  'deepseek-v4.1-flash',
] as const;

/**
 * Union of Hyper-origin roster identities, derived from
 * {@link HYPER_ONLY_ROSTER_IDS} so a new one is added in exactly one place.
 *
 * DERIVED FROM THE RUNTIME LIST rather than declared beside it, matching
 * `CHAT_ROLES` in `@monochromatic-dev/module-llm-type`. A separately declared
 * union and list drift, and the drift shows up as a roster that types correctly
 * and seats the wrong models.
 *
 * @example
 * ```ts
 * const modelId: HyperOnlyRosterId = 'minimax-m3';
 * ```
 */
export type HyperOnlyRosterId = typeof HYPER_ONLY_ROSTER_IDS[number];

/**
 * Roster models only Amazon Bedrock serves, spelled as that provider spells
 * them for the reason the Hyper-only list gives: no other spelling exists.
 * THE TWO GEMMA 4 SIZES THE OWNER APPROVED ON 2026-09-07 that no other
 * provider serves; the third size and gpt-oss-120b are reached under seats
 * the roster already names. Listed here is seatable, not seated: which roles
 * they take is decided on evidence, as the roster calibration record has it.
 *
 * @example
 * ```ts
 * const everyone = BEDROCK_ONLY_ROSTER_IDS;
 * ```
 */
export const BEDROCK_ONLY_ROSTER_IDS = [
  'google.gemma-4-e2b',
  'google.gemma-4-31b',
] as const;

/**
 * Union of the models only Amazon Bedrock serves, derived from
 * {@link BEDROCK_ONLY_ROSTER_IDS} for the reason the Hyper-only union gives.
 *
 * @example
 * ```ts
 * const modelId: BedrockOnlyRosterId = 'google.gemma-4-31b';
 * ```
 */
export type BedrockOnlyRosterId = typeof BEDROCK_ONLY_ROSTER_IDS[number];

/**
 * Roster models only OpenRouter serves, spelled as that provider spells them
 * for the reason the Hyper-only list gives: no other spelling exists.
 * MERCURY 2.5, WHICH THE OWNER APPROVED ON 2026-09-09 ("Mercury 2.5 is out
 * and approved") in the same breath as the final OpenRouter top-up: the
 * cheapest seat on the per-token provider, 0.04 and 0.15 USD per million
 * against the anchor judge's 0.58 and 1.74. Listed here is seatable, not
 * seated: which roles it takes is decided on the judge fidelity probe and the
 * producer calibration, as the roster calibration record has it.
 *
 * @example
 * ```ts
 * const everyone = OPENROUTER_ONLY_ROSTER_IDS;
 * ```
 */
export const OPENROUTER_ONLY_ROSTER_IDS = [
  'inception/mercury-2.5',
] as const;

/**
 * Union of the models only OpenRouter serves, derived from
 * {@link OPENROUTER_ONLY_ROSTER_IDS} for the reason the Hyper-only union gives.
 *
 * @example
 * ```ts
 * const modelId: OpenRouterOnlyRosterId = 'inception/mercury-2.5';
 * ```
 */
export type OpenRouterOnlyRosterId = typeof OPENROUTER_ONLY_ROSTER_IDS[number];

/**
 * Every model this pipeline may seat, whoever serves it.
 *
 * @example
 * ```ts
 * const modelId: RosterModelId = 'hf:moonshotai/Kimi-K3';
 * ```
 */
export type RosterModelId =
  | SyntheticServedId
  | HyperOnlyRosterId
  | BedrockOnlyRosterId
  | OpenRouterOnlyRosterId;

//endregion Roster identity
