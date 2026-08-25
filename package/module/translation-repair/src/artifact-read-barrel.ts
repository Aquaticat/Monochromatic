//region Artifact read barrel
// Everything that READS a settled two-lane artifact: the whole-file entry
// point, the per-part parsers it dispatches to, and the relation assertions
// that decide whether a file's parts agree with each other.
//
// Split out of `corpus-barrel.ts` when that file reached its line budget, on
// the same audience grounds the split before it used. These symbols answer one
// question, "what does this file say and does it hold together", and a caller
// that only writes artifacts needs none of them. `index.ts` composes both, so
// nothing importing the package sees the seam.

export {
  parseConsolidation,
  type ParsedConsolidation,
} from './corpus-run/artifact-two-lane-read-consolidate.ts';
export {
  parseGateBallot,
  parseShipped,
  parseVerdict,
} from './corpus-run/artifact-two-lane-read-consolidate-parts.ts';
export { type ArtifactConsolidationTerminal, } from './corpus-run/artifact-two-lane-consolidate.ts';
export { parseLaneSelection, } from './corpus-run/artifact-two-lane-read-contest.ts';
export { parseSettledTwoLaneArtifact, } from './corpus-run/artifact-two-lane-read.ts';
export { parseLanes, } from './corpus-run/artifact-two-lane-read-lanes.ts';
export {
  parseBlockPairing,
  type ParsedBlockPairing,
} from './corpus-run/artifact-two-lane-read-pairing.ts';
export {
  parseRepairEvidence,
  parseTranslateEvidence,
} from './corpus-run/artifact-two-lane-read-evidence.ts';
export {
  assertEvidenceMatchesLedger,
  assertRowsCoherent,
} from './corpus-run/artifact-two-lane-read-row-relations.ts';
export {
  assertBlockedCompatible,
  assertIndexSetsMatchLedger,
  assertTranslateCountsAgree,
} from './corpus-run/artifact-two-lane-read-set-relations.ts';
export { assertRecordedComparisonMatches, } from './corpus-run/artifact-two-lane-read-comparison.ts';
export {
  parseDecisionComparison,
  parseSliceDelivery,
  parseSliceOutcome,
  type UnknownKeyPolicy,
} from './corpus-run/artifact-two-lane-read-vocabulary.ts';
export {
  parseComparisonRow,
  parseDeliveryRow,
  parseEvidenceRow,
} from './corpus-run/artifact-two-lane-read-rows.ts';
export type {
  ArtifactEvidenceRow,
  ArtifactRepairEvidence,
  ArtifactRepairStatus,
  ArtifactTranslateEvidence,
  ArtifactTranslateStatus,
  ParsedTwoLaneArtifact,
  ParsedLane,
  ParsedPreparation,
} from './corpus-run/artifact-two-lane-read-contract.ts';

//endregion Artifact read barrel
