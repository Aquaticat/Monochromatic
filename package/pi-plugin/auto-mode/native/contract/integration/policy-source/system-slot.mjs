import {createHash} from 'node:crypto';
import {collectRetainedRunInputs} from './run-history.mjs';
import {
  createResourceReceiptInputs,
  retainResourceReceiptInputs
} from './resource-receipts.mjs';
import {copyAuthorityRegistration} from './registration.mjs';
import {assertOriginalInputBudget} from './input-budget.mjs';
import {copyOptions} from '../../collector/resource-input-custody/values.ts';
import {createGoverningContextEmitter} from './context-emission.mjs';
import {linkRunInputCarriers} from './run-carriers.mjs';
import {collectNativeMessageInputs} from '../../collector/run-prompt-custody-v3/message-inputs.mjs';
import {
  assertCollectedManagerGrowth,
  assertManagerOriginsAppended
} from './manager-source-growth.mjs';
import {readBoundResourceFrame} from "../../collector/rule-relevance-sdk-copy/input/resource-owner.mjs";

export class PolicySlotBindingError extends Error {
 constructor(
   message,
   options
 ){super(
   message,
   options
 );this.name=this.constructor
   .name;}
}

// Module-private construction key and instance fields authenticate the owning
// callback, without a second global source/session registry.
const constructionKey=Object.freeze({});
class SystemPolicyInput {
 #state;
 constructor({
   key,
   state
 }){
  if(key!==constructionKey)throw new PolicySlotBindingError('Requires original policy-input capability');
  this.#state=state;Object.freeze(this);
 }
 static #stateFor(input){
  if((!input)||(typeof input)!=='object'||(!(#state in input)))throw new PolicySlotBindingError('Requires original policy-input capability');
  return input.#state;
 }
 static read(input){return SystemPolicyInput.#stateFor(input)
   .readCurrent();}
 static assert({
   input,
   binding
 }){SystemPolicyInput.#stateFor(input)
   .assertCurrent(binding);}
 static collector({
   input,
   context
 }){return SystemPolicyInput.#stateFor(input)
   .bindCollector(context);}
 static sessionCollector({
   input,
   session
 }){return SystemPolicyInput.#stateFor(input)
   .bindSessionCollector(session);}
 static hostPrompt(input){
  const state=SystemPolicyInput.#stateFor(input);
  state.readCurrent();return state.hostPrompt;
 }
 static registration(input){
  const state=SystemPolicyInput.#stateFor(input);
  state.readCurrent();return state.registration;
 }
 get loader(){return this.#state
   .loader;}
 get nativeBinding(){return this.#state
   .nativeBinding;}
 async reload(options){return await this.#state
   .reload(options);}
 readCurrent(){return this.#state
   .readCurrent();}
 assertCurrent(binding){this.#state
   .assertCurrent(binding);}
}
Object.freeze(SystemPolicyInput.prototype);
Object.freeze(SystemPolicyInput);

/** Read through the real callback owner, never a caller-created reader. */
export function readPolicyInput(input){return SystemPolicyInput.read(input);}
/** Require the actual system-input carrier when proving system-message placement. */
export function readSystemPolicyInput(input){
 const value=readPolicyInput(input);
 if(value.slot!=='customPrompt')throw new PolicySlotBindingError('Original policy input is not a system-prompt carrier');
 return value;
}
/** Revalidate through private instance state; copied methods cannot mint a link. */
export function assertPolicyInput(input){SystemPolicyInput.assert(input);}
export function assertSystemPolicyInput(input){assertPolicyInput(input);}
/** Read an immutable declaration through its original owner, never action metadata. */
export function readAuthorityRegistration(input){return SystemPolicyInput.registration(input);}
/** Original explicitly configured host text, not the composite system message. */
export function readHostPromptInput(input){return SystemPolicyInput.hostPrompt(input);}
/** Extend the incumbent collector with this owner's exact governing-source capture. */
export function bindPolicyCollector(input){return SystemPolicyInput.collector(input);}
/** Retain actual native session/base/run publication links through the incumbent owner. */
export function bindPolicySessionCollector(input){return SystemPolicyInput.sessionCollector(input);}

/**
 Extend the existing resource owner with an actual policy-capture-to-input link.
 The fixed override hands the same capture occurrence to the native system slot.
 Other resource inputs are preserved, not removed to manufacture coverage.
 */
function createPolicyLoader({
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
 if((readSessionConstructedInputs!==undefined)&&(typeof readSessionConstructedInputs)!=='function')throw new PolicySlotBindingError('Constructed inputs require a fixed native session reader');
 if(((readResourceToolInputs===undefined)!==(readResourceToolOrigin===undefined))||(readResourceToolInputs!==undefined)&&((typeof readResourceToolInputs)!=='function'||(typeof readResourceToolOrigin)!=='function'))throw new PolicySlotBindingError('Resource tool inputs require paired fixed native readers');
 if((readResourceToolInputs!==undefined)&&(typeof readResourceToolUsage)!=='function'||(readSessionInputUsage!==undefined)&&(typeof readSessionInputUsage)!=='function')throw new PolicySlotBindingError('Input budgets require fixed native usage readers');
 const options=copyOptions(inputOptions);
 const registration=copyAuthorityRegistration(authority);
 const hostRegistration=copyAuthorityRegistration(customPromptAuthority);
 if(hostRegistration&&(systemSlot||typeof options.systemPrompt!=='string'
   ||options.systemPromptOverride!==undefined))throw new PolicySlotBindingError('Host prompt authority requires explicit systemPrompt text without a replacement callback');
 const hostPrompt=(!systemSlot)&&(typeof options.systemPrompt)==='string'&&(options.systemPromptOverride===undefined)?Object.freeze({
   kind:'bootstrap-host-custom-prompt',
   content:options.systemPrompt,
   sha256:createHash('sha256').update(options.systemPrompt).digest('hex'),
   occurrence:Object.freeze({}),
   registration:hostRegistration
 }):undefined;
 if(systemSlot&&((options.systemPromptOverride!==undefined)||(options.systemPrompt!==undefined)))throw new PolicySlotBindingError('An existing system override cannot be silently replaced');
 let binding,contextPublication,emission,failure,loader;
 let retainedResourceReceipts=Object.freeze([]);
 const contextEmitter=systemSlot?undefined:createGoverningContextEmitter({
   callback:options.agentsFilesOverride,
   readSource:function captureDesignatedPolicy() { return (owner.captureGoverningPolicy(loader)); }
 });
 function systemPromptOverride(previous){
  const source=owner.captureGoverningPolicy(loader);
  if((previous!==undefined)&&(previous!==source.content))throw new PolicySlotBindingError('Existing native system instructions cannot be removed to qualify this source profile');
  emission=Object.freeze({source});
  return source.content;
 }
 loader=owner.create(systemSlot?{
   ...options,
   systemPromptOverride
 }:{
   ...options,
   agentsFilesOverride:contextEmitter.emit
 });
 owner.designateGoverningPolicy({
   ...policy,
   loader
 });
 const nativeBinding=owner.bindNativeLoader(loader);
 function assertCurrent(value){
  if((value!==binding)||(!binding))throw new PolicySlotBindingError('Policy input link is not this loader original binding');
  if(failure)throw new PolicySlotBindingError(
    'Original policy input link lost eligibility',
    {cause:failure.cause}
  );
  try{
   if(readBoundResourceFrame({
     binding:nativeBinding,
     loader
   })!==binding.frame)throw new PolicySlotBindingError('Original resource input frame changed');
   if(owner.captureGoverningPolicy(loader)!==binding.source)throw new PolicySlotBindingError('Original selected policy capture changed');
   contextPublication?.assertCurrent();
   if(hostPrompt){
    const system=binding.frame
      .stages
      .find(function isCapturedSystemStage(stage) { return (stage.kind==='system'); });
    if((system?.before!==hostPrompt.content)||(system?.after!==hostPrompt.content))throw new PolicySlotBindingError('Native custom prompt does not retain the explicitly registered host text');
   }
  }catch(error){failure={cause:error};throw error;}
 }
 async function reload(options){
  binding=undefined;emission=undefined;failure=undefined;contextPublication=undefined;
  contextEmitter?.reset();
  await loader.reload(options);
  const frame=readBoundResourceFrame({
    binding:nativeBinding,
    loader
  });
  if(systemSlot){
   if((!emission)||(owner.captureGoverningPolicy(loader)!==emission.source))throw new PolicySlotBindingError('System input did not retain its selected policy capture');
   const system=frame.stages
     .find(function isReloadedSystemStage(value) { return (value.kind==='system'); });
   if(system?.after
     !==emission.source
     .content)throw new PolicySlotBindingError('Published system input differs from the owner-captured policy');
  }
  const source=systemSlot?emission.source:owner.captureGoverningPolicy(loader);
  const system=frame.stages
    .find(function isResourceSystemStage(value) { return (value.kind==='system'); });
  const resourceSystemInput=systemSlot||hostPrompt
    ||system.after===undefined?undefined:Object.freeze({
    kind:'native-resource-system-input',
    content:system.after,
    sha256:createHash('sha256').update(system.after).digest('hex'),
    occurrence:Object.freeze({}),
    registration:undefined,
    pathToRawFileIdentity:'not-established'
  });
  contextPublication=contextEmitter?.publish({
    nativeBinding,
    loader,
    frame,
    source
  });
  const contextCarriers=contextPublication?.carriers??Object.freeze([]);
  const carrierByOrdinal=new Map(contextCarriers.map(function indexContextCarrier(carrier) { return ([
    carrier.ordinal,
    carrier
  ]); }));
  const context=frame.stages
    .find(function isResourceContextStage(value) { return (value.kind==='context'); }),append=frame.stages
    .find(function isResourceAppendStage(value) { return (value.kind==='append'); });
  const singleCarrier=systemSlot&&context?.after.agentsFiles.length===0
    &&append?.after.length===0;
  const appendInputs=Object.freeze(append.after
    .map(function captureResourceAppendInput(content,ordinal) { return (Object.freeze({
   kind:'native-resource-append-input',content,ordinal,
   sha256:createHash('sha256').update(content).digest('hex'),occurrence:Object.freeze({}),
   registration:undefined,pathToRawFileIdentity:'not-established'
  })); }));
  const contextInputs=Object.freeze(context.after
    .agentsFiles
    .map(function captureResourceContextInput(entry,ordinal) { return (Object.freeze({
   kind:'native-resource-context-input',content:entry.content,path:entry.path,ordinal,entry,carrier:carrierByOrdinal.get(ordinal),
   sha256:createHash('sha256').update(entry.content).digest('hex'),occurrence:Object.freeze({}),
   registration:undefined,pathToRawFileIdentity:'not-established'
  })); }));
  retainedResourceReceipts=retainResourceReceiptInputs({
    previous:retainedResourceReceipts,
    current:createResourceReceiptInputs({frame,priorContext:contextPublication?.prior})
  });
  binding=Object.freeze({
    resourceReceiptInputs:retainedResourceReceipts,
    source,
    frame,
    resourceSystemInput,
    appendInputs,
    contextInputs,
    contextCarriers,
    priorContext:contextPublication?.prior,
    slot:systemSlot?'customPrompt':'governing-policy',
    singleCarrier,
    sourceOccurrenceLinked:systemSlot,
    otherInstructionCoverage:'not-established',
    permission:false
  });
  assertCurrent(binding);return binding;
 }
 function readCurrent(){assertCurrent(binding);return binding;}
 function bindCollector(context){
  return retainInput({base:owner.bindCollector({
    loader,
    context,
    readPolicy(){
   const {source}=readCurrent();return {identity:source.identity,content:source.content};
  }
  })});
 }
 function bindSessionCollector(session){return retainInput({
   base:owner.bindSessionCollector({session}),
   session
 });}
 function assertInputBudget(session){
  if(readResourceToolInputs===undefined)return;
  if(session&&(typeof readSessionInputUsage)!=='function')throw new PolicySlotBindingError('Combined resource and session input budgets require their native session usage reader');
  const resource=readResourceToolUsage(loader); const currentSession=session?readSessionInputUsage(session):{
    count:0,
    bytes:0
  };
  const receiptBytes=retainedResourceReceipts.reduce(
    function sumReceiptInputBytes(bytes,source) { return (bytes+Buffer.byteLength(JSON.stringify(source))); },
    0
  );
  assertOriginalInputBudget({
    resource:{count:resource.count+retainedResourceReceipts.length,bytes:resource.bytes+receiptBytes},
    session:currentSession
  });
 }
 function resourceInputs(){
  if(readResourceToolInputs===undefined)return undefined;
  const origins=readResourceToolInputs(loader);
  if((!Array.isArray(origins))||(!Object.isFrozen(origins))||(origins.length>64))throw new PolicySlotBindingError('Resource tool inputs require their original bounded native view');
  for(const origin of origins){
   const {
     source,
     publication,
     resourceInputOccurrence
   }=origin;
   if((readResourceToolOrigin({loader,publication})!==origin)||(resourceInputOccurrence===undefined)||(source.resourceInputOccurrence!==resourceInputOccurrence)||(publication.sourceOccurrence!==source.occurrence)||(source.kind!=='native-resource-tool-input')||(source.registration!==undefined)||(source.permission!==false))throw new PolicySlotBindingError('Resource tool input is not an original unregistered receipt of this loader');
  }
  if(readResourceToolInputs(loader)!==origins)throw new PolicySlotBindingError('Resource tool inputs changed during source binding');
  return origins;
 }
 function retainInput({
   base,
   session
 }){
  const snapshots=new WeakMap();
  function constructedInputs(run){return (run===undefined)&&session?readSessionConstructedInputs?.(session):undefined;}
  function domainEvents(){return session&&readSessionDomainEvents?readSessionDomainEvents(session):undefined;}
  function capture(options){
   const input=readCurrent(); const original=base.capture(options);
   assertCurrent(input);assertInputBudget(session);
   if(original.resourceInputObservation!==input.frame)throw new PolicySlotBindingError('Native collector belongs to another policy input resource frame');
   const independentContext=input.contextInputs
     .filter(function lacksContextCarrier(source) { return (source.carrier===undefined); });
   const forcedPromptInput=original.nativeRunComposition
     ?.forcedPromptInput;
   const promptGuidelineInputs=original.nativeRunComposition
     ?.promptGuidelineInputs;
   const toolGuidelineInputs=original.nativeRunComposition
     ?.toolGuidelineInputs;
   const mappedPromptInputs=original.nativeRunComposition
     ?.mappedPromptInputs;
   const replacementInputs=original.nativeRunComposition
     ?.replacementInputs;
   const skillDescriptionInputs=original.nativeRunComposition
     ?.skillDescriptionInputs;
   const nativeConstructedInputs=constructedInputs(original.nativeRunComposition); const nativeResourceToolInputs=resourceInputs();
   if((nativeResourceToolInputs!==undefined)&&(Buffer.byteLength(JSON.stringify({resourceInputObservation:original.resourceInputObservation,nativeResourceToolInputs}))>1048576))throw new PolicySlotBindingError('Combined resource inputs exceed the original one-MiB resource bound');
   if((nativeConstructedInputs!==undefined)&&(Buffer.byteLength(JSON.stringify({...original,nativeConstructedInputs}))>1048576))throw new PolicySlotBindingError('Base-linked source collection exceeds total byte bound');
   const runMessageInputs=collectNativeMessageInputs({
     nativeRunComposition:original.nativeRunComposition,
     nativeConstructedInputs
   });
   const builtInPromptInputs=original.nativeRunComposition
     ?.builtInPromptInputs;
   const runInputCarriers=linkRunInputCarriers({
     run:original.nativeRunComposition,
     input,
     hostPrompt
   });
   const retainedRunInputs=collectRetainedRunInputs({
     run:original.nativeRunComposition,
     represented:runMessageInputs
   });
   const governingSources=Object.freeze([
     ...(retainedRunInputs??[]).map(function readHistoricalRunSource(origin) { return (origin.source); }),
     input.source,
     ...input.resourceReceiptInputs,
     ...(hostPrompt?[hostPrompt]:[]),
     ...(input.resourceSystemInput?[input.resourceSystemInput]:[]),
     ...input.appendInputs,
     ...independentContext,
     ...(forcedPromptInput?[forcedPromptInput]:[]),
     ...(promptGuidelineInputs??[]),
     ...(toolGuidelineInputs??[]),
     ...(mappedPromptInputs??[]),
     ...(replacementInputs??[]),
     ...(skillDescriptionInputs??[]),
     ...runMessageInputs,
     ...(builtInPromptInputs??[]),
     ...(nativeResourceToolInputs??[]).map(function readResourceToolSource(origin) { return (origin.source); })
   ]);
   const nativeDomain=domainEvents();
   const snapshot=Object.freeze({
     ...original,
     nativeDomainEventKinds:nativeDomain?.kinds,
     nativeDomainEventObservation:nativeDomain?.observation,
     retainedRunInputs,
     resourceReceiptInputs:input.resourceReceiptInputs,
     nativeConstructedInputs,
     nativeResourceToolInputs,
     hostGoverningPolicy:input.source,
     hostPromptInput:hostPrompt,
     resourceSystemInput:input.resourceSystemInput,
     appendPromptInputs:input.appendInputs,
     contextPromptInputs:input.contextInputs,
     governingContextCarriers:input.contextCarriers,
     priorContextPublication:input.priorContext,
     forcedPromptInput,
     promptGuidelineInputs,
     toolGuidelineInputs,
     mappedPromptInputs,
     replacementInputs,
     skillDescriptionInputs,
     runMessageInputs,
     builtInPromptInputs,
     runInputCarriers,
     governingSources
   });
   if(constructedInputs(original.nativeRunComposition)!==nativeConstructedInputs)throw new PolicySlotBindingError('Original constructed inputs changed during source capture');
   if(resourceInputs()!==nativeResourceToolInputs)throw new PolicySlotBindingError('Resource tool inputs changed during source capture');
   assertInputBudget(session);
   snapshots.set(
     snapshot,
     {input,original,nativeConstructedInputs,nativeResourceToolInputs}
   );return snapshot;
  }
  /** Preserve selected dependencies while later authenticated receipts remain available to the next decision. */
  function assertApprovedSourcesCurrent({snapshot,saved}){
   assertCurrent(saved.input);assertInputBudget(session);
   if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Approved operation lost its original extension tool inputs');
   const current=base.capture();
   const currentConstructed=constructedInputs(current.nativeRunComposition);
   const nativeDomain=domainEvents();
   if(JSON.stringify(nativeDomain?.kinds)!==JSON.stringify(snapshot.nativeDomainEventKinds)
     ||nativeDomain?.observation?.occurrence!==snapshot.nativeDomainEventObservation?.occurrence
     ||nativeDomain?.observation?.failed
     ||(nativeDomain?.observation?.revision??0)<(snapshot.nativeDomainEventObservation?.revision??0))throw new PolicySlotBindingError('Approved operation lost its original native event runner or complete receipt accounting');
   assertCollectedManagerGrowth({before:saved.original,after:current});
   assertManagerOriginsAppended({before:saved.nativeConstructedInputs,after:currentConstructed});
   base.assertObservedFresh(current);
   if(constructedInputs(current.nativeRunComposition)!==currentConstructed)throw new PolicySlotBindingError('Approved operation inputs changed during dependency validation');
   assertCurrent(saved.input);assertInputBudget(session);
   if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Approved operation extension tool inputs changed during dependency validation');
  }
  function assertObservedFresh(snapshot){
   const saved=snapshots.get(snapshot);
   if(!saved)throw new PolicySlotBindingError('Governing snapshot is not owned by this source collector');
   if(saved.failure)throw new PolicySlotBindingError(
     'Original governing snapshot lost eligibility',
     {cause:saved.failure.cause}
   );
   try{
    if(saved.approved){assertApprovedSourcesCurrent({snapshot,saved});return;}
    assertCurrent(saved.input);assertInputBudget(session);
    if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Original extension tool inputs changed after source capture');
    if(constructedInputs(saved.original
      .nativeRunComposition)!==saved.nativeConstructedInputs)throw new PolicySlotBindingError('Original constructed inputs changed after source capture');
    const nativeDomain=domainEvents();
    if(JSON.stringify(nativeDomain?.kinds)!==JSON.stringify(snapshot.nativeDomainEventKinds))throw new PolicySlotBindingError("Native extension event membership changed after source capture");
    if(nativeDomain?.observation!==snapshot.nativeDomainEventObservation)throw new PolicySlotBindingError(`Native extension event callbacks changed after source capture: ${JSON.stringify({before:snapshot.nativeDomainEventObservation,after:nativeDomain?.observation})}`);
    base.assertObservedFresh(saved.original);
    if(constructedInputs(saved.original
      .nativeRunComposition)!==saved.nativeConstructedInputs)throw new PolicySlotBindingError('Original constructed inputs changed during source finalization');
    assertCurrent(saved.input);assertInputBudget(session);
    if(resourceInputs()!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Original extension tool inputs changed during source finalization');
   }catch(error){saved.failure??={cause:error};throw error;}
  }
  /** Called only at the original resolved approval handoff; never selects new sources or revives failed ones. */
  function retainApprovedSources(snapshot){
   assertObservedFresh(snapshot);
   const saved=snapshots.get(snapshot);
   if(saved.approved)throw new PolicySlotBindingError('Original selected sources were already retained for approved execution');
   saved.approved=true;
  }
  /** Bind one current governing snapshot after proving preservation of the owned emitted material. */
  function captureJudgmentSources({
    original,
    signal,
    extend=false
  }){
   const saved=snapshots.get(original);
   if(!saved)throw new PolicySlotBindingError('Judgment source handoff requires this collector original snapshot');
   if(saved.failure)throw new PolicySlotBindingError(
     'Original governing snapshot lost eligibility',
     {cause:saved.failure.cause}
   );
   if(saved.capturingJudgment){
    const error=new PolicySlotBindingError('Original judgment source capture cannot reenter');
    saved.failure={cause:error};throw error;
   }
   saved.capturingJudgment=true;
   try{
    assertCurrent(saved.input);
    if(saved.judgmentSources!==undefined&&(!extend||domainEvents()?.observation===saved.judgmentSources.nativeDomainEventObservation)){
     assertObservedFresh(saved.judgmentSources);
     if(saved.failure)throw new PolicySlotBindingError(
       'Original governing snapshot lost eligibility',
       {cause:saved.failure.cause}
     );
     return saved.judgmentSources;
    }
    const previous=saved.judgmentSources===undefined?saved:snapshots.get(saved.judgmentSources);
    if(previous.failure)throw new PolicySlotBindingError('Original prepared source collection lost eligibility',{cause:previous.failure.cause});
    const previousSnapshot=saved.judgmentSources??original;
    const current=capture({signal}); const next=snapshots.get(current);
    if(next.input!==saved.input)throw new PolicySlotBindingError('Judgment source handoff cannot replace its original policy binding');
    if(next.nativeResourceToolInputs!==saved.nativeResourceToolInputs)throw new PolicySlotBindingError('Manager-only judgment handoff cannot adopt new extension tool receipts');
    if(JSON.stringify(current.nativeDomainEventKinds)!==JSON.stringify(previousSnapshot.nativeDomainEventKinds)
      ||current.nativeDomainEventObservation?.occurrence!==previousSnapshot.nativeDomainEventObservation?.occurrence)
      throw new PolicySlotBindingError('Judgment source handoff cannot replace native event membership or its original runner');
    assertCollectedManagerGrowth({
      before:previous.original,
      after:next.original
    });
    assertManagerOriginsAppended({
      before:previous.nativeConstructedInputs,
      after:next.nativeConstructedInputs
    });
    assertObservedFresh(current);
    if(saved.failure)throw new PolicySlotBindingError(
      'Original governing snapshot lost eligibility',
      {cause:saved.failure.cause}
    );
    saved.judgmentSources=current;return current;
   }catch(error){saved.failure??={cause:error};throw error;}
   finally{saved.capturingJudgment=false;}
  }
  return Object.freeze({
    capture,
    assertObservedFresh,
    retainApprovedSources,
    captureJudgmentSources
  });
 }
 return new SystemPolicyInput({
   key:constructionKey,
   state:Object.freeze({loader,nativeBinding,reload,readCurrent,assertCurrent,registration,hostPrompt,bindCollector,bindSessionCollector})
 });
}

/** Select governing policy without replacing any native prompt or context input. */
export function createGoverningPolicyLoader(input){return createPolicyLoader({
  ...input,
  systemSlot:false
});}
/** Feed the same policy capture through a fixed system callback for the narrow placement profile. */
export function createSystemPolicyLoader(input){return createPolicyLoader({
  ...input,
  systemSlot:true
});}
