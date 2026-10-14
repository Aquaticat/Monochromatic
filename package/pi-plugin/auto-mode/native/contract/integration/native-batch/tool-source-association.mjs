import {isDeepStrictEqual} from 'node:util';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {copyMessageData} from '../../collector/run-prompt-custody/messages.mjs';
import {readOriginalToolPublication} from '../../collector/run-prompt-custody-v3/handler-publication.mjs';
import {readNativeToolPayload} from './generated/openai-stream.mjs';

const l=tagged({tag:'auto-mode-native-tool-source-association'});
class NativeToolAssociationError extends Error {}

/** Resolve the exact original publication in the captured run's existing input memberships. */
function originalToolOrigin({sources,tool}){
 const publication=readOriginalToolPublication(tool);
 const run=sources.nativeRunComposition;
 if(!publication||!run)return undefined;
 const retained=run.retainedMessageOrigins?.find(function originalPublication(origin){return origin.publication===publication;});
 const source=retained?.source;
 if(!source||!sources.governingSources.includes(source))return undefined;
 return Object.freeze({source,sourceOccurrence:source.occurrence,run,toolPublication:publication,retainedMessageOrigin:retained});
}

/** Keep serialized tools under original emitter custody until the request's existing parse boundary. */
export function prepareNativeToolAssociation({sources,dataRecord,denseArray}){
 const fl=tagged({tag:prepareNativeToolAssociation.name,l});
 let emissions=[];
 let retained=[];
 let capturedArray;
 let consumed=false;
 /** Original array and per-declaration observations must agree before callbacks can alter the payload. */
 function capture({payload,origin,eligible}){
  fl.debug('capturing original native tool emission associations');
  if(!eligible||!dataRecord(payload)||!denseArray(payload.tools))return;
  const serialization=readNativeToolPayload(payload.tools);
  if(!serialization||serialization.messages!==origin.normalizedMessages||!denseArray(serialization.tools))return;
  capturedArray=payload.tools;
  emissions=payload.tools.map(function originalEmission(tool,ordinal){
   const emitted=readNativeToolPayload(tool);
   const association=emitted&&emitted.tool===serialization.tools[ordinal]?originalToolOrigin({sources,tool:emitted.tool}):undefined;
   if(!association)return {original:tool,ordinal,reason:'Serialized tool lacks its original native declaration emission and captured manager input'};
   try{
    if(emitted.value===undefined||!isDeepStrictEqual(copyMessageData(tool),emitted.value))
      return {original:tool,ordinal,reason:'Serialized tool data differs from its original native declaration emission'};
    return {original:tool,ordinal,association,serialization:emitted,value:emitted.value};
   }catch(error){
    fl.debug(String(error));
    return {original:tool,ordinal,reason:'Serialized tool data exceeds the supported original contribution profile'};
   }
  });
 }
 /** Own unchanged tool values so later callback aliases cannot alter an admitted source association. */
 function retain(selected){
  if(!dataRecord(selected)||!denseArray(selected.tools))return selected;
  retained=emissions.map(function retainOriginalEmission(emission){
   if(!emission.association)return emission;
   const original=selected.tools[emission.ordinal];
   try{
    if(selected.tools===capturedArray&&original===emission.original
      &&readOriginalToolPublication(emission.serialization.tool)===emission.association.toolPublication
      &&isDeepStrictEqual(copyMessageData(original),emission.value))return emission;
   }catch(error){fl.debug(String(error));}
   return {ordinal:emission.ordinal,reason:'The payload callback removed, replaced or changed an original tool declaration contribution'};
  });
  const owned=new Map(retained.filter(function associated(emission){return emission.association!==undefined;})
   .map(function ownedTool(emission){return [emission.ordinal,emission.value];}));
  if(owned.size===0)return selected;
  return Object.freeze({...selected,tools:Object.freeze(selected.tools.map(function ownedToolAt(tool,ordinal){return owned.get(ordinal)??tool;}))});
 }
 /** Read the observer's existing parsed request without introducing another serialization or parse. */
 function seal(parsed){
  if(consumed)throw new NativeToolAssociationError('Native tool contribution was already sealed');
  consumed=true;
  const expected=retained;
  emissions=[];retained=[];capturedArray=undefined;
  if(parsed.tools===undefined)return Object.freeze([]);
  const tools=Array.isArray(parsed.tools)?parsed.tools:[parsed.tools];
  return Object.freeze(tools.map(function parsedTool(tool,ordinal){
   const emission=expected[ordinal];
   const associated=emission?.association!==undefined&&isDeepStrictEqual(tool,emission.value);
   return Object.freeze({
    contribution:Object.freeze({}),location:Object.freeze({field:'tools',ordinal}),
    association:associated?emission.association:undefined,
    ...(associated?{serialization:emission.serialization}:{}),
    reason:associated?undefined:emission?.reason??'Serialized tool lacks its original native declaration emission and captured manager input',
    coverage:'partial-original-prompt-input-contribution',permission:false
   });
  }));
 }
 return Object.freeze({capture,retain,seal});
}
