import {createHash} from 'node:crypto';
import {RequestObservationProfileError} from './observation-errors.mjs';
import {object,parseRequestBody} from './observation-shape.mjs';
//region A fixed native stream owns serialized bytes and its original response receipt.
const responseClaims=new WeakMap();
function hash(value){return createHash('sha256')
  .update(value)
  .digest('hex');}

export function createObservationStream({originalStream,terminalFetch,lifecycle,boundRoot,collector,endpoint,maxBodyBytes,prepareSourceAssociation,observationState,advance,assertScope,responses,receipts}){
  return async function streamFunction(
    model,
    context,
    options
  ) {
    // A blocked request attempt during suspension must not supersede a prior receipt that can resume after cancellation.
    const rootLease=lifecycle.capture(boundRoot);
    const scope={
      requestIdentity:Symbol(),
      generation:advance(),
      root:rootLease,
      sources:collector.capture({signal:options?.signal}),
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
    observationState.currentScope=scope;
    if((!object(scope.sources))||(!Object.isFrozen(scope.sources))
      ||((typeof scope.sources
        .then)==='function'))throw new RequestObservationProfileError('Collector must synchronously return its immutable owned source snapshot');
    const requestedAPI=model?.api;
    const requestedModel=model?.id;
    if((requestedAPI!=='openai-completions')||((typeof requestedModel)!=='string')
      ||(!requestedModel))throw new RequestObservationProfileError('Only the qualified openai-completions profile is observed');
    if((options?.maxRetries!==undefined)&&(options.maxRetries!==0))throw new RequestObservationProfileError('A conflicting retry policy cannot be overwritten by this no-retry profile');
    if((options?.fetch!==undefined)&&(options.fetch!==terminalFetch))throw new RequestObservationProfileError('A different request-mutating transport cannot be overwritten silently');
    const sourceAssociation=prepareSourceAssociation?.({
      originalStream,
      sources:scope.sources,
      model,
      context,
      options
    });
    function createFetchCallback() {
      return async function observedFetch(
      input,
      init
    ) {
      if(scope.failed)throw scope.failure;
      try {
        assertScope({scope:scope});
        if(scope.request)throw new RequestObservationProfileError('Multiple terminal fetches exceed this no-retry observation profile');
        const url=(typeof input)==='string'?input:input instanceof URL?input.href:undefined;
        if((url!==endpoint)||(init?.method!=='POST')
          ||((typeof init.body)!=='string')
          ||(!init.body
            .isWellFormed()))throw new RequestObservationProfileError('Only the declared serialized JSON POST shape is observed');
        if(Buffer.byteLength(init.body)>maxBodyBytes)throw new RequestObservationProfileError('Serialized request exceeds observation byte bound');
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
        scope.sourceContributions=Object.freeze((sourceAssociation?.seal(parsed)??[]).map(function bindObservedContribution(value) { return (Object.freeze({
          ...value,
          request:scope.request
        })); }));
        return await terminalFetch(
          input,
          init
        );
      } catch(error){scope.failed=true;scope.failure=error;throw error;}
    };
    }
    const observedFetch=createFetchCallback();
    const stream=await originalStream(
      model,
      context,
      {
        ...options,
        maxRetries:0,
        fetch:observedFetch,
        ...(sourceAssociation?{onPayload:sourceAssociation.onPayload}:{})
      }
    );
    if((!object(stream))||((typeof stream.result)!=='function')
      ||((typeof stream[Symbol.asyncIterator])!=='function'))throw new RequestObservationProfileError('Underlying stream lacks the qualified result/iterator interface');
    const originalResult=stream.result
      .bind(stream);
    // The SDK owns this fresh returned stream. Keep its identity and iterator; decorate only its public result method.
    stream.result=async function observedResult() {
      const response=await originalResult();
      if(!object(response))throw new RequestObservationProfileError('Underlying stream result has no object identity');
      if(scope.response!==undefined) {
        if((scope.response!==response)&&(!scope.failed)){scope.failed=true;scope.failure=new RequestObservationProfileError('Result identity changed within a single stream');}
        return response;
      }
      scope.response=response;
      const previous=responseClaims.get(response);
      if(previous&&(previous.requestIdentity!==scope.requestIdentity)){previous.ambiguous=true;scope.claim=previous;}
      else {scope.claim={
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
      if(scope.request&&(!scope.failed)) {
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
      return response;
    };
    return stream;
  };
}
//endregion
