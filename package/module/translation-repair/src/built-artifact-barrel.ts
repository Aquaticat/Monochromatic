//region Built artifact barrel
// FUNCTIONS THE TESTS OF THE BUILT PACKAGE REACH, which no caller of the package needs.
// A test imports the artifact the package ships (`require-eventual-artifact` in the lint
// rules), so a function it tests directly is exported here from its own module, marked
// `@internal` in its documentation, and the package index re-exports this file.
export { activeFootnoteMarkers, } from './active-footnote-markers.ts';
export { proseBodyTree, } from './corpus-run/prose-ranges.ts';
export {
  isPartOfAWord,
  type ProofReading,
  readProof,
} from './consistency-fold-apostrophes.ts';
export {
  bringsAtEdge,
  gainsBesideKeptMark,
  holdsTwoMarksAtEdge,
} from './consistency-splice-readings.ts';
export { disjointSpans, } from './footnote-span-union.ts';
export { fragmentReadingOf, } from './footnote-parsed-spans.ts';
export { foldSoftBreaks, } from './soft-break-fold.ts';
export { sourceBreakDisplay, } from './source-break-display.ts';
export { blocksOrWholeText, } from './translate-address-drop.ts';
export { addedFormulaFindings, } from './translate-formula.ts';
export { readPageSkeleton, } from './translate-skeleton-page.ts';
export { unwrappedLinkFindings, } from './translate-unwrapped-link.ts';
//endregion Built artifact barrel
