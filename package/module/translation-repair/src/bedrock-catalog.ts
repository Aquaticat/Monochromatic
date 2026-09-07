import type { RosterModelId, } from './roster-id.ts';

//region Bedrock catalog
// What Amazon Bedrock serves for this pipeline, how it spells it, where it
// routes it and what it charges.
//
// WHY THIS PROVIDER EXISTS IN THE PIPELINE. The owner, 2026-09-07: "I have
// 200USD of credits in my Amazon Bedrock account. With ZDR enabled, only these
// models are usable (and approved): Claude Sonnet 5, Gemma 4 E2B, Gemma 4 31B,
// Gemma 4 26B-A4B, GPT OSS 120B"; then "The credits in my Amazon Bedrock
// account will expire early next year, so you're allowed to use it as much as
// you like. But I will NEVER top it up"; then "I retract Sonnet 5. Looks like
// Amazon didn't properly display it as not supporting ZDR." It is the fourth
// provider in `PROVIDER_ORDER`, ahead of OpenRouter, since its credits are
// prepaid and expiring where OpenRouter's are the owner's to top up.
//
// RAW FETCH, NO SDK. The owner, 2026-09-07: "Please do not introduce Amazon
// Bedrock SDK, Anthropic SDK, OpenAI SDK because these are poorly written. Use
// raw fetch." The client rides the same transport seam as the other three.
//
// TWO ROUTES ON ONE HOST, MEASURED 2026-09-07 with the bearer key in us-east-1
// (probes under `~/temp/agent`, recorded in
// `doc/planning/translation-repair-openrouter-2026-09-03.md`). The three Gemma
// 4 sizes answer only under `/openai/v1/chat/completions`; the default
// `/v1/chat/completions` says "model isn't supported on this route", and each
// model card says "On bedrock-mantle, this model is served at /openai/v1".
// gpt-oss-120b answers only under `/v1/chat/completions` and its card gives
// that base. Both stream, both report `usage` on the last chunk, and both
// honoured a json_schema `response_format`. The Gemma streams end on
// `data: [DONE]`; the gpt-oss stream ends on its usage chunk with no sentinel,
// so the terminator is a per-model fact here.
//
// CLAUDE SONNET 5 IS NOT SERVED, by measurement before the owner's retraction:
// mantle listed it but its chat, responses and messages routes refused it, and
// bedrock-runtime answered 403 "not available for this account".
//
// THE ACCOUNT IS IN DATA-RETENTION MODE `none`: every listed model reported
// `data_retention.mode: "none", source: "account"` on `/v1/models`, and a
// request carrying `store` answered "This account requires store=false for
// this model". Chat completions store nothing and the client sends no `store`.
//
// PRICES ARE THE PUBLIC PRICING PAGE'S, read 2026-09-07, US regions: Gemma 4
// E2B 0.04 in and 0.08 out per million tokens, Gemma 4 31B 0.14 and 0.40,
// Gemma 4 26B-A4B 0.13 and 0.40; gpt-oss-120b 0.1545 and 0.618 as the page
// listed for Sydney, the one region it showed. The ledger meters the owner's
// 200 USD off these, since the account exposes no balance endpoint to a
// bearer key.
//
// THE GEMMA 4 CARDS REPORT IMAGE INPUT AND THE CATALOG SAYS FALSE, for the
// reason the OpenRouter catalog gives for the same model: a transcription
// through this serving stack is unmeasured, and the picture-reader roster is
// the measured four until one is. gpt-oss-120b reads no pictures anywhere.
//
// NO PUBLISHED OUTPUT CEILING FOR GEMMA 4. The model cards give context
// windows (128K for E2B, 256K for the other two) and no maximum output; the
// context window stands in and the measured answer bound applies as it does
// everywhere else. gpt-oss-120b's card says 16K.

/**
 * Host every route hangs off: the mantle endpoint in the one region measured
 * to list all four models. us-west-2 listed the Gemma sizes and gpt-oss too;
 * the region is a constant rather than a knob until a second one is needed.
 */
export const BEDROCK_MANTLE_BASE_URL = 'https://bedrock-mantle.us-east-1.api.aws';

/**
 * Header carrying the key, a bearer token as on the other three providers.
 */
export const BEDROCK_AUTH_HEADER = 'Authorization';

/**
 * Which of the host's two OpenAI-compatible routes a model answers on.
 *
 * @example
 * ```ts
 * const route: BedrockRoute = 'openai-v1';
 * ```
 */
export type BedrockRoute = 'openai-v1' | 'v1';

/**
 * Path prefix of each route, before `/chat/completions`.
 */
export const BEDROCK_ROUTE_PREFIX: Readonly<Record<BedrockRoute, string>> = {
  'openai-v1': '/openai/v1',
  v1: '/v1',
};

/**
 * How a model's stream announces that it is whole.
 *
 * @example
 * ```ts
 * const end: BedrockStreamEnd = 'usage-chunk';
 * ```
 */
export type BedrockStreamEnd = 'done-sentinel' | 'usage-chunk';

/**
 * Models this provider serves for this pipeline, under its own spellings.
 * A CLOSED UNION so a typo cannot reach the wire, and so widening the roster
 * here is a deliberate edit rather than a string that happens to resolve.
 *
 * @example
 * ```ts
 * const modelId: BedrockServedId = 'google.gemma-4-31b';
 * ```
 */
export type BedrockServedId =
  | 'google.gemma-4-e2b'
  | 'google.gemma-4-31b'
  | 'google.gemma-4-26b-a4b'
  | 'openai.gpt-oss-120b';

/**
 * Verified per-model facts the router, the request builder and the ledger read.
 *
 * @example
 * ```ts
 * const info: BedrockModelInfo = BEDROCK_MODELS['google.gemma-4-e2b'];
 * ```
 */
export type BedrockModelInfo = {
  /**
   * Identifier sent in the request body's `model` field.
   */
  readonly id: BedrockServedId;

  /**
   * The roster seat this spelling reaches: another provider's spelling where
   * one serves the same model, and this provider's own spelling where none
   * does, since a Bedrock-only model has no other name to be known by.
   */
  readonly sharedWith: RosterModelId;

  /**
   * Whether a picture may be sent here: the card's image input, held false
   * until a transcription is measured, as the OpenRouter catalog holds it.
   */
  readonly readsImages: boolean;

  /**
   * Context window in tokens, as the model card states it.
   */
  readonly contextLength: number;

  /**
   * Ceiling the model card states for completion tokens, or the context
   * window where the card states none.
   */
  readonly maxOutputLength: number;

  /**
   * Route this model answers on, measured per model.
   */
  readonly route: BedrockRoute;

  /**
   * How this model's stream announces that it is whole, measured per model.
   */
  readonly streamEnd: BedrockStreamEnd;

  /**
   * USD per million prompt tokens, off the public pricing page.
   */
  readonly promptUsdPerMillion: number;

  /**
   * USD per million completion tokens, off the public pricing page.
   */
  readonly completionUsdPerMillion: number;
};

/**
 * Every model this provider serves for this pipeline.
 *
 * @example
 * ```ts
 * const info = BEDROCK_MODELS['openai.gpt-oss-120b'];
 * ```
 */
export const BEDROCK_MODELS: Readonly<Record<BedrockServedId, BedrockModelInfo>> = {
  'google.gemma-4-e2b': {
    id: 'google.gemma-4-e2b',
    sharedWith: 'google.gemma-4-e2b',
    readsImages: false,
    contextLength: 131_072,
    maxOutputLength: 131_072,
    route: 'openai-v1',
    streamEnd: 'done-sentinel',
    promptUsdPerMillion: 0.04,
    completionUsdPerMillion: 0.08,
  },
  'google.gemma-4-31b': {
    id: 'google.gemma-4-31b',
    sharedWith: 'google.gemma-4-31b',
    readsImages: false,
    contextLength: 262_144,
    maxOutputLength: 262_144,
    route: 'openai-v1',
    streamEnd: 'done-sentinel',
    promptUsdPerMillion: 0.14,
    completionUsdPerMillion: 0.4,
  },
  // THE SAME SEAT AS `gemma-4-26b-a4b-it` on Charm Hyper and
  // `google/gemma-4-26b-a4b-it` on OpenRouter: provider is not part of
  // panelist identity, so a slice this model judges here counts once.
  'google.gemma-4-26b-a4b': {
    id: 'google.gemma-4-26b-a4b',
    sharedWith: 'gemma-4-26b-a4b-it',
    readsImages: false,
    contextLength: 262_144,
    maxOutputLength: 262_144,
    route: 'openai-v1',
    streamEnd: 'done-sentinel',
    promptUsdPerMillion: 0.13,
    completionUsdPerMillion: 0.4,
  },
  // THE SAME SEAT AS `hf:openai/gpt-oss-120b` on Synthetic, `gpt-oss-120b` on
  // Charm Hyper and `openai/gpt-oss-120b` on OpenRouter.
  'openai.gpt-oss-120b': {
    id: 'openai.gpt-oss-120b',
    sharedWith: 'hf:openai/gpt-oss-120b',
    readsImages: false,
    contextLength: 131_072,
    maxOutputLength: 16_384,
    route: 'v1',
    streamEnd: 'usage-chunk',
    promptUsdPerMillion: 0.1545,
    completionUsdPerMillion: 0.618,
  },
};

/**
 * Chat completions URL one model answers on.
 *
 * @param baseUrl - host, overridable for tests
 *
 * @param servedId - model whose route decides the path
 *
 * @returns Absolute URL to POST the body to
 *
 * @example
 * ```ts
 * bedrockChatUrlFor({ baseUrl: BEDROCK_MANTLE_BASE_URL, servedId: 'google.gemma-4-e2b', },);
 * // => 'https://bedrock-mantle.us-east-1.api.aws/openai/v1/chat/completions'
 * ```
 */
export function bedrockChatUrlFor(
  {
    baseUrl,
    servedId,
  }: {
    readonly baseUrl: string;
    readonly servedId: BedrockServedId;
  },
): string {
  /**
   * Route this model answers on.
   */
  const { route, } = BEDROCK_MODELS[servedId];

  return `${baseUrl}${BEDROCK_ROUTE_PREFIX[route]}/chat/completions`;
}

/**
 * Whether a label is one of this provider's spellings.
 *
 * @param label - model label as a log line or a caller wrote it
 *
 * @returns Whether this catalog has a row for it
 *
 * @example
 * ```ts
 * if (bedrockServesLabel(label,)) price(label,);
 * ```
 */
export function bedrockServesLabel(label: string,): label is BedrockServedId {
  return Object
    .keys(BEDROCK_MODELS,)
    .includes(label,);
}

//endregion Bedrock catalog
