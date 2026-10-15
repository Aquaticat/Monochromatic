import {createHash} from 'node:crypto';
import {inspect} from 'node:util';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {RequestObservationProfileError} from './observation-errors.mjs';
import {
  object,
  parseRequestBody,
  parseObservationEndpoint
} from './observation-shape.mjs';
import {prepareObservedPayload} from './observation-payload.mjs';
//region Passive request evidence never owns primary transport success or retry.
const responseClaims=new WeakMap();
const l=tagged({tag:'auto-mode-request-observation'});
function hash(value){return createHash('sha256')
  .update(value)
  .digest('hex');}

export function createObservationStream({
  originalStream,
  terminalFetch,
  lifecycle,
  boundRoot,
  collector,
  maxBodyBytes,
  prepareSourceAssociation,
  observationState,
  advance,
  assertScope,
  responses,
  receipts
}){
 return async function streamFunction(
   model,
   context,
   options
 ){
  const scope={
    requestIdentity:Symbol(),
    generation:undefined,
    root:undefined,
    sources:undefined,
    signal:options?.signal,
    request:undefined,
    response:undefined,
    receipt:undefined,
    claim:undefined,
    failed:false,
    failure:undefined,
    invalidated:false,
    invalidationCause:undefined
  };
  function fail(error){
   if(scope.failed)return;
   scope.failed=true;scope.failure=error;
   tagged({
     tag:fail.name,
     l
   })
     .error(inspect(
       error,
       {
         depth:6,
         maxStringLength:2_048
       }
     ));
  }
  const requestedAPI=model?.api;
  const requestedModel=model?.id;
  try{
   scope.generation=advance();
   observationState.currentScope=scope;
   scope.root=lifecycle.capture(boundRoot);
   scope.sources=collector.capture({signal:options?.signal});
   if((!object(scope.sources))||(!Object.isFrozen(scope.sources))
     ||((typeof scope.sources
       .then)==='function'))throw new RequestObservationProfileError('Collector must synchronously return its immutable owned source snapshot');
   if((requestedAPI!=='openai-completions')||((typeof requestedModel)!=='string')
     ||(!requestedModel))throw new RequestObservationProfileError('Tool evidence requires the qualified openai-completions profile');
  }catch(error){fail(error);}
  const payload=scope.failed?{
    association:undefined,
    onPayload:options?.onPayload
  }:prepareObservedPayload({
    prepareSourceAssociation,
    originalStream,
    sources:scope.sources,
    model,
    context,
    options,
    fail
  });
  const send=options?.fetch??terminalFetch;
  const observedFetch=async function observedFetch(
    input,
    init
  ){
   if(!scope.failed){
    try{
     assertScope({scope});
     const url=(typeof input)==='string'?input:input instanceof URL?input.href:undefined;
     const parsedURL=parseObservationEndpoint(url);
     if((![
       'http:',
       'https:'
     ].includes(parsedURL.protocol))||(parsedURL.href!==url)
       ||parsedURL.username
       ||parsedURL.password
       ||(init?.method!=='POST')
       ||((typeof init.body)!=='string')
       ||(!init.body
         .isWellFormed()))throw new RequestObservationProfileError('Tool evidence requires a canonical HTTP URL and serialized JSON POST');
     if(Buffer.byteLength(init.body)>maxBodyBytes)throw new RequestObservationProfileError('Serialized request exceeds observation byte bound');
     if(scope.request){
      if((scope.request
        .url
        !==url)||(scope.request
          .body
          !==init.body))throw new RequestObservationProfileError('Retried request changed its observed URL or serialized body');
     }else{
      const parsed=parseRequestBody(init.body);
      if((parsed===null)||((typeof parsed)!=='object')
        ||Array.isArray(parsed))throw new RequestObservationProfileError('Serialized request must be a JSON object');
      scope.request=Object.freeze({
        url,
        method:'POST',
        body:init.body,
        bodySHA256:hash(init.body),
        bytes:Buffer.byteLength(init.body)
      });
      scope.sourceContributions=Object.freeze((payload.association
        ?.seal(parsed)
        ??[]).map(function bindObservedContribution(value){return Object.freeze({
        ...value,
        request:scope.request
      });}));
     }
    }catch(error){fail(error);}
   }
   // Native transport failures and retries belong to the original provider.
   return await send(
     input,
     init
   );
  };
  const stream=await originalStream(
    model,
    context,
    {
      ...options,
      fetch:observedFetch,
      ...(payload.onPayload?{onPayload:payload.onPayload}:{})
    }
  );
  try{
   if((!object(stream))||((typeof stream.result)!=='function')
     ||((typeof stream[Symbol.asyncIterator])!=='function'))throw new RequestObservationProfileError('Underlying stream lacks the qualified result/iterator interface');
   const originalResult=stream.result
     .bind(stream);
   stream.result=async function observedResult(){
    const response=await originalResult();
    try{
     if(!object(response))throw new RequestObservationProfileError('Underlying stream result has no object identity');
     if(scope.response!==undefined){
      if(scope.response!==response)throw new RequestObservationProfileError('Result identity changed within a single stream');
      return response;
     }
     scope.response=response;
     const previous=responseClaims.get(response);
     if(previous&&(previous.requestIdentity!==scope.requestIdentity)){previous.ambiguous=true;scope.claim=previous;}
     else{scope.claim={
       requestIdentity:scope.requestIdentity,
       ambiguous:false
     };responseClaims.set(
       response,
       scope.claim
     );}
     responses.set(
       response,
       scope
     );
     if(scope.request&&(!scope.failed)){
      scope.receipt=Object.freeze({
        stage:'serialized-model-request',
        request:scope.request,
        sources:scope.sources,
        sourceContributions:scope.sourceContributions??Object.freeze([]),
        requestedAPI,
        requestedModel,
        instructionAuthority:'not-established',
        humanWitness:'not-established',
        permission:'not-established'
      });
      receipts.set(
        scope.receipt,
        scope
      );
     }
    }catch(error){fail(error);}
    return response;
   };
  }catch(error){fail(error);}
  return stream;
 };
}
//endregion
