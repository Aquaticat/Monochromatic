//region Evidence collection cannot prevent or repeat the provider's payload callback.
/** Preserve native callback results and failures when source association is unavailable. */
export function prepareObservedPayload({prepareSourceAssociation,originalStream,sources,model,context,options,fail}){
 const previous=options?.onPayload;
 const state={called:false,value:undefined,nativeFailed:false};
 async function nativePayload(...args){
  state.called=true;
  try{state.value=previous?await Reflect.apply(previous,this,args):undefined;return state.value;}
  catch(error){state.nativeFailed=true;throw error;}
 }
 let association;
 try{
  association=prepareSourceAssociation?.({originalStream,sources,model,context,options:{...options,onPayload:nativePayload}});
 }catch(error){fail(error);}
 async function onPayload(...args){
  state.called=false;state.value=undefined;state.nativeFailed=false;
  try{return await Reflect.apply(association.onPayload,this,args);}
  catch(error){
   if(state.nativeFailed)throw error;
   fail(error);
   if(state.called)return state.value;
   return await Reflect.apply(nativePayload,this,args);
  }
 }
 return {association,onPayload:association?onPayload:previous};
}
//endregion
