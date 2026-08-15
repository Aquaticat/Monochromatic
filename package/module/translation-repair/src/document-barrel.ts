//region Document barrel
// One document PAIR, from the preparation both lanes share to the driver that
// runs them over it. Split from the pipeline barrel, which had reached its line
// budget: these symbols are about a whole pair rather than about a stage, and a
// reader wiring a run over one document needs exactly this set.

export {
  type PreparedDocumentPair,
  prepareDocumentPair,
} from './document-preparation.ts';
export {
  type DocumentLanesResult,
  runDocumentLanes,
} from './document-lanes.ts';
export {
  assertSliceIndexing,
  reindexSlicePair,
  SliceIndexingError,
} from './slice-indexing.ts';
export {
  assertPlacementLayout,
  PlacementLayoutError,
} from './placement-layout.ts';
export {
  composeInsertion,
  documentLineEnding,
  fragmentBody,
} from './insertion-separator.ts';
export {
  buildSliceDelivery,
  SliceDeliveryError,
  type SliceDeliveryRecord,
  type SliceShipment,
} from './slice-delivery.ts';
export {
  assertDeliveryAgreesWithDocument,
  DeliveryInvariantError,
} from './delivery-invariants.ts';

//endregion Document barrel
