import type {
  HyperOnlyRosterId,
  SyntheticServedId,
} from './roster-id.ts';

//region Hyper catalog
// What Charm Hyper serves, and the two ways it differs from the other provider
// at the request layer.
//
// EVERY FIELD HERE WAS MEASURED against the live API on 2026-08-24 rather than
// read off a docs page, because two of them contradict what the catalog
// endpoint alone would suggest.
//
// WHY THIS PROVIDER EXISTS IN THE PIPELINE AT ALL. A corpus pass exhausted the
// other provider's weekly credit and 866 of 875 lost voices carried
// `HTTP 429: You've exceeded your subscription rate limits`. A second provider
// is the only remedy that works against an exhausted budget: retrying it never
// succeeds, and refusing to settle turns a budget problem into holes in the
// deliverable.
//
// SCHEMA'D OUTPUT ONLY WORKS OVER ANTHROPIC MESSAGES HERE. The OpenAI Chat
// Completions endpoint accepts `response_format` and ignores it: a deliberately
// invalid `{type: 'not_a_real_mode_xyz'}` returns 200, an unknown top-level
// field returns 200, and every mode answers with markdown-fenced JSON carrying
// invented keys. Nothing in this file supports that endpoint.

/**
 * Marker for a model this provider serves and the other one does not.
 *
 * A NAMED READING rather than a nullish union, matching how the rest of this
 * package models absence.
 */
export const HYPER_ONLY = 'hyper-only';

/**
 * Endpoint one call is POSTed to, measured live on 2026-08-24.
 *
 * THE MESSAGES API RATHER THAN CHAT COMPLETIONS, for the reason the module
 * note records: the OpenAI-shaped endpoint accepts `response_format` and
 * ignores it, so structured output has nowhere else to go.
 */
export const HYPER_MESSAGES_URL = 'https://hyper.charm.land/v1/messages';

/**
 * Endpoint reporting the remaining balance, measured live on 2026-08-24.
 */
export const HYPER_CREDITS_URL = 'https://hyper.charm.land/v1/credits';

/**
 * Value of the `anthropic-version` header every call carries.
 *
 * REQUIRED BY THE PROTOCOL rather than chosen: this is the dated contract the
 * request and response shapes belong to, and the frames this package parses
 * were captured under it.
 */
export const HYPER_API_VERSION = '2023-06-01';

/**
 * Header carrying the key, which is NOT the one the protocol usually uses.
 *
 * MEASURED, AND THE MEASUREMENT CONTRADICTS THE OBVIOUS GUESS. The Messages
 * API is normally keyed by `x-api-key`, and this gateway answers that header
 * with `401 missing authorization`. It takes a bearer token instead, so a
 * client written from the protocol docs alone would fail to authenticate every
 * call and read it as a bad key.
 */
export const HYPER_AUTH_HEADER = 'Authorization';

/**
 * Models allowlisted on this provider by the owner.
 *
 * A CLOSED UNION so a typo cannot reach the wire, and so widening the roster is
 * a deliberate edit rather than a string that happens to resolve.
 *
 * @example
 * ```ts
 * const modelId: HyperServedId = 'deepseek-v4-flash-0731';
 * ```
 */
export type HyperServedId =
  | 'qwen3.8-27b'
  | 'minimax-m3'
  | 'kimi-k3'
  | 'gpt-oss-120b'
  | 'gemma-4-26b-a4b-it'
  | 'deepseek-v4-pro-0813'
  | 'deepseek-v4-flash-0731'
  | 'glm-5.3-flash'
  | 'glm-5.3';

/**
 * Verified per-model facts the router and the request builder read.
 *
 * @example
 * ```ts
 * const info: HyperModelInfo = HYPER_MODELS['deepseek-v4-flash-0731'];
 * ```
 */
export type HyperModelInfo = {
  /**
   * Identifier sent in the request body's `model` field.
   */
  readonly id: HyperServedId;

  /**
   * Same model reached through the other provider, where there is one.
   *
   * PROVIDER IS NOT PART OF PANELIST IDENTITY. `kimi-k3` here and
   * `hf:moonshotai/Kimi-K3` there are one panelist for self-certification
   * weighting and for the cache key, so a slice judged by that model counts
   * once however it was reached. Which provider actually served a call is
   * recorded per call, for diagnosis, and nowhere else.
   */
  readonly sharedWith: SyntheticServedId | typeof HYPER_ONLY;

  /**
   * Whether this model can be sent an image alongside its text.
   *
   * READ FROM `capabilities.vision` on this provider's own catalog endpoint.
   * Three of the seven report true. The other provider now serves three image
   * readers after GLM-5.3-Flash replaced GLM-5.2.
   */
  readonly readsImages: boolean;

  /**
   * Ceiling this model will emit, from `max_output_tokens` on the catalog.
   *
   * TWO OF THESE SIT BELOW the 32000 answer bound `#156` measured, so the bound
   * has to be read per model rather than globally: `gpt-oss-120b` stops at
   * 13107 and `kimi-k3` at 16000. A request that asks for more than a model can
   * emit buys a truncation and reports it as a schema mismatch, which sends a
   * reader to the prompt instead of to the ceiling.
   */
  readonly maxOutputLength: number;
};

/**
 * Every model this provider serves for this pipeline.
 *
 * CONFORMANCE MEASURED OVER 20 STREAMING ATTEMPTS EACH on 2026-08-24. Current
 * models accept forced tool choice and answered with schema-conformant input.
 * `qwen3.8-max`, only model requiring automatic choice, was culled 2026-08-28
 * because its metered cost was disproportionate and exceptionally expensive.
 * `glm-5.2` left the active allowlist 2026-08-29 when its roster identity was
 * replaced by Synthetic's GLM-5.3-Flash. This provider's live catalog still
 * listed `glm-5.2` but no GLM-5.3-Flash spelling that day. It also reported
 * `glm-5.2` vision false, changed from the vision-true reading on 2026-08-24.
 *
 * An earlier reading that `kimi-k3` honoured a forced tool on 1 of 3 attempts
 * was wrong and is retracted here; it measures 20 of 20.
 *
 * @example
 * ```ts
 * const info = HYPER_MODELS['deepseek-v4-flash-0731'];
 * ```
 */
export const HYPER_MODELS: Readonly<Record<HyperServedId, HyperModelInfo>> = {
  'qwen3.8-27b': {
    id: 'qwen3.8-27b',
    // THE SAME SEAT AS `hf:Qwen/Qwen3.8-27B`, added 2026-08-26 when the owner
    // reported it served here: that seat is one of the two the straggler window
    // keeps cutting, and this provider has no per-model slot to saturate, so
    // the router's overflow now has somewhere to send it. Fields from the
    // catalog endpoint the same day (`max_output_tokens` 128000,
    // `capabilities.vision` true); forced tool choice was checked live by probe
    // recorded in handover before first run that could route here.
    sharedWith: 'hf:Qwen/Qwen3.8-27B',
    readsImages: true,
    maxOutputLength: 128_000,
  },
  'minimax-m3': {
    id: 'minimax-m3',
    sharedWith: HYPER_ONLY,
    readsImages: true,
    maxOutputLength: 512_000,
  },
  'kimi-k3': {
    id: 'kimi-k3',
    sharedWith: 'hf:moonshotai/Kimi-K3',
    readsImages: true,
    maxOutputLength: 16_000,
  },
  'gpt-oss-120b': {
    id: 'gpt-oss-120b',
    sharedWith: 'hf:openai/gpt-oss-120b',
    readsImages: false,
    maxOutputLength: 13_107,
  },
  'gemma-4-26b-a4b-it': {
    id: 'gemma-4-26b-a4b-it',
    sharedWith: HYPER_ONLY,
    readsImages: false,
    maxOutputLength: 25_600,
  },
  'deepseek-v4-pro-0813': {
    id: 'deepseek-v4-pro-0813',
    sharedWith: HYPER_ONLY,
    readsImages: false,
    maxOutputLength: 262_144,
  },
  'deepseek-v4-flash-0731': {
    id: 'deepseek-v4-flash-0731',
    sharedWith: HYPER_ONLY,
    readsImages: false,
    maxOutputLength: 384_000,
  },
  // THE TWO ENTRIES BELOW JOINED 2026-09-01 from the live catalog read for
  // the owner's post-blocklist candidate refresh
  // (doc/decision/translation-repair-roster-blocklist.md). Fields are from
  // the catalog endpoint that day, and both passed the live forced-tool
  // probe before any run could route to them. The refresh's other two
  // candidates, qwen3.8-flash and qwen3.8-2.4t-a95b, were probed the same
  // day and CULLED before seating: each answers plain text and tools under
  // automatic choice with HTTP 200 but rejects `tool_choice: {type: 'tool'}`
  // with HTTP 400 invalid_request_error, the same automatic-only constraint
  // recorded for the culled qwen3.8-max, and every structured stage here
  // forces its tool.
  'glm-5.3-flash': {
    id: 'glm-5.3-flash',
    // THE SAME SEAT AS Synthetic's GLM-5.3-Flash, giving that seat a second
    // provider the way qwen3.8-27b's entry did for its Synthetic twin.
    sharedWith: 'hf:zai-org/GLM-5.3-Flash',
    readsImages: true,
    maxOutputLength: 131_072,
  },
  'glm-5.3': {
    id: 'glm-5.3',
    sharedWith: HYPER_ONLY,
    readsImages: false,
    maxOutputLength: 262_144,
  },
};

/**
 * Bound `#156` measured for answer volume, in tokens.
 *
 * KEPT HERE BESIDE THE PER-MODEL CEILINGS it has to be reconciled against,
 * rather than imported from the guard that enforces it, so a reader comparing
 * the two numbers sees both at once.
 */
const MEASURED_ANSWER_BOUND = 32_000;

/**
 * How many tokens to ask one model for, honouring both bounds.
 *
 * ONE-SIDED ON PURPOSE: this only ever lowers the ask. A model that can emit
 * more than `#156` measured is still held to the measured bound, because that
 * bound is about what an answer should be rather than what a model can do.
 *
 * @param modelId - model the request is for
 *
 * @returns Token ceiling to send, never above either bound
 *
 * @example
 * ```ts
 * const maxTokens = answerCeilingFor({ modelId: 'gpt-oss-120b', },);
 * ```
 */
export function answerCeilingFor(
  { modelId, }: { readonly modelId: HyperServedId; },
): number {
  /**
   * What this model says it can emit, before the measured bound is applied.
   */
  const { maxOutputLength, } = HYPER_MODELS[modelId];

  return Math.min(
    MEASURED_ANSWER_BOUND,
    maxOutputLength,
  );
}

/**
 * Models on this provider that stand in for one the other provider serves.
 *
 * @returns Their identifiers, in catalog order
 *
 * @example
 * ```ts
 * const shared = modelsServedByBoth();
 * ```
 */
export function modelsServedByBoth(): readonly HyperServedId[] {
  return Object
    .values(HYPER_MODELS,)
    .filter(function shared(info,): boolean {
      return info.sharedWith !== HYPER_ONLY;
    },)
    .map(function toId(info,): HyperServedId {
      return info.id;
    },);
}

/**
 * Models only this provider serves, which have no cross-provider re-ask.
 *
 * A NON-CONFORMANT ANSWER FROM ONE OF THESE cannot be re-asked elsewhere, so it
 * falls back to `#88`'s invalid-candidate path instead, which sends an unusable
 * slice back to its own author.
 *
 * @returns Their identifiers, in catalog order
 *
 * @example
 * ```ts
 * const alone = modelsServedOnlyHere();
 * ```
 */
export function modelsServedOnlyHere(): readonly HyperServedId[] {
  return Object
    .values(HYPER_MODELS,)
    .filter(function alone(info,): boolean {
      return info.sharedWith === HYPER_ONLY;
    },)
    .map(function toId(info,): HyperServedId {
      return info.id;
    },);
}

/**
 * Proof that every roster name for a Hyper-only model is an id this provider
 * serves.
 *
 * A TYPE, NOT A TEST, because the two lists live in different files for
 * cycle reasons and a drift between them would otherwise surface as a request
 * naming a model that does not exist. Assigning the narrower to the wider fails
 * to compile the moment a name is added to one and not the other.
 *
 * @internal
 */
export type HyperOnlyNamesAreServed = HyperOnlyRosterId extends HyperServedId ? true : never;

/**
 * The proof above, instantiated, so a roster label with no catalog row stops
 * the type check instead of surfacing at run time as one lost voice per call
 * (`#241`): when the conditional resolves to `never`, `true` is not assignable
 * and `lint:types` fails on this line, naming the drift.
 *
 * @example
 * ```ts
 * expect(HYPER_ONLY_NAMES_ARE_SERVED,).toBe(true,);
 * ```
 */
export const HYPER_ONLY_NAMES_ARE_SERVED: HyperOnlyNamesAreServed = true;

/**
 * Whether Charm Hyper's catalog carries a label under that exact spelling.
 *
 * A LABEL, NOT A ROSTER ID: the roster names shared models by their Synthetic
 * spelling and reaches Hyper for them through `hyperIdFor`, so this answers
 * only whether the given spelling is a Hyper row, which for the roster means
 * the Hyper-only labels. `syntheticServes` is the roster-typed counterpart.
 *
 * @param label - spelling being looked up
 *
 * @returns Whether `HYPER_MODELS` has a row under it
 *
 * @example
 * ```ts
 * const served = hyperServesLabel('minimax-m3',);
 * ```
 */
export function hyperServesLabel(label: string,): label is HyperServedId {
  return Object.hasOwn(
    HYPER_MODELS,
    label,
  );
}

//endregion Hyper catalog
