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

 @param input - original bootstrap configuration, or absence of a configured consumer

 @param definitionId - implemented native consumer selected independently of caller input

 @returns captured policy or absent configuration

 @throws SemanticAdmissionPolicyError for configuration outside the selected consumer
 */
function captureAdmissionPolicy({
  input,
  definitionId
}: {
  readonly input: unknown;
  readonly definitionId: SemanticAdmissionDefinition;
}): SemanticAdmissionPolicy | undefined {
 if(input===undefined)return undefined;
 return copySemanticAdmissionPolicy({
   input,
   definitionId
 });
}

/**
 Fixed native bootstrap selects the implemented clause consumer.
 {@inheritDoc captureAdmissionPolicy}
 */
export function captureSemanticAdmissionPolicy(input: unknown): SemanticAdmissionPolicy | undefined {return captureAdmissionPolicy({
  input,
  definitionId:'clause_operation_relation'
});}

/**
 Fix the whole-request content definition independently of directive authority.
 {@inheritDoc captureAdmissionPolicy}
 */
export function captureRequestMaterialAdmissionPolicy(input: unknown): SemanticAdmissionPolicy | undefined {return captureAdmissionPolicy({
  input,
  definitionId:'request_instruction_content'
});}

/**
 Fix source-local contextual-heading content use without a coverage assertion.
 {@inheritDoc captureAdmissionPolicy}
 */
export function captureHeadingContextAdmissionPolicy(input: unknown): SemanticAdmissionPolicy | undefined {return captureAdmissionPolicy({
  input,
  definitionId:'heading_instruction_content'
});}

/**
 Fix exact same-source incorporation independently of its target's directive meaning.
 {@inheritDoc captureAdmissionPolicy}
 */
export function captureUnitAdoptionAdmissionPolicy(input: unknown): SemanticAdmissionPolicy | undefined {return captureAdmissionPolicy({
  input,
  definitionId:'unit_adoption'
});}

/**
 The native wire contract fixes model identity, never a supplied action field.
 {@inheritDoc inspectSemanticAdmissionScope}
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
   policy,
   inputs,
   requireCandidates,
   expectedModel:ruleAssessmentModel
 });
}

//endregion Configuration copying does not grant semantic or instruction authority.
