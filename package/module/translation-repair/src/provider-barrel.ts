//region Provider barrel
// The second provider, and the wire format it speaks.
//
// Split out of `index.ts` when that file reached its line budget, at the seam
// the other barrels use: by AUDIENCE. Everything here answers a question about
// WHICH PROVIDER SERVES A CALL and HOW that provider must be addressed, which
// nothing above the client seam asks. The pipeline's stages name a panelist and
// get an answer; only this layer knows there is more than one way to reach one.
//
// `#199` opened this. A corpus pass exhausted one provider's weekly credit, and
// 866 of 875 lost voices carried a single HTTP 429. A second provider is the
// only remedy that works against an exhausted budget.

export {
  errorName,
  failureName,
} from './error-name.ts';
export {
  type NamingError,
  namesWithoutQuoting,
  refusalText,
} from './refusal-text.ts';
export {
  renderSchemaForPrompt,
  SCHEMA_BLOCK_HEADING,
  withSchemaInSystemPrompt,
} from './schema-prompt.ts';
export { extractAnthropicCompletion, } from './anthropic-completion.ts';
export { readJsonOutcome, } from './chat-json-outcome.ts';
export { isSuccessStatus, } from './http-success.ts';
export {
  createRoutingClient,
  NoProviderForModelError,
} from './provider-router.ts';
export {
  countStates,
  type DrySpan,
  drySpans,
  dutyCycle,
  longestDrySpan,
  seriesFor,
  type StateCounts,
} from './corpus-run/meter-dry-span.ts';
export {
  type MeterLogReading,
  type MeterSample,
  readMeterLine,
  readMeterLog,
} from './corpus-run/meter-sample-read.ts';
export {
  type CreditRates,
  creditsFor,
  HYPER_PRICE_READ_ON,
  ratesFor,
} from './corpus-run/hyper-price.ts';
export {
  type PricedSeat,
  priceTally,
  type SpendCost,
} from './corpus-run/spend-cost.ts';
export {
  readSpendLine,
  type SeatSpend,
  type SpendCount,
  type SpendLineReading,
  type SpendRecord,
  type SpendTally,
  tallySpend,
} from './corpus-run/spend-read.ts';
export {
  type BudgetView,
  createProviderBudgets,
  type MeterLevel,
  type MeterRecord,
  meterRecordOf,
  type MeterState,
  type ProviderBudgets,
  type ProviderName,
  routesAsDry,
} from './provider-budget.ts';
export {
  DEFAULT_WIRE_FORMAT,
  scannerFor,
  type StreamWireFormat,
} from './stream-wire-format.ts';
export type {
  HyperOnlyRosterId,
  SyntheticServedId,
} from './roster-id.ts';
export { HYPER_ONLY_ROSTER_IDS, } from './roster-id.ts';
export {
  hyperIdFor,
  type HyperSpelling,
  readsImages,
  reachOf,
  ROSTER_MODEL_IDS,
  type SyntheticEntry,
  syntheticEntryFor,
  visionReachOf,
} from './roster-reach.ts';
export {
  BothProvidersDryError,
  hyperIsDry,
  hyperMeterLevel,
  type ModelReach,
  type ProviderChoice,
  routeProviderFor,
  syntheticIsDry,
  syntheticMeterLevel,
} from './budget-routing.ts';
export {
  CreditsShapeError,
  type HyperCredits,
  parseHyperCredits,
} from './hyper-credits.ts';
export {
  reportSpend,
  SPEND_MARKER,
} from './spend-line.ts';
export {
  type AnthropicContentBlock,
  type AnthropicImageSource,
  contentBlocksFor,
  MalformedImageUriError,
  readImageSource,
} from './anthropic-content.ts';
export {
  type AnthropicMessage,
  type AnthropicRequestBody,
  type AnthropicToolChoice,
  buildAnthropicBody,
  EmptyConversationError,
  speakingTurns,
  systemTextOf,
} from './anthropic-request.ts';
export {
  answerToolDefinition,
  answerToolName,
  type AnthropicToolDefinition,
  type ReadableResponseFormat,
  renderToolSystemPrompt,
  UnnameableToolError,
} from './anthropic-tool.ts';
export { scanAnthropicDeltas, } from './anthropic-delta-scan.ts';
export {
  answerCeilingFor,
  HYPER_API_VERSION,
  HYPER_AUTH_HEADER,
  HYPER_CREDITS_URL,
  HYPER_MESSAGES_URL,
  HYPER_MODELS,
  HYPER_ONLY,
  HYPER_ONLY_NAMES_ARE_SERVED,
  type HyperModelInfo,
  type HyperServedId,
  hyperServesLabel,
  modelsServedByBoth,
  modelsServedOnlyHere,
} from './hyper-catalog.ts';
export {
  createHyperClient,
  type HyperClient,
  ModelNotServedError,
} from './hyper-client.ts';

export { syntheticServes, } from './synthetic-catalog.ts';
export { SyntheticModelNotServedError, } from './synthetic-client.ts';
export {
  createSeatTally,
  RUN_SEATS,
  type SeatCount,
  type SeatOutcome,
  seatReportLines,
  type SeatTally,
  seatTallyClient,
} from './seat-tally.ts';

//endregion Provider barrel
