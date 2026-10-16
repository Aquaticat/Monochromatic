import {tagged} from '@monochromatic-dev/module-logger/ts';
import {captureApprovalHostSource,finishWithApproval} from './approval.mjs';
import {capturePolicyInputs} from './inputs.mjs';
import {captureAuthorizationInputs,captureAuthorizationOwnerFactory} from './authorization-inputs.mjs';
import {capturePendingSessionApproval} from './pending-session-approval.ts';
import {compileBoundClauseProgram} from './compiler.mjs';
import {compilation} from './compilation-result.mjs';
import {recordDecision,recordDecisionEvidence} from './decision-diagnostics.ts';
import {resolveManualReviewOutcome} from './review-outcome.ts';
import {reviewOperationDecision} from './operation-decision.ts';
import {
 captureSemanticAdmissionPolicy,
 captureHeadingContextAdmissionPolicy,
 captureUnitAdoptionAdmissionPolicy,
 semanticAdmissionScope
} from './semantic-policy.ts';

/** Original prepared groups can be reviewed only once before closure or execution. */
export class PolicyReviewPhaseError extends Error {}

/** A resolved policy decision cannot be replaced by an evidence-free approval after its dependencies change. */
export class EstablishedPolicyDecisionError extends Error {}

const l=tagged({tag:'auto-mode-decision-core'});

//region A single owner plans, assesses, resolves, and confirms the original prepared operation.
/** Same-source incorporation needs the original single-member clause interpretation. */
function captureUnitScope({inputs,unitPolicy,scope}){
 const inspected=semanticAdmissionScope({policy:unitPolicy,inputs});
 if(inspected.state!=='matching')return inspected;
 if(scope.state!=='matching'||inputs.effects.length!==1)
  return Object.freeze({state:'out-of-profile',reason:'Unit incorporation requires one original member and clause interpretation.'});
 if(inputs.unitAdoptionPairs.length===0)
  return Object.freeze({state:'no-unit-pairs',reason:'No bounded original same-source pair needs assessment.'});
 return inspected;
}
/** Current selected sources and the retained native program determine which questions are meaningful. */
function captureScopes({inputs,policy,headingPolicy,unitPolicy}){
 const scope=semanticAdmissionScope({policy,inputs});
 const inspectedHeading=semanticAdmissionScope({policy:headingPolicy,inputs,requireCandidates:false});
 const headingScope=inspectedHeading.state==='matching'&&inputs.headingContextCandidates.length===0
  ?Object.freeze({state:'no-heading-context',reason:'No original contextual-heading groups need assessment.'})
  :inspectedHeading;
 const unitScope=captureUnitScope({inputs,unitPolicy,scope});
 return {scope,headingScope,unitScope};
}

/** The original judgment owns the budget, evidence, closure, and subsequent execution checks. */
async function decide({judgment,sourceContext,effectOwnerFor,authorizationOwnerFor,policy,headingPolicy,unitPolicy,approvalHost}){
 const dl=tagged({tag:decide.name,l});
 recordDecision({judgment,event:'review-start',details:{members:judgment.inspect().memberExecutions}});
 dl.debug('capturing selected decision inputs');
 const inputs=await capturePolicyInputs({judgment,effectOwnerFor,sourceContext});
 const authorizationInputs=await captureAuthorizationInputs({judgment,inputs,ownerFor:authorizationOwnerFor});
 const pendingSessionApproval=capturePendingSessionApproval({judgment,host:approvalHost});
 const {scope,headingScope,unitScope}=captureScopes({inputs,policy,headingPolicy,unitPolicy});
 const clauseRelations=scope.state==='matching';
 const headingContexts=headingScope.state==='matching';
 const unitAdoptions=unitScope.state==='matching';
 async function assessSelectedInputs(){
  if(!(clauseRelations||headingContexts||unitAdoptions))return undefined;
  dl.debug('assessing selected sources within the original shared budget');
  const batch=judgment.issueBoundPolicyBatch({clauseRelations,headingContexts,unitAdoptions,requestMaterial:false});
  await judgment.assess(batch);
  const evidence=judgment.captureBatchEvidence(batch);
  judgment.assertBatchEvidence(evidence);
  recordDecisionEvidence({judgment,evidence});
  return evidence;
 }
 async function assessAndCompile(){
  try{
   const evidence=await assessSelectedInputs();
   inputs.assertCurrent();
   return compileBoundClauseProgram({
   judgment,inputs,authorizationInputs,pendingSessionApproval,policy,scope,evidence,
   headingPolicy,headingScope,unitPolicy,unitScope
   });
  }catch(error){
   recordDecision({judgment,event:'clause-assessment-failed',details:{error,next:'Check original currentness and budget before decision-model fallback'}});
   inputs.assertCurrent();
   authorizationInputs.assertCurrent();
   judgment.assertDependenciesCurrent();
   judgment.checkpoint();
   return compilation({
    issues:[Object.freeze({premise:'qualified-rule-interpretation',kind:'clause-assessment-failure',reason:'Clause assessment failed before a policy decision was established',error})],
    rules:[],authorizationRequirements:[],clauses:[],scope,sourceUses:{issues:[],uses:[]}
   });
  }
 }
 const compiled=await assessAndCompile();
 dl.debug('resolving captured policy before original evidence closure');
 const automaticOutcome=resolveManualReviewOutcome(compiled.program);
 recordDecision({judgment,event:'clause-outcome',details:{outcome:automaticOutcome,missingPremises:compiled.missingPremises,authorizationRequirements:compiled.program.authorizationRequirements}});
 async function decideCompleteOperation(){
  try{return await reviewOperationDecision(judgment);}
  catch(error){
   recordDecision({judgment,event:'operation-decision-failed',details:{error}});
   try{
    // Source observation has no assessment deadline; an exhausted model budget can still reach manual review.
    sourceContext.producerOwner.assertMainAgentResponse({response:sourceContext.response,stream:sourceContext.stream});
    sourceContext.observer.observationFor(sourceContext.response);
   }catch(currentnessFailure){
    throw new EstablishedPolicyDecisionError('The operation or its instructions changed during decision-model review; propose the operation again',{cause:new AggregateError([error,currentnessFailure])});
   }
   throw error;
  }
 }
 // A clause estimate can also be a false denial; complete-operation review adjudicates it before confirmation.
 const operationDecision=policy!==undefined&&(automaticOutcome.state!=='resolved'||automaticOutcome.verdict!=='approve')
  ?await decideCompleteOperation()
  :undefined;
 const outcome=operationDecision?.outcome??automaticOutcome;
 recordDecision({judgment,event:'automatic-outcome',details:{outcome,next:outcome.state!=='resolved'||outcome.verdict==='ask'?'manual-review':'terminal'}});
 try{
 judgment.assertDependenciesCurrent();
 judgment.checkpoint();
 const closure=judgment.finalize();
 const approvalContext=approvalHost?Object.freeze({
   ...approvalHost,
   producerOwner:sourceContext.producerOwner,
   observer:sourceContext.observer,
   collector:sourceContext.collector,
   response:sourceContext.response,
   stream:sourceContext.stream
 }):undefined;
 const result=await finishWithApproval({
   judgment,
   decision:Object.freeze({outcome,automaticOutcome,operationDecision,closure,program:compiled.program}),
   approvalContext
 });
 function assertCurrent(){
  inputs.assertCurrent();
  authorizationInputs.assertCurrent();
  pendingSessionApproval.assertCurrent();
  result.assertCurrent();
 }
 assertCurrent();
 recordDecision({judgment,event:'review-complete',details:{outcome:result.outcome,confirmation:result.approval!==undefined}});
 dl.debug('completed original decision without replacing its execution owner');
 return Object.freeze({
   ...result,
   inputs,
   authorizationInputs,
   compiledPolicy:compiled.program,
   clauseInterpretations:compiled.clauses,
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
 }catch(error){
  throw new EstablishedPolicyDecisionError('The established policy decision or its approval is no longer current; propose the operation again',{cause:error});
 }
}

/** Bootstrap fixes native custody and assessment policy; callers can supply only the original response. */
export function createDecisionGate({
 producerOwner,observer,collector,policyInput,stream,effectOwnerFor,authorizationOwnerFor,
 semanticAdmissionPolicy,headingContextAdmissionPolicy,unitAdoptionAdmissionPolicy,approvalHost
}){
 const gl=tagged({tag:createDecisionGate.name,l});
 gl.debug('binding original host decision gate');
 const policy=semanticAdmissionPolicy===undefined?undefined:captureSemanticAdmissionPolicy(semanticAdmissionPolicy);
 const headingPolicy=headingContextAdmissionPolicy===undefined?undefined:captureHeadingContextAdmissionPolicy(headingContextAdmissionPolicy);
 const unitPolicy=unitAdoptionAdmissionPolicy===undefined?undefined:captureUnitAdoptionAdmissionPolicy(unitAdoptionAdmissionPolicy);
 const authorizationFactory=authorizationOwnerFor===undefined?undefined:captureAuthorizationOwnerFactory(authorizationOwnerFor);
 const captureHost=captureApprovalHostSource(approvalHost);
 let active=false;
 async function review(response){
  const rl=tagged({tag:review.name,l:gl});
  rl.debug('reviewing original prepared response');
  producerOwner.assertMainAgentResponse({response,stream});
  const judgment=producerOwner.judgmentFor({response,stream});
  if(active)throw new PolicyReviewPhaseError('An original policy review is already running; await it before requesting another');
  const state=judgment.inspect();
  if(state.prepared!==true||state.preparationFailed||state.finalRecord!==undefined)
   throw new PolicyReviewPhaseError('Policy review requires an open original judgment with complete prepared membership');
  active=true;
  using activity={ [Symbol.dispose](){active=false;} };
  try{
   return await decide({
     judgment,effectOwnerFor,authorizationOwnerFor:authorizationFactory,policy,headingPolicy,unitPolicy,
     approvalHost:captureHost(),
     sourceContext:{producerOwner,observer,collector,policyInput,stream,response}
   });
  }catch(error){
   recordDecision({judgment,event:'review-failed',details:{error}});
   rl.debug('closing failed original decision');
   try{if(judgment.inspect().finalRecord===undefined)judgment.finalize();}
   catch(closureFailure){
    if(error instanceof EstablishedPolicyDecisionError)
     throw new EstablishedPolicyDecisionError(error.message,{cause:new AggregateError([error,closureFailure])});
    throw new AggregateError([error,closureFailure],'Original policy review and evidence closure failed',{cause:closureFailure});
   }
   throw error;
  }
 }
 const gate=Object.freeze({review});
 return gate;
}
//endregion Original decision ownership
