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
 * Routing preferences every request carries in its `provider` field, before
 * the per-model `ignore` list is added by `openRouterProviderPreferencesFor`.
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
 * @example
 * ```ts
 * const body = { model, messages, provider: openRouterProviderPreferencesFor({ servedId, },), };
 * ```
 */
export const OPENROUTER_PROVIDER_PREFERENCES = {
  zdr: true,
  require_parameters: true,
} as const;

/**
 * The `provider` field as it goes on the wire for one model: the shared
 * preferences plus that model's ignored endpoints.
 *
 * @example
 * ```ts
 * const preferences: OpenRouterProviderPreferences = openRouterProviderPreferencesFor({ servedId, },);
 * ```
 */
export type OpenRouterProviderPreferences = typeof OPENROUTER_PROVIDER_PREFERENCES & {
  /**
   * Provider slugs OpenRouter must not route this model to.
   */
  readonly ignore: readonly string[];
};

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

  /**
   * Provider slugs measured as serving this model badly, sent as
   * `provider.ignore`; the owner warned on 2026-09-03 that "some providers
   * might serve some models in a horribly broken way", and this is where a
   * measured one is kept off the wire. Slugs are what `GET /api/v1/providers`
   * lists, NOT the display name lower-cased: `OpenInference` is
   * `open-inference`, and the day it was spelled without the hyphen the
   * ignore silently did nothing (2026-09-04, 43 streams served). The catalog
   * test checks every slug here against a snapshot of that listing.
   */
  readonly ignoredEndpoints: readonly string[];
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
    ignoredEndpoints: [],
  },
  // PARASAIL PUTS THE WHOLE JSON ANSWER IN THE REASONING CHANNEL and closes
  // the content channel empty with `finish_reason=stop`, measured on
  // 2026-09-03 with a corpus-sized json_schema request under zero data
  // retention (`~/temp/agent/openrouter-minimax-endpoints-20260903`): 0 of 2
  // conformant there against 4 of 4 on ModelRun, and on the first
  // all-OpenRouter keyword233 pass 16 of 31 MiniMax calls came back empty.
  //
  // MODELRUN TIMES OUT ONE CALL IN FIVE, OR WORSE. On 2026-09-04 it served
  // 300 MiniMax streams across six runs and 119 came back as one 846-character
  // chunk carrying `error.code=504`, `error_type=timeout`, no content and no
  // `[DONE]`, each after about 10.5 s (`openrouter-stream-error.ts` names
  // those failures now); the listing read `uptime_last_30m` 54.9 and `status`
  // -5 for it at 05:00 UTC, at 2.5 times the price of the next endpoint.
  //
  // COREWEAVE TAKES ITS PLACE, MEASURED. The first probe of the day answered
  // 404 "All providers have been ignored" for CoreWeave; the owner had never
  // ignored it, re-saved the account's allowed providers, and the re-probe
  // (`~/temp/agent/openrouter-minimax-endpoints-20260904b.log`) read 4 of 4
  // conformant on the corpus-sized schema request under zero data retention,
  // 16 to 20 s a call at a third of ModelRun's price, uptime 100. DeepInfra
  // and Venice answer 404 "No endpoints found that can handle the requested
  // parameters" to that request, so with Parasail and ModelRun ignored,
  // CoreWeave serves alone; default routing without `only` still went to
  // ModelRun 4 of 4 times, which is why the ignore is needed at all.
  'minimax/minimax-m3': {
    id: 'minimax/minimax-m3',
    sharedWith: 'minimax-m3',
    readsImages: true,
    maxOutputLength: 512_000,
    ignoredEndpoints: [
      'parasail',
      'modelrun',
    ],
  },
  // OPENINFERENCE LOSES THE VOICE TO THE STRAGGLER GRACE. Every cut this
  // model took on the second all-OpenRouter keyword233 pass of 2026-09-03
  // (`~/temp/agent/openrouter-live2-20260903.log`) was the 60 s grace after
  // quorum ending a stream still in its reasoning channel, and OpenInference
  // finished 2 of its 6 streams (mean 58.8 s finished, cut at 67 s to 117 s
  // with at most 1 content char over 6.7k to 14.9k reasoning chars) against
  // Parasail's 12 of 13 (mean 42.8 s) and Inceptron's 4 of 5 (mean 29.9 s).
  // The model reasons long on every endpoint; this one is the slowest at it.
  //
  // THAT IGNORE NEVER REACHED THE WIRE until 2026-09-04: it was spelled
  // `openinference`, and the gateway's slug (`GET /api/v1/providers`) is
  // `open-inference`, so OpenInference served 43 of the day's streams for this
  // model before the spelling was measured. Parasail and Reka join it on the
  // day's cut rates over every run (`~/temp/agent/*-20260904.log`): Parasail
  // 96 of 464 streams cut at the straggler grace, Reka 12 of 41, against
  // Makora 2 of 99 and Together 0 of 10. Rule applied here and below: an
  // endpoint is ignored when a day's runs cut a quarter or more of at least
  // twenty of its streams, or fail that share of them in-stream.
  'deepseek/deepseek-v4-flash-0731': {
    id: 'deepseek/deepseek-v4-flash-0731',
    sharedWith: 'deepseek-v4-flash-0731',
    readsImages: false,
    maxOutputLength: 943_718,
    ignoredEndpoints: [
      'open-inference',
      'parasail',
      'reka',
    ],
  },
  'deepseek/deepseek-v4-pro-0813': {
    id: 'deepseek/deepseek-v4-pro-0813',
    sharedWith: 'deepseek-v4-pro-0813',
    readsImages: false,
    maxOutputLength: 384_000,
    ignoredEndpoints: [],
  },
  // REKA AND IO NET CUT NEAR HALF OF THIS MODEL'S STREAMS on 2026-09-04: Reka
  // 19 of 40, Io Net 62 of 153, against Phala 9 of 137 and Ionstream 30 of
  // 173. The MTF_0615 pass that day lost 71 Qwen voices to those two alone.
  'qwen/qwen3.8-27b': {
    id: 'qwen/qwen3.8-27b',
    sharedWith: 'hf:Qwen/Qwen3.8-27B',
    readsImages: true,
    maxOutputLength: 131_072,
    ignoredEndpoints: [
      'reka',
      'io-net',
    ],
  },
  // REKA CUT HALF OF THIS MODEL'S STREAMS TOO on 2026-09-04, 13 of 26, against
  // Together 0 of 245. Modal's 21 of 144 and Inceptron's 3 of 3 sit under the
  // rule's share or its count and stay.
  'z-ai/glm-5.3': {
    id: 'z-ai/glm-5.3',
    sharedWith: 'glm-5.3',
    readsImages: false,
    maxOutputLength: 262_144,
    ignoredEndpoints: ['reka',],
  },
  'z-ai/glm-5.3-flash': {
    id: 'z-ai/glm-5.3-flash',
    sharedWith: 'hf:zai-org/GLM-5.3-Flash',
    readsImages: true,
    maxOutputLength: 131_072,
    ignoredEndpoints: [],
  },
  // THE LISTING REPORTS IMAGE INPUT HERE AND CHARM HYPER'S CATALOG DOES NOT,
  // the same weights on different serving stacks. NOT SEATED AS A READER on
  // that claim alone: a picture reader is a seat in `image-reading-stage.ts`,
  // the four current readers were each measured, and this one would be added
  // by a listing field nobody has probed with a picture. It stays false until
  // a measured transcription says otherwise, so the reader roster is unchanged
  // by this provider's arrival.
  'google/gemma-4-26b-a4b-it': {
    id: 'google/gemma-4-26b-a4b-it',
    sharedWith: 'gemma-4-26b-a4b-it',
    readsImages: false,
    maxOutputLength: 16_384,
    ignoredEndpoints: [],
  },
  'openai/gpt-oss-120b': {
    id: 'openai/gpt-oss-120b',
    sharedWith: 'hf:openai/gpt-oss-120b',
    readsImages: false,
    maxOutputLength: 117_964,
    ignoredEndpoints: [],
  },
};

/**
 * The `provider` field for one served model.
 *
 * COPIES THE IGNORE LIST rather than aliasing the catalog's array, so the body
 * builder can never hand the catalog's own row to `JSON.stringify` callers
 * that might be tempted to push onto it.
 *
 * @param servedId - OpenRouter slug the request will name
 *
 * @returns Shared preferences plus that model's ignored endpoints
 *
 * @example
 * ```ts
 * const provider = openRouterProviderPreferencesFor({ servedId: 'minimax/minimax-m3', },);
 * ```
 */
export function openRouterProviderPreferencesFor(
  { servedId, }: { readonly servedId: OpenRouterServedId; },
): OpenRouterProviderPreferences {
  /**
   * Catalog row for this slug.
   */
  const row = OPENROUTER_MODELS[servedId];
  return {
    ...OPENROUTER_PROVIDER_PREFERENCES,
    ignore: [...row.ignoredEndpoints,],
  };
}

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
