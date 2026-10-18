import {dispatchPreparedBatch} from "./generated/prepared-dispatch.mjs";
import {createDecisionGate} from '../action-policy/decision-core.mjs';
import {captureApprovalHostSource} from '../action-policy/approval.mjs';
import {createPreparedGroup} from './prepared-group.mjs';
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

/** Bind one complete native group to its original source observer and execution lifetime. */
export function createNativeBatchHandler({producerOwner,stream,observer,collector,policyInput,
  effectOwnerFor,authorizationOwnerFor,semanticAdmissionPolicy,headingContextAdmissionPolicy,
  unitAdoptionAdmissionPolicy,approvalHost,captureOperationCurrentness,executionOrigins,
  readBypass=function readNoBypass(){return false;}}){
  const captureHost=captureApprovalHostSource(approvalHost);
  const l=tagged({tag:createNativeBatchHandler.name,l:tagged({tag:'auto-mode-native-batch'})});
  const reviewer=createDecisionGate({producerOwner,stream,observer,collector,policyInput,
    effectOwnerFor,authorizationOwnerFor,semanticAdmissionPolicy,headingContextAdmissionPolicy,
    unitAdoptionAdmissionPolicy,approvalHost});
  return async function executeToolBatch({assistantMessage,context,signal,nativePhases,executionMode,
    beforeToolCall,afterToolCall,onStart,onFinish,onUpdate}){
    tagged({tag:executeToolBatch.name,l}).debug('reviewing complete native group');
    producerOwner.assertMainAgentResponse({response:assistantMessage,stream});
    const group=createPreparedGroup({response:assistantMessage,stream,signal,
      assertOperationCurrent:captureOperationCurrentness(),captureHost,origins:executionOrigins,readBypass,
      constructSource(context){return producerOwner.beginJudgment({response:assistantMessage,stream,signal,group:context});},
      reviewSource(){return reviewer.review(assistantMessage);},
      preparePrograms(judgment){prepareProgramInputs({judgment,tools:context.tools??[]});},
      retainSources(){observer.retainExecutionSources(assistantMessage);}
    });
    using operationLifetime={ [Symbol.dispose](){group.close();} };
    const dispatched=await dispatchPreparedBatch({
      calls:assistantMessage.content.filter(part=>part.type==='toolCall'),tools:context.tools??[],
      nativePhases,signal,executionMode,executionJudgment:group,onStart,onFinish,onUpdate,
      async prepare(hook){return await beforeToolCall?.(hook,signal);},
      after:afterToolCall,assertFresh:group.current,assess:group.assess
    });
    return Object.freeze({...dispatched,review:group.review()});
  };
}
