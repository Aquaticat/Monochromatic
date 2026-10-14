import {createHash} from 'node:crypto';
import {copyPromptOptions} from '../base-prompt-custody-v2/copy.mjs';

/**
 Construct fresh native delivery values from original base inputs at matching positions.
 Equality selects republication, not provenance of the displaced handler value.
 Only inclusion in the original run publication authenticates these records.
 */
export function republishBaseInputs({
  input,
  base,
  runOccurrence
}){
 const options=copyPromptOptions(input);
   const carriers=[];
   const sources=[];
 function carry(location){
  carriers.push(Object.freeze({
    kind:'native-run-base-input-carrier',
    inputLocation:Object.freeze(location),
    occurrence:Object.freeze({}),
    baseOccurrence:base.occurrence,
    runOccurrence,
    authenticatesDisplacedInput:false,
    permission:false
  }));
 }
 function capture({
   content,
   location
 }){
  sources.push(Object.freeze({
    kind:'native-run-replacement-input',
    content,
    inputLocation:Object.freeze(location),
    sha256:createHash('sha256')
      .update(content)
      .digest('hex'),
    occurrence:Object.freeze({}),
    runOccurrence,
    registration:undefined,
    pathToRawFileIdentity:'not-established',
    permission:false
  }));
 }
 for(const field of [
   'customPrompt',
   'appendSystemPrompt'
 ]){
  const content=options[field];
  // Undefined remains an absent published field, including removal of a defined base input.
  if(content===undefined)continue;
  if(content===base.options[field]){
   options[field]=base.options[field];carry({field});
  }else capture({
    content,
    location:{field}
  });
 }
 options.contextFiles=options.contextFiles
   .map(function retainOriginalContextEntry(
     entry,
     ordinal
   ) {
  const original=base.options
    .contextFiles[ordinal];
  if(original&&(entry.path===original.path)
    &&(entry.content===original.content)){
   const emitted={
     path:original.path,
     content:original.content
   };
   carry({
     field:'contextFiles',
     ordinal,
     path:original.path
   });return emitted;
  }
  capture({
    content:entry.content,
    location:{
      field:'contextFiles',
      ordinal,
      path:entry.path
    }
  });
  return entry;
 });
 return {
   options,
   baseInputCarriers:Object.freeze(carriers),
   replacementInputs:Object.freeze(sources)
 };
}
