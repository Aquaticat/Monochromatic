import {describeMessageInput,collectNativeMessageInputs} from '../../collector/run-prompt-custody-v3/message-inputs.mjs';
import {GoverningPolicyBindingError} from './governing-source.mjs';

/** Bind original active and retained native inputs without promoting prior runs into active ancestry. */
export function bindRunMessageSources({governing}){
 const request=governing.view.request;
 governing.assertCurrent(governing.view);
 const snapshot=governing.view.sources??request.sources,run=snapshot.nativeRunComposition;
 const expected=collectNativeMessageInputs(snapshot),sources=snapshot.runMessageInputs;
 if(!Array.isArray(sources)||sources.length!==expected.length||sources.some((source,index)=>source!==expected[index]))throw new GoverningPolicyBindingError('Message inputs are not these original run publications');
 const publications=new Map((run?[...run.ancestors,run]:[]).map(value=>[value.occurrence,value]));
 return sources.map(source=>{
  const publication=publications.get(source.runOccurrence),expanded=source.kind==='native-run-expanded-prompt-input',handlerOptions=source.kind==='native-run-handler-options-input';
  const retained=(run?.retainedMessageOrigins??snapshot.nativeConstructedInputs??[]).find(origin=>origin.source===source),toolDescription=source.kind==='native-tool-description-input',loadoutOutput=source.kind==='native-tool-loadout-output',loadoutInput=source.kind==='native-tool-loadout-input',loadoutQuery=source.kind==='native-tool-loadout-query-input',sessionInput=source.kind==='native-session-message-input'||toolDescription||loadoutOutput||loadoutInput||loadoutQuery;
  if(sessionInput){
   if(!retained||source.sessionInputOccurrence===undefined||retained.sessionInputOccurrence!==source.sessionInputOccurrence||retained.publication.sessionInputOccurrence!==source.sessionInputOccurrence||retained.publication.sourceOccurrence!==source.occurrence)throw new GoverningPolicyBindingError('Session input is not this original manager-owned occurrence');
  }else if(retained){
   if(retained.runOccurrence!==source.runOccurrence||retained.publication.runOccurrence!==source.runOccurrence||retained.publication.sourceOccurrence!==source.occurrence)throw new GoverningPolicyBindingError('Retained message is not this original source publication');
  }else if(handlerOptions){
   const observation=publication?.handlerObservations?.[source.inputLocation.ordinal];
   if(!publication?.handlerOptionInputs?.includes(source)||!observation||observation.ordinal!==source.inputLocation.ordinal||source.contentFormat!=='native-content-json'||source.content!==JSON.stringify(observation.before.options))throw new GoverningPolicyBindingError('Callback options differ from their original run-owned input observation');
  }else if(expanded){
   if(publication?.expandedPromptInput!==source)throw new GoverningPolicyBindingError('Expanded prompt is not this original run input');
  }else{
   const message=publication?.emitterMessages?.[source.inputLocation.ordinal];
   if(!message)throw new GoverningPolicyBindingError('Handler message has no original emitting run position');
   const described=describeMessageInput(message);
   if(source.content!==described.content||source.contentFormat!==described.contentFormat||source.inputLocation.metadataJSON!==described.metadataJSON)throw new GoverningPolicyBindingError('Handler content or metadata differs from its original emitter publication');
  }
  const view=Object.freeze({
   kind:loadoutQuery?'original-tool-loadout-query-view':loadoutInput?'original-tool-loadout-input-view':loadoutOutput?'original-tool-loadout-output-view':toolDescription?'original-tool-description-view':handlerOptions?'original-handler-options-view':sessionInput?'original-session-input-view':expanded?'original-expanded-prompt-view':'original-handler-message-view',source,sourceOccurrence:source.occurrence,request,
   ...(sessionInput?{sessionInputOccurrence:source.sessionInputOccurrence}:{emittingRunOccurrence:source.runOccurrence}),...(run?{currentRunOccurrence:run.occurrence}:{}),...(retained?{retainedMessageOrigin:retained}:{}),
   authority:'not-established',priority:'not-established',completeGoverningCoverage:false,permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Message input view is not this original source binding');
   governing.assertCurrent(governing.view);
  }
  assertCurrent(view);return Object.freeze({view,authority:undefined,assertCurrent});
 });
}
