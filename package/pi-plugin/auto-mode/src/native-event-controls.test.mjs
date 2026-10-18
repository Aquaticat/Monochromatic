/** Retain native cancellation state without admitting control objects as ordinary data. @module */
import assert from 'node:assert/strict';
import {env,fixture} from '../dist/native/contract/integration/native-batch/event-receipt-fixture.mjs';
import {copyToolMetadata,copyMessageData} from '../dist/native/contract/collector/run-prompt-custody/messages.mjs';

//region Native callbacks own cancellation while receipts retain only opaque control identity

await using cleanup={async [Symbol.asyncDispose](){await env.drain();}};
const controller=new AbortController();
const observed=[];
const preparation={targetId:'original-target',text:'"quoted" \\ boundary\n世界'};
const original={type:'session_before_tree',preparation,signal:controller.signal};
const event=fixture({kind:original.type,handlers:[
 function cancelOriginal(input){
  assert.equal(input,original);
  assert.equal(input.signal,controller.signal);
  observed.push(input.signal.aborted);
  controller.abort('original navigation cancellation');
 },
 function observeOriginal(input){
  assert.equal(input,original);
  assert.equal(input.signal,controller.signal);
  observed.push(input.signal.aborted);
 }
]});
await event.runner.emit(original);
assert.deepEqual(observed,[false,true]);
assert.equal(original.signal,controller.signal);
assert.equal(original.signal.reason,'original navigation cancellation');
const [records]=event.records();
assert.equal(records.length,4);
assert.deepEqual(records.map(function phase(record){return record.phase;}),['input','after','input','after']);
assert.deepEqual(records.map(function ordinal(record){return record.ordinal;}),[0,0,1,1]);
for(const record of records)assert.deepEqual(record.value.value.signal,{
 nativeControl:'cancellation-signal',reference:0
});
for(const record of records){
 assert.equal(record.value.value.type,original.type);
 assert.deepEqual(record.value.value.preparation,preparation);
}
const replacement=new AbortController().signal;
const originalReference=new AbortController().signal;
const changed={type:'session_before_tree',preparation,signal:originalReference};
const identities=fixture({kind:changed.type,handlers:[
 function replaceControl(input){input.signal=replacement;},
 function restoreControl(input){input.signal=originalReference;}
]});
await identities.runner.emit(changed);
const [identityRecords]=identities.records();
assert.deepEqual(identityRecords.map(function controlReference(record){return record.value.value.signal.reference;}),[0,1,1,0]);
assert.equal(changed.signal,originalReference);

/** Native controls remain opaque even when public properties are replaced by accessors. */
async function verifyOpaquePlatformControl(){
const preAborted=new AbortController();
preAborted.abort();
let controlReads=0;
Object.defineProperty(preAborted.signal,'aborted',{get(){controlReads++;throw new Error('Control internals were read');}});
const compact=fixture({kind:'session_before_compact',handlers:[function preserveCompactControl(input){
 assert.equal(input.signal,preAborted.signal);
}]});
const compactInput={type:'session_before_compact',preparation};
Object.defineProperty(compactInput,'signal',{value:preAborted.signal,enumerable:false});
await compact.runner.emit(compactInput);
const [compactRecords]=compact.records();
assert.equal(compactRecords.length,2);
assert.deepEqual(compactRecords[0].value.value.signal,{nativeControl:'cancellation-signal',reference:0});
assert.equal(controlReads,0);
}
await verifyOpaquePlatformControl();

// The platform's prototype is compatibility information, not constructor authentication.
const lookalike=Object.create(AbortSignal.prototype);
const opaque=fixture({kind:'session_before_tree',handlers:[function preserveOpaqueValue(input){assert.equal(input.signal,lookalike);}]});
await opaque.runner.emit({type:'session_before_tree',preparation,signal:lookalike});
const [opaqueRecords]=opaque.records();
assert.deepEqual(opaqueRecords[0].value.value.signal,{nativeControl:'cancellation-signal',reference:0});

for(const controlData of [undefined,null,false,{note:'Ordinary declared-field data remains visible'}]){
 const ordinary=fixture({kind:'session_before_tree',handlers:[function preserveOrdinaryControl(input){assert.equal(input.signal,controlData);}]});
 await ordinary.runner.emit({type:'session_before_tree',preparation,signal:controlData});
 const [ordinaryRecords]=ordinary.records();
 assert.deepEqual(ordinaryRecords[0].value.value.signal,controlData);
}
const absent=fixture({kind:'session_before_tree',handlers:[function preserveAbsentControl(){return undefined;}]});
await absent.runner.emit({type:'session_before_tree',preparation});
const [absentRecords]=absent.records();
assert.equal(Object.hasOwn(absentRecords[0].value.value,'signal'),false);

//endregion Native callbacks own cancellation while receipts retain only opaque control identity

//region Ordinary data and untrusted native lookalikes keep their rejection boundaries

assert.throws(function ordinaryToolSignal(){copyToolMetadata({signal:controller.signal});});
assert.throws(function ordinaryMessageSignal(){copyMessageData({signal:controller.signal});});
const rejected=[
 {name:'unrelated control class',kind:'session_before_tree',signal:new Date(0)},
 {name:'proxy signal',kind:'session_before_tree',signal:new Proxy(new AbortController().signal,{})},
 {name:'signal on another event kind',kind:'turn_start',signal:new AbortController().signal}
];
for(const value of rejected){
 const calls=[];
 const candidate=fixture({kind:value.kind,handlers:[function preserveCallback(input){calls.push(input.signal);} ]});
 await candidate.runner.emit({type:value.kind,preparation,signal:value.signal});
 assert.equal(calls.length,1,value.name+' must not replace original invocation');
 assert.equal(calls[0],value.signal);
 assert.throws(function rejectMissingEvidence(){candidate.records();},undefined,value.name);
}
const nested=fixture({kind:'session_before_tree',handlers:[function preserveNestedInput(){return undefined;}]});
await nested.runner.emit({type:'session_before_tree',preparation:{...preparation,signal:new AbortController().signal},signal:new AbortController().signal});
assert.throws(function rejectNestedControl(){nested.records();});
const output=fixture({kind:'session_before_tree',handlers:[function returnExtensionControl(){return {signal:new AbortController().signal};}]});
await output.runner.emit({type:'session_before_tree',preparation,signal:new AbortController().signal});
assert.throws(function rejectExtensionControl(){output.records();});
/** Invalid event accessors are rejected without invoking their code or replacing native callbacks. */
async function verifySignalAccessorRejection(){
let signalReads=0;
const accessorInput={type:'session_before_tree',preparation};
Object.defineProperty(accessorInput,'signal',{get(){signalReads++;return controller.signal;},enumerable:true});
const accessor=fixture({kind:'session_before_tree',handlers:[function preserveAccessorInput(){return undefined;}]});
await accessor.runner.emit(accessorInput);
assert.throws(function rejectAccessor(){accessor.records();});
assert.equal(signalReads,0);
}
await verifySignalAccessorRejection();
console.log(JSON.stringify({complete:true,originalSignalPreserved:true,opaqueControlReferences:true,
 originalCallbackOrder:true,ordinaryDataStillStrict:true,proxyAndUnrelatedClassesRejected:true,controlGettersNotRead:true}));

//endregion Ordinary data and untrusted native lookalikes keep their rejection boundaries
