import {SourceCollectionError} from '../collector.mjs';
import {freezePromptOptions} from '../base-prompt-custody-v2/copy.mjs';
import {snapshotRunMessages} from '../run-prompt-custody/messages.mjs';
import {RunPromptCustodyError} from './failures.mjs';
export {RunPromptCustodyError} from './failures.mjs';
import {createRunEmission} from './emission.mjs';
import {createRunRendering} from './rendering.mjs';
import {createRunRetainedInputs} from './retained-inputs.mjs';
import {createRunContext} from './context.mjs';
import {createRunPublication} from './publication.mjs';
import {createRunLifecycle} from './lifecycle.mjs';


//region Private session operation state and explicit propagation aliases.

/** Fixed native session code privately holds this owner and its base/lifetime readers. */
export function createRunPromptOwner({
  assertLive,
  readBase,
  readRoot,
  readSessionInput,
  readConstructedInputs,
  assertSessionInputs,
  requireRenderCapture=false
}){
  if(((typeof assertLive)!=='function')||((typeof readBase)!=='function'))throw new SourceCollectionError('Native run requires fixed session lifetime and base readers');
  if((readConstructedInputs!==undefined)&&(((typeof readConstructedInputs)!=='function')||((typeof readSessionInput)!=='function')))throw new SourceCollectionError('Constructed message inputs require their fixed native origin readers');
  if((readRoot!==undefined)&&((typeof readRoot)!=='function'))throw new SourceCollectionError('Native selected inputs require their fixed root reader');
  if(((readSessionInput!==undefined)||(assertSessionInputs!==undefined))&&(![
    readSessionInput,
    assertSessionInputs
  ].every(function isCallableReader(value) { return ((typeof value)==='function'); })))throw new SourceCollectionError('Native session inputs require their fixed origin and capture readers');
  const scopes=new WeakMap();
    const issuedErrors=new WeakMap();
    const history=[];
  const state={absent:true,active:undefined,current:undefined,operating:false,selectedPathInputs:undefined,handlerInputView:Object.freeze([]),combinedInputView:undefined};

  function guard(scope){const error=new RunPromptCustodyError(scope.failures);issuedErrors.set(
    error,
    scope
  );return error;}
  function record({
    scope,
    error,
    at
  }){scope.failures
    .push(Object.freeze({
      identity:Object.freeze({}),
      ordinal:scope.failures
        .length,
      error,
      at
    }));}
  function reject({
    scope,
    message,
    at
  }){record({
    scope,
    error:new SourceCollectionError(message),
    at
  });throw guard(scope);}
  function known(handle){const scope=scopes.get(handle);if(!scope)throw new SourceCollectionError('Run scope belongs to another native owner');return scope;}
  function check(scope){
    assertLive();if(scope.failures
      .length
      > 0)throw guard(scope);
    if(readRoot&&(scope.rootOccurrence!==readRoot()))throw new SourceCollectionError('Native run inputs belong to a different original root');
  }
  function phase({
    scope,
    at,
    run
  }){
    if(state.operating)reject({
      scope,
      message:'Native run source bookkeeping cannot reenter',
      at
    });
    state.operating=true;
    using phaseLifetime={ [Symbol.dispose](){state.operating=false;} };
    try{return run();}
    catch(error){if(issuedErrors.get(error)!==scope)record({
      scope,
      error,
      at
    });throw guard(scope);}
    
  }
  function reserve(kind){
    if(state.active)reject({
      scope:state.active,
      message:'Native run preparation cannot overlap or reenter',
      at:'entry'
    });
    const handle=Object.freeze({});
    const scope={
      handle,
      rootOccurrence:readRoot?.(),
      ordinal:history.length,
      kind,
      state:'created',
      failures:[],
      slots:[],
      next:0,
      running:undefined,
      parent:undefined,
      node:undefined,
      view:undefined
    };
    scopes.set(
      handle,
      scope
    );history.push(scope);state.active=scope;state.current=undefined;state.absent=false;return scope;
  }
  function fail({
    scope:handle,
    error
  }){
    const scope=known(handle);
    // Only errors actually issued by this owner are propagation aliases. Public error shape is irrelevant.
    if(issuedErrors.get(error)!==scope)record({
      scope,
      error,
      at:'native-operation'
    });
    scope.state='failed';if(state.active===scope)state.active=undefined;if(state.current===scope)state.current=undefined;return guard(scope);
  }
  function base(){
    const value=readBase();
    if((!value)||(!Object.isFrozen(value))
      ||(value.status!=='ready')
      ||(!Object.isFrozen(value.options)))throw new SourceCollectionError('Native run base reader did not return a ready owned base');
    return value;
  }
  function capture({
    scope,
    options,
    messages
  }){
    return Object.freeze({
        options:freezePromptOptions(options),
        messages:snapshotRunMessages(messages)
    });
  }
  function dense({
    value
  }){
    if((!Array.isArray(value))||(Object.getPrototypeOf(value)!==Array.prototype)
      ||(Reflect.ownKeys(value)
        .length
        !==(value.length
        +1)))throw new SourceCollectionError('Native handler snapshot requires bounded dense arrays');
    for(let index=0;index<value.length;index++){
      const property=Object.getOwnPropertyDescriptor(
        value,
        String(index)
      );
      if((!property?.enumerable)||(!Object.hasOwn(
        property,
        'value'
      )))throw new SourceCollectionError('Native handler snapshot has missing or accessor entries');
    }
    return value;
  }

  const {start,enterNative,invokeHandler,leaveNative}=createRunEmission({state,reserve,phase,check,base,fail,known,dense,capture,record,issuedErrors});
const {render,captureSystemMessage}=createRunRendering({state,check,issuedErrors,record,guard});
const {readHandlerOptionOrigins,readInputOrigins,readInputUsage,originalMessageInput,assertRetainedInput,retainAppendedInput,retainSelectedPath}=createRunRetainedInputs({state,scopes,history,assertLive,readRoot,readSessionInput});
const {retainContextInputs,captureContextClone,captureExpandedPromptMessage,captureHandlerMessage,captureForcedMessage}=createRunContext({state,phase,check,known,assertLive,assertSessionInputs,readRoot,readConstructedInputs,readHandlerOptionOrigins,originalMessageInput,assertRetainedInput,retainAppendedInput,retainSelectedPath});
const {publishScope}=createRunPublication({state,check,base,requireRenderCapture});
const {publish,refresh,reset,read,readOrAbsent,inspect}=createRunLifecycle({state,history,known,phase,check,publishScope,reserve,base,fail,reject,assertLive,readConstructedInputs,retainContextInputs,assertSessionInputs,readRoot});
return Object.freeze({
    start,
    enterNative,
    invokeHandler,
    leaveNative,
    render,
    captureSystemMessage,
    captureContextClone,
    captureForcedMessage,
    captureHandlerMessage,
    captureExpandedPromptMessage,
    publish,
    refresh,
    reset,
    read,
    readOrAbsent,
    readInputOrigins,
    readInputUsage,
    inspect,
    fail
  });
}
//endregion
