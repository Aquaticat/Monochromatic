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
  type AnchorRejection,
  type AnchorRejectionKind,
  type AnchorTarget,
  validateIssueClaim,
} from './validate-issue.ts';

//endregion Public barrel
