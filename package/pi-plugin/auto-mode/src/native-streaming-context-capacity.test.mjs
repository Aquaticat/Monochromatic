/** Preserve original native streaming snapshots without retaining each complete serialized prefix. @module */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {env,fixture} from '../dist/native/contract/integration/native-batch/event-receipt-fixture.mjs';
import {readNativeSessionInputUsage,readNativeConstructedInputOrigins} from '../dist/native/contract/integration/native-batch/generated/session-manager.mjs';

//region Original message-update callbacks retain distinct immutable input observations

await using cleanup={async [Symbol.asyncDispose](){await env.drain();}};
const count=1600;
const step=127;
const maximumRetainedBytes=32*1024*1024;
const state={callbacks:0};
const text=Array.from({length:4000},function nonRepeatingText(_,index){return createHash('sha256').update(String(index)).digest('hex');}).join('');
const message={role:'assistant',content:[{type:'thinking',thinking:''}]};
const observed=fixture({kind:'message_update',handlers:[function observeOriginalUpdate(event){
 assert.equal(event.message,message);
 assert.equal(event.assistantMessageEvent.partial,message);
 state.callbacks++;
}]});
globalThis.gc();
const initial=process.memoryUsage().heapUsed;
for(let index=1;index<=count;index++){
 message.content[0].thinking=text.slice(0,index*step);
 const update={type:'thinking_delta',contentIndex:0,delta:text.slice((index-1)*step,index*step),partial:message};
 await observed.runner.emit({type:'message_update',assistantMessageEvent:update,message});
}
message.content[0].thinking='Original mutable message changes after capture';
const origins=readNativeConstructedInputOrigins(observed.manager);
assert.equal(state.callbacks,count);
assert.equal(origins.length,count);
assert.equal(new Set(origins.map(function occurrence(origin){return origin.source.occurrence;})).size,count);
assert.equal(new Set(origins.map(function publication(origin){return origin.publication;})).size,count);
for(const index of [0,399,799,count-1]){
 const source=origins[index].source;
 const serialized=source.content;
 assert.equal(createHash('sha256').update(serialized).digest('hex'),source.sha256);
 const snapshot=JSON.parse(serialized);
 assert.deepEqual(snapshot.records.map(function phase(record){return record.phase;}),['input','after']);
 for(const record of snapshot.records){
  const captured=snapshot.values[record.valueOrdinal].value.value;
  assert.equal(captured.message.content[0].thinking,text.slice(0,(index+1)*step));
  assert.equal(captured.assistantMessageEvent.partial.content[0].thinking,text.slice(0,(index+1)*step));
 }
}
globalThis.gc();
const retained=process.memoryUsage().heapUsed-initial;
assert.ok(retained<maximumRetainedBytes,`Original native streaming snapshots retain ${retained} bytes, exceeding ${maximumRetainedBytes}`);
console.log(JSON.stringify({complete:true,actualNativeRunner:true,progressEvents:count,callbackIdentityPreserved:true,distinctPublications:true,independentSnapshots:true,retainedHeapBytes:retained,serializedReceiptBytes:readNativeSessionInputUsage(observed.manager).bytes}));

//endregion Original message-update callbacks retain distinct immutable input observations
