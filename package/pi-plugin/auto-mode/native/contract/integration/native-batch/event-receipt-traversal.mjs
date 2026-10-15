import assert from 'node:assert/strict';
import {traversalFixture} from './event-receipt-fixture.mjs';

//region Preserve the original native event assertions and their fixture-owned observations.
export function verifyEventTraversal(){
 // A valid original position establishes that the traversal controls can complete.
 const valid=traversalFixture();
 valid.traversal
   .before(valid.input);
 valid.traversal
   .returned(undefined);
 valid.traversal
   .end();
 assert.deepEqual(
   valid.phases,
   [
     'input',
     'after'
   ]
 );
 assert.equal(
   valid.observer
     .read(['turn_start'])
     .failed,
   false
 );
 assert.equal(
   valid.observer
     .read(['turn_start'])
     .pending,
   0
 );
 const invalidTraversals=[
  function omittedPosition({traversal}){traversal.end();},
  function foreignExtension({
    traversal,
    input
  }){traversal.before({
    ...input,
    extension:{...input.extension}
  });},
  function foreignHandler({
    traversal,
    input
  }){traversal.before({
    ...input,
    handler:function copiedHandler(){return undefined;}
  });},
  function missingInvocation({traversal}){traversal.returned(undefined);},
  function overlappingInvocation({
    traversal,
    input
  }){traversal.before(input);traversal.before(input);},
  function unsettledEnd({
    traversal,
    input
  }){traversal.before(input);traversal.end();},
  function prematureStop({traversal}){traversal.stopped();},
  function repeatedCompletion({
    traversal,
    input
  }){traversal.before(input);traversal.returned(undefined);traversal.end();traversal.end();}
 ];
 for(const violate of invalidTraversals){
  const native=traversalFixture();
  let wrapped;
  assert.throws(
    function requireOriginalTraversal(){try{violate(native);}catch(error){wrapped=error;throw error;}},
    {message:'Original native event source capture failed'}
  );
  assert.throws(
    function retainContractFailure(){native.traversal
      .aborted(wrapped);},
    function originalContract(error){return error.name==='NativeEventContractError';}
  );
  assert.equal(
    native.observer
      .read(['turn_start'])
      .failed,
    true
  );
  assert.equal(
    native.observer
      .read(['turn_start'])
      .pending,
    0
  );
 }

}
//endregion
