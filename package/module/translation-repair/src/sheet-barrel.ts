//region Sheet barrel
// Grading-sheet surface: reading a settled run's artifacts, drawing a
// stratified sample from them, rendering the sheets a human grades, and reading
// the verdicts back as precision and agreement. Everything here runs after a
// pass rather than inside one. Split from the pipeline barrel so each stays
// under the file-size budget.

export {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
  requireString,
} from './artifact-guard.ts';
export {
  GradedSheetExistsError,
  resolveSheetPath,
  type SheetKind,
  UnsafeSeedError,
} from './corpus-run/sheet-path.ts';
export {
  parseRecordRepair,
  type RecordRepairReading,
} from './artifact-repair-read.ts';
export {
  type ParsedAcceptedIssue,
  type ParsedArtifact,
  parseSettledArtifact,
} from './artifact-read.ts';
export { formatGradingSheet, } from './grading-sheet.ts';
export {
  type GradedItem,
  type GradeVerdict,
  parseGradedSheet,
} from './grade-sheet-read.ts';
export {
  type GradedRepairItem,
  parseGradedRepairSheet,
  type RepairVerdict,
} from './repair-grade-read.ts';
export {
  opensWithVerdict,
  trimLeadingDelimiters,
  VERDICT_DELIMITERS,
} from './verdict-letter.ts';
export {
  type AgreementTally,
  parsePreGrades,
  type PrecisionTally,
  scoreGradeAgreement,
  scoreGradedPrecision,
} from './grade-agreement.ts';
export { formatRepairSheet, } from './repair-sheet.ts';
export {
  bandOf,
  countSettledPerBand,
  MEDIUM_PAGE_BYTES,
  rankWithinBands,
  type SizedEntry,
  smallBandIds,
  SMALL_PAGE_BYTES,
} from './corpus-run/band-order.ts';
export {
  allocateBandQuota,
  drawStratifiedSample,
} from './sample-draw.ts';
export {
  buildSampleManifest,
  parseSampleManifest,
  type SampleManifest,
  type SampleManifestItem,
} from './sample-manifest.ts';
export {
  assertRepairMeasurable,
  type BandQuota,
  classifyBand,
  countUnrecordedRepairs,
  UnmeasurableRepairError,
  DEFAULT_PRECISION_BAR,
  DEFAULT_SAMPLE_SEED,
  DEFAULT_SAMPLE_SIZE,
  extractGradingCandidate,
  type GradableClaim,
  type GradableIssue,
  type GradableRepair,
  type GradableRepairRegion,
  type GradableSpan,
  type GradingCandidate,
  MEDIUM_BAND_MAX_BYTES,
  SIZE_BANDS,
  type SizeBand,
  SMALL_BAND_MAX_BYTES,
} from './sample-grading.ts';

//endregion Sheet barrel
