import {SourceCollectionError} from '../../collector/collector.mjs';

/** Resolve one native field against its original base and run input occurrences. */
function readCarrierSources({
  run,
  input,
  hostPrompt,
  carrier,
  base
}){
  const {
    field,
    ordinal,
    path
  }=carrier.inputLocation;
  if(field==='customPrompt'){
   const source=input.slot==='customPrompt'?input.source:hostPrompt??input.resourceSystemInput;
   if((!source)||(base.options
     .customPrompt
     !==source.content)
     ||(run.options
       .customPrompt
       !==source.content))throw new SourceCollectionError('Run system carrier has no original system-stage source');
   return [source];
  }else if(field==='appendSystemPrompt'){
   const sources=input.appendInputs;
   const joined=sources.map(function readCarrierSourceContent(source) { return (source.content); })
     .join('\n\n');
   if((base.options
     .appendSystemPrompt
     !==joined)||(run.options
       .appendSystemPrompt
       !==joined))throw new SourceCollectionError('Run appendix carrier differs from the complete original append sequence');
   return sources;
  }else if(field==='contextFiles'){
   const source=input.contextInputs[ordinal];
     const entry=base.options
       .contextFiles[ordinal]; const published=run.options
         .contextFiles[ordinal];
   if((!source)||(!entry)
     ||(!published)
     ||(source.path!==path)
     ||(entry.path!==path)
     ||(published.path!==path)
     ||(source.content!==entry.content)
     ||(published.content!==entry.content))throw new SourceCollectionError('Run context carrier differs from its original context position');
   return [source.carrier
     ?.source
     ??source];
  }else throw new SourceCollectionError('Run base carrier has an unsupported native field');
}

/**
 Resolve original run republications by original base frame and native field position.
 Call only inside the incumbent collector after original snapshot authentication.
 Source occurrences link canonical sources without duplicating their text in every carrier.
 */
export function linkRunInputCarriers({run,input,hostPrompt}){
 if(!run)return Object.freeze([]);
 const base=run.inputBase;
 if(base.resourceFrame!==input.frame)throw new SourceCollectionError('Run base carriers require this original resource frame');
 return Object.freeze(run.baseInputCarriers.map(function linkOriginalRunCarrier(carrier){
  if((carrier.runOccurrence!==run.occurrence)||(carrier.baseOccurrence!==base.occurrence))throw new SourceCollectionError('Run carrier differs from its original run or base occurrence');
  const sources=readCarrierSources({run,input,hostPrompt,carrier,base});
  return Object.freeze({
    kind:'governing-run-input-carrier',
    carrier,
    occurrence:carrier.occurrence,
    sourceOccurrences:Object.freeze(sources.map(function readCarrierSourceOccurrence(source) { return (source.occurrence); })),
    authenticatesDisplacedInput:false,
    permission:false
  });
 }));
}
