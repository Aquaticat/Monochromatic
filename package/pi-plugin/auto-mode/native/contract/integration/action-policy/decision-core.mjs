import {tagged} from '@monochromatic-dev/module-logger/ts';
import {captureApprovalHostSource,createApprovalHostOperation} from './approval.mjs';
import {captureAuthorizationOwnerFactory} from './authorization-inputs.mjs';
import {recordDecision} from './decision-diagnostics.ts';
import {
 captureSemanticAdmissionPolicy,
 captureHeadingContextAdmissionPolicy,
 captureUnitAdoptionAdmissionPolicy
} from './semantic-policy.ts';
import {PolicyReviewPhaseError,EstablishedPolicyDecisionError} from './decision-errors.mjs';
import {decide} from './decision-review.mjs';

export {PolicyReviewPhaseError,EstablishedPolicyDecisionError} from './decision-errors.mjs';

const l=tagged({tag:'auto-mode-decision-core'});

//region Original operation lifetime binds policies and prevents overlapping reviews.
/** Bootstrap fixes native custody and assessment policy; callers can supply only the original response. */
export function createDecisionGate({
  producerOwner,
  observer,
  collector,
  policyInput,
  stream,
  effectOwnerFor,
  authorizationOwnerFor,
  semanticAdmissionPolicy,
  headingContextAdmissionPolicy,
  unitAdoptionAdmissionPolicy,
  approvalHost
}){
 const gl=tagged({
   tag:createDecisionGate.name,
   l
 });
 gl.debug('binding original host decision gate');
 const policy=semanticAdmissionPolicy===undefined?undefined:captureSemanticAdmissionPolicy(semanticAdmissionPolicy);
 const headingPolicy=headingContextAdmissionPolicy===undefined?undefined:captureHeadingContextAdmissionPolicy(headingContextAdmissionPolicy);
 const unitPolicy=unitAdoptionAdmissionPolicy===undefined?undefined:captureUnitAdoptionAdmissionPolicy(unitAdoptionAdmissionPolicy);
 const authorizationFactory=authorizationOwnerFor===undefined?undefined:captureAuthorizationOwnerFactory(authorizationOwnerFor);
 const captureSource=captureApprovalHostSource(approvalHost);
 let active=false;
 function createOperationReview(){
 const host=createApprovalHostOperation(captureSource);
 async function review(response){
  const rl=tagged({
    tag:review.name,
    l:gl
  });
  rl.debug('reviewing original prepared response');
  producerOwner.assertMainAgentResponse({
    response,
    stream
  });
  const judgment=producerOwner.judgmentFor({
    response,
    stream
  });
  if(active)throw new PolicyReviewPhaseError('An original policy review is already running; await it before requesting another');
  const state=judgment.inspect();
  if((state.prepared!==true)||state.preparationFailed
    ||(state.finalRecord!==undefined))
   throw new PolicyReviewPhaseError('Policy review requires an open original judgment with complete prepared membership');
  active=true;
  using activity={ [Symbol.dispose](){active=false;} };
  try{
   return await decide({
     judgment,
     effectOwnerFor,
     authorizationOwnerFor:authorizationFactory,
     policy,
     headingPolicy,
     unitPolicy,
     approvalHost:host.captureHost(),
     sourceContext:{
       producerOwner,
       observer,
       collector,
       policyInput,
       stream,
       response
     }
   });
  }catch(error){
   recordDecision({
     judgment,
     event:'review-failed',
     details:{error}
   });
   rl.debug('closing failed original decision');
   try{if(judgment.inspect()
     .finalRecord
     ===undefined)judgment.finalize();}
   catch(closureFailure){
    if(error instanceof EstablishedPolicyDecisionError)
     throw new EstablishedPolicyDecisionError(
       error.message,
       {cause:new AggregateError([
         error,
         closureFailure
       ])}
     );
    throw new AggregateError(
      [
        error,
        closureFailure
      ],
      'Original policy review and evidence closure failed',
      {cause:closureFailure}
    );
   }
   throw error;
  }
 }
 return Object.freeze({
   ...host,
   review
 });
 }
 const gate=Object.freeze({createOperationReview});
 return gate;
}
//endregion Original decision ownership
