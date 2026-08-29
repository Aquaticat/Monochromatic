//region Roster identity
// WHO IS ON THE ROSTER, named once, independently of who serves them.
//
// This file imports nothing on purpose. Both catalogs need these names and each
// other's would be a cycle, so the identity lives on its own and the catalogs
// describe it from their own side.
//
// THE ROSTER IS NINE DISTINCT MODELS across two providers: five Synthetic serves,
// four only Charm Hyper serves, and three of the Synthetic five are served by
// both. A model is one roster entry however many providers can reach it, which
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
 * @example
 * ```ts
 * const modelId: SyntheticServedId = 'hf:zai-org/GLM-5.3-Flash';
 * ```
 */
export type SyntheticServedId =
  | 'hf:zai-org/GLM-5.3-Flash'
  | 'hf:Qwen/Qwen3.8-27B'
  | 'hf:moonshotai/Kimi-K3'
  | 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4'
  | 'hf:openai/gpt-oss-120b';

/**
 * Roster models only Charm Hyper serves.
 *
 * SPELLED AS THAT PROVIDER SPELLS THEM, because there is no other spelling to
 * choose: no Synthetic id exists for any of these, so the wire name and the
 * roster name are the same string and no translation is possible to get wrong.
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
] as const;

/**
 * Union of the models only Charm Hyper serves, derived from
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
 * Every model this pipeline may seat, whoever serves it.
 *
 * @example
 * ```ts
 * const modelId: RosterModelId = 'hf:moonshotai/Kimi-K3';
 * ```
 */
export type RosterModelId = SyntheticServedId | HyperOnlyRosterId;

//endregion Roster identity
