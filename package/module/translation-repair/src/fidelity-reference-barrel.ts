//region Reviewed fidelity-reference API
// A reviewed reference is distinct from an arbitrary archive candidate.

export {
  buildReviewedFidelityReference,
  MIN_REVIEWED_REFERENCE_CHARS,
} from './fidelity-reference-build.ts';
export {
  FidelityReferenceError,
  type FidelityReferenceOperation,
} from './fidelity-reference-error.ts';
export { REVIEWED_FIDELITY_REFERENCES, } from './fidelity-reference-manifest.ts';
export type {
  FidelityExpectedDamage,
  FidelityReferenceEdit,
  FidelityReferenceSpan,
  FidelityReferenceSpec,
  ReviewedFidelityReference,
} from './fidelity-reference-model.ts';
export { readReviewedFidelityReferences, } from './fidelity-reference-read.ts';
export { reviewedFidelityRequest, } from './fidelity-reference-request.ts';
export { selectReviewedFidelitySpecs, } from './fidelity-reference-select.ts';
export {
  type ReviewedFidelityTrial,
  reviewedFidelityTrials,
} from './fidelity-reference-trials.ts';

//endregion Reviewed fidelity-reference API
