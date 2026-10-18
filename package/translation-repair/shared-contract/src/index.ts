//region Public index
// The names `@monochromatic-dev/translation-repair-shared-contract` gives its siblings and its own tests, each from the module that declares it.
// Production siblings import it through `/ts`; tests and fixtures through the built entry, so a process loads one copy.

export {
  type ActiveFootnoteMarker,
  activeFootnoteMarkers,
  footnoteMarkerLabels,
} from './active-footnote-markers.ts';
export {
  type AdjudicatedIssue,
  type AdjudicationConfig,
  type AdjudicationStatus,
  type BallotVerdict,
  DEFAULT_ADJUDICATION_CONFIG,
  isPanelVoteState,
  PANEL_VOTE_STATES,
  type PanelBallot,
  type PanelVoteState,
  type VoteTally,
} from './adjudicate-model.ts';
export {
  aggregateClaims,
  type AggregatedClaim,
  type ClaimAggregation,
  type ClaimCluster,
  CLUSTER_ANCHOR_TOLERANCE,
} from './aggregate-claims.ts';
export {
  describePlacement,
  type InsertionPlacement,
  placeInsertions,
} from './chunk-insertion.ts';
export {
  type ContentChunk,
  type DocumentChunk,
  type InsertionChunk,
  isInsertionChunk,
  makeInsertionChunk,
} from './chunk-placement.ts';
export {
  COMPLETION_CAP,
  completionCapFor,
  MIN_PROVIDER_CALLS,
  POOLED_P90,
} from './completion-cap.ts';
export {
  admitWithinShortfall,
  type CandidatePassage,
  CORPUS_EXPANSION,
  expectedTranslationPoints,
  pageShortfall,
} from './coverage-corroboration.ts';
export {
  dedupeAcceptedIssues,
  type DedupeOutcome,
} from './dedupe-issues.ts';
export { footnoteBreakCount, } from './footnote-break-count.ts';
export { sliceFootnoteLabels, } from './footnote-slice-labels.ts';
export {
  answerCeilingFor,
  HYPER_API_VERSION,
  HYPER_AUTH_HEADER,
  HYPER_CREDITS_URL,
  HYPER_MESSAGES_URL,
  HYPER_MODELS,
  type HyperModelInfo,
  NO_SYNTHETIC_COUNTERPART,
} from './hyper-catalog.ts';
export {
  CreditsShapeError,
  type HyperCredits,
  parseHyperCredits,
} from './hyper-credits.ts';
export {
  computeIssueClaimId,
  type DocumentSide,
  type IssueClaim,
  type SpanAnchor,
} from './issue-model.ts';
export {
  ADDITION_CATEGORY,
  type CategoryRemap,
  isIssueCategory,
  isIssueSeverity,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  type IssueCategory,
  type IssueSeverity,
  remapCategoryLeaf,
} from './issue-taxonomy.ts';
export {
  CARD_PROVIDERS,
  type CardProvider,
  cardsServing,
  DECISION_ONLY_ROSTER_IDS,
  DecisionsCardMissingError,
  decisionsCardOf,
  holdSet,
  isDecisionSeat,
  keyedBy,
  recordOfDistinctIds,
  recordOver,
  ROSTER_CARDS,
  type RosterCard,
  type ServedIdOf,
  servedRecord,
  type ServingCard,
} from './model-card-derive.ts';
export {
  type BedrockCard,
  type BedrockRoute,
  type BedrockStreamEnd,
  type CompletionCapPool,
  type DecisionsCard,
  type ModelCard,
  type OpenRouterCard,
  type SeatHold,
  type ServedCard,
  type SyntheticCard,
  type SyntheticVendorFamily,
} from './model-card.ts';
export { MODEL_CARDS, } from './model-cards.ts';
export {
  APPARATUS_KINDS,
  NARRATIVE_DETAIL_IS_NOT_APPARATUS,
  PAGE_APPARATUS_IS_KEPT,
} from './page-apparatus-clause.ts';
export {
  pageDefinitionsOf,
  withDefinitions,
} from './page-definitions.ts';
export { PAGE_TITLE_CACHE_VERSION, } from './page-title-cache-version.ts';
export {
  type ClaimPanelReading,
  type PanelClaimBallot,
} from './panel-reading.ts';
export {
  isCommentFinding,
  parseBodyTolerant,
  parseDocument,
  type ParseFinding,
  type RepairDocument,
} from './parse-document.ts';
export {
  deriveEditableEnvelopes,
  type EditableEnvelope,
  type EnvelopePlan,
} from './patch-model.ts';
export {
  isUnreadableReason,
  nestingWithEdit,
  unreadableReason,
} from './patch-nesting.ts';
export { perModelLimiter, } from './per-model-limiter.ts';
export {
  photoPath,
  type PhotoReference,
  photoReferences,
} from './photo-reference.ts';
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
  type IneligibleReason,
  type ParagraphEligibility,
  selectRefinableParagraphs,
} from './refine-eligibility.ts';
export {
  collectDefinitions,
  deriveRefinableEnvelopes,
  type RefinableSlice,
} from './refine-envelope.ts';
export {
  BEDROCK_SERVED_IDS,
  type BedrockOnlyRosterId,
  type BedrockServedId,
  type DecisionOnlyRosterId,
  HYPER_SERVED_IDS,
  type HyperOriginRosterId,
  type HyperServedId,
  OPENROUTER_SERVED_IDS,
  type OpenRouterDecisionId,
  type OpenRouterOnlyRosterId,
  type OpenRouterServedId,
  ROSTER_MODEL_IDS,
  type RosterModelId,
  SYNTHETIC_SERVED_IDS,
  type SyntheticServedId,
} from './roster-id.ts';
export {
  parseRunJson,
  readRunJson,
  RunJsonUnreadableError,
} from './run-json-read.ts';
export {
  noteRunSpend,
  resetRunSpend,
  runSpendUsd,
} from './run-spend-meter.ts';
export {
  type AnchorRejection,
  type AnchorRejectionKind,
  type AnchorTarget,
  validateIssueClaim,
} from './validate-issue.ts';

//endregion Public index
