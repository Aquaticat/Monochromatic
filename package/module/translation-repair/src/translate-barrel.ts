//region Translate barrel
// Translate-lane surface: the translator sheet, candidate assembly, and the
// stage that renders a slice from its original and lets judges choose between
// the renderings and the translation already in the archive.
//
// Split from `pipeline-barrel.ts` because that file sits at its line budget and
// this lane is a whole pipeline shape rather than another stage inside the
// repair one.

export {
  alignmentRefusalFinding,
  assessSliceAlignment,
  MAX_INCUMBENT_TO_SOURCE_RATIO,
  MIN_PROTECTED_INCUMBENT,
  type SliceAlignmentAssessment,
} from './translate-alignment.ts';
export {
  buildTranslateCandidates,
  type TranslateCandidateSet,
  type TranslateCandidateValue,
  type TranslateOrigin,
} from './translate-candidates.ts';
export {
  describeSlate,
  NOT_ON_SLATE,
  positionOf,
  rotateCandidates,
  type TranslateSlateEntry,
} from './translate-slate.ts';
export { translateDocument, } from './translate-document.ts';
export { assembleTranslation, } from './translate-assemble.ts';
export { alignmentRefusals, } from './translate-alignment-refusals.ts';
export { translateLaneWordings, } from './translate-lane-wordings.ts';
export {
  assertUnheardKeptIncumbent,
  heardNobody,
  TranslateUnheardError,
  unheardCacheDiscardFinding,
} from './translate-unheard.ts';
export {
  translateRunShape,
  translateSliceKey,
} from './translate-slice-key.ts';
export {
  type TranslateDisposition,
  type TranslateDocumentResult,
  type TranslateModels,
  TRANSLATE_SLICE_CACHE_VERSION,
  type TranslateSliceRecord,
} from './translate-document-contract.ts';
export { settleTranslateSlice, } from './translate-slice.ts';
export {
  absenceFinding,
  blankAgainst,
  BlankSelectionError,
  type IncumbentKind,
  TranslateAbsenceError,
  type TranslateAbsenceReason,
} from './translate-absence.ts';
export {
  TRANSLATE_LINE_STRUCTURE_CRITERION,
  TRANSLATE_SELECTION_CRITERIA,
  translateSelectionCriteria,
  TRANSLATE_SELECTION_TASK,
} from './translate-selection-sheet.ts';
export { judgeTranslateSlate, } from './translate-judge.ts';
export {
  type ProducedSlate,
  produceTranslateSlate,
} from './translate-produce.ts';
export { judgeSlateWithRetry, } from './translate-retry.ts';
export {
  attemptTranslateSlice,
  type SliceAttempt,
} from './translate-slice-attempt.ts';
export { runTranslateStage, } from './translate-stage.ts';
export {
  type TranslateDecision,
  type TranslateStageResult,
} from './translate-stage-result.ts';
export {
  type RepairOutcome,
  repairInvalidCandidates,
} from './translate-repair.ts';
export {
  buildTranslateRepairMessages,
  isTranslateRepairWire,
  type RepairResolution,
  TRANSLATE_REPAIR_RESPONSE_FORMAT,
  type TranslateRepairWire,
} from './translate-repair-wire.ts';
export {
  type BlockShape,
  blockDetail,
  readSliceSkeleton,
  type SkeletonRead,
  type SliceSkeleton,
} from './translate-skeleton.ts';
export {
  type SliceValidation,
  validateTranslatedSlice,
} from './translate-validate.ts';
export {
  buildTranslateMessages,
  isTranslateReportWire,
  TRANSLATE_LINE_STRUCTURE_RULE,
  TRANSLATE_RESPONSE_FORMAT,
  type TranslatePromptPlan,
  type TranslateReportWire,
} from './translate-wire.ts';
export {
  CONTEST_POLICY,
  CONTEST_REFUSAL,
  contestResponseFormat,
  isStringList,
  namesOneOf,
  readCandidateNames,
} from './contest-ballot-wire.ts';
export {
  type CoverageAnswer,
  runCoverageStage,
} from './coverage-stage.ts';
export {
  alterSharedNumber,
  type DamageAttempt,
  deleteOneSentence,
  donorTextsFor,
  type FidelityDamageKind,
  insertBorrowedSentence,
} from './fidelity-damage.ts';
export { spliceOutSentence, } from './fidelity-splice.ts';
export {
  digitRuns,
  sharedNumber,
  unsupportedVariant,
} from './fidelity-alteration.ts';
export {
  neighbouringIncumbent,
  neighbouringSource,
  type SliceNeighbourContext,
  sliceNeighbourContexts,
} from './fidelity-window.ts';
export { sharesMedia, } from './corpus-run/transcription-suspect.ts';
export {
  type FidelityBallotRead,
  type FidelityDirection,
  type FidelityOutcome,
  type FidelityTrial,
  runFidelityTrial,
} from './judge-fidelity.ts';
export {
  type CoverageVerdict,
  judgeCoverage,
} from './coverage-verdict.ts';
export {
  admitWithinShortfall,
  type CandidatePassage,
  CORPUS_EXPANSION,
  expectedTranslationPoints,
  pageShortfall,
} from './coverage-corroboration.ts';
export {
  buildCoverageMessages,
  COVERAGE_RESPONSE_FORMAT,
  type CoverageDegree,
  type CoveragePromptPlan,
  type CoverageReportWire,
  isCoverageReportWire,
} from './coverage-wire.ts';
export {
  messageText,
  type VisionMessage,
} from './chat-contract.ts';
export {
  preferenceRate,
  type PreferenceRate,
  type ProducerStanding,
  producerStandings,
} from './producer-standing.ts';
export {
  type EncodedAsset,
  encodeImageAsset,
} from './image-asset.ts';
export {
  readingMakesSense,
  type ReadingVerdict,
} from './image-reading-sense.ts';
export {
  latinWords,
  readsAsRefusal,
} from './reading-refusal.ts';
export {
  type OcrReading,
  readImageWithOcr,
  solidCharacters,
} from './image-ocr.ts';
export {
  type ImageReading,
  isTransientReadingReason,
  readImageAsset,
} from './image-reading-stage.ts';
export { readDocumentPictures, } from './document-readings.ts';
export { imageReadingKey, } from './image-reading-key.ts';
export {
  slicePictureContexts,
  slicePictureNames,
  slicePictures,
  type SlicePictures,
} from './slice-pictures.ts';
export {
  isResumableReading,
  type ModelReading,
  type OcrReader,
  type PairedReading,
  readImagePair,
} from './image-reading-pair.ts';
export {
  readPastRefusal,
  REFUSAL_ASK_LIMIT,
} from './image-reading-past-refusal.ts';
export {
  characterTrigrams,
  CORROBORATION_TRIGRAM_SHARE,
  type CorroborationVerdict,
  readingsCorroborate,
  trigramOverlap,
} from './reading-corroboration.ts';
export {
  photoPath,
  type PhotoReference,
  photoReferences,
} from './photo-reference.ts';
export {
  quoteBlockCount,
  topLevelBlocks,
} from './markdown-blocks.ts';
export {
  dropsQuotedPassage,
  quoteLossRefusalFinding,
} from './quote-preservation.ts';
export {
  restoreTargetOnlyRun,
  splitTargetOnlyRun,
  type TargetOnlySplit,
} from './target-only-run.ts';
export { wrapTranslateRecords, } from './translate-wrap.ts';

//endregion Translate barrel
