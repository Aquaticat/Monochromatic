import assert from 'node:assert/strict';
import {fixture} from './event-receipt-fixture.mjs';
import {assertNativeSessionInputCapture,readNativeSessionInputUsage} from './generated/session-manager.mjs';

//region Preserve the original native event assertions and their fixture-owned observations.
export async function verifyEventBounds(){
 // Emissions split into bounded sources while preserving every original callback phase.
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
 assert.ok(chunks.length>1);
 assert.equal(
   chunks.flat()
     .length,
   48
 );
 assert.ok(chunks.every(function boundedChunk(chunk){return Buffer.byteLength(JSON.stringify(chunk))<=65_536;}));
 assert.equal(
   readNativeSessionInputUsage(chunked.manager)
     .count,
   chunks.length
 );

 // Existing source byte and count limits still reject oversized original observations.
 const oversized=fixture({
   kind:'turn_start',
   handlers:[function observe(){return undefined;}]
 });
 await oversized.runner
   .emit({
     type:'turn_start',
     text:'x'.repeat(65_536)
   });
 assert.throws(
   function requireCompleteCapture(){assertNativeSessionInputCapture(oversized.manager);},
   function captureProfile(error){return error.message
     .includes('supported source capture profile');}
 );
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
 assert.throws(
   function requireCountBound(){assertNativeSessionInputCapture(exhausted.manager);},
   function captureProfile(error){return error.message
     .includes('supported source capture profile');}
 );

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
     .includes('supported source capture profile');}
 );

}
//endregion
