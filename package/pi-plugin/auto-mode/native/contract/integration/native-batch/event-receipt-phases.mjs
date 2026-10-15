import assert from 'node:assert/strict';
import {fixture} from './event-receipt-fixture.mjs';
import {isNativeEventObservation} from './event-observer.ts';
import {readNativeSessionInputUsage} from './generated/session-manager.mjs';

//region Preserve the original native event assertions and their fixture-owned observations.
export async function verifyEventPhases(){
 // More callback phases than the source count allowance still form one bounded emission.
 const original={
   type:'turn_start',
   text:'original'
 };
 const grouped=fixture({
   kind:'turn_start',
   handlers:Array.from(
     {length:30},
     function handlerAt(
       _,
       ordinal
     ){return function retainPhase(event){event.text=`mutation-${ordinal}`;return {unused:`output-${ordinal}`};};}
   )
 });
 const before=grouped.observation();
 assert.ok(isNativeEventObservation(before));
 assert.equal(
   isNativeEventObservation({...before}),
   false
 );
 await grouped.runner
   .emit(original);
 const [records]=grouped.records();
 assert.equal(
   records.length,
   90
 );
 assert.equal(
   readNativeSessionInputUsage(grouped.manager)
     .count,
   1
 );
 assert.deepEqual(
   records.slice(
     0,
     3
   )
     .map(function phase(record){return record.phase;}),
   [
     'input',
     'output',
     'after'
   ]
 );
 assert.equal(
   records[0]
     .value
     .value
     .text,
   'original'
 );
 assert.equal(
   records[1]
     .value
     .value
     .unused,
   'output-0'
 );
 assert.equal(
   records[2]
     .value
     .value
     .text,
   'mutation-0'
 );
 original.text='later mutation';
 assert.equal(
   records[0]
     .value
     .value
     .text,
   'original'
 );
 assert.equal(
   grouped.observation()
     .pending,
   0
 );
 assert.notEqual(
   grouped.observation(),
   before
 );
 assert.equal(
   grouped.observation(),
   grouped.observation()
 );

 // Pi's original await captures the result before a later queued mutation.
 const delayedState={result:undefined,mutated:false};
 const delayed=fixture({
   kind:'turn_start',
   handlers:[function delayedResult(){
  delayedState.result={unused:'original result'};
  const deferred=Promise.withResolvers();
  queueMicrotask(function settle(){deferred.resolve(delayedState.result);queueMicrotask(function later(){delayedState.result.unused='later result';delayedState.mutated=true;});});
  return deferred.promise;
 }]
 });
 await delayed.runner
   .emit({type:'turn_start'});
 assert.equal(
   delayedState.mutated,
   true
 );
 assert.equal(
   delayed.records()[0][1]
     .value
     .value
     .unused,
   'original result'
 );

 // Native cancellation and block returns preserve their result and skip later callbacks.
 for(const kind of [
   'session_before_switch',
   'tool_call'
 ]){
  let laterCalls=0;
  const returned=kind==='tool_call'?{
    block:true,
    reason:'fixture block'
  }:{cancel:true};
  const native=fixture({
    kind,
    handlers:[
      function stop(){return returned;},
      function later(){laterCalls++;}
    ]
  });
  const actual=kind==='tool_call'?await native.runner
    .emitToolCall({type:kind}):await native.runner
      .emit({type:kind});
  assert.equal(
    actual,
    returned
  );
  assert.equal(
    laterCalls,
    0
  );
  assert.equal(
    native.observation()
      .pending,
    0
  );
  assert.equal(
    native.records()[0]
      .length,
    3
  );
 }

 // Generic native error reporting and unhandled tool-call error identity remain distinct.
 for(const kind of [
   'turn_start',
   'tool_call'
 ]){
  const thrown={original:'fixture failure'};
  const native=fixture({
    kind,
    handlers:[function mutateThenThrow(event){event.changed='before failure';throw thrown;}]
  });
  if(kind==='tool_call'){
   let caught;
   try{await native.runner
     .emitToolCall({type:kind});}catch(error){caught=error;}
   assert.equal(
     caught,
     thrown
   );
  }else{await native.runner
    .emit({type:kind});assert.equal(
    native.errors
      .length,
    1
  );}
  assert.equal(
    native.records()[0]
      .at(-1)
      .value
      .value
      .changed,
    'before failure'
  );
  assert.equal(
    native.observation()
      .pending,
    0
  );
 }

}
//endregion
