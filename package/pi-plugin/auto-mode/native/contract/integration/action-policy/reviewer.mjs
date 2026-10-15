import {createBoundPolicyEvaluator} from './evaluate.mjs';
import {captureAuthorizationOwnerFactory} from './authorization-inputs.mjs';

export class PolicyReviewPhaseError extends Error {
 constructor(message){super(message);this.name=this.constructor
   .name;}
}

/**
 Capture the host's original owners once at bootstrap.
 Callers supply only an original response, never judgment, authority, facts,
 interpreter, completeness flag or replacement stream/collector capabilities.
 */
export function createBoundPolicyReviewer({
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
 const evaluate=createBoundPolicyEvaluator({
   semanticAdmissionPolicy,
   headingContextAdmissionPolicy,
   unitAdoptionAdmissionPolicy,
   approvalHost
 });
 const authorizationFactory=authorizationOwnerFor===undefined?undefined:captureAuthorizationOwnerFactory(authorizationOwnerFor);
 const reviewActivity={active:false};
 async function review(response){
  producerOwner.assertMainAgentResponse({
    response,
    stream
  });
  const judgment=producerOwner.judgmentFor({
    response,
    stream
  });
  if(reviewActivity.active)throw new PolicyReviewPhaseError('An original policy review is already running; await it before requesting another');
  const state=judgment.inspect();
  if((state.prepared!==true)||state.preparationFailed
    ||(state.finalRecord!==undefined))throw new PolicyReviewPhaseError('Policy review requires an open original judgment with complete prepared membership');
  reviewActivity.active=true;
  using activeReview={ [Symbol.dispose](){reviewActivity.active=false;} };
  try{
   return await evaluate({
     judgment,
     effectOwnerFor,
     authorizationOwnerFor:authorizationFactory,
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
   try{
    if(judgment.inspect()
      .finalRecord
      ===undefined)judgment.finalize();
   }catch(closureFailure){
    throw new AggregateError(
      [
        error,
        closureFailure
      ],
      'Original policy review and evidence closure failed',
      { cause: closureFailure }
    );
   }
   throw error;
  }
 }
 return Object.freeze({review});
}
