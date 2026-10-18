/** Retain native cancellation state without admitting control objects as ordinary data. @module */
import assert from 'node:assert/strict';
import {env,fixture} from '../dist/native/contract/integration/native-batch/event-receipt-fixture.mjs';
import {copyToolMetadata,copyMessageData} from '../dist/native/contract/collector/run-prompt-custody/messages.mjs';

//region Real native callbacks keep their signal while manager receipts retain immutable state

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
assert.deepEqual(records.map(record=>record.phase),['input','after','input','after']);
assert.deepEqual(records.map(record=>record.ordinal),[0,0,1,1]);
assert.deepEqual(records.map(record=>record.value.value.signal.aborted),[false,true,true,true]);
for(const record of records){
 assert.equal(record.value.value.type,original.type);
 assert.deepEqual(record.value.value.preparation,preparation);
}
assert.deepEqual(records.map(record=>record.value.value.signal.aborted),[false,true,true,true]);

//endregion Real native callbacks keep their signal while manager receipts retain immutable state

//region Ordinary data and untrusted native lookalikes keep their rejection boundaries

assert.throws(function ordinaryToolSignal(){copyToolMetadata({signal:controller.signal});});
assert.throws(function ordinaryMessageSignal(){copyMessageData({signal:controller.signal});});
const rejected=[
 {name:'forged signal',kind:'session_before_tree',signal:Object.create(AbortSignal.prototype)},
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
console.log(JSON.stringify({complete:true,originalSignalPreserved:true,immutableCancellationStates:true,
 originalCallbackOrder:true,ordinaryDataStillStrict:true,forgedAndProxySignalsRejected:true}));

//endregion Ordinary data and untrusted native lookalikes keep their rejection boundaries
