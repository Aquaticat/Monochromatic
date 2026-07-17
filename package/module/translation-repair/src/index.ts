//region Public barrel
// Deterministic document core of the translation-repair pipeline. Model-facing stages
// (critics, adjudication, patching) build on these anchors and land in later
// milestones.

export {
  buildDocumentNodes,
  type DocumentNode,
  type DocumentZone,
  hashContent,
  UnpositionedNodeError,
} from './document-node.ts';
export {
  buildFootnoteGraph,
  scanFullwidthMarkers,
  scanGfmReferenceLiterals,
  type TextMarkerHit,
} from './footnote-graph.ts';
export type {
  FootnoteConvention,
  FootnoteDefinitionHit,
  FootnoteGraph,
  FootnoteGraphFinding,
  FootnoteReferenceHit,
} from './footnote-model.ts';
export {
  type FrontMatterBlock,
  FrontMatterParseError,
  splitFrontMatter,
  type SplitMdxDocument,
} from './front-matter.ts';
export {
  computeIssueClaimId,
  type DocumentSide,
  type IssueClaim,
  type SpanAnchor,
} from './issue-model.ts';
export {
  categoryFamily,
  ISSUE_CATEGORIES,
  ISSUE_CATEGORY_FAMILIES,
  ISSUE_SEVERITIES,
  type IssueCategory,
  type IssueCategoryFamily,
  isIssueCategory,
  isIssueSeverity,
  type IssueSeverity,
  remapCategoryLeaf,
} from './issue-taxonomy.ts';
export { normalizePunctuation, } from './quote-normalize.ts';
export {
  type AlignmentFinding,
  alignDocumentSections,
  type ChunkPair,
  chunkByHeadings,
  type DocumentChunk,
  type SectionAlignment,
} from './chunk-document.ts';
export {
  type MaskedCommentRegion,
  maskHtmlComments,
} from './mask-html-comments.ts';
export {
  MdxParseError,
  parseMarkdownBody,
  parseMdxBody,
} from './parse-mdx.ts';
export {
  parseDocument,
  type ParseFinding,
  type RepairDocument,
} from './parse-document.ts';
export {
  extractCompletion,
  type ExtractedCompletion,
  MalformedCompletionError,
  readUsage,
  SyntheticHttpError,
} from './completion-shape.ts';
export { extractStreamedCompletion, } from './stream-completion.ts';
export {
  type BenchmarkEntry,
  type CriticBenchmarkResult,
  runCriticBenchmark,
} from './benchmark.ts';
export {
  CORPUS_COMMIT_SHA,
  type CorpusPin,
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from './corpus-source.ts';
export { buildCriticMessages, } from './critic-prompt.ts';
export {
  CRITIC_RESPONSE_FORMAT,
  type CriticIssueResolution,
  type CriticIssueWire,
  type CriticReportWire,
  isCriticReportWire,
  resolveCriticIssue,
} from './critic-wire.ts';
export {
  deriveOmissionSeeds,
  splitSentences,
} from './derive-seeds.ts';
export {
  isJsonArray,
  isJsonRecord,
} from './json-guard.ts';
export {
  detectRefusalShape,
  REFUSAL_MARKERS,
  REFUSAL_SCAN_WINDOW,
  type RefusalScan,
} from './refusal.ts';
export {
  estimateRequestWeight,
  SYNTHETIC_BASELINE_MODEL_ID,
  SYNTHETIC_CHAT_BASE_URL,
  SYNTHETIC_MODELS,
  SYNTHETIC_QUOTAS_URL,
  type SyntheticModelId,
  type SyntheticModelInfo,
  type SyntheticVendorFamily,
} from './synthetic-catalog.ts';
export type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
export {
  formatUsageNote,
  parseModelJson,
  stripCodeFence,
  stripThinkBlock,
} from './model-content.ts';
export {
  armCallDeadline,
  type CallDeadline,
} from './call-deadline.ts';
export {
  prepareBenchmarkEntry,
  type PreparedEntry,
} from './prepare-entry.ts';
export { createSyntheticClient, } from './synthetic-client.ts';
export {
  DEFAULT_RETRY_POLICY,
  exchangeWithRetry,
  type RetryPolicy,
} from './transient-retry.ts';
export {
  type BenchmarkScorecard,
  computeScorecard,
  type CriticAttemptOutcomeKind,
  type CriticAttemptRecord,
  type ModelScorecardRow,
} from './scorecard.ts';
export {
  COMPLETION_TOKEN_CEILING,
  isRetryableAttempt,
  isTruncatedAttempt,
} from './attempt-retry.ts';
export {
  applySeededErrors,
  SEED_MATCH_TOLERANCE,
  SeedApplicationError,
  type SeededDocumentResult,
  type SeededErrorApplication,
  type SeededErrorKind,
  type SeededErrorSpec,
  seedHitByRegion,
} from './seeded-error.ts';
export {
  parseQuotaSnapshot,
  QuotaShapeError,
  type QuotaSnapshot,
} from './synthetic-quota.ts';
export {
  fetchTransport,
  type ModelTransport,
  type TransportExchange,
  type TransportReply,
} from './synthetic-transport.ts';
export {
  type AnchorRejection,
  type AnchorRejectionKind,
  type AnchorTarget,
  validateIssueClaim,
} from './validate-issue.ts';

export * from './pipeline-barrel.ts';

//endregion Public barrel
