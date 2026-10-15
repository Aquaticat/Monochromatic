//region Consistency apply barrel
// The consistency pass's applying and recording of its replacements, exported so each part is
// tested where it is defined. Split from `consistency-barrel.ts`, which sits at its line budget.

export {
  CONSISTENCY_KEPT_REASONS,
  type ConsistencyKeptReason,
} from './corpus-run/artifact-two-lane-consistency.ts';
export { keptReasonExpected, } from './corpus-run/artifact-two-lane-read-consistency-occurrence.ts';
export {
  type EdgeRefusal,
  edgeRefusalOf,
  type EdgeVerdict,
} from './corpus-run/pass-consistency-edge-refusal.ts';
export { groupLine, } from './corpus-run/pass-consistency-group-line.ts';
export {
  type AppliedConsistency,
  applyConsistency,
} from './corpus-run/pass-consistency-apply.ts';
export {
  editedStartOf,
  gainedBy,
  type GainSlice,
  type GainVerdict,
  madeIn,
  unprovenOnPage,
  withoutUnprovenGains,
} from './corpus-run/pass-consistency-apply-gains.ts';
export {
  plansOnPage,
  settledSlicesOf,
} from './corpus-run/pass-consistency-apply-plan.ts';
export { putBackInPageOrder, } from './corpus-run/pass-consistency-apply-order.ts';
export { readmittedSlicesOf, } from './corpus-run/pass-consistency-apply-readmit.ts';
export { screenSide, } from './corpus-run/pass-consistency-apply-screen.ts';
export {
  gainSliceOf,
  idsOf,
  keyOf,
  NO_POSITION,
  pageFrameOf,
  positionOfSlice,
  replacedAt,
  type ReadmitLedger,
  readmitLedgerOf,
} from './corpus-run/pass-consistency-apply-ledger.ts';
export {
  floorsWithSplice,
  madeWithSplice,
  type Trial,
  trialOf,
  type WithSplice,
} from './corpus-run/pass-consistency-apply-trial.ts';
export {
  type FloorsAsked,
  floorsQuestionOf,
  gainFindingOf,
  type GainReason,
  keptReasonOfGain,
  type SettledSlice,
  type SlicePlan,
  sliceIndexOf,
} from './corpus-run/pass-consistency-apply-settled.ts';
export {
  workedPageOf,
  type WorkedPage,
} from './corpus-run/pass-consistency-apply-worked.ts';
export {
  editsChangingLocatedWords,
  type LeftOutEdit,
} from './corpus-run/pass-consistency-apply-located.ts';
export {
  type GroupEdit,
  replacedKeyOf,
  type SettledIndex,
  settledIndexOf,
} from './corpus-run/pass-consistency-apply-index.ts';
export {
  carriedPlaceName,
  editId,
  finalGroupsOf,
  pendingNamed,
  placeKey,
  recordedRendering,
  type SliceEdits,
  sliceEditsOf,
  winnerOver,
} from './corpus-run/pass-consistency-apply-record.ts';

//endregion Consistency apply barrel
