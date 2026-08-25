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
  parseConsolidationV2,
  type ParsedConsolidationV2,
} from './corpus-run/artifact-v2-read-consolidate.ts';
export {
  parseGateBallot,
  parseShipped,
  parseVerdict,
} from './corpus-run/artifact-v2-read-consolidate-parts.ts';
export { type ArtifactConsolidationTerminal, } from './corpus-run/artifact-v2-consolidate.ts';
export { parseLaneSelectionV2, } from './corpus-run/artifact-v2-read-contest.ts';
export { parseSettledArtifactV2, } from './corpus-run/artifact-v2-read.ts';
export { parseLanesV2, } from './corpus-run/artifact-v2-read-lanes.ts';
export {
  parseBlockPairingV2,
  type ParsedBlockPairingV2,
} from './corpus-run/artifact-v2-read-pairing.ts';
export {
  parseRepairEvidenceV2,
  parseTranslateEvidenceV2,
} from './corpus-run/artifact-v2-read-evidence.ts';
export {
  assertEvidenceMatchesLedger,
  assertRowsCoherent,
} from './corpus-run/artifact-v2-read-row-relations.ts';
export {
  assertBlockedCompatible,
  assertIndexSetsMatchLedger,
  assertTranslateCountsAgree,
} from './corpus-run/artifact-v2-read-set-relations.ts';
export { assertRecordedComparisonMatches, } from './corpus-run/artifact-v2-read-comparison.ts';
export {
  parseDecisionComparisonV2,
  parseSliceDeliveryV2,
  parseSliceOutcomeV2,
  type UnknownKeyPolicy,
} from './corpus-run/artifact-v2-read-vocabulary.ts';
export {
  parseComparisonRowV2,
  parseDeliveryRowV2,
  parseEvidenceRowV2,
} from './corpus-run/artifact-v2-read-rows.ts';
export type {
  ArtifactEvidenceRowV2,
  ArtifactRepairEvidenceV2,
  ArtifactRepairStatusV2,
  ArtifactTranslateEvidenceV2,
  ArtifactTranslateStatusV2,
  ParsedArtifactV2,
  ParsedLaneV2,
  ParsedPreparationV2,
} from './corpus-run/artifact-v2-read-contract.ts';

//endregion Artifact read barrel
