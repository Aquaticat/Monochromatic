import {dispatchPreparedBatch} from "./generated/prepared-dispatch.mjs";
import {createDecisionGate} from '../action-policy/decision-core.mjs';
import {captureApprovalHostSource} from '../action-policy/approval.mjs';
import {createManualGroup} from './manual-group.mjs';
import {tagged} from '@monochromatic-dev/module-logger/ts';

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
  headingContextAdmissionPolicy,
  unitAdoptionAdmissionPolicy,
  approvalHost,
  captureOperationCurrentness,
  manualOrigins
  ,readBypass=function readNoBypass(){return false;}
}){
 const captureHost=captureApprovalHostSource(approvalHost);
 const l=tagged({tag:createNativeBatchHandler.name,l:tagged({tag:'auto-mode-native-batch'})});
 const reviewer=createDecisionGate({
   producerOwner,
   stream,
   observer,
   collector,
   policyInput,
   effectOwnerFor,
   authorizationOwnerFor,
   semanticAdmissionPolicy,
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
  const assertOperationCurrent=captureOperationCurrentness();
  const manual=createManualGroup({response:assistantMessage,stream,signal,assertOperationCurrent,captureHost,origins:manualOrigins});
  using operationLifetime={ [Symbol.dispose](){manual.close();} };
  const bypass=readBypass();
  const reviewState={
    reviewed:undefined,
    bypassed:false,
    judgment:undefined,
    automaticFailure:undefined,
    manual:false
  };
  function retainAutomaticFailure(error){
   tagged({tag:retainAutomaticFailure.name,l}).debug('automatic assessment failed; retaining cause for manual approval');
   reviewState.automaticFailure??={error};
  }
  try{reviewState.judgment=producerOwner.beginJudgment({response:assistantMessage,stream,signal});}
  catch(error){retainAutomaticFailure(error);}
  const {judgment}=reviewState;
  function assertFresh(){
   manual.current();
   if(bypass&&(!readBypass()))throw new NativeBatchBindingError('Explicit bypass was disabled before this group completed; retry with guardrail checks');
   if(reviewState.manual){reviewState.reviewed?.assertCurrent();return;}
   if(reviewState.automaticFailure)return;
   if(producerOwner.judgmentFor({
     response:assistantMessage,
     stream
   })!==judgment)throw new NativeBatchBindingError('Original complete-group judgment changed');
   if(reviewState.reviewed){reviewState.reviewed
     .assertCurrent();return;}
   if(reviewState.bypassed){judgment.assertDependenciesCurrent();return;}
   try{
    judgment.checkpoint();
    if(judgment.inspect().prepared)judgment.assertDependenciesCurrent();
   }catch(error){retainAutomaticFailure(error);}
  }
  function executionOwner(){return reviewState.manual?manual:judgment;}
  const execution={
   memberFor(id){return executionOwner().memberFor(id);},
   beginExecution(member){return executionOwner().beginExecution(member);},
   executionFor(token){return executionOwner().executionFor(token);},
   finishExecution(token){return executionOwner().finishExecution(token);}
  };
  const dispatched=await dispatchPreparedBatch({
    calls:assistantMessage.content
      .filter(function isPreparedToolCall(part) { return (part.type==='toolCall'); }),
    tools:context.tools??[],
    assistantMessage,
    context,
    signal,
    runToolCall,
    executionMode,
    executionJudgment:execution,
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
    manual.prepare(members);
    async function automaticReview(){
    judgment.prepare(members);
    if(bypass){
     assertFresh();
     judgment.finalize();
     observer.retainExecutionSources(assistantMessage);
     reviewState.bypassed=true;
     return;
    }
    prepareProgramInputs({
      judgment,
      tools:context.tools??[]
    });
    reviewState.reviewed=await reviewer.review(assistantMessage);
    reviewState.reviewed
      .assertCurrent();
    if((reviewState.reviewed
      .outcome
      .state
      ==='resolved')&&(reviewState.reviewed
        .outcome
        .verdict
        ==='approve')){
     observer.retainExecutionSources(assistantMessage);
     reviewState.reviewed
       .assertCurrent();
     return;
    }
    }
    if(!reviewState.automaticFailure){
     try{await automaticReview();}
     catch(error){retainAutomaticFailure(error);}
    }
    if(reviewState.automaticFailure){
     manual.current();
     reviewState.manual=true;
     reviewState.reviewed=await manual.request(reviewState.automaticFailure.error);
    }
    if(reviewState.bypassed||reviewState.reviewed?.outcome.verdict==='approve')return {block:false};
    return {
      block:true,
      reason:reviewState.reviewed
        .outcome
        .reason
        ??'Execution is withheld because the complete group has no established policy outcome'
    };
   }
  });
  return Object.freeze({
    ...dispatched,
    review:reviewState.reviewed
  });
 };
}
