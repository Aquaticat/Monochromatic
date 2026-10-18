/**
 Evidence projections for the native decision fallback catalog.

 Logged records arrive as JSON text; these projections name only the fields the
 catalog asserts, and the narrowing guards validate those exact fields before
 any read reaches them. @module
 */

//region Decision evidence envelopes carry correlated review records.

/**
 Envelope every decision evidence record shares.
 */
export type DecisionEvidenceRecord = Readonly<{
  event: string;
  reviewId: string;
  details: unknown;
}>;

/**
 Clause admission evidence fields the catalog asserts on source binding.
 */
export type ClauseAdmissionDetails = Readonly<{
  binding: Readonly<{
    code: string;
    sourceSHA256: string;
  }>;
  answer: Readonly<{
    value: Readonly<{
      choice: string;
      probabilities: Readonly<Record<string, number>>;
    }>;
  }>;
  admitted: boolean;
}>;

/**
 Question evidence fields tying records to one operation.
 */
export type QuestionEvidenceDetails = Readonly<{ operationId: string }>;

/**
 Question evidence record variant selected by its event name.
 */
export type QuestionEvidenceRecord = Readonly<{
  event: 'question-evidence';
  reviewId: string;
  details: QuestionEvidenceDetails;
}>;

/**
 Review completion fields naming the terminal verdict and confirmation state.
 */
export type ReviewCompleteDetails = Readonly<{
  outcome: Readonly<{ verdict: string }>;
  confirmation: boolean;
}>;

//endregion

//region Assessment evidence records correlate transport with operations.

/**
 Assessment evidence envelope shared by request and response records.
 */
export type AssessmentEvidenceRecord = Readonly<{
  event: string;
  operationId: string;
  state?: unknown;
  raw?: unknown;
}>;

/**
 Selected policy material entry exposing its authored fragments.
 */
export type AssessmentPolicyMaterial = Readonly<{
  fragments: readonly Readonly<{ text: string }>[];
}>;

/**
 Assessment request state fields the catalog asserts stay archived and local.
 */
export type AssessmentRequestState = Readonly<Record<string, unknown>> & Readonly<{
  parentProgram: string;
  selectedPolicyMaterial: readonly [
    AssessmentPolicyMaterial,
    ...AssessmentPolicyMaterial[]
  ];
}>;

/**
 Assessment request record variant carrying its selected state.
 */
export type AssessmentRequestRecord = Readonly<{
  event: 'assessment-request';
  operationId: string;
  state: AssessmentRequestState;
}>;

//endregion

//region Shape errors name the evidence member that failed its projection.

/**
 Evidence shape failures name the member whose expected projection did not hold.
 */
export class DecisionFallbackEvidenceShapeError extends Error {
  /**
   Diagnostic identity stays distinct from transport and fixture failures.
   */
  override readonly name = 'DecisionFallbackEvidenceShapeError';
}

/**
 Narrow an object member before its projected field reads.

 @param value - evidence member arriving from parsed JSON

 @returns record view for further field checks

 @throws DecisionFallbackEvidenceShapeError when the member is not an object
 */
function evidenceMemberRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (((typeof value) !== 'object') || (value === null))
    throw new DecisionFallbackEvidenceShapeError('Evidence member must be an object before its field reads');
  return value;
}

//endregion

//region Narrowing guards validate exactly the asserted leaves.

/**
 Require the decision evidence envelope before capture retains a record.

 @param value - parsed decision evidence payload

 @throws DecisionFallbackEvidenceShapeError when event or review identifier is absent
 */
export function assertDecisionEvidenceRecord(value: unknown): asserts value is DecisionEvidenceRecord {
  const record = evidenceMemberRecord(value);
  if (((typeof record.event) !== 'string') || ((typeof record.reviewId) !== 'string'))
    throw new DecisionFallbackEvidenceShapeError('Decision evidence record must name its event and review identifier');
}

/**
 Select question evidence records by their event name.

 @param value - captured decision evidence record

 @returns whether the record carries question evidence details
 */
export function isQuestionEvidenceRecord(value: DecisionEvidenceRecord): value is QuestionEvidenceRecord {
  return value.event === 'question-evidence';
}

/**
 Validate clause admission details before their binding and answer reads.

 @param value - details member of a clause admission record

 @throws DecisionFallbackEvidenceShapeError when an asserted field is missing
 */
export function assertClauseAdmissionDetails(value: unknown): asserts value is ClauseAdmissionDetails {
  const details = evidenceMemberRecord(value);
  const binding = evidenceMemberRecord(details.binding);
  if (((typeof binding.code) !== 'string') || ((typeof binding.sourceSHA256) !== 'string'))
    throw new DecisionFallbackEvidenceShapeError('Clause admission binding must name its code and source digest');
  const answer = evidenceMemberRecord(details.answer);
  const decision = evidenceMemberRecord(answer.value);
  if ((typeof decision.choice) !== 'string')
    throw new DecisionFallbackEvidenceShapeError('Clause admission answer must name its selected choice');
  const probabilities = evidenceMemberRecord(decision.probabilities);
  for (const probability of Object.values(probabilities))
    if ((typeof probability) !== 'number')
      throw new DecisionFallbackEvidenceShapeError('Clause admission probabilities must remain numeric');
  if ((typeof details.admitted) !== 'boolean')
    throw new DecisionFallbackEvidenceShapeError('Clause admission must record its admitted state');
}

/**
 Validate question evidence details before the operation identifier read.

 @param value - details member of a question evidence record

 @throws DecisionFallbackEvidenceShapeError when the operation identifier is absent
 */
export function assertQuestionEvidenceDetails(value: unknown): asserts value is QuestionEvidenceDetails {
  const details = evidenceMemberRecord(value);
  if ((typeof details.operationId) !== 'string')
    throw new DecisionFallbackEvidenceShapeError('Question evidence must retain its operation identifier');
}

/**
 Validate review completion details before verdict and confirmation reads.

 @param value - details member of a review completion record

 @throws DecisionFallbackEvidenceShapeError when outcome fields are absent
 */
export function assertReviewCompleteDetails(value: unknown): asserts value is ReviewCompleteDetails {
  const details = evidenceMemberRecord(value);
  const outcome = evidenceMemberRecord(details.outcome);
  if ((typeof outcome.verdict) !== 'string')
    throw new DecisionFallbackEvidenceShapeError('Review completion must name its outcome verdict');
  if ((typeof details.confirmation) !== 'boolean')
    throw new DecisionFallbackEvidenceShapeError('Review completion must record its confirmation state');
}

/**
 Require the assessment evidence envelope before capture retains a record.

 @param value - parsed assessment evidence payload

 @throws DecisionFallbackEvidenceShapeError when event or operation identifier is absent
 */
export function assertAssessmentEvidenceRecord(value: unknown): asserts value is AssessmentEvidenceRecord {
  const record = evidenceMemberRecord(value);
  if (((typeof record.event) !== 'string') || ((typeof record.operationId) !== 'string'))
    throw new DecisionFallbackEvidenceShapeError('Assessment evidence record must name its event and operation identifier');
}

/**
 Select assessment request records by their event name.

 @param value - captured assessment evidence record

 @returns whether the record carries assessment request state
 */
export function isAssessmentRequestRecord(value: AssessmentEvidenceRecord): value is AssessmentRequestRecord {
  return value.event === 'assessment-request';
}

/**
 Validate assessment request state before policy material and program reads.

 @param value - state member of an assessment request record

 @throws DecisionFallbackEvidenceShapeError when asserted state fields are missing
 */
export function assertAssessmentRequestState(value: unknown): asserts value is AssessmentRequestState {
  const state = evidenceMemberRecord(value);
  if ((typeof state.parentProgram) !== 'string')
    throw new DecisionFallbackEvidenceShapeError('Assessment request state must retain its visible parent program');
  const material = state.selectedPolicyMaterial;
  if ((!Array.isArray(material)) || ((material.length) < 1))
    throw new DecisionFallbackEvidenceShapeError('Assessment request state must select at least its policy material');
  for (const entry of material) {
    const materialEntry = evidenceMemberRecord(entry);
    const fragments = materialEntry.fragments;
    if (!Array.isArray(fragments))
      throw new DecisionFallbackEvidenceShapeError('Selected policy material must retain its fragments');
    for (const fragment of fragments) {
      const span = evidenceMemberRecord(fragment);
      if ((typeof span.text) !== 'string')
        throw new DecisionFallbackEvidenceShapeError('Policy material fragments must retain their text');
    }
  }
}

//endregion
