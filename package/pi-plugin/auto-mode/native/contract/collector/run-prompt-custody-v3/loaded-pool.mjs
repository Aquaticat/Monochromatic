import {SourceCollectionError} from "../collector.mjs";
import {createInputOnlyPublication} from "./handler-publication.mjs";
import {dataField} from './loaded-fields.mjs';
import {createLoadedHistory} from './loaded-history.mjs';
import {createLoadedManagerInputs} from './loaded-manager-inputs.mjs';
import {createLoadedEventInputs} from './loaded-event-inputs.mjs';
import {createLoadedToolInputs} from './loaded-tool-inputs.mjs';
import {createLoadedAgentInputs} from './loaded-agent-inputs.mjs';
import {createLoadedUserInputs} from './loaded-user-inputs.mjs';
import {createInputContentStore,freezeInputContentSource} from './input-content.ts';
//region Original session and resource inputs share their pool state.
/**
 Capture owned native loaded values before migration changes their representation.
 The manager owns this occurrence. Saved roles, paths, identifiers and prior issuers confer no authority.
 */
export function createInputPool({
  entries,
  InputCaptureError
}){
 const occurrence=Object.freeze({});
 const origins=new WeakMap();
 const retainContent=createInputContentStore();
 const metadataTexts=new Map();
 const constructedInputs=[];
 const poolState={bytes:0,pendingEventBytes:0,count:0,failure:undefined,constructedSnapshot:Object.freeze([])};

 function reserve(){
  poolState.count++;
 }
 function retain({
   carrier,
   systemInput,
   value,
   metadata,
   ordinal,
   inputField='sessionMessages',
   inputOccurrence=occurrence,
   inputOrigin='native-load',
   kind='native-session-message-input'
 }){
  const contentFormat=(typeof value)==='string'?'text':'native-content-json';
  const serialized=contentFormat==='text'?value:JSON.stringify(value??[]);
  const data=retainContent({text:serialized,json:contentFormat==='native-content-json'});
  const serializedMetadata=JSON.stringify({...metadata,contentFormat});
  const metadataJSON=metadataTexts.get(serializedMetadata)??serializedMetadata;
  if(!metadataTexts.has(serializedMetadata))metadataTexts.set(serializedMetadata,metadataJSON);
  const source=freezeInputContentSource({content:data,fields:{
    kind,
    contentFormat,
    inputOrigin,
    inputLocation:Object.freeze({
      field:inputField,
      ...(ordinal===undefined?{}:{ordinal}),
      metadataJSON
    }),
    sha256:data.sha256,
    occurrence:Object.freeze({}),
    ...(kind==='native-resource-tool-input'?{resourceInputOccurrence:inputOccurrence}:{sessionInputOccurrence:inputOccurrence}),
    registration:undefined,
    historicalIssuer:'not-established',
    permission:false
  }});
  poolState.bytes+=Buffer.byteLength(JSON.stringify(source));
  const publisher=createInputOnlyPublication({source,systemInput});publisher.capture(carrier);
  const origin=Object.freeze({
    source,
    publication:publisher.view,
    ...(kind==='native-resource-tool-input'?{resourceInputOccurrence:inputOccurrence}:{sessionInputOccurrence:inputOccurrence})
  });
  origins.set(
    publisher.view,
    origin
  );return origin;
 }
 function retainConstructedInput(input){
  const origin=retain({
    ...input,
    inputOccurrence:Object.freeze({})
  });
  constructedInputs.push(origin);
  poolState.constructedSnapshot=undefined;
 }

 const {captureSummary,captureEdit,captureLoadedEntries}=createLoadedHistory({occurrence,reserve,retain,poolState,InputCaptureError});
captureLoadedEntries(entries);
const {captureInitialManagerInput,captureManagerInput}=createLoadedManagerInputs({poolState,InputCaptureError,reserve,retainConstructedInput});
const {createEventHandlerCapture,captureContextHandler,captureHandlerResultOutput}=createLoadedEventInputs({poolState,InputCaptureError,reserve,retainConstructedInput});
const {captureToolLoadoutQuery,captureToolLoadoutInput,captureToolLoadoutOutput,captureExtensionToolInput,captureCustomToolDescriptions}=createLoadedToolInputs({poolState,InputCaptureError,reserve,retainConstructedInput});
const {captureAgentInput}=createLoadedAgentInputs({poolState,InputCaptureError,reserve,retainConstructedInput});
const {captureQueuedInput,captureUninterceptedInput,captureCallInput,captureCommandInput,captureTransformedInput,captureInputEvent,captureCustomMessageInput}=createLoadedUserInputs({poolState,InputCaptureError,reserve,retainConstructedInput});
 return Object.freeze({
  captureQueuedInput,
  captureUninterceptedInput,
  captureInitialManagerInput,
  captureManagerInput,
  captureToolLoadoutQuery,
  captureToolLoadoutInput,
  createEventHandlerCapture,
  captureContextHandler,
  captureHandlerResultOutput,
  captureToolLoadoutOutput,
  captureExtensionToolInput,
  captureCustomToolDescriptions,
  captureAgentInput,
  captureCallInput,
  captureCommandInput,
  captureTransformedInput,
  captureInputEvent,
  captureCustomMessageInput,
  readConstructedInputs(){
    poolState.constructedSnapshot??=Object.freeze([...constructedInputs]);
    return poolState.constructedSnapshot;
  },
  inputUsage(){if(poolState.failure)throw poolState.failure;return Object.freeze({
    count:poolState.count,
    bytes:poolState.bytes+poolState.pendingEventBytes
  });},
  captureCreatedInput({
    entry,
    ordinal
  }){
   if(poolState.failure)return;
   try{
    const type=dataField({
      value:entry,
      key:'type'
    });
    if(![
      'context_edit',
      'compaction',
      'branch_summary'
    ].includes(type))return;
    if((!Number.isSafeInteger(ordinal))||(ordinal<0))throw new SourceCollectionError('Native appended input requires its original entry position');
    const input={
      entry,
      ordinal,
      inputOccurrence:Object.freeze({}),
      inputOrigin:'native-append'
    };
    if(type==='context_edit')captureEdit(input);else captureSummary({
      ...input,
      type
    });
   }catch(error){poolState.failure=new InputCaptureError(error);}
  },
  lookup(publication){return origins.get(publication);},
  assertCaptured(){if(poolState.failure)throw poolState.failure;}
 });
}
//endregion
