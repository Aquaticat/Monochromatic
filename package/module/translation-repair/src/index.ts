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
} from './issue-taxonomy.ts';
export {
  MdxParseError,
  parseMdxBody,
} from './parse-mdx.ts';
export {
  parseDocument,
  type RepairDocument,
} from './parse-document.ts';
export {
  extractCompletion,
  type ExtractedCompletion,
  MalformedCompletionError,
  SyntheticHttpError,
} from './completion-shape.ts';
export { isJsonRecord, } from './json-guard.ts';
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
export { createSyntheticClient, } from './synthetic-client.ts';
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

//endregion Public barrel
