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
  RECOVERY_NUDGE,
  STAGE_RETRY_ROUNDS,
  type StageGather,
} from './stage-quorum.ts';
export {
  everyStageHeard,
  silentStagesOf,
  STAGE_QUORUM_UNMET_PREFIX,
  stageQuorumUnmetFinding,
} from './stage-silence.ts';
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
export { UnpreparedSliceError, } from './unprepared-slice.ts';
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

//endregion Stage barrel
