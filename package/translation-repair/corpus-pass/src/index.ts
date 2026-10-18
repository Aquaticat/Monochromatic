//region Public index
// The names `@monochromatic-dev/translation-repair-corpus-pass` gives its siblings and its own tests, each from the module that declares it.
// Production siblings import it through `/ts`; tests and fixtures through the built entry, so a process loads one copy.

export { consolidateDocument, } from './consolidate-driver.ts';
export { assertPassResumable, } from './corpus-run/corpus-pass-guards.ts';
export { type CorpusPassInput, } from './corpus-run/corpus-pass-input.ts';
export {
  HARD_CAP_MINUTES,
  PASS_MS_PER_MINUTE,
  PLAN_PREVIEW_COUNT,
  SOFT_BUDGET_MS,
} from './corpus-run/corpus-pass-limits.ts';
export {
  passDoneLine,
  passIncompleteLine,
  passLaunchLines,
  passOnlyLines,
  passPlanLine,
  passRequiredLines,
  passStartLine,
} from './corpus-run/corpus-pass-lines.ts';
export { orderPendingEntries, } from './corpus-run/corpus-pass-order.ts';
export { runPassQueue, } from './corpus-run/corpus-pass-queue.ts';
export { runCorpusPassOver, } from './corpus-run/corpus-pass-run.ts';
export { selectPendingEntries, } from './corpus-run/corpus-pass-select.ts';
export {
  passArchiveText,
  passArchiveWithOrigins,
} from './corpus-run/pass-archive.ts';
export { attestPassReferences, } from './corpus-run/pass-attest-references.ts';
export { foldPassCarried, } from './corpus-run/pass-carried-fold.ts';
export {
  editedStartOf,
  gainedBy,
  type GainSlice,
  type GainVerdict,
  madeIn,
  unprovenOnPage,
  withoutUnprovenGains,
} from './corpus-run/pass-consistency-apply-gains.ts';
export {
  type GroupEdit,
  replacedKeyOf,
  type SettledIndex,
  settledIndexOf,
} from './corpus-run/pass-consistency-apply-index.ts';
export {
  gainSliceOf,
  idsOf,
  keyOf,
  NO_POSITION,
  pageFrameOf,
  positionOfSlice,
  type ReadmitLedger,
  readmitLedgerOf,
  replacedAt,
} from './corpus-run/pass-consistency-apply-ledger.ts';
export {
  editsChangingLocatedWords,
  type LeftOutEdit,
} from './corpus-run/pass-consistency-apply-located.ts';
export { putBackInPageOrder, } from './corpus-run/pass-consistency-apply-order.ts';
export {
  plansOnPage,
  settledSlicesOf,
} from './corpus-run/pass-consistency-apply-plan.ts';
export { readmittedSlicesOf, } from './corpus-run/pass-consistency-apply-readmit.ts';
export {
  carriedPlaceName,
  editId,
  finalGroupsOf,
  pendingNamed,
  placeKey,
  recordedRendering,
  type SliceEdits,
  sliceEditsOf,
  winnerOver,
} from './corpus-run/pass-consistency-apply-record.ts';
export { screenSide, } from './corpus-run/pass-consistency-apply-screen.ts';
export {
  type FloorsAsked,
  floorsQuestionOf,
  gainFindingOf,
  type GainReason,
  keptReasonOfGain,
  type SettledSlice,
  sliceIndexOf,
  type SlicePlan,
} from './corpus-run/pass-consistency-apply-settled.ts';
export {
  floorsWithSplice,
  madeWithSplice,
  type Trial,
  trialOf,
  type WithSplice,
} from './corpus-run/pass-consistency-apply-trial.ts';
export {
  type WorkedPage,
  workedPageOf,
} from './corpus-run/pass-consistency-apply-worked.ts';
export {
  type AppliedConsistency,
  applyConsistency,
} from './corpus-run/pass-consistency-apply.ts';
export {
  askConsistencyBench,
  type ConsistencyAsked,
} from './corpus-run/pass-consistency-ask.ts';
export {
  type AskedDecision,
  decideAskedGroup,
  type PreparedGroup,
} from './corpus-run/pass-consistency-bench-decide.ts';
export {
  askAll,
  writersOf,
} from './corpus-run/pass-consistency-bench.ts';
export {
  type ConsistencyCacheValue,
  type ConsistencyChoiceRecord,
  consistencyKey,
  type ConsistencyRecord,
  type ConsistencyStage,
  type ConsistencyWritersRecord,
  type ConsistencyWriterVoice,
  openConsistencyCache,
} from './corpus-run/pass-consistency-cache.ts';
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
  carryWithoutChoice,
  choose,
} from './corpus-run/pass-consistency-carry-choose.ts';
export {
  crossingOfUnit,
  crossingWordsLost,
  crossingWordsOf,
} from './corpus-run/pass-consistency-carry-crossing.ts';
export {
  editsOf,
  partlyCarriedFindingOf,
} from './corpus-run/pass-consistency-carry-edits.ts';
export {
  type CarryShown,
  shownOf,
  splicedParagraphOf,
  writtenOffers,
} from './corpus-run/pass-consistency-carry-offers.ts';
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
  carryAll,
  carryToUnit,
} from './corpus-run/pass-consistency-carry.ts';
export {
  afterRunOff,
  chosenPlaceOf,
  plannedPlace,
} from './corpus-run/pass-consistency-decide.ts';
export {
  type EdgeRefusal,
  edgeRefusalOf,
  type EdgeVerdict,
} from './corpus-run/pass-consistency-edge-refusal.ts';
export {
  type ConsistencyFloorVerdict,
  consistencyFloorVerdict,
} from './corpus-run/pass-consistency-floors.ts';
export {
  gatherThroughCache,
  recordFits,
} from './corpus-run/pass-consistency-gather.ts';
export { groupLine, } from './corpus-run/pass-consistency-group-line.ts';
export {
  type ConsistencyPlace,
  dispositionOf,
  type GroupDisposition,
  occurrenceViewOf,
  placesOf,
  repeatOf,
} from './corpus-run/pass-consistency-group.ts';
export { runOffResultLine, } from './corpus-run/pass-consistency-run-off-line.ts';
export {
  askRunOff,
  choiceRecordOf,
  type ConsistencyRunOffAsked,
  storedChoices,
} from './corpus-run/pass-consistency-run-off.ts';
export {
  countAsked,
  runOffReasonOf,
  settleAsked,
  settleCarried,
} from './corpus-run/pass-consistency-settle.ts';
export {
  type ConsistencySliceFacts,
  consistencySlicesOf,
} from './corpus-run/pass-consistency-slices.ts';
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
  settleFailed,
  settleUnasked,
  unplacedOf,
} from './corpus-run/pass-consistency-unasked.ts';
export { runPassConsistency, } from './corpus-run/pass-consistency.ts';
export {
  type ConsolidationHooks,
  consolidationHooksFor,
} from './corpus-run/pass-consolidate-reseat.ts';
export { runPassConsolidation, } from './corpus-run/pass-consolidate.ts';
export {
  type ContestHooks,
  contestHooksFor,
} from './corpus-run/pass-contest-reseat.ts';
export { runPassContest, } from './corpus-run/pass-contest.ts';
export { persistSettledEntry, } from './corpus-run/pass-entry-persist.ts';
export { settleEntry, } from './corpus-run/pass-entry.ts';
export {
  relabelArchiveFootnotes,
  type RelabelledArchive,
} from './corpus-run/pass-footnote-relabel.ts';
export { decidePassInsertionAdmission, } from './corpus-run/pass-insertion-admission.ts';
export {
  admitPassInsertions,
  type InsertionHooks,
  insertionHooksFor,
} from './corpus-run/pass-insertion-reseat.ts';
export {
  type LanesSeating,
  runPassLanes,
} from './corpus-run/pass-lanes.ts';
export {
  outsideReadsFrom,
  type PassCorpusNameReader,
  type PassOutsideReads,
  type PassReferenceReader,
  type PassWorkTitleReader,
} from './corpus-run/pass-outside-reads.ts';
export {
  entryOverlap,
  readPassOverlap,
} from './corpus-run/pass-overlap.ts';
export { settledPageArtifact, } from './corpus-run/pass-page-assembly.ts';
export { assertPageGuards, } from './corpus-run/pass-page-guards.ts';
export {
  openPageTitleCache,
  pageTitleKey,
  type PageTitleLexiconRecord,
  type PassPageTitles,
  passPageTitles,
} from './corpus-run/pass-page-titles.ts';
export {
  type PicturesHooks,
  picturesHooksFor,
} from './corpus-run/pass-pictures-reseat.ts';
export {
  type PreparationHooks,
  preparationHooksFor,
  runPassPreparation,
} from './corpus-run/pass-prepare-reseat.ts';
export { preparePassEntry, } from './corpus-run/pass-prepare.ts';
export {
  type Reseated,
  reseatHookFor,
} from './corpus-run/pass-reseat-hook.ts';
export {
  type LanesHooks,
  lanesHooksFor,
  readLanesSeats,
  translateReseatFor,
} from './corpus-run/pass-reseat.ts';
export { createPassPictureReader, } from './corpus-run/pass-seated-pictures.ts';
export {
  type PassSettlement,
  runPassSettlement,
} from './corpus-run/pass-settlement.ts';
export { type PassPictureSources, } from './corpus-run/pass-visual-evidence.ts';
export { contestDocumentLanes, } from './lane-contest-driver.ts';

//endregion Public index
