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
export {
  alignmentRefusals,
  translateDocument,
} from './translate-document.ts';
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
  TRANSLATE_SELECTION_CRITERIA,
  TRANSLATE_SELECTION_TASK,
} from './translate-selection-sheet.ts';
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
  TRANSLATE_RESPONSE_FORMAT,
  type TranslatePromptPlan,
  type TranslateReportWire,
} from './translate-wire.ts';
export {
  type CoverageAnswer,
  runCoverageStage,
} from './coverage-stage.ts';
export {
  type DamageAttempt,
  deleteOneSentence,
  donorTextsFor,
  type FidelityDamageKind,
  insertBorrowedSentence,
} from './fidelity-damage.ts';
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
  buildCoverageMessages,
  COVERAGE_RESPONSE_FORMAT,
  type CoverageDegree,
  type CoveragePromptPlan,
  type CoverageReportWire,
  isCoverageReportWire,
} from './coverage-wire.ts';

//endregion Translate barrel
