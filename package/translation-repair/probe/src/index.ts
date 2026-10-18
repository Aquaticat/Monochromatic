//region Public index
// The names `@monochromatic-dev/translation-repair-probe` gives its siblings and its own tests, each from the module that declares it.
// Production siblings import it through `/ts`; tests and fixtures through the built entry, so a process loads one copy.

export {
  attributionEntryOf,
  type AttributionGather,
  gatherAttributionEntries,
  type MalformedArtifact,
} from './corpus-run/attribution-read.ts';
export {
  type AcceptedIssueView,
  type AttributionEntry,
  type AttributionReport,
  buildAttributionReport,
  type CriticTally,
  type ProposerView,
  type SliceCriticView,
} from './corpus-run/attribution-report.ts';
export {
  AUDIT_ARMS,
  SOURCE_TEXT as AUDIT_SOURCE_TEXT,
  ORACLE_CANDIDATE_SPAN,
  ORACLE_SOURCE_SPAN,
} from './corpus-run/audit-sensitivity-input.ts';
export {
  pointsAtOracle,
  shownText,
  sightedVoices,
} from './corpus-run/audit-sensitivity-oracle.ts';
export {
  armLines,
  keptLine,
  voiceLines,
} from './corpus-run/audit-sensitivity-print.ts';
export { runAuditSensitivity, } from './corpus-run/audit-sensitivity-run.ts';
export {
  collectTwoLaneShippedRegions,
  DAMAGE_LANES,
  type DamageLane,
  DamageRegionError,
  regionIdOf,
  regionsOfLane,
  type ShippedRegion,
  type ShippedRegionCensus,
} from './corpus-run/damage-region-v2.ts';
export {
  buildCase,
  drawRegions,
} from './corpus-run/damage-sample-draw.ts';
export {
  emptyPoolSays,
  poolLines,
  wroteLine,
} from './corpus-run/damage-sample-lines.ts';
export { collectShippedRegions, } from './corpus-run/damage-sample-pool.ts';
export { sampleDamage, } from './corpus-run/damage-sample-run.ts';
export {
  type BandedEntry,
  type EntryContribution,
  loadEntry,
} from './corpus-run/draw-entry-load.ts';
export {
  type DrawOutputs,
  trackDrawOutputs,
} from './corpus-run/draw-outputs.ts';
export {
  DrawReconcileError,
  type DrawReconcileFault,
  reconcileSentence,
  type TypeofName,
} from './corpus-run/draw-reconcile.ts';
export { poolBandLines, } from './corpus-run/draw-sample-bands.ts';
export {
  type DrawPool,
  readDrawPool,
} from './corpus-run/draw-sample-pool.ts';
export { drawGradingSample, } from './corpus-run/draw-sample-run.ts';
export {
  type DrawPaths,
  writeDrawSheets,
} from './corpus-run/draw-sample-sheets.ts';
export {
  buildCrosscheckCensus,
  type CrosscheckArm,
  type CrosscheckCensus,
  type CrosscheckItem,
  statusBreakdown,
} from './corpus-run/judge-crosscheck.ts';
export {
  DAMAGE_KINDS,
  DEFAULT_TRIAL_CAP,
  readFidelityArguments,
} from './corpus-run/judge-fidelity-args.ts';
export {
  type BoundedFidelityMatrix,
  boundFidelityMatrix,
  fidelityJudgedLine,
  fidelityKeptLine,
  fidelityKeptRun,
  fidelityPartialWarning,
  type FidelityPlan,
  fidelityPlan,
  type FidelityPlannedRow,
  fidelityPreflightLine,
  type FidelityRowResult,
  fidelityRowResult,
} from './corpus-run/judge-fidelity-probe-plan.ts';
export {
  type FidelityProbeSink,
  runFidelityProbe,
} from './corpus-run/judge-fidelity-probe-run.ts';
export {
  type JudgeSeating,
  MIN_JUDGED_CLAIMS,
  seatJudges,
} from './corpus-run/judge-independence.ts';
export {
  probeRosterWith,
  readCandidateIds,
  readCandidatesAlone,
} from './corpus-run/probe-candidates.ts';
export {
  type ArtifactRecord,
  readArtifactRecords,
} from './corpus-run/probe-relabel-artifact.ts';
export {
  DAMAGED_CASES,
  gatherRelabelCases,
  locateSlice,
  type RelabelCase,
} from './corpus-run/probe-relabel-case.ts';
export { gatherControlCases, } from './corpus-run/probe-relabel-control.ts';
export {
  otherDisclosure,
  probePair,
} from './corpus-run/probe-relabel-pair.ts';
export {
  relabelCaseLines,
  relabelClaimLines,
  relabelCounts,
  relabelGathered,
  relabelNotes,
  relabelRebuilt,
} from './corpus-run/probe-relabel-print.ts';
export { runProbeRelabel, } from './corpus-run/probe-relabel-run.ts';
export { nowAsIso, } from './corpus-run/probe-run-clock.ts';
export {
  type IssueLabel,
  type PriorIssueList,
  PRODUCTION_LIST,
  SENSITIVITY_ARMS,
  type SensitivityArm,
} from './corpus-run/probe-sensitivity-arms.ts';
export {
  sensitivityArmLines,
  sensitivityNotes,
  sensitivityOpening,
} from './corpus-run/probe-sensitivity-print.ts';
export { runSensitivity, } from './corpus-run/probe-sensitivity-run.ts';
export { singleRegionTally, } from './corpus-run/probe-single-tally.ts';
export {
  persistProbeRun,
  type ProbeRun,
} from './corpus-run/probe-store.ts';
export {
  type GatheredProbe,
  reportProbeTelemetry,
} from './corpus-run/probe-telemetry-report.ts';
export {
  collectFlagged,
  keepAdmissible,
} from './corpus-run/probe-verify-collect.ts';
export {
  runProbeVerify,
  VERIFY_BLIND_NOTE,
  verifyOpening,
  verifyWrote,
} from './corpus-run/probe-verify-run.ts';
export {
  formatVerifyManifest,
  formatVerifySheet,
  orderBlind,
  type SheetFraming,
  type VerifyItem,
} from './corpus-run/probe-verify-sheet.ts';
export { chooseRecallEntries, } from './corpus-run/recall-benchmark-choose.ts';
export { seedRecallEntry, } from './corpus-run/recall-benchmark-entry.ts';
export {
  recallPlanLine,
  recallScorecardLines,
  recallStartLine,
  refuseUnmeasuredScorecard,
} from './corpus-run/recall-benchmark-report.ts';
export { runRecallBenchmark, } from './corpus-run/recall-benchmark-run.ts';
export {
  persistRecallScorecard,
  RECALL_SCORECARD_DIR,
  type RecallScorecardRecord,
} from './corpus-run/recall-scorecard-store.ts';
export {
  type AuditArguments,
  readAuditArguments,
  readReportArguments,
  type ReportArguments,
} from './corpus-run/rendering-audit-settled-args.ts';
export {
  type AuditRepeatBand,
  repeatBandOf,
} from './corpus-run/rendering-audit-settled-band.ts';
export {
  auditOne,
  capped,
  type CitedSubject,
  eligibleSubjects,
  printPopulation,
  withCitedReferences,
} from './corpus-run/rendering-audit-settled-buy.ts';
export {
  digestAuditedText,
  sameAuditedText,
  textIdentityOf,
} from './corpus-run/rendering-audit-settled-digest.ts';
export {
  runSettledAudit,
  settledArtifactRecord,
  settledBuyingLine,
} from './corpus-run/rendering-audit-settled-drive.ts';
export {
  readArchiveSubjects,
  readArtifactSubjects,
  type SettledArtifactReading,
  type SettledVerification,
} from './corpus-run/rendering-audit-settled-input.ts';
export {
  printBand,
  printRelations,
  printRelocations,
  printSplit,
  printVoices,
} from './corpus-run/rendering-audit-settled-print.ts';
export { printSettledRow, } from './corpus-run/rendering-audit-settled-progress.ts';
export {
  type AudienceSplit,
  type AuditRelocationPair,
  rateByVoice,
  splitFor,
  type VoiceRate,
} from './corpus-run/rendering-audit-settled-read.ts';
export {
  pageRelationFor,
  pageRelationLabel,
  pageRelationOf,
  type PageRelationTally,
  relationTallyOf,
  type SettledPageRelation,
} from './corpus-run/rendering-audit-settled-relation.ts';
export {
  auditRelocationPairs,
  distinctSlicePairs,
} from './corpus-run/rendering-audit-settled-relocation.ts';
export {
  type AuditRepeatPair,
  auditRepeatsAcross,
  type AuditRepeatSide,
  auditRepeatsWithin,
} from './corpus-run/rendering-audit-settled-repeat.ts';
export { runSettledReport, } from './corpus-run/rendering-audit-settled-report-run.ts';
export {
  type AuditedTextIdentity,
  type SettledAuditRow,
} from './corpus-run/rendering-audit-settled-row.ts';
export {
  newestRun,
  printAcross,
  readRunRows,
} from './corpus-run/rendering-audit-settled-runs.ts';
export {
  identityOf,
  type SettledAuditSubject,
  type SettledIdentity,
  type SettledReferences,
  subjectsOf,
} from './corpus-run/rendering-audit-settled-subject.ts';
export { listSettledNames, } from './corpus-run/sample-artifact-names.ts';
export {
  agreementRate,
  positionsOrNone,
  printAgreement,
  printPrecision,
} from './corpus-run/score-agreement-print.ts';
export {
  type FileReading,
  preGradeName,
  readNamedOrBeside,
  readOptional,
} from './corpus-run/score-agreement-read.ts';
export { printGradeReport, } from './corpus-run/score-agreement-run.ts';
export { requireArtifactsDir, } from './corpus-run/score-artifacts-dir.ts';
export { printAttribution, } from './corpus-run/score-attribution-run.ts';
export {
  attributionCriticLine,
  attributionHeaderLine,
} from './corpus-run/score-attribution-table.ts';
export {
  printMalformedArtifacts,
  printPartialJoinWarning,
  printUnattributedWarning,
} from './corpus-run/score-attribution-warnings.ts';
export {
  authorHeaderLine,
  authorLine,
  type AuthorRow,
  tallyAuthors,
} from './corpus-run/score-crosscheck-authors.ts';
export { printCrosscheck, } from './corpus-run/score-crosscheck-run.ts';
export {
  printCrosscheckMalformed,
  printJoinFailureWarning,
  printUnjudgeableWarning,
} from './corpus-run/score-crosscheck-warnings.ts';
export {
  countRefinedJoined,
  joinProbeGrades,
  printProbeAgreement,
} from './corpus-run/score-probe-agreement.ts';
export { gatherProbeReadings, } from './corpus-run/score-probe-gather.ts';
export { printProbeScore, } from './corpus-run/score-probe-run.ts';
export { readSheetText, } from './corpus-run/score-sheet-text.ts';
export {
  parseVerifyManifest,
  readVerifyManifest,
  type VerifyManifestItem,
} from './corpus-run/score-verify-manifest.ts';
export { printVerifyScore, } from './corpus-run/score-verify-run.ts';
export {
  type KindTally,
  tallyByKind,
  verifyKindLines,
} from './corpus-run/score-verify-tally.ts';
export {
  buildReviewedFidelityReference,
  MIN_REVIEWED_REFERENCE_CHARS,
} from './fidelity-reference-build.ts';
export {
  FidelityReferenceError,
  type FidelityReferenceOperation,
} from './fidelity-reference-error.ts';
export { REVIEWED_FIDELITY_REFERENCES, } from './fidelity-reference-manifest.ts';
export {
  type FidelityExpectedDamage,
  type FidelityReferenceEdit,
  type FidelityReferenceSpan,
  type FidelityReferenceSpec,
  type ReviewedFidelityReference,
} from './fidelity-reference-model.ts';
export { readReviewedFidelityReferences, } from './fidelity-reference-read.ts';
export { reviewedFidelityRequest, } from './fidelity-reference-request.ts';
export { selectReviewedFidelitySpecs, } from './fidelity-reference-select.ts';
export {
  type ReviewedFidelityTrial,
  reviewedFidelityTrials,
} from './fidelity-reference-trials.ts';

//endregion Public index
