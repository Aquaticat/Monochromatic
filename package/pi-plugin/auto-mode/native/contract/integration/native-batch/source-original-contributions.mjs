import {NativeSourceAssociationError} from './source-association-error.mjs';
import {dataRecord,envelopeReason} from './source-association-shape.mjs';

//region Original section contributions retain their native visibility and source occurrence.
/** Slots with fixed native rendering; rule additions also require their captured insertion result. */
const nativeFragmentSections=Object.freeze({
  'default-preamble':'preamble',
  'tool-discovery-guidance':'tools',
  'documentation-guidance':'docs',
  'project-context-introduction':'project_context',
  'skill-usage-guidance':'skills',
  'default-rule':'rules'
});

/** Native custom sections replace only truthy addendum or project-context fields. */
function promptInputShadowed({
  field,
  sections
}){
 return ((field==='appendSystemPrompt')&&Boolean(sections.addendum))||((field==='contextFiles')&&Boolean(sections.project_context));
}

/**
 Link one full native sections publication to its existing input occurrences.
 Each contribution remains partial; no source acquires authority over the composite.
 */
export function originalContributions({
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

//endregion
