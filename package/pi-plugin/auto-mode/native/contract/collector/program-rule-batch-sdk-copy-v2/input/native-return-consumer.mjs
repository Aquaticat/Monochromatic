import {scriptValueGuard} from "./script-value-guard.ts";
import {toScriptValue} from "./native-script-value.mjs";
export class NativeReturnContractError extends Error {constructor(message){super(message);this.name=this.constructor.name;}}
export class UnsupportedScriptBindingError extends Error {constructor(kind){super('Native script conversion returned '+kind+'; this result-binding profile requires a bounded string');this.name=this.constructor.name;}}

//region Exact native invocation/return association stored on original owner-provided slots.
/**
 * getSlot and assertReturnedMember are fixed terminal-safe owner callbacks.
 * assertCurrent is separate and never runs while retaining an initiated native return.
 */
export function createNativeReturnConsumer({runNative,getSlot,assertCurrent,assertReturnedMember}){
  if([runNative,getSlot,assertCurrent,assertReturnedMember].some(value=>typeof value!=='function'))throw new NativeReturnContractError('Fixed native pipeline and original slot/currentness readers are required');
  let entering=false;
  async function invoke({slot:handle,call,options}){
    if(entering)throw new NativeReturnContractError('Native result consumer cannot reenter through synchronous callbacks');
    entering=true;let slot,invocation,pending;
    try{
      assertCurrent();slot=getSlot(handle);
      if(slot.native!==undefined)throw new NativeReturnContractError('Native slot already reserved its invocation');
      if(call.id!==slot.call.id||call.name!==slot.call.name)throw new NativeReturnContractError('Native call differs from its owned group slot');
      const tool=Object.freeze({name:slot.call.name,outputSchema:slot.tool.outputSchema?true:undefined});
      invocation={identity:Object.freeze({}),state:'running',call:Object.freeze({id:call.id,name:call.name}),tool,conversion:undefined,conversionCount:0};
      slot.native=invocation;
      // The fixed native function is called outside the judgment owner's public-operation lock.
      pending=runNative(call,options);
    }catch(error){if(invocation){invocation.state='threw';invocation.failure=error;}throw error;}
    finally{entering=false;}
    let outcome;
    try{outcome=await pending;}catch(error){invocation.state='threw';invocation.failure=error;throw error;}
    // No current-use reader here: completed native results must survive parent/source retirement.
    if(!outcome||typeof outcome!=='object'||outcome.toolCall?.id!==invocation.call.id||outcome.toolCall?.name!==invocation.call.name||typeof outcome.isError!=='boolean'||!outcome.result||typeof outcome.result!=='object'){
      const error=new NativeReturnContractError('Native pipeline returned an outcome for a different call or shape');invocation.state='invalid-return';invocation.failure=error;throw error;
    }
    invocation.outcome=outcome;invocation.state='returned';invocation.conversionCount++;
    try{
      const value=toScriptValue(invocation.tool,outcome);
      invocation.conversion=typeof value==='string'
        ?Object.freeze({status:'string',value,bytes:Buffer.byteLength(value)})
        :Object.freeze({status:'unsupported',kind:value===null?'null':typeof value});
    }catch(error){invocation.conversion=Object.freeze({status:'threw',error,messageAtCapture:error instanceof Error?error.message:String(error)});}
    return outcome;
  }
  function valueFor({slot:handle,outcome}){
    let slot,conversion;
    try{
      assertCurrent();slot=getSlot(handle);const invocation=slot.native;
      if(!invocation||invocation.state!=='returned'||invocation.outcome!==outcome)throw new NativeReturnContractError('Script value requires the exact native return for this owned slot');
      conversion=invocation.conversion;
      if(conversion.status!=='threw'){
        if(conversion.status==='unsupported')throw new UnsupportedScriptBindingError(conversion.kind);
        if(conversion.bytes>65536)throw new UnsupportedScriptBindingError('an oversized string');
        assertReturnedMember(slot.member);
      }
    }catch(error){throw scriptValueGuard({error,call:slot?.call});}
    // This throw is ordinary native tool failure, outside the code-owned guard boundary.
    if(conversion.status==='threw')throw conversion.error;
    return conversion.value;
  }
  function inspect(handle){
    const invocation=getSlot(handle).native;
    return Object.freeze({retainedOnly:true,state:invocation?.state??'uninvoked',identity:invocation?.identity,conversionCount:invocation?.conversionCount??0,conversion:invocation?.conversion,failure:invocation?.failure});
  }
  return Object.freeze({invoke,valueFor,inspect});
}
//endregion
