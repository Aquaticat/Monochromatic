/**
 Original native context traversal cannot lose callback inputs, results, or completion failures.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

import {completeContext,contextFailure,contextFixture} from './native-context-observer-fixture.ts';


/** Native capture may throw any JavaScript value;
 tests keep that boundary unknown. */
const originalFailures: readonly unknown[]=[undefined,null,1,'original capture failure',new Error('original capture error')];


//region Original inputs and raw results retain their observation time and native error behavior

await describe({name:'',children:[
 it({name:'retains original input, complete result, and in-place input mutation before native selection',fn:async function completeValues(){

  /** Each consumer owns independent callbacks and mutable input. */
  const fixture=contextFixture();

  fixture.observer.begin({kind:'context',snapshot:fixture.snapshot});

  fixture.observer.before(fixture.position);

  fixture.message.content='mutated text';

  /** Complete raw results include fields native message selection does not consume. */
  const result={messages:fixture.event.messages,ignored:'unselected original result'};

  fixture.observer.returned(result);

  result.ignored='later mutation';

  fixture.message.content='later input mutation';

  fixture.observer.end('context');

  /** Only complete original traversal can publish this receipt. */
  const completed=completeContext(fixture.observer);

  expect(fixture.records.map(function phase(record){
return record.phase;
})).toEqual(['input','output','after']);

  expect(fixture.records[0]?.value).toMatchObject({messages:[{content:'original text'}]});

  expect(fixture.records[1]?.value).toMatchObject({ignored:'unselected original result',messages:[{content:'mutated text'}]});

  expect(fixture.records[2]?.value).toMatchObject({messages:[{content:'mutated text'}]});

  expect(completed).toEqual({kinds:['context','context_with_system'],handlers:1});

  expect(Object.isFrozen(completed)).toBe(true);

  expect(Object.isFrozen(completed.kinds)).toBe(true);

 }}),
 ...['undefined','throw'].map(function settlement(mode){
return it({name:`retains settled input after ${mode} while preserving native reporting`,fn:async function settledInput(){

  /** Each consumer owns independent callbacks and mutable input. */
  const fixture=contextFixture();

  fixture.observer.begin({kind:'context',snapshot:fixture.snapshot});

  fixture.observer.before(fixture.position);

  fixture.message.content='settled text';

  if(mode==='undefined')fixture.observer.returned(undefined);

  else fixture.observer.failed(new Error('original handler failure'));

  fixture.observer.failed(new Error('original result processing failure'));

  fixture.observer.end('context');

  expect(completeContext(fixture.observer).handlers).toBe(1);

  expect(fixture.records.map(function phase(record){
return record.phase;
})).toEqual(['input','after']);

  expect(fixture.records[1]?.value).toMatchObject({messages:[{content:'settled text'}]});

 }});
}),
 ...originalFailures.flatMap(function thrownValue(original){
return ['input','output','after'].map(function capturePhase(phase){
return it({name:`preserves ${String(original)} capture failure during ${phase}`,fn:async function originalFailure(){

  /** Each consumer owns independent callbacks and mutable input. */
  const fixture=contextFixture(function failAt(input){
if(input.phase===phase)throw original;
});

  fixture.observer.begin({kind:'context',snapshot:fixture.snapshot});

  if(phase==='input'){
   /** The native catch first receives the observer propagation wrapper. */
   const wrapper=contextFailure(function before(){
fixture.observer.before(fixture.position);
});

   expect(contextFailure(function nativeCatch(){
fixture.observer.failed(wrapper);
})).toBe(original);

  }else{
   fixture.observer.before(fixture.position);

   if(phase==='output'){
    /** The native catch first receives the observer propagation wrapper. */
    const wrapper=contextFailure(function returned(){
fixture.observer.returned({value:'result'});
});

    expect(contextFailure(function nativeCatch(){
fixture.observer.failed(wrapper);
})).toBe(original);

   }else expect(contextFailure(function nativeCatch(){
fixture.observer.failed(new Error('native handler error'));
})).toBe(original);

  }
  expect(contextFailure(function incomplete(){
fixture.observer.end('context');
})).toHaveProperty('name','NativeContextContractError');

 }});
});
}),
]});


//endregion Original inputs and raw results retain their observation time and native error behavior

//region Traversal checks distinguish original membership, pending work, omission, and reuse

await describe({name:'native context traversal',children:[
 ...['extension','handler','reentry','omitted','wrong-end','pending-completion'].map(function invalidPosition(mode){
return it({name:`rejects ${mode} without publishing complete traversal`,fn:async function originalPosition(){

  /** Each consumer owns independent callbacks and mutable input. */
  const fixture=contextFixture();

  fixture.observer.begin({kind:'context',snapshot:fixture.snapshot});

  /** The rejected operation must leave its native traversal incomplete. */
  const error=contextFailure(function invalid(){

   if(mode==='extension')fixture.observer.before({...fixture.position,extension:{...fixture.extension}});

   else if(mode==='handler')fixture.observer.before({...fixture.position,handler:function substituted(){
throw new Error("Substituted handler must not run");
}});

   else if(mode==='omitted')fixture.observer.end('context');

   else if(mode==='wrong-end')fixture.observer.end('context_with_system');

   else if(mode==='pending-completion')fixture.observer.complete();

   else {
fixture.observer.before(fixture.position);
fixture.observer.before(fixture.position);
}
  });

  expect(error).toHaveProperty('name','NativeContextContractError');

 }});
}),
 it({name:'requires both original stages and rejects completion reuse',fn:async function completedOnce(){

  /** Each consumer owns independent callbacks and mutable input. */
  const fixture=contextFixture();

  expect(contextFailure(function early(){
fixture.observer.complete();
})).toHaveProperty('name','NativeContextContractError');

  expect(contextFailure(function wrongFirst(){
fixture.observer.begin({kind:'context_with_system',snapshot:[]});
})).toHaveProperty('name','NativeContextContractError');

  expect(contextFailure(function noCallback(){
fixture.observer.returned(undefined);
})).toHaveProperty('name','NativeContextContractError');

  fixture.observer.begin({kind:'context',snapshot:[]});

  fixture.observer.end('context');

  expect(contextFailure(function missingSecond(){
fixture.observer.complete();
})).toHaveProperty('name','NativeContextContractError');

  expect(completeContext(fixture.observer).handlers).toBe(0);

  expect(contextFailure(function repeated(){
fixture.observer.complete();
})).toHaveProperty('name','NativeContextContractError');

  expect(contextFailure(function reopened(){
fixture.observer.begin({kind:'context',snapshot:[]});
})).toHaveProperty('name','NativeContextContractError');

 }}),
 it({name:'requires original extension data paths without calling accessors',fn:async function originalPath(){

  /** Each consumer owns independent callbacks and mutable input. */
  const fixture=contextFixture();

  /** Accessor read count verifies that metadata inspection executes no getter. */
  const state={reads:0};

  /** This accessor must remain unexecuted during original path capture. */
  const extension={get path(){
state.reads++;
return 'computed path';
}};

  expect(contextFailure(function accessor(){
fixture.observer.begin({kind:'context',snapshot:[{ext:extension,handlers:[fixture.handler]}]});
})).toHaveProperty('name','NativeContextContractError');

  expect(state.reads).toBe(0);

  fixture.observer.begin({kind:'context',snapshot:fixture.snapshot});

  fixture.extension.path='changed after original snapshot';

  fixture.observer.before(fixture.position);

  fixture.observer.returned(undefined);

  fixture.observer.end('context');

  completeContext(fixture.observer);

  expect(fixture.records.every(function original(record){
return record.path==='fixture-context-extension';
})).toBe(true);

 }}),
]});


//endregion Traversal checks distinguish original membership, pending work, omission, and reuse
