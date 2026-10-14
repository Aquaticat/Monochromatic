import {readAuthorityRegistration,readPolicyInput,readHostPromptInput} from './system-slot.mjs';
import {bindGoverningPolicySource,GoverningPolicyBindingError} from './governing-source.mjs';
import {bindRunMessageSources} from './run-messages.mjs';
import {bindRetainedRunSources} from './run-history.mjs';
import {bindResourceReceiptSources} from './resource-receipt-bindings.mjs';

/**
 * Extend the original source binding with explicitly configured host prompt text.
 * Native base custody establishes inclusion of this input, not authority for the
 * rendered composite, other resource inputs, or extension-produced instructions.
 */
function bindHostPromptSource({policyInput,governing}){
 const source=readHostPromptInput(policyInput);
 if(!source)return undefined;
 const link=readPolicyInput(policyInput),request=governing.view.request,base=request.sources.nativeBaseComposition;
 governing.assertCurrent(governing.view);
 if(request.sources.hostPromptInput!==source)throw new GoverningPolicyBindingError('Host prompt input is not this original resource capture');
 const nativeBaseLinked=Boolean(base&&base.resourceFrame===link.frame&&base.options.customPrompt===source.content);
 if(source.registration&&!nativeBaseLinked)throw new GoverningPolicyBindingError('Registered host prompt requires its original native base and resource publication');
 const view=Object.freeze({
  kind:'original-host-custom-prompt-view',source,sourceOccurrence:source.occurrence,request,nativeBaseLinked,
  authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
 });
 const registration=source.registration;
 const authority=registration?Object.freeze({
  kind:'registered-instruction-authority',registration,sourceOccurrence:source.occurrence,
  tier:registration.tier,priority:registration.priority,
  scope:Object.freeze({kind:registration.scope,request}),
  completeGoverningCoverage:false,permission:false
 }):undefined;
 function assertCurrent(value){
  if(value!==view)throw new GoverningPolicyBindingError('Host prompt view is not this original source binding');
  governing.assertCurrent(governing.view);
  if(readHostPromptInput(policyInput)!==source||readPolicyInput(policyInput)!==link)throw new GoverningPolicyBindingError('Original registered host prompt binding changed');
 }
 function assertAuthorityCurrent(value){
  if(!authority||value!==authority)throw new GoverningPolicyBindingError('Authority is not this original host prompt registration');
  assertCurrent(view);
 }
 assertCurrent(view);
 return Object.freeze({view,authority,assertCurrent,assertAuthorityCurrent});
}

/**
 * Bind unregistered resource-loader system output without authenticating a raw file.
 * Discovered text and replacement callbacks retain their actual resource publication.
 */
function bindResourceSystemSource({policyInput,governing}){
 const link=readPolicyInput(policyInput),source=link.resourceSystemInput,request=governing.view.request;
 governing.assertCurrent(governing.view);
 if(request.sources.resourceSystemInput!==source)throw new GoverningPolicyBindingError('System input is not this original resource capture');
 if(!source)return undefined;
 const base=request.sources.nativeBaseComposition;
 const nativeBaseLinked=Boolean(base&&base.resourceFrame===link.frame&&base.options.customPrompt===source.content);
 const view=Object.freeze({
  kind:'original-resource-system-view',source,sourceOccurrence:source.occurrence,request,nativeBaseLinked,
  authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
 });
 function assertCurrent(value){
  if(value!==view)throw new GoverningPolicyBindingError('System view is not this original resource binding');
  governing.assertCurrent(governing.view);
  if(readPolicyInput(policyInput)!==link)throw new GoverningPolicyBindingError('Original resource system publication changed');
 }
 assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
}

/**
 * Retain each original appended input without assigning authority from its slot.
 * Paths remain unpaired metadata; equal text does not merge source occurrences.
 */
function bindAppendPromptSources({policyInput,governing}){
 const link=readPolicyInput(policyInput),sources=link.appendInputs,request=governing.view.request;
 governing.assertCurrent(governing.view);
 if(request.sources.appendPromptInputs!==sources)throw new GoverningPolicyBindingError('Append inputs are not this original resource capture');
 const base=request.sources.nativeBaseComposition;
 const nativeBaseLinked=Boolean(base&&base.resourceFrame===link.frame&&base.options.appendSystemPrompt===sources.map(source=>source.content).join('\n\n'));
 return sources.map(source=>{
  const view=Object.freeze({
   kind:'original-append-prompt-view',source,sourceOccurrence:source.occurrence,request,nativeBaseLinked,
   authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Append view is not this original input binding');
   governing.assertCurrent(governing.view);
   if(readPolicyInput(policyInput)!==link)throw new GoverningPolicyBindingError('Original append input publication changed');
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}

/**
 * Keep native context entries distinct from explicitly selected governing files.
 * Neither an observed path nor equal bytes prove a shared raw-file occurrence.
 */
function bindContextPromptSources({policyInput,governing}){
 const link=readPolicyInput(policyInput),sources=link.contextInputs,request=governing.view.request;
 governing.assertCurrent(governing.view);
 if(request.sources.contextPromptInputs!==sources||request.sources.governingContextCarriers!==link.contextCarriers)throw new GoverningPolicyBindingError('Context inputs or carriers are not this original resource capture');
 const base=request.sources.nativeBaseComposition,files=base?.options.contextFiles;
 const nativeBaseLinked=Boolean(base&&base.resourceFrame===link.frame&&files.length===sources.length&&sources.every((source,index)=>files[index].path===source.path&&files[index].content===source.content));
 return sources.filter(source=>source.carrier===undefined).map(source=>{
  const view=Object.freeze({
   kind:'original-context-prompt-view',source,sourceOccurrence:source.occurrence,request,nativeBaseLinked,
   authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Context view is not this original input binding');
   governing.assertCurrent(governing.view);
   if(readPolicyInput(policyInput)!==link)throw new GoverningPolicyBindingError('Original context input publication changed');
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}

/** Forced text is an original run output, not authority inferred from its system-message position. */
function bindForcedPromptSource({governing}){
 const request=governing.view.request,run=request.sources.nativeRunComposition,source=run?.forcedPromptInput;
 governing.assertCurrent(governing.view);
 if(request.sources.forcedPromptInput!==source)throw new GoverningPolicyBindingError('Forced prompt input is not this original run publication');
 if(!source)return undefined;
 if(source.runOccurrence!==run.occurrence||source.content!==run.options.forceSystemPrompt)throw new GoverningPolicyBindingError('Forced prompt text differs from its original run input');
 const view=Object.freeze({
  kind:'original-forced-prompt-view',source,sourceOccurrence:source.occurrence,request,runOccurrence:run.occurrence,
  authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
 });
 function assertCurrent(value){
  if(value!==view)throw new GoverningPolicyBindingError('Forced prompt view is not this original input binding');
  governing.assertCurrent(governing.view);
 }
 assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
}

/** Native guideline entries retain their original published positions, not a model-assigned tier. */
function bindRunGuidelineSources({governing}){
 const request=governing.view.request,run=request.sources.nativeRunComposition,sources=run?.promptGuidelineInputs,toolSources=run?.toolGuidelineInputs;
 governing.assertCurrent(governing.view);
 if(request.sources.promptGuidelineInputs!==sources||request.sources.toolGuidelineInputs!==toolSources)throw new GoverningPolicyBindingError('Guidelines are not this original run publication');
 return [...(sources??[]),...(toolSources??[])].map(source=>{
  const tool=source.kind==='native-run-tool-guideline-input';
  const content=tool?run.options.toolGuidelines[source.inputLocation.toolName][source.inputLocation.ordinal]:run.options.promptGuidelines[source.ordinal];
  if(source.runOccurrence!==run.occurrence||source.content!==content)throw new GoverningPolicyBindingError('Guideline differs from its original published position');
  const view=Object.freeze({
   kind:tool?'original-run-tool-guideline-view':'original-run-guideline-view',source,sourceOccurrence:source.occurrence,request,runOccurrence:run.occurrence,
   authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Guideline view is not this original input binding');
   governing.assertCurrent(governing.view);
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}

/** Preserve mapped and replaced run text as original inputs, not authority or visibility. */
function bindMappedPromptSources({governing}){
 const request=governing.view.request,run=request.sources.nativeRunComposition,sources=run?.mappedPromptInputs,replacements=run?.replacementInputs;
 governing.assertCurrent(governing.view);
 if(request.sources.mappedPromptInputs!==sources||request.sources.replacementInputs!==replacements)throw new GoverningPolicyBindingError('Mapped or replacement inputs are not this original run publication');
 return [...(sources??[]),...(replacements??[])].map(source=>{
  const {field,key,ordinal}=source.inputLocation,replacement=source.kind==='native-run-replacement-input';
  const content=!replacement?run.options[field][key]:field==='contextFiles'?run.options.contextFiles[ordinal].content:run.options[field];
  if(source.runOccurrence!==run.occurrence||source.content!==content)throw new GoverningPolicyBindingError('Mapped or replacement input differs from its original published position');
  const view=Object.freeze({
   kind:replacement?'original-run-replacement-view':'original-run-mapped-prompt-view',source,sourceOccurrence:source.occurrence,request,runOccurrence:run.occurrence,
   authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Mapped prompt view is not this original input binding');
   governing.assertCurrent(governing.view);
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}

/** Skill descriptions retain their native companion metadata, never an inferred instruction tier. */
function bindSkillDescriptionSources({governing}){
 const request=governing.view.request,run=request.sources.nativeRunComposition,sources=run?.skillDescriptionInputs;
 governing.assertCurrent(governing.view);
 if(request.sources.skillDescriptionInputs!==sources)throw new GoverningPolicyBindingError('Skill descriptions are not this original run publication');
 return (sources??[]).map(source=>{
  const {description,...metadata}=run.options.skills[source.inputLocation.ordinal];
  if(source.runOccurrence!==run.occurrence||source.content!==description||source.inputLocation.metadataJSON!==JSON.stringify(metadata))throw new GoverningPolicyBindingError('Skill description or metadata differs from its original published position');
  const view=Object.freeze({
   kind:'original-run-skill-description-view',source,sourceOccurrence:source.occurrence,request,runOccurrence:run.occurrence,
   authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Skill description view is not this original input binding');
   governing.assertCurrent(governing.view);
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}

/** Actual native builder construction does not establish authority or final rendered visibility. */
function bindBuiltInPromptSources({governing}){
 const request=governing.view.request,run=request.sources.nativeRunComposition,sources=run?.builtInPromptInputs;
 governing.assertCurrent(governing.view);
 if(request.sources.builtInPromptInputs!==sources)throw new GoverningPolicyBindingError('Built-in fragments are not this original run publication');
 return (sources??[]).map((source,ordinal)=>{
  if(!run.renderOccurrence||source.renderOccurrence!==run.renderOccurrence||source.runOccurrence!==run.occurrence||source.inputLocation.ordinal!==ordinal)throw new GoverningPolicyBindingError('Built-in fragment has no original construction position');
  const view=Object.freeze({
   kind:'original-native-generated-prompt-view',source,sourceOccurrence:source.occurrence,request,
   runOccurrence:run.occurrence,renderOccurrence:run.renderOccurrence,
   authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Built-in view is not this original source binding');
   governing.assertCurrent(governing.view);
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}

/** Native resource registration receipts remain unregistered, including replaced or rejected declarations. */
function bindResourceToolSources({governing}){
 const request=governing.view.request,snapshot=governing.view.sources??request.sources;
 governing.assertCurrent(governing.view);
 return (snapshot.nativeResourceToolInputs??[]).map(origin=>{
  const {source,publication,resourceInputOccurrence}=origin;
  if(source.kind!=='native-resource-tool-input'||resourceInputOccurrence===undefined||source.resourceInputOccurrence!==resourceInputOccurrence||publication.sourceOccurrence!==source.occurrence||!snapshot.governingSources.includes(source))throw new GoverningPolicyBindingError('Extension tool input differs from its original resource-owned receipt');
  const view=Object.freeze({kind:'original-extension-tool-input-view',source,sourceOccurrence:source.occurrence,request,resourceInputOccurrence,resourceInputOrigin:origin,authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false});
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Extension tool view is not this original resource source');
   governing.assertCurrent(governing.view);
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}

/**
 * Bind the startup authority declaration to a proven original source/request link.
 * The declaration supplies policy; the view supplies custody. Neither supplies
 * rule meaning, delegation, complete governing coverage or execution permission.
 */
export function bindRegisteredPolicy(context){
 const {policyInput}=context;
 const source=bindGoverningPolicySource(context);
 const registration=readAuthorityRegistration(policyInput);
 const host=bindHostPromptSource({policyInput,governing:source});
 const resourceSystem=bindResourceSystemSource({policyInput,governing:source});
 const appended=bindAppendPromptSources({policyInput,governing:source});
 const contextSources=bindContextPromptSources({policyInput,governing:source});
 const instructionCarriers=readPolicyInput(policyInput).contextCarriers;
 const runInstructionCarriers=source.view.request.sources.runInputCarriers??Object.freeze([]);
 const forced=bindForcedPromptSource({governing:source});
 const guidelines=bindRunGuidelineSources({governing:source});
 const mapped=bindMappedPromptSources({governing:source});
 const skills=bindSkillDescriptionSources({governing:source});
 const messages=bindRunMessageSources({governing:source});
 const builtIn=bindBuiltInPromptSources({governing:source}),resourceTools=bindResourceToolSources({governing:source});
 const resourceReceipts=bindResourceReceiptSources({policyInput,governing:source});
 const retainedRuns=bindRetainedRunSources({governing:source});
 const additionalSources=Object.freeze([...retainedRuns,...resourceReceipts,...(host?[host]:[]),...(resourceSystem?[resourceSystem]:[]),...appended,...contextSources,...(forced?[forced]:[]),...guidelines,...mapped,...skills,...messages,...builtIn,...resourceTools]);
 if(!registration)return Object.freeze({...source,authority:undefined,additionalSources,instructionCarriers,runInstructionCarriers});
 const authority=Object.freeze({
  kind:'registered-instruction-authority',
  registration,sourceOccurrence:source.view.sourceOccurrence,
  tier:registration.tier,priority:registration.priority,
  scope:Object.freeze({kind:registration.scope,request:source.view.request}),
  completeGoverningCoverage:false,permission:false
 });
 function assertAuthorityCurrent(value){
  if(value!==authority)throw new GoverningPolicyBindingError('Authority is not this original startup registration binding');
  source.assertCurrent(source.view);
  if(readAuthorityRegistration(policyInput)!==registration)throw new GoverningPolicyBindingError('Original startup authority registration changed');
 }
 assertAuthorityCurrent(authority);
 return Object.freeze({...source,authority,assertAuthorityCurrent,additionalSources,instructionCarriers,runInstructionCarriers});
}
