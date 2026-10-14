export class SourceInputLocationError extends Error {
 constructor(message){super(message);this.name=this.constructor
   .name;}
}

/**
 Preserve native input position as representation data, never authority or applicability.
 Original source/run owners authenticate the record; this copier only checks its wire shape.
 */
export function sourceInputLocation(source){
 const descriptor=Object.getOwnPropertyDescriptor(
   source,
   'inputLocation'
 );
 if(!descriptor)return {};
 if(!Object.hasOwn(
   descriptor,
   'value'
 ))throw new SourceInputLocationError('Source input location requires a data property');
 const location=descriptor.value;
 if((!location)||((typeof location)!=='object')
   ||(Object.getPrototypeOf(location)!==Object.prototype))throw new SourceInputLocationError('Source input location requires an ordinary record');
 const keys=Reflect.ownKeys(location);
 if((keys.length === 0)||(keys.length>3)
   ||keys.some(key=>(typeof key)!=='string'))throw new SourceInputLocationError('Source input location requires supported named slot fields');
 for(const key of keys){
  if(!Object.hasOwn(
    Object.getOwnPropertyDescriptor(
      location,
      key
    ),
    'value'
  ))throw new SourceInputLocationError('Source input location requires data fields');
 }
 const shape=keys.toSorted()
   .join(',');
 if(location.field==='toolGuidelines'){
  if((shape!=='field,ordinal,toolName')||((typeof location.toolName)!=='string')
    ||(!Number.isSafeInteger(location.ordinal))
    ||(location.ordinal<0))throw new SourceInputLocationError('Source input location differs from the native tool-guideline slot');
  return {inputLocation:{
    field:location.field,
    toolName:location.toolName,
    ordinal:location.ordinal
  }};
 }
 if([
   'toolSnippets',
   'sections'
 ].includes(location.field)){
  if((shape!=='field,key')||((typeof location.key)!=='string'))throw new SourceInputLocationError('Source input location differs from the native named-text slot');
  return {inputLocation:{
    field:location.field,
    key:location.key
  }};
 }
 if([
   'customPrompt',
   'appendSystemPrompt',
   'expandedPrompt'
 ].includes(location.field)){
  if(shape!=='field')throw new SourceInputLocationError('Scalar prompt location accepts only its native field');
  return {inputLocation:{field:location.field}};
 }
 if(location.field==='contextFiles'){
  if((shape!=='field,ordinal,path')||(!Number.isSafeInteger(location.ordinal))
    ||(location.ordinal<0)
    ||((typeof location.path)!=='string'))throw new SourceInputLocationError('Context input location requires its native ordinal and path');
  return {inputLocation:{
    field:location.field,
    ordinal:location.ordinal,
    path:location.path
  }};
 }
 if(location.field==='skills'){
  if((shape!=='field,metadataJSON,ordinal')||(!Number.isSafeInteger(location.ordinal))
    ||(location.ordinal<0)
    ||((typeof location.metadataJSON)!=='string'))throw new SourceInputLocationError('Skill input location requires its native ordinal and serialized companion metadata');
  return {inputLocation:{
    field:location.field,
    ordinal:location.ordinal,
    metadataJSON:location.metadataJSON
  }};
 }
 if([
   'queuedMessages',
   'customMessage',
   'inputEvent',
   'uninterceptedInput',
   'transformedInput',
   'commandInput',
   'callInput',
   'agentInput',
   'managerInput',
   'customTools',
   'extensionTool',
   'toolLoadoutOutput',
   'toolLoadoutInput',
   'toolLoadoutQuery',
   'handlerResult',
   'resourceCallback'
 ].includes(location.field)){
  if((shape!=='field,metadataJSON')||((typeof location.metadataJSON)!=='string'))throw new SourceInputLocationError('Constructed message input location requires serialized native metadata');
  return {inputLocation:{
    field:location.field,
    metadataJSON:location.metadataJSON
  }};
 }
 if([
   'emitterMessages',
   'sessionMessages',
   'handlerOptions'
 ].includes(location.field)){
  if((shape!=='field,metadataJSON,ordinal')||(!Number.isSafeInteger(location.ordinal))
    ||(location.ordinal<0)
    ||((typeof location.metadataJSON)!=='string'))throw new SourceInputLocationError('Message input location requires its original ordinal and serialized metadata');
  return {inputLocation:{
    field:location.field,
    ordinal:location.ordinal,
    metadataJSON:location.metadataJSON
  }};
 }
 if(location.field==='nativePromptBuilder'){
  if((shape!=='field,ordinal,slot')||(!Number.isSafeInteger(location.ordinal))
    ||(location.ordinal<0)
    ||((typeof location.slot)!=='string'))throw new SourceInputLocationError('Built-in input location requires its original construction ordinal and slot');
  return {inputLocation:{
    field:location.field,
    ordinal:location.ordinal,
    slot:location.slot
  }};
 }
 throw new SourceInputLocationError('Source input location names an unsupported native field');
}
