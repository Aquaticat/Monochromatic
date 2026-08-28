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
export { assertFinalNaturalnessComplete, } from './corpus-run/final-naturalness-completeness.ts';
export {
  assertFinalSelectionSettled,
  UnsettledFinalSelectionError,
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
export { preparePassEntry, } from './corpus-run/pass-prepare.ts';

//endregion Corpus readiness barrel
