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
  referenceLabels,
} from './archive-footnote-relabel.ts';
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
export { type FootnoteLabelRewrite, type RetainedArchiveFootnoteLabel, } from './footnote-label-rewrite.ts';
export { FootnoteRewriteError, type FootnoteRewriteFailure, } from './footnote-rewrite-error.ts';
export {
  crossingFinding,
  type DefinitionLabelPair,
  definitionIndexes,
  definitionLabelsOf,
  type SplitDefinitionPairs,
  splitDefinitionPairs,
} from './pair-definition-order.ts';

export { relabelArchiveFootnotes, type RelabelledArchive, } from './corpus-run/pass-footnote-relabel.ts';

//endregion Footnote barrel
