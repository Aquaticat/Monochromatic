import {createHash} from 'node:crypto';
import {PolicySlotBindingError} from './system-slot-error.mjs';
import {retainPolicyInput} from './policy-input-collector.mjs';
import {createResourceReceiptInputs,retainResourceReceiptInputs} from './resource-receipts.mjs';
import {copyAuthorityRegistration} from './registration.mjs';
import {assertOriginalInputBudget} from './input-budget.mjs';
import {copyOptions} from '../../collector/resource-input-custody/values.ts';
import {createGoverningContextEmitter} from './context-emission.mjs';
import {readBoundResourceFrame} from '../../collector/rule-relevance-sdk-copy/input/resource-owner.mjs';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {captureDecisionMaterial} from './decision-material.mjs';
import {bindReadablePolicyFiles} from './readable-policy-files.mjs';

//region The loader owns mutable input publication and its exact native resource binding.
/**
 Extend the existing resource owner with an actual policy-capture-to-input link.
 The fixed override hands the same capture occurrence to the native system slot.
 Other resource inputs are preserved, not removed to manufacture coverage.
 */
export function createPolicyLoaderState({
  owner,
  options:inputOptions,
  policy,
  authority,
  customPromptAuthority,
  systemSlot,
  readSessionConstructedInputs,
  readResourceToolInputs,
  readResourceToolOrigin,
  readResourceToolUsage,
  readSessionInputUsage,
  readSessionDomainEvents
}){
 if((readSessionConstructedInputs!==undefined)&&((typeof readSessionConstructedInputs)!=='function'))throw new PolicySlotBindingError('Constructed inputs require a fixed native session reader');
 if(((readResourceToolInputs===undefined)!==(readResourceToolOrigin===undefined))||(readResourceToolInputs!==undefined)
   &&((typeof readResourceToolInputs)!=='function'||(typeof readResourceToolOrigin)!=='function'))throw new PolicySlotBindingError('Resource tool inputs require paired fixed native readers');
 if(((readResourceToolInputs!==undefined)&&(typeof readResourceToolUsage)!=='function')||((readSessionInputUsage!==undefined)&&(typeof readSessionInputUsage)!=='function'))throw new PolicySlotBindingError('Input budgets require fixed native usage readers');
 const options=copyOptions(inputOptions);
 const registration=copyAuthorityRegistration(authority);
 const hostRegistration=copyAuthorityRegistration(customPromptAuthority);
 if(hostRegistration&&(systemSlot||(typeof options.systemPrompt)!=='string'
   ||(options.systemPromptOverride!==undefined)))throw new PolicySlotBindingError('Host prompt authority requires explicit systemPrompt text without a replacement callback');
 const hostPrompt=(!systemSlot)&&(typeof options.systemPrompt)==='string'
   &&(options.systemPromptOverride===undefined)?Object.freeze({
   kind:'bootstrap-host-custom-prompt',
   content:options.systemPrompt,
   sha256:createHash('sha256')
     .update(options.systemPrompt)
     .digest('hex'),
   occurrence:Object.freeze({}),
   registration:hostRegistration
 }):undefined;
 if(systemSlot&&((options.systemPromptOverride!==undefined)||(options.systemPrompt!==undefined)))throw new PolicySlotBindingError('An existing system override cannot be silently replaced');
 const inputState={
  binding:undefined,
  contextPublication:undefined,
  emission:undefined,
  failure:undefined,
  loader:undefined,
  retainedResourceReceipts:Object.freeze([])
 };
 const contextEmitter=systemSlot?undefined:createGoverningContextEmitter({
   callback:options.agentsFilesOverride,
   readSource:function captureDesignatedPolicy() { return (owner.captureGoverningPolicy(inputState.loader)); }
 });
 function systemPromptOverride(previous){
  const source=owner.captureGoverningPolicy(inputState.loader);
  if((previous!==undefined)&&(previous!==source.content))throw new PolicySlotBindingError('Existing native system instructions cannot be removed to qualify this source profile');
  inputState.emission=Object.freeze({source});
  return source.content;
 }
 inputState.loader=owner.create(systemSlot?{
   ...options,
   systemPromptOverride
 }:{
   ...options,
   agentsFilesOverride:contextEmitter.emit
 });
 owner.designateGoverningPolicy({
   ...policy,
   loader:inputState.loader
 });
 const nativeBinding=owner.bindNativeLoader(inputState.loader);
 function assertCurrent(value){
  if((value!==inputState.binding)||(!inputState.binding))throw new PolicySlotBindingError('Policy input link is not this loader original binding');
  if(inputState.failure)throw new PolicySlotBindingError(
    'Original policy input link lost eligibility',
    {cause:inputState.failure.cause}
  );
  try{
   if(readBoundResourceFrame({
     binding:nativeBinding,
     loader:inputState.loader
   })!==inputState.binding.frame)throw new PolicySlotBindingError('Original resource input frame changed');
   if(owner.captureGoverningPolicy(inputState.loader)!==inputState.binding.source)throw new PolicySlotBindingError('Original selected policy capture changed');
   inputState.contextPublication?.assertCurrent();
   inputState.binding.readablePolicies.assertCurrent();
   if(hostPrompt){
    const system=inputState.binding.frame
      .stages
      .find(function isCapturedSystemStage(stage) { return (stage.kind==='system'); });
    if((system?.before!==hostPrompt.content)||(system?.after!==hostPrompt.content))throw new PolicySlotBindingError('Native custom prompt does not retain the explicitly registered host text');
   }
  }catch(error){inputState.failure={cause:error};throw error;}
 }
 async function reload(options){
  inputState.binding=undefined;inputState.emission=undefined;inputState.failure=undefined;inputState.contextPublication=undefined;
  contextEmitter?.reset();
  await inputState.loader.reload(options);
  const frame=readBoundResourceFrame({
    binding:nativeBinding,
    loader:inputState.loader
  });
  if(systemSlot){
   if((!inputState.emission)||(owner.captureGoverningPolicy(inputState.loader)!==inputState.emission.source))throw new PolicySlotBindingError('System input did not retain its selected policy capture');
   const system=frame.stages
     .find(function isReloadedSystemStage(value) { return (value.kind==='system'); });
   if(system?.after
     !==inputState.emission.source
     .content)throw new PolicySlotBindingError('Published system input differs from the owner-captured policy');
  }
  const source=systemSlot?inputState.emission.source:owner.captureGoverningPolicy(inputState.loader);
  let relevance;
  let relevanceFailure;
  if(policy.relevance){
   try{
    relevance=await owner.refreshGoverningRelevance({loader:inputState.loader,signal:AbortSignal.timeout(45_000)});
   }catch(error){
    relevanceFailure={cause:error};
    tagged({tag:'reload-policy-relevance'}).error(error);
   }
  }
  const system=frame.stages
    .find(function isResourceSystemStage(value) { return (value.kind==='system'); });
  const resourceSystemInput=systemSlot||hostPrompt
    ||(system.after===undefined)?undefined:Object.freeze({
    kind:'native-resource-system-input',
    content:system.after,
    sha256:createHash('sha256')
      .update(system.after)
      .digest('hex'),
    occurrence:Object.freeze({}),
    registration:undefined,
    pathToRawFileIdentity:'not-established'
  });
  inputState.contextPublication=contextEmitter?.publish({
    nativeBinding,
    loader:inputState.loader,
    frame,
    source
  });
  const contextCarriers=inputState.contextPublication?.carriers??Object.freeze([]);
  const carrierByOrdinal=new Map(contextCarriers.map(function indexContextCarrier(carrier) { return ([
    carrier.ordinal,
    carrier
  ]); }));
  const context=frame.stages
    .find(function isResourceContextStage(value) { return (value.kind==='context'); }); const append=frame.stages
      .find(function isResourceAppendStage(value) { return (value.kind==='append'); });
  const singleCarrier=systemSlot&&(context?.after.agentsFiles.length===0)
    &&(append?.after.length===0);
  const appendInputs=Object.freeze(append.after
    .map(function captureResourceAppendInput(
      content,
      ordinal
    ) { return (Object.freeze({
      kind:'native-resource-append-input',
      content,
      ordinal,
      sha256:createHash('sha256').update(content).digest('hex'),
      occurrence:Object.freeze({}),
      registration:undefined,
      pathToRawFileIdentity:'not-established'
    })); }));
  const contextInputs=Object.freeze(context.after
    .agentsFiles
    .map(function captureResourceContextInput(
      entry,
      ordinal
    ) { return (Object.freeze({
      kind:'native-resource-context-input',
      content:entry.content,
      path:entry.path,
      ordinal,
      entry,
      carrier:carrierByOrdinal.get(ordinal),
      sha256:createHash('sha256').update(entry.content).digest('hex'),
      occurrence:Object.freeze({}),
      registration:undefined,
      pathToRawFileIdentity:'not-established'
    })); }));
  inputState.retainedResourceReceipts=retainResourceReceiptInputs({
    previous:inputState.retainedResourceReceipts,
    current:createResourceReceiptInputs({
      frame,
      priorContext:inputState.contextPublication?.prior
    })
  });
  const readablePolicies=bindReadablePolicyFiles(contextInputs);
  const decisionSelection=policy.relevance?captureDecisionMaterial({
   sources:Object.freeze([source,...readablePolicies.sources]),
   input:{parsePolicy:policy.relevance.parse,relevance,relevanceFailure}
  }):undefined;
  inputState.binding=Object.freeze({
    readablePolicies,
    decisionSelection,
    relevance,
    relevanceFailure,
    resourceReceiptInputs:inputState.retainedResourceReceipts,
    source,
    frame,
    resourceSystemInput,
    appendInputs,
    contextInputs,
    contextCarriers,
    priorContext:inputState.contextPublication?.prior,
    slot:systemSlot?'customPrompt':'governing-policy',
    singleCarrier,
    sourceOccurrenceLinked:systemSlot,
    otherInstructionCoverage:'not-established',
    permission:false
  });
  assertCurrent(inputState.binding);return inputState.binding;
 }
 function readCurrent(){assertCurrent(inputState.binding);return inputState.binding;}
 function bindCollector(context){
  return retainPolicyInput({readSessionConstructedInputs,readSessionDomainEvents,readCurrent,assertCurrent,assertInputBudget,resourceInputs,hostPrompt,base:owner.bindCollector({
    loader:inputState.loader,
    context,
    readPolicy(){
   const {source}=readCurrent();return {
     identity:source.identity,
     content:source.content
   };
  }
  })});
 }
 function bindSessionCollector(session){return retainPolicyInput({readSessionConstructedInputs,readSessionDomainEvents,readCurrent,assertCurrent,assertInputBudget,resourceInputs,hostPrompt,
   base:owner.bindSessionCollector({session}),
   session
 });}
 function assertInputBudget(session){
  if(readResourceToolInputs===undefined)return;
  if(session&&((typeof readSessionInputUsage)!=='function'))throw new PolicySlotBindingError('Combined resource and session input budgets require their native session usage reader');
  const resource=readResourceToolUsage(inputState.loader);
  const currentSession=session?readSessionInputUsage(session):{
    count:0,
    bytes:0
  };
  const receiptBytes=inputState.retainedResourceReceipts.reduce(
    function sumReceiptInputBytes(
      bytes,
      source
    ) { return (bytes+Buffer.byteLength(JSON.stringify(source))); },
    0
  );
  assertOriginalInputBudget({
    resource:{
      count:resource.count+inputState.retainedResourceReceipts.length,
      bytes:resource.bytes+receiptBytes
    },
    session:currentSession
  });
 }
 function resourceInputs(){
  if(readResourceToolInputs===undefined)return undefined;
  const origins=readResourceToolInputs(inputState.loader);
  if((!Array.isArray(origins))||(!Object.isFrozen(origins)))throw new PolicySlotBindingError('Resource tool inputs require their original native view');
  for(const origin of origins){
   const {
     source,
     publication,
     resourceInputOccurrence
   }=origin;
   if((readResourceToolOrigin({loader:inputState.loader,publication})!==origin)||(resourceInputOccurrence===undefined)
     ||(source.resourceInputOccurrence!==resourceInputOccurrence)
     ||(publication.sourceOccurrence!==source.occurrence)
     ||(source.kind!=='native-resource-tool-input')
     ||(source.registration!==undefined)
     ||(source.permission!==false))throw new PolicySlotBindingError('Resource tool input is not an original unregistered receipt of this loader');
  }
  if(readResourceToolInputs(inputState.loader)!==origins)throw new PolicySlotBindingError('Resource tool inputs changed during source binding');
  return origins;
 }
 return Object.freeze({
     loader:inputState.loader,
     nativeBinding,
     reload,
     readCurrent,
     assertCurrent,
     registration,
     hostPrompt,
     bindCollector,
     bindSessionCollector
 });
}

//endregion
