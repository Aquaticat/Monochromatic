import {dispatchPreparedBatch} from "./generated/prepared-dispatch.mjs";
import {createBoundPolicyReviewer} from '../action-policy/reviewer.mjs';

export class NativeBatchBindingError extends Error {}

/**
 Capture program declarations from the original wrapped tools after full argument preparation.
 Unsupported forms or stale tool dependencies close the same judgment; no policy permission is issued.
 */
export function prepareProgramInputs({
  judgment,
  tools
}){
 const state=judgment.inspect();
 if((!state.prepared)
   ||state.preparationFailed
   ||(state.finalRecord!==undefined)
   ||state.memberExecutions
   .some(function hasEnteredPreparedMember(member) { return (member.state!=='unentered'); }))throw new NativeBatchBindingError('Program inspection requires an open judgment with complete unentered prepared membership');
 try{
  for(const {id} of state.memberExecutions){
   const member=judgment.memberFor(id);
     const {prepared} = judgment.preparedMemberFor(member);
   const tool=tools.find(function matchesPreparedDefinition(value) { return (value.name===prepared.name); });
   tool?.capturePreparedProgram?.({
     judgment,
     member
   });
  }
 }catch(error){
  try{if(judgment.inspect()
    .finalRecord
    ===undefined)judgment.finalize();}
  catch(closureFailure){throw new AggregateError(
    [
      error,
      closureFailure
    ],
    'Original program inspection and evidence closure failed',
    { cause: closureFailure }
  );}
  throw error;
 }
}

/** Compose the incumbent dispatcher with the fixed original-response review path. */
export function createNativeBatchHandler({
  producerOwner,
  stream,
  observer,
  collector,
  policyInput,
  effectOwnerFor,
  authorizationOwnerFor,
  semanticAdmissionPolicy,
  requestMaterialAdmissionPolicy,
  headingContextAdmissionPolicy,
  unitAdoptionAdmissionPolicy,
  approvalHost
}){
 const reviewer=createBoundPolicyReviewer({
   producerOwner,
   stream,
   observer,
   collector,
   policyInput,
   effectOwnerFor,
   authorizationOwnerFor,
   semanticAdmissionPolicy,
   requestMaterialAdmissionPolicy,
   headingContextAdmissionPolicy,
   unitAdoptionAdmissionPolicy,
   approvalHost
 });
 return async function executeToolBatch({
   assistantMessage,
   context,
   signal,
   runToolCall,
   executionMode,
   beforeToolCall,
   afterToolCall,
   onStart,
   onFinish,
   onUpdate
 }){
  producerOwner.assertMainAgentResponse({
    response:assistantMessage,
    stream
  });
  const judgment=producerOwner.judgmentFor({
    response:assistantMessage,
    stream
  });
  let reviewed;
  function assertFresh(){
   if(producerOwner.judgmentFor({
     response:assistantMessage,
     stream
   })!==judgment)throw new NativeBatchBindingError('Original complete-group judgment changed');
   if(reviewed){reviewed.assertCurrent();return;}
   judgment.checkpoint();
   if(judgment.inspect()
     .prepared)judgment.assertDependenciesCurrent();
  }
  const dispatched=await dispatchPreparedBatch({
    calls:assistantMessage.content
      .filter(function isPreparedToolCall(part) { return (part.type==='toolCall'); }),
    tools:context.tools??[],
    assistantMessage,
    context,
    signal,
    runToolCall,
    executionMode,
    executionJudgment:judgment,
    onStart,
    onFinish,
    onUpdate,
    prepare:async function invokeOriginalBeforeToolCall(hook) { return (await beforeToolCall?.(
      hook,
      signal
    )); },
    after:afterToolCall,
    assertFresh,
    async assess({members}){
    judgment.prepare(members);
    prepareProgramInputs({
      judgment,
      tools:context.tools??[]
    });
    reviewed=await reviewer.review(assistantMessage);
    reviewed.assertCurrent();
    if((reviewed.outcome
      .state
      ==='resolved')&&(reviewed.outcome
        .verdict
        ==='approve')){
     observer.retainApprovedSources(assistantMessage);
     reviewed.assertCurrent();
     return {block:false};
    }
    return {
      block:true,
      reason:reviewed.outcome
        .reason
        ??'Execution is withheld because the complete group has no established policy outcome'
    };
   }
  });
  return Object.freeze({
    ...dispatched,
    review:reviewed
  });
 };
}
