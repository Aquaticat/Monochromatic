//region Translate barrel
// Translate-lane surface: the translator sheet, candidate assembly, and the
// stage that renders a slice from its original and lets judges choose between
// the renderings and the translation already in the archive.
//
// Split from `pipeline-barrel.ts` because that file sits at its line budget and
// this lane is a whole pipeline shape rather than another stage inside the
// repair one.

export {
  buildTranslateCandidates,
  type TranslateCandidateSet,
  type TranslateCandidateValue,
  type TranslateOrigin,
} from './translate-candidates.ts';
export {
  runTranslateStage,
  type TranslateDecision,
  type TranslateStageResult,
} from './translate-stage.ts';
export {
  buildTranslateMessages,
  isTranslateReportWire,
  TRANSLATE_RESPONSE_FORMAT,
  type TranslatePromptPlan,
  type TranslateReportWire,
} from './translate-wire.ts';

//endregion Translate barrel
