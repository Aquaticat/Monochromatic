//region Stage barrel
// The fan-out machinery every model-facing stage is built on: one call, one
// round, and the quorum loop over rounds.
//
// Split from `pipeline-barrel.ts` because that file sits at its line budget,
// and because these three are the shared substrate rather than stages of the
// repair pipeline in particular.

export {
  assertUnheardKeptArchive,
  heardNobodyAbout,
  RepairUnheardError,
  type RepairVoiceRecord,
  type UnheardClaim,
} from './repair-unheard.ts';
export {
  attemptStageCall,
  type StageVoice,
} from './stage-call.ts';
export {
  gatherStageVoices,
  type HeardVoice,
  STAGE_RETRY_ROUNDS,
  type StageGather,
} from './stage-quorum.ts';
export {
  repeatedRosterIds,
  StageRosterRepeatError,
} from './stage-roster-repeat.ts';
export {
  CUT_SHORT_RECOVERY_NUDGE,
  OFF_SHAPE_RECOVERY_NUDGE,
  RECOVERY_NUDGES,
  UNREADABLE_CAUSES,
  type UnreadableCause,
  unreadableCauseOf,
} from './recovery-nudge.ts';
export {
  runRecoveryRound,
  type SharedRoundRequest,
} from './stage-recovery-round.ts';
export {
  askingWindow,
  benchRotation,
  FANOUT_SPARE,
  type FanOutMode,
  firstRoundWindow,
  rotatedBench,
} from './stage-fanout-window.ts';
export {
  everyStageHeard,
  silentStagesOf,
  STAGE_QUORUM_UNMET_PREFIX,
  stageQuorumUnmetFinding,
} from './stage-silence.ts';
export {
  MIN_STAGE_VOICES,
  type ReachableQuorum,
  reachableQuorum,
  shortBenchStageFinding,
} from './stage-reachable-quorum.ts';
export { cacheRefusalsOf, } from './repair-cache-gate.ts';
export {
  adoptCalibrationGrace,
  CALIBRATION_STRAGGLER_GRACE_MS,
  type CalibrationGrace,
  graceOverrideNote,
  isTimerWindow,
  MAX_TIMER_DELAY_MS,
  readWindowDial,
  resolveStragglerGraceMs,
  STRAGGLER_GRACE_VAR,
} from './grace-override.ts';
export {
  readWriterGrace,
  resolveWriterGraceMs,
  WRITER_GRACE_MS,
  WRITER_GRACE_VAR,
  WRITER_STAGE_LABELS,
  type WriterGrace,
  writerGraceOverrideNote,
  writerRoundGraceMs,
} from './writer-grace-override.ts';
export {
  type RoundOutcome,
  runGatherRound,
  STRAGGLER_GRACE_MS,
} from './stage-round.ts';
export {
  roundLine,
  type RoundLineQuorum,
} from './stage-round-line.ts';
export { runWindowedRounds, } from './stage-windowed-rounds.ts';
export { UnpreparedSliceError, } from './unprepared-slice.ts';
export { allInInputOrder, } from './all-in-input-order.ts';
export {
  mapOverlapped,
  type OverlappedRow,
  OverlapRefusedError,
} from './overlapped-map.ts';
export {
  reuseTwinOrBuy,
  type TwinMemo,
  type TwinOrBought,
  type TwinStored,
} from './twin-memo.ts';

export {
  attemptDecisionCall,
  type StageDecision,
} from './stage-decision-call.ts';
//endregion Stage barrel
