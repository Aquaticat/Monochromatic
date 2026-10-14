import { RootLeaseSuspendedError } from './lifecycle.mjs';
import { createHash } from 'node:crypto';
import {inspect} from 'node:util';
import {tagged} from '@monochromatic-dev/module-logger/ts';

const l=tagged({tag:'auto-mode-request-observation'});

//region Consumer-owned observations are data receipts, not instruction authority or permission.
export class RequestObservationError extends Error {
  constructor(
    message,
    options
  ){super(
    message,
    options
  );this.name=this.constructor
    .name;}
}
export class RequestObservationOwnershipError extends RequestObservationError {}
export class RequestObservationUnavailableError extends RequestObservationError {}
export class RequestObservationStaleError extends RequestObservationError {}
export class RequestObservationProfileError extends RequestObservationError {}
const responseClaims=new WeakMap();
function object(value){return (value!==null)&&(((typeof value)==='object')||((typeof value)==='function'));}
function hash(value){return createHash('sha256')
  .update(value)
  .digest('hex');}
//endregion

//region One interface owns interception, immutable bytes, response association and irreversible freshness rejection.
export function createRequestObservationOwner({
  originalStream,
  terminalFetch,
  lifecycle,
  root,
  collector,
  endpoint,
  maxBodyBytes=1_048_576,
  prepareSourceAssociation
}) {
  if(((typeof originalStream)!=='function')||((typeof terminalFetch)!=='function')
    ||(((typeof lifecycle?.capture)!=='function')||((typeof lifecycle?.assertActive)!=='function')
      ||(!object(root?.session))
      ||(!object(root?.manager)))
    ||((typeof collector?.capture)!=='function')
    ||((typeof collector?.assertObservedFresh)!=='function'))throw new RequestObservationProfileError('Trusted stream, terminal sender, constructor-owned root, lifecycle registry and source collector are required');
  if(((typeof endpoint)!=='string')||(!Number.isSafeInteger(maxBodyBytes))
    ||(maxBodyBytes<1)
    ||(maxBodyBytes>1_048_576))throw new RequestObservationProfileError('Endpoint and bounded JSON body profile are required');
  let parsedEndpoint;
  try{parsedEndpoint=new URL(endpoint);}catch(error){throw new RequestObservationProfileError(
    'Declared endpoint is not a URL',
    {cause:error}
  );}
  if((![
    'http:',
    'https:'
  ].includes(parsedEndpoint.protocol))||(parsedEndpoint.href!==endpoint)
    ||parsedEndpoint.username
    ||parsedEndpoint.password)throw new RequestObservationProfileError('Declared endpoint must be a canonical credential-free HTTP URL');
  const boundRoot=Object.freeze({
    session:root.session,
    manager:root.manager
  });
  const responses=new WeakMap();
  const receipts=new WeakMap();
  let currentScope;
    let generation=0;
  function advance(){
    if(currentScope){currentScope.request=undefined;currentScope.sourceContributions=undefined;currentScope.sources=undefined;currentScope.judgmentBinding=undefined;currentScope.receipt=undefined;currentScope.root=undefined;currentScope.response=undefined;currentScope.signal=undefined;currentScope=undefined;}
    generation+=1;if(!Number.isSafeInteger(generation))throw new RequestObservationProfileError('Observation generation overflow');return generation;
  }
  function invalidate(){advance();}
  function assertScopeLifetime(scope){
    if(scope.invalidated)throw new RequestObservationStaleError(
      'Observation was already invalidated',
      {cause:scope.invalidationCause}
    );
    if(scope.signal
      ?.aborted)throw new RequestObservationStaleError(
      'Observed request was cancelled',
      {cause:scope.signal
        .reason}
    );
    if(scope.generation!==generation)throw new RequestObservationStaleError('Request generation changed');
    lifecycle.assertActive(scope.root);
  }
  function assertScope(
    scope,
    verifySources
  ) {
    if(scope.invalidated)throw new RequestObservationStaleError(
      'Observation was already invalidated',
      {cause:scope.invalidationCause}
    );
    try {
      assertScopeLifetime(scope);
      if(verifySources)verifySources();
      else collector.assertObservedFresh(scope.judgmentBinding
        ?.sources
        ??scope.sources);
      assertScopeLifetime(scope);
    } catch(error){if(error instanceof RootLeaseSuspendedError)throw error;tagged({tag:assertScope.name,l}).error(inspect(error,{depth:6,maxStringLength:2048}));if(!scope.invalidated){scope.invalidated=true;scope.invalidationCause=error;}throw new RequestObservationStaleError(
      'Observed request is no longer current',
      {cause:error}
    );}
  }
  function validate(
    scope,
    verifySources
  ) {
    assertScope(
      scope,
      verifySources
    );
    if(scope.failed)throw new RequestObservationUnavailableError(
      'No usable terminal request observation',
      {cause:scope.failure}
    );
    if(scope.claim
      ?.ambiguous)throw new RequestObservationOwnershipError('Response object was reused across request occurrences');
    if(!scope.receipt)throw new RequestObservationUnavailableError('Response completed without a terminal request observation');
  }
  function assertFresh(receipt) {
    const scope=object(receipt)?receipts.get(receipt):undefined;
    if(!scope)throw new RequestObservationOwnershipError('Receipt is not owned by this observer');
    validate(scope);
  }
  function observationFor(response) {
    const scope=object(response)?responses.get(response):undefined;
    if(!scope)throw new RequestObservationOwnershipError('Response is not associated with this observer');
    validate(scope);
    return scope.receipt;
  }
  /** Seal one governing snapshot without replacing the original emitted request or reviving failed scope. */
  function bindJudgmentSources(response){
    const scope=object(response)?responses.get(response):undefined;
    if(!scope)throw new RequestObservationOwnershipError('Response is not associated with this observer');
    if(scope.bindingJudgment){
      const error=new RequestObservationProfileError('Original judgment source handoff cannot reenter');
      scope.invalidated=true;scope.invalidationCause=error;throw error;
    }
    scope.bindingJudgment=true;
    try{
      if(scope.judgmentBinding){validate(scope);return scope.judgmentBinding;}
      let sources;
      validate(
        scope,
        function captureCurrentJudgmentSources() {
        if((typeof collector.captureJudgmentSources)==='function')sources=collector.captureJudgmentSources({
          original:scope.sources,
          signal:scope.signal
        });
        else{collector.assertObservedFresh(scope.sources);sources=scope.sources;}
        if((!object(sources))||(!Object.isFrozen(sources))
          ||((typeof sources.then)==='function'))throw new RequestObservationProfileError('Judgment source handoff requires an immutable synchronous owned snapshot');
      }
      );
      validate(
        scope,
        function checkCapturedJudgmentSources() { return (collector.assertObservedFresh(sources)); }
      );
      scope.judgmentBinding=Object.freeze({
        request:scope.receipt,
        sources
      });
      return scope.judgmentBinding;
    }finally{scope.bindingJudgment=false;}
  }
  async function streamFunction(
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
    currentScope=scope;
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
    async function observedFetch(
      input,
      init
    ) {
      if(scope.failed)throw scope.failure;
      try {
        assertScope(scope);
        if(scope.request)throw new RequestObservationProfileError('Multiple terminal fetches exceed this no-retry observation profile');
        const url=(typeof input)==='string'?input:input instanceof URL?input.href:undefined;
        if((url!==endpoint)||(init?.method!=='POST')
          ||((typeof init.body)!=='string')
          ||(!init.body
            .isWellFormed()))throw new RequestObservationProfileError('Only the declared serialized JSON POST shape is observed');
        if(Buffer.byteLength(init.body)>maxBodyBytes)throw new RequestObservationProfileError('Serialized request exceeds observation byte bound');
        let parsed;
        try{parsed=JSON.parse(init.body);}catch(error){throw new RequestObservationProfileError(
          'Serialized request is not valid JSON',
          {cause:error}
        );}
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
    }
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
  }
  return Object.freeze({
    streamFunction,
    observationFor,
    assertFresh,
    bindJudgmentSources,
    invalidate
  });
}
//endregion
