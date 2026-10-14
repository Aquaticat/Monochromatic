import {assessAndDecide} from './index.mjs';
import {
  captureApprovalHostSource,
  finishWithApproval
} from './approval.mjs';
import {capturePolicyInputs} from './inputs.mjs';
import {captureAuthorizationInputs} from './authorization-inputs.mjs';
import {compileBoundClauseProgram} from './compiler.mjs';
import {
  captureSemanticAdmissionPolicy,
  captureRequestMaterialAdmissionPolicy,
  captureHeadingContextAdmissionPolicy,
  captureUnitAdoptionAdmissionPolicy,
  semanticAdmissionScope
} from './semantic-policy.mjs';

/** Evaluate one prepared original judgment without asking a model for a verdict. */
export async function evaluatePolicy({
  judgment,
  needsRelations,
  readProgram,
  approvalContext,
  relationDefinitionId,
  requestMaterialDefinitionId,
  headingContextDefinitionId,
  unitAdoptionDefinitionId
}){
 const decision=await assessAndDecide({
   judgment,
   needsRelations,
   readProgram,
   relationDefinitionId,
   requestMaterialDefinitionId,
   headingContextDefinitionId,
   unitAdoptionDefinitionId
 });
 return await finishWithApproval({
   judgment,
   decision,
   approvalContext
 });
}

/** Fixed code policy consumes original estimates without filling independent source or operation gaps. */
async function evaluateOriginalPolicy({
  judgment,
  effectOwnerFor,
  authorizationOwnerFor,
  sourceContext,
  policy,
  requestPolicy,
  headingPolicy,
  unitPolicy,
  approvalHost
}){
 const inputs=await capturePolicyInputs({
   judgment,
   effectOwnerFor,
   sourceContext
 });
 const authorizationInputs=await captureAuthorizationInputs({
   judgment,
   inputs,
   ownerFor:authorizationOwnerFor
 });
 const scope=semanticAdmissionScope({
   policy,
   inputs
 });
 const requestScope=semanticAdmissionScope({
   policy:requestPolicy,
   inputs,
   requireCandidates:false
 });
 const inspectedHeadingScope=semanticAdmissionScope({
   policy:headingPolicy,
   inputs,
   requireCandidates:false
 });
 const headingScope=(inspectedHeadingScope.state==='matching')&&(inputs.headingContextCandidates
   .length
   === 0)?Object.freeze({
   state:'no-heading-context',
   reason:'No original contextual-heading groups need this semantic use.'
 }):inspectedHeadingScope;
 const inspectedUnitScope=semanticAdmissionScope({
   policy:unitPolicy,
   inputs
 });
 const unitScope=inspectedUnitScope.state!=='matching'?inspectedUnitScope:(scope.state!=='matching')||(inputs.effects
   .length
   !==1)?Object.freeze({
   state:'out-of-profile',
   reason:'Unit incorporation requires one original member and its independent clause-interpretation policy.'
 }):inputs.unitAdoptionPairs
   .length
   === 0?Object.freeze({
   state:'no-unit-pairs',
   reason:'No unambiguous bounded original same-source pair is available.'
 }):inspectedUnitScope;
 let compiled;
 // Host presentation is fixed at bootstrap; request owners come only from this original review.
 const approvalContext=approvalHost&&sourceContext?Object.freeze({
   ...approvalHost,
   producerOwner:sourceContext.producerOwner,
   observer:sourceContext.observer,
   collector:sourceContext.collector,
   response:sourceContext.response,
   stream:sourceContext.stream
 }):undefined;
 const result=await evaluatePolicy({
   judgment,
   approvalContext,
   needsRelations:(scope.state==='matching')||(requestScope.state==='matching')
     ||(headingScope.state==='matching')
     ||(unitScope.state==='matching'),
   relationDefinitionId:scope.state==='matching'?policy.definitionId:undefined,
   requestMaterialDefinitionId:requestScope.state==='matching'?requestPolicy.definitionId:undefined,
   headingContextDefinitionId:headingScope.state==='matching'?headingPolicy.definitionId:undefined,
   unitAdoptionDefinitionId:unitScope.state==='matching'?unitPolicy.definitionId:undefined,
   readProgram({evidence}){
   inputs.assertCurrent();
   compiled=compileBoundClauseProgram({
     judgment,
     inputs,
     authorizationInputs,
     policy,
     scope,
     evidence,
     requestPolicy,
     requestScope,
     headingPolicy,
     headingScope,
     unitPolicy,
     unitScope
   });
   return compiled.program;
  }
 });
 function assertCurrent(){inputs.assertCurrent();authorizationInputs.assertCurrent();result.assertCurrent();}
 assertCurrent();
 return Object.freeze({
   ...result,
   inputs,
   authorizationInputs,
   compiledPolicy:compiled.program,
   clauseInterpretations:compiled.clauses,
   requestMaterialInterpretation:compiled.requestMaterialInterpretation,
   requestMaterialAdmission:requestScope,
   headingContextInterpretations:compiled.headingContextInterpretations,
   headingContextAdmission:headingScope,
   requestSourceAssociationUses:compiled.requestSourceAssociationUses,
   unitAdoptionInterpretations:compiled.unitAdoptionInterpretations,
   unitAdoptionAdmission:unitScope,
   semanticAdmission:compiled.semanticAdmission,
   missingPremises:compiled.missingPremises,
   premiseIssues:compiled.premiseIssues,
   assertCurrent
 });
}

/**
 Bootstrap fixes the model/profile/acceptance policy once; returned calls cannot replace it.
 No default policy, production threshold, empirical qualification or instruction authority is invented.
 */
export function createBoundPolicyEvaluator({
  semanticAdmissionPolicy,
  requestMaterialAdmissionPolicy,
  headingContextAdmissionPolicy,
  unitAdoptionAdmissionPolicy,
  approvalHost
}={}){
 const policy=captureSemanticAdmissionPolicy(semanticAdmissionPolicy);
 const requestPolicy=captureRequestMaterialAdmissionPolicy(requestMaterialAdmissionPolicy);
 const headingPolicy=captureHeadingContextAdmissionPolicy(headingContextAdmissionPolicy);
 const unitPolicy=captureUnitAdoptionAdmissionPolicy(unitAdoptionAdmissionPolicy);
 const captureHost=captureApprovalHostSource(approvalHost);
 return async function evaluate({
   judgment,
   effectOwnerFor,
   authorizationOwnerFor,
   sourceContext
 }){
  return await evaluateOriginalPolicy({
    judgment,
    effectOwnerFor,
    authorizationOwnerFor,
    sourceContext,
    policy,
    requestPolicy,
    headingPolicy,
    unitPolicy,
    approvalHost:captureHost()
  });
 };
}

/**
 Unconfigured standalone entry preserves withholding and ignores action-supplied admission hints.
 Configured native evaluation is constructed at bootstrap through createBoundPolicyEvaluator.
 */
export async function evaluateBoundPolicy({
  judgment,
  effectOwnerFor,
  sourceContext
}){
 return await evaluateOriginalPolicy({
   judgment,
   effectOwnerFor,
   sourceContext,
   policy:undefined
 });
}
