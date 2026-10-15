import {RootLeaseSuspendedError} from './lifecycle.mjs';
import {inspect} from 'node:util';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {RequestObservationError,RequestObservationOwnershipError,RequestObservationUnavailableError,RequestObservationStaleError,RequestObservationProfileError} from './observation-errors.mjs';
import {object,parseObservationEndpoint} from './observation-shape.mjs';
import {createObservationStream} from './observation-stream.mjs';
export {RequestObservationError,RequestObservationOwnershipError,RequestObservationUnavailableError,RequestObservationStaleError,RequestObservationProfileError} from './observation-errors.mjs';
const l=tagged({tag:'auto-mode-request-observation'});
// Consumer-owned observations are data receipts, not instruction authority or permission.
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
  const parsedEndpoint=parseObservationEndpoint(endpoint);
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
  const observationState={currentScope:undefined,generation:0};
  const responses=new WeakMap();
  const receipts=new WeakMap();
  
    
  function advance(){
    if(observationState.currentScope){observationState.currentScope.request=undefined;observationState.currentScope.sourceContributions=undefined;observationState.currentScope.sourceDerivation=undefined;observationState.currentScope.sourceDerivationFailure=undefined;observationState.currentScope.sources=undefined;observationState.currentScope.judgmentBinding=undefined;observationState.currentScope.receipt=undefined;observationState.currentScope.root=undefined;observationState.currentScope.response=undefined;observationState.currentScope.signal=undefined;observationState.currentScope=undefined;}
    observationState.generation+=1;if(!Number.isSafeInteger(observationState.generation))throw new RequestObservationProfileError('Observation generation overflow');return observationState.generation;
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
    if(scope.generation!==observationState.generation)throw new RequestObservationStaleError('Request generation changed');
    lifecycle.assertActive(scope.root);
  }
  function assertScope(
    {scope,verifySources}
  ) {
    if(scope.invalidated)throw new RequestObservationStaleError(
      'Observation was already invalidated',
      {cause:scope.invalidationCause}
    );
    try {
      assertScopeLifetime(scope);
      if((!verifySources)&&scope.preparingSources){
       const sources=collector.captureJudgmentSources({
         original:scope.sources,
         signal:scope.signal,
         extend:true
       });
       scope.judgmentBinding=Object.freeze({
         request:scope.receipt,
         sources
       });
      }
      if(verifySources)verifySources();
      else collector.assertObservedFresh(scope.judgmentBinding
        ?.sources
        ??scope.sources);
      assertScopeLifetime(scope);
    } catch(error){if(error instanceof RootLeaseSuspendedError)throw error;tagged({
      tag:assertScope.name,
      l
    })
      .error(inspect(
        error,
        {
          depth:6,
          maxStringLength:2_048
        }
      ));if(!scope.invalidated){scope.invalidated=true;scope.invalidationCause=error;}throw new RequestObservationStaleError(
      'Observed request is no longer current',
      {cause:error}
    );}
  }
  function validate(
    {scope,verifySources}
  ) {
    assertScope(
      {scope:scope,verifySources:verifySources}
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
    validate({scope:scope});
  }
  function observationFor(response) {
    const scope=object(response)?responses.get(response):undefined;
    if(!scope)throw new RequestObservationOwnershipError('Response is not associated with this observer');
    validate({scope:scope});
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
    using bindingScope={
      [Symbol.dispose]() {
        scope.bindingJudgment=false;
      }
    };
    {
      if(scope.judgmentBinding){validate({scope:scope});return scope.judgmentBinding;}
      let sources;
      validate(
        {scope:scope,verifySources:function captureCurrentJudgmentSources() {
        if((typeof collector.captureJudgmentSources)==='function')sources=collector.captureJudgmentSources({
          original:scope.sources,
          signal:scope.signal
        });
        else{collector.assertObservedFresh(scope.sources);sources=scope.sources;}
        if((!object(sources))||(!Object.isFrozen(sources))
          ||((typeof sources.then)==='function'))throw new RequestObservationProfileError('Judgment source handoff requires an immutable synchronous owned snapshot');
      }}
      );
      validate(
        {scope:scope,verifySources:function checkCapturedJudgmentSources() { return (collector.assertObservedFresh(sources)); }}
      );
      scope.judgmentBinding=Object.freeze({
        request:scope.receipt,
        sources
      });
      return scope.judgmentBinding;
    }
  }
  /** Native preparation may append observed event sources before assessment starts. */
  function beginJudgmentSources(response){
   const binding=bindJudgmentSources(response);
   const scope=responses.get(response);
   if(scope.sourcePreparationClosed)throw new RequestObservationProfileError('Original judgment source preparation was already sealed');
   if((typeof collector.captureJudgmentSources)!=='function')throw new RequestObservationProfileError('Native preparation requires its original source handoff');
   scope.preparingSources=true;
   return binding;
  }
  /** Seal the complete prepared source collection once without creating another request or judgment. */
  function sealJudgmentSources(response){
   const scope=object(response)?responses.get(response):undefined;
   if((!scope?.preparingSources)||scope.sourcePreparationClosed)throw new RequestObservationProfileError('No original native source preparation remains open');
   validate({scope:scope});
   scope.preparingSources=false;
   scope.sourcePreparationClosed=true;
   return scope.judgmentBinding;
  }
  /** Bind approved execution to the assessed collection while retaining later inputs for subsequent decisions. */
  function retainApprovedSources(response){
   const scope=object(response)?responses.get(response):undefined;
   if((!scope?.sourcePreparationClosed)||scope.preparingSources)throw new RequestObservationProfileError('Approved execution requires sealed original judgment sources');
   validate({scope:scope});
   collector.retainApprovedSources(scope.judgmentBinding
     .sources);
   validate({scope:scope});
  }
  const streamFunction=createObservationStream({
    originalStream,
    terminalFetch,
    lifecycle,
    boundRoot,
    collector,
    endpoint,
    maxBodyBytes,
    prepareSourceAssociation,
    observationState,
    advance,
    assertScope,
    responses,
    receipts
  });
  return Object.freeze({
    streamFunction,
    observationFor,
    assertFresh,
    bindJudgmentSources,
    beginJudgmentSources,
    sealJudgmentSources,
    retainApprovedSources,
    invalidate
  });
}
//endregion
