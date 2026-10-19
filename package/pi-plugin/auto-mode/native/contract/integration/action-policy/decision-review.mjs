import {tagged} from '@monochromatic-dev/module-logger/ts';
import {capturePolicyInputs} from './inputs.mjs';
import {captureAuthorizationInputs} from './authorization-inputs.mjs';
import {capturePendingSessionApproval} from './pending-session-approval.ts';
import {compileBoundClauseProgram} from './compiler.mjs';
import {compilation} from './compilation-result.mjs';
import {recordDecision,recordDecisionEvidence} from './decision-diagnostics.ts';
import {resolveManualReviewOutcome} from './review-outcome.ts';
import {reviewOperationDecision} from './operation-decision.ts';
import {PolicyReviewPhaseError,EstablishedPolicyDecisionError} from './decision-errors.mjs';
import {captureScopes} from './decision-scopes.ts';

const l=tagged({tag:'auto-mode-decision-review'});

//region Review captures, assesses and closes one original judgment.
/** The original judgment owns the budget, evidence, closure, and subsequent execution checks. */
export async function decide({
  judgment,
  sourceContext,
  effectOwnerFor,
  authorizationOwnerFor,
  policy,
  headingPolicy,
  unitPolicy,
  approvalHost
}){
 const dl=tagged({
   tag:decide.name,
   l
 });
 recordDecision({
   judgment,
   event:'review-start',
   details:{members:judgment.inspect()
     .memberExecutions}
 });
 dl.debug('capturing selected decision inputs');
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
 const pendingSessionApproval=capturePendingSessionApproval({
   judgment,
   host:approvalHost
 });
 const {
   scope,
   headingScope,
   unitScope
 }=captureScopes({
   inputs,
   policy,
   headingPolicy,
   unitPolicy
 });
 const clauseRelations=scope.state==='matching';
 const headingContexts=headingScope.state==='matching';
 const unitAdoptions=unitScope.state==='matching';
 async function assessSelectedInputs(){
  if(!(clauseRelations||headingContexts
    ||unitAdoptions))return undefined;
  dl.debug('assessing selected sources within the original shared budget');
  const batch=judgment.issueBoundPolicyBatch({
    clauseRelations,
    headingContexts,
    unitAdoptions,
    requestMaterial:false
  });
  await judgment.assess(batch);
  const evidence=judgment.captureBatchEvidence(batch);
  judgment.assertBatchEvidence(evidence);
  recordDecisionEvidence({
    judgment,
    evidence
  });
  return evidence;
 }
 async function assessAndCompile(){
  try{
   const evidence=await assessSelectedInputs();
   inputs.assertCurrent();
   return compileBoundClauseProgram({
     judgment,
     inputs,
     authorizationInputs,
     pendingSessionApproval,
     policy,
     scope,
     evidence,
     headingPolicy,
     headingScope,
     unitPolicy,
     unitScope
   });
  }catch(error){
   recordDecision({
     judgment,
     event:'clause-assessment-failed',
     details:{
       error,
       next:'Check original currentness and budget before decision-model fallback'
     }
   });
   inputs.assertCurrent();
   authorizationInputs.assertCurrent();
   judgment.assertDependenciesCurrent();
   judgment.checkpoint();
   return compilation({
     issues:[Object.freeze({
       premise:'qualified-rule-interpretation',
       kind:'clause-assessment-failure',
       reason:'Clause assessment failed before a policy decision was established',
       error
     })],
     rules:[],
     authorizationRequirements:[],
     clauses:[],
     scope,
     sourceUses:{
       issues:[],
       uses:[]
     }
   });
  }
 }
 const compiled=await assessAndCompile();
 dl.debug('resolving captured policy before original evidence closure');
 const automaticOutcome=resolveManualReviewOutcome(compiled.program);
 recordDecision({
   judgment,
   event:'clause-outcome',
   details:{
     outcome:automaticOutcome,
     missingPremises:compiled.missingPremises,
     authorizationRequirements:compiled.program
       .authorizationRequirements
   }
 });
 async function decideCompleteOperation(){
  try{return await reviewOperationDecision(judgment);}
  catch(error){
   recordDecision({
     judgment,
     event:'operation-decision-failed',
     details:{error}
   });
   try{
    // Source observation has no assessment deadline; an exhausted model budget can still reach manual review.
    sourceContext.producerOwner
      .assertMainAgentResponse({
        response:sourceContext.response,
        stream:sourceContext.stream
      });
    sourceContext.observer
      .observationFor(sourceContext.response);
   }catch(currentnessFailure){
    throw new EstablishedPolicyDecisionError(
      'The operation or its instructions changed during decision-model review; propose the operation again',
      {cause:new AggregateError([
        error,
        currentnessFailure
      ])}
    );
   }
   throw error;
  }
 }
 // A clause estimate can also be a false denial; complete-operation review adjudicates it before confirmation.
 const operationDecision=(policy!==undefined)&&((automaticOutcome.state!=='resolved')||(automaticOutcome.verdict!=='approve'))
  ?await decideCompleteOperation()
  :undefined;
 const outcome=operationDecision?.outcome??automaticOutcome;
 recordDecision({
   judgment,
   event:'automatic-outcome',
   details:{
     outcome,
     next:(outcome.state!=='resolved')||(outcome.verdict==='ask')?'manual-review':'terminal'
   }
 });
 try{
 judgment.assertDependenciesCurrent();
 judgment.checkpoint();
 const closure=judgment.finalize();
 const result=Object.freeze({
   outcome,
   automaticOutcome,
   operationDecision,
   closure,
   program:compiled.program,
   assertCurrent(){
   if(judgment.inspect()
     .finalRecord
     !==closure)throw new PolicyReviewPhaseError('Policy decision belongs to another original evidence closure');
   judgment.assertDependenciesCurrent();
  }
 });
 function assertCurrent(){
  try{
   inputs.assertCurrent();authorizationInputs.assertCurrent();pendingSessionApproval.assertCurrent();result.assertCurrent();
  }catch(error){throw new EstablishedPolicyDecisionError(
    'The established policy decision is no longer current; propose the operation again',
    {cause:error}
  );}
 }
 assertCurrent();
 recordDecision({
   judgment,
   event:'review-complete',
   details:{
     outcome:result.outcome,
     confirmation:result.approval!==undefined
   }
 });
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
  throw new EstablishedPolicyDecisionError(
    'The established policy decision or its approval is no longer current; propose the operation again',
    {cause:error}
  );
 }
}
//endregion Original judgment review
