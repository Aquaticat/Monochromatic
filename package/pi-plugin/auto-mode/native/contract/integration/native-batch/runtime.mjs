import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {inspect as inspectValue} from 'node:util';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {createRequestProducerOwner} from '../../collector/request-producer-judgment-consumers/owner.mjs';
import {createRequestObservationOwner} from '../../lifecycle/root-lifecycle-retirement-entry/observer.mjs';
import {createJudgmentConstructor} from "./generated/judgment.mjs";
import {bindPolicySessionCollector} from '../policy-source/system-slot.mjs';
import {createOperationCurrentness} from './operation-currentness.mjs';
import {createNativeBatchHandler} from './handler.mjs';
import {
  ruleAssessmentCatalogText,
  bindRuleAssessmentWire,
  ruleAssessmentModel
} from '../action-policy/wire.mjs';
import {registerOwnedExecutionTools} from './tools.mjs';
import {prepareNativeSourceAssociation} from './source-association.mjs';

import {
  installNativePolicyHooks,
  NativePolicyRuntimeError
} from '../maintained-policy.mjs';

export {NativePolicyRuntimeError} from '../maintained-policy.mjs';

/**
 Compose original request, judgment, source, tool-context and batch owners once
 for a constructor-owned session. This retains the declared JSON/OpenAI request
 profile and does not invent semantic qualification or an instruction-free outcome.
 */
export function bindNativePolicyRuntime({
  root,
  lifecycle,
  policyInput,
  rootDirectory,
  parsePolicy,
  catalogText=ruleAssessmentCatalogText,
  files,
  send,
  effectOwnerFor,
  authorizationOwnerFor,
  semanticAdmissionPolicy,
  headingContextAdmissionPolicy,
  unitAdoptionAdmissionPolicy,
  approvalHost,
  readBypass,
  sendWire,
  wrapToolDefinition,
  readSessionDisposalState,
  trace,
  now=function readJudgmentClock() { return (performance.now()); },
  originalStream=root.session
    .agent
    .streamFunction,
  terminalFetch=globalThis.fetch
}){
 if(((typeof rootDirectory)!=='string')||(!isAbsolute(rootDirectory)))throw new NativePolicyRuntimeError('Original dependency working directory must be an absolute path');
 const configuredSemanticUse=(semanticAdmissionPolicy!==undefined)
   ||(headingContextAdmissionPolicy!==undefined)
   ||(unitAdoptionAdmissionPolicy!==undefined);
 if(configuredSemanticUse&&((typeof sendWire)!=='function'))throw new NativePolicyRuntimeError('Configured semantic admission requires a fixed raw-wire transport; normalized answers alone cannot attribute the serving model');
 const {session}=root;
   const {agent} = session;
 if(agent.signal!==undefined)throw new NativePolicyRuntimeError('Cannot change policy ownership during an active agent run');
 if(agent.executeToolBatch!==undefined)throw new NativePolicyRuntimeError('The original session already has a complete-group executor');
 lifecycle.assertActive(lifecycle.capture(root));
 const currentness=createOperationCurrentness(root);
 trace('policy-runtime.bind');
 const collector=bindPolicySessionCollector({
   input:policyInput,
   session
 });
 const observer=createRequestObservationOwner({
   originalStream,
   terminalFetch,
   lifecycle:currentness,
   root,
   collector,
   prepareSourceAssociation:prepareNativeSourceAssociation
 });
 const producerOwner=createRequestProducerOwner({now});
 async function sendAttributedAssessment(input){
  const wire=bindRuleAssessmentWire(input.request);
  const raw=await sendWire(Object.freeze({
    ...input,
    body:wire.body
  }));
  // The incumbent parser verifies the response model and complete answer set before attribution is retained.
  return Object.freeze({
    answerText:wire.answerText(raw),
    model:ruleAssessmentModel
  });
 }
 const construct=createJudgmentConstructor({
   now,
   producerOwner,
   observer,
   collector,
   rootAdapter:Object.freeze({
     prepare:function captureOperationRoot() { return (currentness.capture(root)); },
     finalize:function checkOperationRoot(operation) { ; (currentness.assertActive(operation)); }
   }),
   rootDirectory,
   files,
   parsePolicy,
   catalogText,
   catalogSHA256:createHash('sha256')
     .update(catalogText)
     .digest('hex'),
   trace,
   send:configuredSemanticUse?sendAttributedAssessment:send,
   isRetryableTransportFailure:function declineUnqualifiedClaim() { return (false); }
 });
 const runtimeState={
   lastJudgment:undefined,
   lastReview:undefined
 };
 const stream=producerOwner.bindJudgmentConsumer({
  handle:function observeOriginalMainRequest({
    model,
    context,
    options
  }) { return (observer.streamFunction(
    model,
    context,
    options
  )); },
  construct(input){runtimeState.lastJudgment=construct(input);return runtimeState.lastJudgment;}
 });
 const previousStream=agent.streamFunction;
 const handler=createNativeBatchHandler({
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
   ,readBypass
 });
 async function executeToolBatch(input){
  trace('policy-runtime.batch');
  const batchLog=tagged({
    tag:executeToolBatch.name,
    l:tagged({tag:'auto-mode-native-runtime'})
  });
  try{
   const result=await handler(input);
   runtimeState.lastReview=result.review;trace('policy-runtime.reviewed');return result;
  }catch(error){
   batchLog.error(inspectValue(
     error,
     {
       depth:8,
       customInspect:false,
       getters:false
     }
   ));
   throw error;
  }
 }
 const installation=installNativePolicyHooks({
   agent,
   previousStream,
   observedStream:function observedStream(
     model,
     context,
     options
   ){return producerOwner.fromAgentLoop({
     stream,
     model,
     context,
     options
   });},
   executeToolBatch,
   invalidateObserver:function invalidateRequestObservation() { observer.invalidate(); },
   registerExecutionTools:function registerOriginalExecutionTools() { return (registerOwnedExecutionTools({
     session,
     producerOwner,
     stream,
     wrapToolDefinition,
     readBypass
   })); },
   isSessionDisposed:function hasCompletedNativeDisposal() { return (readSessionDisposalState(session)
     .completed
     ===true); },
   onDetached:function traceRuntimeDetachment() { return (trace('policy-runtime.detached')); }
 });
 function inspect(){return Object.freeze({
   lastJudgment:runtimeState.lastJudgment,
   lastReview:runtimeState.lastReview,
   detached:installation.isDetached()
 });}
 return Object.freeze({
   inspect,
   detach:installation.detach
 });
}
