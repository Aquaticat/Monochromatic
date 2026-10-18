/** Built operation captures retain one presentation view and release it at closure. @module */
import assert from 'node:assert/strict';
import {describe,it} from '@monochromatic-dev/module-test/ts';

//region Only the built native scope participates in these consumer observations.
/**
 Create an operation through the shipped module without asserting its implementation types.

 @param capture - original bootstrap capability reader
 @returns built operation for its consumer to narrow
 */
async function operation(capture:()=>unknown):Promise<unknown>{
 const namespace:unknown=await import(new URL(
  '../dist/native/contract/integration/action-policy/approval.mjs',import.meta.url,
 ).href);
 assert.ok((namespace!==null)&&((typeof namespace)==='object')&&('createApprovalHostOperation' in namespace));
 const factory:unknown=namespace.createApprovalHostOperation;
 assert.ok((typeof factory)==='function');
 const result:unknown=Reflect.apply(factory,undefined,[capture]);
 return result;
}

/**
 Invoke the built capability with its original receiver and unmodified return value.

 @param owner - actual built operation
 @param key - callable member of the consumer protocol
 @returns original result for identity assertions
 */
function invoke({owner,key}:Readonly<{owner:unknown;key:string|symbol}>):unknown{
 assert.ok((owner!==null)&&((typeof owner)==='object'));
 const method:unknown=Reflect.get(owner,key);
 assert.ok((typeof method)==='function');
 const result:unknown=Reflect.apply(method,owner,[]);
 return result;
}

await describe({
 name:'built original approval capability capture',
 children:[
  it({name:'shares one borrowed host through repeated reads without freezing it',fn:async function captureOriginalHost(){
   const counts={calls:0};
   const host={current:'original native capabilities'};
   const scope=await operation(function capture(){counts.calls++;return host;});
   try{
    assert.equal(invoke({owner:scope,key:'captureHost'}),host);
    host.current='borrowed capabilities remain mutable';
    assert.equal(invoke({owner:scope,key:'captureHost'}),host);
    assert.equal(counts.calls,1);
    assert.equal(Object.isFrozen(host),false);
   }finally{invoke({owner:scope,key:Symbol.dispose});}
  }}),
  it({name:'retains absent presentation capability without querying its source again',fn:async function captureAbsentHost(){
   const counts={calls:0};
   const scope=await operation(function captureMissing(){counts.calls++;return undefined;});
   try{
    assert.equal(invoke({owner:scope,key:'captureHost'}),undefined);
    assert.equal(invoke({owner:scope,key:'captureHost'}),undefined);
    assert.equal(counts.calls,1);
   }finally{invoke({owner:scope,key:Symbol.dispose});}
  }}),
  it({name:'retains original failed capture identity including falsy thrown values',fn:async function captureFailedHost(){
   const failures:readonly unknown[]=[undefined,null,false,'original capture failure',Symbol('original failed presentation capture'),new Error('original capture error')];
   await Promise.all(failures.map(async function verifyFailure(failure){
    const counts={calls:0};
    const scope=await operation(function failCapture(){counts.calls++;throw failure;});
    try{
     assert.throws(function captureFirst(){invoke({owner:scope,key:'captureHost'});},function originalFirst(error:unknown){return error===failure;});
     assert.throws(function captureAgain(){invoke({owner:scope,key:'captureHost'});},function originalAgain(error:unknown){return error===failure;});
     assert.equal(counts.calls,1);
    }finally{invoke({owner:scope,key:Symbol.dispose});}
   }));
  }}),
  it({name:'captures fresh capabilities for the next operation and rejects reads after closure',fn:async function closeAndRecapture(){
   const counts={calls:0};
   const hosts=[{name:'original context'},{name:'reloaded context'}];
   function capture(){const host=hosts[counts.calls];counts.calls++;return host;}
   const first=await operation(capture);
   assert.equal(invoke({owner:first,key:'captureHost'}),hosts[0]);
   invoke({owner:first,key:Symbol.dispose});
   invoke({owner:first,key:Symbol.dispose});
   assert.throws(function readClosed(){invoke({owner:first,key:'captureHost'});},/original approval capability scope has ended/u);
   assert.equal(counts.calls,1);
   const next=await operation(capture);
   try{assert.equal(invoke({owner:next,key:'captureHost'}),hosts[1]);assert.equal(counts.calls,2);}
   finally{invoke({owner:next,key:Symbol.dispose});}
  }}),
  it({name:'closing before the first read never queries the bootstrap source',fn:async function closeUnreadCapture(){
   const counts={calls:0};
   const scope=await operation(function unusedCapture(){counts.calls++;return {};});
   invoke({owner:scope,key:Symbol.dispose});
   assert.throws(function readClosed(){invoke({owner:scope,key:'captureHost'});},/original approval capability scope has ended/u);
   assert.equal(counts.calls,0);
  }}),
 ],
});
//endregion Built host identity, absence, failure, next-operation freshness and closure
