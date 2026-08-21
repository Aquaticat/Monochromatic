//region Pairing barrel
// Everything that decides WHICH paragraph renders which, which is the input
// every later stage reasons from.
//
// Split out of `pipeline-barrel.ts` when the pairing stage pushed that file past
// its line budget. Grouping by question rather than by stage is what makes it a
// barrel rather than a spill: the sheet that asks, the reader that refuses, the
// round that gathers agreement, and the conversion into the vocabulary the
// grouper already reads all answer one question no other stage can.

export {
  declinedTargetBlocks,
  declinedTargetIds,
  declinedTargetIdsOfPairing,
} from './declined-target-runs.ts';
export { blockPairingToSteps, } from './pair-blocks-steps.ts';
export {
  type BlockPairingOutcome,
  pairBlocksWithRoster,
} from './pair-blocks-stage.ts';
export {
  type BlockPair,
  BlockPairingError,
  type BlockPairingWire,
  buildBlockPairingMessages,
  isBlockPairingWire,
  type NumberedBlock,
  readBlockPairing,
} from './pair-blocks-wire.ts';

//endregion Pairing barrel
export {
  contestLaneSlice,
  LANE_CONTEST_QUORUM,
  type LaneContestOutcome,
  settleLaneContestBallots,
} from './lane-contest-stage.ts';
export { contestDocumentLanes, } from './lane-contest-driver.ts';
export {
  LANE_CONTEST_CACHE_VERSION,
  laneContestRunShape,
  laneContestSliceKey,
} from './lane-contest-key.ts';
export {
  buildLaneContestMessages,
  isLaneContestWire,
  type LaneChoice,
  type LaneContestBallot,
  type LaneContestSubject,
  type LaneContestWire,
  readLaneContestBallot,
} from './lane-contest-wire.ts';
