import assert from 'node:assert/strict';
import {fixture} from './event-receipt-fixture.mjs';
import {assertNativeSessionInputCapture,readNativeSessionInputUsage} from './generated/session-manager.mjs';

//region Preserve the original native event assertions and their fixture-owned observations.
export async function verifyEventBounds(){
 // A complete emission preserves every callback phase without byte-based splitting.
 const chunked=fixture({
   kind:'turn_start',
   handlers:Array.from(
     {length:24},
     function noResult(){return function observe(){return undefined;};}
   )
 });
 await chunked.runner
   .emit({
     type:'turn_start',
     text:'x'.repeat(8_192)
   });
 const chunks=chunked.records();
 assert.equal(chunks.length,1);
 assert.equal(
   chunks.flat()
     .length,
   48
 );
 assert.ok(Buffer.byteLength(JSON.stringify(chunks[0]))>65_536);
 assert.equal(
   readNativeSessionInputUsage(chunked.manager)
     .count,
   chunks.length
 );

 // Complete observations remain admissible beyond the former byte and count limits.
 const oversized=fixture({
   kind:'turn_start',
   handlers:[function observe(){return undefined;}]
 });
 await oversized.runner
   .emit({
     type:'turn_start',
     text:'x'.repeat(65_536)
   });
 assertNativeSessionInputCapture(oversized.manager);
 assert.equal(oversized.records()[0][0].value.value.text,'x'.repeat(65_536));
 const exhausted=fixture({
   kind:'turn_start',
   handlers:[function observe(){return undefined;}]
 });
 for(let ordinal=0;ordinal<128;ordinal++)await exhausted.runner
   .emit({
     type:'turn_start',
     ordinal
   });
 assertNativeSessionInputCapture(exhausted.manager);
 assert.equal(
   readNativeSessionInputUsage(exhausted.manager)
     .count,
   128
 );
 await exhausted.runner
   .emit({
     type:'turn_start',
     ordinal:128
   });
 assertNativeSessionInputCapture(exhausted.manager);
 assert.equal(readNativeSessionInputUsage(exhausted.manager).count,129);
 assert.equal(exhausted.records().length,129);

 // Capture never invokes a result accessor to discover its apparent data.
 const accessorState={calls:0};
 const accessor=fixture({
   kind:'turn_start',
   handlers:[function unsupportedResult(){return {get unused(){accessorState.calls++;return 'not data';}};}]
 });
 await accessor.runner
   .emit({type:'turn_start'});
 assert.equal(
   accessorState.calls,
   0
 );
 assert.throws(
   function requireOrdinaryValues(){assertNativeSessionInputCapture(accessor.manager);},
   function captureProfile(error){return error.message
     .includes('Run message data requires named data properties');}
 );

}
//endregion
