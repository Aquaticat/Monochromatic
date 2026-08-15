//region Stage barrel
// The fan-out machinery every model-facing stage is built on: one call, one
// round, and the quorum loop over rounds.
//
// Split from `pipeline-barrel.ts` because that file sits at its line budget,
// and because these three are the shared substrate rather than stages of the
// repair pipeline in particular.

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
  type RoundOutcome,
  runGatherRound,
  STRAGGLER_GRACE_MS,
} from './stage-round.ts';

//endregion Stage barrel
