//region Footnote barrel
// The archive's footnotes made the original's: the relabel, the definition
// order, and the seam between the block pairing and both. Split out of
// `pipeline-barrel.ts` at its line budget.

export {
  applyFootnoteRelabel,
  type FootnoteRelabel,
  type FootnoteRelabelReading,
  footnoteRelabelOf,
  footnoteRelabelOfDefinitions,
} from './archive-footnote-relabel.ts';
export { widenFootnoteRelabel, } from './archive-footnote-relabel-widen.ts';
export {
  definitionLabelOrder,
  type ReorderedDefinitions,
  reorderFootnoteDefinitions,
} from './archive-footnote-order.ts';
export {
  closeFootnoteRelabel,
  documentLabels,
  type RelabelClosure,
} from './archive-footnote-closure.ts';
export {
  type FootnoteLabelRewrite,
  type RetainedArchiveFootnoteLabel,
} from './footnote-label-rewrite.ts';
export {
  FootnoteRewriteError,
  type FootnoteRewriteFailure,
  requireFootnoteRewriteRefusal,
} from './footnote-rewrite-error.ts';
export {
  crossingFinding,
  type DefinitionLabelPair,
  definitionIndexes,
  definitionLabelsOf,
  type SplitDefinitionPairs,
  splitDefinitionPairs,
} from './pair-definition-order.ts';

export {
  relabelArchiveFootnotes,
  type RelabelledArchive,
} from './corpus-run/pass-footnote-relabel.ts';

// The footnote graph and its model, moved here from `index.ts` at its line budget.
export {
  buildFootnoteGraph,
  scanFullwidthMarkers,
  scanGfmReferenceLiterals,
  type TextMarkerHit,
} from './footnote-graph.ts';
export {
  normalizeFootnoteIdentifier,
  relabelsFootnote,
} from './footnote-identifier.ts';
export {
  footnoteIdentifiers,
  type FootnoteMention,
  footnoteMentions,
  FootnoteOverflowError,
  MAX_SLICE_IDENTIFIERS,
} from './footnote-mentions.ts';
export {
  insideParsedSpan,
  parsedSpansOf,
} from './footnote-parsed-spans.ts';
export type {
  FootnoteConvention,
  FootnoteDefinitionHit,
  FootnoteGraph,
  FootnoteGraphFinding,
  FootnoteReferenceHit,
} from './footnote-model.ts';

//endregion Footnote barrel
