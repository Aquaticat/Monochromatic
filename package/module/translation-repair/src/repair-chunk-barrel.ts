//region Repair chunk barrel
// One slice's repair: the critic phase over it, the driver that runs it, the
// verdict that settles it, and what a slice with nothing to repair reports.
//
// Split out of `pipeline-barrel.ts` when that file reached its size budget, on
// the same rule that split it from the root barrel: a barrel grows with the
// surface it names, so it is divided rather than exempted.

export {
  type ChunkCriticPhase,
  runChunkCriticPhase,
} from './chunk-critic-phase.ts';
export { repairChunk, } from './repair-chunk.ts';
export {
  type ChunkVerdict,
  describeChunkSettlement,
  settleChunkVerdict,
} from './repair-chunk-verdict.ts';
export {
  notApplicableFinding,
  notApplicableRepair,
} from './repair-not-applicable.ts';
export { unchangedChunkOutcome, } from './repair-unchanged-outcome.ts';

//endregion Repair chunk barrel
