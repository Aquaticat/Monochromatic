import {
  describeMessageInput,
  collectNativeMessageInputs
} from '../../collector/run-prompt-custody-v3/message-inputs.mjs';
import {GoverningPolicyBindingError} from './governing-source.mjs';

/** Bind original active and retained native inputs without promoting prior runs into active ancestry. */
export function bindRunMessageSources({governing}){
 const {request} = governing.view;
 governing.assertCurrent(governing.view);
 const snapshot=governing.view
   .sources
   ??request.sources; const run=snapshot.nativeRunComposition;
 const expected=collectNativeMessageInputs(snapshot);
 const sources=snapshot.runMessageInputs;
 if((!Array.isArray(sources))||(sources.length!==expected.length)
   ||sources.some(function differsFromExpectedMessageSource(
   source,
   index
 ) { return (source!==expected[index]); }))throw new GoverningPolicyBindingError('Message inputs are not these original run publications');
 const publications=new Map((run?[
   ...run.ancestors,
   run
 ]:[]).map(function indexRunPublication(value) { return ([
   value.occurrence,
   value
 ]); }));
 const retainedBySource=new Map();
 for(const origin of run?.retainedMessageOrigins??snapshot.nativeConstructedInputs??[]){
  const {source}=origin;
  if(!retainedBySource.has(source))retainedBySource.set(source,origin);
 }
 const bindings=sources.map(function bindOriginalRunMessage(source) {
  const publication=publications.get(source.runOccurrence);
    const expanded=source.kind==='native-run-expanded-prompt-input';
    const handlerOptions=source.kind==='native-run-handler-options-input';
  const retained=retainedBySource.get(source);
    const toolDescription=source.kind==='native-tool-description-input';
    const loadoutOutput=source.kind==='native-tool-loadout-output';
    const loadoutInput=source.kind==='native-tool-loadout-input';
    const loadoutQuery=source.kind==='native-tool-loadout-query-input';
    const sessionInput=(source.kind==='native-session-message-input')||toolDescription
      ||loadoutOutput
      ||loadoutInput
      ||loadoutQuery;
  if(sessionInput){
   if((!retained)||(source.sessionInputOccurrence===undefined)
     ||(retained.sessionInputOccurrence!==source.sessionInputOccurrence)
     ||(retained.publication
       .sessionInputOccurrence
       !==source.sessionInputOccurrence)
     ||(retained.publication
       .sourceOccurrence
       !==source.occurrence))throw new GoverningPolicyBindingError('Session input is not this original manager-owned occurrence');
  }else if(retained){
   if((retained.runOccurrence!==source.runOccurrence)||(retained.publication
     .runOccurrence
     !==source.runOccurrence)
     ||(retained.publication
       .sourceOccurrence
       !==source.occurrence))throw new GoverningPolicyBindingError('Retained message is not this original source publication');
  }else if(handlerOptions){
   const observation=publication?.handlerObservations?.[source.inputLocation
     .ordinal];
   if((!publication?.handlerOptionInputs
     ?.includes(source))||(!observation)
     ||(observation.ordinal
       !==source.inputLocation
       .ordinal)
     ||(source.contentFormat!=='native-content-json')
     ||(source.content!==JSON.stringify(observation.before
       .options)))throw new GoverningPolicyBindingError('Callback options differ from their original run-owned input observation');
  }else if(expanded){
   if(publication?.expandedPromptInput!==source)throw new GoverningPolicyBindingError('Expanded prompt is not this original run input');
  }else{
   const message=publication?.emitterMessages?.[source.inputLocation
     .ordinal];
   if(!message)throw new GoverningPolicyBindingError('Handler message has no original emitting run position');
   const described=describeMessageInput(message);
   if((source.content!==described.content)||(source.contentFormat!==described.contentFormat)
     ||(source.inputLocation
       .metadataJSON
       !==described.metadataJSON))throw new GoverningPolicyBindingError('Handler content or metadata differs from its original emitter publication');
  }
  const view=Object.freeze({
    kind:loadoutQuery?'original-tool-loadout-query-view':loadoutInput?'original-tool-loadout-input-view':loadoutOutput?'original-tool-loadout-output-view':toolDescription?'original-tool-description-view':handlerOptions?'original-handler-options-view':sessionInput?'original-session-input-view':expanded?'original-expanded-prompt-view':'original-handler-message-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    ...(sessionInput?{sessionInputOccurrence:source.sessionInputOccurrence}:{emittingRunOccurrence:source.runOccurrence}),
    ...(run?{currentRunOccurrence:run.occurrence}:{}),
    ...(retained?{retainedMessageOrigin:retained}:{}),
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  /** Check immutable binding identity and its local publication link within the owning source set. */
function assertBindingIdentity(value){
if(value!==view)throw new GoverningPolicyBindingError('Message input view is not this original source binding');

}
function assertCurrent(value){
if(value!==view)throw new GoverningPolicyBindingError('Message input view is not this original source binding');
governing.assertCurrent(governing.view);
assertBindingIdentity(value);
}
  assertBindingIdentity(view);return Object.freeze({
    view,
    authority:undefined,
    assertBindingIdentity,
assertCurrent
  });
 });
 // Local publication checks share their immutable parent; revalidate the complete collection at release.
 governing.assertCurrent(governing.view);
 return bindings;
}
