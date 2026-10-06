//region Provider barrel
// The second provider, and the wire format it speaks.
//
// Split out of `index.ts` when that file reached its line budget, at the seam
// the other barrels use: by AUDIENCE. Everything here answers a question about
// WHICH PROVIDER SERVES A CALL and HOW that provider must be addressed, which
// nothing above the client seam asks. The pipeline's stages name a panelist and
// get an answer; only this layer knows there is more than one way to reach one.
//
// WHY IT EXISTS. A corpus pass exhausted one provider's weekly credit, and
// 866 of 875 lost voices carried a single HTTP 429. A second provider is the
// only remedy that works against an exhausted budget.

export {
  errorName,
  failureName,
} from './error-name.ts';
export {
  CREDENTIAL_MARKER,
  credentialsOfHeaders,
  maskCredentials,
  maskCredentialsInCutText,
  MINIMUM_CREDENTIAL_UNITS,
} from './credential-mask.ts';
export { decodedFormsOf, } from './credential-decoded-forms.ts';
export { needlesOf, } from './credential-needles.ts';
export { findNeedles, } from './credential-search.ts';
export { decodedViewsOf, } from './credential-views.ts';
export {
  exchangeFailureLogText,
  exchangeFailureText,
} from './exchange-failure-text.ts';
export { TransportRequestFailedError, } from './transport-request-error.ts';
export {
  LocalProgramFailedError,
  localProgramFailureOf,
  readerFailureText,
} from './local-program-failure.ts';
export {
  isMissingPathError,
  rethrowUnlessMissingPath,
} from './missing-path-error.ts';
export { readTextOrEmptyIfMissing, } from './read-text-if-present.ts';
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
export { chatJsonThrough, } from './chat-json-through.ts';
export { perModelLimiter, } from './per-model-limiter.ts';
export { isSuccessStatus, } from './http-success.ts';
export {
  createRoutingClient,
  NoProviderForModelError,
  type ProviderCallers,
} from './provider-router.ts';
export { refusingCulledSeats, } from './culled-seat-guard.ts';
export {
  modelPromptDigest,
  promptUniqueClient,
} from './prompt-uniqueness-client.ts';
export {
  type PromptPayloadStore,
  PromptPayloadStoreError,
  promptPayloadStore,
} from './prompt-payload-store.ts';
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
export { levelLines, } from './corpus-run/meter-report-level.ts';
export { reportProvider, } from './corpus-run/meter-report-provider.ts';
export {
  mergeSamples,
  reportMeters,
} from './corpus-run/meter-report-run.ts';
export {
  outageLines,
  spanText,
  stampText,
} from './corpus-run/meter-report-text.ts';
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
  type SpendUsd,
  tallySpend,
} from './corpus-run/spend-read.ts';
export {
  asCredits,
  asUsd,
  pricedLine,
  tokensOnlyLine,
  usdLine,
} from './corpus-run/spend-report-line.ts';
export { printCost, } from './corpus-run/spend-report-print.ts';
export {
  linesOfLog,
  readLogTexts,
  refuseRepeatedLogs,
} from './corpus-run/report-log-read.ts';
export {
  asSpan,
  printInFlight,
  printRounds,
} from './corpus-run/run-timing-report-print.ts';
export { reportRunTiming, } from './corpus-run/run-timing-report-run.ts';
export { reportSpendCost, } from './corpus-run/spend-report-run.ts';
export {
  type BudgetView,
  createProviderBudgets,
  type ProviderBudgets,
} from './provider-budget.ts';
export {
  isProviderName,
  otherProviders,
  PROVIDER_ORDER,
  type ProviderName,
  type ProviderRecord,
  providerRecord,
} from './provider-name.ts';
export {
  createSlotLedger,
  type SlotLedger,
  type SlotLimits,
} from './provider-router-slots.ts';
export {
  type RoutedCore,
  routedJson,
  secondOpinionsFrom,
} from './provider-router-reask.ts';
export {
  DEFAULT_WIRE_FORMAT,
  scannerFor,
  type StreamWireFormat,
} from './stream-wire-format.ts';
export {
  bedrockIdFor,
  type BedrockSpelling,
  hyperIdFor,
  type HyperSpelling,
  openRouterIdFor,
  type OpenRouterSpelling,
  readsImages,
  reachOf,
  ROSTER_MODEL_IDS,
  type SyntheticEntry,
  syntheticEntryFor,
  visionReachOf,
} from './roster-reach.ts';
export {
  blocklistVerdictFor,
  type BlocklistVerdict,
  ROSTER_BLOCKLIST,
  type RosterBlocklistEntry,
} from './roster-blocklist.ts';
export {
  EveryProviderDryError,
  hyperIsDry,
  hyperMeterLevel,
  type ModelReach,
  NO_PROVIDER,
  BEDROCK_DRY_MARGIN_USD,
  bedrockIsDry,
  bedrockMeterLevel,
  openRouterIsDry,
  openRouterMeterLevel,
  type ProviderChoice,
  providerServing,
  routeProviderFor,
  syntheticIsDry,
  syntheticMeterLevel,
} from './budget-routing.ts';
export {
  HOLD_POLL_MS,
  NOBODY_REFUSED,
  readBudgetsPastHolds,
  shortestHold,
  waitOutHold,
} from './budget-hold-wait.ts';
export {
  CreditsShapeError,
  type HyperCredits,
  parseHyperCredits,
} from './hyper-credits.ts';
export {
  COMPLETION_CAP,
  completionCapFor,
} from './completion-cap.ts';
export { deliveredCharsOf, } from './stream-delivered-chars.ts';
export {
  isSpendReckoning,
  reportSpend,
  SPEND_MARKER,
  SPEND_RECKONINGS,
  type SpendReckoning,
} from './spend-line.ts';
export {
  noteRunSpend,
  resetRunSpend,
  runSpendUsd,
} from './run-spend-meter.ts';
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
  NO_SYNTHETIC_COUNTERPART,
  type HyperModelInfo,
  type HyperServedId,
} from './hyper-catalog.ts';
export {
  createHyperClient,
  HYPER_PER_MODEL_CONCURRENCY,
  type HyperClient,
  ModelNotServedError,
} from './hyper-client.ts';

export {
  SYNTHETIC_WITHHELD,
  syntheticServes,
} from './synthetic-catalog.ts';
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

export {
  type MeterLevel,
  type MeterRecord,
  meterRecordOf,
  type MeterState,
  readEveryMeter,
  routesAsDry,
  UNCONFIGURED_METER,
} from './provider-meters.ts';
export {
  isBudgetRefusal,
  isPaymentRefusal,
  isUpstreamModelRefusal,
  statedWaitMsOf,
} from './provider-budget-refusal.ts';
export {
  createUpstreamModelHolds,
  UPSTREAM_MODEL_HOLD_MS,
  type UpstreamModelHolds,
} from './upstream-model-hold.ts';

//endregion Provider barrel
