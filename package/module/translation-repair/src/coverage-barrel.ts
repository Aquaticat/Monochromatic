//region Coverage barrel
// Coverage surface: the sheet asking whether the archive carries a passage,
// the stage that asks it, the verdict over its voices, and the page shortfall
// and tail readings that bound an insertion. Split from `translate-barrel.ts`,
// which sits at its line budget.

export {
  type CoverageAnswer,
  runCoverageStage,
} from './coverage-stage.ts';
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
  interiorShortfall,
  readUntranslatedTail,
  type UntranslatedTail,
} from './coverage-tail.ts';
export {
  buildCoverageMessages,
  COVERAGE_IDENTITY_RULE,
  COVERAGE_RESPONSE_FORMAT,
  type CoverageDegree,
  type CoverageFollowupEvidence,
  type CoveragePromptPlan,
  type CoverageReportWire,
  isCoverageReportWire,
} from './coverage-wire.ts';

//endregion Coverage barrel
