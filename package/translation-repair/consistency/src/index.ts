//region Public index
// The names `@monochromatic-dev/translation-repair-consistency` gives its siblings and its own tests, each from the module that declares it.
// Production siblings import it through `/ts`; tests and fixtures through the built entry, so a process loads one copy.

export {
  addressRangesOf,
  standsOutsideAddresses,
} from './consistency-addresses.ts';
export {
  inReceivingForm,
  pageApostropheFormOf,
} from './consistency-apostrophe-forms.ts';
export { blockBreaksIn, } from './consistency-block-breaks.ts';
export { CONSISTENCY_CACHE_VERSION, } from './consistency-cache-version.ts';
export {
  buildCarryChoiceMessages,
  type CarryChoiceCandidate,
  type CarryChoiceSubject,
} from './consistency-carry-choice-sheet.ts';
export {
  aroundBlocksOf,
  type CarryChosenPlace,
  type CarryEdgeWords,
  type CarryReceivingPlace,
  chosenEnglishBlocksOf,
  keepingBlockOf,
  originalBlocksOf,
  receivingLabel,
  replaceBlocksOf,
} from './consistency-carry-sheet-parts.ts';
export {
  blockHolding,
  type BlockStanding,
  blockStandingOf,
  type CarryBlock,
  type SpliceOnlyKind,
} from './consistency-carry-standing.ts';
export {
  buildCarryWriterMessages,
  type CarryWriterSubject,
} from './consistency-carry-writer-sheet.ts';
export {
  type CarryChoice,
  carryChoiceOf,
  type CarryOffer,
  carryOffersOf,
  carryRunOffFinalistsOf,
} from './consistency-carry.ts';
export {
  canonicalChoiceOf,
  choiceTallyOf,
  consistencyChoiceResponseFormat,
  type ConsistencyChoiceVoice,
  type ConsistencyChoiceWire,
  isConsistencyChoiceWire,
  isUsableChoice,
  tiedChoicesOf,
  usableChoiceFor,
  usableChoicesOf,
} from './consistency-choice.ts';
export { closingJointsOf, } from './consistency-closing-links.ts';
export {
  joinedMarksOf,
  markPastRunOf,
} from './consistency-closing-marks.ts';
export { isCornerBracket, } from './consistency-corner-brackets.ts';
export { unlessOverlapping, } from './consistency-count-overlap.ts';
export {
  type ConsistencyCount,
  type ConsistencyRendering,
  type ConsistencyVoice,
  type ConsistencyWinner,
  type NoWinnerReason,
  type UnlocatedReason,
} from './consistency-count-types.ts';
export {
  countConsistency,
  winnerOf,
} from './consistency-count.ts';
export { edgeFreeWordsOf, } from './consistency-edge-marks.ts';
export { edgeUnitsOf, } from './consistency-edge-units.ts';
export {
  isPartOfAWord,
  markReadingsInEnglish,
  type ProofReading,
  type ProofView,
  proofViewOf,
  provenApostrophesInEnglish,
  readProof,
  withProvenApostrophes,
  type WordApostrophe,
} from './consistency-fold-apostrophes.ts';
export {
  foldWithOffsets,
  type OffsetFoldedText,
  offsetsInFold,
} from './consistency-fold-offsets.ts';
export {
  foldedWordsOf,
  locateWords,
  marksHeldBesideWords,
  type SpanSearch,
  standsOf,
} from './consistency-fold.ts';
export {
  type FoldedLinks,
  foldedLinksOf,
  NO_FOLDED_LINKS,
} from './consistency-folded-links.ts';
export { ConsistencyInvariantError, } from './consistency-invariant-error.ts';
export { shownLabelOf, } from './consistency-label-form.ts';
export { labelsSentenceOf, } from './consistency-label-sentence.ts';
export {
  isLinkNode,
  linkLabelKindOf,
} from './consistency-link-label.ts';
export {
  linkTwinOf,
  originalOffsetsOf,
} from './consistency-link-twin.ts';
export {
  apostropheMarksOf,
  edgeClassOf,
  holdsEdgeApostrophe,
  holdsEdgeMark,
  isCountedSingleMark,
  isSingleMark,
  looseMarksOf,
  sameBesideMark,
  sameEdgeClass,
  singleMarkAt,
  withApostropheForm,
  withLooseMarksOf,
} from './consistency-loose-marks.ts';
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
export {
  isNeighbouringSingleMark,
  partsMarkFromWord,
} from './consistency-mark-neighbours.ts';
export { marksPastMarkupOf, } from './consistency-marks-past-markup.ts';
export {
  CLOSING_CURLY_DOUBLE,
  closingRunMarksOf,
  EMPHASIS_CHARACTERS,
  HORIZONTAL_SPACE,
  LEADING_REFUSAL_RUN,
  TRAILING_REFUSAL_RUN,
  WRITTEN_APOSTROPHES,
} from './consistency-markup-runs.ts';
export { carriesOrCutsMarkup, } from './consistency-markup.ts';
export {
  occurrencesOf,
  type QuoteOccurrences,
} from './consistency-occurrences.ts';
export {
  NO_PLACE,
  PAGE_SLICE_SEPARATOR,
  type PageEnglish,
  type PageLayout,
  pageOfSlices,
  pageReadingOf,
  type PageSlice,
  positionOnPage,
  type ReadPage,
} from './consistency-page-english.ts';
export {
  insideParagraphAt,
  quoteDepthAt,
} from './consistency-paragraphs.ts';
export {
  blankedOf,
  type EmphasisDelimiters,
  emphasisDelimitersOf,
  type ProseView,
  proseViewOf,
} from './consistency-prose-text.ts';
export {
  type MarkReading,
  markReadingsOf,
  type MarksPastMarkup,
  type ProvenApostrophes,
  provenApostrophesOf,
} from './consistency-proven-apostrophes.ts';
export {
  quoteBounds,
  quoteCore,
} from './consistency-quote-bounds.ts';
export { quoteReferencesIn, } from './consistency-quote-references.ts';
export {
  buildConsistencyRunOffMessages,
  runOffWinnerOf,
} from './consistency-run-off.ts';
export {
  isSingleBreakAt,
  startsEscape,
} from './consistency-run-steps.ts';
export {
  buildConsistencyMessages,
  type ConsistencyMarks,
  type ConsistencyOccurrenceView,
  type ConsistencyRepeat,
  type ConsistencySubject,
} from './consistency-sheet.ts';
export { cutsShownWord, } from './consistency-shown-edge.ts';
export {
  BOUNDARY_TAG_NAMES,
  unitKindsOf,
} from './consistency-shown-kinds.ts';
export { slotInSpan, } from './consistency-slot-in-span.ts';
export { containedQuoteWordsOf, } from './consistency-span-agreement.ts';
export {
  bringsAtEdge,
  bringsEdgeApostrophe,
  gainsBesideKeptMark,
  holdsTwoMarksAtEdge,
  readingsChangeOutside,
} from './consistency-splice-readings.ts';
export {
  type AppliedEdits,
  applyConsistencyEdits,
  type ConsistencyEdit,
  type ConsistencyPlan,
  planConsistencyEdit,
} from './consistency-splice.ts';
export { consistencyTenseLines, } from './consistency-tense.ts';
export {
  commentUnitsOf,
  unreadUnitsOf,
} from './consistency-unread-units.ts';
export {
  wholeEndOf,
  wholeSpanOf,
  wholeStartOf,
} from './consistency-whole-end.ts';
export {
  canonicalBallotOf,
  type ConsistencyBallotWire,
  type ConsistencyEnglish,
  consistencyLabel,
  consistencyLabels,
  type ConsistencyQuoteWire,
  consistencyResponseFormat,
  isConsistencyBallotWire,
  isUsableConsistencyBallot,
  usableConsistencyBallotFor,
} from './consistency-wire.ts';
export { cutsWord, } from './consistency-word-joints.ts';

//endregion Public index
