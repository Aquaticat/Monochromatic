import {
  isDeepStrictEqual,
  types
} from 'node:util';
import {readHandlerPayloadPublication} from '../../collector/run-prompt-custody-v3/handler-publication.mjs';
import {
  streamSimple,
  readNativeSerializedPayload,
  readNativeSystemPayload
} from "./generated/openai-stream.mjs";

export class NativeSourceAssociationError extends Error {}

/** Slots with fixed native rendering; rule additions also require their captured insertion result. */
const nativeFragmentSections=Object.freeze({
  'default-preamble':'preamble',
  'tool-discovery-guidance':'tools',
  'documentation-guidance':'docs',
  'project-context-introduction':'project_context',
  'skill-usage-guidance':'skills',
  'default-rule':'rules'
});

/** Fixed privately instrumented native serializer, not a caller-labelled stream implementation. */
export const nativeOpenAIStream=streamSimple;

/** Restrict custody copies to ordinary data without serialization hooks. */
function dataRecord(value){
 return (value!==null)
   &&((typeof value)==='object')
   &&(!types.isProxy(value))
   &&(Object.getPrototypeOf(value)===Object.prototype)
   &&(!('toJSON' in value))
   &&Reflect.ownKeys(value)
   .every(function isEnumerableOwnDataField(key) { return (((typeof key)==='string')
     &&Object.getOwnPropertyDescriptor(
    value,
    key
  )
     .enumerable
     &&Object.hasOwn(
    Object.getOwnPropertyDescriptor(
      value,
      key
    ),
    'value'
  )); });
}
function denseArray(value){
 return (!types.isProxy(value))
   &&Array.isArray(value)
   &&(Object.getPrototypeOf(value)===Array.prototype)
   &&(!('toJSON' in value))
   &&(Reflect.ownKeys(value)
     .length
     ===(value.length
     +1))
   &&Array.from(
    {length:value.length},
    function readContributionIndexDescriptor(
      _,
      index
    ) { return (Object.getOwnPropertyDescriptor(
      value,
      String(index)
    )); }
  )
   .every(function isOwnDataDescriptor(item) { return (item?.enumerable&&Object.hasOwn(
    item,
    'value'
  )); });
}

/** Native custom sections replace only truthy addendum or project-context fields. */
function promptInputShadowed({
  field,
  sections
}){
 return ((field==='appendSystemPrompt')&&Boolean(sections.addendum))||((field==='contextFiles')&&Boolean(sections.project_context));
}

/** Shared native envelope restrictions remain independent of any particular source route. */
function envelopeReason({
  model,
  context,
  options
}){
 if((model.compat
   ?.supportsMidConvoSystemMessages
   ===true)||(model.samplingParams!==undefined)
   ||(model.samplingParamsByThinkingLevel!==undefined)
   ||(options?.samplingParams!==undefined))return 'Transcript or sampling overrides are outside this serializer-association profile';
 if((!dataRecord(context))||(Object.keys(context)
   .length
   !==1)
   ||(!Object.hasOwn(
     context,
     'messages'
   )))return 'Source association requires the native normalized message-only context';
 if((!denseArray(context.messages))||(!context.messages
   .every(dataRecord)))return 'Serializer message envelopes require ordinary data fields for source association';
 return undefined;
}

/** Resolve actual payload capabilities through original active or retained-input publication membership. */
function messageOrigin({
  sources,
  message
}){
 const publication=readHandlerPayloadPublication(message);
 const run=sources.nativeRunComposition;
 if((!publication)||(!run))return undefined;
 const emittingRun=[
   run,
   ...run.ancestors
 ].find(function matchesRunPublication(value) { return ((value.occurrence===publication.runOccurrence)&&((value.expandedPromptPublication===publication)
   ||value.handlerPublications
   ?.includes(publication))); });
 const expanded=emittingRun?.expandedPromptPublication===publication;
 const retained=(run.retainedMessageOrigins??[]).find(function matchesConstructedPublication(origin) { return (origin.publication===publication); });
 const source=expanded?emittingRun.expandedPromptInput:emittingRun?.handlerMessageInputs
   .find(function matchesOriginalSourceOccurrence(value) { return (value.occurrence===publication.sourceOccurrence); })
   ??retained?.source;
 if((!source)||(!sources.governingSources
   .includes(source)))return undefined;
 return Object.freeze({
   source,
   sourceOccurrence:source.occurrence,
   run,
   ...(emittingRun?{emittingRun}:{retainedMessageOrigin:retained}),
   ...(source.kind==='native-run-expanded-prompt-input'?{expandedPromptPublication:publication}:{handlerPublication:publication})
 });
}

/**
 Link one full native sections publication to its existing input occurrences.
 Each contribution remains partial; no source acquires authority over the composite.
 */
function originalContributions({
  sources,
  model,
  context,
  options
}){
 const run=sources.nativeRunComposition;
 const publication=run?.systemPublication;
 if(!run)return {reason:'No original native run publication'};
 const unsupported=envelopeReason({
   model,
   context,
   options
 });
 if(unsupported)return {reason:unsupported};
 const system=context.messages
   .filter(function isSystemMessage(message) { return (message.role==='system'); });
 if(run.options
   .forceSystemPrompt
   !==undefined){
  const source=run.forcedPromptInput;
    const {forcedPublication} = run;
  if((!source)||(!forcedPublication)
    ||(forcedPublication.source!==source)
    ||(!sources.governingSources
      .includes(source)))return {reason:'No original forced-prompt publication'};
  if((system.length!==1)||(!forcedPublication.matchesMessage(system[0])))return {reason:'Forced message is not the original native projection'};
  if((source.content
    .length
    === 0)||(!source.content
      .isWellFormed()))return {reason:'Forced input has no supported unchanged textual contribution'};
  return {origins:Object.freeze([Object.freeze({
    source,
    sourceOccurrence:source.occurrence,
    run,
    forcedPublication
  })])};
 }
 if(!publication?.complete)return {reason:'No original full sections publication in this run'};
 if(system.some(function hasSystemMessageContent(message) { return ((message.content!=='')&&(message.content!==undefined)); }))return {reason:'Independent system content remains outside this sections-only association profile'};
 const represented=system.filter(function hasSystemMessageSections(message) { return (message.sections!==undefined); });
 if(represented.length!==1)return {reason:'The serializer input does not contain one sections publication'};
 if(!dataRecord(represented[0]
   .sections))return {reason:'Serializer sections require ordinary data fields for source association'};
 if(!publication.matchesSections(represented[0]
   .sections))return {reason:'The serializer input sections are not the original published object'};
 if(Object.values(represented[0]
   .sections)
   .some(function isUnsupportedSystemText(text) { return (((typeof text)!=='string')||(!text.isWellFormed())); }))return {reason:'Section text requires an unsupported serializer transformation'};
 const byOccurrence=new Map(sources.governingSources
   .map(function indexSourceByOccurrence(source) { return ([
     source.occurrence,
     source
   ]); }));
   const origins=[];
 for(const runCarrier of sources.runInputCarriers){
  if(runCarrier.carrier
    .runOccurrence
    !==publication.runOccurrence)throw new NativeSourceAssociationError('Original base carrier belongs to a different rendered run');
  const {
    field,
    ordinal
  }=runCarrier.carrier
    .inputLocation;
  if(![
    'customPrompt',
    'appendSystemPrompt',
    'contextFiles'
  ].includes(field))throw new NativeSourceAssociationError('Original base carrier has an unsupported native field');
  if(promptInputShadowed({
    field,
    sections:run.options
      .sections
  })||((field!=='contextFiles')
    &&(!run.options[field])))continue;
  for(const occurrence of runCarrier.sourceOccurrences){
   const source=byOccurrence.get(occurrence);
   if(!source)throw new NativeSourceAssociationError('Original base carrier source is outside the captured source set');
   // Empty custom prompts select native defaults; empty input text supplies no textual contribution.
   if(source.content
     .length
     ===0)continue;
   const carrier=field==='contextFiles'?sources.governingContextCarriers
     .find(function matchesContextCarrier(value) { return ((value.ordinal===ordinal)&&(value.source===source)); }):undefined;
   origins.push(Object.freeze({
     source,
     runCarrier,
     sourceOccurrence:occurrence,
     publication,
     ...(carrier?{carrier}:{})
   }));
  }
 }
 for(const source of run.replacementInputs){
  if((source.runOccurrence!==run.occurrence)||(byOccurrence.get(source.occurrence)!==source))throw new NativeSourceAssociationError('Run replacement is not this original captured source');
  if(![
    'customPrompt',
    'appendSystemPrompt',
    'contextFiles'
  ].includes(source.inputLocation
    .field))throw new NativeSourceAssociationError('Run replacement has an unsupported prompt-input field');
  if((source.content
    .length
    ===0)||promptInputShadowed({
    field:source.inputLocation
      .field,
    sections:run.options
      .sections
  }))continue;
  origins.push(Object.freeze({
    source,
    sourceOccurrence:source.occurrence,
    publication,
    run
  }));
 }
 for(const source of run.mappedPromptInputs){
  const {
    field,
    key
  }=source.inputLocation;
  if(![
    'sections',
    'toolSnippets'
  ].includes(field))throw new NativeSourceAssociationError('Mapped prompt input has an unsupported native field');
  if((source.runOccurrence!==run.occurrence)||(byOccurrence.get(source.occurrence)!==source))throw new NativeSourceAssociationError('Tool snippet or custom section is not this original captured source');
  if(source.content
    .length
    ===0)continue;
  if((field==='toolSnippets')&&(run.options
    .customPrompt
    ||run.options
    .sections
    .tools
    ||(!run.options
      .selectedTools
      .includes(key))
    ||run.options
    .hiddenTools
    ?.includes(key)))continue;
  origins.push(Object.freeze({
    source,
    sourceOccurrence:source.occurrence,
    publication,
    run
  }));
 }
 // Hidden readers still support native indirect skill loading; declaration visibility is not availability here.
 const hasSkillReader=run.options
   .selectedTools
   .some(function isNativeReadOrBash(name) { return ((name==='read')||(name==='bash')); });
 for(const source of run.skillDescriptionInputs){
  if((source.runOccurrence!==run.occurrence)||(byOccurrence.get(source.occurrence)!==source))throw new NativeSourceAssociationError('Skill description is not this original captured source');
  const skill=run.options
    .skills[source.inputLocation
      .ordinal];
  if((!skill)||(skill.description!==source.content))throw new NativeSourceAssociationError('Skill description differs from its original run input');
  if((!hasSkillReader)
    ||skill.disableModelInvocation
    ||(source.content
      .length
      ===0)
    ||run.options
    .sections
    .skills)continue;
  origins.push(Object.freeze({
    source,
    sourceOccurrence:source.occurrence,
    publication,
    run
  }));
 }
 for(const guidelines of [
   run.promptGuidelineInputs,
   run.toolGuidelineInputs
 ]){
  for(const source of guidelines){
   if((source.runOccurrence!==run.occurrence)||(byOccurrence.get(source.occurrence)!==source))throw new NativeSourceAssociationError('Guideline is not this original captured source');
   if((source.nativeRuleInsertion!=='inserted')
     ||run.options
     .sections
     .rules)continue;
   if((!run.renderOccurrence)||(source.renderOccurrence!==run.renderOccurrence)
     ||(publication.renderOccurrence!==run.renderOccurrence))throw new NativeSourceAssociationError('Guideline insertion is not from this original render');
   origins.push(Object.freeze({
     source,
     sourceOccurrence:source.occurrence,
     publication,
     run
   }));
  }
 }
 for(const source of run.builtInPromptInputs){
  const {slot} = source.inputLocation;
  // Other generated fragments need their own native emission evidence; retention is not visibility.
  if(!Object.hasOwn(
    nativeFragmentSections,
    slot
  ))continue;
  if((source.runOccurrence!==run.occurrence)||(source.renderOccurrence!==run.renderOccurrence)
    ||(publication.renderOccurrence!==run.renderOccurrence)
    ||(byOccurrence.get(source.occurrence)!==source))throw new NativeSourceAssociationError('Native fragment is not this original render and source');
  if((slot==='default-rule')&&(source.nativeRuleInsertion!=='inserted'))continue;
  if(run.options
    .sections[nativeFragmentSections[slot]])continue;
  origins.push(Object.freeze({
    source,
    sourceOccurrence:source.occurrence,
    publication,
    run
  }));
 }
 return origins.length > 0?{origins:Object.freeze(origins)}:{reason:'No original nonempty prompt input is represented by this publication'};
}

/**
 Attach one historical contribution at the observer's existing JSON validation.
 A source-aware custody copy closes callback alias races without freezing borrowed objects.
 */
export function prepareNativeSourceAssociation({
  sources,
  model,
  context,
  options
}){
 const {
   origins,
   reason
 }=originalContributions({
   sources,
   model,
   context,
   options
 });
 const messageEligible=envelopeReason({
   model,
   context,
   options
 })===undefined;
 const previous=options?.onPayload;
 const originalMessages=context.messages;
 let owned=[];
   let unresolvedHandlers=[];
   let called=false;
   let sealed=false;
   let payloadOriginFailure;
 async function onPayload(
   payload,
   selectedModel
 ){
  if(called)throw new NativeSourceAssociationError('Native source association cannot reuse a payload occurrence');
  called=true;
  const origin=readNativeSerializedPayload(payload);
  const originalPayload=(origin!==undefined)&&(origin.messages===originalMessages)
    &&(origin.model===selectedModel)
    &&(selectedModel.id===model.id)
    &&(selectedModel.provider===model.provider)
    &&(selectedModel.api===model.api);
  if(!originalPayload)payloadOriginFailure='Request payload lacks the original native serializer occurrence for this captured transcript and model';
  const candidates=[];
  if(originalPayload&&dataRecord(payload)
    &&denseArray(payload.messages)){
   const original=payload.messages[0];
   const systemSerialization=readNativeSystemPayload(original);
   const originalSystem=(systemSerialization!==undefined)
     &&(systemSerialization.messages===origin.normalizedMessages)
     &&(systemSerialization.text===original?.content);
   if(origins&&!originalSystem)payloadOriginFailure??='System content lacks its original native rendering and message emission';
   if(origins&&dataRecord(original)
     &&originalSystem
     &&((typeof original.content)==='string')
     &&[
       'system',
       'developer'
     ].includes(original.role)){
    candidates.push({
      original,
      content:original.content,
      role:original.role,
      associations:origins,
      serialization:systemSerialization,
      system:true
    });
   }
   if(messageEligible){
    for(const message of payload.messages){
     if((!dataRecord(message))||(message.role!=='user'))continue;
     const association=messageOrigin({
       sources,
       message
     });
     if(!association)continue;
     // These new text containers are owned snapshots, not aliases held by a payload callback.
     const content=Object.freeze(message.content
       .map(function freezeContributionPart(part) { return (Object.freeze({...part})); }));
     candidates.push({
       original:message,
       content,
       role:message.role,
       associations:Object.freeze([association]),
       system:false
     });
    }
   }
  }
  const replacement=previous?await Reflect.apply(
    previous,
    this,
    [
      payload,
      selectedModel
    ]
  ):undefined;
  const selected=replacement===undefined?payload:replacement;
  const ordinary=dataRecord(selected)&&denseArray(selected.messages);
    const retained=[];
  for(const candidate of candidates){
   const positions=ordinary?selected.messages
     .flatMap(function findOriginalMessageIndex(
       message,
       index
     ) { return (message===candidate.original?[index]:[]); }):[];
   const {original} = candidate;
   // Observe known message aliases even when their descriptor shape no longer qualifies for a copy.
   const handlerCurrent=candidate.system||(candidate.associations[0]
     .handlerPublication
     ??candidate.associations[0]
     .expandedPromptPublication).matchesPayload(original);
   const unchanged=handlerCurrent&&(positions.length===1)
     &&dataRecord(original)
     &&(original.role===candidate.role)
     &&(candidate.system?original.content===candidate.content:isDeepStrictEqual(
       original.content,
       candidate.content
     ));
   if(!unchanged){
    if(!candidate.system)unresolvedHandlers.push(Object.freeze({
     location:Object.freeze(positions.length===1?{
       field:'messages',
       ordinal:positions[0],
       property:'content'
     }:{field:'messages'}),
     reason:'The payload callback removed, replaced or changed an original message contribution; its original source cannot authenticate the replacement.'
    }));
    continue;
   }
   retained.push({
     ordinal:positions[0],
     message:Object.freeze({
       ...original,
       content:candidate.content
     }),
     associations:candidate.associations,
     serialization:candidate.serialization,
     system:candidate.system
   });
  }
  owned=retained;
  if(retained.length === 0)return replacement;
  const replacements=new Map(retained.map(function indexMessageReplacement(record) { return ([
    record.ordinal,
    record.message
  ]); }));
  const messages=Object.freeze(selected.messages
    .map(function applyMessageReplacement(
      message,
      index
    ) { return (replacements.get(index)??message); }));
  return Object.freeze({
    ...selected,
    messages
  });
 }
 function seal(parsed){
  if(sealed)throw new NativeSourceAssociationError('Native source contribution was already sealed');
  sealed=true;
  const expected=owned;
  const missing=unresolvedHandlers;
  owned=[];unresolvedHandlers=[];
  const result=[];
  function append({
    ordinal,
    associations,
    why,
    serialization
  }){
   const location=Object.freeze({
     field:'messages',
     ordinal,
     property:'content'
   });
   for(const association of associations)result.push(Object.freeze({
     contribution:Object.freeze({}),
     location,
     association,
     ...(serialization?{serialization}:{}),
     reason:why,
     coverage:'partial-original-prompt-input-contribution',
     permission:false
   }));
  }
  const system=expected.find(function readSystemReceipt(record) { return (record.system); });
    const systemOrdinal=system?.ordinal??0;
    const systemMessage=parsed.messages?.[systemOrdinal];
  if(systemMessage&&[
    'system',
    'developer'
  ].includes(systemMessage.role)
    &&((typeof systemMessage.content)==='string')){
   const associated=(system!==undefined)&&(systemMessage.role
     ===system.message
     .role)
     &&(systemMessage.content
       ===system.message
       .content);
   append({
     ordinal:systemOrdinal,
     associations:associated?system.associations:[undefined],
     serialization:associated?system.serialization:undefined,
     why:associated?undefined:payloadOriginFailure??reason
       ??'The payload callback replaced or changed the original native contribution'
   });
  }
  for(const record of expected){
   if(record.system)continue;
   const message=parsed.messages?.[record.ordinal];
   const associated=(message?.role
     ===record.message
     .role)&&isDeepStrictEqual(
     message.content,
     record.message
       .content
   );
   append({
     ordinal:record.ordinal,
     associations:associated?record.associations:[undefined],
     why:associated?undefined:'Serialized message content differs from its owned original payload'
   });
  }
  for(const item of missing)result.push(Object.freeze({
    contribution:Object.freeze({}),
    location:item.location,
    association:undefined,
    reason:item.reason,
    coverage:'partial-original-prompt-input-contribution',
    permission:false
  }));
  return Object.freeze(result);
 }
 return Object.freeze({
   onPayload,
   seal
 });
}
