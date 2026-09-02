//region Corpus readiness barrel
// Fail-closed boundaries used before an entry can become a published artifact.
// Split from corpus barrel at its line budget.

export { assertCarriedInsertionsRemain, } from './corpus-run/carried-insertion-completeness.ts';
export {
  assertDestinationsComplete,
  DroppedDestinationError,
} from './corpus-run/destination-completeness.ts';
export {
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
} from './archive-block-evidence.ts';
export {
  type ArchiveBlockReviewOutcome,
  runArchiveBlockReviewStage,
} from './archive-block-review-stage.ts';
export {
  archiveBlockIdentity,
  repairArchiveBlocks,
} from './corpus-run/archive-block-repair.ts';
export { archiveBlockSourceContexts, } from './corpus-run/archive-block-source-context.ts';
export {
  assertPublishableTranslation,
  UnfilledPageError,
  unfilledPageFindings,
} from './corpus-run/publish-completeness.ts';
export { assertFinalNaturalnessComplete, } from './corpus-run/final-naturalness-completeness.ts';
export {
  finalSelectionFindings,
} from './corpus-run/final-selection-completeness.ts';
export {
  assertContributorNamesComplete,
  ContributorCompletenessError,
} from './corpus-run/contributor-completeness.ts';
export {
  assertFrontMatterComplete,
  FrontMatterCompletenessError,
} from './corpus-run/front-matter-completeness.ts';
export { persistSettledEntry, } from './corpus-run/pass-entry-persist.ts';
export {
  assertVisualEvidenceComplete,
  VisualEvidenceInterruptedError,
} from './corpus-run/visual-evidence-completeness.ts';
export { preparePassEntry, } from './corpus-run/pass-prepare.ts';

//endregion Corpus readiness barrel
