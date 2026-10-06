//region OpenRouter barrel
// Public surface of OpenRouter, kept beside the provider barrel rather than
// inside it: that file sits at the line budget, and a provider's catalog,
// client, cost, stream-end checks, cached-token readings and abandoned-call
// reckoning are one unit to read.

export {
  type OpenRouterCredits,
  OpenRouterCreditsShapeError,
  parseOpenRouterCredits,
} from './openrouter-credits.ts';
export {
  COST_UNREPORTED,
  openRouterCostOf,
} from './openrouter-cost.ts';
export { openRouterChunksOf, } from './openrouter-chunk-scan.ts';
export {
  ENDPOINT_UNREPORTED,
  type EndpointReading,
  openRouterEndpointOf,
} from './openrouter-endpoint.ts';
export {
  InStreamProviderError,
  InStreamRefusalError,
  openRouterStreamErrorOf,
  requireNoStreamError,
  STREAM_ERROR_ABSENT,
  type StreamErrorReading,
} from './openrouter-stream-error.ts';
export {
  ERROR_FINISH_ABSENT,
  type ErrorFinishReading,
  openRouterErrorFinishOf,
} from './openrouter-error-finish.ts';
export {
  OPENROUTER_AUTH_HEADER,
  OPENROUTER_CHAT_URL,
  OPENROUTER_CREDITS_URL,
  OPENROUTER_DROPPED_SEATS,
  OPENROUTER_MODELS,
  OPENROUTER_WITHHELD,
  OPENROUTER_PROVIDER_PREFERENCES,
  type OpenRouterModelInfo,
  type OpenRouterProviderPreferences,
  type OpenRouterServedId,
  openRouterProviderPreferencesFor,
} from './openrouter-catalog.ts';
export {
  CACHED_UNREPORTED,
  openRouterCachedTokensOf,
} from './openrouter-cached-tokens.ts';
export {
  type AbandonedSpendEstimate,
  estimateAbandonedSpend,
  rawCharsPerCompletionTokenOf,
  reportAbandonedSpend,
} from './openrouter-abandoned-spend.ts';
export {
  createOpenRouterClient,
  OPENROUTER_PER_MODEL_CONCURRENCY,
  type OpenRouterClient,
  OpenRouterModelNotServedError,
  reportedSpendFieldsOf,
} from './openrouter-client.ts';

//endregion OpenRouter barrel
