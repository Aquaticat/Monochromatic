//region Lane barrel
// The two-lane surface: each lane's per-slice texts and the named sets it
// reports beside them, the comparison of the two lanes' delivery ledgers, and
// the faults both refuse on. Split from the pipeline barrel when that file
// reached the file-size budget.

export {
  compareDocumentLanes,
  type DecisionComparison,
  type IdentifiedDeliveryLedger,
  type LaneComparison,
  LaneComparisonError,
  type SliceLaneComparison,
  type SliceLaneVerdict,
} from './lane-comparison.ts';
export {
  type ComparedLane,
  comparisonSentence,
  type LaneComparisonFault,
} from './lane-comparison-fault.ts';
export {
  buildLaneSliceTexts,
  LaneSliceCoverageError,
  type LaneSliceOutcome,
  type LaneSliceText,
} from './lane-slice-text.ts';
export {
  laneCoverageSentence,
  type LaneSliceCoverageFault,
  type NamedSliceSetLabel,
} from './lane-slice-coverage-error.ts';

//endregion Lane barrel
