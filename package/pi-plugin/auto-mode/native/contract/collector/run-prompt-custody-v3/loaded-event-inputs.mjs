import {types} from "node:util";
import {SourceCollectionError} from "../collector.mjs";
import {copyToolMetadata} from "../run-prompt-custody/messages.mjs";
import {dataField} from './loaded-fields.mjs';
//region Account for pending callback observations without imposing a capture ceiling.
/** Account for pending callback observations without imposing a capture ceiling. */
export function createLoadedEventInputs({poolState,InputCaptureError,reserve,retainConstructedInput}){

/** Group one native emission while copying each callback phase before its borrowed value can change. */
function createEventHandlerCapture(){
   const eventState={records:[],retainedBytes:0,part:0,closed:false};
   
   
   
   function publish(){
    if(eventState.records.length===0)return;
    poolState.pendingEventBytes-=eventState.retainedBytes;
    retainConstructedInput({
      carrier:Object.freeze({records:eventState.records}),
      value:eventState.records,
      metadata:{
        method:eventState.records[0]
          .kind,
        part:eventState.part
      },
      inputField:'eventHandler',
      inputOrigin:'native-event-handler'
    });
    eventState.records=[];eventState.retainedBytes=0;eventState.part++;
   }
   function capture(input){
    if(poolState.failure)return;
    try{
     if(eventState.closed)throw new SourceCollectionError('Native event source was already completed');
     const record=Object.freeze({
       kind:input.kind,
       phase:input.phase,
       ordinal:input.ordinal,
       path:input.path,
       value:copyToolMetadata({value:input.value})
     });
     const recordBytes=Buffer.byteLength(JSON.stringify(record));
     if(eventState.records.length===0)reserve();
     // Array delimiters and commas are charged before any complete emission publication.
     const addedBytes=recordBytes+(eventState.records.length===0?2:1);
     eventState.records.push(record);eventState.retainedBytes+=addedBytes;poolState.pendingEventBytes+=addedBytes;
    }catch(error){
     poolState.failure=new InputCaptureError(error);
     // Capture failure is retained in the pool and enforced only by automatic assessment readers.
    }
   }
   function complete(){
    if(poolState.failure)return;
    try{
     if(eventState.closed)throw new SourceCollectionError('Native event source cannot complete twice');
     eventState.closed=true;
     publish();
    }catch(error){
     poolState.failure=new InputCaptureError(error);
     // Capture failure is retained in the pool and enforced only by automatic assessment readers.
    }
   }
   return Object.freeze({
     capture,
     complete
   });
  }
/** Retain original context inputs and complete results in the original manager store. */
function captureContextHandler(input){
   if(poolState.failure)return;
   try{
    reserve();
    const value=copyToolMetadata({value:input.value});
    retainConstructedInput({
      carrier:input,
      value,
      metadata:{
        method:input.kind,
        phase:input.phase,
        ordinal:input.ordinal,
        path:input.path
      },
      inputField:'contextHandler',
      inputOrigin:'native-context-handler'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    // Capture failure is retained in the pool and enforced only by automatic assessment readers.
   }
  }
/** Preserve the complete received result before native callback field selection. */
function captureHandlerResultOutput({frame}){
   if(poolState.failure)return;
   try{
    if(types.isProxy(frame)||(!types.isArgumentsObject(frame))
      ||(Object.getOwnPropertyDescriptor(
        frame,
        'length'
      )
        ?.value
        !==1))throw new SourceCollectionError('Handler result requires its original one-argument observation frame');
    const output=dataField({
      value:frame,
      key:'0'
    });
    if(output===undefined)return;
    reserve();
    // Metadata copying retains supported non-enumerable data and charges shared references per occurrence.
    const value=copyToolMetadata({output});
    retainConstructedInput({
      carrier:frame,
      value,
      metadata:{
        method:'before_agent_start',
        phase:'output'
      },
      inputField:'handlerResult',
      inputOrigin:'native-before-agent-start-output'
    });
   }catch(error){
    poolState.failure=new InputCaptureError(error);
    // Capture failure is retained in the pool and enforced only by automatic assessment readers.
   }
  }
return {
createEventHandlerCapture,
captureContextHandler,
captureHandlerResultOutput
};
}
//endregion
