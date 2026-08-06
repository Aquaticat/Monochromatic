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
  longestFenceRun,
  selectFence,
} from './prompt-fence.ts';
export {
  corroboratedCount,
  judgeRegionProbe,
  type ProbeTelemetrySummary,
  type RegionProbeVerdict,
  summarizeProbeTelemetry,
} from './probe-telemetry.ts';

//endregion Probe barrel
