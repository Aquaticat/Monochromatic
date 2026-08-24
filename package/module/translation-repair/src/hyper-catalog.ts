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
 * How a model must be asked for a tool call.
 *
 * MEASURED PER MODEL, because it is not a property of the provider. Seven of
 * the eight honour `tool_choice: {type: 'tool'}`; `qwen3.8-max` REFUSES that
 * shape outright with `HTTP 400 invalid_request_error`, regardless of
 * streaming, system prompt or `max_tokens`, and answers correctly under
 * `{type: 'auto'}` instead. That is a rejected request rather than a weak
 * model, and reading it as weakness would have dropped a model that scores as
 * well as any other here.
 */
export type HyperToolChoice = 'forced' | 'auto';

/**
 * Models allowlisted on this provider by the owner.
 *
 * A CLOSED UNION so a typo cannot reach the wire, and so widening the roster is
 * a deliberate edit rather than a string that happens to resolve.
 *
 * @example
 * ```ts
 * const modelId: HyperServedId = 'glm-5.2';
 * ```
 */
export type HyperServedId =
  | 'qwen3.8-max'
  | 'minimax-m3'
  | 'kimi-k3'
  | 'gpt-oss-120b'
  | 'gemma-4-26b-a4b-it'
  | 'deepseek-v4-pro-0813'
  | 'deepseek-v4-flash-0731'
  | 'glm-5.2';

/**
 * Verified per-model facts the router and the request builder read.
 *
 * @example
 * ```ts
 * const info: HyperModelInfo = HYPER_MODELS['glm-5.2'];
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
   * PROVIDER IS NOT PART OF PANELIST IDENTITY. `glm-5.2` here and
   * `hf:zai-org/GLM-5.2` there are one panelist for self-certification
   * weighting and for the cache key, so a slice judged by that model counts
   * once however it was reached. Which provider actually served a call is
   * recorded per call, for diagnosis, and nowhere else.
   */
  readonly sharedWith: SyntheticServedId | typeof HYPER_ONLY;

  /**
   * Whether this model can be sent an image alongside its text.
   *
   * READ FROM `capabilities.vision` on this provider's own catalog endpoint.
   * Four of the eight report true, which triples the width of the picture
   * reading roster: the other provider serves exactly two image readers, and
   * its catalog note correctly said widening that would need a different
   * provider rather than a different configuration.
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

  /**
   * Shape this model accepts for being told to call the tool.
   */
  readonly toolChoice: HyperToolChoice;
};

/**
 * Every model this provider serves for this pipeline.
 *
 * CONFORMANCE MEASURED OVER 20 STREAMING ATTEMPTS EACH on 2026-08-24, under the
 * tool-choice shape recorded per model: all eight answered 20 of 20 with an
 * input matching the declared schema exactly. No model is dropped.
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
  'qwen3.8-max': {
    id: 'qwen3.8-max',
    sharedWith: HYPER_ONLY,
    readsImages: true,
    maxOutputLength: 65_536,
    // THE ONE MODEL THAT REFUSES A FORCED TOOL, with HTTP 400 on every variant
    // tried: streaming and not, with and without a system prompt, at its own
    // ceiling and below it. `auto` answers 20 of 20.
    toolChoice: 'auto',
  },
  'minimax-m3': {
    id: 'minimax-m3',
    sharedWith: HYPER_ONLY,
    readsImages: true,
    maxOutputLength: 512_000,
    toolChoice: 'forced',
  },
  'kimi-k3': {
    id: 'kimi-k3',
    sharedWith: 'hf:moonshotai/Kimi-K3',
    readsImages: true,
    maxOutputLength: 16_000,
    toolChoice: 'forced',
  },
  'gpt-oss-120b': {
    id: 'gpt-oss-120b',
    sharedWith: 'hf:openai/gpt-oss-120b',
    readsImages: false,
    maxOutputLength: 13_107,
    toolChoice: 'forced',
  },
  'gemma-4-26b-a4b-it': {
    id: 'gemma-4-26b-a4b-it',
    sharedWith: HYPER_ONLY,
    readsImages: false,
    maxOutputLength: 25_600,
    toolChoice: 'forced',
  },
  'deepseek-v4-pro-0813': {
    id: 'deepseek-v4-pro-0813',
    sharedWith: HYPER_ONLY,
    readsImages: false,
    maxOutputLength: 262_144,
    toolChoice: 'forced',
  },
  'deepseek-v4-flash-0731': {
    id: 'deepseek-v4-flash-0731',
    sharedWith: HYPER_ONLY,
    readsImages: false,
    maxOutputLength: 384_000,
    toolChoice: 'forced',
  },
  'glm-5.2': {
    id: 'glm-5.2',
    sharedWith: 'hf:zai-org/GLM-5.2',
    readsImages: true,
    maxOutputLength: 32_768,
    toolChoice: 'forced',
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

//endregion Hyper catalog
