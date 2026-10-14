/**
 Native scope selection forwards original inputs to the maintained semantic consumer.

 @module
 */
import {ruleAssessmentModel} from './assessment-model.ts';
import type {
  SemanticAdmissionDefinition,
  SemanticAdmissionInputs,
  SemanticAdmissionPolicy,
  SemanticAdmissionScope
} from '../../../../src/semantic-admission-types.ts';
import {
  copySemanticAdmissionPolicy,
  inspectSemanticAdmissionScope
} from '../maintained-policy.mjs';

export {SemanticAdmissionPolicyError} from '../maintained-policy.mjs';

//region Configuration copying does not grant semantic or instruction authority.

/**
 Absence is handled at native bootstrap; the maintained copier receives only configured input.

 @param input - present original bootstrap configuration selected by the caller

 @param definitionId - implemented native consumer selected independently of caller input

 @returns captured policy with the original acceptance callback

 @throws SemanticAdmissionPolicyError for configuration outside the selected consumer
 */
function captureAdmissionPolicy({
  input,
  definitionId
}: {
  readonly input: unknown;
  readonly definitionId: SemanticAdmissionDefinition;
}): SemanticAdmissionPolicy {
 return copySemanticAdmissionPolicy({
   input,
   definitionId
 });
}

/**
 Fixed native bootstrap selects the implemented clause consumer.
 {@inheritDoc captureAdmissionPolicy}

 @param input - present original clause-consumer configuration

 @returns captured clause-consumer policy
 */
export function captureSemanticAdmissionPolicy(input: unknown): SemanticAdmissionPolicy {
return captureAdmissionPolicy({
  input,
  definitionId:'clause_operation_relation'
});
}

/**
 Fix the whole-request content definition independently of directive authority.
 {@inheritDoc captureAdmissionPolicy}

 @param input - present original request-content configuration

 @returns captured request-content policy
 */
export function captureRequestMaterialAdmissionPolicy(input: unknown): SemanticAdmissionPolicy {
return captureAdmissionPolicy({
  input,
  definitionId:'request_instruction_content'
});
}

/**
 Fix source-local contextual-heading content use without a coverage assertion.
 {@inheritDoc captureAdmissionPolicy}

 @param input - present original heading-content configuration

 @returns captured heading-content policy
 */
export function captureHeadingContextAdmissionPolicy(input: unknown): SemanticAdmissionPolicy {
return captureAdmissionPolicy({
  input,
  definitionId:'heading_instruction_content'
});
}

/**
 Fix exact same-source incorporation independently of its target's directive meaning.
 {@inheritDoc captureAdmissionPolicy}

 @param input - present original incorporation configuration

 @returns captured incorporation policy
 */
export function captureUnitAdoptionAdmissionPolicy(input: unknown): SemanticAdmissionPolicy {
return captureAdmissionPolicy({
  input,
  definitionId:'unit_adoption'
});
}

/**
 The native wire contract fixes model identity, never a supplied action field.
 {@inheritDoc inspectSemanticAdmissionScope}

 @returns original scope decision under the fixed native serving model
 */
export function semanticAdmissionScope({
  policy,
  inputs,
  requireCandidates=true
}: {
  readonly policy?: SemanticAdmissionPolicy;
  readonly inputs: SemanticAdmissionInputs;
  readonly requireCandidates?: boolean;
}): SemanticAdmissionScope {
 return inspectSemanticAdmissionScope({
   ...(policy===undefined?{}:{policy}),
   inputs,
   requireCandidates,
   expectedModel:ruleAssessmentModel
 });
}

//endregion Configuration copying does not grant semantic or instruction authority.
