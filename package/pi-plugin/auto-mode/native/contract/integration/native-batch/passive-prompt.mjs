import {createBaseCompositionOwner} from '../../collector/rule-relevance-sdk-copy/input/base-owner.mjs';
import {createRunPromptOwner} from '../../collector/run-prompt-custody-v3/owner.mjs';
import {createPassiveCapture,captureNativeCall} from './passive-capture.mjs';

//region Native prompt callbacks own effects; capture owners supply evidence only.
/** Preserve native resource reads and normalization when base evidence is unavailable. */
export function createPassiveBaseOwner(){
 const owner=createBaseCompositionOwner();
 const capture=createPassiveCapture();
 function build(input){
  const read=captureNativeCall(input.read);
  const normalize=captureNativeCall(input.normalize);
  const value=capture.observe({
   capture(){return owner.build({...input,read:read.call,normalize:normalize.call});},
   fallback(){return normalize.call(read.call().input);}
  });
  read.rethrow();normalize.rethrow();
  return value;
 }
 function read(input){capture.assertCaptured();return owner.read(input);}
 return Object.freeze({build,read,inspect:owner.inspect});
}

/** Keep the original native prompt and ordered extension callbacks usable after capture failure. */
export function createPassiveRunOwner({readNativeBase,...options}){
 const owner=createRunPromptOwner(options);
 const capture=createPassiveCapture();
 function start(input){
  return capture.observe({capture(){return owner.start(input);},fallback(){return {handle:Object.freeze({}),seed:readNativeBase()};}});
 }
 function enterNative(input){capture.observe({capture(){owner.enterNative(input);}});}
 async function invokeHandler(input){
  const state={called:false,reportFailed:false,error:undefined};
  async function invoke(){state.called=true;return await input.invoke();}
  function reportError(error){
   try{return input.reportError(error);}
   catch(failure){state.reportFailed=true;state.error=failure;throw failure;}
  }
  try{
   capture.assertCaptured();
   await owner.invokeHandler({...input,invoke,reportError});
  }catch(error){
   if(state.reportFailed)throw state.error;
   capture.fail(error);
   if(!state.called){
    try{await invoke();}
    catch(failure){reportError(failure);}
   }
  }
  if(state.reportFailed)throw state.error;
 }
 function leaveNative(input){
  return capture.observe({capture(){return owner.leaveNative(input);},fallback(){return {systemPromptOptions:input.working,messages:input.messages};}});
 }
 function render(input){
  const native=captureNativeCall(function build(observeGuideline){
   return input.build(input.options,function retainGuideline(value){
    capture.observe({capture(){observeGuideline?.(value);}});
   });
  });
  const value=capture.observe({
   capture(){return owner.render({...input,build(_options,observeGuideline){return native.call(observeGuideline);}});},
   fallback(){return native.call().sections;}
  });
  native.rethrow();
  return value;
 }
 function refresh(input){
  const native=captureNativeCall(input.compose);
  const value=capture.observe({
   capture(){return owner.refresh({...input,compose:native.call});},
   fallback(){return native.call({previous:input.previousOptions,base:readNativeBase()});}
  });
  native.rethrow();
  return value;
 }
 function publish(input){return capture.observe({capture(){return owner.publish(input);},fallback(){return input.result.systemPromptOptions;}});}
 function reset(){capture.observe({capture(){owner.reset();}});}
 function captureSystemMessage(input){capture.observe({capture(){owner.captureSystemMessage(input);}});}
 function captureContextClone(input){return capture.observe({capture(){return owner.captureContextClone(input);}});}
 function captureForcedMessage(input){capture.observe({capture(){owner.captureForcedMessage(input);}});}
 function captureHandlerMessage(input){capture.observe({capture(){owner.captureHandlerMessage(input);}});}
 function captureExpandedPromptMessage(input){capture.observe({capture(){owner.captureExpandedPromptMessage(input);}});}
 function read(input){capture.assertCaptured();return owner.read(input);}
 function readOrAbsent(input){capture.assertCaptured();return owner.readOrAbsent(input);}
 function readInputOrigins(input){capture.assertCaptured();return owner.readInputOrigins(input);}
 function readInputUsage(input){capture.assertCaptured();return owner.readInputUsage(input);}
 function fail({error}){capture.fail(error);return error;}
 return Object.freeze({start,enterNative,invokeHandler,leaveNative,render,refresh,publish,reset,captureSystemMessage,captureContextClone,captureForcedMessage,captureHandlerMessage,captureExpandedPromptMessage,read,readOrAbsent,readInputOrigins,readInputUsage,fail,inspect:owner.inspect});
}
//endregion
