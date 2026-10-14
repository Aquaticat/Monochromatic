import {snapshotInput} from '../../collector/resource-input-custody/values.ts';
import {assertBoundResourceInputs} from "../../collector/rule-relevance-sdk-copy/input/resource-owner.mjs";

export class GoverningContextEmissionError extends Error {
 constructor(message){super(message);this.name=this.constructor
   .name;}
}

/**
 Publish fresh context entries from the already selected source capability.
 Equality selects a replacement position; it never authenticates its displaced read.
 State belongs to the existing loader input owner, not a source/session registry.
 */
export function createGoverningContextEmitter({
  callback,
  readSource
}){
 if(((callback!==undefined)&&((typeof callback)!=='function'))||((typeof readSource)!=='function'))throw new GoverningContextEmissionError('Context publication requires the configured callback and original source reader');
 let pending;
 function reset(){pending=undefined;}
 function emit(input){
  const source=readSource();
  const result=callback===undefined?input:Reflect.apply(
    callback,
    this,
    [input]
  );
  // Let the incumbent resource owner reject and drain unsupported asynchronous callbacks.
  if(result instanceof Promise)return result;
  const prior=snapshotInput({
    kind:'context',
    value:result
  });
  if(readSource()!==source)throw new GoverningContextEmissionError('Selected policy changed during the context callback');
  const links=[];
  const replaced=result.agentsFiles
    .map(function retainOriginalGoverningEntry(
      entry,
      ordinal
    ) {
   if((entry.path!==source.identity)||(entry.content!==source.content))return entry;
   const emitted=Object.freeze({
     path:entry.path,
     content:source.content
   });
   links.push(Object.freeze({
     ordinal,
     entry:emitted,
     source
   }));
   return emitted;
  });
  const output=links.length > 0?Object.freeze({agentsFiles:Object.freeze(replaced)}):result;
  pending=Object.freeze({
    source,
    files:output.agentsFiles,
    links:Object.freeze(links),
    prior
  });
  return output;
 }
 function assertPublished({
   emission,
   nativeBinding,
   loader,
   frame,
   source
 }){
  if((emission!==pending)||(!emission))throw new GoverningContextEmissionError('Context emission is not this original loader operation');
  if((readSource()!==source)||(emission.source!==source))throw new GoverningContextEmissionError('Selected policy changed before context publication');
  assertBoundResourceInputs({
    binding:nativeBinding,
    loader,
    frame,
    contextFiles:emission.files,
    systemPrompt:loader.getSystemPrompt(),
    appendSystemPrompt:loader.getAppendSystemPrompt()
  });
  const actual=loader.getAgentsFiles()
    .agentsFiles;
  for(const link of emission.links){
   if((actual[link.ordinal]!==link.entry)||(link.entry
     .content
     !==source.content))throw new GoverningContextEmissionError('Native context no longer contains the original emitted policy entry');
  }
 }
 function publish(input){
  const emission=pending;
  assertPublished({
    ...input,
    emission
  });
  return Object.freeze({
   prior:emission.prior,
   carriers:Object.freeze(emission.links
     .map(function captureGoverningContextCarrier(link) { return (Object.freeze({
       kind:'governing-policy-context-carrier',
       occurrence:Object.freeze({}),
       ordinal:link.ordinal,
       entry:link.entry,
       source:link.source,
       sourceOccurrence:link.source
         .occurrence,
       authenticatesDisplacedRead:false,
       permission:false
     })); })),
   assertCurrent(){assertPublished({
     ...input,
     emission
   });}
  });
 }
 return Object.freeze({
   emit,
   reset,
   publish
 });
}
