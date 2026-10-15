import {isDeepStrictEqual} from 'node:util';
import {readOriginalToolPublication,readOriginalSystemPublication} from '../../collector/run-prompt-custody-v3/handler-publication.mjs';
import {copyMessageData} from '../../collector/run-prompt-custody/messages.mjs';
import {prepareNativeToolAssociation} from './tool-source-association.ts';
import {captureNativeSystemDerivation} from './system-source-derivation.ts';
import {streamSimple,readNativeSerializedPayload,readNativeSystemPayload,readNativeToolPayload} from './generated/openai-stream.mjs';
import {NativeSourceAssociationError} from './source-association-error.mjs';
import {dataRecord,denseArray,envelopeReason} from './source-association-shape.mjs';
import {messageOrigin} from './source-message-origin.mjs';
import {originalContributions} from './source-original-contributions.mjs';
import {createAssociationSealer} from './source-association-seal.mjs';

export {NativeSourceAssociationError} from './source-association-error.mjs';
/** Fixed privately instrumented native serializer, not a caller-labelled stream implementation. */
export const nativeOpenAIStream=streamSimple;

//region Original serializer callbacks retain owned contributions across the payload boundary.
/**
 Attach one historical contribution at the observer's existing JSON validation.
 A source-aware custody copy closes callback alias races without freezing borrowed objects.
 */
export function prepareNativeSourceAssociation({
  sources,
  model,
  context,
  options
}){
 const {
   origins,
   reason
 }=originalContributions({
   sources,
   model,
   context,
   options
 });
 const messageEligible=envelopeReason({
   model,
   context,
   options
 })===undefined;
 const capturedSystemDerivation=messageEligible?captureNativeSystemDerivation({
   sources,
   messages:context.messages,
   dataRecord,
   denseArray,
   readSystemPublication:readOriginalSystemPublication
 }):undefined;
 const systemDerivation=((capturedSystemDerivation!==undefined)&&((typeof capturedSystemDerivation)!=='symbol'))?capturedSystemDerivation:undefined;
 const previous=options?.onPayload;
 const originalMessages=context.messages;
 const toolAssociation=prepareNativeToolAssociation({
   sources,
   dataRecord,
   denseArray,
   copyToolData:copyMessageData,
   readToolPublication:readOriginalToolPublication,
   readToolEmission:readNativeToolPayload
 });
 
   
   
   
   
 const state={owned:[],unresolvedHandlers:[],called:false,sealed:false,payloadOriginFailure:undefined};
 function createPayloadCallback() {
  return async function onPayload(
   payload,
   selectedModel
 ){
  if(state.called)throw new NativeSourceAssociationError('Native source association cannot reuse a payload occurrence');
  state.called=true;
  const origin=readNativeSerializedPayload(payload);
  const originalPayload=(origin!==undefined)&&(origin.messages===originalMessages)
    &&(origin.model===selectedModel)
    &&(selectedModel.id===model.id)
    &&(selectedModel.provider===model.provider)
    &&(selectedModel.api===model.api);
  if(!originalPayload)state.payloadOriginFailure='Request payload lacks the original native serializer occurrence for this captured transcript and model';
  toolAssociation.capture({
    payload,
    origin,
    eligible:originalPayload&&messageEligible
  });
  const candidates=[];
  if(originalPayload&&dataRecord(payload)
    &&denseArray(payload.messages)){
   const original=payload.messages[0];
   const systemSerialization=readNativeSystemPayload(original);
   const originalSystem=(systemSerialization!==undefined)
     &&(systemSerialization.messages===origin.normalizedMessages)
     &&(systemSerialization.ordinal===0)
     &&(systemSerialization.message===systemSerialization.normalizedMessages[0])
     &&(systemSerialization.message===systemSerialization.transformedMessages[0])
     &&(systemSerialization.role===original?.role)
     &&(systemSerialization.text===original?.content);
   if((origins||systemDerivation)&&(!originalSystem))state.payloadOriginFailure??='System content lacks its original native rendering and message emission';
   const originalSystemInputs=systemDerivation?.matches()===true;
   if((origins||originalSystemInputs)&&dataRecord(original)
     &&originalSystem
     &&((typeof original.content)==='string')
     &&[
       'system',
       'developer'
     ].includes(original.role)){
    candidates.push({
      original,
      content:original.content,
      role:original.role,
      associations:originalSystemInputs?Object.freeze([
        ...(origins??[]),
        ...systemDerivation.associations
      ]):origins,
      derivation:originalSystemInputs?systemDerivation:undefined,
      serialization:systemSerialization,
      system:true
    });
   }
   if(messageEligible){
    for(const message of payload.messages){
     if((!dataRecord(message))||(message.role!=='user'))continue;
     const association=messageOrigin({
       sources,
       message
     });
     if(!association)continue;
     // These new text containers are owned snapshots, not aliases held by a payload callback.
     const content=Object.freeze(message.content
       .map(function freezeContributionPart(part) { return (Object.freeze({...part})); }));
     candidates.push({
       original:message,
       content,
       role:message.role,
       associations:Object.freeze([association]),
       system:false
     });
    }
   }
  }
  const replacement=previous?await Reflect.apply(
    previous,
    this,
    [
      payload,
      selectedModel
    ]
  ):undefined;
  const selected=toolAssociation.retain(replacement===undefined?payload:replacement);
  const ordinary=dataRecord(selected)&&denseArray(selected.messages);
    const retained=[];
  for(const candidate of candidates){
   const positions=ordinary?selected.messages
     .flatMap(function findOriginalMessageIndex(
       message,
       index
     ) { return (message===candidate.original?[index]:[]); }):[];
   const {original} = candidate;
   // Observe known message aliases even when their descriptor shape no longer qualifies for a copy.
   const handlerCurrent=(candidate.system?(candidate.derivation
     ?.matches()
     ??true):(candidate.associations[0]
       .handlerPublication
       ??candidate.associations[0]
       .expandedPromptPublication).matchesPayload(original));
   const unchanged=handlerCurrent&&(positions.length===1)
     &&dataRecord(original)
     &&(original.role===candidate.role)
     &&(candidate.system?original.content===candidate.content:isDeepStrictEqual(
       original.content,
       candidate.content
     ));
   if(!unchanged){
    if(!candidate.system)state.unresolvedHandlers.push(Object.freeze({
     location:Object.freeze(positions.length===1?{
       field:'messages',
       ordinal:positions[0],
       property:'content'
     }:{field:'messages'}),
     reason:'The payload callback removed, replaced or changed an original message contribution; its original source cannot authenticate the replacement.'
    }));
    continue;
   }
   retained.push({
     ordinal:positions[0],
     message:Object.freeze({
       ...original,
       content:candidate.content
     }),
     associations:candidate.associations,
     serialization:candidate.serialization,
     derivation:candidate.derivation,
     system:candidate.system
   });
  }
  state.owned=retained;
  if(retained.length === 0)return selected===payload?replacement:selected;
  const replacements=new Map(retained.map(function indexMessageReplacement(record) { return ([
    record.ordinal,
    record.message
  ]); }));
  const messages=Object.freeze(selected.messages
    .map(function applyMessageReplacement(
      message,
      index
    ) { return (replacements.get(index)??message); }));
  return Object.freeze({
    ...selected,
    messages
  });
 };
 }
 const onPayload=createPayloadCallback();
 const seal=createAssociationSealer({state,reason,toolAssociation});
 return Object.freeze({
   onPayload,
   seal
 });
}
//endregion
