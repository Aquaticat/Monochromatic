//region Bedrock barrel
// Public surface of the fourth provider, kept beside the provider barrel
// rather than inside it: that file sits at the line budget, and a provider's
// catalog, client, cost, ledger and stream-end checks are one unit to read.

export {
  BEDROCK_AUTH_HEADER,
  BEDROCK_MANTLE_BASE_URL,
  BEDROCK_MODELS,
  BEDROCK_ROUTE_PREFIX,
  type BedrockModelInfo,
  type BedrockRoute,
  type BedrockServedId,
  type BedrockStreamEnd,
  bedrockChatUrlFor,
  bedrockServesLabel,
} from './bedrock-catalog.ts';
export {
  BEDROCK_PER_MODEL_CONCURRENCY,
  type BedrockClient,
  BedrockModelNotServedError,
  createBedrockClient,
} from './bedrock-client.ts';
export {
  BEDROCK_COST_UNREPORTED,
  bedrockCostOf,
} from './bedrock-cost.ts';
export {
  BEDROCK_CREDIT_USD,
  BEDROCK_CREDIT_USD_VAR,
  BEDROCK_LEDGER_PATH_VAR,
  type BedrockCredits,
  BedrockCreditOverrideError,
  type BedrockLedger,
  type BedrockLedgerEntry,
  BedrockLedgerShapeError,
  bedrockCreditUsdFrom,
  bedrockLedgerFromEnv,
  bedrockLedgerPathFrom,
  createBedrockLedger,
  defaultBedrockLedgerPath,
} from './bedrock-ledger.ts';
export {
  requireBedrockStreamEnd,
  withDoneSentinel,
} from './bedrock-stream-end.ts';

//endregion Bedrock barrel
