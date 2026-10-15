import {createHash} from "node:crypto";
import {SourceCollectionError} from "../collector.mjs";
import {createInputOnlyPublication} from "./handler-publication.mjs";
import {dataField} from './loaded-fields.mjs';
import {createLoadedHistory} from './loaded-history.mjs';
import {createLoadedManagerInputs} from './loaded-manager-inputs.mjs';
import {createLoadedEventInputs} from './loaded-event-inputs.mjs';
import {createLoadedToolInputs} from './loaded-tool-inputs.mjs';
import {createLoadedAgentInputs} from './loaded-agent-inputs.mjs';
import {createLoadedUserInputs} from './loaded-user-inputs.mjs';
//region Original session and resource inputs share their pool state.
/**
 Capture owned native loaded values before migration changes their representation.
 The manager owns this occurrence. Saved roles, paths, identifiers and prior issuers confer no authority.
 */
export function createInputPool({
  entries,
  maximumInputs,
  maximumSnapshotBytes,
  InputCaptureError
}){
 const occurrence=Object.freeze({});
 const origins=new WeakMap();
 const poolState={bytes:0,pendingEventBytes:0,count:0,failure:undefined,constructedInputs:Object.freeze([])};

 function reserve(){
  if((++poolState.count)>maximumInputs)throw new SourceCollectionError(`Original input receipts exceed the ${maximumInputs}-source profile`);
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
  const content=contentFormat==='text'?value:JSON.stringify(value??[]);
  if(Buffer.byteLength(content)>65_536)throw new SourceCollectionError('Loaded session message content exceeds the original source byte bound');
  const source=Object.freeze({
    kind,
    content,
    contentFormat,
    inputOrigin,
    inputLocation:Object.freeze({
      field:inputField,
      ...(ordinal===undefined?{}:{ordinal}),
      metadataJSON:JSON.stringify({
        ...metadata,
        contentFormat
      })
    }),
    sha256:createHash('sha256')
      .update(content)
      .digest('hex'),
    occurrence:Object.freeze({}),
    ...(kind==='native-resource-tool-input'?{resourceInputOccurrence:inputOccurrence}:{sessionInputOccurrence:inputOccurrence}),
    registration:undefined,
    historicalIssuer:'not-established',
    permission:false
  });
  poolState.bytes+=Buffer.byteLength(JSON.stringify(source));
  if((poolState.bytes+poolState.pendingEventBytes)>maximumSnapshotBytes)throw new SourceCollectionError('Loaded session source observations exceed the original snapshot byte bound');
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
  poolState.constructedInputs=Object.freeze([
    ...poolState.constructedInputs,
    origin
  ]);
 }

 const {captureSummary,captureEdit,captureLoadedEntries}=createLoadedHistory({occurrence,reserve,retain,poolState,InputCaptureError});
captureLoadedEntries(entries);
const {captureInitialManagerInput,captureManagerInput}=createLoadedManagerInputs({poolState,InputCaptureError,reserve,retainConstructedInput});
const {createEventHandlerCapture,captureContextHandler,captureHandlerResultOutput}=createLoadedEventInputs({poolState,InputCaptureError,reserve,retainConstructedInput,maximumSnapshotBytes});
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
  readConstructedInputs(){return poolState.constructedInputs;},
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
