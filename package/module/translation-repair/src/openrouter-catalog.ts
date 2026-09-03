import type { RosterModelId, } from './roster-id.ts';

//region OpenRouter catalog
// What OpenRouter serves for this pipeline, and how it spells it.
//
// WHY THIS PROVIDER EXISTS IN THE PIPELINE. The owner, 2026-09-03: Charm Hyper
// ended its bundle subsidization and will not be recharged, Synthetic and
// Hyper are expected to run dry often, and OpenRouter is where the owner would
// rather pay per token. It is the third and last provider in `PROVIDER_ORDER`
// (`doc/decision/translation-repair-openrouter-fallback.md`).
//
// IT SERVES NO MODEL THE ROSTER DOES NOT ALREADY NAME. Every row here is a
// third spelling of a seat Synthetic or Hyper already reaches, so `sharedWith`
// is never absent and the roster identity in `roster-id.ts` is unchanged.
// Provider is not part of panelist identity; a slice judged by
// `moonshotai/kimi-k3` counts once, as `hf:moonshotai/Kimi-K3`.
//
// THE OWNER'S ALLOWLIST ON THE ACCOUNT carries all nine as of 2026-09-03; a
// row here that the account no longer allows answers a refusal at the wire,
// which is the loud failure this catalog prefers over a silent substitution.
//
// FIELDS WERE READ OFF THE PUBLIC MODELS LISTING on 2026-09-03
// (`GET https://openrouter.ai/api/v1/models`, snapshot at
// `~/temp/agent/openrouter-models-20260903.json`): `architecture.input_modalities`
// for pictures and `top_provider.max_completion_tokens` for the ceiling. Under
// zero data retention and `require_parameters` the endpoint actually chosen may
// cap lower; the ceiling is recorded as the listing's, and the client sends no
// `max_tokens` unless a caller sets one, exactly as the Synthetic client does.

/**
 * OpenAI-compatible chat completions endpoint, measured live on 2026-09-03.
 *
 * CHAT COMPLETIONS RATHER THAN THE MESSAGES OR RESPONSES ENDPOINTS, by the
 * probe recorded in `doc/planning/translation-repair-openrouter-2026-09-03.md`:
 * it conformed on every attempt and answered fastest on every roster model,
 * where the Messages endpoint answered Kimi-K3 eight times slower and
 * conformed on 9 of 20 DeepSeek Flash attempts.
 */
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Endpoint reporting credits purchased and used, measured live on 2026-09-03.
 *
 * ITS OWN PAGE SAYS A MANAGEMENT KEY IS REQUIRED; the ordinary inference key
 * answered `200` with `{"data":{"total_credits":1913,"total_usage":1855.38}}`.
 * The meter is built on the live behaviour; should the page become true, the
 * meter reads as unreadable and the budget layer counts the provider as
 * spendable, which is that layer's standing rule.
 */
export const OPENROUTER_CREDITS_URL = 'https://openrouter.ai/api/v1/credits';

/**
 * Header carrying the key, a bearer token as on both other providers.
 */
export const OPENROUTER_AUTH_HEADER = 'Authorization';

/**
 * Routing preferences every request carries in its `provider` field.
 *
 * `zdr: true` IS THE OWNER'S DECISION of 2026-09-03: only endpoints with a
 * zero-data-retention policy may serve a corpus passage, matching the stance
 * taken on Charm Hyper. Every roster model kept at least seven such endpoints
 * on the day of measurement.
 *
 * `require_parameters: true` keeps a request off any endpoint that does not
 * support every parameter it carries, which for a schema'd call means
 * `response_format`; an endpoint that ignored it would answer prose to a
 * schema and cost a lost voice.
 *
 * `ignore` names endpoints the probe measured as serving a model badly; empty
 * as of 2026-09-03, when every roster model conformed on every chat
 * completions attempt.
 *
 * @example
 * ```ts
 * const body = { model, messages, provider: OPENROUTER_PROVIDER_PREFERENCES, };
 * ```
 */
export const OPENROUTER_PROVIDER_PREFERENCES = {
  zdr: true,
  require_parameters: true,
  ignore: [] as readonly string[],
} as const;

/**
 * Models this provider serves for this pipeline, under its own spellings.
 *
 * A CLOSED UNION so a typo cannot reach the wire, and so widening the roster
 * here is a deliberate edit rather than a string that happens to resolve.
 *
 * @example
 * ```ts
 * const modelId: OpenRouterServedId = 'moonshotai/kimi-k3';
 * ```
 */
export type OpenRouterServedId =
  | 'moonshotai/kimi-k3'
  | 'minimax/minimax-m3'
  | 'deepseek/deepseek-v4-flash-0731'
  | 'deepseek/deepseek-v4-pro-0813'
  | 'qwen/qwen3.8-27b'
  | 'z-ai/glm-5.3'
  | 'z-ai/glm-5.3-flash'
  | 'google/gemma-4-26b-a4b-it'
  | 'openai/gpt-oss-120b';

/**
 * Verified per-model facts the router and the request builder read.
 *
 * @example
 * ```ts
 * const info: OpenRouterModelInfo = OPENROUTER_MODELS['moonshotai/kimi-k3'];
 * ```
 */
export type OpenRouterModelInfo = {
  /**
   * Identifier sent in the request body's `model` field.
   */
  readonly id: OpenRouterServedId;

  /**
   * The roster seat this spelling reaches, never absent here.
   */
  readonly sharedWith: RosterModelId;

  /**
   * Whether the listing reports image input for this model.
   */
  readonly readsImages: boolean;

  /**
   * Ceiling the listing's top provider reports for completion tokens.
   */
  readonly maxOutputLength: number;
};

/**
 * Every model this provider serves for this pipeline.
 *
 * CONFORMANCE MEASURED OVER 20 CHAT COMPLETIONS ATTEMPTS EACH on 2026-09-03
 * with `response_format` json_schema, the schema restated in the system
 * prompt, zero data retention and `require_parameters`; the per-model rates
 * and the endpoints that served them are in the planning record.
 *
 * @example
 * ```ts
 * const info = OPENROUTER_MODELS['qwen/qwen3.8-27b'];
 * ```
 */
export const OPENROUTER_MODELS: Readonly<Record<OpenRouterServedId, OpenRouterModelInfo>> = {
  'moonshotai/kimi-k3': {
    id: 'moonshotai/kimi-k3',
    sharedWith: 'hf:moonshotai/Kimi-K3',
    readsImages: true,
    maxOutputLength: 943_718,
  },
  'minimax/minimax-m3': {
    id: 'minimax/minimax-m3',
    sharedWith: 'minimax-m3',
    readsImages: true,
    maxOutputLength: 512_000,
  },
  'deepseek/deepseek-v4-flash-0731': {
    id: 'deepseek/deepseek-v4-flash-0731',
    sharedWith: 'deepseek-v4-flash-0731',
    readsImages: false,
    maxOutputLength: 943_718,
  },
  'deepseek/deepseek-v4-pro-0813': {
    id: 'deepseek/deepseek-v4-pro-0813',
    sharedWith: 'deepseek-v4-pro-0813',
    readsImages: false,
    maxOutputLength: 384_000,
  },
  'qwen/qwen3.8-27b': {
    id: 'qwen/qwen3.8-27b',
    sharedWith: 'hf:Qwen/Qwen3.8-27B',
    readsImages: true,
    maxOutputLength: 131_072,
  },
  'z-ai/glm-5.3': {
    id: 'z-ai/glm-5.3',
    sharedWith: 'glm-5.3',
    readsImages: false,
    maxOutputLength: 262_144,
  },
  'z-ai/glm-5.3-flash': {
    id: 'z-ai/glm-5.3-flash',
    sharedWith: 'hf:zai-org/GLM-5.3-Flash',
    readsImages: true,
    maxOutputLength: 131_072,
  },
  // READS PICTURES HERE AND NOT ON CHARM HYPER, the same weights on a
  // different serving stack, which is the case `roster-reach.ts` answers
  // per provider rather than per model.
  'google/gemma-4-26b-a4b-it': {
    id: 'google/gemma-4-26b-a4b-it',
    sharedWith: 'gemma-4-26b-a4b-it',
    readsImages: true,
    maxOutputLength: 16_384,
  },
  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b',
    sharedWith: 'hf:openai/gpt-oss-120b',
    readsImages: false,
    maxOutputLength: 117_964,
  },
};

/**
 * Whether OpenRouter's catalog carries a label under that exact spelling.
 *
 * A LABEL, NOT A ROSTER ID, mirroring `hyperServesLabel`: the roster never
 * names a model the OpenRouter way, so this answers only whether a spelling
 * read off a log or a flag is one of this provider's rows.
 *
 * @param label - spelling being looked up
 *
 * @returns Whether `OPENROUTER_MODELS` has a row under it
 *
 * @example
 * ```ts
 * const served = openRouterServesLabel('moonshotai/kimi-k3',);
 * ```
 */
export function openRouterServesLabel(label: string,): label is OpenRouterServedId {
  return Object.hasOwn(
    OPENROUTER_MODELS,
    label,
  );
}

//endregion OpenRouter catalog
