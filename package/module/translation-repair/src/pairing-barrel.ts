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
  type BlockPairCounts,
  countPairedBlocks,
} from './pair-block-counts.ts';
export {
  type PairedPreparation,
  prepareDocumentPairWithRoster,
} from './prepare-with-pairing.ts';
export {
  admitInsertions,
  type CarriedInsertion,
  type InsertionAdmission,
} from './insertion-admission.ts';
export {
  type BlockPairingOutcome,
  pairBlocksWithRoster,
  type PairedSectionRecord,
} from './pair-blocks-stage.ts';
export {
  agreePairs,
  type IndexPair,
  type PairAgreement,
  type PairingShape,
} from './pair-agreement.ts';
export {
  claimMediaAdjacentTargets,
  type MediaAdjacentClaim,
} from './pair-media-adjacency.ts';
export {
  type SectionBlockPairing,
  sectionPairingsOf,
} from './section-pairing.ts';
export {
  isSectionPairingWire,
  readSectionPairing,
} from './pair-sections-read.ts';
export { sectionPairingToSteps, } from './pair-sections-steps.ts';
export {
  type PairedDocumentRecord,
  pairSectionsWithRoster,
  type SectionPairingOutcome,
} from './pair-sections-stage.ts';
export {
  buildSectionPairingMessages,
  type NumberedSection,
  type SectionPair,
  SectionPairingError,
  type SectionPairingWire,
} from './pair-sections-wire.ts';
export {
  buySectionPairing,
  type SectionRoundOutcome,
} from './prepare-section-round.ts';
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
  type ArchiveOutcome,
  contestLaneSlice,
  LANE_CONTEST_QUORUM,
  type LaneContestOutcome,
  settleArchiveBallots,
  settleLaneContestBallots,
} from './lane-contest-stage.ts';
export {
  applyLaneContestEligibility,
  frontMatterContestEligibility,
  type LaneContestEligibility,
  LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,
  laneContestChoiceMayShip,
  settleEligibleLaneContestBallots,
} from './lane-contest-eligibility.ts';
export {
  contestDocumentLanes,
  persistLaneContestOutcome,
} from './lane-contest-driver.ts';
export {
  LANE_CONTEST_CACHE_VERSION,
  laneContestRunShape,
  laneContestSliceKey,
} from './lane-contest-key.ts';
export {
  type ArchiveVerdict,
  buildLaneContestMessages,
  isLaneContestWire,
  type LaneChoice,
  type LaneContestBallot,
  type LaneContestSubject,
  type LaneContestWire,
  readLaneContestBallot,
} from './lane-contest-wire.ts';
