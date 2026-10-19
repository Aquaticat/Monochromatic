/** Original prepared groups can be reviewed only once before closure or execution. */
export class PolicyReviewPhaseError extends Error {}

/** A resolved policy decision cannot be replaced by an evidence-free approval after its dependencies change. */
export class EstablishedPolicyDecisionError extends Error {}
