//region Run setup exports
// Process identity, the repeat census, the report log reader, the required providers, the run configuration and the seats.
// Re-exported by `index.ts`, which is the package's one public entry.

export {
  type HostIdentity,
  hostIdentity,
  type HostRead,
  startTicksOf,
  startTicksOfStat,
  type StartTicksRead,
} from './corpus-run/process-identity.ts';
export {
  type ControlReading,
  controlReadingOf,
  coversAllLines,
  failedControlsOf,
  occupiedLinesOf,
} from './corpus-run/repeat-census-control.ts';
export {
  censusEntryOf,
  reportRepeatCensus,
} from './corpus-run/repeat-census-report.ts';
export {
  linesOfLog,
  readLogTexts,
  refuseRepeatedLogs,
} from './corpus-run/report-log-read.ts';
export {
  assertRequiredProvidersReady,
  readRequiredProviders,
  type RequiredProvider,
  RequiredProviderError,
} from './corpus-run/required-providers.ts';
export { type RunClient, } from './corpus-run/run-client-contract.ts';
export { RunConfigError, } from './corpus-run/run-config-error.ts';
export {
  createRunClient,
  OWNER_CULLED,
  readHeadSha,
  readRunCorpusPinSetting,
  RECALL_JUDGE_MODEL_IDS,
  resolveRunsDir,
  RUN_CALL_CONFIG,
  RUN_CHECKER_ORDER,
  RUN_DECISION_JUDGES,
  RUN_LATE_JUDGES,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_SELECT_JUDGES,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  RUN_WRITERS,
  runClientFrom,
  type RunRepairModels,
  TRANSLATOR_DROPPED,
  WRITER_UNMEASURED,
} from './corpus-run/run-config.ts';
export {
  belowFloorWritingBenches,
  benchesOf,
  PHASES_WITHOUT_WRITER_STOP,
  unreachableWritingBenches,
  WRITING_BENCH_FLOOR,
  WRITING_BENCHES,
  WritingBenchUnreachableError,
} from './corpus-run/run-seats-floor.ts';
export {
  readJudgeSeats,
  readPhaseSeats,
  type SeatReadingClient,
} from './corpus-run/run-seats-read.ts';
export {
  type BenchName,
  type JudgeSeatPhase,
  phaseBenches,
  reachableSeats,
  shortBenches,
} from './corpus-run/run-seats-wait.ts';
export {
  HYPER_SLOW_JUDGES,
  HYPER_SLOW_SELECT_JUDGES,
  type JudgeSeats,
  judgeSeatsFor,
} from './corpus-run/run-seats.ts';

//endregion Run setup exports
