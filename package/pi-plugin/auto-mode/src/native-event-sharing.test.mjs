/** Preserve complete native event receipts without repeating unchanged callback values. @module */
import assert from 'node:assert/strict';
import {
  env,
  fixture
} from '../dist/native/contract/integration/native-batch/event-receipt-fixture.mjs';
import {readNativeConstructedInputOrigins} from '../dist/native/contract/integration/native-batch/generated/session-manager.mjs';

//region Real native callback count changes retained metadata rather than repeating the complete payload.
/** Read the original manager's sole event source rather than a synthetic serializer result. */
function sourceBytes(manager){
 const origin=readNativeConstructedInputOrigins(manager)
   .find(function isEventSource(value){
  return value.source
    .inputOrigin
    ==='native-event-handler';
 });
 assert.ok(origin);
 return Buffer.byteLength(origin.source
   .content);
}

/** Separate registrations retain their native slot identities while returning no event mutation. */
function passiveHandlers(length){
 return Array.from(
   {length},
   function createPassiveHandler(){
  return function observeUnchangedEvent(){return undefined;};
 }
 );
}

await using cleanup={async [Symbol.asyncDispose](){await env.drain();}};
const payload='Original native event value.\n'.repeat(1_024);
const single=fixture({
  kind:'turn_start',
  handlers:passiveHandlers(1)
});
await single.runner
  .emit({
    type:'turn_start',
    text:payload
  });
const repeated=fixture({
  kind:'turn_start',
  handlers:passiveHandlers(30)
});
const event={
  type:'turn_start',
  text:payload
};
await repeated.runner
  .emit(event);
event.text='Changed after native completion';
const [records]=repeated.records();
assert.equal(
  records.length,
  60
);
for(const [index,record] of records.entries()){
 assert.equal(
   record.ordinal,
   Math.floor(index/2)
 );
 assert.equal(
   record.phase,
   (index%2)===0?'input':'after'
 );
 assert.equal(
   record.value
     .value
     .text,
   payload
 );
}
const singleBytes=sourceBytes(single.manager);
const repeatedBytes=sourceBytes(repeated.manager);
const boundaryText='"quoted" \\ escaped\n../traversal ; && $(literal) \\u0022';
const boundary=fixture({
  kind:'turn_start',
  handlers:passiveHandlers(2)
});
await boundary.runner
  .emit({
    type:'turn_start',
    text:boundaryText
  });
const [boundaryRecords]=boundary.records();
assert.equal(
  boundaryRecords.length,
  4
);
for(const record of boundaryRecords)assert.equal(
  record.value
    .value
    .text,
  boundaryText
);
assert.ok(
  repeatedBytes>singleBytes,
  'Positive control: every additional native phase retains its own metadata'
);
assert.ok(
  repeatedBytes<(singleBytes
    *3),
  'Unchanged native event values must not be copied once for every callback phase'
);
console.log(JSON.stringify({
  complete:true,
  callbacks:30,
  records:records.length,
  singleBytes,
  repeatedBytes,
  originalOrder:true,
  originalValues:true,
  syntaxBoundariesPreserved:true,
  borrowedMutationExcluded:true
}));
//endregion
