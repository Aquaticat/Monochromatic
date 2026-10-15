import assert from 'node:assert/strict';
import {createNativeEventObserver} from './event-observer.ts';

//region Preserve the original native event assertions and their fixture-owned observations.
export function verifyEventFailures(){
 // Native observation failures preserve even nullish thrown values after retirement.
 for(const originalFailure of [
   undefined,
   null,
   'failure',
   new Error('fixture capture failure')
 ]){
  const observer=createNativeEventObserver(function captureFactory(){return {
    capture(){throw originalFailure;},
    complete(){return undefined;}
  };});
  const extension={path:'fixture'};
  function handler(){return undefined;}
  const traversal=observer.begin({
    kind:'turn_start',
    snapshot:[{
      ext:extension,
      handlers:[handler]
    }]
  });
  let wrapped;
  try{traversal.before({
    extension,
    handler,
    event:{type:'turn_start'}
  });}catch(error){wrapped=error;}
  let caught=false;
  try{traversal.aborted(wrapped);}catch(error){caught=true;assert.equal(
    error,
    originalFailure
  );}
  assert.equal(
    caught,
    true
  );
  assert.equal(
    observer.read(['turn_start'])
      .failed,
    true
  );
  assert.equal(
    observer.read(['turn_start'])
      .pending,
    0
  );
 }
 const completionFailure=new Error('fixture completion failure');
 const completion=createNativeEventObserver(function captureFactory(){return {
   capture(){return undefined;},
   complete(){throw completionFailure;}
 };});
 const extension={path:'fixture'};
 function handler(){return undefined;}
 const traversal=completion.begin({
   kind:'turn_start',
   snapshot:[{
     ext:extension,
     handlers:[handler]
   }]
 });
 traversal.before({
   extension,
   handler,
   event:{type:'turn_start'}
 });
 traversal.returned(undefined);
 const completionState={wrapped:undefined};
 try{traversal.end();}catch(error){completionState.wrapped=error;}
 assert.throws(
   function unwrapCompletion(){traversal.aborted(completionState.wrapped);},
   function original(error){return error===completionFailure;}
 );
 assert.equal(
   completion.read(['turn_start'])
     .pending,
   0
 );
 assert.equal(
   completion.read(['turn_start'])
     .failed,
   true
 );
}
//endregion
