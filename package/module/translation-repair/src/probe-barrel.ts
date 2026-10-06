//region Probe barrel
// Introduced-defect surface: the differential prompt and its wire guards, the
// deterministic screen that decides what a quote proves, and the shadow-mode
// stage. Split from the pipeline barrel so each stays under the file-size
// budget.

export {
  PRODUCTION_PRIOR_ISSUE_DISCLOSURE,
  buildIntroducedDefectMessages,
  INTRODUCED_DEFECT_RESPONSE_FORMAT,
  INTRODUCED_DEFECT_VERDICTS,
  type IntroducedDefectCheckWire,
  type IntroducedDefectPromptPlan,
  type IntroducedDefectReportWire,
  type IntroducedDefectVerdict,
  isIntroducedDefectReportWire,
  isIntroducedDefectVerdict,
  type ProbedEditKind,
} from './introduced-defect-wire.ts';
export {
  type ClaimAdmissibility,
  type RegionDefectTally,
  resolveProberChecks,
  type ResolvedProberChecks,
  screenEvidence,
  screenIntroducedDefects,
  type ScreenedDefectClaim,
} from './introduced-defect-screen.ts';
export {
  flattenSpace,
  indentContinuation,
} from './sheet-line-text.ts';
export {
  EMPTY_INTRODUCED_DEFECT_REPORT,
  type IntroducedDefectReport,
  runIntroducedDefectProbe,
} from './introduced-defect-probe.ts';
export {
  damageClaimLinesBySlice,
  type ProbedChunk,
} from './repair-damage-evidence.ts';
export {
  CANDIDATE_ONLY_CATEGORIES,
  FINDING_FIELDS,
  isRenderingAuditReportWire,
  PAIRED_CATEGORIES,
  RENDERING_AUDIT_CATEGORIES,
  RENDERING_AUDIT_RESPONSE_FORMAT,
  RENDERING_AUDIT_VERDICTS,
  type RenderingAuditCategory,
  type RenderingAuditFindingWire,
  type RenderingAuditReportWire,
  type RenderingAuditSubject,
  type RenderingAuditVerdict,
  SOURCE_ONLY_CATEGORIES,
} from './rendering-audit-wire.ts';
export { buildRenderingAuditMessages, } from './rendering-audit-prompt.ts';
export {
  type AnchoredSpan,
  anchorLocatedSpan,
  type RenderingAuditSpanAnchor,
} from './rendering-audit-anchor.ts';
export {
  quotesRequired,
  screenRenderingAudit,
  type ScreenedFinding,
  type ScreenedReport,
  type SideReading,
} from './rendering-audit-screen.ts';
export {
  type AuditMemberClaim,
  CORROBORATION_VOICES,
  corroborate,
  corroborateByOverlap,
  type CorroboratedDefect,
  type OverlapAgreement,
  nearMisses,
  type NearMiss,
} from './rendering-audit-corroborate.ts';
export {
  type AuditVoiceRow,
  type RenderingAuditReport,
  runRenderingAudit,
} from './rendering-audit.ts';
export {
  longestFenceRun,
  selectFence,
} from './prompt-fence.ts';
export {
  type ArtifactProbeReading,
  type OwnedProbeReading,
  readArtifactProbe,
} from './artifact-probe-read.ts';
export { parseRegionTally, } from './artifact-probe-tally.ts';
export {
  type RepairLaneRecords,
  repairLaneRecordsOf,
} from './artifact-repair-lane-records.ts';
export {
  type StageRosterCoverage,
  summarizeStageRoster,
} from './stage-roster.ts';
export {
  type ProbeClaimAttribution,
  type TelemetryProbeReading,
  type TelemetryRegionTally,
} from './probe-attribution.ts';
export {
  type ProbeAgreement,
  type ProbeAgreementItem,
  probeFlaggedIssue,
  scoreProbeAgainstGrades,
} from './probe-agreement.ts';
export {
  corroboratingProberCount,
  judgeRegionProbe,
  ProbeTelemetryError,
  type ProbeTelemetrySummary,
  type RegionProbeVerdict,
  summarizeProbeTelemetry,
} from './probe-telemetry.ts';
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
export {
  type IssueLabel,
  type PriorIssueList,
  PRODUCTION_LIST,
  SENSITIVITY_ARMS,
  type SensitivityArm,
} from './corpus-run/probe-sensitivity-arms.ts';
export { gatherControlCases, } from './corpus-run/probe-relabel-control.ts';
export { nowAsIso, } from './corpus-run/probe-run-clock.ts';
export { singleRegionTally, } from './corpus-run/probe-single-tally.ts';
export {
  sensitivityArmLines,
  sensitivityNotes,
  sensitivityOpening,
} from './corpus-run/probe-sensitivity-print.ts';
export { runSensitivity, } from './corpus-run/probe-sensitivity-run.ts';
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
export {
  ABSENT_ISSUE,
  ALL_FIXED_PATCHED_TEXT,
  ALL_FIXED_SOURCE_TEXT,
  DEFECTIVE_TEXT,
  MEANING_ISSUE,
  MIXED_SHEET_PATCHED_TEXT,
  SINGLE_ISSUE_CASES,
  SOURCE_TEXT as CHECKER_SOURCE_TEXT,
  TENSE_ISSUE,
} from './corpus-run/checker-sensitivity-input.ts';
export {
  CHECKER_NOTE,
  sheetCheckLine,
  singleCheckLine,
} from './corpus-run/checker-sensitivity-print.ts';
export {
  checkAllFixedSheet,
  checkMixedSheet,
  checkOne,
  runCheckerSensitivity,
} from './corpus-run/checker-sensitivity-run.ts';
export {
  collectFlagged,
  keepAdmissible,
} from './corpus-run/probe-verify-collect.ts';
export {
  runProbeVerify,
  verifyOpening,
  VERIFY_BLIND_NOTE,
  verifyWrote,
} from './corpus-run/probe-verify-run.ts';
export {
  formatVerifyManifest,
  formatVerifySheet,
  type SheetFraming,
  orderBlind,
  type VerifyItem,
} from './corpus-run/probe-verify-sheet.ts';
// THE WRITER OF A SHEET AND ITS MANIFEST sits here beside the sheet it writes
// for: it left `corpus-barrel.ts` when that file reached its line budget, and
// the probes and samples that write a graded sheet are who asks for it.
export {
  assertSheetPairFree,
  writeSheetPair,
} from './corpus-run/sheet-write.ts';

//endregion Probe barrel
