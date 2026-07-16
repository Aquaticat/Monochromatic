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
  | 'minimax'
  | 'nvidia'
  | 'openai';

/**
 * Every always-on Synthetic chat model this pipeline may call.
 *
 * @example
 * ```ts
 * const modelId: SyntheticModelId = 'hf:zai-org/GLM-5.2';
 * ```
 */
export type SyntheticModelId =
  | 'hf:zai-org/GLM-5.2'
  | 'hf:zai-org/GLM-4.7-Flash'
  | 'hf:Qwen/Qwen3.6-27B'
  | 'hf:moonshotai/Kimi-K2.7-Code'
  | 'hf:MiniMaxAI/MiniMax-M3'
  | 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4'
  | 'hf:openai/gpt-oss-120b';

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
  readonly id: SyntheticModelId;

  /**
   * Vendor family for cross-family fan-out and rerouting.
   */
  readonly family: SyntheticVendorFamily;

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
 * const flash = SYNTHETIC_MODELS['hf:zai-org/GLM-4.7-Flash'];
 * ```
 */
export const SYNTHETIC_MODELS: Readonly<Record<SyntheticModelId, SyntheticModelInfo>> = {
  'hf:zai-org/GLM-5.2': {
    id: 'hf:zai-org/GLM-5.2',
    family: 'zai',
    contextLength: 524_288,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.0000014,
    completionDollarsPerToken: 0.0000044,
  },
  'hf:zai-org/GLM-4.7-Flash': {
    id: 'hf:zai-org/GLM-4.7-Flash',
    family: 'zai',
    contextLength: 196_608,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.0000001,
    completionDollarsPerToken: 0.0000005,
  },
  'hf:Qwen/Qwen3.6-27B': {
    id: 'hf:Qwen/Qwen3.6-27B',
    family: 'qwen',
    contextLength: 262_144,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.00000045,
    completionDollarsPerToken: 0.0000036,
  },
  'hf:moonshotai/Kimi-K2.7-Code': {
    id: 'hf:moonshotai/Kimi-K2.7-Code',
    family: 'moonshot',
    contextLength: 262_144,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.00000095,
    completionDollarsPerToken: 0.000004,
  },
  'hf:MiniMaxAI/MiniMax-M3': {
    id: 'hf:MiniMaxAI/MiniMax-M3',
    family: 'minimax',
    contextLength: 262_144,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.0000006,
    completionDollarsPerToken: 0.0000012,
  },
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': {
    id: 'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
    family: 'nvidia',
    contextLength: 262_144,
    maxOutputLength: 65_536,
    promptDollarsPerToken: 0.0000003,
    completionDollarsPerToken: 0.000001,
  },
  'hf:openai/gpt-oss-120b': {
    id: 'hf:openai/gpt-oss-120b',
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
export const SYNTHETIC_BASELINE_MODEL_ID: SyntheticModelId = 'hf:zai-org/GLM-5.2';

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
 * estimateRequestWeight({ modelId: 'hf:zai-org/GLM-4.7-Flash', },);
 * ```
 */
export function estimateRequestWeight(
  { modelId, }: { readonly modelId: SyntheticModelId; },
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
