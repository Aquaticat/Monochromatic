//region Probe barrel
// Introduced-defect surface: the differential prompt and its wire guards, the
// deterministic screen that decides what a quote proves, and the shadow-mode
// stage. Split from the pipeline barrel so each stays under the file-size
// budget.

export {
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
  flattenSpace,
  type RegionDefectTally,
  screenEvidence,
  screenIntroducedDefects,
  type ScreenedDefectClaim,
} from './introduced-defect-screen.ts';
export {
  EMPTY_INTRODUCED_DEFECT_REPORT,
  type IntroducedDefectReport,
  runIntroducedDefectProbe,
} from './introduced-defect-probe.ts';
export {
  buildRenderingAuditMessages,
  CANDIDATE_ONLY_CATEGORIES,
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
export {
  anchorQuote,
  type QuoteAnchor,
  screenRenderingAudit,
  type ScreenedFinding,
  type ScreenedReport,
} from './rendering-audit-screen.ts';
export {
  type AuditVoiceRow,
  type CorroboratedDefect,
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
  corroboratedCount,
  corroboratingProberCount,
  judgeRegionProbe,
  type ProbeTelemetrySummary,
  type RegionProbeVerdict,
  summarizeProbeTelemetry,
} from './probe-telemetry.ts';

//endregion Probe barrel
