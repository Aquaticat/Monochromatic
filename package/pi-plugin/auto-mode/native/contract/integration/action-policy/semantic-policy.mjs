import {ruleAssessmentModel} from './wire.mjs';
import {
  copySemanticAdmissionPolicy,
  inspectSemanticAdmissionScope
} from '../maintained-policy.mjs';

export {SemanticAdmissionPolicyError} from '../maintained-policy.mjs';

/** Absence is handled at native bootstrap; the maintained copier receives only configured input. */
function captureAdmissionPolicy({
  input,
  definitionId
}){
 if(input===undefined)return undefined;
 return copySemanticAdmissionPolicy({
   input,
   definitionId
 });
}

/** Fixed native bootstrap selects the implemented clause consumer, not a caller verdict or fact. */
export function captureSemanticAdmissionPolicy(input){return captureAdmissionPolicy({
  input,
  definitionId:'clause_operation_relation'
});}

/** Fix the whole-request content definition independently of directive authority. */
export function captureRequestMaterialAdmissionPolicy(input){return captureAdmissionPolicy({
  input,
  definitionId:'request_instruction_content'
});}

/** Fix source-local contextual-heading content use without a directive or coverage assertion. */
export function captureHeadingContextAdmissionPolicy(input){return captureAdmissionPolicy({
  input,
  definitionId:'heading_instruction_content'
});}

/** Fix exact same-source incorporation independently of its target's directive meaning. */
export function captureUnitAdoptionAdmissionPolicy(input){return captureAdmissionPolicy({
  input,
  definitionId:'unit_adoption'
});}

/** The native wire contract fixes model identity, never a supplied action field. */
export function semanticAdmissionScope({
  policy,
  inputs,
  requireCandidates=true
}){
 return inspectSemanticAdmissionScope({
   policy,
   inputs,
   requireCandidates,
   expectedModel:ruleAssessmentModel
 });
}
