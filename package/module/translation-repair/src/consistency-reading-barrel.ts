export {
  assertCarriedOutcomes,
  type CarriedPlace,
  carriesSplice,
  spliceBuiltForSomePlace,
} from './corpus-run/artifact-two-lane-read-consistency-span-shared.ts';
export {
  addressRangesOf,
  standsOutsideAddresses,
} from './consistency-addresses.ts';
export {
  apostropheMarksOf,
  edgeClassOf,
  holdsEdgeApostrophe,
  holdsEdgeMark,
  isCountedSingleMark,
  isLetterOrDigitOfAnyScript,
  isSingleMark,
  looseMarksOf,
  sameBesideMark,
  sameEdgeClass,
  singleMarkAt,
  withApostropheForm,
  withLooseMarksOf,
} from './consistency-loose-marks.ts';
export {
  markReadingsInEnglish,
  type ProofView,
  proofViewOf,
  provenApostrophesInEnglish,
  withProvenApostrophes,
  type WordApostrophe,
} from './consistency-fold-apostrophes.ts';
export {
  bringsEdgeApostrophe,
  readingsChangeOutside,
} from './consistency-splice-readings.ts';
export { blockBreaksIn, } from './consistency-block-breaks.ts';
export {
  blankedOf,
  type EmphasisDelimiters,
  emphasisDelimitersOf,
  type ProseView,
  proseViewOf,
} from './consistency-prose-text.ts';
export {
  commentUnitsOf,
  unreadUnitsOf,
} from './consistency-unread-units.ts';
export {
  BOUNDARY_TAG_NAMES,
  unitKindsOf,
} from './consistency-shown-kinds.ts';
export {
  insideParagraphAt,
  quoteDepthAt,
} from './consistency-paragraphs.ts';
export {
  isSingleBreakAt,
  startsEscape,
} from './consistency-run-steps.ts';
export { quoteReferencesIn, } from './consistency-quote-references.ts';
export {
  NO_PLACE,
  PAGE_SLICE_SEPARATOR,
  type PageEnglish,
  type PageLayout,
  type PageSlice,
  pageOfSlices,
  pageReadingOf,
  positionOnPage,
  type ReadPage,
} from './consistency-page-english.ts';
export {
  inReceivingForm,
  pageApostropheFormOf,
} from './consistency-apostrophe-forms.ts';
export {
  agreedQuoteOf,
  agreedSlotOf,
  agreedSlotWordsOf,
  agreedWordsOf,
  isKeptByMajority,
  type KeepsByLabel,
  keepsByLabelOf,
  majorityChoiceOf,
  markEvidenceOf,
  type QuotesByLabel,
  quotesByLabelOf,
  tiedForFirstOf,
  usableVoicesOf,
} from './consistency-majority.ts';
export { unlessOverlapping, } from './consistency-count-overlap.ts';
export {
  CLOSING_CURLY_DOUBLE,
  closingRunMarksOf,
  EMPHASIS_CHARACTERS,
  HORIZONTAL_SPACE,
  LEADING_REFUSAL_RUN,
  TRAILING_REFUSAL_RUN,
} from './consistency-markup-runs.ts';
export {
  isNeighbouringSingleMark,
  partsMarkFromWord,
} from './consistency-mark-neighbours.ts';
export {
  type MarkReading,
  markReadingsOf,
  type MarksPastMarkup,
  type ProvenApostrophes,
  provenApostrophesOf,
} from './consistency-proven-apostrophes.ts';
export {
  asLocated,
  locatedContradicted,
  reasonContradicted,
} from './corpus-run/artifact-two-lane-read-consistency-located.ts';
export {
  asLocatedBySpan,
  locatedContradictedBySpan,
  reasonContradictedBySpan,
} from './corpus-run/artifact-two-lane-read-consistency-span-located.ts';
export { assertSpanGroupCoherent, } from './corpus-run/artifact-two-lane-read-consistency-span.ts';
export {
  expectedWinnerOf,
  sameWinner,
} from './corpus-run/artifact-two-lane-read-consistency-span-winner.ts';
export {
  assertSeatsHeardOnce,
  winningPositionOf,
} from './corpus-run/artifact-two-lane-read-consistency-tally.ts';
export {
  parseConsistencyCarry,
  parseConsistencyRunOff,
} from './corpus-run/artifact-two-lane-read-consistency-carry.ts';
export {
  assertCarriesRecount,
  outcomesAfter,
} from './corpus-run/artifact-two-lane-read-consistency-carry-recount.ts';
export { parseConsistency, } from './corpus-run/artifact-two-lane-read-consistency.ts';
export { assertGroupFits, } from './corpus-run/artifact-two-lane-read-consistency-fit.ts';
export { assertAskedGroupCoherent, } from './corpus-run/artifact-two-lane-read-consistency-coherence.ts';
export { assertSlicesCoherent, } from './corpus-run/artifact-two-lane-read-consistency-slices.ts';
export { parseConsistencyOccurrence, } from './corpus-run/artifact-two-lane-read-consistency-occurrence.ts';
export { parseConsistencyRendering, } from './corpus-run/artifact-two-lane-read-consistency-rendering.ts';
export {
  parseConsistencyBallot,
  parseConsistencyRepeat,
  parseConsistencyUnplaced,
} from './corpus-run/artifact-two-lane-read-consistency-parts.ts';
export { parseConsistencyVerdict, } from './corpus-run/artifact-two-lane-read-consistency-verdict.ts';
