import type {
  RosterModelId,
  SyntheticServedId,
} from './roster-id.ts';

//region Synthetic model catalog
// Facts verified live on 2026-07-16 against `GET /openai/v1/models` (prices, context
// lengths, feature flags) and https://synthetic.new/rate-limits (weighting rule:
// requests are scaled by model input price; the baseline is the provider default
// model, currently GLM-5.2, counting as exactly one request). Weights here are
// planning estimates for routing; live budget truth always comes from `/quotas`.

/**
 * OpenAI-compatible base URL for Synthetic chat completions,
 * verified from the API overview page.
 *
 * @example
 * ```ts
 * const url = `${SYNTHETIC_CHAT_BASE_URL}/chat/completions`;
 * ```
 */
export const SYNTHETIC_CHAT_BASE_URL = 'https://api.synthetic.new/openai/v1';

/**
 * Quota endpoint URL;
 * quota reads do not count against subscription limits (documented tip).
 *
 * @example
 * ```ts
 * const reply = await transport({ url: SYNTHETIC_QUOTAS_URL, method: 'GET', ... },);
 * ```
 */
export const SYNTHETIC_QUOTAS_URL = 'https://api.synthetic.new/v2/quotas';

/**
 * Vendor family of one model;
 * critic fan-out and refusal rerouting cross family lines so one vendor's shared
 * blind spots and refusal habits cannot dominate a panel.
 *
 * @example
 * ```ts
 * const family: SyntheticVendorFamily = 'moonshot';
 * ```
 */
export type SyntheticVendorFamily =
  | 'zai'
  | 'qwen'
  | 'moonshot'
  | 'nvidia'
  | 'openai';

/**
 * Re-exported so the hundred-odd callers that name a roster model keep one
 * import, while the identity itself lives in `roster-id.ts` where both catalogs
 * can see it without a cycle.
 */
export type {
  RosterModelId,
  SyntheticServedId,
} from './roster-id.ts';

/**
 * Every always-on Synthetic chat model this pipeline may call.
 *
 * These are the models the provider offers that this pipeline seats. The models
 * endpoint also lists `syn:large:text`, `syn:large:vision`, `syn:small:text`,
 * and `syn:small:vision`, and those are DELIBERATELY ABSENT here: each is an
 * alias onto a model already listed, which the endpoint states in its own
 * `hugging_face_id` field (`syn:large:text` is GLM-5.2, `syn:large:vision` is
 * Kimi-K3, `syn:small:text` is GLM-4.7-Flash, `syn:small:vision` is
 * Qwen/Qwen3-point-6-27B, spelled out here for the reason the replacement note
 * below gives).
 *
 * TWO REASONS, AND THE SECOND IS THE SERIOUS ONE.
 *
 * Admitting an alias would let one model occupy two seats on a voting panel,
 * so a single opinion would be counted as two independent confirmations and
 * the adjudication tally would silently overstate agreement. Any future roster
 * edit must dedupe on `hugging_face_id`, never on id.
 *
 * Worse, an alias is a promise the provider can move. This one is a very small
 * operation with no service level agreement, no guaranteed support window, and
 * partial support for the API surface it advertises. A repointed alias changes
 * WHICH MODEL VOTES with nothing in this repository changing, no build failing
 * and no log line saying so, which is the one class of roster change no guard
 * here can catch. Naming models outright makes a retirement an HTTP 404 we can
 * see rather than a substitution we cannot.
 *
 * One id was REPLACED 2026-08-20, `Qwen/Qwen3-point-6-27B` by
 * `hf:Qwen/Qwen3.8-27B`, on notice that the provider would retire the older one
 * shortly and offers no service level agreement, so a retirement lands without
 * warning. The two are identical on every field this catalog records and on
 * every capability flag the endpoint reports: context, output ceiling,
 * modalities, features, quantization, always-on and price. The alias
 * `syn:small:vision` still resolved to the OLDER id when this was written, so
 * that alias breaks or repoints when the retirement lands; nothing here calls
 * it, and the dedupe rule above is what keeps that from mattering.
 *
 * Two ids were REMOVED 2026-08-05, `moonshotai/Kimi-K2.7-Code` and
 * `MiniMaxAI/MiniMax-M3` (written without the `hf:` prefix here so a future
 * bulk id rewrite cannot silently edit this sentence, which is exactly what
 * happened once). Both now answer HTTP 404 "is no longer supported", and 404 is
 * not in the transient retry set, so leaving them listed cost a lost voice per
 * stage per call, silently.
 *
 * One id was REMOVED 2026-08-24, `zai-org/GLM-4.7-Flash` (again without the
 * prefix), blocklisted by the owner. `#136` had measured that it should stay,
 * and the owner overruled that on a roster that is now ten models rather than
 * six. It answers normally; nothing here calls it.
 */

/**
 * Verified per-model facts routing and budgeting read.
 *
 * @example
 * ```ts
 * const info: SyntheticModelInfo = SYNTHETIC_MODELS['hf:zai-org/GLM-5.2'];
 * ```
 */
export type SyntheticModelInfo = {
  /**
   * Model identifier sent in request bodies.
   */
  readonly id: SyntheticServedId;

  /**
   * Vendor family for cross-family fan-out and rerouting.
   */
  readonly family: SyntheticVendorFamily;

  /**
   * Whether this model can be sent an image alongside its text.
   *
   * READ FROM THE PROVIDER RATHER THAN ASSUMED. `GET
   * https://api.synthetic.new/openai/v1/models` reports `input_modalities` per
   * model, and the values here are that response as of 2026-08-16: two of the
   * six in the production roster read images, and the provider's only other
   * vision entries, `syn:large:vision` and `syn:small:vision`, are aliases of
   * those same two. The vision sub-roster is EXACTLY TWO, so widening it needs
   * a different provider rather than a different configuration.
   *
   * WHY IT IS A FIELD RATHER THAN A FETCH: the rest of this catalog is static,
   * a build that reached the network would fail closed on a provider outage,
   * and a wrong value here fails loudly at the first call rather than quietly.
   */
  readonly readsImages: boolean;

  /**
   * Context window in tokens.
   */
  readonly contextLength: number;

  /**
   * Maximum output tokens per completion.
   */
  readonly maxOutputLength: number;

  /**
   * Input price in dollars per token;
   * request weighting derives from ratios of this field.
   */
  readonly promptDollarsPerToken: number;

  /**
   * Output price in dollars per token;
   * feeds weekly-credit spend estimates.
   */
  readonly completionDollarsPerToken: number;
};

/**
 * Catalog of every model, keyed by id.
 * All entries support `json_mode` and `structured_outputs` per live feature flags,
 * so schema-constrained calls need no per-model capability branching;
 * client-side validation stays regardless because schema strictness is unverified.
 *
 * @example
 * ```ts
 * const flash = SYNTHETIC_MODELS['hf:openai/gpt-oss-120b'];
 * ```
 */
export const SYNTHETIC_MODELS: Readonly<Record<SyntheticServedId, SyntheticModelInfo>> = {
  'hf:zai-org/GLM-5.2': {
    id: 'hf:zai-org/GLM-5.2',
    readsImages: false,
    family: 'zai',
    contextLength: 524_288,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.000001,
    completionDollarsPerToken: 0.000003,
  },
  'hf:Qwen/Qwen3.8-27B': {
    id: 'hf:Qwen/Qwen3.8-27B',
    readsImages: true,
    family: 'qwen',
    contextLength: 262_144,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.00000045,
    completionDollarsPerToken: 0.0000022,
  },
  'hf:moonshotai/Kimi-K3': {
    id: 'hf:moonshotai/Kimi-K3',
    readsImages: true,
    family: 'moonshot',
    contextLength: 524_288,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.000003,
    completionDollarsPerToken: 0.000015,
  },
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': {
    id: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
    readsImages: false,
    family: 'nvidia',
    contextLength: 262_144,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.0000003,
    completionDollarsPerToken: 0.000001,
  },
  'hf:openai/gpt-oss-120b': {
    id: 'hf:openai/gpt-oss-120b',
    readsImages: false,
    family: 'openai',
    contextLength: 131_072,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.0000001,
    completionDollarsPerToken: 0.0000001,
  },
};

/**
 * Baseline model whose calls count as exactly one request against the five-hour
 * limit; the provider documents the baseline as its current default model.
 */
export const SYNTHETIC_BASELINE_MODEL_ID: SyntheticServedId = 'hf:zai-org/GLM-5.2';

/**
 * Whether Synthetic serves a roster model at all.
 *
 * THE CHECK THE WIRE NEVER MADE. Five roster seats are Charm Hyper endpoint
 * labels with no Synthetic spelling, and a client handed one of them used to
 * send it anyway and collect an HTTP 400 per call (`#235`). This is the one
 * question the catalog can answer before a request is built.
 *
 * @param modelId - roster model a caller wants to address
 *
 * @returns Whether `SYNTHETIC_MODELS` has a row for it
 *
 * @example
 * ```ts
 * if (!syntheticServes(modelId,)) throw new SyntheticModelNotServedError({ modelId, },);
 * ```
 */
export function syntheticServes(modelId: RosterModelId,): modelId is SyntheticServedId {
  return Object.hasOwn(
    SYNTHETIC_MODELS,
    modelId,
  );
}

/**
 * Estimates five-hour-limit weight of one request to one model,
 * as input-price ratio against the baseline
 * (rate-limit page: requests are scaled by model input price).
 * Planning estimate only; the provider's own accounting is authoritative and
 * observable through `/quotas`.
 *
 * @param modelId - model whose request weight routing needs
 *
 * @returns Estimated fraction of one baseline request
 *
 * @example
 * ```ts
 * estimateRequestWeight({ modelId: 'hf:openai/gpt-oss-120b', },);
 * ```
 */
export function estimateRequestWeight(
  { modelId, }: { readonly modelId: SyntheticServedId; },
): number {
  /**
   * Input price of the requested model.
   */
  const modelPrice = SYNTHETIC_MODELS[modelId]
    .promptDollarsPerToken;

  /**
   * Input price of the baseline model.
   */
  const baselinePrice = SYNTHETIC_MODELS[SYNTHETIC_BASELINE_MODEL_ID]
    .promptDollarsPerToken;

  return modelPrice / baselinePrice;
}

//endregion Synthetic model catalog
