//region Corpus readiness barrel
// Fail-closed boundaries used before an entry can become a published artifact.
// Split from corpus barrel at its line budget.

export {
  assertPublishableTranslation,
  UnfilledPageError,
} from './corpus-run/publish-completeness.ts';
export {
  assertArchiveReviewed,
  UnreviewedArchiveError,
} from './corpus-run/unreviewed-archive.ts';
export {
  assertFinalSelectionSettled,
  UnsettledFinalSelectionError,
} from './corpus-run/final-selection-completeness.ts';

//endregion Corpus readiness barrel
