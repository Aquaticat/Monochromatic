import {SourceCollectionError} from '../../collector/collector.mjs';
import {GoverningPolicyBindingError} from './governing-source.mjs';

/** Original source records from one completed run, preserving each occurrence. */
function promptSources(publication){
 return [
   ...(publication.expandedPromptInput?[publication.expandedPromptInput]:[]),
   ...(publication.forcedPromptInput?[publication.forcedPromptInput]:[]),
   ...publication.handlerMessageInputs,
   ...publication.handlerOptionInputs,
   ...publication.promptGuidelineInputs,
   ...publication.toolGuidelineInputs,
   ...publication.mappedPromptInputs,
   ...publication.replacementInputs,
   ...publication.skillDescriptionInputs,
   ...publication.builtInPromptInputs
 ];
}

/** Retain prior original run publications through the native owner's current-root history. */
export function collectRetainedRunInputs({
  run,
  represented
}){
 if((!run)||(!Array.isArray(run.priorRuns)))return undefined;
 const seen=new Set(represented);
 const origins=[];
 for(const publication of run.priorRuns){
  for(const source of promptSources(publication)){
   if(seen.has(source))continue;
   if(source.runOccurrence!==publication.occurrence)throw new SourceCollectionError('Historical prompt source differs from its original native run');
   seen.add(source);origins.push(Object.freeze({
     source,
     publication
   }));
  }
 }
 if(origins.length>512)throw new SourceCollectionError('Original run source history exceeds the bounded source publication profile');
 return Object.freeze(origins);
}

/** Historical native run input remains unregistered; visibility in a later request is unnecessary. */
export function bindRetainedRunSources({governing}){
 const {request} = governing.view;
 const snapshot=governing.view
   .sources
   ??request.sources;
 governing.assertCurrent(governing.view);
 return (snapshot.retainedRunInputs??[]).map(function bindOriginalRetainedRun(origin) {
  const {
    source,
    publication
  }=origin;
  if((!snapshot.nativeRunComposition
    .priorRuns
    .includes(publication))||(!promptSources(publication)
      .includes(source))
    ||(!snapshot.governingSources
      .includes(source)))throw new GoverningPolicyBindingError('Retained run input lacks its original native history membership');
  const view=Object.freeze({
    kind:'original-retained-run-input-view',
    source,
    sourceOccurrence:source.occurrence,
    request,
    emittingRunOccurrence:publication.occurrence,
    retainedRunOrigin:origin,
    authority:'not-established',
    priority:'not-established',
    completeGoverningCoverage:false,
    permission:false
  });
  function assertCurrent(value){
   if(value!==view)throw new GoverningPolicyBindingError('Retained run source view is not its original binding');
   governing.assertCurrent(governing.view);
  }
  assertCurrent(view);
  return Object.freeze({
    view,
    authority:undefined,
    assertCurrent
  });
 });
}
