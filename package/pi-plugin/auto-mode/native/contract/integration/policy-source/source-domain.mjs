import {collectNativeMessageInputs} from '../../collector/run-prompt-custody-v3/message-inputs.mjs';
import {collectRetainedRunInputs} from './run-history.mjs';

//region Account original owner publications independently of instruction meaning or authority.
/**
 Consume an authenticated native snapshot at the source-binding boundary.
 This is a structural receipt audit, not an admission flag or a model completeness question.
 Unsupported native event paths remain explicit even when every selected clause means none.
 */
export function inspectNativeSourceDomain({
  snapshot,
  instructionSources,
  sourceCoverage
}){
 const gaps=[];
 function missing(reason){gaps.push(Object.freeze({reason}));}
 const frame=snapshot?.resourceInputObservation;
   const base=snapshot?.nativeBaseComposition;
   const run=snapshot?.nativeRunComposition;
 if((!frame)||(!base)
   ||(!run)
   ||(base.resourceFrame!==frame)
   ||(run.inputBase
     ?.resourceFrame
     !==frame)
   ||(run.publishedBase!==base)
   ||(!run.renderOccurrence))missing('The original native resource, base, run and prompt-construction publications are not all linked.');
 if(!Array.isArray(snapshot?.nativeDomainEventKinds))missing('The native session has no original extension-event inspection.');
 else for(const kind of snapshot.nativeDomainEventKinds){
  const receipt=run?.contextHandlerReceipt;
  const observedContext=(kind==='context'||kind==='context_with_system')
    &&receipt?.runOccurrence===run?.occurrence
    &&receipt?.observation.kinds.includes(kind);
  if(!observedContext)missing(`Native extension event ${JSON.stringify(kind)} has no complete original input and result receipt accounting in this host integration.`);
 }
 const arrays=[
   'retainedRunInputs',
   'resourceReceiptInputs',
   'appendPromptInputs',
   'contextPromptInputs',
   'governingContextCarriers',
   'runMessageInputs',
   'builtInPromptInputs',
   'runInputCarriers',
   'nativeResourceToolInputs',
   'governingSources'
 ];
 for(const field of arrays)if(!Array.isArray(snapshot?.[field]))missing(`The original source snapshot has no ${field
   } publication.`);
 if(!Array.isArray(sourceCoverage))missing('The original judgment has no source-unit coverage inspection.');
 if(gaps.length > 0)return Object.freeze({
   snapshot,
   gaps:Object.freeze(gaps)
 });
 const prior=collectRetainedRunInputs({
   run,
   represented:snapshot.runMessageInputs
 });
 if(!prior){missing('The native run has no original current-root prompt history inspection.');return Object.freeze({
   snapshot,
   gaps:Object.freeze(gaps)
 });}
 if((prior.length
   !==snapshot.retainedRunInputs
   .length)||prior.some(function differsFromRetainedRunInput(
   origin,
   index
 ) { return ((origin.source
   !==snapshot.retainedRunInputs[index]
   .source)||(origin.publication
     !==snapshot.retainedRunInputs[index]
     .publication)); }))missing('Original retained run sources differ from the native current-root history.');
 const expected=[
   ...prior.map(function readRetainedRunSource(origin) { return (origin.source); }),
   snapshot.hostGoverningPolicy,
   ...snapshot.resourceReceiptInputs,
   ...(snapshot.hostPromptInput?[snapshot.hostPromptInput]:[]),
   ...(snapshot.resourceSystemInput?[snapshot.resourceSystemInput]:[]),
   ...snapshot.appendPromptInputs,
   ...snapshot.contextPromptInputs
     .filter(function isIndependentContextInput(source) { return (source.carrier===undefined); }),
   ...(snapshot.forcedPromptInput?[snapshot.forcedPromptInput]:[]),
   ...(snapshot.promptGuidelineInputs??[]),
   ...(snapshot.toolGuidelineInputs??[]),
   ...(snapshot.mappedPromptInputs??[]),
   ...(snapshot.replacementInputs??[]),
   ...(snapshot.skillDescriptionInputs??[]),
   ...collectNativeMessageInputs(snapshot),
   ...snapshot.builtInPromptInputs,
   ...snapshot.nativeResourceToolInputs
     .map(function readNativeToolSource(origin) { return (origin.source); })
 ];
 const original=new Set(expected);
 if(original.has(undefined)||(original.size!==expected.length))missing('The original host source publications contain a missing or repeated occurrence.');
 if((snapshot.governingSources
   .length
   !==original.size)
   ||snapshot.governingSources
   .some(function lacksOriginalMembership(source) { return (!original.has(source)); }))missing('The governing collection omits or substitutes an original host source publication.');
 const bound=new Map(instructionSources.map(function indexSourceView(view) { return ([
   view.source,
   view
 ]); }));
 if((bound.size!==original.size)||[...original].some(function hasDifferentBoundOccurrence(source) { return (bound.get(source)
   ?.sourceOccurrence
   !==source?.occurrence); }))missing('Original host sources do not all have their own request-bound instruction views.');
 const indexed=new Map(sourceCoverage.map(function indexSourceCoverage(coverage) { return ([
   coverage.sourceOccurrence,
   coverage
 ]); }));
 if((indexed.size!==original.size)||[...original].some(function lacksIndexedOccurrence(source) { return (!indexed.has(source?.occurrence)); }))missing('Original host source occurrences do not all have their own structural source-unit inspection.');
 for(const coverage of sourceCoverage){
  if(coverage.stale||coverage.failure
    ||(!Array.isArray(coverage.instructionCandidates))
    ||(!Array.isArray(coverage.contextualHeadings))
    ||(!Array.isArray(coverage.unclassified)))missing('An original source-unit inspection is stale, failed or missing its retained units.');
 }
 const currentReceipts=snapshot.resourceReceiptInputs
   .filter(function belongsToResourceFrame(source) { return (source.resourceInputOccurrence===frame.occurrence); });
 for(const [ordinal,phase] of frame.stages
   .entries()){
  for(const [boundary,value] of [
    [
      'before-callback',
      phase.before
    ],
    [
      'after-callback',
      phase.after
    ]
  ]){
   if(value===undefined)continue;
   const content=(typeof value)==='string'?value:JSON.stringify(value);
   if(!currentReceipts.some(function matchesResourceBoundaryInput(source) {
    const position=JSON.parse(source.inputLocation
      .metadataJSON);
    return (position.ordinal===ordinal)&&(position.phase===phase.kind)
      &&(position.boundary===boundary)
      &&(source.content===content);
   }))missing(`An original resource callback ${boundary
     } receipt is absent from governing-source accounting.`);
  }
 }
 if(!Array.isArray(run.retainedMessageOrigins))missing('The original run has no retained native manager input publication.');
 return Object.freeze({
   snapshot,
   originalSources:Object.freeze(expected),
   gaps:Object.freeze(gaps)
 });
}
//endregion
