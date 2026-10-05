//region Corpus readiness barrel
// Fail-closed boundaries used before an entry can become a published artifact.
// Split from corpus barrel at its line budget.

export { assertCarriedInsertionsRemain, } from './corpus-run/carried-insertion-completeness.ts';
export { assertPageFootnotesIntact, } from './corpus-run/page-footnote-integrity.ts';
export { assertPageGuards, } from './corpus-run/pass-page-guards.ts';
export { guardPageAssembly, } from './corpus-run/page-assembly-guard.ts';
export {
  freshlyTakenBack,
  type RoundTakeBacks,
} from './corpus-run/page-assembly-rounds.ts';
export { restoreContributorNames, } from './corpus-run/contributor-name-restore.ts';
export { placeHandleGlosses, } from './corpus-run/handle-gloss-place.ts';
export {
  carriesRendering,
  handleReading,
  withoutGloss,
} from './corpus-run/handle-reading.ts';
export { unifyHeadingSeries, } from './corpus-run/heading-series-unify.ts';
export { headingTitles, } from './corpus-run/heading-title-lines.ts';
export {
  pageTextBySlice,
  pageTextOf,
  SliceNotOnPageError,
} from './corpus-run/assembly-page-text.ts';
export {
  NO_NUMBER,
  type OrdinalStyle,
  readHanNumeral,
  readOrdinalStyle,
  renderOrdinal,
  styleKey,
} from './corpus-run/ordinal-style.ts';
export { restoreJsxAttributes, } from './corpus-run/jsx-attribute-restore.ts';
export { restoreArchiveCasing, } from './corpus-run/archive-casing-restore.ts';
export { restoreArchiveNameCasing, } from './corpus-run/archive-name-casing.ts';
export {
  correctPinyinPage,
  correctPinyinTones,
} from './corpus-run/pinyin-tone.ts';
export {
  canadianizePage,
  canadianizeText,
} from './corpus-run/canadian-forms.ts';
export { protectedRanges, } from './corpus-run/prose-ranges.ts';
export { restoreListSpread, } from './corpus-run/list-spread-restore.ts';
export {
  applySpanRewrites,
  type SpanRewrite,
} from './corpus-run/span-rewrites.ts';
export { restoreNameGlossLines, } from './corpus-run/name-gloss-restore.ts';
export { unifyQuoteStyle, } from './corpus-run/quote-style-unify.ts';
export { unwrapBlockquoteQuotes, } from './corpus-run/blockquote-quote-unify.ts';
export { restoreArchiveItalicTitles, } from './corpus-run/archive-italic-title-restore.ts';
export {
  type EmphasisSpan,
  emphasisSpans,
  oneLine,
} from './corpus-run/emphasis-spans.ts';
export {
  replacedDestinations,
  restoreArchiveDestinations,
} from './corpus-run/archive-destination-restore.ts';
export { unifyTitleReferences, } from './corpus-run/title-reference-unify.ts';
export { settledPageArtifact, } from './corpus-run/pass-page-assembly.ts';
export {
  assertDestinationsComplete,
  DroppedDestinationError,
  traceDroppedDestinations,
} from './corpus-run/destination-completeness.ts';
export {
  assertHeadingsStayDistinct,
  CollapsedHeadingError,
} from './corpus-run/heading-distinctness.ts';
export {
  assertPageParses,
  UnparseablePageError,
} from './corpus-run/page-grammar.ts';
export {
  archiveFrontMatterStands,
  frontMatterAuthorityOf,
} from './corpus-run/archive-front-matter.ts';
export {
  directoryIdNameStands,
  namesDirectoryId,
} from './corpus-run/directory-id-name.ts';
export {
  isArchiveReferenceQuoteAnchored,
  isArchiveSourceQuoteAnchored,
  isVerifiableEditorialArchiveBlock,
} from './archive-block-evidence.ts';
export {
  type ArchiveBlockReviewOutcome,
  runArchiveBlockReviewStage,
} from './archive-block-review-stage.ts';
export {
  ARCHIVE_BLOCK_DECLINE_CONSEQUENCE,
  ARCHIVE_BLOCK_IDENTITY_RULE,
  ARCHIVE_BLOCK_REVIEW_RESPONSE_FORMAT,
  ARCHIVE_BLOCK_SELECTION_CRITERIA,
  ARCHIVE_BLOCK_SELECTION_TASK,
  buildArchiveBlockReviewMessages,
  isArchiveBlockReviewWire,
} from './archive-block-review-wire.ts';
export {
  archiveBlockSelectionEvidence,
  withArchiveOriginal,
} from './archive-block-selection-evidence.ts';
export {
  BlockOutsideArchiveError,
  revisionFootnoteFindings,
} from './archive-revision-footnotes.ts';
export {
  REVISION_SHAPE_REFUSED,
  revisionShapeFindings,
} from './archive-revision-shape.ts';
export {
  archiveBlockIdentity,
  repairArchiveBlocks,
} from './corpus-run/archive-block-repair.ts';
export { archiveBlockSourceContexts, } from './corpus-run/archive-block-source-context.ts';
export { unfilledPageFindings, } from './corpus-run/publish-completeness.ts';
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
  ArchiveOriginalCompletenessError,
  assertArchiveOriginalComplete,
} from './corpus-run/archive-original-completeness.ts';
export {
  assertVisualEvidenceComplete,
  VisualEvidenceInterruptedError,
} from './corpus-run/visual-evidence-completeness.ts';
export { preparePassEntry, } from './corpus-run/pass-prepare.ts';
export {
  outsideReadsFrom,
  type PassCorpusNameReader,
  type PassOutsideReads,
  type PassReferenceReader,
  type PassWorkTitleReader,
  RUN_OUTSIDE_READS,
} from './corpus-run/pass-outside-reads.ts';
export { attestPassReferences, } from './corpus-run/pass-attest-references.ts';
export {
  type LanesSeating,
  runPassLanes,
} from './corpus-run/pass-lanes.ts';
export { createPassPictureReader, } from './corpus-run/pass-seated-pictures.ts';
export { type PassPictureSources, } from './corpus-run/pass-visual-evidence.ts';
export {
  ocrReaderOver,
  type ProgramRunner,
  runInstalledProgram,
} from './image-ocr.ts';
export { MIN_READING_CHARS, } from './image-reading-sense.ts';
export { pairedPageNames, } from './page-name-glossary.ts';
export {
  type RepeatedTitleSpan,
  repeatedTitleSpans,
} from './page-title-spans.ts';
export {
  buildPageTitleLexiconMessages,
  isPageTitleLexiconWire,
  PAGE_TITLE_IDENTITY_RULE,
  PAGE_TITLE_LEXICON_RESPONSE_FORMAT,
} from './page-title-lexicon-wire.ts';
export { pageIdentityLines, } from './page-identity-lines.ts';
export {
  type PageTitleLexicon,
  pageTitleLines,
  type SettledPageTitle,
  settlePageTitles,
} from './page-title-lexicon-stage.ts';
export { PAGE_TITLE_CACHE_VERSION, } from './page-title-cache-version.ts';
export {
  openPageTitleCache,
  pageTitleKey,
  type PageTitleLexiconRecord,
  passPageTitles,
  type PassPageTitles,
} from './corpus-run/pass-page-titles.ts';

//endregion Corpus readiness barrel
