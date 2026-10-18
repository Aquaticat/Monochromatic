//region Public index
// The names `@monochromatic-dev/translation-repair-run` gives its siblings and its own tests, each from the module that declares it.
// Production siblings import it through `/ts`; tests and fixtures through the built entry, so a process loads one copy.

export { nodeEntries, } from './build-entries.ts';
export {
  type ProviderKeys,
  readProviderKeys,
} from './corpus-run/budget-sample-keys.ts';
export { sampleBudgets, } from './corpus-run/budget-sample-run.ts';
export { capCensusPassRunReading, } from './corpus-run/cap-census-pass-run.ts';
export {
  capCensusProviderLine,
  type CapCensusTally,
  printCapCensus,
} from './corpus-run/cap-census-print.ts';
export {
  type CapLogReading,
  CAPS_ON_WIRE_AT,
  type CapSample,
  readCapLog,
} from './corpus-run/cap-census-read.ts';
export { reportCapCensus, } from './corpus-run/cap-census-report.ts';
export {
  type CapCensus,
  capCensus,
  type CapCensusRow,
  type CapFlag,
  capFlagsOf,
  type ProviderCapReading,
} from './corpus-run/cap-census-rule.ts';
export { capCensusLogsUnder, } from './corpus-run/cap-census-walk.ts';
export {
  capOutlastsOneCall,
  capTooTightNote,
  HARD_CAP_VAR,
  HardCapOverrideError,
  resolveHardCapMinutes,
} from './corpus-run/cap-override.ts';
export { reportingRefusals, } from './corpus-run/cli-refusal.ts';
export {
  askedAmong,
  idListFlag,
  wholeNumberFlag,
  writtenOr,
} from './corpus-run/command-flags.ts';
export {
  type CommandLineFor,
  type CommandLineSpec,
  type FlagValue,
  type PositionalSpec,
  type ReadsFlag,
  type ReadsSwitch,
} from './corpus-run/command-line-types.ts';
export { readCommandLine, } from './corpus-run/command-line.ts';
export {
  COMMAND_OWNERS,
  taskPathOf,
} from './corpus-run/command-owners.ts';
export {
  COMMAND_LINES,
  type CommandLineOf,
  type CommandName,
} from './corpus-run/command-lines.ts';
export {
  CORPUS_CLONE_DIR_VAR,
  CORPUS_COMMIT_VAR,
  corpusPinOverrideNote,
  type CorpusPinSetting,
  type CorpusPinSource,
  readCorpusPinSetting,
} from './corpus-run/corpus-pin-override.ts';
export { readOnlyIds, } from './corpus-run/entry-filter.ts';
export {
  type CreditRates,
  creditsFor,
  HYPER_PRICE_READ_ON,
  ratesFor,
} from './corpus-run/hyper-price.ts';
export {
  type LedgerReading,
  readLedgerDirectory,
  refusalOf,
  type RefusedFile,
} from './corpus-run/ledger-directory.ts';
export {
  LedgerShapeError,
  parseLedgerRound,
  type ReadBallot,
  type ReadCandidate,
  type ReadRound,
} from './corpus-run/ledger-parse.ts';
export {
  type CandidateReading,
  type LedgerSummary,
  type ModelWork,
  summariseLedger,
  workOfModel,
} from './corpus-run/ledger-read.ts';
export {
  printReading,
  printRefusals,
  printSeat,
  printSummary,
} from './corpus-run/ledger-report-print.ts';
export { reportLedger, } from './corpus-run/ledger-report-run.ts';
export {
  countStates,
  type DrySpan,
  drySpans,
  dutyCycle,
  longestDrySpan,
  seriesFor,
  type StateCounts,
} from './corpus-run/meter-dry-span.ts';
export { levelLines, } from './corpus-run/meter-report-level.ts';
export { reportProvider, } from './corpus-run/meter-report-provider.ts';
export {
  mergeSamples,
  reportMeters,
} from './corpus-run/meter-report-run.ts';
export {
  outageLines,
  spanText,
  stampText,
} from './corpus-run/meter-report-text.ts';
export {
  type MeterLogReading,
  type MeterSample,
  readMeterLine,
  readMeterLog,
} from './corpus-run/meter-sample-read.ts';
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
export {
  type CallReading,
  type CallTiming,
  readCallTiming,
  readRoundTiming,
  type RoundReading,
  type RoundTiming,
  STREAM_MARKER,
  TimingFieldError,
  TimingLineError,
} from './corpus-run/run-timing-parse.ts';
export {
  type InFlight,
  measureInFlight,
  NothingInFlightError,
  readRunTiming,
  type RunTiming,
  summariseRounds,
} from './corpus-run/run-timing-read.ts';
export {
  asSpan,
  printInFlight,
  printRounds,
} from './corpus-run/run-timing-report-print.ts';
export { reportRunTiming, } from './corpus-run/run-timing-report-run.ts';
export {
  defaultRunsDirIn,
  prepareRunsLayout,
  PROMPT_PAYLOADS_DIR,
  RUNS_DIR_NAME,
  type RunsLayout,
  SLICE_CACHE_DIR,
} from './corpus-run/runs-layout.ts';
export {
  holderLiveness,
  lockFileText,
} from './corpus-run/runs-lock-holder.ts';
export {
  evictStaleLock,
  lockRunsDir,
  releaseIfOwned,
  RunsDirectoryBusyError,
} from './corpus-run/runs-lock.ts';
export {
  resolveSpendCeilingUsd,
  SPEND_CEILING_PROVIDER,
  SPEND_CEILING_USD,
  SPEND_CEILING_VAR,
  spendCeilingNote,
  SpendCeilingOverrideError,
  spendCeilingOverrideNote,
  spendCeilingReached,
} from './corpus-run/spend-ceiling.ts';
export {
  type PricedSeat,
  priceTally,
  type SpendCost,
} from './corpus-run/spend-cost.ts';
export {
  readSpendLine,
  type SeatSpend,
  type SpendCount,
  type SpendLineReading,
  type SpendRecord,
  type SpendTally,
  type SpendUsd,
  tallySpend,
} from './corpus-run/spend-read.ts';
export {
  asCredits,
  asUsd,
  pricedLine,
  tokensOnlyLine,
  usdLine,
} from './corpus-run/spend-report-line.ts';
export { printCost, } from './corpus-run/spend-report-print.ts';
export { reportSpendCost, } from './corpus-run/spend-report-run.ts';
export {
  consistencyColumnOf,
  type JudgedEntry,
  judgePublishedEntry,
} from './corpus-run/verify-published-entry.ts';
export {
  judgePublishedEntries,
  verifyPublishedRun,
} from './corpus-run/verify-published-run.ts';
export { refusingCulledSeats, } from './culled-seat-guard.ts';
export {
  createDecisionsClient,
  OPENROUTER_DECISIONS_URL,
} from './decisions-client.ts';
export {
  type FidelityBallotRead,
  type FidelityDirection,
  type FidelityOutcome,
  type FidelityTrial,
  runFidelityTrial,
} from './judge-fidelity.ts';
export {
  indexReadingsByIssue,
  ProbeIssueIndexError,
} from './probe-issue-index.ts';

//endregion Public index
