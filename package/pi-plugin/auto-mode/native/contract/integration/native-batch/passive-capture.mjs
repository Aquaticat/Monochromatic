import {tagged} from '@monochromatic-dev/module-logger/ts';

//region Capture failures are retained for automatic assessment without controlling native effects.
/** One source owner retains its first observation failure for its protected readers. */
export function createPassiveCapture(){
 const state={failure:undefined};
 const l=tagged({tag:createPassiveCapture.name,l:tagged({tag:'auto-mode-passive-capture'})});
 function fail(error){
  tagged({tag:fail.name,l}).debug(`retaining capture failure for manual fallback: ${String(error)}`);
  state.failure??={error};
 }
 function assertCaptured(){if(state.failure)throw state.failure.error;}
 function observe({capture,fallback}){
  if(!state.failure){
   try{return capture();}
   catch(error){fail(error);}
  }
  return fallback?.();
 }
 return Object.freeze({fail,assertCaptured,observe});
}

/** A native callback keeps its exact return or thrown value even if observation fails around it. */
export function captureNativeCall(invoke){
 /** @type {{called:boolean,failed:boolean,value:unknown,error:unknown}} */
 const state={called:false,failed:false,value:undefined,error:undefined};
 function call(input){
  if(state.called){if(state.failed)throw state.error;return state.value;}
  state.called=true;
  try{state.value=invoke(input);return state.value;}
  catch(error){state.failed=true;state.error=error;throw error;}
 }
 function rethrow(){if(state.failed)throw state.error;}
 return Object.freeze({call,rethrow});
}
//endregion
