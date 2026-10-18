export {
  CONSISTENCY_CACHE_VERSION,
} from './consistency-cache-version.ts';
export {
  countConsistency,
  slotInSpan,
  winnerOf,
} from './consistency-count.ts';
export { occurrencesOf, } from './consistency-occurrences.ts';
export { type QuoteOccurrences, } from './consistency-occurrences.ts';
export { edgeFreeWordsOf, } from './consistency-edge-marks.ts';
export {
  foldedWordsOf,
  locateWords,
  marksHeldBesideWords,
  type SpanSearch,
  standsOf,
} from './consistency-fold.ts';
export {
  quoteBounds,
  quoteCore,
} from './consistency-quote-bounds.ts';
export {
  wholeEndOf,
  wholeSpanOf,
  wholeStartOf,
} from './consistency-whole-end.ts';
export { edgeUnitsOf, } from './consistency-edge-units.ts';
export { cutsShownWord, } from './consistency-shown-edge.ts';
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
export { carriesOrCutsMarkup, } from './consistency-markup.ts';
export { consistencyTenseLines, } from './consistency-tense.ts';
export { shownLabelOf, } from './consistency-label-form.ts';
export { labelsSentenceOf, } from './consistency-label-sentence.ts';
export { containedQuoteWordsOf, } from './consistency-span-agreement.ts';
export {
  canonicalChoiceOf,
  choiceTallyOf,
  type ConsistencyChoiceVoice,
  consistencyChoiceResponseFormat,
  type ConsistencyChoiceWire,
  isConsistencyChoiceWire,
  isUsableChoice,
  tiedChoicesOf,
  usableChoiceFor,
  usableChoicesOf,
} from './consistency-choice.ts';
export {
  buildConsistencyRunOffMessages,
  runOffWinnerOf,
} from './consistency-run-off.ts';
export {
  type CarryChoice,
  carryChoiceOf,
  type CarryOffer,
  carryOffersOf,
  carryRunOffFinalistsOf,
} from './consistency-carry.ts';
export {
  type BlockStanding,
  blockHolding,
  blockStandingOf,
  type CarryBlock,
  type SpliceOnlyKind,
} from './consistency-carry-standing.ts';
export {
  buildCarryWriterMessages,
  type CarryWriterSubject,
} from './consistency-carry-writer-sheet.ts';
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
  buildCarryChoiceMessages,
  type CarryChoiceCandidate,
  type CarryChoiceSubject,
} from './consistency-carry-choice-sheet.ts';
export type {
  ConsistencyCount,
  ConsistencyRendering,
  ConsistencyVoice,
  ConsistencyWinner,
  NoWinnerReason,
  UnlocatedReason,
} from './consistency-count-types.ts';
export {
  applyConsistencyEdits,
  type AppliedEdits,
  type ConsistencyEdit,
  type ConsistencyPlan,
  planConsistencyEdit,
} from './consistency-splice.ts';
export {
  buildConsistencyMessages,
  type ConsistencyMarks,
  type ConsistencyOccurrenceView,
  type ConsistencyRepeat,
  type ConsistencySubject,
} from './consistency-sheet.ts';
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
export {
  type ArtifactConsistency,
  type ArtifactConsistencyBallot,
  type ArtifactConsistencyCandidate,
  type ArtifactConsistencyCarry,
  type ArtifactConsistencyCarryDecision,
  type ArtifactConsistencyChoiceBallot,
  type ArtifactConsistencyGroup,
  type ArtifactConsistencyOccurrence,
  type ArtifactConsistencyRendering,
  type ArtifactConsistencyRepeat,
  type ArtifactConsistencyRunOff,
  type ArtifactConsistencySlice,
  type ArtifactConsistencyUnplaced,
  type ArtifactConsistencyVerdict,
  type ConsistencyCarryNoDecisionReason,
  type ConsistencyNotAskedReason,
  CONSISTENCY_CANDIDATE_KINDS,
  CONSISTENCY_CARRY_DECISION_KINDS,
  CONSISTENCY_CARRY_NO_DECISION_REASONS,
  type ConsistencyOccurrenceOutcome,
  type ConsistencyOverride,
  consistencyOverrideAt,
  NO_CONSISTENCY,
} from './corpus-run/artifact-two-lane-consistency.ts';
export { parseConsistency, } from './corpus-run/artifact-two-lane-read-consistency.ts';
export {
  type ConsistencyCacheValue,
  type ConsistencyChoiceRecord,
  consistencyKey,
  type ConsistencyRecord,
  type ConsistencyStage,
  type ConsistencyWriterVoice,
  type ConsistencyWritersRecord,
  openConsistencyCache,
} from './corpus-run/pass-consistency-cache.ts';
export {
  gatherThroughCache,
  recordFits,
} from './corpus-run/pass-consistency-gather.ts';
export {
  askRunOff,
  choiceRecordOf,
  type ConsistencyRunOffAsked,
  storedChoices,
} from './corpus-run/pass-consistency-run-off.ts';
export { runOffResultLine, } from './corpus-run/pass-consistency-run-off-line.ts';
export {
  askCarryChoice,
  askCarryWriters,
  type CarryChoiceAsked,
  type CarryWritersAsked,
} from './corpus-run/pass-consistency-carry-ask.ts';
export {
  composeSlice,
  floorRefusalOf,
  writtenParagraphsOf,
} from './corpus-run/pass-consistency-carry-candidates.ts';
export {
  crossingOfUnit,
  crossingWordsLost,
  crossingWordsOf,
} from './corpus-run/pass-consistency-carry-crossing.ts';
export {
  carryAll,
  carryToUnit,
} from './corpus-run/pass-consistency-carry.ts';
export {
  carryWithoutChoice,
  choose,
} from './corpus-run/pass-consistency-carry-choose.ts';
export {
  englishOf,
  englishOfUnit,
  type HeldReceiver,
  isKeptOutcome,
  type KeptWords,
  keptWordsOf,
  sliceOfUnit,
  unitLabelsOf,
  unitsOf,
} from './corpus-run/pass-consistency-carry-units.ts';
export {
  afterRunOff,
  chosenPlaceOf,
  plannedPlace,
} from './corpus-run/pass-consistency-decide.ts';
export {
  type CarryShown,
  shownOf,
  splicedParagraphOf,
  writtenOffers,
} from './corpus-run/pass-consistency-carry-offers.ts';
export {
  type CarryContext,
  type CarryReceiver,
  type CarryUnit,
  type CarryWriters,
  type DecidedGroup,
  type LocatedPlace,
  type PendingEdit,
  type SettledGroup,
  type UnitCarried,
} from './corpus-run/pass-consistency-types.ts';
export {
  type ConsistencyFloorVerdict,
  consistencyFloorVerdict,
} from './corpus-run/pass-consistency-floors.ts';
export {
  type ConsistencySliceFacts,
  consistencySlicesOf,
} from './corpus-run/pass-consistency-slices.ts';
export { runPassConsistency, } from './corpus-run/pass-consistency.ts';
export { ConsistencyInvariantError, } from './consistency-invariant-error.ts';
export {
  askConsistencyBench,
  type ConsistencyAsked,
} from './corpus-run/pass-consistency-ask.ts';
export {
  askAll,
  type AskedDecision,
  decideAskedGroup,
  type PreparedGroup,
  writersOf,
} from './corpus-run/pass-consistency-bench.ts';
export {
  type ConsistencyPlace,
  dispositionOf,
  type GroupDisposition,
  occurrenceViewOf,
  placesOf,
  repeatOf,
} from './corpus-run/pass-consistency-group.ts';
export {
  countAsked,
  runOffReasonOf,
  settleAsked,
  settleCarried,
} from './corpus-run/pass-consistency-settle.ts';
export {
  settleFailed,
  settleUnasked,
  unplacedOf,
} from './corpus-run/pass-consistency-unasked.ts';
export {
  type PassSettlement,
  runPassSettlement,
} from './corpus-run/pass-settlement.ts';
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
