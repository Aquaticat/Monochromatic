import {readHandlerPayloadPublication} from '../../collector/run-prompt-custody-v3/handler-publication.mjs';

//region Exact original or retained message publication membership.
/** Resolve actual payload capabilities through original active or retained-input publication membership. */
export function messageOrigin({
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

//endregion
