//region Document barrel
// One document PAIR, from the preparation both lanes share to the driver that
// runs them over it. Split from the pipeline barrel, which had reached its line
// budget: these symbols are about a whole pair rather than about a stage, and a
// reader wiring a run over one document needs exactly this set.

export {
  type PreparedDocumentPair,
  prepareDocumentPair,
  type UnclaimedTargetBlock,
} from './document-preparation.ts';
export {
  type FoldedText,
  foldInvisibleVariants,
} from './invisible-variants.ts';
export {
  type DocumentLanesResult,
  runDocumentLanes,
} from './document-lanes.ts';
export {
  assertSliceIndexing,
  indexingSentence,
  reindexSlicePair,
  SliceIndexingError,
  type SliceIndexingFault,
} from './slice-indexing.ts';
export {
  assertPlacementLayout,
  type PlacementFault,
  PlacementLayoutError,
} from './placement-layout.ts';
export {
  assertContainerIntegrity,
  ContainerIntegrityError,
} from './container-integrity.ts';
export {
  type BlockExtent,
  widenExtentsToContainers,
  widenNodesToContainers,
} from './container-extents.ts';
export {
  type ContainerSpan,
  UnpositionedContainerError,
} from './unwrap-container.ts';
export {
  assertSliceCoverage,
  type BlockPlacementFault,
  blockPlacementSentence,
  coverageSentence,
  SliceCoverageError,
  type SliceCoverageFault,
} from './slice-coverage.ts';
export {
  assertSpanContiguity,
  SpanContiguityError,
} from './span-contiguity.ts';
export {
  parseDocument,
  type RepairDocument,
} from './parse-document.ts';
export { groupNodes, } from './group-nodes.ts';
export {
  AlignedIndexError,
  groupAlignedSteps,
  groupSourceFirst,
} from './group-source-first.ts';
export { reflowOrphans, } from './reflow-orphans.ts';
export type {
  SourceFirstUnit,
  TargetBoundary,
} from './source-first-unit.ts';
export {
  composeInsertion,
  documentLineEnding,
  fragmentBody,
} from './insertion-separator.ts';
export {
  buildSliceDelivery,
  SliceDeliveryError,
  type SliceDelivery,
  type SliceDeliveryRecord,
} from './slice-delivery.ts';
export {
  deliverySentence,
  type DeliverySetName,
  type SliceDeliveryFault,
} from './slice-delivery-fault.ts';
export {
  armSliceCost,
  SLICE_COST_MARKER,
  type SliceCostLane,
  type SliceCostSpan,
} from './slice-cost-log.ts';
export {
  readSliceCosts,
  type SliceCostReading,
  type SliceCostRow,
} from './slice-cost-read.ts';
export {
  assertDeliveryAgreesWithDocument,
  DeliveryInvariantError,
  type DeliveryInvariantFault,
  deliveryInvariantSentence,
} from './delivery-invariants.ts';
export {
  assertWordingCoherent,
  WordingCoherenceError,
} from './wording-coherence.ts';
export {
  assertDeliveryCoherent,
  coherenceSentence,
  DeliveryCoherenceError,
  type DeliveryCoherenceFault,
} from './delivery-coherence.ts';
export {
  assertPreparationIdentity,
  type PreparationIdentity,
  preparationIdentity,
  PreparationIdentityError,
} from './preparation-identity.ts';

//endregion Document barrel
