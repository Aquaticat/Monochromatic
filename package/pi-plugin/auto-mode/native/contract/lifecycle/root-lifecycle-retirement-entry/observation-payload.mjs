//region Evidence collection cannot prevent or repeat the provider's payload callback.
/** Preserve native callback results and failures when source association is unavailable. */
export function prepareObservedPayload({prepareSourceAssociation,originalStream,sources,model,context,options,fail}){
 const previous=options?.onPayload;
 const state={called:false,nativeFailed:false};
 /** @type {{value: unknown}} */
 const result={value:undefined};
 function createNativePayload(){return async function nativePayload(payload,selectedModel){
  state.called=true;
  try{
   result.value=previous?await Reflect.apply(previous,this,[payload,selectedModel]):undefined;
   return result.value;
  }catch(error){state.nativeFailed=true;throw error;}
 };}
 const nativePayload=createNativePayload();
 function createAssociation(){
  try{return prepareSourceAssociation?.({originalStream,sources,model,context,options:{...options,onPayload:nativePayload}});}
  catch(error){fail(error);return undefined;}
 }
 const association=createAssociation();
 function createObservedPayload(){return async function onPayload(payload,selectedModel){
  state.called=false;result.value=undefined;state.nativeFailed=false;
  try{return await Reflect.apply(association.onPayload,this,[payload,selectedModel]);}
  catch(error){
   if(state.nativeFailed)throw error;
   fail(error);
   if(state.called)return result.value;
   return await Reflect.apply(nativePayload,this,[payload,selectedModel]);
  }
 };}
 const onPayload=createObservedPayload();
 return {association,onPayload:association?onPayload:previous};
}
//endregion
