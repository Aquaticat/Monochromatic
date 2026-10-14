import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {createRequestProducerOwner} from '../../collector/request-producer-judgment-consumers/owner.mjs';
import {createRequestObservationOwner} from '../../lifecycle/root-lifecycle-retirement-entry/observer.mjs';
import {createJudgmentConstructor} from "./generated/judgment.mjs";
import {bindPolicySessionCollector} from '../policy-source/system-slot.mjs';
import {registerOriginalJudgmentStart} from '../action-policy/judgment-start.mjs';
import {createNativeBatchHandler} from './handler.mjs';
import {ruleAssessmentCatalogText,bindRuleAssessmentWire,ruleAssessmentModel} from '../action-policy/wire.mjs';
import {registerOwnedExecutionTools} from './tools.mjs';
import {prepareNativeSourceAssociation} from './source-association.mjs';

import {installNativePolicyHooks,NativePolicyRuntimeError} from '../maintained-policy.mjs';
export {NativePolicyRuntimeError} from '../maintained-policy.mjs';

/**
 * Compose original request, judgment, source, tool-context and batch owners once
 * for a constructor-owned session. This retains the declared JSON/OpenAI request
 * profile and does not invent semantic qualification or an instruction-free outcome.
 */
export function bindNativePolicyRuntime({
 root,lifecycle,policyInput,endpoint,rootDirectory,parsePolicy,catalogText=ruleAssessmentCatalogText,files,send,effectOwnerFor,authorizationOwnerFor,semanticAdmissionPolicy,requestMaterialAdmissionPolicy,headingContextAdmissionPolicy,unitAdoptionAdmissionPolicy,approvalHost,sendWire,
 wrapToolDefinition,readSessionDisposalState,trace,now=()=>performance.now(),
 originalStream=root.session.agent.streamFunction,terminalFetch=globalThis.fetch
}){
 if(typeof rootDirectory!=='string'||!isAbsolute(rootDirectory))throw new NativePolicyRuntimeError('Original dependency working directory must be an absolute path');
 const configuredSemanticUse=semanticAdmissionPolicy!==undefined||requestMaterialAdmissionPolicy!==undefined||headingContextAdmissionPolicy!==undefined||unitAdoptionAdmissionPolicy!==undefined;
 if(configuredSemanticUse&&typeof sendWire!=='function')throw new NativePolicyRuntimeError('Configured semantic admission requires a fixed raw-wire transport; normalized answers alone cannot attribute the serving model');
 const {session}=root,agent=session.agent;
 if(agent.signal!==undefined)throw new NativePolicyRuntimeError('Cannot change policy ownership during an active agent run');
 if(agent.executeToolBatch!==undefined)throw new NativePolicyRuntimeError('The original session already has a complete-group executor');
 lifecycle.assertActive(lifecycle.capture(root));
 trace('policy-runtime.bind');
 const collector=bindPolicySessionCollector({input:policyInput,session});
 const observer=createRequestObservationOwner({originalStream,terminalFetch,lifecycle,root,collector,endpoint,prepareSourceAssociation:prepareNativeSourceAssociation});
 const producerOwner=createRequestProducerOwner({now});
 async function sendAttributedAssessment(input){
  const wire=bindRuleAssessmentWire(input.request);
  const raw=await sendWire(Object.freeze({...input,body:wire.body}));
  // The incumbent parser verifies the response model and complete answer set before attribution is retained.
  return Object.freeze({answerText:wire.answerText(raw),model:ruleAssessmentModel});
 }
 const construct=createJudgmentConstructor({
  now,producerOwner,observer,collector,
  rootAdapter:Object.freeze({prepare:()=>lifecycle.capture(root),finalize:lease=>lifecycle.assertActive(lease)}),
  rootDirectory,files,parsePolicy,catalogText,
  catalogSHA256:createHash('sha256').update(catalogText).digest('hex'),
  trace,send:configuredSemanticUse?sendAttributedAssessment:send,isRetryableTransportFailure:()=>false
 });
 let lastJudgment,lastReview;
 const stream=producerOwner.bindJudgmentConsumer({
  handle:({model,context,options})=>observer.streamFunction(model,context,options),
  construct(input){lastJudgment=construct(input);return lastJudgment;}
 });
 const previousStream=agent.streamFunction;
 const observedStream=(model,context,options)=>producerOwner.fromAgentLoop({stream,model,context,options});
 const handler=createNativeBatchHandler({producerOwner,stream,observer,collector,policyInput,effectOwnerFor,authorizationOwnerFor,semanticAdmissionPolicy,requestMaterialAdmissionPolicy,headingContextAdmissionPolicy,unitAdoptionAdmissionPolicy,approvalHost});
 async function executeToolBatch(input){
  trace('policy-runtime.batch');
  const result=await handler(input);
  lastReview=result.review;trace('policy-runtime.reviewed');return result;
 }
 const installation=installNativePolicyHooks({
  agent,previousStream,observedStream,executeToolBatch,
  invalidateObserver:()=>observer.invalidate(),
  registerJudgmentStart:()=>registerOriginalJudgmentStart({agent,producerOwner,stream}),
  registerExecutionTools:()=>registerOwnedExecutionTools({session,producerOwner,stream,wrapToolDefinition}),
  isSessionDisposed:()=>readSessionDisposalState(session).completed===true,
  onDetached:()=>trace('policy-runtime.detached')
 });
 function inspect(){return Object.freeze({lastJudgment,lastReview,detached:installation.isDetached()});}
 return Object.freeze({inspect,detach:installation.detach});
}
