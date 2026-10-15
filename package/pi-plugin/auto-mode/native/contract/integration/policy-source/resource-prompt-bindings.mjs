import {readPolicyInput,readHostPromptInput} from './system-slot.mjs';
import {GoverningPolicyBindingError} from './governing-source.mjs';

//region Retain original source occurrences and their owning publication checks.
/**
 Extend the original source binding with explicitly configured host prompt text.
 Native base custody establishes inclusion of this input, not authority for the
 rendered composite, other resource inputs, or extension-produced instructions.
 */
export function bindHostPromptSource({
  policyInput,
  governing
}){
 const source=readHostPromptInput(policyInput);
 if(!source)return undefined;
 const link=readPolicyInput(policyInput);
   const {request} = governing.view;
   const base=request.sources
     .nativeBaseComposition;
 governing.assertCurrent(governing.view);
 if(request.sources
   .hostPromptInput
   !==source)throw new GoverningPolicyBindingError('Host prompt input is not this original resource capture');
 const nativeBaseLinked=Boolean(base&&(base.resourceFrame===link.frame)
   &&(base.options
     .customPrompt
     ===source.content));
 if(source.registration&&(!nativeBaseLinked))throw new GoverningPolicyBindingError('Registered host prompt requires its original native base and resource publication');
 const view=Object.freeze({
   kind:'original-host-custom-prompt-view',
   source,
   sourceOccurrence:source.occurrence,
   request,
   nativeBaseLinked,
   authority:'not-established',
   priority:'not-established',
   completeGoverningCoverage:false,
   permission:false
 });
 const {registration} = source;
 const authority=registration?Object.freeze({
   kind:'registered-instruction-authority',
   registration,
   sourceOccurrence:source.occurrence,
   tier:registration.tier,
   priority:registration.priority,
   scope:Object.freeze({
     kind:registration.scope,
     request
   }),
   completeGoverningCoverage:false,
   permission:false
 }):undefined;
 /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Host prompt view is not this original source binding');
if((readHostPromptInput(policyInput)!==source)||(readPolicyInput(policyInput)!==link))throw new GoverningPolicyBindingError('Original registered host prompt binding changed');
}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Host prompt view is not this original source binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
 function assertAuthorityCurrent(value){
  if((!authority)||(value!==authority))throw new GoverningPolicyBindingError('Authority is not this original host prompt registration');
  assertCurrent(view);
 }
 assertCurrent(view);
 return Object.freeze({
   view,
   authority,
   assertBindingIdentity,
assertCurrent,
   assertAuthorityCurrent
 });
}

/**
 Bind unregistered resource-loader system output without authenticating a raw file.
 Discovered text and replacement callbacks retain their actual resource publication.
 */
export function bindResourceSystemSource({
  policyInput,
  governing
}){
 const link=readPolicyInput(policyInput);
   const source=link.resourceSystemInput;
   const {request} = governing.view;
 governing.assertCurrent(governing.view);
 if(request.sources
   .resourceSystemInput
   !==source)throw new GoverningPolicyBindingError('System input is not this original resource capture');
 if(!source)return undefined;
 const base=request.sources
   .nativeBaseComposition;
 const nativeBaseLinked=Boolean(base&&(base.resourceFrame===link.frame)
   &&(base.options
     .customPrompt
     ===source.content));
 const view=Object.freeze({
   kind:'original-resource-system-view',
   source,
   sourceOccurrence:source.occurrence,
   request,
   nativeBaseLinked,
   authority:'not-established',
   priority:'not-established',
   completeGoverningCoverage:false,
   permission:false
 });
 /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('System view is not this original resource binding');
if(readPolicyInput(policyInput)!==link)throw new GoverningPolicyBindingError('Original resource system publication changed');
}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('System view is not this original resource binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
 assertCurrent(view);return Object.freeze({
   view,
   authority:undefined,
   assertBindingIdentity,
assertCurrent
 });
}

/**
 Retain each original appended input without assigning authority from its slot.
 Paths remain unpaired metadata; equal text does not merge source occurrences.
 */
export function bindAppendPromptSources({
  policyInput,
  governing
}){
 const link=readPolicyInput(policyInput);
   const sources=link.appendInputs;
   const {request} = governing.view;
 governing.assertCurrent(governing.view);
 if(request.sources
   .appendPromptInputs
   !==sources)throw new GoverningPolicyBindingError('Append inputs are not this original resource capture');
 const base=request.sources
   .nativeBaseComposition;
 const nativeBaseLinked=Boolean(base&&(base.resourceFrame===link.frame)
   &&(base.options
     .appendSystemPrompt
     ===sources.map(function readAppendPromptContent(source) { return (source.content); })
     .join('\n\n')));
 return sources.map(function bindOriginalAppendPrompt(source) {
  const view=Object.freeze({
    kind:'original-append-prompt-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    nativeBaseLinked,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Append view is not this original input binding');
if(readPolicyInput(policyInput)!==link)throw new GoverningPolicyBindingError('Original append input publication changed');
}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Append view is not this original input binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
  assertCurrent(view);return Object.freeze({
    view,
    authority:undefined,
    assertBindingIdentity,
assertCurrent
  });
 });
}

/**
 Keep native context entries distinct from explicitly selected governing files.
 Neither an observed path nor equal bytes prove a shared raw-file occurrence.
 */
export function bindContextPromptSources({
  policyInput,
  governing
}){
 const link=readPolicyInput(policyInput);
   const sources=link.contextInputs;
   const {request} = governing.view;
 governing.assertCurrent(governing.view);
 if((request.sources
   .contextPromptInputs
   !==sources)||(request.sources
     .governingContextCarriers
     !==link.contextCarriers))throw new GoverningPolicyBindingError('Context inputs or carriers are not this original resource capture');
 const base=request.sources
   .nativeBaseComposition;
   const files=base?.options
     .contextFiles;
 const nativeBaseLinked=Boolean(base&&(base.resourceFrame===link.frame)
   &&(files.length===sources.length)
   &&sources.every(function matchesContextFileInput(
     source,
     index
   ) { return ((files[index]
     .path
     ===source.path)&&(files[index]
       .content
       ===source.content)); }));
 return sources.filter(function lacksGoverningCarrier(source) { return (source.carrier===undefined); })
   .map(function bindOriginalContextPrompt(source) {
  const view=Object.freeze({
    kind:'original-context-prompt-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    nativeBaseLinked,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Context view is not this original input binding');
if(readPolicyInput(policyInput)!==link)throw new GoverningPolicyBindingError('Original context input publication changed');
}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Context view is not this original input binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
  assertCurrent(view);return Object.freeze({
    view,
    authority:undefined,
    assertBindingIdentity,
assertCurrent
  });
 });
}

//endregion
